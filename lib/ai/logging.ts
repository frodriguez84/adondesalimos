/**
 * Log de costo por llamada a Anthropic (CHAT_IA, decisión 24). Patrón `logAiCall`
 * de StressPlan, con los precios de los modelos que este spec puede usar (decisión
 * 3: Haiku 4.5 default, Sonnet 5 alternativo). Es telemetría de costos: no toca las
 * stats B2B ni persiste nada — sale por `console.log` estructurado.
 */

/** USD por millón de tokens (input / output). Fuente: pricing de Anthropic. */
const PRECIOS: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5': { input: 1.0, output: 5.0 },
  'claude-sonnet-5': { input: 3.0, output: 15.0 },
}

/** Fallback si el model id no está mapeado: usa el de Haiku para no romper el log. */
const PRECIO_DEFAULT = { input: 1.0, output: 5.0 }

export function logChatCall(params: {
  model: string
  plan: 'trial' | 'premium'
  inputTokens?: number
  outputTokens?: number
  cacheReadTokens?: number
}) {
  const { model, plan, inputTokens = 0, outputTokens = 0, cacheReadTokens = 0 } = params
  const precio = PRECIOS[model] ?? PRECIO_DEFAULT
  const estimatedCostUsd =
    (inputTokens / 1_000_000) * precio.input + (outputTokens / 1_000_000) * precio.output

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
