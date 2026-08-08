import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  placeTagSuggestions,
  placeTags,
  placeZones,
  places,
  tags,
  zones,
  type Facet,
} from '@/lib/db/schema'
import { getConfidenceThreshold } from '@/lib/db/settings'
import { FACET_LABELS } from '@/lib/db/taxonomy'
import { isPlacePublished } from '@/lib/db/visibility'
import { coincideNombre, simKey } from '@/lib/search/nombre'
import { FACETAS_SUGERIBLES } from './facetas'

/**
 * Lecturas de la cola de curaduría en `/admin` (CURADURIA, F2). Todo entra por
 * `status = 'pending'`: la cola solo muestra lo que falta revisar.
 *
 * El gate de admin NO vive acá (mismo criterio que `lib/claims/query.ts`): estas
 * funciones asumen que el llamador —`/admin` o el endpoint— ya verificó
 * `sesionAdmin`. Una sola puerta de auth, en el borde.
 */

/** Una zona con sugerencias pendientes: cuántos lugares y cuántas sugerencias. */
export type ZonaConCola = {
  slug: string
  name: string
  lugaresPendientes: number
  sugerenciasPendientes: number
}

/** Una sugerencia pendiente de un lugar, con su evidencia. */
export type SugerenciaEnCola = {
  tagSlug: string
  tagName: string
  facet: Facet
  evidence: string | null
  sourceUrl: string | null
}

/** Un tag del vocabulario editable (para tildar/destildar en "corregir"). */
export type TagOpcion = {
  slug: string
  name: string
  groupLabel: string | null
  /** Ya asignado al lugar (por import, dueño o una aceptación previa). */
  yaAsignado: boolean
  /** Lo sugirió el batch en esta tanda (arranca tildado). */
  sugerido: boolean
}

/** Una faceta con sus opciones, para la pantalla de corrección. */
export type FacetaEditable = {
  facet: Facet
  label: string
  tags: TagOpcion[]
}

/** El lugar que se está revisando, con todo lo que la pantalla necesita. */
export type LugarEnCola = {
  id: string
  name: string
  address: string | null
  /**
   * Zona primaria. **Nullable** desde CURADURIA_POR_NOMBRE: el modo por-nombre
   * alcanza lugares que no cayeron en ningún polígono (la cola por zona, por
   * construcción, siempre la tiene).
   */
  zonaSlug: string | null
  sugerencias: SugerenciaEnCola[]
  facetas: FacetaEditable[]
  /**
   * El precio que el lugar YA tiene, para que el editor arranque con él
   * (CURADURIA_POR_NOMBRE, decisión 3 / `FB-10b`). Se lee **sin filtrar por
   * `source`**: si lo puso un dueño o vino del import, el editor igual tiene que
   * mostrarlo — arrancar en "No sé" sobre un precio existente es lo que hacía que
   * guardar lo borrara en silencio. Si hubiera más de uno, gana el de menor
   * `tags.sort`.
   */
  precioSlug: string | null
}

/**
 * Las zonas que tienen sugerencias pendientes, con sus conteos. Es el selector de
 * la cola: si una zona no aparece, no hay nada que revisar ahí.
 */
export async function zonasConCola(): Promise<ZonaConCola[]> {
  const filas = await db
    .select({
      slug: zones.slug,
      name: zones.name,
      lugares: sql<number>`count(distinct ${placeTagSuggestions.placeId})::int`,
      sugerencias: sql<number>`count(*)::int`,
    })
    .from(placeTagSuggestions)
    .innerJoin(
      placeZones,
      and(eq(placeZones.placeId, placeTagSuggestions.placeId), eq(placeZones.isPrimary, true)),
    )
    .innerJoin(zones, eq(zones.id, placeZones.zoneId))
    .where(eq(placeTagSuggestions.status, 'pending'))
    .groupBy(zones.slug, zones.name)
    .orderBy(asc(zones.name))

  return filas.map((f) => ({
    slug: f.slug,
    name: f.name,
    lugaresPendientes: f.lugares,
    sugerenciasPendientes: f.sugerencias,
  }))
}

/**
 * El próximo lugar a revisar en una zona: el que tiene sugerencias pendientes, uno
 * por vez (flujo de la decisión 9). Devuelve null si la zona ya está limpia.
 *
 * Trae las sugerencias con evidencia **y** el vocabulario completo de las 3
 * facetas sugeribles con el estado de cada tag (ya asignado / sugerido), para que
 * la pantalla pueda tildar/destildar sin otra query.
 */
