import { describe, expect, it } from 'vitest'
import { unstable_getResponseFromNextConfig } from 'next/experimental/testing/server'
import nextConfig from '@/next.config'

/**
 * Los headers de seguridad de `next.config.ts` (`SEC-11`, auditoría del 2026-08-18).
 *
 * **Por qué un test y no "se ve con `curl`":** son cinco líneas que nadie vuelve a
 * mirar y que fallan calladas en los dos sentidos —si se borran, no se rompe ninguna
 * pantalla; si el CSP pasa de `Report-Only` a enforcing sin querer, se rompen todas—.
 */
const headersDe = async (url = 'https://adondesalimos.com.ar/') =>
  (await unstable_getResponseFromNextConfig({ url, nextConfig })).headers

describe('headers de seguridad', () => {
  it('emite los cuatro headers en modo enforcing', async () => {
    const headers = await headersDe()

    expect(headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin')
    expect(headers.get('x-frame-options')).toBe('DENY')
    expect(headers.get('x-content-type-options')).toBe('nosniff')
    expect(headers.get('permissions-policy')).toContain('camera=()')
  })

  it('⚠️ el CSP sigue en Report-Only: pasarlo a enforcing es una decisión, no un descuido', async () => {
    const headers = await headersDe()

    expect(headers.get('content-security-policy-report-only')).toBeTruthy()
    expect(headers.get('content-security-policy')).toBeNull()
  })

  it('el CSP declara los hosts que la app usa de verdad', async () => {
    const csp = (await headersDe()).get('content-security-policy-report-only') ?? ''

    // El mapa: MapLibre baja tiles y levanta sus Web Workers desde un `blob:`.
    expect(csp).toContain('https://tiles.openfreemap.org')
    expect(csp).toContain("worker-src 'self' blob:")
    // La foto de la ficha la sirve Google desde googleusercontent, no desde la API.
    expect(csp).toContain('googleusercontent.com')
    // El checkout de MP está apagado (`DEPLOY` F3) y va igual: si no, rompe al encenderlo.
    expect(csp).toContain('https://sdk.mercadopago.com')
  })

  it('no declara HSTS: ya lo emite Vercel y duplicarlo es ruido', async () => {
    expect((await headersDe()).get('strict-transport-security')).toBeNull()
  })

  it('cubre las páginas y también las rutas de API', async () => {
    const enApi = await headersDe('https://adondesalimos.com.ar/api/search?q=cafe')
    expect(enApi.get('x-content-type-options')).toBe('nosniff')
  })
})
