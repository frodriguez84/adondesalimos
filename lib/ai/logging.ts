/**
 * Log de costo por llamada a Anthropic (CHAT_IA, decisión 24). Patrón `logAiCall`
 * de StressPlan, con los precios de los modelos que este spec puede usar (decisión
 * 3: Haiku 4.5 default, Sonnet 5 alternativo). Es telemetría de costos: no toca las
 * stats B2B ni persiste nada — sale por `console.log` estructurado.
 */

/**
 * USD por millón de tokens (input / output). Fuente: pricing de Anthropic,
 * verificado contra el skill `claude-api` (COSTOS_ADMIN, decisión 4). Sonnet 5 se
 * mantiene en $3/$15 aunque rija un precio intro de $2/$10 hasta el 2026-08-31:
 * conservador a propósito (sobreestima levemente el gasto hasta septiembre).
 *
 * Fuente **única** de los precios de Anthropic: el tablero de `/admin`
 * (`lib/admin/costos.ts`) importa de acá, no duplica la tabla (decisión 2).
 */
export const PRECIOS_POR_MODELO: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5': { input: 1.0, output: 5.0 },
  'claude-sonnet-5': { input: 3.0, output: 15.0 },
}

/** Fallback si el model id no está mapeado: usa el de Haiku para no romper el log. */
export const PRECIO_DEFAULT = { input: 1.0, output: 5.0 }

/**
 * Multiplicadores del precio de **input** para los tokens de caché. Un read sale
 * ~0,1× y un write (TTL de 5 min, el default) 1,25×; con dos llamadas al mismo
 * prefijo ya conviene. No son otro precio: son el de input escalado.
 */
export const MULT_CACHE_READ = 0.1
export const MULT_CACHE_WRITE = 1.25

/**
 * Costo en USD de una llamada, según los tokens y el modelo (decisión 2). Pura y
 * sin redondeo (el que loguea o presenta decide los decimales): el log mantiene
 * sus 6 decimales, el tablero formatea a 2. Tokens `null`/`undefined` cuentan 0.
 *
 * **Los tokens de caché van aparte de `tokensIn` y hay que pasarlos.** La API
 * reporta `input_tokens` como el remanente NO cacheado: el total de entrada es
 * `input + cache_read + cache_creation`. Omitir los dos últimos no "sobreestima
 * conservadoramente" — subestima, porque los reads igual se cobran (a 0,1×).
 */
export function calcularCostoUsd(
  model: string,
  tokensIn: number | null | undefined,
  tokensOut: number | null | undefined,
  cacheReadTokens: number | null | undefined = 0,
  cacheCreationTokens: number | null | undefined = 0,
): number {
  const precio = PRECIOS_POR_MODELO[model] ?? PRECIO_DEFAULT
  const inputEquivalente =
    (tokensIn ?? 0) +
    (cacheReadTokens ?? 0) * MULT_CACHE_READ +
    (cacheCreationTokens ?? 0) * MULT_CACHE_WRITE
  return (inputEquivalente / 1_000_000) * precio.input + ((tokensOut ?? 0) / 1_000_000) * precio.output
}

export function logChatCall(params: {
  model: string
  plan: 'trial' | 'premium'
  inputTokens?: number
  outputTokens?: number
  cacheReadTokens?: number
}) {
  const { model, plan, inputTokens = 0, outputTokens = 0, cacheReadTokens = 0 } = params
  // Los tokens leídos del caché se cobran (0,1×) y NO vienen dentro de
  // `inputTokens`: sin pasarlos, el costo logueado sale por debajo del real.
  const estimatedCostUsd = calcularCostoUsd(model, inputTokens, outputTokens, cacheReadTokens)

  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      type: 'chat_ia_call',
      model,
      plan,
      inputTokens,
      outputTokens,
      // Verificable del prompt caching (decisión 12): a partir del 2º mensaje
      // debería ser > 0. Si da 0 sostenido, hay un invalidador silencioso.
      cacheReadTokens,
      estimatedCostUsd: +estimatedCostUsd.toFixed(6),
    }),
  )
}
