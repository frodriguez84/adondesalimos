import { describe, expect, it } from 'vitest'
import { VOTACION_TTL_HORAS } from '../constantes'
import {
  estaActiva,
  estaExpirada,
  estadoVisible,
  expiracionDesde,
  sePuedeVotar,
} from '../estado'

/**
 * El estado temporal de una votación, puro (decisión 11). El caso que importa:
 * una votación `status='open'` con `expires_at` ya pasado NO está activa —
 * "activa" no es solo la columna status.
 */

const AHORA = new Date('2026-07-22T12:00:00Z')
const FUTURO = new Date('2026-07-25T12:00:00Z')
const PASADO = new Date('2026-07-20T12:00:00Z')

describe('expiracionDesde', () => {
  it('suma exactamente VOTACION_TTL_HORAS al created_at', () => {
    const creado = new Date('2026-07-22T12:00:00Z')
    const exp = expiracionDesde(creado)
    expect(exp.getTime() - creado.getTime()).toBe(VOTACION_TTL_HORAS * 60 * 60 * 1000)
  })
})

describe('estaActiva', () => {
  it('abierta y no vencida = activa', () => {
    expect(estaActiva({ status: 'open', expiresAt: FUTURO }, AHORA)).toBe(true)
  })

  it('abierta pero vencida = NO activa (decisión 11)', () => {
    expect(estaActiva({ status: 'open', expiresAt: PASADO }, AHORA)).toBe(false)
  })

  it('cerrada o cancelada nunca está activa, aunque no haya vencido', () => {
    expect(estaActiva({ status: 'closed', expiresAt: FUTURO }, AHORA)).toBe(false)
    expect(estaActiva({ status: 'cancelled', expiresAt: FUTURO }, AHORA)).toBe(false)
  })
})

describe('estaExpirada', () => {
  it('open + vencida = expirada (hay que persistir el cierre perezoso)', () => {
    expect(estaExpirada({ status: 'open', expiresAt: PASADO }, AHORA)).toBe(true)
  })

  it('open + futura no está expirada', () => {
    expect(estaExpirada({ status: 'open', expiresAt: FUTURO }, AHORA)).toBe(false)
  })

  it('una ya cerrada no cuenta como expirada (ya tiene su estado final)', () => {
    expect(estaExpirada({ status: 'closed', expiresAt: PASADO }, AHORA)).toBe(false)
  })
})

describe('estadoVisible', () => {
  it('open vigente se ve open; open vencida se ve expired', () => {
    expect(estadoVisible({ status: 'open', expiresAt: FUTURO }, AHORA)).toBe('open')
    expect(estadoVisible({ status: 'open', expiresAt: PASADO }, AHORA)).toBe('expired')
  })

  it('closed y cancelled se ven tal cual', () => {
    expect(estadoVisible({ status: 'closed', expiresAt: FUTURO }, AHORA)).toBe('closed')
    expect(estadoVisible({ status: 'cancelled', expiresAt: FUTURO }, AHORA)).toBe('cancelled')
  })
})

describe('sePuedeVotar', () => {
  it('solo si está genuinamente activa', () => {
    expect(sePuedeVotar({ status: 'open', expiresAt: FUTURO }, AHORA)).toBe(true)
    expect(sePuedeVotar({ status: 'open', expiresAt: PASADO }, AHORA)).toBe(false)
    expect(sePuedeVotar({ status: 'closed', expiresAt: FUTURO }, AHORA)).toBe(false)
  })
})
