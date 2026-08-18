import type { GoogleMatchStatus } from '@/lib/db/schema'
import type { GoogleEnriquecimiento, GoogleFoto, GoogleSku } from '@/lib/google/types'
import type { DetailsResult, FotoCandidata, MatchInput } from '@/lib/google/places'

/**
 * Orquestación del enriquecimiento en vivo (FICHA, § Camino de la request). **Pura
 * e inyectable**: recibe el lugar y las funciones que hablan con Google/DB como
 * dependencias, así todo el camino del gasto —estados de match, reintento, tope de
 * cuota— se testea sin red ni base. El route (`app/api/lugar/[id]/google`) es un
 * adaptador fino que le pasa las implementaciones reales y traduce el resultado a
 * una `Response`. Mismo patrón que `consumirCupo` (puro) vs `checkSearchRateLimit`.
 *
 * La regla de oro (decisión 23): **ningún camino sin datos llama a Google**. Cada
 * `{ status: 204 }` de abajo es un evento pago que no se disparó.
 */

/** Lo que el enriquecimiento necesita del lugar (lo llena `getPlaceForEnrichment`). */
export type PlaceEnrichment = {
  id: string
  name: string
  address: string | null
  locality: string | null
  lat: number
  lng: number
  googlePlaceId: string | null
  googleMatchStatus: GoogleMatchStatus
  googleMatchedAt: Date | null
  /** ¿El lugar ya tiene fotos de dueño? Si sí, NO se pide foto a Google (dec. 3). */
  tieneFotoDueno: boolean
}

/** `204` = no hay enriquecimiento (el cliente no distingue falla de ausencia). */
export type ResultadoEnriquecimiento =
  | { status: 204 }
  | { status: 200; data: GoogleEnriquecimiento }

const SIN_DATOS: ResultadoEnriquecimiento = { status: 204 }

/**
 * ¿Estamos dentro de la ventana en la que un `not_found` NO se reintenta? Puro.
 * Sin fecha de intento, se permite intentar (no debería pasar para `not_found`,
 * pero ante la duda se resuelve una vez, no se bloquea para siempre).
 */
export function dentroDeVentanaReintento(
  matchedAt: Date | null,
  retryDays: number,
  ahora: Date,
): boolean {
  if (!matchedAt) return false
  const dias = (ahora.getTime() - matchedAt.getTime()) / 86_400_000
  return dias < retryDays
}

/** Qué hacer con el `google_place_id` según el estado del match (decisión 10). */
export type PlanMatching = 'resolver' | 'usar-existente' | 'sin-datos'

export function planDeMatching(input: {
  status: GoogleMatchStatus
  googlePlaceId: string | null
  matchedAt: Date | null
  retryDays: number
  ahora: Date
}): PlanMatching {
  switch (input.status) {
    // `blocked`: match malo o no está en Google. No reintentar nunca.
    case 'blocked':
      return 'sin-datos'
    // `manual`: lo fijó un humano. El resolver NUNCA lo pisa; se usa tal cual.
    case 'manual':
      return input.googlePlaceId ? 'usar-existente' : 'sin-datos'
    // `matched`: ya resuelto. Sin id (no debería pasar) se intenta resolver.
    case 'matched':
      return input.googlePlaceId ? 'usar-existente' : 'resolver'
    // `not_found`: reintenta recién pasada la ventana de `match_retry_days`.
    case 'not_found':
      return dentroDeVentanaReintento(input.matchedAt, input.retryDays, input.ahora)
        ? 'sin-datos'
        : 'resolver'
    // `pending`: nunca se intentó. Se resuelve la primera vez que se abre la ficha.
    case 'pending':
    default:
      return 'resolver'
  }
}

