import { and, count, countDistinct, eq, gte } from 'drizzle-orm'

import { db } from '@/lib/db'
import { places, placeTags, placeZones, tags, zones } from '@/lib/db/schema'
import { getConfidenceThreshold, getSetting } from '@/lib/db/settings'
import { publishedWhere } from '@/lib/db/visibility'

/**
 * Qué páginas SEO existen — **dueño único** (SEO, § Arquitectura).
 *
 * La lista de páginas de `/salir` y la lista del sitemap tienen que salir de la
 * **misma** llamada: si divergen, el sitemap le promete a Google URLs que dan
 * 404, que es peor que no tener sitemap. Por eso `generateStaticParams` (F2) y
 * `app/sitemap.ts` llaman a `paginasDeZonaTipo()` y no arman la lista por su
 * cuenta.
 *
 * ⚠️ **Todas las queries de acá pasan por `publishedWhere` / `getConfidenceThreshold`**
 * (`lib/db/visibility.ts`). No se reimplementa la regla de publicado: el sitemap
 * es justo el lugar donde ofrecerle a Google un lugar despublicado sería un error
 * caro y silencioso.
 */

/**
 * Piso de lugares publicados para que un combo zona × tipo tenga página propia
 * (decisión 3). Con 10 son 255 páginas; con 20 serían 194, y una página con 12
 * bares de verdad es una buena página. Es un número, no una puerta de ida:
 * moverlo es un rebuild.
 *
 * ⚠️ **No es el piso de los chips** (`PISO_HOME` = 20 / `PISO_ZONA` = 3, en
 * `lib/search/chips.ts`). Miden cosas distintas —aquel decide si un chip es un
 * atajo útil en la portada, éste si hay contenido para una landing— y por eso son
 * constantes distintas. Unificarlos rompería las dos cosas a la vez.
 */
export const PISO_PAGINA_ZONA = 10

/**
 * Mínimo de tags para que una ficha entre al sitemap (decisión 8). Vive en
 * `app_settings` y no hardcodeado, mismo criterio que `catalog.confidence_threshold`:
 * cuando la curaduría de cobertura avance, el sitemap crece **sin deploy**, con un
 * UPDATE. Es la conexión concreta entre curaduría y SEO — cada lugar curado es una
 * página que pasa a ofrecerse.
 */
export const UMBRAL_TAGS_SITEMAP_KEY = 'seo.sitemap_min_tags'

/** Valor inicial del seed. Solo un fallback: la verdad vive en `app_settings`. */
export const DEFAULT_UMBRAL_TAGS_SITEMAP = 3

/** Path de la página hub de una zona. Escrito una sola vez. */
export function urlDeZona(zona: string): string {
  return `/salir/${zona}`
}

/** Path de la página de un combo zona × tipo. Escrito una sola vez. */
export function urlDeZonaTipo(zona: string, tipo: string): string {
  return `/salir/${zona}/${tipo}`
}

export type PaginaZonaTipo = { zona: string; tipo: string; total: number }

/**
 * **La única** query que decide qué combos zona × tipo existen (decisiones 2 y 3).
 *
 * Un lugar puede caer en dos zonas por el buffer de 400 m (ZONAS, decisión 5), así
 * que se cuenta `count(distinct place_id)` por combo: aparece en las dos páginas y
 * eso es correcto —son páginas distintas que comparten algunos ítems—, pero dentro
 * de una no se cuenta dos veces.
 *
 * **El filtro es opcional a propósito, y por eso no hay una segunda función.**
 * `generateStaticParams` y `app/sitemap.ts` la llaman **sin argumento** (la lista
 * completa: es el requisito de la decisión 5 —las dos listas salen de la misma
 * llamada—). Las páginas la llaman **acotada**, que es la misma regla sobre menos
 * filas: `{ zona }` para "los otros tipos de este barrio" y `{ tipo }` para "lo
 * mismo en los barrios de al lado". Sin el filtro cada una de las 301 páginas
 * correría el GROUP BY entero en el build, que es tiempo de build regalado — y una
 * función aparte sería la segunda implementación del piso.
 */
