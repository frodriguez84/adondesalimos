import { describe, expect, it } from 'vitest'
import { VOTACION_TTL_HORAS } from '../constantes'
import {
  cierreEnPalabras,
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

/**
 * INVITACION, decisión 5 (`PBETA-R2-06`). Lo que importa: **redondea siempre para
 * abajo**, así nunca promete más tiempo del que hay, y una vencida no anuncia
 * plazo (esa votación se muestra en modo cerrado).
 */
describe('cierreEnPalabras', () => {
  const en = (horas: number) => new Date(AHORA.getTime() + horas * 60 * 60 * 1000)

  it('cuenta días enteros mientras falte un día o más', () => {
    expect(cierreEnPalabras(en(VOTACION_TTL_HORAS), AHORA)).toBe('Cierra en 3 días')
    expect(cierreEnPalabras(en(48), AHORA)).toBe('Cierra en 2 días')
    expect(cierreEnPalabras(en(24), AHORA)).toBe('Cierra en 1 día')
  })

  it('redondea para abajo: 47 h no son 2 días', () => {
    expect(cierreEnPalabras(en(47), AHORA)).toBe('Cierra en 1 día')
    expect(cierreEnPalabras(en(23.9), AHORA)).toBe('Cierra en 23 horas')
  })

  it('pasa a horas abajo del día, y singulariza', () => {
    expect(cierreEnPalabras(en(5), AHORA)).toBe('Cierra en 5 horas')
    expect(cierreEnPalabras(en(1), AHORA)).toBe('Cierra en 1 hora')
  })

  it('abajo de una hora no da un número que envejece en el acto', () => {
    expect(cierreEnPalabras(en(0.5), AHORA)).toBe('Cierra en menos de una hora')
  })

  it('una ya vencida no tiene plazo que anunciar', () => {
    expect(cierreEnPalabras(PASADO, AHORA)).toBeNull()
    expect(cierreEnPalabras(AHORA, AHORA)).toBeNull()
  })
})
