import type { GoogleEnriquecimiento } from './types'

/**
 * **El único módulo que habla con Google** (FICHA, decisión 18). La API key vive
 * solo acá y se lee de `process.env` en el momento de la llamada — nunca en el
 * tope del módulo, así importar los builders puros (para tests) no exige la key.
 *
 * Server-only por construcción: lo importan el endpoint y la query del server,
 * nunca un componente `'use client'` (el cliente habla con `/api/lugar/[id]/google`,
 * no con Google). El guard de abajo es la red de seguridad barata: si algún día
 * este módulo cae en un bundle de browser, revienta en vez de filtrar la key.
 *
 * Cero persistencia y cero caché (decisión 17): `fetch(..., { cache: 'no-store' })`
 * en las dos llamadas. El único dato de Google que sale de acá para guardar es el
 * `place_id` del resolver.
 */

if (typeof window !== 'undefined') {
  throw new Error('lib/google/places.ts es server-only: no puede importarse en el browser')
}

const TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText'
const PLACE_DETAILS_BASE = 'https://places.googleapis.com/v1/places/'

/** Timeout duro de las llamadas a Google (decisión 20): la ficha no espera más. */
const TIMEOUT_MS = 2500

/** Media caja de ~±300 m alrededor del lugar propio, para el `locationRestriction`. */
const RESTRICTION_METERS = 300

// ---------------------------------------------------------------------------
// Field masks — la línea entre $0 y la factura. NO tocar sin leer decisiones 7 y 11.
// ---------------------------------------------------------------------------

/**
 * Matching por Text Search *Essentials — IDs Only* (decisión 7): `places.id` y
 * **nada más**. Un solo campo extra (`places.displayName` es Pro, `places.location`
 * es Pro) convierte el matching gratis en $32/1.000. Hay un test que falla si esta
 * constante trae cualquier otra cosa.
 */
export const TEXT_SEARCH_FIELD_MASK = 'places.id'

/**
 * Place Details *Enterprise* (decisión 11): exactamente estos campos, sin prefijo
 * `places.` (el endpoint de detalle devuelve un lugar, no una lista). **Nunca**
 * `reviews`, `editorialSummary` ni atributos de ambiente — eso es Enterprise +
 * Atmosphere ($25/1.000) y el ambiente es tag propio (decisión 12). Un test falla
 * si aparece cualquiera de esos.
 */
export const PLACE_DETAILS_FIELD_MASK =
  'id,regularOpeningHours,currentOpeningHours,rating,userRatingCount,priceLevel,googleMapsUri,photos'

// ---------------------------------------------------------------------------
// Builders puros (testeables sin red)
// ---------------------------------------------------------------------------

export type MatchInput = {
  name: string
  address: string | null
  locality: string | null
  lat: number
  lng: number
}

/** Rectángulo lat/lng de lado ~2·`metros` centrado en el punto (WGS84 aproximado). */
export function rectanguloAlrededor(
  lat: number,
  lng: number,
  metros: number,
): { low: { latitude: number; longitude: number }; high: { latitude: number; longitude: number } } {
  const deltaLat = metros / 111_320
  // El meridiano se acorta con la latitud: sin el coseno, el rectángulo sería
  // más ancho de lo pedido cerca de los polos. En AMBA (~-34,6°) el factor es ~0,82.
  const deltaLng = metros / (111_320 * Math.cos((lat * Math.PI) / 180))
  return {
    low: { latitude: lat - deltaLat, longitude: lng - deltaLng },
    high: { latitude: lat + deltaLat, longitude: lng + deltaLng },
  }
}

/**
 * Body del Text Search del resolver (decisión 8, matching a ciegas). Las
 * salvaguardas van **en la entrada**: `textQuery` con nombre + dirección +
 * localidad, `locationRestriction` a ±300 m del lat/lng propio y `maxResultCount: 1`.
 * Si Google devuelve algo, está cerca y matcheó el texto. El body puede llevar
 * `languageCode`/`regionCode` sin costo: el SKU lo fija el field mask, no el body.
 */
export function buildTextSearchBody(input: MatchInput): Record<string, unknown> {
  const textQuery = [input.name, input.address, input.locality].filter(Boolean).join(', ')
  return {
    textQuery,
    locationRestriction: { rectangle: rectanguloAlrededor(input.lat, input.lng, RESTRICTION_METERS) },
    maxResultCount: 1,
    languageCode: 'es',
    regionCode: 'AR',
  }
}

