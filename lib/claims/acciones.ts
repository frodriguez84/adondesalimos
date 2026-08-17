import { and, eq, ne } from 'drizzle-orm'
import { db } from '@/lib/db'
import { placeClaims, places, users } from '@/lib/db/schema'
import { asignarZonasDeLugar } from '@/lib/zones/persistir'
import { cancelarSuscripcionDeLugar } from '@/lib/billing/baja'
import { DECLARACION_VERSION } from './declaracion'
import { revertirTagsAOverture, tieneDuenoAprobado } from './ownership'
import type { AltaPayload, Decision, ReclamoPayload } from './validacion'

/**
 * Escrituras del flujo dueño (AUTH F2). Todo lo que cambia estado pasa por acá,
 * así el route handler queda como adaptador (validar → llamar → mapear código a
 * status HTTP) y esta lógica se puede testear contra la base sin HTTP.
 *
 * Lo único que estas acciones tocan del catálogo es `publish_override`
 * (decisión 3). **La regla de visibilidad no se toca**: aprobar mueve una
 * entrada de la regla, no la regla.
 */

export type Fallo = { ok: false; code: string; message: string }
export type Exito<T> = { ok: true; data: T }
export type Resultado<T> = Exito<T> | Fallo

const fallo = (code: string, message: string): Fallo => ({ ok: false, code, message })

export type ClaimCreado = { claimId: string; placeId: string }

/**
 * Reclamo de un lugar que ya existe. Dos rechazos posibles antes de insertar:
 * el lugar ya tiene dueño, o este mismo usuario ya tiene una solicitud en cola
 * para ese lugar (mandarla de nuevo no la apura).
 *
 * Dos usuarios distintos SÍ pueden tener pendientes sobre el mismo lugar: el
 * índice único parcial solo limita los aprobados, y el admin resuelve viendo
 * ambos (edge case del spec).
 */
export async function crearReclamo(
  userId: string,
  payload: ReclamoPayload,
): Promise<Resultado<ClaimCreado>> {
  const [place] = await db
    .select({ id: places.id })
    .from(places)
    .where(eq(places.id, payload.placeId))
    .limit(1)

  if (!place) return fallo('PLACE_NOT_FOUND', 'Ese lugar no existe.')

  if (await tieneDuenoAprobado(place.id)) {
    return fallo('YA_RECLAMADO', 'Ese lugar ya tiene un dueño verificado.')
  }

  const [pendiente] = await db
    .select({ id: placeClaims.id })
    .from(placeClaims)
    .where(
      and(
        eq(placeClaims.placeId, place.id),
        eq(placeClaims.userId, userId),
        eq(placeClaims.status, 'pending'),
      ),
    )
    .limit(1)

  if (pendiente) {
    return fallo('YA_PENDIENTE', 'Ya tenés una solicitud en revisión para este lugar.')
  }

  const [creado] = await db
    .insert(placeClaims)
    .values({
      placeId: place.id,
      userId,
      kind: 'claim',
      applicantName: payload.applicantName,
      applicantPhone: payload.applicantPhone,
      applicantRole: payload.applicantRole,
      comment: payload.comment || null,
      // Queda registrado QUÉ se declaró, no solo QUE se declaró (TITULARIDAD
      // decisión 6): el texto va a cambiar y la versión lo ata.
      declaracionVersion: DECLARACION_VERSION,
    })
    .returning({ id: placeClaims.id })

  return { ok: true, data: { claimId: creado.id, placeId: place.id } }
}

/**
 * Alta de un lugar nuevo (decisión 12): crea el `places` con `source='owner'`,
 * **invisible** —confidence null y sin override, así que la regla de CATALOGO lo
 * deja afuera hasta que el admin apruebe— y su claim `new` pendiente.
 *
 * El pin se asigna a zona en el mismo gesto, con la geometría de ZONAS. Todo en
 * una transacción: un lugar sin claim sería un fantasma invisible que nadie
 * podría reclamar.
 */
export async function crearAlta(
  userId: string,
  payload: AltaPayload,
): Promise<Resultado<ClaimCreado>> {
  const creado = await db.transaction(async (tx) => {
    const [place] = await tx
      .insert(places)
      .values({
        source: 'owner',
        name: payload.name,
        lat: payload.lat,
        lng: payload.lng,
        address: payload.address || null,
        locality: payload.locality || null,
        phones: payload.phone ? [payload.phone] : null,
        websites: payload.website ? [payload.website] : null,
        // confidence null + publishOverride false = invisible hasta la aprobación.
      })
      .returning({ id: places.id })

    await asignarZonasDeLugar(place.id, payload.lng, payload.lat, tx)

    const [claim] = await tx
      .insert(placeClaims)
      .values({
        placeId: place.id,
        userId,
        kind: 'new',
        applicantName: payload.applicantName,
        applicantPhone: payload.applicantPhone,
        applicantRole: payload.applicantRole,
        comment: payload.comment || null,
        declaracionVersion: DECLARACION_VERSION,
      })
      .returning({ id: placeClaims.id })

    return { claimId: claim.id, placeId: place.id }
  })

  return { ok: true, data: creado }
}

