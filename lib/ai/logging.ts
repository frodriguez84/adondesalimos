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
 * Costo en USD de una llamada, según los tokens y el modelo (decisión 2). Pura y
 * sin redondeo (el que loguea o presenta decide los decimales): el log mantiene
 * sus 6 decimales, el tablero formatea a 2. Tokens `null`/`undefined` cuentan 0.
 */
export function calcularCostoUsd(
  model: string,
  tokensIn: number | null | undefined,
  tokensOut: number | null | undefined,
): number {
  const precio = PRECIOS_POR_MODELO[model] ?? PRECIO_DEFAULT
  return ((tokensIn ?? 0) / 1_000_000) * precio.input + ((tokensOut ?? 0) / 1_000_000) * precio.output
}

export function logChatCall(params: {
  model: string
  plan: 'trial' | 'premium'
  inputTokens?: number
  outputTokens?: number
  cacheReadTokens?: number
}) {
  const { model, plan, inputTokens = 0, outputTokens = 0, cacheReadTokens = 0 } = params
  const estimatedCostUsd = calcularCostoUsd(model, inputTokens, outputTokens)

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
