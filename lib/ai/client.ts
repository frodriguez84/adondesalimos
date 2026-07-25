import Anthropic from '@anthropic-ai/sdk'

/**
 * **El único módulo que habla con Anthropic** (CHAT_IA, decisión 4) — mismo
 * criterio que `lib/google/places.ts` y `lib/storage/r2.ts`: `ANTHROPIC_API_KEY`
 * vive solo acá y en ningún otro lado, y nunca llega al bundle del browser (el
 * cliente habla con `/api/chat`, no con Anthropic).
 *
 * Server-only por construcción; el guard de abajo es la red barata: si algún día
 * esto cae en un bundle de browser, revienta en vez de filtrar la key.
 *
 * La key se lee **en el momento de usar el cliente**, no en el tope del módulo:
 * así los helpers puros de `lib/ai/` (grounding, tools, prompts) se importan en
 * tests sin exigir la clave. Singleton lazy: una sola instancia por proceso.
 */

if (typeof window !== 'undefined') {
  throw new Error('lib/ai/client.ts es server-only: no puede importarse en el browser')
}

let cliente: Anthropic | null = null

/** El cliente Anthropic del proceso. Lo instancia el primer llamado. */
export function getAnthropic(): Anthropic {
  if (cliente) return cliente
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY no está configurada')
  }
  cliente = new Anthropic({ apiKey })
  return cliente
}
