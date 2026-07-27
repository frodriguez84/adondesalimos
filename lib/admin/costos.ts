import { and, eq, isNotNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { aiApiUsage, chatMessages, googleApiUsage } from '@/lib/db/schema'
import type { GoogleSku } from '@/lib/google/types'
import { calcularCostoUsd } from '@/lib/ai/logging'
import { getDetailsMonthlyCap, getPhotosMonthlyCap } from '@/lib/google/settings'
import { getChatMonthlyCap } from '@/lib/ai/settings'
import { getPrecioB2cArs } from '@/lib/billing/settings'

/**
 * Agregados del tablero de costos de `/admin` (COSTOS_ADMIN, decisión 12).
 * Server-only, **read-only**: lee lo que ya cuentan `chat_messages`,
 * `google_api_usage` y `ai_api_usage`, y presenta. No toca ningún candado de costo
 * (field masks, `no-store`, topes, motores) — eso es explícito fuera de scope.
 *
 * Los precios de Anthropic viven en `lib/ai/logging.ts` (fuente única, decisión 2);
 * los de Google van acá como constantes con su fuente (decisión 5). El corte
 * mensual lo pone Postgres (mismo criterio que `lib/google/usage.ts` y
 * `lib/ai/cupo.ts`): un solo reloj parte el mes.
 */

// El mes calendario corriente y el anterior. Dos formatos según la tabla:
// `chat_messages` corta por `created_at` (timestamp) con el molde de
// `lib/negocio/query.ts:344`; `google_api_usage`/`ai_api_usage` guardan `month`
// como texto `YYYY-MM` (patrón `lib/google/usage.ts`).
const MES_ACTUAL = sql`date_trunc('month', current_date)`
const MES_ANTERIOR = sql`date_trunc('month', current_date) - interval '1 month'`
const MES_TXT = sql`to_char(current_date, 'YYYY-MM')`
const MES_PREV_TXT = sql`to_char(current_date - interval '1 month', 'YYYY-MM')`

// ---------------------------------------------------------------------------
// Costos Google — precios de FICHA (decisiones 11 y 14): Place Details
// Enterprise $20/1.000, Place Photos $7/1.000, ambos con 1.000 gratis/mes.
// Cuenta verificada contra FICHA: 3.000 fichas ⇒ $40 + $14 = $54/mes.
// ---------------------------------------------------------------------------
const PRECIO_GOOGLE_POR_1000: Record<GoogleSku, number> = {
  details: 20,
  photos: 7,
}
const GOOGLE_TIER_GRATIS = 1000

const LABEL_SKU: Record<GoogleSku, string> = {
  details: 'Place Details',
  photos: 'Place Photos',
}

/** Umbrales de alerta (decisión 6): amarillo ≥80%, rojo ≥100%, cap 0 = apagado. */
export type EstadoAlerta = 'apagado' | 'ok' | 'amarillo' | 'rojo'

// =====================  Helpers puros (con tests)  =========================

/**
 * Costo estimado en USD de un SKU de Google descontando el tier gratis
 * (decisión 5): `max(0, count − gratis) × precio/1.000`. Con `count ≤ gratis` ⇒ $0.
 */
export function costoGoogleUsd(count: number, precioPor1000: number, gratis = GOOGLE_TIER_GRATIS): number {
  return (Math.max(0, count - gratis) * precioPor1000) / 1000
}

/** Porcentaje del cap consumido. Cap ≤ 0 ⇒ 0 (el estado "apagado" se decide aparte). */
export function porcentajeCap(count: number, cap: number): number {
  return cap <= 0 ? 0 : (count / cap) * 100
}

/**
 * Estado de alerta de un contador vs su cap (decisión 6). Cap 0 = SKU apagado a
 * mano (sin alerta); si no, ≥100% rojo, ≥80% amarillo, resto ok.
 */
export function estadoAlerta(count: number, cap: number): EstadoAlerta {
  if (cap <= 0) return 'apagado'
  const pct = porcentajeCap(count, cap)
  if (pct >= 100) return 'rojo'
  if (pct >= 80) return 'amarillo'
  return 'ok'
}

/** Piso en ARS de la regla operable (doc de costos § regla): `dólar_oficial × 3`. */
export function pisoArs(dolar: number): number {
  return dolar * 3
}

/** El piso redondeado al millar hacia arriba: el número que se muestra como sugerido. */
export function precioSugerido(piso: number): number {
  return Math.ceil(piso / 1000) * 1000
}

export type EvaluacionPiso = {
  piso: number
  /** ¿El precio vigente cubre el piso? */
  cubre: boolean
  /** Precio sugerido (piso redondeado al millar) cuando NO cubre; `null` si cubre. */
  sugerido: number | null
  /** Cuántas veces el piso cubre el precio (ej. 1,5×); `null` si el piso es 0. */
  margen: number | null
}

/**
 * Evalúa la regla de piso (decisión 10): `piso = dólar × 3`. Si el precio vigente
 * quedó por debajo, devuelve el sugerido (redondeado al millar hacia arriba); si
 * cubre, el margen para la línea verde. **Evalúa, no aplica** — el cambio de precio
 * sigue siendo manual en la sección Precios.
 */
export function evaluarPiso(precioActual: number, dolar: number): EvaluacionPiso {
  const piso = pisoArs(dolar)
  const cubre = precioActual >= piso
  return {
    piso,
    cubre,
    sugerido: cubre ? null : precioSugerido(piso),
    margen: piso > 0 ? precioActual / piso : null,
  }
}

// =====================  Bloque 1 — Costo del chat  =========================

export type CostoModelo = {
  model: string
  esteMes: { tokensIn: number; tokensOut: number; costoUsd: number }
  mesAnterior: { tokensIn: number; tokensOut: number; costoUsd: number }
}

export type CostosChat = {
  porModelo: CostoModelo[]
  totalMesUsd: number
  totalPrevUsd: number
}

/**
 * Costo del chat en USD por modelo, mes actual y anterior (decisión 3). Σ sobre
 * `chat_messages` con `model_used IS NOT NULL` (filas assistant), NUNCA sobre
 * `ai_api_usage` (que cuenta requests). Los tokens se suman en SQL con el molde
 * `filter (where ...)` de `lib/negocio/query.ts`; el costo se deriva en JS con
 * `calcularCostoUsd` (fuente única de precios).
 */
export async function getCostosChat(): Promise<CostosChat> {
  const filas = await db
    .select({
      model: chatMessages.modelUsed,
      inMes: sql<number>`coalesce(sum(${chatMessages.tokensIn}) filter (where ${chatMessages.createdAt} >= ${MES_ACTUAL}), 0)::int`,
      outMes: sql<number>`coalesce(sum(${chatMessages.tokensOut}) filter (where ${chatMessages.createdAt} >= ${MES_ACTUAL}), 0)::int`,
      inPrev: sql<number>`coalesce(sum(${chatMessages.tokensIn}) filter (where ${chatMessages.createdAt} >= ${MES_ANTERIOR} and ${chatMessages.createdAt} < ${MES_ACTUAL}), 0)::int`,
      outPrev: sql<number>`coalesce(sum(${chatMessages.tokensOut}) filter (where ${chatMessages.createdAt} >= ${MES_ANTERIOR} and ${chatMessages.createdAt} < ${MES_ACTUAL}), 0)::int`,
    })
    .from(chatMessages)
    .where(and(isNotNull(chatMessages.modelUsed), sql`${chatMessages.createdAt} >= ${MES_ANTERIOR}`))
    .groupBy(chatMessages.modelUsed)

  const porModelo: CostoModelo[] = filas.map((f) => {
    const model = f.model ?? 'desconocido'
    return {
      model,
      esteMes: {
        tokensIn: f.inMes,
        tokensOut: f.outMes,
        costoUsd: calcularCostoUsd(model, f.inMes, f.outMes),
      },
      mesAnterior: {
        tokensIn: f.inPrev,
        tokensOut: f.outPrev,
        costoUsd: calcularCostoUsd(model, f.inPrev, f.outPrev),
      },
    }
  })

  return {
    porModelo,
    totalMesUsd: porModelo.reduce((acc, m) => acc + m.esteMes.costoUsd, 0),
    totalPrevUsd: porModelo.reduce((acc, m) => acc + m.mesAnterior.costoUsd, 0),
  }
}

// =====================  Bloque 2 — Uso de Google  ==========================

export type UsoSku = {
  sku: GoogleSku
  label: string
  esteMes: number
  mesAnterior: number
  cap: number
  porcentaje: number
  costoUsd: number
  estado: EstadoAlerta
}

/**
 * Uso de Google por SKU (`details`/`photos`), mes actual y anterior vs sus caps de
 * `app_settings` (decisiones 5 y 6). Devuelve siempre los dos SKUs, aunque no haya
 * fila todavía (count 0). Solo lee `google_api_usage` — no dispara ninguna llamada
 * paga.
 */
export async function getUsoGoogle(): Promise<UsoSku[]> {
  const [filas, capDetails, capPhotos] = await Promise.all([
    db
      .select({
        sku: googleApiUsage.sku,
        esteMes: sql<number>`coalesce(sum(${googleApiUsage.count}) filter (where ${googleApiUsage.month} = ${MES_TXT}), 0)::int`,
        mesAnterior: sql<number>`coalesce(sum(${googleApiUsage.count}) filter (where ${googleApiUsage.month} = ${MES_PREV_TXT}), 0)::int`,
      })
      .from(googleApiUsage)
      .where(sql`${googleApiUsage.month} in (${MES_TXT}, ${MES_PREV_TXT})`)
      .groupBy(googleApiUsage.sku),
    getDetailsMonthlyCap(),
    getPhotosMonthlyCap(),
  ])

  const porSku = new Map(filas.map((f) => [f.sku, f]))
  const caps: Record<GoogleSku, number> = { details: capDetails, photos: capPhotos }

  return (['details', 'photos'] as GoogleSku[]).map((sku) => {
    const fila = porSku.get(sku)
    const esteMes = fila?.esteMes ?? 0
    const mesAnterior = fila?.mesAnterior ?? 0
    const cap = caps[sku]
    return {
      sku,
      label: LABEL_SKU[sku],
      esteMes,
      mesAnterior,
      cap,
      porcentaje: porcentajeCap(esteMes, cap),
      costoUsd: costoGoogleUsd(esteMes, PRECIO_GOOGLE_POR_1000[sku]),
      estado: estadoAlerta(esteMes, cap),
    }
  })
}

// =====================  Bloque 3 — Cupo del chat  ==========================

export type CupoChat = {
  esteMes: number
  mesAnterior: number
  cap: number
  porcentaje: number
  estado: EstadoAlerta
}

/**
 * Requests del chat del mes vs el tope global `ai.chat_monthly_cap` (decisión 3/6).
 * Este bloque —y solo este— usa `ai_api_usage` (cuenta requests, no costo). Mismo
 * esquema de alerta que Google.
 */
export async function getCupoChat(): Promise<CupoChat> {
  const [fila, cap] = await Promise.all([
    db
      .select({
        esteMes: sql<number>`coalesce(sum(${aiApiUsage.count}) filter (where ${aiApiUsage.month} = ${MES_TXT}), 0)::int`,
        mesAnterior: sql<number>`coalesce(sum(${aiApiUsage.count}) filter (where ${aiApiUsage.month} = ${MES_PREV_TXT}), 0)::int`,
      })
      .from(aiApiUsage)
      .where(and(eq(aiApiUsage.sku, 'chat_messages'), sql`${aiApiUsage.month} in (${MES_TXT}, ${MES_PREV_TXT})`)),
    getChatMonthlyCap(),
  ])

  const esteMes = fila[0]?.esteMes ?? 0
  return {
    esteMes,
    mesAnterior: fila[0]?.mesAnterior ?? 0,
    cap,
    porcentaje: porcentajeCap(esteMes, cap),
    estado: estadoAlerta(esteMes, cap),
  }
}

// =====================  Bloque 4 — Sugeridor de precio  ====================

// Cotización del dólar oficial cacheada en memoria de proceso ~1 h (decisión 9):
// no bloquea `/admin` ni castiga cada request con un fetch a una fuente externa.
type Cotizacion = { venta: number; fecha: Date }
let cacheCotizacion: Cotizacion | null = null
let cacheAt = 0
const TTL_MS = 60 * 60 * 1000

/**
 * Dólar oficial (campo `venta`) desde dolarapi.com (decisión 8: la referencia de
 * producto es dolarito.ar oficial; esta es solo la fuente técnica del transporte).
 * Cacheado ~1 h, timeout corto, `no-store`. **Nunca lanza**: si la fuente cae,
 * devuelve el último valor conocido (o `null` si nunca hubo) para que la page
 * renderice igual (decisión 9).
 */
async function cotizacionOficial(): Promise<Cotizacion | null> {
  const ahora = Date.now()
  if (cacheCotizacion && ahora - cacheAt < TTL_MS) return cacheCotizacion
  try {
    const res = await fetch('https://dolarapi.com/v1/dolares/oficial', {
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) throw new Error(`status ${res.status}`)
    const json = (await res.json()) as { venta?: unknown }
    const venta = Number(json?.venta)
    if (!Number.isFinite(venta) || venta <= 0) throw new Error('venta inválida')
    cacheCotizacion = { venta, fecha: new Date() }
    cacheAt = ahora
    return cacheCotizacion
  } catch {
    // Degrada al último valor conocido; si nunca hubo, `null` → estado "sin cotización".
    return cacheCotizacion
  }
}

export type SugerenciaPrecio = {
  precioActual: number
  /** `null` = no pudimos consultar y nunca hubo un valor cacheado. */
  cotizacion: Cotizacion | null
} & Partial<EvaluacionPiso>

/**
 * El sugeridor de precio premium (decisiones 8-10): precio vigente + cotización del
 * dólar oficial + evaluación de la regla de piso. Si no hay cotización, devuelve
 * solo el precio y `cotizacion: null` (la page muestra "no pudimos consultar" sin
 * romperse). **Solo sugiere** — el cambio de precio es manual en la sección Precios.
 */
export async function getSugerenciaPrecio(): Promise<SugerenciaPrecio> {
  const [precioActual, cotizacion] = await Promise.all([getPrecioB2cArs(), cotizacionOficial()])
  if (!cotizacion) return { precioActual, cotizacion: null }
  return { precioActual, cotizacion, ...evaluarPiso(precioActual, cotizacion.venta) }
}
