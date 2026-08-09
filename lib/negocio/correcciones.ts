import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, type DbOrTx } from '@/lib/db'
import { placeDataEdits, places } from '@/lib/db/schema'
import { AMBA_BBOX } from '@/lib/geo/amba'
import { esDuenoDe } from '@/lib/claims/ownership'
import { asignarZonasDeLugar } from '@/lib/zones/persistir'
import type { Resultado } from '@/lib/claims/acciones'
import type { GoogleMatchStatus, PlaceEditOrigin } from '@/lib/db/schema'

/**
 * **Dueño único de la corrección de datos base** (CORRECCION_DATOS, decisión 6).
 *
 * Overture manda en sus columnas *salvo donde un humano dijo lo contrario*: lo
 * corregido se escribe en `places` y se marca en `places.locked_fields`, que es lo
 * que el re-import mira para no pisarlo (`scripts/overture/upsert.ts`).
 *
 * Si aparece un `update(places).set({ address: … })` fuera de este módulo y del
 * upsert del import, el spec está mal implementado.
 *
 * Escribir una corrección hace **cinco cosas en una sola transacción**:
 *  a. escribe los campos en `places`;
 *  b. suma los campos tocados a `locked_fields` — **unión, nunca reemplazo**:
 *     corregir la dirección hoy no puede desproteger el nombre del mes pasado;
 *  c. inserta la fila de bitácora (`place_data_edits`);
 *  d. re-asigna las zonas si se movió el pin (decisión 8) — `place_zones` es lo
 *     que lee la búsqueda, así que no puede esperar a `zones:assign`;
 *  e. invalida el match con Google si se movió el pin o cambió el nombre
 *     (decisión 9), porque ese `google_place_id` se resolvió a ±300 m del pin
 *     viejo y apunta a lo que hay en la dirección vieja.
 *
 * La validación **vive acá, no solo en la UI** (decisión 13): el endpoint es un
 * boundary y estas funciones reciben el body sin parsear. Mismo criterio que
 * `otorgarCortesia`, que valida su `motivo` por dentro.
 */

// ---------------------------------------------------------------------------
// Qué se puede corregir
// ---------------------------------------------------------------------------

/**
 * Las cinco columnas corregibles (decisión 3): las que Overture pisa y que ningún
 * otro dueño ya resuelve. Los contactos quedan afuera (los pisa el dueño vía
 * `place_owner_content`), y `confidence`/`operating_status` también — tocarlos a
 * mano sería editar la regla de publicación desde la puerta de atrás.
 *
 * Los nombres son **nombres de columna de Postgres**: `locked_fields` los guarda
 * tal cual y el `= ANY(...)` del import los compara contra literales.
 */
export const CAMPOS_CORREGIBLES = ['name', 'address', 'locality', 'lat', 'lng'] as const
export type CampoCorregible = (typeof CAMPOS_CORREGIBLES)[number]

/**
 * Lo que el **dueño** puede proponer (decisión 12): el `name` es solo de admin.
 * El nombre es la clave del buscador y del matching con Google a la vez, así que
 * renombrar una ficha ajena es el vector clásico de secuestro de listado.
 */
export const CAMPOS_DEL_DUENO = ['address', 'locality', 'lat', 'lng'] as const

/** Fuente que queda registrada cuando un admin suelta un campo (decisión 10). */
const FUENTE_SOLTAR = 'Soltado a mano: vuelve a actualizarse con Overture.'

// ---------------------------------------------------------------------------
// Validación (zod)
// ---------------------------------------------------------------------------

const texto = (min: number, max: number) => z.string().trim().min(min).max(max)

/** Obligatoria en las dos superficies (decisión 13): es lo que hace útil la bitácora. */
const fuente = z
  .string()
  .trim()
  .min(3, 'Contanos de dónde lo sacaste.')
  .max(500, 'La fuente es demasiado larga.')