export async function paginasDeZonaTipo(filtro?: {
  zona?: string
  tipo?: string
}): Promise<PaginaZonaTipo[]> {
  const umbral = await getConfidenceThreshold()
  const total = countDistinct(places.id)

  const where = [publishedWhere(umbral)]
  if (filtro?.zona) where.push(eq(zones.slug, filtro.zona))
  if (filtro?.tipo) where.push(eq(tags.slug, filtro.tipo))

  return db
    .select({ zona: zones.slug, tipo: tags.slug, total })
    .from(places)
    .innerJoin(placeZones, eq(placeZones.placeId, places.id))
    .innerJoin(zones, and(eq(zones.id, placeZones.zoneId), eq(zones.active, true)))
    .innerJoin(placeTags, eq(placeTags.placeId, places.id))
    .innerJoin(
      tags,
      and(eq(tags.id, placeTags.tagId), eq(tags.facet, 'tipo'), eq(tags.active, true)),
    )
    .where(and(...where))
    .groupBy(zones.slug, tags.slug)
    .having(gte(total, PISO_PAGINA_ZONA))
    .orderBy(zones.slug, tags.slug)
}

/**
 * ¿El combo tiene página propia? Lo pregunta el breadcrumb de la ficha
 * (decisión 13): un lugar puede ser un bar de una zona donde los bares no llegan
 * al piso, y linkear ahí sería mandar al usuario —y al crawler— a un 404.
 *
 * Se resuelve con la **misma** `paginasDeZonaTipo` acotada a la zona y no con un
 * `count` propio: el piso y la regla de publicado tienen un solo dueño, y una
 * segunda query "parecida" es exactamente lo que driftea.
 */
export async function existePaginaZonaTipo(zona: string, tipo: string): Promise<boolean> {
  const paginas = await paginasDeZonaTipo({ zona })
  return paginas.some((p) => p.tipo === tipo)
}

export type FichaDeSitemap = { id: string; updatedAt: Date }

/**
 * Las fichas que se le ofrecen a Google: publicadas y con al menos
 * `seo.sitemap_min_tags` tags (decisión 7). Las otras ~17.870 **siguen crawlables,
 * linkeables y compartibles** — no llevan `noindex`; la diferencia entre "no se lo
 * ofrezco" y "le digo que lo ignore" es toda la decisión.
 *
 * ⚠️ **Cuenta solo tags vivos (`tags.active`)**, igual que `paginasDeZonaTipo`. La
 * medición del spec (1.124) se hizo sin ese filtro y da **1.123**: la diferencia es
 * un lugar cuya única sustancia era un tag retirado (`TAGS_RETIRADOS`,
 * `lib/db/taxonomy.ts`). Que las dos funciones de este módulo cuenten distinto sería
 * peor que el número: "tiene sustancia" tiene que querer decir lo mismo en las dos,
 * o driftean. El número del spec quedó corregido a 1.123 / 576.
 */
export async function fichasParaSitemap(): Promise<FichaDeSitemap[]> {
  const [umbralConfidence, umbralTags] = await Promise.all([
    getConfidenceThreshold(),
    getUmbralTagsSitemap(),
  ])

  return db
    .select({ id: places.id, updatedAt: places.updatedAt })
    .from(places)
    .innerJoin(placeTags, eq(placeTags.placeId, places.id))
    .innerJoin(tags, and(eq(tags.id, placeTags.tagId), eq(tags.active, true)))
    .where(publishedWhere(umbralConfidence))
    .groupBy(places.id, places.updatedAt)
    .having(gte(count(placeTags.tagId), umbralTags))
}

/** Umbral vigente. Se lee en cada revalidación: un UPDATE lo mueve sin redeploy. */
export async function getUmbralTagsSitemap(): Promise<number> {
  const value = await getSetting<number>(UMBRAL_TAGS_SITEMAP_KEY)
  return typeof value === 'number' ? value : DEFAULT_UMBRAL_TAGS_SITEMAP
}
