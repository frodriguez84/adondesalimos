import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { getConfidenceThreshold } from '@/lib/db/settings'
import { places } from '@/lib/db/schema'
import { isPlacePublished } from '@/lib/db/visibility'
import type { GoogleMatchStatus } from '@/lib/db/schema'
import type { PlaceEnrichment } from './enrichment'

/**
 * Capa de datos del matching Overture↔Google (FICHA, F2). Lee lo que el endpoint
 * necesita para decidir si enriquecer y persiste el resultado del resolver. La
 * lógica de qué hacer con esos datos es pura y vive en `enrichment.ts`; acá solo
 * está el acceso a la base.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * El lugar con lo justo para el enriquecimiento —datos del resolver y estado del
 * match— **revalidando la visibilidad** (decisión 23: no se gasta en Google para
 * un lugar oculto o inexistente, ni siquiera si el cliente pega directo al
 * endpoint). `null` ⇒ el endpoint responde 404 sin tocar Google.
 *
 * Es una query aparte de `getPlaceDetail`: esta trae el estado del match y no
 * necesita tags, zona ni fotos. La visibilidad se resuelve con el mismo helper de
 * CATALOGO, para no reimplementar la regla.
 */
export async function getPlaceForEnrichment(id: string): Promise<PlaceEnrichment | null> {
  if (!UUID_RE.test(id)) return null

  const [place] = await db
    .select({
      id: places.id,
      name: places.name,
      address: places.address,
      locality: places.locality,
      lat: places.lat,
      lng: places.lng,
      googlePlaceId: places.googlePlaceId,
      googleMatchStatus: places.googleMatchStatus,
      googleMatchedAt: places.googleMatchedAt,
      confidence: places.confidence,
      operatingStatus: places.operatingStatus,
      publishOverride: places.publishOverride,
    })
    .from(places)
    .where(eq(places.id, id))
    .limit(1)

  if (!place) return null

  const umbral = await getConfidenceThreshold()
  const publicado = isPlacePublished(
    {
      operatingStatus: place.operatingStatus,
      confidence: place.confidence,
      publishOverride: place.publishOverride,
    },
    umbral,
  )
  if (!publicado) return null

  return {
    id: place.id,
    name: place.name,
    address: place.address,
    locality: place.locality,
    lat: place.lat,
    lng: place.lng,
    googlePlaceId: place.googlePlaceId,
    googleMatchStatus: place.googleMatchStatus,
    googleMatchedAt: place.googleMatchedAt,
  }
}

/**
 * Persiste un match encontrado por el resolver (decisión 10): `google_place_id` +
 * status `matched` + timestamp. La próxima apertura de la ficha ya no llama a Text
 * Search. Nunca pisa un `manual` — el endpoint no llega acá para esos.
 */
export async function persistirMatchEncontrado(
  id: string,
  googlePlaceId: string,
): Promise<void> {
  await db
    .update(places)
    .set({ googlePlaceId, googleMatchStatus: 'matched', googleMatchedAt: sql`now()` })
    .where(eq(places.id, id))
}

/**
 * Marca `not_found` con la fecha del intento (decisión 10): base del reintento a
 * `google.match_retry_days`. Hasta entonces la ficha no vuelve a gastar en el
 * resolver de ese lugar.
 */
export async function persistirNoEncontrado(id: string): Promise<void> {
  await db
    .update(places)
    .set({ googleMatchStatus: 'not_found', googleMatchedAt: sql`now()` })
    .where(eq(places.id, id))
}

export type { GoogleMatchStatus }