// El pin se acota al bbox de AMBA (`lib/geo/amba.ts`, fuente única), mismo
// criterio que el alta de un lugar de dueño: un lugar de AMBA no se muda a
// Córdoba — si pasa de verdad, es un lugar para despublicar, no para corregir.
const ubicacion = {
  address: texto(0, 300).optional(),
  locality: texto(0, 120).optional(),
  lat: z
    .number()
    .min(AMBA_BBOX.ymin, 'Ese punto queda fuera del AMBA.')
    .max(AMBA_BBOX.ymax, 'Ese punto queda fuera del AMBA.')
    .optional(),
  lng: z
    .number()
    .min(AMBA_BBOX.xmin, 'Ese punto queda fuera del AMBA.')
    .max(AMBA_BBOX.xmax, 'Ese punto queda fuera del AMBA.')
    .optional(),
}

function validarCambios(valor: Record<string, unknown>, ctx: z.RefinementCtx) {
  const tocados = CAMPOS_CORREGIBLES.filter((campo) => valor[campo] !== undefined)
  if (tocados.length === 0) {
    ctx.addIssue({ code: 'custom', message: 'No mandaste ningún dato para corregir.' })
  }
  // El pin son dos columnas y una sola cosa: media coordenada movería el lugar a
  // un punto que nadie eligió.
  if ((valor.lat === undefined) !== (valor.lng === undefined)) {
    ctx.addIssue({ code: 'custom', message: 'El pin va con latitud y longitud juntas.' })
  }
}

/** Corrección de admin: los cinco campos. */
export const correccionAdminSchema = z
  .strictObject({
    fuente,
    name: texto(2, 200).optional(),
    ...ubicacion,
  })
  .superRefine(validarCambios)

/**
 * Propuesta del dueño: los cuatro de ubicación. Es **estricto a propósito**
 * (decisión 12): mandar `name` en el body no lo ignora, lo rechaza.
 */
export const correccionDuenoSchema = z.strictObject({ fuente, ...ubicacion }).superRefine(validarCambios)

export type CorreccionAdminPayload = z.infer<typeof correccionAdminSchema>
export type CorreccionDuenoPayload = z.infer<typeof correccionDuenoSchema>

/** Decisión del admin sobre una propuesta pendiente. Rechazar exige motivo. */
export const decisionCorreccionSchema = z.discriminatedUnion('accion', [
  z.object({ accion: z.literal('approve') }),
  z.object({ accion: z.literal('reject'), motivo: texto(3, 1000) }),
])

export type DecisionCorreccion = z.infer<typeof decisionCorreccionSchema>

// ---------------------------------------------------------------------------
// Tipos internos
// ---------------------------------------------------------------------------

/** Los valores nuevos ya normalizados. Ausente = ese campo no se toca. */
export type ValoresCorregidos = {
  name?: string
  address?: string | null
  locality?: string | null
  lat?: number
  lng?: number
}

/** El antes/después de un campo, tal como queda en el `campos` de la bitácora. */
export type CambioDeCampo = { antes: unknown; despues: unknown; soltado?: boolean }

type PlaceActual = {
  id: string
  name: string
  address: string | null
  locality: string | null
  lat: number
  lng: number
  lockedFields: string[]
  googleMatchStatus: GoogleMatchStatus
}

export type CorreccionAplicada = {
  placeId: string
  /** Los campos que vinieron en la corrección (se escriben aunque no cambien). */
  campos: CampoCorregible[]
  /** Los que además quedaron con un valor distinto al anterior. */
  cambiaron: CampoCorregible[]
  lockedFields: string[]
  /** Se recalcularon las zonas porque se movió el pin (decisión 8). */
  zonasReasignadas: boolean
  /** Se reseteó el match con Google (decisión 9). */
  matchInvalidado: boolean
}

