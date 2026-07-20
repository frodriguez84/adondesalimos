import { asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { chipTags, occasionChips, tags } from '@/lib/db/schema'
import { EMPTY_SEARCH } from './params'
import { countPlaces } from './query'

/**
 * Los chips de Ocasión que la home puede dibujar (F3 de BUSQUEDA).
 *
 * Server-only, igual que `catalog.ts`: lo llama el server component de `/` y
 * viaja al cliente como props. Tocar un chip no consulta nada — aplica sus tags
 * a la URL, que es el estado (decisión 12).
 *
 * **Un chip que devuelve 0 no se lista** (decisión 25). No es `active` —eso es
 * curaduría manual, apagar un chip a mano— sino un conteo en runtime: un chip se
 * prende **solo** cuando la curaduría o los dueños le llenan los tags, sin
 * deploy. Es el mismo criterio que `getFacetCatalog` aplica a los tags del sheet
 * (decisión 27), por el mismo motivo: ofrecer un atajo que devuelve 0 siempre es
 * mentir.
 *
 * El conteo es **global**, no de la búsqueda en curso: la decisión 25 habla del
 * catálogo, no del contexto. Un chip que existe en AMBA pero no en la zona
 * elegida se muestra igual y cae en el estado de 0 resultados de la decisión 23,
 * que ya sabe rescatar al usuario.
 */

export type OccasionChipView = {
  slug: string
  name: string
  /** Tags que aplica. Van a la URL tal cual al tocarlo. */
  tags: string[]
  /** Lugares publicados que devuelve hoy en todo AMBA. Siempre ≥ 1. */
  count: number
}

export type OccasionChips = {
  /** Los 4 de la home (decisión 6). Puede traer menos si no hay 4 con datos. */
  home: OccasionChipView[]
  /** Los de "ver más". */
  resto: OccasionChipView[]
}

/** Cuántos chips entran en la home sin abrir "ver más" (decisión 6). */
export const CHIPS_EN_HOME = 4

export async function getOccasionChips(): Promise<OccasionChips> {
  const filas = await db
    .select({
      slug: occasionChips.slug,
      name: occasionChips.name,
      inHome: occasionChips.inHome,
      tag: tags.slug,
    })
    .from(occasionChips)
    .leftJoin(chipTags, eq(chipTags.chipId, occasionChips.id))
    .leftJoin(tags, eq(tags.id, chipTags.tagId))
    .where(eq(occasionChips.active, true))
    .orderBy(asc(occasionChips.sort))

  const porSlug = new Map<string, Omit<OccasionChipView, 'count'> & { inHome: boolean }>()
  for (const f of filas) {
    const actual = porSlug.get(f.slug)
    if (actual) {
      if (f.tag) actual.tags.push(f.tag)
      continue
    }
    porSlug.set(f.slug, {
      slug: f.slug,
      name: f.name,
      tags: f.tag ? [f.tag] : [],
      inHome: f.inHome,
    })
  }

  // El conteo sale de `countPlaces`, el mismo que usa el botón "Ver N lugares"
  // (F2), y no de una query propia. Se intentó lo contrario —una sola query que
  // contara los 17 chips de una— y fue **20× más lento**: 7,4 s contra 370 ms,
  // porque el "AND entre facetas" escrito de forma genérica obliga a Postgres a
  // correlacionar por lugar. Además de rápido, esto elimina la posibilidad de
  // que el número del chip y lo que devuelve tocarlo diverjan: es literalmente
  // la misma función. Es el mismo razonamiento que llevó a `construirWhere`.
  const conConteo = await Promise.all(
    [...porSlug.values()].map(async (c) => ({
      ...c,
      count: await countPlaces({ ...EMPTY_SEARCH, tags: c.tags }),
    })),
  )

  // Un chip sin tags no filtra nada: devolvería el catálogo entero, que es la
  // pantalla que la decisión 2 evita. Se descarta con los que dan 0.
  const vivos = conConteo.filter((c) => c.count > 0 && c.tags.length > 0)

  // Decisión 6 (4 fijos en la home) + decisión 25 (los que dan 0 no se ven): la
  // home toma los primeros 4 **con datos** entre los marcados `in_home`. Sin
  // esto la home arrancaría con un chip, porque 3 de los 4 objetivo dan 0 hoy
  // (decisión 26). Los objetivo tienen `sort` menor, así que cuando la curaduría
  // los reviva vuelven solos a la home y desplazan a los V1 al "ver más".
  const candidatos = vivos.filter((c) => c.inHome)
  const home = candidatos.slice(0, CHIPS_EN_HOME)
  const enHome = new Set(home.map((c) => c.slug))

  const limpiar = ({ slug, name, tags, count }: OccasionChipView): OccasionChipView => ({
    slug,
    name,
    tags,
    count,
  })

  return {
    home: home.map(limpiar),
    resto: vivos.filter((c) => !enHome.has(c.slug)).map(limpiar),
  }
}
