import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { getConfidenceThreshold } from '@/lib/db/settings'
import {
  placeDataEdits,
  placeImpressionsDaily,
  placeOwnerContent,
  placePhotos,
  placeTagImpressionsDaily,
  placeTags,
  placeTapsDaily,
  placeZones,
  places,
  tags,
  users,
  zones,
} from '@/lib/db/schema'
import { isPlacePublished } from '@/lib/db/visibility'
import { esDuenoDe, placeIdsDelUsuario } from '@/lib/claims/ownership'
import { FACET_LABELS, FACET_ORDER } from '@/lib/db/taxonomy'
import { TAP_KINDS, type TapKind } from '@/lib/lugar/tap-kinds'
import { capDeFotos } from './contenido'
import { normalizarSemana, type HorariosSemana } from './horarios'
import type { CambioDeCampo } from './correcciones'
import type { ClaimStatus, Facet, OwnerPlan, PlaceEditOrigin } from '@/lib/db/schema'

/**
 * Lecturas del panel del dueño (AUTH F3).
 *
 * La propiedad **no se resuelve acá**: sale de `lib/claims/ownership.ts`, que es
 * la fuente única de "este lugar tiene dueño" desde F2. Este archivo solo arma la
 * pantalla con los lugares que ese helper devolvió.
 */

/** Una fila de la lista de `/mi-negocio`. */
export type LugarDelDueno = {
  id: string
  name: string
  address: string | null
  locality: string | null
  zone: string | null
  /** Si hoy se ve en la búsqueda pública (la aprobación puso el override). */
  publicado: boolean
  plan: OwnerPlan
  fotos: number
  capFotos: number
  /** Teaser: aperturas de ficha del mes corriente (decisión 24). */
  visitasDelMes: number
}

export async function misLugares(userId: string): Promise<LugarDelDueno[]> {
  const ids = await placeIdsDelUsuario(userId)
  if (ids.length === 0) return []

  const filas = await db
    .select({
      id: places.id,
      name: places.name,
      address: places.address,
      locality: places.locality,
      confidence: places.confidence,
      operatingStatus: places.operatingStatus,
      publishOverride: places.publishOverride,
      ownerPlan: places.ownerPlan,
    })
    .from(places)
    .where(inArray(places.id, ids))
    .orderBy(asc(places.name))

  const [umbral, zonaPorLugar, fotosPorLugar, visitasPorLugar] = await Promise.all([
    getConfidenceThreshold(),
    zonaPrimariaDeLugares(ids),
    contarFotos(ids),
    visitasDelMes(ids),
  ])

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
    plan: f.ownerPlan,
    fotos: fotosPorLugar.get(f.id) ?? 0,
    capFotos: capDeFotos(f.ownerPlan),
    visitasDelMes: visitasPorLugar.get(f.id) ?? 0,
  }))
}

// ---------------------------------------------------------------------------
// Editor de un lugar
// ---------------------------------------------------------------------------

export type FotoDelPanel = { id: string; url: string; sort: number }

/** Un tag de la taxonomía con su estado de tildado, para el editor. */
export type TagDelPanel = { slug: string; name: string; parent: string | null; elegido: boolean }
export type FacetaDelPanel = { facet: Facet; label: string; tags: TagDelPanel[] }