const fallo = (code: string, message: string) => ({ ok: false as const, code, message })

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * El primer problema, en rioplatense. Los mínimos y máximos ya traen su mensaje
 * del schema; los dos que zod genera solo (tipo equivocado y clave de más) se
 * traducen acá, porque este texto **llega al usuario** por la respuesta del
 * endpoint y no puede salir en inglés.
 */
function mensajeDeZod(error: z.ZodError): string {
  const issue = error.issues[0]
  if (!issue) return 'Revisá los datos.'
  if (issue.code === 'invalid_type') return 'Faltan datos o vinieron con otro formato.'
  // `strictObject`: el dueño mandó un campo que no puede proponer (decisión 12).
  if (issue.code === 'unrecognized_keys') return 'Ese dato no se puede cambiar desde acá.'
  return issue.message
}

/** Un string vacío borra el dato; `undefined` deja el campo sin tocar. */
function vacioANull(valor: string | undefined): string | null | undefined {
  if (valor === undefined) return undefined
  return valor.length === 0 ? null : valor
}

function valoresDePayload(payload: CorreccionAdminPayload | CorreccionDuenoPayload): ValoresCorregidos {
  return {
    ...('name' in payload && payload.name !== undefined ? { name: payload.name } : {}),
    ...(payload.address !== undefined ? { address: vacioANull(payload.address) } : {}),
    ...(payload.locality !== undefined ? { locality: vacioANull(payload.locality) } : {}),
    ...(payload.lat !== undefined ? { lat: payload.lat } : {}),
    ...(payload.lng !== undefined ? { lng: payload.lng } : {}),
  }
}

/**
 * El `despues` guardado en la bitácora, de vuelta a valores tipados. Se leen solo
 * las claves conocidas y con el tipo que corresponde: la fila puede haber quedado
 * escrita por una versión anterior del código.
 */
function valoresDeBitacora(campos: Record<string, CambioDeCampo>): ValoresCorregidos {
  const out: ValoresCorregidos = {}
  for (const campo of CAMPOS_CORREGIBLES) {
    const cambio = campos[campo]
    if (!cambio || cambio.soltado) continue
    const valor = cambio.despues
    if (campo === 'lat' || campo === 'lng') {
      if (typeof valor === 'number') out[campo] = valor
    } else if (campo === 'name') {
      if (typeof valor === 'string') out.name = valor
    } else if (typeof valor === 'string' || valor === null) {
      out[campo] = valor
    }
  }
  return out
}

/** El lugar tomado `FOR UPDATE`: dos correcciones simultáneas se serializan. */
async function tomarPlace(tx: DbOrTx, placeId: string): Promise<PlaceActual | null> {
  const [fila] = await tx
    .select({
      id: places.id,
      name: places.name,
      address: places.address,
      locality: places.locality,
      lat: places.lat,
      lng: places.lng,
      lockedFields: places.lockedFields,
      googleMatchStatus: places.googleMatchStatus,
    })
    .from(places)
    .where(eq(places.id, placeId))
    .limit(1)
    .for('update')
  return fila ?? null
}

// ---------------------------------------------------------------------------
// El corazón: las cinco cosas, en una transacción
// ---------------------------------------------------------------------------

type MetaEdicion = {
  origen: PlaceEditOrigin
  fuente: string
  /** El usuario que la pidió (`null` = admin sin fila de usuario asociada). */
  requestedBy: string | null
  /** Email del admin que la aplica. */
  decidedBy: string
  /** Si viene de aprobar una propuesta, su fila ya existe y se marca aprobada. */
  edicionId?: string
}