export async function proximoLugarDeZona(zonaSlug: string): Promise<LugarEnCola | null> {
  const [zona] = await db.select({ id: zones.id }).from(zones).where(eq(zones.slug, zonaSlug)).limit(1)
  if (!zona) return null

  // El lugar más viejo con pendientes en esta zona (orden estable entre recargas).
  const [lugar] = await db
    .select({
      id: places.id,
      name: places.name,
      address: places.address,
      minId: sql<number>`min(${placeTagSuggestions.id})`,
    })
    .from(placeTagSuggestions)
    .innerJoin(places, eq(places.id, placeTagSuggestions.placeId))
    .innerJoin(
      placeZones,
      and(eq(placeZones.placeId, places.id), eq(placeZones.isPrimary, true)),
    )
    .where(and(eq(placeZones.zoneId, zona.id), eq(placeTagSuggestions.status, 'pending')))
    .groupBy(places.id, places.name, places.address)
    .orderBy(sql`min(${placeTagSuggestions.id}) asc`)
    .limit(1)

  if (!lugar) return null

  return armarLugarEnCola(lugar, zonaSlug, true)
}

/**
 * El armador del editor: dado un lugar, junta sus sugerencias pendientes (si las
 * pide), lo que ya tiene asignado y el vocabulario completo de las 3 facetas
 * sugeribles. Lo comparten los dos caminos de entrada —la cola por zona y el
 * buscador por nombre— justamente para que el editor sea el mismo
 * (CURADURIA_POR_NOMBRE): una sola forma de armar `LugarEnCola`.
 */
async function armarLugarEnCola(
  lugar: { id: string; name: string; address: string | null },
  zonaSlug: string | null,
  conSugerencias: boolean,
): Promise<LugarEnCola> {
  type FilaSugerencia = {
    slug: string
    name: string
    facet: Facet
    evidence: string | null
    sourceUrl: string | null
  }

  const [filasSug, filasTags, vocab] = await Promise.all([
    conSugerencias
      ? db
          .select({
            slug: tags.slug,
            name: tags.name,
            facet: tags.facet,
            evidence: placeTagSuggestions.evidence,
            sourceUrl: placeTagSuggestions.sourceUrl,
          })
          .from(placeTagSuggestions)
          .innerJoin(tags, eq(tags.id, placeTagSuggestions.tagId))
          .where(
            and(
              eq(placeTagSuggestions.placeId, lugar.id),
              eq(placeTagSuggestions.status, 'pending'),
            ),
          )
          .orderBy(asc(tags.sort))
      : Promise.resolve([] as FilaSugerencia[]),
    db
      .select({ slug: tags.slug, facet: tags.facet })
      .from(placeTags)
      .innerJoin(tags, eq(tags.id, placeTags.tagId))
      .where(eq(placeTags.placeId, lugar.id))
      .orderBy(asc(tags.sort)),
    db
      .select({ slug: tags.slug, name: tags.name, facet: tags.facet, groupLabel: tags.groupLabel })
      .from(tags)
      .where(and(inArray(tags.facet, [...FACETAS_SUGERIBLES]), eq(tags.active, true)))
      .orderBy(asc(tags.sort)),
  ])

  const sugerencias: SugerenciaEnCola[] = filasSug.map((s) => ({
    tagSlug: s.slug,
    tagName: s.name,
    facet: s.facet,
    evidence: s.evidence,
    sourceUrl: s.sourceUrl,
  }))

  const yaAsignados = new Set(filasTags.map((t) => t.slug))
  // Decisión 3: el primero por `tags.sort` de la faceta precio, sin mirar `source`.
  const precioSlug = filasTags.find((t) => t.facet === 'precio')?.slug ?? null
  const sugeridos = new Set(sugerencias.map((s) => s.tagSlug))

  const facetas: FacetaEditable[] = [...FACETAS_SUGERIBLES].map((facet) => ({
    facet,
    label: FACET_LABELS[facet],
    tags: vocab
      .filter((t) => t.facet === facet)
      .map((t) => ({
        slug: t.slug,
        name: t.name,
        groupLabel: t.groupLabel,
        yaAsignado: yaAsignados.has(t.slug),
        sugerido: sugeridos.has(t.slug),
      })),
  }))

  return {
    id: lugar.id,
    name: lugar.name,
    address: lugar.address,
    zonaSlug,
    sugerencias,
    facetas,
    precioSlug,
  }
}

