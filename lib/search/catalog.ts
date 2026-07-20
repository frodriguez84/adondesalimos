import { asc, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { getConfidenceThreshold } from '@/lib/db/settings'
import { placeTags, places, tags, zoneAliases, zones } from '@/lib/db/schema'
import { publishedSql } from '@/lib/db/visibility'
import { FACET_LABELS, FACET_ORDER } from '@/lib/db/taxonomy'
import type { Facet, Region } from '@/lib/db/schema'

/**
 * Lo que necesitan los selectores de F2 para dibujarse: la taxonomía y las zonas
 * con la forma que consume la UI. Server-only — lo llama el server component de
 * `/` y viaja una sola vez al cliente como props.
 *
 * No es "otra copia" de `lib/db/taxonomy.ts`: ese archivo es la semilla (qué
 * tags existen), esto es el estado de la DB (cuáles están activos y cuáles
 * tienen lugares hoy). La curaduría puede desactivar un tag sin deploy y acá se
 * refleja; en la semilla no.
 */

export type CatalogTag = {
  slug: string
  name: string
  /** Solo Cocina: slug del padre. Los hijos se anidan bajo él en el sheet. */
  parent: string | null
  /** Solo Actividad/Ambiente: subtítulo dentro de la faceta. */
  group: string | null
  /** Lugares publicados que devolvería filtrar por este tag. Siempre ≥ 1. */
  count: number
}

export type CatalogFacet = {
  facet: Facet
  label: string
  tags: CatalogTag[]
}

export type CatalogZone = {
  slug: string
  name: string
  region: Region
  /** Nombres alternativos que matchea el autocompletar. Hoy hay 4 en toda la DB. */
  aliases: string[]
}

/**
 * Facetas con sus tags, contando lugares publicados por tag.
 *
 * **Un tag con cero lugares no se lista, y una faceta que queda vacía tampoco.**
 * Es el criterio de la decisión 25 (un chip que da 0 no se muestra) aplicado al
 * sheet de filtros, y con el catálogo de hoy borra la faceta Precio entera:
 * `place_tags` no tiene ni una fila de Precio (medición del spec). Ofrecer el
 * filtro sería prometer un corte que devuelve 0 siempre.
 *
 * Se prende solo cuando la curaduría o los dueños llenen tags — sin deploy, que
 * es lo que la decisión 18 buscaba para los chips.
 *
 * El conteo replica la semántica de `filtrosDeTags`: un padre de Cocina cuenta
 * los lugares de sus hijos **y** los suyos propios, porque eso es lo que
 * devuelve filtrar por él.
 */
export async function getFacetCatalog(): Promise<CatalogFacet[]> {
  const umbral = await getConfidenceThreshold()

  const filas = await db
    .select({
      slug: tags.slug,
      name: tags.name,
      facet: tags.facet,
      group: tags.groupLabel,
      sort: tags.sort,
      parent: sql<string | null>`padre.slug`,
      // `places` va sin alias a propósito: `publishedSql` referencia la tabla
      // por su nombre, y es la fuente única de la regla de visibilidad
      // (CATALOGO). Aliasarla acá obligaría a reescribir la regla.
      count: sql<number>`(
        SELECT count(DISTINCT pt.place_id)::int
        FROM ${tags} hijo
        JOIN ${placeTags} pt ON pt.tag_id = hijo.id
        JOIN ${places} ON ${places.id} = pt.place_id
        WHERE (hijo.id = ${tags.id} OR hijo.parent_id = ${tags.id})
          AND hijo.active = true
          AND ${publishedSql(umbral)}
      )`,
    })
    .from(tags)
    .leftJoin(sql`${tags} padre`, sql`padre.id = ${tags.parentId}`)
    .where(eq(tags.active, true))
    .orderBy(asc(tags.sort))

  const conDatos = filas.filter((f) => f.count > 0)

  return FACET_ORDER.map((facet) => ({
    facet,
    label: FACET_LABELS[facet],
    tags: conDatos
      .filter((f) => f.facet === facet)
      .map((f) => ({
        slug: f.slug,
        name: f.name,
        parent: f.parent,
        group: f.group,
        count: f.count,
      })),
  })).filter((f) => f.tags.length > 0)
}

/**
 * Las 46 zonas activas con sus alias, agrupables por región.
 *
 * A diferencia de los tags, las zonas **no se filtran por conteo**: una zona sin
 * lugares publicados sigue siendo una respuesta honesta a "¿dónde busco?" (el
 * usuario elige dónde está, no qué hay), y el estado de 0 resultados de la
 * decisión 23 ya cubre el caso.
 */
export async function getZoneCatalog(): Promise<CatalogZone[]> {
  const filas = await db
    .select({
      slug: zones.slug,
      name: zones.name,
      region: zones.region,
      alias: zoneAliases.alias,
    })
    .from(zones)
    .leftJoin(zoneAliases, eq(zoneAliases.zoneId, zones.id))
    .where(eq(zones.active, true))
    .orderBy(asc(zones.sort))

  const porSlug = new Map<string, CatalogZone>()
  for (const f of filas) {
    const actual = porSlug.get(f.slug)
    if (actual) {
      if (f.alias) actual.aliases.push(f.alias)
      continue
    }
    porSlug.set(f.slug, {
      slug: f.slug,
      name: f.name,
      region: f.region,
      aliases: f.alias ? [f.alias] : [],
    })
  }
  return [...porSlug.values()]
}