async function escribirCorreccion(
  tx: DbOrTx,
  place: PlaceActual,
  valores: ValoresCorregidos,
  meta: MetaEdicion,
): Promise<CorreccionAplicada> {
  const campos = CAMPOS_CORREGIBLES.filter((campo) => valores[campo] !== undefined)
  const cambiaron = campos.filter((campo) => valores[campo] !== place[campo])

  const bitacora: Record<string, CambioDeCampo> = {}
  for (const campo of campos) bitacora[campo] = { antes: place[campo], despues: valores[campo]! }

  // (b) Unión, nunca reemplazo. Ordenado para que el array sea estable de leer.
  const lockedFields = [...new Set([...place.lockedFields, ...campos])].sort()

  // (e) El match se invalida solo si se movió el pin o cambió el nombre. Cambiar
  // `address`/`locality` NO lo dispara: el `google_place_id` sigue apuntando al
  // lugar correcto y re-resolver sería gasto sin motivo. `manual` y `blocked` los
  // fijó un humano y el automatismo no los pisa.
  const movioPin = cambiaron.includes('lat') || cambiaron.includes('lng')
  const matchInvalidado =
    (movioPin || cambiaron.includes('name')) &&
    place.googleMatchStatus !== 'manual' &&
    place.googleMatchStatus !== 'blocked'

  // (a) Los campos, en `places`.
  await tx
    .update(places)
    .set({
      ...(valores.name !== undefined ? { name: valores.name } : {}),
      ...(valores.address !== undefined ? { address: valores.address } : {}),
      ...(valores.locality !== undefined ? { locality: valores.locality } : {}),
      ...(valores.lat !== undefined ? { lat: valores.lat } : {}),
      ...(valores.lng !== undefined ? { lng: valores.lng } : {}),
      ...(matchInvalidado
        ? { googlePlaceId: null, googleMatchStatus: 'pending' as const, googleMatchedAt: null }
        : {}),
      lockedFields,
      updatedAt: new Date(),
    })
    .where(eq(places.id, place.id))

  // (c) La bitácora. Aprobar una propuesta cierra su fila en vez de abrir otra.
  if (meta.edicionId) {
    await tx
      .update(placeDataEdits)
      .set({ status: 'approved', decidedBy: meta.decidedBy, decidedAt: new Date() })
      .where(eq(placeDataEdits.id, meta.edicionId))
  } else {
    await tx.insert(placeDataEdits).values({
      placeId: place.id,
      requestedBy: meta.requestedBy,
      origen: meta.origen,
      status: 'approved',
      campos: bitacora,
      fuente: meta.fuente,
      decidedBy: meta.decidedBy,
      decidedAt: new Date(),
    })
  }

  // (d) Las zonas, desde el pin nuevo y en la misma transacción.
  if (movioPin) {
    await asignarZonasDeLugar(place.id, valores.lng ?? place.lng, valores.lat ?? place.lat, tx)
  }

  return {
    placeId: place.id,
    campos,
    cambiaron,
    lockedFields,
    zonasReasignadas: movioPin,
    matchInvalidado,
  }
}

// ---------------------------------------------------------------------------
// Superficie de admin: edita directo
// ---------------------------------------------------------------------------

/**
 * El admin corrige y se aplica en el momento (decisión 11): es el árbitro, y hoy
 * no tiene ninguna otra forma de tocar esto. La fila de bitácora nace `approved`
 * con su email en `decided_by`.
 */
export async function corregirDatos(
  placeId: string,
  payload: unknown,
  adminEmail: string,
): Promise<Resultado<CorreccionAplicada>> {
  const parsed = correccionAdminSchema.safeParse(payload)
  if (!parsed.success) return fallo('INVALID', mensajeDeZod(parsed.error))
  if (!UUID_RE.test(placeId)) return fallo('NO_EXISTE', 'Ese lugar no existe.')

  const valores = valoresDePayload(parsed.data)

  const resultado = await db.transaction(async (tx) => {
    const place = await tomarPlace(tx, placeId)
    if (!place) return null
    return escribirCorreccion(tx, place, valores, {
      origen: 'admin',
      fuente: parsed.data.fuente,
      requestedBy: null,
      decidedBy: adminEmail,
    })
  })

  if (!resultado) return fallo('NO_EXISTE', 'Ese lugar no existe.')
  return { ok: true, data: resultado }
}

