import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIDENCE_THRESHOLD, isPlacePublished } from '../visibility'

const UMBRAL = DEFAULT_CONFIDENCE_THRESHOLD // 0.5

/** Lugar de Overture típico: abierto, con confidence, sin reclamo aprobado. */
function overture(overrides: Partial<Parameters<typeof isPlacePublished>[0]> = {}) {
  return { operatingStatus: 'open', confidence: 0.8, publishOverride: false, ...overrides }
}

describe('regla de visibilidad', () => {
  it('publica un lugar abierto que llega al umbral', () => {
    expect(isPlacePublished(overture({ confidence: 0.8 }), UMBRAL)).toBe(true)
    expect(isPlacePublished(overture({ confidence: 0.5 }), UMBRAL)).toBe(true) // el borde entra
  })

  // DoD caso 1: bajo umbral ⇒ invisible
  it('oculta un lugar por debajo del umbral', () => {
    expect(isPlacePublished(overture({ confidence: 0.3 }), UMBRAL)).toBe(false)
  })

  // DoD caso 2: publish_override ⇒ visible aunque no llegue al umbral
  it('publica por override aunque no llegue al umbral', () => {
    expect(isPlacePublished(overture({ confidence: 0.3, publishOverride: true }), UMBRAL)).toBe(true)
  })

  // DoD caso 3: operating_status != 'open' ⇒ invisible SIEMPRE, aun con override
  it('oculta un lugar cerrado siempre, aun con override y confidence alta', () => {
    expect(isPlacePublished(overture({ operatingStatus: 'closed' }), UMBRAL)).toBe(false)
    expect(
      isPlacePublished(
        overture({ operatingStatus: 'closed', confidence: 0.99, publishOverride: true }),
        UMBRAL,
      ),
    ).toBe(false)
    expect(isPlacePublished(overture({ operatingStatus: 'closed_temporarily' }), UMBRAL)).toBe(false)
  })

  // DoD caso 4: source='owner' (confidence null) sin override ⇒ invisible
  it('oculta un lugar de dueño sin override y lo publica con override', () => {
    const dueño = { operatingStatus: 'open', confidence: null, publishOverride: false }
    expect(isPlacePublished(dueño, UMBRAL)).toBe(false)
    expect(isPlacePublished({ ...dueño, publishOverride: true }, UMBRAL)).toBe(true)
  })

  it('responde al umbral que se le pase, no a una constante hardcodeada', () => {
    const lugar = overture({ confidence: 0.6 })
    expect(isPlacePublished(lugar, 0.5)).toBe(true)
    expect(isPlacePublished(lugar, 0.7)).toBe(false) // subir el umbral lo despublica
  })
})
