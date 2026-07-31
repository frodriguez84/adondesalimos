import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { getConfidenceThreshold } from '@/lib/db/settings'
import { placeClaims, placeZones, places, users, zones } from '@/lib/db/schema'
import { isPlacePublished } from '@/lib/db/visibility'
import { tieneDuenoAprobado } from './ownership'
import type { ClaimKind, ClaimStatus } from '@/lib/db/schema'

/**
 * Consultas del flujo dueño (AUTH F2).
 *
 * La búsqueda de acá **no es la búsqueda pública**: corre sobre el catálogo
 * COMPLETO, visibles e invisibles (decisión 11). Es a propósito y es el caso de
 * negocio: el lugar real que quedó bajo el umbral no tiene ficha pública, así
 * que su dueño no puede llegar por el botón "¿Sos el dueño?" — llega por acá.
 *
 * Por eso este archivo **no** usa `publishedWhere`: la regla de visibilidad no
 * se toca ni se reimplementa, simplemente no se aplica a esta pantalla. Lo que sí
 * se hace es marcar cada resultado con `publicado`, usando el helper de CATALOGO.
 */

const MAX_RESULTADOS = 10

/**
 * Los lugares con dueño, como subconsulta para joinear.
 *
 * **No es un `EXISTS` escrito a mano a propósito.** En un fragmento SQL crudo
 * usado como **campo del SELECT** —que es como estaba acá—, Drizzle renderiza
 * `${places.id}` como `"id"` **sin calificar la tabla**, y `place_claims` también
 * tiene una columna `id`: la condición terminaba siendo `pc.place_id = pc.id`,
 * que es falsa siempre. (En el WHERE sí califica: `"places"."id"`. Por eso los
 * `EXISTS` de `lib/search/query.ts`, que viven en el WHERE, nunca tuvieron el
 * bug — verificado el 2026-07-31.) El bug no rompe nada visible —
 * simplemente ningún lugar figura como reclamado. Con el query builder los
 * identificadores los califica Drizzle y eso no puede volver a pasar.
 *
 * El índice único parcial garantiza a lo sumo un aprobado por lugar, así que el
 * join no multiplica filas.
 */
function lugaresConDueno() {
  return db
    .select({ placeId: placeClaims.placeId })
    .from(placeClaims)
    .where(eq(placeClaims.status, 'approved'))
    .as('con_dueno')
}

export type ResultadoCatalogo = {
  id: string
  name: string
  address: string | null
  locality: string | null
  zone: string | null
  /** Si hoy se ve en la búsqueda pública. Falso = el caso que este flujo rescata. */
  publicado: boolean
  /** Ya tiene dueño aprobado: no se puede volver a reclamar. */
  reclamado: boolean
}

/**
 * Busca por nombre en el catálogo completo. Mismo motor de similitud que la
 * búsqueda pública (`word_similarity` sobre el nombre sin acentos), para que
 * "parrila" encuentre "Parrilla El Juanca" también acá.
 */
export async function buscarCatalogoCompleto(q: string): Promise<ResultadoCatalogo[]> {
  const termino = q.trim()
  if (termino.length < 2) return []

  const normalizado = sql`immutable_unaccent(lower(${places.name}))`
  const consulta = sql`immutable_unaccent(lower(${termino}))`
  const conDueno = lugaresConDueno()

  const filas = await db
    .select({
      id: places.id,
      name: places.name,
      address: places.address,
      locality: places.locality,
      confidence: places.confidence,
      operatingStatus: places.operatingStatus,
      publishOverride: places.publishOverride,
      duenoId: conDueno.placeId,
    })
    .from(places)
    .leftJoin(conDueno, eq(conDueno.placeId, places.id))
    .where(sql`${consulta} <% ${normalizado}`)
    .orderBy(desc(sql`word_similarity(${consulta}, ${normalizado})`), asc(places.name))
    .limit(MAX_RESULTADOS)

  const umbral = await getConfidenceThreshold()
  const zonaPorLugar = await zonaPrimariaDeLugares(filas.map((f) => f.id))

  return filas.map((f) => ({
    id: f.id,
    name: f.name,
    address: f.address,
    locality: f.locality,
    zone: zonaPorLugar.get(f.id) ?? null,
    publicado: isPlacePublished(
      {
        operatingStatus: f.operatingStatus,
        confidence: f.confidence,
        publishOverride: f.publishOverride,
      },
      umbral,
    ),
    reclamado: f.duenoId !== null,
  }))
}