/**
 * Soltar un campo fijado (decisión 10): sale de `locked_fields` y **el valor no
 * cambia** — soltar es *"volvé a seguir a Overture"*, no *"revertí ahora"*; el
 * próximo import es el que lo pisa. Queda fila de bitácora.
 *
 * No se libera solo aunque Overture ya traiga el mismo valor: con `lat`/`lng`
 * "igual" exige una tolerancia inventada, y el día que Overture traiga un dato
 * *casi* igual y peor, el candado se abriría sin que nadie lo decidiera.
 */
export async function soltarCampo(
  placeId: string,
  campo: string,
  adminEmail: string,
): Promise<Resultado<{ placeId: string; lockedFields: string[] }>> {
  if (!UUID_RE.test(placeId)) return fallo('NO_EXISTE', 'Ese lugar no existe.')
  if (!(CAMPOS_CORREGIBLES as readonly string[]).includes(campo)) {
    return fallo('CAMPO_INVALIDO', 'Ese campo no se corrige a mano.')
  }
  const corregible = campo as CampoCorregible

  const resultado = await db.transaction(async (tx) => {
    const place = await tomarPlace(tx, placeId)
    if (!place) return { code: 'NO_EXISTE' as const }
    if (!place.lockedFields.includes(corregible)) return { code: 'NO_FIJADO' as const }

    const lockedFields = place.lockedFields.filter((c) => c !== corregible)

    await tx
      .update(places)
      .set({ lockedFields, updatedAt: new Date() })
      .where(eq(places.id, place.id))

    await tx.insert(placeDataEdits).values({
      placeId: place.id,
      requestedBy: null,
      origen: 'admin',
      status: 'approved',
      campos: { [corregible]: { antes: place[corregible], despues: place[corregible], soltado: true } },
      fuente: FUENTE_SOLTAR,
      decidedBy: adminEmail,
      decidedAt: new Date(),
    })

    return { code: 'OK' as const, lockedFields }
  })

  if (resultado.code === 'NO_EXISTE') return fallo('NO_EXISTE', 'Ese lugar no existe.')
  if (resultado.code === 'NO_FIJADO') return fallo('NO_FIJADO', 'Ese campo no está corregido a mano.')
  return { ok: true, data: { placeId, lockedFields: resultado.lockedFields } }
}

// ---------------------------------------------------------------------------
// Superficie del dueño: propone, no aplica
// ---------------------------------------------------------------------------

export type PropuestaCreada = { edicionId: string; placeId: string; campos: CampoCorregible[] }

/**
 * El dueño propone y **no toca `places`** (decisión 11): el pin mueve al lugar en
 * la búsqueda de todos, y correr el pin a una zona de más tráfico es el incentivo
 * clásico de spam en un directorio. La propuesta entra a la misma cola que los
 * reclamos y la decide el admin.
 *
 * Una sola pendiente por lugar (decisión 17): mandarla de nuevo no la apura.
 */
