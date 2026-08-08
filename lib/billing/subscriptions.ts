import { and, eq, isNull, ne } from 'drizzle-orm'
import { db, type DbOrTx } from '@/lib/db'
import {
  places,
  planGrants,
  subscriptions,
  users,
  type PlanGrantAction,
  type Subscription,
} from '@/lib/db/schema'
import { esDuenoDe } from '@/lib/claims/ownership'
import type { Resultado } from '@/lib/claims/acciones'

/**
 * Sync de los flags de plan (MONETIZACION, decisión 8). La suscripción es lo único
 * que **mueve** `users.plan` (B2C) y `places.owner_plan` (B2B); los helpers de
 * gating (`esPremium`, `resolverContenidoDueno`, cap de fotos, gates de votación)
 * no se tocan, solo consultan el flag. Cuál flag se mueve lo decide el eje de la
 * suscripción: `place_id IS NULL` ⇒ premium del usuario; con valor ⇒ el lugar.
 *
 * Este módulo es la fuente única de esa regla — nadie más escribe los flags (se
 * retiró el "UPDATE documentado" de AUTH/VOTACION).
 */

/** Sube el flag: premium (B2C) o paid (B2B) según el eje. */
export async function activarFlagDelPlan(
  tx: DbOrTx,
  sub: Pick<Subscription, 'userId' | 'placeId'>,
  now: Date,
): Promise<void> {
  if (sub.placeId === null) {
    await tx.update(users).set({ plan: 'premium', updatedAt: now }).where(eq(users.id, sub.userId))
  } else {
    await tx
      .update(places)
      .set({ ownerPlan: 'paid', updatedAt: now })
      .where(eq(places.id, sub.placeId))
  }
}

/**
 * Baja el flag a free (decisión 19: ocultar ≠ borrar — el contenido pago queda,
 * solo deja de mostrarse). No borra nada más; re-suscribir lo trae todo de vuelta.
 */
export async function bajarFlagDelPlan(
  tx: DbOrTx,
  sub: Pick<Subscription, 'userId' | 'placeId'>,
  now: Date,
): Promise<void> {
  if (sub.placeId === null) {
    await tx.update(users).set({ plan: 'free', updatedAt: now }).where(eq(users.id, sub.userId))
  } else {
    await bajarFlagDeLugar(tx, sub.placeId, now)
  }
}

/**
 * La bajada del eje B2B **sin** eje completo, para los llamadores que bajan el plan
 * de un lugar sin tener una suscripción a mano: `cancelarSuscripcionDeLugar` baja el
 * flag incluso cuando no hay fila viva (`lib/billing/baja.ts`), así que no puede
 * armar el `{ userId, placeId }` que pide `bajarFlagDelPlan`.
 *
 * Existe para que ese caso no tenga que escribir el `UPDATE` por su cuenta: era la
 * **segunda implementación** de la regla (ADMIN_USUARIOS, `ADMU-QA-01`) y dos copias
 * driftean. Sigue habiendo un solo lugar donde `places.owner_plan` se escribe.
 */
export async function bajarFlagDeLugar(
  tx: DbOrTx,
  placeId: string,
  now: Date,
): Promise<void> {
  await tx.update(places).set({ ownerPlan: 'free', updatedAt: now }).where(eq(places.id, placeId))
}

/**
 * La suscripción **viva** (≠ canceled) de un eje. `placeId=null` ⇒ la B2C del
 * usuario; con valor ⇒ la B2B de ese lugar. Los índices únicos parciales garantizan
 * a lo sumo una (decisión 12). Una cancelada en gracia sigue siendo "viva" hasta
 * `canceled` — por eso el filtro es por `status`, no por `cancel_at_period_end`.
 */
export async function getSuscripcionViva(
  opts: { userId: string; placeId: null } | { placeId: string },
  database: DbOrTx = db,
): Promise<Subscription | undefined> {
  const cond =
    'userId' in opts
      ? and(
          eq(subscriptions.userId, opts.userId),
          isNull(subscriptions.placeId),
          ne(subscriptions.status, 'canceled'),
        )
      : and(eq(subscriptions.placeId, opts.placeId), ne(subscriptions.status, 'canceled'))

  const [sub] = await database.select().from(subscriptions).where(cond).limit(1)
  return sub
}

