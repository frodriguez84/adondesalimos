import { and, desc, eq, exists, inArray, isNotNull, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { placeClaims, placeTags, placeZones, places, tags, zones } from '@/lib/db/schema'
import { getConfidenceThreshold } from '@/lib/db/settings'
import { publishedWhere } from '@/lib/db/visibility'
import { TIPO_RELEVANTE_CHIPS } from './facetas'

/**
 * Selección del batch dentro de una zona (CURADURIA, decisión 3).
 *
 *   publicados (vía `publishedWhere`)
 *   ∧ zona **primaria** = esta zona
 *   ∧ tienen al menos un Tipo relevante a los chips (`TIPO_RELEVANTE_CHIPS`)
 *   ∧ **sin reclamo aprobado** (decisión 3 + 6: el dueño es mejor fuente)
 *   orden: primero los que tienen web/redes/teléfono (insumo del LLM), luego
 *   `confidence` desc
 *   límite: la cuota de la zona
 *
 * La regla de "sin reclamo aprobado" se resuelve en SQL (NOT EXISTS) y no
 * post-filtrando, así la cuota no se gasta en lugares que después se descartan.
 */

/** Un lugar listo para curar, con la evidencia que el LLM va a leer. */
export type PlaceParaCurar = {
  id: string
  name: string
  overtureCategory: string | null
  websites: string[]
  socials: string[]
  phones: string[]
  /** Tags que ya tiene (para no re-sugerir y dar contexto al modelo). */
  tagsExistentes: { slug: string; name: string; facet: string }[]
}

/** El id de una zona por su slug. Null si no existe (el batch lo reporta y sigue). */
export async function zonaIdPorSlug(slug: string): Promise<number | null> {
  const [fila] = await db.select({ id: zones.id }).from(zones).where(eq(zones.slug, slug)).limit(1)
  return fila?.id ?? null
}

export async function seleccionarLugaresDeZona(
  zoneId: number,
  cuota: number,
): Promise<PlaceParaCurar[]> {
  const umbral = await getConfidenceThreshold()

  // EXISTS: el lugar tiene un Tipo relevante a los chips.
  const tieneTipoRelevante = exists(
    db
      .select({ one: sql`1` })
      .from(placeTags)
      .innerJoin(tags, eq(tags.id, placeTags.tagId))
      .where(
        and(
          eq(placeTags.placeId, places.id),
          eq(tags.facet, 'tipo'),
          inArray(tags.slug, [...TIPO_RELEVANTE_CHIPS]),
        ),
      ),
  )

  // NOT EXISTS: el lugar no tiene reclamo aprobado (decisión 3).
  const sinDuenoAprobado = sql`NOT ${exists(
    db
      .select({ one: sql`1` })
      .from(placeClaims)
      .where(and(eq(placeClaims.placeId, places.id), eq(placeClaims.status, 'approved'))),
  )}`

  const tieneContacto = or(
    isNotNull(places.websites),
    isNotNull(places.socials),
    isNotNull(places.phones),
  )!

  const filas = await db
    .select({
      id: places.id,
      name: places.name,
      overtureCategory: places.overtureCategory,
      websites: places.websites,
      socials: places.socials,
      phones: places.phones,
    })
    .from(places)
    .innerJoin(
      placeZones,
      and(eq(placeZones.placeId, places.id), eq(placeZones.isPrimary, true)),
    )
    .where(
      and(
        eq(placeZones.zoneId, zoneId),
        publishedWhere(umbral),
        tieneTipoRelevante,
        sinDuenoAprobado,
      ),
    )
    // Primero los que tienen algún dato de contacto, después por confidence.
    .orderBy(desc(tieneContacto), desc(places.confidence))
    .limit(cuota)

  if (filas.length === 0) return []

  const ids = filas.map((f) => f.id)
  const filasTags = await db
    .select({ placeId: placeTags.placeId, slug: tags.slug, name: tags.name, facet: tags.facet })
    .from(placeTags)
    .innerJoin(tags, eq(tags.id, placeTags.tagId))
    .where(inArray(placeTags.placeId, ids))

  const tagsPorLugar = new Map<string, { slug: string; name: string; facet: string }[]>()
  for (const f of filasTags) {
    const actual = tagsPorLugar.get(f.placeId) ?? []
    actual.push({ slug: f.slug, name: f.name, facet: f.facet })
    tagsPorLugar.set(f.placeId, actual)
  }

  return filas.map((f) => ({
    id: f.id,
    name: f.name,
    overtureCategory: f.overtureCategory,
    websites: f.websites ?? [],
    socials: f.socials ?? [],
    phones: f.phones ?? [],
    tagsExistentes: tagsPorLugar.get(f.id) ?? [],
  }))
}