/** Todo lo que el editor necesita. `null` = el usuario no es dueño de ese lugar. */
export type PanelLugar = {
  id: string
  name: string
  address: string | null
  locality: string | null
  /** El pin actual: lo edita la sección «Dónde estás» (CORRECCION_DATOS). */
  lat: number
  lng: number
  zone: string | null
  publicado: boolean
  plan: OwnerPlan
  visitasDelMes: number
  /** Contacto de Overture: se muestra como "lo que se ve hoy" bajo cada campo. */
  base: { phone: string | null; website: string | null; socials: string[] }
  /** Lo ya cargado por el dueño. Strings vacíos si no hay fila (forma del form). */
  contenido: {
    phone: string
    website: string
    socials: string[]
    description: string
    menuUrl: string
    news: string
  }
  /** Horarios propios ya cargados (semana completa; vacía si el dueño no cargó). */
  horarios: HorariosSemana
  fotos: FotoDelPanel[]
  capFotos: number
  facetas: FacetaDelPanel[]
  /** Su propuesta de ubicación en revisión, o la última rechazada con su motivo. */
  correccion: EstadoCorreccionDueno
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * El lugar para el editor, **ya validada la propiedad**: si el usuario no es
 * dueño devuelve `null` y la página responde 404 (un lugar ajeno no existe para
 * quien no lo tiene). El gate es `esDuenoDe`, el mismo que usan los endpoints.
 */
export async function getPanelLugar(placeId: string, userId: string): Promise<PanelLugar | null> {
  if (!UUID_RE.test(placeId)) return null
  if (!(await esDuenoDe(userId, placeId))) return null

  const [place] = await db
    .select({
      id: places.id,
      name: places.name,
      address: places.address,
      locality: places.locality,
      lat: places.lat,
      lng: places.lng,
      phones: places.phones,
      websites: places.websites,
      socials: places.socials,
      confidence: places.confidence,
      operatingStatus: places.operatingStatus,
      publishOverride: places.publishOverride,
      ownerPlan: places.ownerPlan,
    })
    .from(places)
    .where(eq(places.id, placeId))
    .limit(1)

  if (!place) return null

  const [umbral, contenido, fotos, facetas, zonaPorLugar, visitas, correccion] = await Promise.all([
    getConfidenceThreshold(),
    getContenidoDueno(placeId),
    fotosDeLugar(placeId),
    facetasConElegidos(placeId),
    zonaPrimariaDeLugares([placeId]),
    visitasDelMes([placeId]),
    estadoCorreccionDelDueno(placeId),
  ])

  return {
    id: place.id,
    name: place.name,
    address: place.address,
    locality: place.locality,
    lat: place.lat,
    lng: place.lng,
    zone: zonaPorLugar.get(place.id) ?? null,
    publicado: isPlacePublished(
      {
        operatingStatus: place.operatingStatus,
        confidence: place.confidence,
        publishOverride: place.publishOverride,
      },
      umbral,
    ),
    plan: place.ownerPlan,
    visitasDelMes: visitas.get(place.id) ?? 0,
    base: {
      phone: place.phones?.[0] ?? null,
      website: place.websites?.[0] ?? null,
      socials: place.socials ?? [],
    },
    contenido: {
      phone: contenido?.phone ?? '',
      website: contenido?.website ?? '',
      socials: contenido?.socials ?? [],
      description: contenido?.description ?? '',
      menuUrl: contenido?.menuUrl ?? '',
      news: contenido?.news ?? '',
    },
    horarios: normalizarSemana(contenido?.openingHours),
    fotos,
    capFotos: capDeFotos(place.ownerPlan),
    facetas,
    correccion,
  }
}

/** La fila de contenido del dueño, o `null` si nunca editó nada. */
export async function getContenidoDueno(placeId: string) {
  const [fila] = await db
    .select({
      phone: placeOwnerContent.phone,
      website: placeOwnerContent.website,
      socials: placeOwnerContent.socials,
      openingHours: placeOwnerContent.openingHours,
      description: placeOwnerContent.description,
      menuUrl: placeOwnerContent.menuUrl,
      news: placeOwnerContent.news,
    })
    .from(placeOwnerContent)
    .where(eq(placeOwnerContent.placeId, placeId))
    .limit(1)
  return fila ?? null
}

export async function fotosDeLugar(placeId: string): Promise<FotoDelPanel[]> {
  return db
    .select({ id: placePhotos.id, url: placePhotos.url, sort: placePhotos.sort })
    .from(placePhotos)
    .where(eq(placePhotos.placeId, placeId))
    .orderBy(asc(placePhotos.sort), asc(placePhotos.createdAt))
}

/**
 * Las 6 facetas con **toda** la taxonomía activa y cuáles tiene tildadas el
 * lugar. A diferencia de `getFacetCatalog` (búsqueda), acá **no** se filtran los
 * tags sin lugares: el dueño tiene que poder tildar "Karaoke" aunque sea el
 * primero del catálogo en tenerlo — es justamente el aporte que se le pide.
 */
async function facetasConElegidos(placeId: string): Promise<FacetaDelPanel[]> {
  const elegidos = db
    .select({ tagId: placeTags.tagId })
    .from(placeTags)
    .where(eq(placeTags.placeId, placeId))
    .as('elegidos')

  // leftJoin sobre subconsulta del query builder, no un EXISTS en SQL crudo: ahí
  // Drizzle no califica la tabla y la condición se puede volver falsa en silencio
  // (bug real de F2, ver AnalisisQA § AUTH F2 H-1).
  const filas = await db
    .select({
      slug: tags.slug,
      name: tags.name,
      facet: tags.facet,
      parent: sql<string | null>`padre.slug`,
      elegido: elegidos.tagId,
    })
    .from(tags)
    .leftJoin(sql`${tags} padre`, sql`padre.id = ${tags.parentId}`)
    .leftJoin(elegidos, eq(elegidos.tagId, tags.id))
    .where(eq(tags.active, true))
    .orderBy(asc(tags.sort))

  return FACET_ORDER.map((facet) => ({
    facet,
    label: FACET_LABELS[facet],
    tags: filas
      .filter((f) => f.facet === facet)
      .map((f) => ({
        slug: f.slug,
        name: f.name,
        parent: f.parent,
        elegido: f.elegido !== null,
      })),
  }))
}

// ---------------------------------------------------------------------------
// Teaser de estadísticas (decisión 24)
// ---------------------------------------------------------------------------

/**
 * Aperturas de ficha del **mes calendario corriente**, por lugar. Solo el número:
 * el desglose y la comparación contra el mes anterior son el motor de conversión
 * del plan pago y llegan con el spec 7.
 *
 * El corte del mes lo pone Postgres (`date_trunc('month', current_date)`), no el
 * proceso: mismo criterio que `registrarImpresiones`, un solo reloj parte el mes.
 */
export async function visitasDelMes(placeIds: string[]): Promise<Map<string, number>> {
  const mapa = new Map<string, number>()
  if (placeIds.length === 0) return mapa

  const filas = await db
    .select({
      placeId: placeImpressionsDaily.placeId,
      total: sql<number>`coalesce(sum(${placeImpressionsDaily.detailViews}), 0)::int`,
    })
    .from(placeImpressionsDaily)
    .where(
      and(
        inArray(placeImpressionsDaily.placeId, placeIds),
        sql`${placeImpressionsDaily.date} >= date_trunc('month', current_date)`,
      ),
    )
    .groupBy(placeImpressionsDaily.placeId)

  for (const f of filas) mapa.set(f.placeId, f.total)
  return mapa
}

// ---------------------------------------------------------------------------
// Desglose de estadísticas — solo plan pago (decisión 24)
// ---------------------------------------------------------------------------

/** Un contador del mes corriente contra el mismo del mes anterior. */
export type MetricaMensual = { esteMes: number; mesAnterior: number }

/**
 * El desglose pago del panel (MONETIZACION F4, decisión 24). Es lo que el teaser
 * de AUTH (`visitasDelMes`, el número pelado) promete y no muestra: el `free`
 * sigue viendo solo ese número, el `paid` ve esto.
 */
export type DesgloseEstadisticas = {
  /** Aperturas de ficha (el mismo dato del teaser), este mes vs el anterior. */
  vistas: MetricaMensual
  /** Veces que apareció en un listado de búsqueda, este mes vs el anterior. */
  impresiones: MetricaMensual
  /** Taps por tipo del mes corriente, en el orden canónico y con los 5 tipos (0 incluido). */
  taps: { kind: TapKind; count: number }[]
  /** Los tags por los que más lo encontraron este mes (nombre para mostrar). */
  topFiltros: { slug: string; name: string; count: number }[]
  /**
   * Transparencia del destaque (decisión 20): "destacada en X de las Y búsquedas
   * donde apareció" este mes. `destacada = featured_impressions`,
   * `apariciones = impressions` — el mismo contador que decide la rotación.
   */
  destaque: { destacada: number; apariciones: number }
}

// El mes calendario corriente y el anterior, con Postgres poniendo el reloj
// (mismo criterio que `visitasDelMes`: un solo reloj parte el mes).
const MES_ACTUAL = sql`date_trunc('month', current_date)`
const MES_ANTERIOR = sql`date_trunc('month', current_date) - interval '1 month'`

/**
 * El desglose de estadísticas de un lugar, **gateado server-side por
 * `owner_plan='paid'`** (decisión 24): con `free` devuelve `null` y el panel se
 * queda con el teaser de AUTH exacto. El flag es la única fuente y se lee en cada
 * request (mismo criterio que el resto del gating, decisión 8): volver a `free`
 * apaga el desglose sin borrar los agregados (ocultar ≠ borrar).
 *
 * La propiedad ya la validó `getPanelLugar` aguas arriba; acá solo se decide
 * plan y se leen los agregados (todos sin `user_id`/cookie/IP, invariante de las
 * 3 tablas).
 */
export async function desgloseEstadisticas(placeId: string): Promise<DesgloseEstadisticas | null> {
  const [place] = await db
    .select({ ownerPlan: places.ownerPlan })
    .from(places)
    .where(eq(places.id, placeId))
    .limit(1)
  if (place?.ownerPlan !== 'paid') return null

  const [impresionesFila, tapsFilas, filtrosFilas] = await Promise.all([
    // Impresiones/vistas/destaques del mes corriente y el anterior, en una fila.
    db
      .select({
        vistasMes: sql<number>`coalesce(sum(${placeImpressionsDaily.detailViews}) filter (where ${placeImpressionsDaily.date} >= ${MES_ACTUAL}), 0)::int`,
        vistasPrev: sql<number>`coalesce(sum(${placeImpressionsDaily.detailViews}) filter (where ${placeImpressionsDaily.date} >= ${MES_ANTERIOR} and ${placeImpressionsDaily.date} < ${MES_ACTUAL}), 0)::int`,
        imprMes: sql<number>`coalesce(sum(${placeImpressionsDaily.impressions}) filter (where ${placeImpressionsDaily.date} >= ${MES_ACTUAL}), 0)::int`,
        imprPrev: sql<number>`coalesce(sum(${placeImpressionsDaily.impressions}) filter (where ${placeImpressionsDaily.date} >= ${MES_ANTERIOR} and ${placeImpressionsDaily.date} < ${MES_ACTUAL}), 0)::int`,
        featMes: sql<number>`coalesce(sum(${placeImpressionsDaily.featuredImpressions}) filter (where ${placeImpressionsDaily.date} >= ${MES_ACTUAL}), 0)::int`,
      })
      .from(placeImpressionsDaily)
      .where(
        and(
          eq(placeImpressionsDaily.placeId, placeId),
          sql`${placeImpressionsDaily.date} >= ${MES_ANTERIOR}`,
        ),
      ),
    // Taps por tipo del mes corriente.
    db
      .select({
        kind: placeTapsDaily.kind,
        total: sql<number>`coalesce(sum(${placeTapsDaily.count}), 0)::int`,
      })
      .from(placeTapsDaily)
      .where(
        and(
          eq(placeTapsDaily.placeId, placeId),
          sql`${placeTapsDaily.date} >= ${MES_ACTUAL}`,
        ),
      )
      .groupBy(placeTapsDaily.kind),
    // Top de tags que lo encontraron este mes.
    db
      .select({
        slug: tags.slug,
        name: tags.name,
        count: sql<number>`sum(${placeTagImpressionsDaily.count})::int`,
      })
      .from(placeTagImpressionsDaily)
      .innerJoin(tags, eq(tags.id, placeTagImpressionsDaily.tagId))
      .where(
        and(
          eq(placeTagImpressionsDaily.placeId, placeId),
          sql`${placeTagImpressionsDaily.date} >= ${MES_ACTUAL}`,
        ),
      )
      .groupBy(tags.slug, tags.name)
      .orderBy(desc(sql`sum(${placeTagImpressionsDaily.count})`))
      .limit(8),
  ])

  const agg = impresionesFila[0] ?? { vistasMes: 0, vistasPrev: 0, imprMes: 0, imprPrev: 0, featMes: 0 }
  const tapsPorKind = new Map(tapsFilas.map((f) => [f.kind, f.total]))

  return {
    vistas: { esteMes: agg.vistasMes, mesAnterior: agg.vistasPrev },
    impresiones: { esteMes: agg.imprMes, mesAnterior: agg.imprPrev },
    taps: TAP_KINDS.map((kind) => ({ kind, count: tapsPorKind.get(kind) ?? 0 })),
    topFiltros: filtrosFilas,
    destaque: { destacada: agg.featMes, apariciones: agg.imprMes },
  }
}

/** Cuántas fotos tiene cada lugar del lote (para el cap y el contador del panel). */
export async function contarFotos(placeIds: string[]): Promise<Map<string, number>> {
  const mapa = new Map<string, number>()
  if (placeIds.length === 0) return mapa

  const filas = await db
    .select({ placeId: placePhotos.placeId, total: sql<number>`count(*)::int` })
    .from(placePhotos)
    .where(inArray(placePhotos.placeId, placeIds))
    .groupBy(placePhotos.placeId)

  for (const f of filas) mapa.set(f.placeId, f.total)
  return mapa
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

// ---------------------------------------------------------------------------
// Corrección de datos base — spec CORRECCION_DATOS
// ---------------------------------------------------------------------------

/**
 * Las lecturas de las dos pantallas de CORRECCION_DATOS: el editor de `/admin` y
 * el panel del dueño.
 *
 * `place_data_edits` se lee **para mostrar y para revisar, nunca para decidir un
 * gate** (decisión 7): el estado vigente de un lugar sale siempre de `places`.
 */

/** Una fila de la bitácora, ya lista para pintar. */
export type EdicionDeDatos = {
  id: string
  origen: PlaceEditOrigin
  status: ClaimStatus
  campos: Record<string, CambioDeCampo>
  fuente: string
  decidedBy: string | null
  decidedAt: Date | null
  adminNotes: string | null
  createdAt: Date
  /** Mail de quien la propuso (`null` cuando la hizo el admin). */
  solicitante: string | null
}

const SELECT_EDICION = {
  id: placeDataEdits.id,
  origen: placeDataEdits.origen,
  status: placeDataEdits.status,
  campos: placeDataEdits.campos,
  fuente: placeDataEdits.fuente,
  decidedBy: placeDataEdits.decidedBy,
  decidedAt: placeDataEdits.decidedAt,
  adminNotes: placeDataEdits.adminNotes,
  createdAt: placeDataEdits.createdAt,
  solicitante: users.email,
}

/** El lugar completo para el editor de admin, con su bitácora. */
export type LugarParaCorregir = {
  id: string
  name: string
  address: string | null
  locality: string | null
  lat: number
  lng: number
  /** Los campos fijados a mano: llevan badge «Corregido a mano» y «Soltar». */
  lockedFields: string[]
  zona: string | null
  publicado: boolean
  /** Con match resuelto el editor pide «Google dice: …» al endpoint que ya existe. */
  tieneMatchGoogle: boolean
  pendiente: EdicionDeDatos | null
  bitacora: EdicionDeDatos[]
}

export async function getLugarParaCorregir(placeId: string): Promise<LugarParaCorregir | null> {
  if (!UUID_RE.test(placeId)) return null

  const [place] = await db
    .select({
      id: places.id,
      name: places.name,
      address: places.address,
      locality: places.locality,
      lat: places.lat,
      lng: places.lng,
      lockedFields: places.lockedFields,
      confidence: places.confidence,
      operatingStatus: places.operatingStatus,
      publishOverride: places.publishOverride,
      googlePlaceId: places.googlePlaceId,
    })
    .from(places)
    .where(eq(places.id, placeId))
    .limit(1)

  if (!place) return null

  const [umbral, zonaPorLugar, bitacora] = await Promise.all([
    getConfidenceThreshold(),
    zonaPrimariaDeLugares([placeId]),
    bitacoraDeLugar(placeId),
  ])

  return {
    id: place.id,
    name: place.name,
    address: place.address,
    locality: place.locality,
    lat: place.lat,
    lng: place.lng,
    lockedFields: place.lockedFields,
    zona: zonaPorLugar.get(place.id) ?? null,
    publicado: isPlacePublished(
      {
        operatingStatus: place.operatingStatus,
        confidence: place.confidence,
        publishOverride: place.publishOverride,
      },
      umbral,
    ),
    tieneMatchGoogle: place.googlePlaceId !== null,
    pendiente: bitacora.find((e) => e.status === 'pending') ?? null,
    bitacora,
  }
}

/** Toda la bitácora de un lugar, lo más nuevo primero (el índice está en ese orden). */
export async function bitacoraDeLugar(placeId: string): Promise<EdicionDeDatos[]> {
  if (!UUID_RE.test(placeId)) return []

  return db
    .select(SELECT_EDICION)
    .from(placeDataEdits)
    .leftJoin(users, eq(users.id, placeDataEdits.requestedBy))
    .where(eq(placeDataEdits.placeId, placeId))
    .orderBy(desc(placeDataEdits.createdAt))
}

/**
 * Lo que el panel del dueño necesita mostrar: su propuesta en revisión, o la
 * última que se rechazó con su motivo (decisión 14: el estado se ve donde el dueño
 * ya está mirando, sin mail de por medio).
 */
export type EstadoCorreccionDueno = {
  pendiente: EdicionDeDatos | null
  ultimaRechazada: EdicionDeDatos | null
}

export async function estadoCorreccionDelDueno(placeId: string): Promise<EstadoCorreccionDueno> {
  const bitacora = await bitacoraDeLugar(placeId)
  // Ya viene lo más nuevo primero, así que el primero de cada estado es el último.
  const delDueno = bitacora.filter((e) => e.origen === 'owner')
  const rechazada = delDueno.find((e) => e.status === 'rejected') ?? null
  const aprobada = delDueno.find((e) => e.status === 'approved') ?? null

  // El «No lo tomamos» se muestra solo si es la última palabra: con una propuesta
  // aprobada después, seguir mostrando un rechazo viejo diría lo contrario de lo
  // que pasó.
  const vigente = rechazada && (!aprobada || rechazada.createdAt > aprobada.createdAt)

  return {
    pendiente: delDueno.find((e) => e.status === 'pending') ?? null,
    ultimaRechazada: vigente ? rechazada : null,
  }
}

/** Una propuesta esperando en la cola de `/admin`, con el lugar que toca. */
export type CorreccionEnCola = EdicionDeDatos & {
  placeId: string
  placeName: string
  placeAddress: string | null
  zona: string | null
}

/**
 * Las correcciones pendientes para la tab «Cola de aprobación» (decisión 16):
 * revisar una corrección es el mismo trabajo que revisar un reclamo, con el mismo
 * criterio y la misma persona. Lee el índice parcial de pendientes.
 */
export async function correccionesPendientes(): Promise<CorreccionEnCola[]> {
  const filas = await db
    .select({
      ...SELECT_EDICION,
      placeId: placeDataEdits.placeId,
      placeName: places.name,
      placeAddress: places.address,
    })
    .from(placeDataEdits)
    .innerJoin(places, eq(places.id, placeDataEdits.placeId))
    .leftJoin(users, eq(users.id, placeDataEdits.requestedBy))
    .where(eq(placeDataEdits.status, 'pending'))
    .orderBy(desc(placeDataEdits.createdAt))

  const zonaPorLugar = await zonaPrimariaDeLugares(filas.map((f) => f.placeId))

  return filas.map((f) => ({ ...f, zona: zonaPorLugar.get(f.placeId) ?? null }))
}
