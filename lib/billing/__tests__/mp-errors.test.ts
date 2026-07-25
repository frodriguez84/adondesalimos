import { describe, expect, it } from 'vitest'
import { parseMpApiErrorBody, userMessageForMpCode } from '@/lib/billing/mp-errors'

/** Mapeo de errores de MP a mensajes en rioplatense (MONETIZACION, § Reuso). */

// El copy es de producción: NO debe filtrar lenguaje de sandbox (APRO, comprador de
// prueba, números de tarjeta de test). Los tests lo blindan.
const SANDBOX_LEAKS = /APRO|comprador de prueba|5031 7557|4509 9535/i

describe('userMessageForMpCode', () => {
  it('CC_VAL_433 → mensaje claro sin lenguaje de sandbox', () => {
    const msg = userMessageForMpCode('CC_VAL_433', 'algo')
    expect(msg).toMatch(/no pudo validar la tarjeta/i)
    expect(msg).not.toMatch(SANDBOX_LEAKS)
  })

  it('tarjeta no válida para suscripciones → mensaje genérico sin datos de test', () => {
    const msg = userMessageForMpCode('Invalid_payment_method', 'algo')
    expect(msg).toMatch(/no se puede usar para una suscripción/i)
    expect(msg).not.toMatch(SANDBOX_LEAKS)
  })

  it('código desconocido → devuelve el fallback', () => {
    expect(userMessageForMpCode('LO_QUE_SEA', 'mensaje original')).toBe('mensaje original')
  })

  it('detecta CC_VAL_433 embebido en el fallback', () => {
    const msg = userMessageForMpCode(null, 'error CC_VAL_433 no se pudo')
    expect(msg).toMatch(/no pudo validar la tarjeta/i)
  })
})

describe('parseMpApiErrorBody', () => {
  it('extrae el code de cause[0]', () => {
    const r = parseMpApiErrorBody({ message: 'x', cause: [{ code: 'CC_VAL_433' }] })
    expect(r.code).toBe('CC_VAL_433')
    expect(r.userMessage).toMatch(/no pudo validar la tarjeta/i)
  })

  it('cae al mensaje por defecto si no hay body útil', () => {
    const r = parseMpApiErrorBody({})
    expect(r.message).toBe('Error de Mercado Pago')
    expect(r.code).toBeNull()
  })
})