// ---------------------------------------------------------------------------
// Entrada por nombre (CURADURIA_POR_NOMBRE / `FB-10`)
// ---------------------------------------------------------------------------

/** Un resultado del buscador de admin: lo mínimo para elegir cuál curar. */
export type LugarBuscado = {
  id: string
  name: string
  address: string | null
  /** Zona primaria. Sin ella, cinco "Los Inmortales" son indistinguibles. */
  zonaNombre: string | null
  /** Si hoy aparece en la búsqueda pública. Solo informativo: no filtra nada. */
  publicado: boolean
}

/** Decisión 6: con una sola letra el resultado es el catálogo entero. */
export const MIN_CARACTERES_BUSQUEDA = 2

/** Decisión 6: el buscador es para elegir un lugar, no para pasear el catálogo. */
const TOPE_RESULTADOS = 10

/** `places.id` es uuid: un texto cualquiera haría explotar el driver, no un 404. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Buscar un lugar por nombre para curarlo, sin pasar por la cola (`FB-10`).
 *
 * ⚠️ **Divergencia deliberada y declarada del dueño único de visibilidad**
 * (decisión 1): esta query **no filtra por `publishedWhere`**. Un lugar
 * despublicado —confidence baja, marcado como cerrado— es exactamente uno de los
 * que hay que curar; filtrarlo dejaría afuera justo el catálogo que peor está.
 * El predicado simplemente **se omite**: no se escribe acá ninguna condición
 * espejo ni invertida. Para que el admin sepa qué está tocando, cada resultado
 * trae el flag `publicado` calculado con `isPlacePublished` — o sea,
 * `lib/db/visibility.ts` se **consulta para etiquetar**, nunca se reimplementa
 * para filtrar.
 *
 * El match por nombre es el mismo de la búsqueda pública (`lib/search/nombre.ts`,
 * decisión 4): tolerante a typos y acentos, sobre el índice GIN.
 */
export async function buscarLugaresPorNombre(q: string): Promise<LugarBuscado[]> {
  const termino = q.trim()
  if (termino.length < MIN_CARACTERES_BUSQUEDA) return []

  const filas = await db
    .select({
      id: places.id,
      name: places.name,
      address: places.address,
      zonaNombre: zones.name,
      operatingStatus: places.operatingStatus,
      confidence: places.confidence,
      publishOverride: places.publishOverride,
    })
    .from(places)
    .leftJoin(placeZones, and(eq(placeZones.placeId, places.id), eq(placeZones.isPrimary, true)))
    .leftJoin(zones, eq(zones.id, placeZones.zoneId))
    .where(coincideNombre(termino))
    // Similitud primero; nombre asc desempata para que el orden sea estable.
    .orderBy(desc(simKey(termino)), asc(places.name))
    .limit(TOPE_RESULTADOS)

  const umbral = await getConfidenceThreshold()

  return filas.map((f) => ({
    id: f.id,
    name: f.name,
    address: f.address,
    zonaNombre: f.zonaNombre,
    publicado: isPlacePublished(f, umbral),
  }))
}

/**
 * Un lugar puntual para curar, elegido en el buscador. Hermana de
 * `proximoLugarDeZona`: mismo editor, mismo `LugarEnCola`, pero sin cola —
 * `sugerencias: []` porque en este camino no hubo batch (la pantalla ya sabe
 * mostrar ese caso). Devuelve null si el id no existe.
 */
export async function lugarParaCurar(placeId: string): Promise<LugarEnCola | null> {
  if (!UUID.test(placeId)) return null

  const [lugar] = await db
    .select({
      id: places.id,
      name: places.name,
      address: places.address,
      zonaSlug: zones.slug,
    })
    .from(places)
    .leftJoin(placeZones, and(eq(placeZones.placeId, places.id), eq(placeZones.isPrimary, true)))
    .leftJoin(zones, eq(zones.id, placeZones.zoneId))
    .where(eq(places.id, placeId))
    .limit(1)

  if (!lugar) return null

  return armarLugarEnCola(lugar, lugar.zonaSlug, false)
}