/** Lee una suscripción por su preapproval de MP (la clave que trae el webhook). */
export async function getSuscripcionPorPreapproval(
  preapprovalId: string,
  database: DbOrTx = db,
): Promise<Subscription | undefined> {
  const [sub] = await database
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.mpPreapprovalId, preapprovalId))
    .limit(1)
  return sub
}

/** Suma un mes calendario (maneja fin de mes). Compartido con la reconciliación. */
export function sumarUnMes(from: Date): Date {
  const d = new Date(from)
  d.setMonth(d.getMonth() + 1)
  return d
}

/**
 * Fin del período de facturación: usa el `next_payment_date` de MP solo si es
 * posterior al inicio; si no, +1 mes (MP a veces devuelve fechas inválidas al crear
 * el preapproval). Port de `resolvePeriodEnd` de StressPlan.
 */
export function resolverFinDePeriodo(periodStart: Date, nextPaymentDate?: string | null): Date {
  const fallback = sumarUnMes(periodStart)
  if (!nextPaymentDate) return fallback
  const parsed = new Date(nextPaymentDate)
  if (Number.isNaN(parsed.getTime()) || parsed <= periodStart) return fallback
  return parsed
}

// ---------------------------------------------------------------------------
// Premium de cortesía — spec ADMIN_USUARIOS
// ---------------------------------------------------------------------------
//
// El otro llamador de los flags, además de la suscripción: el admin regalando
// premium desde `/admin` (`FB-01`). Vive **acá adentro** a propósito (decisión 2):
// este módulo ya es el dueño único de `users.plan` y `places.owner_plan` y ya
// resuelve el eje con la misma forma, así que la cortesía es *un llamador más de
// lo que ya existe* — `activarFlagDelPlan` y `bajarFlagDelPlan` no cambian una
// línea. Cualquier `update(users).set({ plan })` fuera de esos dos helpers es un
// bug.

/** Mismo criterio de eje que `subscriptions`: `placeId` null ⇒ B2C; con valor ⇒ ese lugar. */
export type EjeDePlan = { userId: string; placeId: string | null }

/** Motivo (obligatorio, decisión 6) y quién lo hizo, para la bitácora. */
export type CortesiaOpts = { motivo: string; adminEmail: string }

/** `yaEstaba: true` = el flag ya estaba ahí: no se escribió nada, tampoco bitácora. */
export type CortesiaAplicada = { yaEstaba: boolean }

const MOTIVO_MIN = 3
const MOTIVO_MAX = 280

/**
 * Le da el premium de cortesía a un eje: `users.plan='premium'` (B2C) o
 * `places.owner_plan='paid'` (B2B, sobre un lugar que ese usuario tenga con
 * reclamo aprobado).
 *
 * **No crea fila de `subscriptions`** y no puede pisar a alguien que paga: el
 * discriminante "esto es cortesía" que ya está en producción es *premium sin fila
 * viva* (`estado.status === null`, decisión 3), y esta función lo respeta en vez de
 * inventar un segundo.
 *
 * El usuario ve el cambio en su próximo render de `/cuenta` — el flag nunca viajó
 * en la sesión, justamente para esto. No se manda mail (decisión 11).
 */
export async function otorgarCortesia(
  eje: EjeDePlan,
  opts: CortesiaOpts,
): Promise<Resultado<CortesiaAplicada>> {
  return moverCortesia(eje, opts, 'grant')
}

/**
 * Le saca la cortesía: vuelve a `free`. **Oculta, no borra** (decisión 4): las
 * listas de favoritos por encima del cupo free y el contenido pago del lugar
 * (fotos 4-15, descripción, carta, novedades) quedan en la base y re-otorgar los
 * devuelve enteros. Es puerta de ida y vuelta, y por eso pide motivo igual.
 */
