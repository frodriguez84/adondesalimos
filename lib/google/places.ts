import {
  DIAS,
  semanaVacia,
  tieneAlgunHorario,
  type HorariosSemana,
} from '@/lib/negocio/horarios'

import type { GoogleEnriquecimiento, GoogleFoto } from './types'

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
/** Base del media endpoint de Place Photos; se le pega el `photo name` completo. */
const PLACE_PHOTO_BASE = 'https://places.googleapis.com/v1/'

/** Ancho pedido de la foto: suficiente para el slot 4:3 de la ficha, sin excederse. */
const PHOTO_MAX_WIDTH = 1200

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
 *
 * `formattedAddress` (CORRECCION_DATOS, decisión 18) es **Essentials** y su costo
 * marginal es **US$0**: la doc de Google dice que una request con campos de varios
 * tiers *"se factura al SKU más alto"*, y este mask ya mezcla tres (photos =
 * Essentials · googleMapsUri = Pro · horarios/rating/priceLevel = Enterprise). Se
 * factura una sola vez a Enterprise, así que sumar un Essentials no mueve el tier.
 * Lo consume **solo el editor de admin**, como pista para corregir la dirección:
 * la ficha pública no lo renderiza y **no se persiste** (decisión 19).
 */
export const PLACE_DETAILS_FIELD_MASK =
  'id,formattedAddress,regularOpeningHours,currentOpeningHours,rating,userRatingCount,priceLevel,googleMapsUri,photos'

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
type RawOpeningHours = { openNow?: unknown; weekdayDescriptions?: unknown; periods?: unknown }
/** Un extremo de un `period` de Google: `{day: 0-6 (0 = domingo), hour, minute}`. */
type RawPeriodPoint = { day?: unknown; hour?: unknown; minute?: unknown }
type RawPeriod = { open?: RawPeriodPoint; close?: RawPeriodPoint }
type RawAuthorAttribution = { displayName?: unknown; uri?: unknown }
type RawPhoto = { name?: unknown; authorAttributions?: unknown }
type RawPlaceDetails = {
  formattedAddress?: unknown
  regularOpeningHours?: RawOpeningHours
  currentOpeningHours?: RawOpeningHours
  rating?: unknown
  userRatingCount?: unknown
  priceLevel?: unknown
  googleMapsUri?: unknown
  photos?: unknown
}

/**
 * La foto que Place Details ofrece, **antes** de resolver la uri efímera (F3). Lleva
 * el `photo name` de Google, que es server-only: nunca se persiste ni se expone al
 * cliente (decisión 15). Vive acá, no en `types.ts`, justamente por eso.
 */
export type FotoCandidata = {
  name: string
  autorNombre: string | null
  autorUri: string | null
}

/**
 * Lo que `fetchPlaceDetails` devuelve de una sola request Enterprise: el DTO en vivo
 * y —aparte— la foto candidata con su `name`. Se separan porque la foto exige un
 * segundo call (el media endpoint) que decide `enrichment` según cuota y foto de
 * dueño; y porque el `name` no debe filtrarse al cliente.
 */
