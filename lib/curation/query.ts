import { and, asc, eq, inArray, sql } from 'drizzle-orm'
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
import { FACET_LABELS } from '@/lib/db/taxonomy'
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
  zonaSlug: string
  sugerencias: SugerenciaEnCola[]
  facetas: FacetaEditable[]
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

  const [filasSug, filasTags, vocab] = await Promise.all([
    db
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
        and(eq(placeTagSuggestions.placeId, lugar.id), eq(placeTagSuggestions.status, 'pending')),
      )
      .orderBy(asc(tags.sort)),
    db
      .select({ slug: tags.slug })
      .from(placeTags)
      .innerJoin(tags, eq(tags.id, placeTags.tagId))
      .where(eq(placeTags.placeId, lugar.id)),
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
  }
}