/** Dependencias inyectadas: las reales viven en `places.ts`/`usage.ts`/`matching.ts`. */
export type EnrichmentDeps = {
  place: PlaceEnrichment
  retryDays: number
  detailsCap: number
  photosCap: number
  ahora: Date
  resolvePlaceId: (input: MatchInput) => Promise<string | null>
  fetchDetails: (placeId: string) => Promise<DetailsResult | null>
  fetchFoto: (candidata: FotoCandidata) => Promise<GoogleFoto | null>
  /** Mira el cupo y lo consume en una sola operación (`SEC-15`). `false` ⇒ sin cuota. */
  reservarUso: (sku: GoogleSku, tope: number) => Promise<boolean>
  persistMatch: (id: string, googlePlaceId: string) => Promise<void>
  persistNotFound: (id: string) => Promise<void>
}

export async function resolverEnriquecimiento(
  deps: EnrichmentDeps,
): Promise<ResultadoEnriquecimiento> {
  const { place } = deps

  const plan = planDeMatching({
    status: place.googleMatchStatus,
    googlePlaceId: place.googlePlaceId,
    matchedAt: place.googleMatchedAt,
    retryDays: deps.retryDays,
    ahora: deps.ahora,
  })

  if (plan === 'sin-datos') return SIN_DATOS

  let placeId = place.googlePlaceId
  if (plan === 'resolver') {
    // Text Search IDs-Only: $0, no cuenta contra ningún tope.
    const nuevo = await deps.resolvePlaceId({
      name: place.name,
      address: place.address,
      locality: place.locality,
      lat: place.lat,
      lng: place.lng,
    })
    if (!nuevo) {
      await deps.persistNotFound(place.id)
      return SIN_DATOS
    }
    await deps.persistMatch(place.id, nuevo)
    placeId = nuevo
  }

  // Defensa: 'usar-existente' garantiza id, pero un `matched` sin id que cayó en
  // 'resolver' y no encontró ya salió arriba. Este chequeo cierra el tipo.
  if (!placeId) return SIN_DATOS

  // Tope de Place Details (decisión 19): superado ⇒ 204 **sin llamar**. Bajar el
  // tope a 0 en `app_settings` apaga el enriquecimiento sin redeploy.
  //
  // Mirar el cupo y consumirlo es UNA operación (`SEC-15`): en dos pasos, N
  // requests concurrentes leen el mismo valor bajo el tope y pasan todas. Y se
  // reserva ANTES de llamar (decisión 19): una request que Google ya recibió
  // puede facturarse aunque después falle.
  if (!(await deps.reservarUso('details', deps.detailsCap))) return SIN_DATOS

  const detalle = await deps.fetchDetails(placeId)
  if (!detalle) return SIN_DATOS // timeout, red caída o key inválida (decisión 20).

  const foto = await resolverFoto(deps, detalle.fotoCandidata)
  const data: GoogleEnriquecimiento = foto
    ? { ...detalle.enriquecimiento, foto }
    : detalle.enriquecimiento

  return { status: 200, data }
}

/**
 * Paso de foto de Google (F3, decisiones 3, 14 y 19). El más caro de la app: cada
 * media call es un evento del SKU Photos ($7/1.000, solo 1.000 gratis). Por eso:
 * - **Foto de dueño presente ⇒ ni se mira Google** (dec. 3): el contador `photos`
 *   no se mueve y no hay request (FICHA-10).
 * - Sin candidata (el lugar no tiene fotos en Google) ⇒ nada que pedir.
 * - **Tope de `photos` superado ⇒ sin foto** (dec. 19), la ficha sigue con el resto.
 * - Se cuenta ANTES del media call, mismo criterio que Details.
 * `null` en cualquier corte: la ficha degrada sin foto, nunca rompe.
 */
async function resolverFoto(
  deps: EnrichmentDeps,
  candidata: FotoCandidata | null,
): Promise<GoogleFoto | null> {
  if (deps.place.tieneFotoDueno) return null
  if (!candidata) return null

  if (!(await deps.reservarUso('photos', deps.photosCap))) return null
  return deps.fetchFoto(candidata)
}