export type DetailsResult = {
  enriquecimiento: GoogleEnriquecimiento
  fotoCandidata: FotoCandidata | null
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

/** Google numera 0 = domingo; `DIAS` arranca en lunes. `null` si no es un día. */
function diaDeGoogle(day: unknown): number | null {
  if (typeof day !== 'number' || !Number.isInteger(day) || day < 0 || day > 6) return null
  return (day + 6) % 7
}

/** Un extremo `{hour, minute}` → `hh:mm`, o `null` si viene fuera de rango. */
function horaDePunto(p: RawPeriodPoint | undefined): string | null {
  if (!p || typeof p !== 'object') return null
  const hora = typeof p.hour === 'number' ? p.hour : null
  const min = typeof p.minute === 'number' ? p.minute : 0
  if (hora === null || !Number.isInteger(hora) || hora < 0 || hora > 23) return null
  if (!Number.isInteger(min) || min < 0 || min > 59) return null
  return `${String(hora).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

/**
 * Los `periods` de Google → la `HorariosSemana` propia (PBETA-R1-07). **Es dato que
 * ya llega**: `regularOpeningHours` está en el field mask desde F2 y trae `periods`
 * junto con `weekdayDescriptions`, así que esto no agrega ni una request ni un campo
 * al mask (que es la línea entre $0 y la factura, decisión 11).
 *
 * Traducir a la estructura propia —en vez de parsear las frases de Google— es lo que
 * permite reusar `lib/negocio/horarios.ts`, que ya es dueño de "¿abre?" y "¿qué día
 * es hoy en AR?", en lugar de escribir una segunda regla horaria contra un texto
 * localizado.
 *
 * **Todo o nada**: cualquier `period` que el modelo propio no representa (un día
 * abierto 24 h viene **sin `close`**; un rango que cierra dos días después) devuelve
 * `null` y la ficha cae a las frases de Google, que esos casos sí los dicen bien. Es
 * degradación honesta: media semana traducida sería peor que ninguna.
 */
export function parseSemanaDePeriodos(raw: RawOpeningHours | undefined): HorariosSemana | null {
  const periods = raw?.periods
  if (!Array.isArray(periods) || periods.length === 0) return null

  const semana = semanaVacia()
  for (const p of periods as RawPeriod[]) {
    if (!p || typeof p !== 'object' || !p.open || !p.close) return null

    const dia = diaDeGoogle(p.open.day)
    const abre = horaDePunto(p.open)
    const cierra = horaDePunto(p.close)
    if (dia === null || abre === null || cierra === null) return null
    // `abre === cierra` es la otra forma de decir "24 h": el modelo propio lo lee
    // como rango vacío (`estaAbierto` no lo abre nunca), así que tampoco se traduce.
    if (abre === cierra) return null

    // Un rango pertenece al día en que abre y cierra, como mucho, la madrugada
    // siguiente (`20:00–02:00`). Si cierra más allá, no entra en el modelo.
    const diaCierre = diaDeGoogle(p.close.day)
    if (diaCierre !== null && diaCierre !== dia && diaCierre !== (dia + 1) % 7) return null

    semana[DIAS[dia]].push({ abre, cierra })
  }

  return tieneAlgunHorario(semana) ? semana : null
}

/**
 * Respuesta cruda de Place Details → DTO propio (decisión 11). Puro: se testea con
 * un JSON de ejemplo, sin red. Degrada campo por campo — un lugar sin rating o sin
 * horarios devuelve esos campos en `null`/vacío, nunca rompe. La foto queda en
 * `null`: la resuelve `enrichment` con un call aparte (ver `parseFotoCandidata`).
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
  // La semana estructurada sale de los **mismos** `periods` que ya viajan en la
  // respuesta: habitual primero (es lo que promete "Ver horarios de la semana") y
  // `current` de respaldo, el mismo orden que las frases de arriba.
  const dias = parseSemanaDePeriodos(reg) ?? parseSemanaDePeriodos(cur)
  const horarios =
    semana.length > 0 || dias !== null || abierto !== null ? { abierto, semana, dias } : null

  return {
    horarios,
    // La dirección que Google tiene: **pista, no fuente** (decisión 19). No se
    // persiste ni se muestra en la ficha pública.
    formattedAddress: typeof raw.formattedAddress === 'string' ? raw.formattedAddress : null,
    rating: typeof raw.rating === 'number' ? raw.rating : null,
    userRatingCount: typeof raw.userRatingCount === 'number' ? raw.userRatingCount : null,
    priceLevel: mapPriceLevel(raw.priceLevel),
    googleMapsUri: typeof raw.googleMapsUri === 'string' ? raw.googleMapsUri : null,
    foto: null,
  }
}

/**
 * De la respuesta de Details saca **la primera** foto y su crédito (decisión 14: una
 * sola foto por ficha). Puro. `null` si el lugar no trae fotos. El `name` que
 * devuelve es el que consume el media endpoint; no sale de acá hacia el cliente.
 */
export function parseFotoCandidata(raw: RawPlaceDetails): FotoCandidata | null {
  const photos = raw.photos
  if (!Array.isArray(photos) || photos.length === 0) return null
  const first = photos[0] as RawPhoto | undefined
  if (!first || typeof first.name !== 'string' || first.name.length === 0) return null
  const attrs = first.authorAttributions
  const attr = (Array.isArray(attrs) ? attrs[0] : undefined) as RawAuthorAttribution | undefined
  return {
    name: first.name,
    autorNombre: typeof attr?.displayName === 'string' ? attr.displayName : null,
    autorUri: typeof attr?.uri === 'string' ? attr.uri : null,
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
 * Una sola request paga por ficha: de ella salen tanto el DTO como la foto candidata
 * (su `name` viene gratis en el mismo `photos` del field mask). `null` si falla,
 * tarda o no hay key: el endpoint lo traduce a "sin datos" (204) y la ficha muestra
 * el mensaje honesto. La uri de la foto se resuelve aparte con `fetchFotoUri`.
 */
export async function fetchPlaceDetails(placeId: string): Promise<DetailsResult | null> {
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
  return { enriquecimiento: parseDetails(json), fotoCandidata: parseFotoCandidata(json) }
}

/**
 * Resuelve la uri efímera de una foto de Google por el media endpoint (F3,
 * decisiones 14 y 15). Con `skipHttpRedirect=true` Google devuelve un JSON con el
 * `photoUri` de `googleusercontent` en vez de redirigir a los bytes: así la API key
 * **nunca** llega al browser (la pide el server) y no hace falta un proxy de
 * imágenes propio. Cada llamada es **un evento facturable** del SKU Photos, el mayor
 * multiplicador de costo de la app — por eso `enrichment` la protege con cuota y solo
 * la dispara si no hay foto de dueño. `null` si falla o no hay key: la ficha degrada.
 */
export async function fetchFotoUri(candidata: FotoCandidata): Promise<GoogleFoto | null> {
  const key = apiKey()
  if (!key) return null

  // El `name` (`places/.../photos/...`) son segmentos de ruta: se pega tal cual, sin
  // encodear las barras. Viene de la respuesta de Google, no del usuario.
  const url =
    `${PLACE_PHOTO_BASE}${candidata.name}/media` +
    `?maxWidthPx=${PHOTO_MAX_WIDTH}&skipHttpRedirect=true`
  const res = await fetchConTimeout(url, {
    method: 'GET',
    headers: { 'X-Goog-Api-Key': key },
  })
  if (!res || !res.ok) return null

  const json = (await res.json().catch(() => null)) as { photoUri?: unknown } | null
  const uri = json?.photoUri
  if (typeof uri !== 'string' || uri.length === 0) return null

  return { uri, autorNombre: candidata.autorNombre, autorUri: candidata.autorUri }
}
