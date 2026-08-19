import { describe, expect, it } from 'vitest'
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server'
import { config } from '@/proxy'

/**
 * El matcher del `proxy.ts` (`SEC-01`) se testea aparte del cupo porque **falla de
 * otra manera**: un cupo mal calibrado devuelve un 429 de más y se ve enseguida; un
 * matcher de más mete un 429 donde nadie lo está mirando.
 *
 * El caso que justifica el archivo es `/api/webhooks/mercadopago`: ese request lo hace
 * MercadoPago desde sus servidores, el webhook es idempotente y fail-closed, así que
 * un 429 nuestro **no se ve** — se caen acreditaciones en silencio.
 *
 * Vive acá, y no en la raíz, porque `vitest.config.ts` solo levanta tests de
 * `lib/`, `components/` y `scripts/`.
 *
 * ⚠️ El helper se llama `unstable_doesMiddlewareMatch` y no `…ProxyMatch`: la doc de
 * Next 16 ya usa el nombre nuevo, pero el paquete instalado (`16.3.1`) todavía exporta
 * el viejo. Si un día el import rompe, es esto y no el matcher.
 */
const coincide = (url: string) => unstable_doesMiddlewareMatch({ config, url })

describe('matcher del proxy', () => {
  it('⚠️ NO toca el webhook de MercadoPago (un 429 ahí rompe los pagos en silencio)', () => {
    expect(coincide('/api/webhooks/mercadopago')).toBe(false)
  })

  it('deja afuera el resto de /api, que ya tiene su propio cupo por endpoint', () => {
    expect(coincide('/api/search')).toBe(false)
    expect(coincide('/api/chat')).toBe(false)
    expect(coincide('/api/lugar/abc/google')).toBe(false)
  })

  it('deja afuera estáticos, metadata y la tarjeta de WhatsApp', () => {
    expect(coincide('/_next/static/chunks/main.js')).toBe(false)
    expect(coincide('/_next/image')).toBe(false)
    expect(coincide('/robots.txt')).toBe(false)
    expect(coincide('/manifest.webmanifest')).toBe(false)
    expect(coincide('/favicon.ico')).toBe(false)
    expect(coincide('/icons/icon-192.png')).toBe(false)
    expect(coincide('/og')).toBe(false)
  })

  it('sí cubre las páginas, que son lo que el hallazgo dejaba sin cupo', () => {
    expect(coincide('/')).toBe(true)
    expect(coincide('/lugar/abc')).toBe(true)
    expect(coincide('/votacion/xyz')).toBe(true)
    expect(coincide('/mis-lugares')).toBe(true)
    expect(coincide('/chat')).toBe(true)
  })
})
