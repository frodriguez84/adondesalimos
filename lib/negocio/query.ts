import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { getConfidenceThreshold } from '@/lib/db/settings'
import {
  placeImpressionsDaily,
  placeOwnerContent,
  placePhotos,
  placeTags,
  placeZones,
  places,
  tags,
  zones,
} from '@/lib/db/schema'
import { isPlacePublished } from '@/lib/db/visibility'
import { esDuenoDe, placeIdsDelUsuario } from '@/lib/claims/ownership'
import { FACET_LABELS, FACET_ORDER } from '@/lib/db/taxonomy'
import { capDeFotos } from './contenido'
import { normalizarSemana, type HorariosSemana } from './horarios'
import type { Facet, OwnerPlan } from '@/lib/db/schema'

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

  const [umbral, contenido, fotos, facetas, zonaPorLugar, visitas] = await Promise.all([
    getConfidenceThreshold(),
    getContenidoDueno(placeId),
    fotosDeLugar(placeId),
    facetasConElegidos(placeId),
    zonaPrimariaDeLugares([placeId]),
    visitasDelMes([placeId]),
  ])

  return {
    id: place.id,
    name: place.name,
    address: place.address,
    locality: place.locality,
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
