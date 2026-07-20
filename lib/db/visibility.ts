import { and, eq, gte, or, sql, type SQL } from 'drizzle-orm'
import { places } from './schema'

/**
 * Regla de visibilidad del catálogo — fuente única.
 *
 *   publicado ⇔ operating_status = 'open'
 *             AND (confidence >= umbral OR publish_override = true)
 *
 * Búsqueda, ficha y admin consumen esto tal cual: no reimplementar la regla en
 * cada query. El umbral NO está hardcodeado — se lee de `app_settings` en
 * runtime (ver `getConfidenceThreshold`), así un UPDATE cambia el catálogo
 * publicado sin redeploy.
 *
 * Nota: los lugares con `source='owner'` tienen confidence null, así que su
 * único camino a publicado es `publish_override = true` — la aprobación manual
 * del reclamo es la señal.
 */

export const CONFIDENCE_THRESHOLD_KEY = 'catalog.confidence_threshold'
export const BAND_LIMITS_KEY = 'pricing.band_limits'

/** Valor inicial del seed. Solo un fallback: la verdad vive en `app_settings`. */
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.5

/** Los cortes de $..$$$$ en ARS, también editables desde admin. */
export const DEFAULT_BAND_LIMITS = [15000, 30000, 60000]

/** Lo mínimo que hace falta para decidir visibilidad. */
export type VisibilityInput = {
  operatingStatus: string
  confidence: number | null
  publishOverride: boolean
}

/** Predicado en memoria. Misma regla que `publishedWhere`, para un solo lugar. */
export function isPlacePublished(place: VisibilityInput, threshold: number): boolean {
  // operating_status manda siempre: un lugar cerrado no se publica ni con
  // confidence 0.9 ni con override.
  if (place.operatingStatus !== 'open') return false
  if (place.publishOverride) return true
  return place.confidence !== null && place.confidence >= threshold
}

/** La misma regla como condición SQL, para filtrar en la query. */
export function publishedWhere(threshold: number): SQL {
  return and(
    eq(places.operatingStatus, 'open'),
    or(gte(places.confidence, threshold), eq(places.publishOverride, true)),
  )!
}

/** Idem, como fragmento SQL crudo (para queries que no usan el query builder). */
export function publishedSql(threshold: number): SQL {
  return sql`${places.operatingStatus} = 'open' AND (${places.confidence} >= ${threshold} OR ${places.publishOverride} = true)`
}