/** Enum de precio de Google → símbolo propio `$..$$$$` (decisión 21). */
export function mapPriceLevel(priceLevel: unknown): string | null {
  switch (priceLevel) {
    case 'PRICE_LEVEL_INEXPENSIVE':
      return '$'
    case 'PRICE_LEVEL_MODERATE':
      return '$$'
    case 'PRICE_LEVEL_EXPENSIVE':
      return '$$$'
    case 'PRICE_LEVEL_VERY_EXPENSIVE':
      return '$$$$'
    // PRICE_LEVEL_FREE / PRICE_LEVEL_UNSPECIFIED / ausente: sin rango que mostrar.
    default:
      return null
  }
}

/** Lo que la ficha usa de la respuesta de Place Details; el resto se ignora. */
type RawOpeningHours = { openNow?: unknown; weekdayDescriptions?: unknown }
type RawPlaceDetails = {
  regularOpeningHours?: RawOpeningHours
  currentOpeningHours?: RawOpeningHours
  rating?: unknown
  userRatingCount?: unknown
  priceLevel?: unknown
  googleMapsUri?: unknown
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

/**
 * Respuesta cruda de Place Details → DTO propio (decisión 11). Puro: se testea con
 * un JSON de ejemplo, sin red. Degrada campo por campo — un lugar sin rating o sin
 * horarios devuelve esos campos en `null`/vacío, nunca rompe.
 */
export function parseDetails(raw: RawPlaceDetails): GoogleEnriquecimiento {
  const cur = raw.currentOpeningHours
  const reg = raw.regularOpeningHours
  const abierto =
    typeof cur?.openNow === 'boolean'
      ? cur.openNow
      : typeof reg?.openNow === 'boolean'
        ? reg.openNow
        : null
  // La semana la da `regularOpeningHours` (horario habitual); `current` cubre
  // feriados y es fallback. Ya vienen como frases en español por el `languageCode`.
  const semana = stringArray(reg?.weekdayDescriptions ?? cur?.weekdayDescriptions)
  const horarios = semana.length > 0 || abierto !== null ? { abierto, semana } : null

  return {
    horarios,
    rating: typeof raw.rating === 'number' ? raw.rating : null,
    userRatingCount: typeof raw.userRatingCount === 'number' ? raw.userRatingCount : null,
    priceLevel: mapPriceLevel(raw.priceLevel),
    googleMapsUri: typeof raw.googleMapsUri === 'string' ? raw.googleMapsUri : null,
  }
}

// ---------------------------------------------------------------------------
// Llamadas a Google (con la key)
// ---------------------------------------------------------------------------

function apiKey(): string | null {
  return process.env.GOOGLE_PLACES_API_KEY?.trim() || null
}

/** `fetch` con el timeout duro de la decisión 20. Aborta y deja seguir la ficha. */
async function fetchConTimeout(url: string, init: RequestInit): Promise<Response | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' })
  } catch {
    // Timeout, red caída o key inválida: se degrada, no se propaga (decisión 20).
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Resuelve el `google_place_id` de un lugar por Text Search IDs-Only (decisión 7).
 * Devuelve el id si Google trae un resultado, `null` si no trae ninguno o si la
 * llamada falla. **Costo cero** (field mask = `places.id`). Sin API key ⇒ `null`.
 */
export async function resolvePlaceId(input: MatchInput): Promise<string | null> {
  const key = apiKey()
  if (!key) return null

  const res = await fetchConTimeout(TEXT_SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': TEXT_SEARCH_FIELD_MASK,
    },
    body: JSON.stringify(buildTextSearchBody(input)),
  })
  if (!res || !res.ok) return null

  const json = (await res.json().catch(() => null)) as { places?: Array<{ id?: unknown }> } | null
  const id = json?.places?.[0]?.id
  return typeof id === 'string' && id.length > 0 ? id : null
}

/**
 * Trae el bloque en vivo de un lugar por Place Details Enterprise (decisión 11).
 * `null` si falla, tarda o no hay key: el endpoint lo traduce a "sin datos" (204) y
 * la ficha muestra el mensaje honesto. La foto es F3 (no se pide acá todavía).
 */
export async function fetchPlaceDetails(placeId: string): Promise<GoogleEnriquecimiento | null> {
  const key = apiKey()
  if (!key) return null

  const url = `${PLACE_DETAILS_BASE}${encodeURIComponent(placeId)}?languageCode=es&regionCode=AR`
  const res = await fetchConTimeout(url, {
    method: 'GET',
    headers: {
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': PLACE_DETAILS_FIELD_MASK,
    },
  })
  if (!res || !res.ok) return null

  const json = (await res.json().catch(() => null)) as RawPlaceDetails | null
  if (!json) return null
  return parseDetails(json)
}
