import { sql } from 'drizzle-orm'
import { db, type DbOrTx } from '@/lib/db'
import { appSettings, appSettingsHistory } from '@/lib/db/schema'
import { getSetting } from '@/lib/db/settings'

/**
 * Precios de los planes, en `app_settings` y editables desde `/admin` desde el
 * día 1 (MONETIZACION, decisión 5). Ni env var ni hardcode: los costos son en USD
 * y los precios en ARS, así que un monto que no se puede ajustar sin deploy se
 * licúa en meses (riesgo estructural). Se leen en cada request, mismo criterio que
 * `getConfidenceThreshold` de CATALOGO.
 *
 * Acá viven las claves, sus defaults de semilla, los getters de runtime y el
 * write con historial que consume `/admin`. Un solo módulo para el precio — nadie
 * reimplementa la clave ni la escritura en otro lado.
 */

/** Suscripción B2B mensual, **por lugar** (decisión 1). */
export const PRECIO_B2B_ARS_KEY = 'billing.precio_b2b_ars'
/** Premium B2C mensual (decisión 1). */
export const PRECIO_B2C_ARS_KEY = 'billing.precio_b2c_ars'

/** Valores de lanzamiento (decisión 1). Solo fallbacks: la verdad vive en DB. */
export const DEFAULT_PRECIO_B2B_ARS = 15000
export const DEFAULT_PRECIO_B2C_ARS = 7000

/**
 * Las únicas claves que `/admin` puede editar en F1 (decisión 26). El PATCH las
 * usa como allowlist: cualquier otra clave se rechaza en el borde — el historial
 * es genérico, pero el endpoint no es un editor libre de `app_settings`.
 */
export const CLAVES_PRECIO_EDITABLES = [PRECIO_B2B_ARS_KEY, PRECIO_B2C_ARS_KEY] as const

export type ClavePrecioEditable = (typeof CLAVES_PRECIO_EDITABLES)[number]

export function esClavePrecioEditable(key: string): key is ClavePrecioEditable {
  return (CLAVES_PRECIO_EDITABLES as readonly string[]).includes(key)
}

async function getPrecio(key: string, fallback: number, database?: DbOrTx): Promise<number> {
  const value = await getSetting<number>(key, database)
  // Un setting mal escrito no puede tumbar el checkout: cae al default de semilla.
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
}

/** Precio B2B vigente (por lugar). Superado por el `amount_ars` congelado de una sub viva. */
export function getPrecioB2bArs(database?: DbOrTx): Promise<number> {
  return getPrecio(PRECIO_B2B_ARS_KEY, DEFAULT_PRECIO_B2B_ARS, database)
}

/** Precio B2C (premium) vigente. */
export function getPrecioB2cArs(database?: DbOrTx): Promise<number> {
  return getPrecio(PRECIO_B2C_ARS_KEY, DEFAULT_PRECIO_B2C_ARS, database)
}

export type PrecioActual = { key: ClavePrecioEditable; label: string; value: number }

const LABEL_PRECIO: Record<ClavePrecioEditable, string> = {
  [PRECIO_B2B_ARS_KEY]: 'Suscripción B2B (por lugar)',
  [PRECIO_B2C_ARS_KEY]: 'Premium B2C',
}

/** Los precios vigentes para pintar el panel de `/admin` (decisión 26). */
export async function getPreciosActuales(): Promise<PrecioActual[]> {
  const [b2b, b2c] = await Promise.all([getPrecioB2bArs(), getPrecioB2cArs()])
  return [
    { key: PRECIO_B2B_ARS_KEY, label: LABEL_PRECIO[PRECIO_B2B_ARS_KEY], value: b2b },
    { key: PRECIO_B2C_ARS_KEY, label: LABEL_PRECIO[PRECIO_B2C_ARS_KEY], value: b2c },
  ]
}

export type CambioPrecio = {
  key: string
  value: number
  changedBy: string
  changedAt: Date
}

/**
 * Historial de cambios de precios para el panel (decisión 25). Solo las claves de
 * billing; el resto de `app_settings_history` es de otras features.
 */
export async function getHistorialPrecios(limite = 50): Promise<CambioPrecio[]> {
  const filas = await db
    .select({
      key: appSettingsHistory.key,
      value: appSettingsHistory.value,
      changedBy: appSettingsHistory.changedBy,
      changedAt: appSettingsHistory.changedAt,
    })
    .from(appSettingsHistory)
    .where(sql`${appSettingsHistory.key} IN ${[...CLAVES_PRECIO_EDITABLES]}`)
    .orderBy(sql`${appSettingsHistory.changedAt} DESC`)
    .limit(limite)

  return filas.map((f) => ({
    key: f.key,
    value: Number(f.value),
    changedBy: f.changedBy,
    changedAt: f.changedAt,
  }))
}

export type ResultadoEdicion =
  | { ok: true }
  | { ok: false; code: 'INVALID_KEY' | 'INVALID_VALUE'; message: string }

/**
 * Edita un precio y registra el cambio (decisiones 25-26), en una transacción: el
 * `app_settings` nuevo y la fila de historial entran juntos o no entra ninguno.
 *
 * Valida en el borde: solo claves de la allowlist y solo enteros positivos (un
 * precio en ARS no tiene centavos ni es negativo). No pisa las suscripciones
 * vivas — su `amount_ars` está congelado (decisión 25); esto solo rige altas nuevas.
 */
export async function editarPrecio(
  key: string,
  value: unknown,
  changedBy: string,
): Promise<ResultadoEdicion> {
  if (!esClavePrecioEditable(key)) {
    return { ok: false, code: 'INVALID_KEY', message: 'No se puede editar esa configuración.' }
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    return { ok: false, code: 'INVALID_VALUE', message: 'El precio tiene que ser un entero mayor a 0.' }
  }

  await db.transaction(async (tx) => {
    await tx
      .insert(appSettings)
      .values({ key, value })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: sql`excluded.value`, updatedAt: sql`now()` },
      })
    await tx.insert(appSettingsHistory).values({ key, value, changedBy })
  })

  return { ok: true }
}
