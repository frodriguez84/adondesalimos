import { getSetting } from '@/lib/db/settings'
import type { DbOrTx } from '@/lib/db'

/**
 * Claves de `app_settings` que gobiernan la curaduría asistida (CURADURIA,
 * decisiones 2 y 4). Editables sin deploy, mismo criterio que el umbral de
 * confidence, los topes de Google y el modelo del chat: un UPDATE cambia la cuota
 * por zona o el modelo del batch en caliente.
 *
 * Acá viven las claves, sus defaults de semilla y los getters de runtime. Nadie
 * reimplementa la clave en otro lado.
 */

/** Cuántos lugares se curan por zona (decisión 2). Ajustable sin deploy. */
export const CURATION_ZONE_QUOTA_KEY = 'curation.zone_quota'
/**
 * Modelo Anthropic del batch (decisión 4). Mismo patrón que `ai.chat_model`: el
 * seed nace en Haiku, pero **manda el runtime** — subir a Sonnet es un UPDATE.
 */
export const CURATION_MODEL_KEY = 'ai.curation_model'

/**
 * Valores iniciales del seed. Solo fallbacks: la verdad vive en `app_settings`.
 * Cuota 40 por zona (decisión 2, universo ≈ 46 × 40 ≈ 1.840); el modelo en Haiku
 * 4.5 (decisión 4, ~US$10-15 la corrida completa).
 */
export const DEFAULT_CURATION_ZONE_QUOTA = 40
export const DEFAULT_CURATION_MODEL = 'claude-haiku-4-5'

// ---------------------------------------------------------------------------
// Getters de runtime — se leen al correr el batch (mismo criterio que
// `getChatModel`): un UPDATE en `app_settings` cambia la cuota o el modelo sin
// redeploy. Un setting mal escrito cae al default.
// ---------------------------------------------------------------------------

/** Cuota de lugares por zona. Si falta o no es un entero > 0, cae al default. */
export async function getCurationZoneQuota(database?: DbOrTx): Promise<number> {
  const value = await getSetting<number>(CURATION_ZONE_QUOTA_KEY, database)
  return typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : DEFAULT_CURATION_ZONE_QUOTA
}

/** El model id que se le pasa al SDK. Si falta o no es string, cae al default. */
export async function getCurationModel(database?: DbOrTx): Promise<string> {
  const value = await getSetting<string>(CURATION_MODEL_KEY, database)
  return typeof value === 'string' && value.length > 0 ? value : DEFAULT_CURATION_MODEL
}
