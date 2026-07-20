/**
 * Claves de `app_settings` que gobiernan el enriquecimiento en vivo de Google
 * (FICHA, decisiones 10 y 19). Editables sin deploy: bajar un tope a 0 apaga el
 * SKU correspondiente y la ficha degrada al modo sin Google, sin romperse.
 *
 * Acá viven solo las claves y sus defaults de semilla. Los getters que las leen
 * en runtime y la lógica de cuotas son del enriquecimiento en vivo (F2), que se
 * apoya sobre estas constantes — no se reimplementan las claves en otro lado.
 */

/** Tope mensual de Place Details (SKU pago). Superado ⇒ ficha sin bloque Google. */
export const DETAILS_MONTHLY_CAP_KEY = 'google.details_monthly_cap'
/** Tope mensual de Place Photos (SKU pago). Independiente de details. */
export const PHOTOS_MONTHLY_CAP_KEY = 'google.photos_monthly_cap'
/** Días antes de reintentar un match `not_found` (decisión 10). */
export const MATCH_RETRY_DAYS_KEY = 'google.match_retry_days'

/**
 * Valores iniciales del seed. Solo fallbacks: la verdad vive en `app_settings`,
 * que un UPDATE cambia en caliente. Los topes nacen en 5.000 —holgados sobre las
 * ~3.000 fichas/mes esperadas— para que el gate proteja de un pico, no del uso
 * normal (decisión 19).
 */
export const DEFAULT_DETAILS_MONTHLY_CAP = 5000
export const DEFAULT_PHOTOS_MONTHLY_CAP = 5000
export const DEFAULT_MATCH_RETRY_DAYS = 30

// ---------------------------------------------------------------------------
// Getters de runtime (F2)
// ---------------------------------------------------------------------------
//
// Se leen en cada request a propósito (mismo criterio que `getConfidenceThreshold`
// de CATALOGO): un UPDATE en `app_settings` tiene que apagar un SKU o cambiar el
// reintento **sin redeploy**. No se cachean en módulo. Si la clave no existe o no
// es un número, se cae al default del seed — nunca se rompe la ficha por un setting
// mal escrito.

import { getSetting } from '@/lib/db/settings'
import type { DbOrTx } from '@/lib/db'

async function getNumber(key: string, fallback: number, database?: DbOrTx): Promise<number> {
  const value = await getSetting<number>(key, database)
  return typeof value === 'number' ? value : fallback
}

/** Tope mensual de Place Details vigente. Superado ⇒ ficha sin bloque Google. */
export function getDetailsMonthlyCap(database?: DbOrTx): Promise<number> {
  return getNumber(DETAILS_MONTHLY_CAP_KEY, DEFAULT_DETAILS_MONTHLY_CAP, database)
}

/** Tope mensual de Place Photos vigente (F3). Independiente de details. */
export function getPhotosMonthlyCap(database?: DbOrTx): Promise<number> {
  return getNumber(PHOTOS_MONTHLY_CAP_KEY, DEFAULT_PHOTOS_MONTHLY_CAP, database)
}

/** Días antes de reintentar un match `not_found` (decisión 10). */
export function getMatchRetryDays(database?: DbOrTx): Promise<number> {
  return getNumber(MATCH_RETRY_DAYS_KEY, DEFAULT_MATCH_RETRY_DAYS, database)
}
