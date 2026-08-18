import { eq } from 'drizzle-orm'
import { cache } from 'react'
import { db, type DbOrTx } from './index'
import { appSettings } from './schema'
import {
  BAND_LIMITS_KEY,
  CONFIDENCE_THRESHOLD_KEY,
  DEFAULT_BAND_LIMITS,
  DEFAULT_CONFIDENCE_THRESHOLD,
} from './visibility'

/** Lee un setting crudo de `app_settings`. Null si no existe. */
export async function getSetting<T>(key: string, database: DbOrTx = db): Promise<T | null> {
  const [row] = await database
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, key))
    .limit(1)
  return row ? (row.value as T) : null
}

/**
 * Umbral de confidence vigente. Se lee en cada request a propósito: un UPDATE en
 * `app_settings` tiene que cambiar el catálogo publicado sin redeploy, así que
 * no se cachea en módulo.
 *
 * `React.cache` deduplica **dentro de un mismo render/request** —el mismo patrón
 * que `getCadenas` y `getPlaceDetail`, no una caché entre requests—, así que la
 * propiedad de arriba se conserva intacta: el próximo request vuelve a leer.
 *
 * Por qué importa (SEC-01, auditoría de seguridad 2026-08-18): la home llama a
 * `countPlaces` 18 veces (una por chip) y **cada una lee este umbral**, así que
 * la misma fila de `app_settings` se pedía 20 veces por render. Medido con el log
 * de sentencias: 59 sentencias por visita anónima, de las cuales 20 eran ésta.
 */
export const getConfidenceThreshold = cache(async (database?: DbOrTx): Promise<number> => {
  const value = await getSetting<number>(CONFIDENCE_THRESHOLD_KEY, database)
  return typeof value === 'number' ? value : DEFAULT_CONFIDENCE_THRESHOLD
})

/** Cortes en ARS de las bandas de precio ($..$$$$). */
export async function getBandLimits(database: DbOrTx = db): Promise<number[]> {
  const value = await getSetting<number[]>(BAND_LIMITS_KEY, database)
  return Array.isArray(value) ? value : DEFAULT_BAND_LIMITS
}
