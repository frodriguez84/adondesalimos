import { getSetting } from '@/lib/db/settings'
import type { DbOrTx } from '@/lib/db'

/**
 * Claves de `app_settings` que gobiernan el chat IA (CHAT_IA, decisiones 3, 5, 6,
 * 15). Editables sin deploy, mismo criterio que el umbral de confidence, los topes
 * de Google y los precios de billing: un UPDATE cambia el modelo, los cupos o el
 * tope global en caliente.
 *
 * Acá viven las claves, sus defaults de semilla y los getters de runtime. Nadie
 * reimplementa la clave en otro lado.
 */

/** Modelo Anthropic vigente (decisión 3). Pasar a Sonnet 5 es un UPDATE. */
export const CHAT_MODEL_KEY = 'ai.chat_model'
/** Cupo base mensual del premium (decisión 5). Los bonus son `chat_quota_grants`. */
export const CHAT_QUOTA_PREMIUM_KEY = 'ai.chat_quota_premium'
/** Probadita free, de por vida (decisión 6). */
export const CHAT_QUOTA_TRIAL_KEY = 'ai.chat_quota_trial'
/** Tope de mensajes globales/mes (decisión 15). 0 = kill switch del SKU. */
export const CHAT_MONTHLY_CAP_KEY = 'ai.chat_monthly_cap'

/**
 * Valores iniciales del seed. Solo fallbacks: la verdad vive en `app_settings`.
 * El modelo nace en Haiku 4.5 (decisión 3), el cupo premium en 30 (IDEAS, "no
 * regalemos"), la probadita en 3 y el tope global holgado en 5.000.
 */
export const DEFAULT_CHAT_MODEL = 'claude-haiku-4-5'
export const DEFAULT_CHAT_QUOTA_PREMIUM = 30
export const DEFAULT_CHAT_QUOTA_TRIAL = 3
export const DEFAULT_CHAT_MONTHLY_CAP = 5000

// ---------------------------------------------------------------------------
// Getters de runtime — se leen en cada request (mismo criterio que
// `getConfidenceThreshold`): un UPDATE en `app_settings` cambia el modelo o los
// cupos sin redeploy. Un setting mal escrito no rompe el chat: cae al default.
// ---------------------------------------------------------------------------

async function getNumber(key: string, fallback: number, database?: DbOrTx): Promise<number> {
  const value = await getSetting<number>(key, database)
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/** El model id que se le pasa al SDK. Si falta o no es string, cae al default. */
export async function getChatModel(database?: DbOrTx): Promise<string> {
  const value = await getSetting<string>(CHAT_MODEL_KEY, database)
  return typeof value === 'string' && value.length > 0 ? value : DEFAULT_CHAT_MODEL
}

/** Cupo base premium del mes. El efectivo suma los grants (ver `lib/ai/cupo.ts`). */
export function getChatQuotaPremium(database?: DbOrTx): Promise<number> {
  return getNumber(CHAT_QUOTA_PREMIUM_KEY, DEFAULT_CHAT_QUOTA_PREMIUM, database)
}

/** Cupo de la probadita free, de por vida. */
export function getChatQuotaTrial(database?: DbOrTx): Promise<number> {
  return getNumber(CHAT_QUOTA_TRIAL_KEY, DEFAULT_CHAT_QUOTA_TRIAL, database)
}

/** Tope de mensajes globales del mes. 0 apaga el SKU (kill switch, decisión 15). */
export function getChatMonthlyCap(database?: DbOrTx): Promise<number> {
  return getNumber(CHAT_MONTHLY_CAP_KEY, DEFAULT_CHAT_MONTHLY_CAP, database)
}
