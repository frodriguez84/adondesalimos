import { eq } from 'drizzle-orm'
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
 */
export async function getConfidenceThreshold(database: DbOrTx = db): Promise<number> {
  const value = await getSetting<number>(CONFIDENCE_THRESHOLD_KEY, database)
  return typeof value === 'number' ? value : DEFAULT_CONFIDENCE_THRESHOLD
}

/** Cortes en ARS de las bandas de precio ($..$$$$). */
export async function getBandLimits(database: DbOrTx = db): Promise<number[]> {
  const value = await getSetting<number[]>(BAND_LIMITS_KEY, database)
  return Array.isArray(value) ? value : DEFAULT_BAND_LIMITS
}