/** Un lugar para la pantalla de reclamo. Sin filtro de visibilidad: ver arriba. */
export type LugarAReclamar = {
  id: string
  name: string
  address: string | null
  locality: string | null
  zone: string | null
  reclamado: boolean
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function getLugarAReclamar(id: string): Promise<LugarAReclamar | null> {
  // Un id manoseado en la URL no llega a una query sobre una columna uuid.
  if (!UUID_RE.test(id)) return null

  const [fila] = await db
    .select({
      id: places.id,
      name: places.name,
      address: places.address,
      locality: places.locality,
    })
    .from(places)
    .where(eq(places.id, id))
    .limit(1)

  if (!fila) return null

  // Un solo lugar: se resuelve con el helper de `ownership`, que es la fuente
  // única de "este lugar tiene dueño" y la misma que usa la ficha.
  const [zonaPorLugar, reclamado] = await Promise.all([
    zonaPrimariaDeLugares([fila.id]),
    tieneDuenoAprobado(fila.id),
  ])
  return { ...fila, zone: zonaPorLugar.get(fila.id) ?? null, reclamado }
}

// ---------------------------------------------------------------------------
// Cola de /admin
// ---------------------------------------------------------------------------

export type ClaimEnCola = {
  id: string
  kind: ClaimKind
  status: ClaimStatus
  createdAt: Date
  decidedAt: Date | null
  decidedBy: string | null
  adminNotes: string | null
  applicantName: string | null
  applicantPhone: string | null
  applicantRole: string | null
  comment: string | null
  userEmail: string
  place: {
    id: string
    name: string
    address: string | null
    locality: string | null
    zone: string | null
    publicado: boolean
    source: string
  }
}

/**
 * Los claims de un estado, con lo que el admin necesita para decidir: quién
 * pide, qué dice, qué lugar es y si hoy se ve.
 */
export async function claimsPorEstado(status: ClaimStatus): Promise<ClaimEnCola[]> {
  const filas = await db
    .select({
      id: placeClaims.id,
      kind: placeClaims.kind,
      status: placeClaims.status,
      createdAt: placeClaims.createdAt,
      decidedAt: placeClaims.decidedAt,
      decidedBy: placeClaims.decidedBy,
      adminNotes: placeClaims.adminNotes,
      applicantName: placeClaims.applicantName,
      applicantPhone: placeClaims.applicantPhone,
      applicantRole: placeClaims.applicantRole,
      comment: placeClaims.comment,
      userEmail: users.email,
      placeId: places.id,
      placeName: places.name,
      address: places.address,
      locality: places.locality,
      source: places.source,
      confidence: places.confidence,
      operatingStatus: places.operatingStatus,
      publishOverride: places.publishOverride,
    })
    .from(placeClaims)
    .innerJoin(places, eq(places.id, placeClaims.placeId))
    .innerJoin(users, eq(users.id, placeClaims.userId))
    .where(eq(placeClaims.status, status))
    // Los pendientes, el más viejo primero (es una cola). Los ya decididos, el
    // más reciente primero (es un historial).
    .orderBy(status === 'pending' ? asc(placeClaims.createdAt) : desc(placeClaims.decidedAt))

  const umbral = await getConfidenceThreshold()
  const zonaPorLugar = await zonaPrimariaDeLugares(filas.map((f) => f.placeId))

  return filas.map((f) => ({
    id: f.id,
    kind: f.kind,
    status: f.status,
    createdAt: f.createdAt,
    decidedAt: f.decidedAt,
    decidedBy: f.decidedBy,
    adminNotes: f.adminNotes,
    applicantName: f.applicantName,
    applicantPhone: f.applicantPhone,
    applicantRole: f.applicantRole,
    comment: f.comment,
    userEmail: f.userEmail,
    place: {
      id: f.placeId,
      name: f.placeName,
      address: f.address,
      locality: f.locality,
      zone: zonaPorLugar.get(f.placeId) ?? null,
      publicado: isPlacePublished(
        {
          operatingStatus: f.operatingStatus,
          confidence: f.confidence,
          publishOverride: f.publishOverride,
        },
        umbral,
      ),
      source: f.source,
    },
  }))
}

/** Zona primaria de un lote. Puede no haber (ZONAS, decisión 17). */
async function zonaPrimariaDeLugares(ids: string[]): Promise<Map<string, string>> {
  const mapa = new Map<string, string>()
  if (ids.length === 0) return mapa

  const filas = await db
    .select({ placeId: placeZones.placeId, name: zones.name })
    .from(placeZones)
    .innerJoin(zones, eq(zones.id, placeZones.zoneId))
    .where(and(inArray(placeZones.placeId, ids), eq(placeZones.isPrimary, true)))

  for (const f of filas) mapa.set(f.placeId, f.name)
  return mapa
}