export async function proponerCorreccion(
  userId: string,
  placeId: string,
  payload: unknown,
): Promise<Resultado<PropuestaCreada>> {
  const parsed = correccionDuenoSchema.safeParse(payload)
  if (!parsed.success) return fallo('INVALID', mensajeDeZod(parsed.error))
  // Mismo mensaje para "no existe" y "no es tuyo": un lugar ajeno no tiene por
  // qué distinguirse de uno inexistente.
  if (!UUID_RE.test(placeId) || !(await esDuenoDe(userId, placeId))) {
    return fallo('NO_AUTORIZADO', 'No podés editar este lugar.')
  }

  const valores = valoresDePayload(parsed.data)

  const [place] = await db
    .select({
      name: places.name,
      address: places.address,
      locality: places.locality,
      lat: places.lat,
      lng: places.lng,
    })
    .from(places)
    .where(eq(places.id, placeId))
    .limit(1)

  if (!place) return fallo('NO_AUTORIZADO', 'No podés editar este lugar.')

  const [pendiente] = await db
    .select({ id: placeDataEdits.id })
    .from(placeDataEdits)
    .where(and(eq(placeDataEdits.placeId, placeId), eq(placeDataEdits.status, 'pending')))
    .limit(1)

  if (pendiente) return fallo('YA_PENDIENTE', 'Ya tenés un cambio en revisión para este lugar.')

  const campos = CAMPOS_CORREGIBLES.filter((campo) => valores[campo] !== undefined)
  const bitacora: Record<string, CambioDeCampo> = {}
  for (const campo of campos) bitacora[campo] = { antes: place[campo], despues: valores[campo]! }

  try {
    const [creada] = await db
      .insert(placeDataEdits)
      .values({
        placeId,
        requestedBy: userId,
        origen: 'owner',
        status: 'pending',
        campos: bitacora,
        fuente: parsed.data.fuente,
      })
      .returning({ id: placeDataEdits.id })

    return { ok: true, data: { edicionId: creada.id, placeId, campos } }
  } catch {
    // El índice único parcial es el que manda: dos propuestas simultáneas no
    // pueden colarse por la ventana entre el SELECT de arriba y este INSERT.
    return fallo('YA_PENDIENTE', 'Ya tenés un cambio en revisión para este lugar.')
  }
}

// ---------------------------------------------------------------------------
// Decisión del admin sobre una propuesta
// ---------------------------------------------------------------------------

export type CorreccionDecidida = {
  edicionId: string
  placeId: string
  aplicada: CorreccionAplicada | null
}

/**
 * Aprobar aplica la propuesta con exactamente el mismo camino que una corrección
 * de admin (las cinco cosas, una transacción) y cierra su fila. Rechazar deja
 * `places` intacto y guarda el motivo, que es lo que el dueño ve en su panel.
 *
 * Sin mail en ninguna dirección (decisión 14): el dueño ve el estado donde ya
 * está mirando.
 */
export async function decidirCorreccion(
  edicionId: string,
  decision: DecisionCorreccion,
  adminEmail: string,
): Promise<Resultado<CorreccionDecidida>> {
  if (!UUID_RE.test(edicionId)) return fallo('NO_EXISTE', 'Esa propuesta no existe.')

  const [edicion] = await db
    .select({
      id: placeDataEdits.id,
      placeId: placeDataEdits.placeId,
      status: placeDataEdits.status,
      campos: placeDataEdits.campos,
      fuente: placeDataEdits.fuente,
      requestedBy: placeDataEdits.requestedBy,
    })
    .from(placeDataEdits)
    .where(eq(placeDataEdits.id, edicionId))
    .limit(1)

  if (!edicion) return fallo('NO_EXISTE', 'Esa propuesta no existe.')
  if (edicion.status !== 'pending') {
    return fallo('YA_DECIDIDA', 'Esa propuesta ya estaba resuelta.')
  }

  if (decision.accion === 'reject') {
    await db
      .update(placeDataEdits)
      .set({
        status: 'rejected',
        decidedBy: adminEmail,
        decidedAt: new Date(),
        adminNotes: decision.motivo,
      })
      .where(eq(placeDataEdits.id, edicion.id))

    return { ok: true, data: { edicionId: edicion.id, placeId: edicion.placeId, aplicada: null } }
  }

  const valores = valoresDeBitacora(edicion.campos)

  const aplicada = await db.transaction(async (tx) => {
    const place = await tomarPlace(tx, edicion.placeId)
    if (!place) return null
    return escribirCorreccion(tx, place, valores, {
      origen: 'owner',
      fuente: edicion.fuente,
      requestedBy: edicion.requestedBy,
      decidedBy: adminEmail,
      edicionId: edicion.id,
    })
  })

  if (!aplicada) return fallo('NO_EXISTE', 'Ese lugar ya no existe.')
  return { ok: true, data: { edicionId: edicion.id, placeId: edicion.placeId, aplicada } }
}
