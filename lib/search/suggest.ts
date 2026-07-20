import type { CatalogFacet, CatalogTag, CatalogZone } from './catalog'

/**
 * Sugerencias del campo de texto (decisión 15): mientras se tipea, un dropdown
 * en dos grupos — **Filtros** (tags que matchean) y **Zonas** (nombre o alias).
 * Tocar una sugerencia la aplica como chip removible; Enter sin elegir busca por
 * nombre de lugar, que es lo que ya hace el motor.
 *
 * Puro y sin DB: opera sobre el catálogo que el server ya mandó (105 tags + 46
 * zonas). Por eso el dropdown responde sin roundtrip por tecla.
 *
 * **Divergencia deliberada de la decisión 14**, que pide trgm también para tags
 * y zonas: acá el match es substring sobre texto sin acentos. Sobre una lista de
 * ~150 items en memoria, un trigrama no compra nada que el usuario note, y sí
 * costaría un fetch por tecla. La tolerancia a typos que el spec quiere sigue
 * viva donde importa —los 26.057 nombres de lugar— resuelta con `word_similarity`
 * en `query.ts`. Si algún día el catálogo de tags crece un orden de magnitud,
 * esto se mueve a un endpoint.
 */

const MAX_POR_GRUPO = 6

/** Minúsculas y sin acentos: "Café" y "cafe" tienen que ser lo mismo. */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
}

export type SugerenciaTag = { kind: 'tag'; slug: string; name: string; facetLabel: string }
export type SugerenciaZona = { kind: 'zone'; slug: string; name: string; via: string | null }
export type Sugerencias = { tags: SugerenciaTag[]; zonas: SugerenciaZona[] }

export const SIN_SUGERENCIAS: Sugerencias = { tags: [], zonas: [] }

/**
 * Ordena los matches: primero los que empiezan con el término (lo que el usuario
 * espera al tipear un prefijo), después los que lo contienen en el medio.
 */
function rank(nombre: string, termino: string): number {
  const n = normalizar(nombre)
  if (n.startsWith(termino)) return 0
  return 1
}

export function sugerir(
  texto: string,
  facetas: CatalogFacet[],
  zonas: CatalogZone[],
): Sugerencias {
  const termino = normalizar(texto)
  // Igual que en `parseSearchParams`: con una sola letra el dropdown sería la
  // lista entera y no ayuda a nadie.
  if (termino.length < 2) return SIN_SUGERENCIAS

  const tagsMatch: (SugerenciaTag & { r: number })[] = []
  for (const faceta of facetas) {
    for (const tag of faceta.tags) {
      if (!normalizar(tag.name).includes(termino)) continue
      tagsMatch.push({
        kind: 'tag',
        slug: tag.slug,
        name: tag.name,
        facetLabel: faceta.label,
        r: rank(tag.name, termino),
      })
    }
  }

  const zonasMatch: (SugerenciaZona & { r: number })[] = []
  for (const zona of zonas) {
    if (normalizar(zona.name).includes(termino)) {
      zonasMatch.push({ kind: 'zone', slug: zona.slug, name: zona.name, via: null, r: rank(zona.name, termino) })
      continue
    }
    // El alias no se muestra solo: se muestra como "Chacarita y Colegiales
    // (Villa Ortúzar)", para que quede claro por qué apareció esa zona.
    const alias = zona.aliases.find((a) => normalizar(a).includes(termino))
    if (alias) {
      zonasMatch.push({ kind: 'zone', slug: zona.slug, name: zona.name, via: alias, r: rank(alias, termino) })
    }
  }

  const podar = <T extends { r: number }>(xs: T[]) =>
    xs
      .sort((a, b) => a.r - b.r)
      .slice(0, MAX_POR_GRUPO)
      .map(({ r: _r, ...resto }) => resto)

  return {
    tags: podar(tagsMatch) as SugerenciaTag[],
    zonas: podar(zonasMatch) as SugerenciaZona[],
  }
}

/**
 * Slug → label para los chips activos. Un slug que ya no existe en el catálogo
 * (tag desactivado por curaduría, zona retirada) devuelve null: el chip no se
 * dibuja, pero el filtro sigue en la URL y el motor ya lo ignora. Un link viejo
 * no rompe la pantalla.
 */
export function etiquetaDeTag(slug: string, facetas: CatalogFacet[]): string | null {
  for (const faceta of facetas) {
    const tag = faceta.tags.find((t) => t.slug === slug)
    if (tag) return tag.name
  }
  return null
}

export function etiquetaDeZona(slug: string, zonas: CatalogZone[]): string | null {
  return zonas.find((z) => z.slug === slug)?.name ?? null
}

/** Los tags de una faceta agrupados por `group_label`, para el acordeón. */
export function agruparPorLabel(tags: CatalogTag[]): { label: string | null; tags: CatalogTag[] }[] {
  const grupos: { label: string | null; tags: CatalogTag[] }[] = []
  for (const tag of tags) {
    const label = tag.group ?? null
    const ultimo = grupos.find((g) => g.label === label)
    if (ultimo) ultimo.tags.push(tag)
    else grupos.push({ label, tags: [tag] })
  }
  return grupos
}
