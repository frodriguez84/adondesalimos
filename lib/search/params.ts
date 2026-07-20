/**
 * La URL es el estado de la búsqueda (decisión 12 de BUSQUEDA).
 *
 * Contrato: `/?z=palermo-soho,villa-crespo&t=bar,juegos-de-mesa&q=texto&gps=1`
 *
 * Los slugs de zona (`lib/zones/canon.ts`) y de tag (`lib/db/taxonomy.ts`) son
 * contrato: viven acá, en links que la gente comparte. No renombrarlos.
 *
 * Este módulo es puro — no toca la base. Lo consumen el server component de `/`,
 * el route handler de `/api/search` y los tests.
 */

/** Página de resultados (decisión 19). */
export const PAGE_SIZE = 20

/** Radio fijo de "cerca de mí", sin slider (decisión 17). */
export const GPS_RADIUS_KM = 2

export type SearchParams = {
  /** Slugs de zona, OR entre sí. Vacío = sin filtro de zona. */
  zones: string[]
  /** Slugs de tag de cualquier faceta. La query los agrupa por faceta. */
  tags: string[]
  /** Texto libre. Busca por nombre de lugar (decisión 15). */
  q: string | null
  /**
   * "Cerca de mí" encendido. Las coordenadas NO viajan en la URL: son del
   * dispositivo que mira, no del que compartió el link. Las aporta el cliente.
   */
  gps: boolean
  /** Coordenadas del dispositivo, solo presentes en llamadas a la API. */
  coords: { lat: number; lng: number } | null
  cursor: string | null
}

export const EMPTY_SEARCH: SearchParams = {
  zones: [],
  tags: [],
  q: null,
  gps: false,
  coords: null,
  cursor: null,
}

/** Lo que Next entrega en `searchParams`. */
export type RawParams = Record<string, string | string[] | undefined>

function primero(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor
}

/**
 * Lista separada por comas → slugs limpios, sin duplicados y en orden estable.
 *
 * El orden estable importa: `?t=bar,cafe` y `?t=cafe,bar` son la misma búsqueda
 * y tienen que producir el mismo cursor y el mismo caché.
 */
function listaDeSlugs(valor: string | string[] | undefined): string[] {
  const crudo = primero(valor)
  if (!crudo) return []
  const slugs = crudo
    .split(',')
    .map((s) => s.trim().toLowerCase())
    // Los slugs del canon y de la taxonomía son [a-z0-9-]. Cualquier otra cosa
    // es ruido o un intento de inyección: se descarta acá, en el borde.
    .filter((s) => /^[a-z0-9-]{1,60}$/.test(s))
  return [...new Set(slugs)].sort()
}

function coordenada(valor: string | undefined, max: number): number | null {
  if (valor === undefined) return null
  const n = Number(valor)
  if (!Number.isFinite(n) || Math.abs(n) > max) return null
  return n
}

/** searchParams → estado de búsqueda. Tolera basura: nunca tira. */
export function parseSearchParams(raw: RawParams): SearchParams {
  const q = primero(raw.q)?.trim()
  const lat = coordenada(primero(raw.lat), 90)
  const lng = coordenada(primero(raw.lng), 180)
  const gps = primero(raw.gps) === '1'

  return {
    zones: listaDeSlugs(raw.z),
    tags: listaDeSlugs(raw.t),
    // Un `q` de un solo caracter no discrimina nada y hace trabajar al trigrama
    // de gusto: se ignora.
    q: q && q.length >= 2 ? q.slice(0, 100) : null,
    gps,
    coords: gps && lat !== null && lng !== null ? { lat, lng } : null,
    cursor: primero(raw.cursor) ?? null,
  }
}

/**
 * Estado → query string. La otra mitad del ida y vuelta: `parse(serialize(x))`
 * tiene que devolver `x` (con test).
 *
 * No serializa `coords` a propósito — ver `SearchParams.gps`.
 */
export function serializeSearchParams(params: SearchParams): string {
  const qs = new URLSearchParams()
  if (params.zones.length) qs.set('z', [...params.zones].sort().join(','))
  if (params.tags.length) qs.set('t', [...params.tags].sort().join(','))
  if (params.q) qs.set('q', params.q)
  if (params.gps) qs.set('gps', '1')
  if (params.cursor) qs.set('cursor', params.cursor)
  return qs.toString()
}

/**
 * ¿Hay algo que buscar? Primera visita = selector vacío y CERO resultados hasta
 * elegir zona (decisión 2). Sin esto la home arrancaría listando los 18.993
 * publicados de AMBA, que es exactamente la pantalla que el producto no quiere.
 */
export function tieneBusqueda(params: SearchParams): boolean {
  // `gps` cuenta como criterio solo CON coordenadas. Si no, `/?gps=1` pelado
  // pasaría este chequeo y la query correría sin ningún filtro de ubicación:
  // devolvería los 18.993 publicados de AMBA. El toggle vive en el cliente y las
  // coordenadas llegan después, así que este estado existe de verdad.
  const gpsUtil = params.gps && params.coords !== null
  return params.zones.length > 0 || params.tags.length > 0 || params.q !== null || gpsUtil
}