// ---------------------------------------------------------------------------
// Decisión del admin
// ---------------------------------------------------------------------------

export type ClaimDecidido = {
  claimId: string
  placeId: string
  placeName: string
  /** A quién avisarle. */
  userEmail: string
  /** El claim ya estaba en ese estado: **no** hay que mandar mail de nuevo. */
  yaEstaba: boolean
  /** El rechazo cayó sobre un aprobado: se revocó la publicación. */
  revocado: boolean
}

/**
 * Aprobar o rechazar, **idempotente** (edge case del spec: doble click).
 *
 * - Aprobar ⇒ `publish_override = true`: el lugar se publica aunque su
 *   confidence no llegue al umbral (decisión 3). La aprobación manual es mejor
 *   señal que el score.
 * - Rechazar un pendiente ⇒ el lugar queda exactamente como estaba.
 * - Rechazar un **aprobado** es la revocación (decisión 10): baja el override, y
 *   un lugar con `places.source = 'owner'` —dado de alta por un dueño— vuelve a
 *   ser invisible por la regla normal (sin override y con `confidence` null, no
 *   llega al umbral). **Ojo: eso es `places.source`, no `place_tags.source`** —
 *   dos columnas distintas, con el mismo nombre y el mismo valor `'owner'`. Las
 *   **tags** del dueño no se apagan solas: las revierte a Overture
 *   `revertirTagsAOverture` (decisión 12.3), acá abajo.
 *
 * El mail lo manda el llamador, y solo si `yaEstaba` es falso.
 */
export async function decidirClaim(
  claimId: string,
  decision: Decision,
  adminEmail: string,
): Promise<Resultado<ClaimDecidido>> {
  const [claim] = await db
    .select({
      id: placeClaims.id,
      status: placeClaims.status,
      placeId: placeClaims.placeId,
      placeName: places.name,
      userEmail: users.email,
    })
    .from(placeClaims)
    .innerJoin(places, eq(places.id, placeClaims.placeId))
    .innerJoin(users, eq(users.id, placeClaims.userId))
    .where(eq(placeClaims.id, claimId))
    .limit(1)

  if (!claim) return fallo('CLAIM_NOT_FOUND', 'Esa solicitud no existe.')

  const base = {
    claimId: claim.id,
    placeId: claim.placeId,
    placeName: claim.placeName,
    userEmail: claim.userEmail,
  }

  if (decision.accion === 'approve') {
    if (claim.status === 'approved') {
      return { ok: true, data: { ...base, yaEstaba: true, revocado: false } }
    }

    // El índice único parcial ya lo impediría; chequearlo antes convierte un
    // error de driver en un mensaje que el admin entiende.
    const [otro] = await db
      .select({ id: placeClaims.id })
      .from(placeClaims)
      .where(
        and(
          eq(placeClaims.placeId, claim.placeId),
          eq(placeClaims.status, 'approved'),
          ne(placeClaims.id, claim.id),
        ),
      )
      .limit(1)

    if (otro) {
      return fallo('OTRO_APROBADO', 'Ese lugar ya tiene otra solicitud aprobada.')
    }

    await db.transaction(async (tx) => {
      await tx
        .update(placeClaims)
        .set({
          status: 'approved',
          decidedAt: new Date(),
          decidedBy: adminEmail,
        })
        .where(eq(placeClaims.id, claim.id))

      // Lo único que este spec toca del catálogo (decisión 3).
      await tx
        .update(places)
        .set({ publishOverride: true, updatedAt: new Date() })
        .where(eq(places.id, claim.placeId))
    })

    return { ok: true, data: { ...base, yaEstaba: false, revocado: false } }
  }

  // --- Rechazo (y revocación, que es rechazar algo aprobado) -----------------
  if (claim.status === 'rejected') {
    return { ok: true, data: { ...base, yaEstaba: true, revocado: false } }
  }

  const revocado = claim.status === 'approved'

  await db.transaction(async (tx) => {
    await tx
      .update(placeClaims)
      .set({
        status: 'rejected',
        decidedAt: new Date(),
        decidedBy: adminEmail,
        adminNotes: decision.motivo,
      })
      .where(eq(placeClaims.id, claim.id))

    if (revocado) {
      await tx
        .update(places)
        .set({ publishOverride: false, updatedAt: new Date() })
        .where(eq(places.id, claim.placeId))

      // Las tags del dueño se van con el reclamo y vuelven las de Overture
      // (decisión 12.3). Dentro de la TX: o se revoca todo, o no se revoca nada.
      await revertirTagsAOverture(claim.placeId, tx)
    }
  })

  // MONETIZACION F2 (decisión 28): revocar un reclamo con una suscripción B2B viva
  // cancela el preapproval en MP (best-effort) y baja `owner_plan` — no se le puede
  // seguir cobrando por un lugar que ya no controla. Fuera de la TX: hace su propia
  // llamada de red a MP. Si MP no responde, la reconciliación lazy cierra el ciclo.
  if (revocado) {
    await cancelarSuscripcionDeLugar(claim.placeId)
  }

  return { ok: true, data: { ...base, yaEstaba: false, revocado } }
}