export async function revocarCortesia(
  eje: EjeDePlan,
  opts: CortesiaOpts,
): Promise<Resultado<CortesiaAplicada>> {
  return moverCortesia(eje, opts, 'revoke')
}

/**
 * Las dos direcciones son la misma operación con distinto objetivo: validar el
 * motivo, chequear que el eje se pueda tocar, y —si el flag no estaba ya ahí—
 * moverlo **y** registrar la bitácora en una sola transacción (o las dos cosas, o
 * ninguna: una bitácora sin flag mentiría, un flag sin bitácora no se puede
 * auditar).
 *
 * El flag se lee con `for('update')` dentro de la transacción: es lo que hace que
 * un doble click deje **una** fila de `plan_grants` y no dos (ADMU-07).
 */
async function moverCortesia(
  eje: EjeDePlan,
  opts: CortesiaOpts,
  accion: PlanGrantAction,
): Promise<Resultado<CortesiaAplicada>> {
  // Se valida acá y no solo en la UI: el endpoint es un boundary (decisión 6).
  const motivo = opts.motivo.trim()
  if (motivo.length < MOTIVO_MIN) {
    return { ok: false, code: 'MOTIVO_CORTO', message: 'Escribí por qué, aunque sea corto.' }
  }
  if (motivo.length > MOTIVO_MAX) {
    return {
      ok: false,
      code: 'MOTIVO_LARGO',
      message: `El motivo no puede pasar de ${MOTIVO_MAX} caracteres.`,
    }
  }

  return db.transaction(async (tx): Promise<Resultado<CortesiaAplicada>> => {
    const [usuario] = await tx
      .select({ plan: users.plan })
      .from(users)
      .where(eq(users.id, eje.userId))
      .for('update')
    if (!usuario) return { ok: false, code: 'NO_EXISTE', message: 'Esa cuenta no existe.' }

    let yaEsPremium: boolean
    if (eje.placeId === null) {
      yaEsPremium = usuario.plan === 'premium'
    } else {
      // El gate del eje B2B es el reclamo aprobado (decisión 5): darle el plan pago
      // a un lugar sin dueño no le sirve a nadie. Solo al **dar**: si el reclamo se
      // revocó después, sacárselo tiene que seguir siendo posible o la cortesía
      // dejaría de ser puerta de ida y vuelta (decisión 4).
      if (accion === 'grant' && !(await esDuenoDe(eje.userId, eje.placeId, tx))) {
        return { ok: false, code: 'NO_ES_DUENO', message: 'Ese lugar no es de esa cuenta.' }
      }
      const [lugar] = await tx
        .select({ ownerPlan: places.ownerPlan })
        .from(places)
        .where(eq(places.id, eje.placeId))
        .for('update')
      if (!lugar) return { ok: false, code: 'NO_EXISTE', message: 'Ese lugar no existe.' }
      yaEsPremium = lugar.ownerPlan === 'paid'
    }

    // Decisión 3: la cortesía es solo para ejes SIN suscripción viva. En los dos
    // sentidos — al que paga no se le regala nada ni se le saca desde acá; para eso
    // está la cancelación, que ya vive en otro lado.
    const viva = await getSuscripcionViva(
      eje.placeId === null ? { userId: eje.userId, placeId: null } : { placeId: eje.placeId },
      tx,
    )
    if (viva) {
      return {
        ok: false,
        code: 'TIENE_SUSCRIPCION',
        message: 'Tiene una suscripción paga: desde acá no se toca.',
      }
    }

    const objetivoEsPremium = accion === 'grant'
    // Nada cambió ⇒ nada que registrar (decisión 2): idempotente ante doble click.
    if (yaEsPremium === objetivoEsPremium) return { ok: true, data: { yaEstaba: true } }

    const now = new Date()
    if (objetivoEsPremium) {
      await activarFlagDelPlan(tx, eje, now)
    } else {
      await bajarFlagDelPlan(tx, eje, now)
    }

    await tx.insert(planGrants).values({
      userId: eje.userId,
      placeId: eje.placeId,
      accion,
      motivo,
      grantedBy: opts.adminEmail,
    })

    return { ok: true, data: { yaEstaba: false } }
  })
}
