import { describe, expect, it } from 'vitest'
import {
  costoDePeriodo,
  costoGoogleUsd,
  estadoAlerta,
  evaluarPiso,
  pisoArs,
  porcentajeCap,
  precioSugerido,
} from '../costos'
import { calcularCostoUsd } from '@/lib/ai/logging'

/**
 * Aritmética pura del tablero de costos (COSTOS_ADMIN, decisión 12): tier gratis de
 * Google, % de cap + estados de alerta, y la regla de piso con su redondeo. Sin DB.
 */

describe('costoGoogleUsd — tier gratis (decisión 5)', () => {
  it('con count ≤ 1.000 el costo es $0 (todo dentro del tier gratis)', () => {
    expect(costoGoogleUsd(1000, 20)).toBe(0)
    expect(costoGoogleUsd(0, 7)).toBe(0)
    expect(costoGoogleUsd(500, 20)).toBe(0)
  })

  it('cobra solo lo que excede los 1.000 gratis', () => {
    // details: (2000 − 1000) × $20/1.000 = $20
    expect(costoGoogleUsd(2000, 20)).toBeCloseTo(20, 6)
    // photos: (3000 − 1000) × $7/1.000 = $14
    expect(costoGoogleUsd(3000, 7)).toBeCloseTo(14, 6)
  })

  it('reproduce la cuenta de FICHA: 3.000 fichas ⇒ $40 details + $14 photos = $54', () => {
    // details a $20/1.000 sobre 3.000: (3000 − 1000) × 20/1000 = $40
    expect(costoGoogleUsd(3000, 20)).toBeCloseTo(40, 6)
    expect(costoGoogleUsd(3000, 7)).toBeCloseTo(14, 6)
  })
})

describe('costoDePeriodo — el tablero cuenta los tokens de caché (deuda 2026-07-31)', () => {
  // El bug: el tablero llamaba a `calcularCostoUsd(model, in, out)` y dejaba
  // afuera los de caché, que no vienen dentro de `in` y **se cobran**. Con reads
  // altos —el caso normal del chat, que cachea 8.776 tokens de system— el número
  // mostrado quedaba por debajo del real.
  const conCache = {
    tokensIn: 1_000,
    tokensOut: 500,
    cacheRead: 1_000_000,
    cacheCreation: 100_000,
  }

  it('una llamada con caché cuesta MÁS de lo que decía el tablero viejo', () => {
    const viejo = calcularCostoUsd('claude-sonnet-5', conCache.tokensIn, conCache.tokensOut)
    expect(costoDePeriodo('claude-sonnet-5', conCache).costoUsd).toBeGreaterThan(viejo)
  })

  it('el extra es exactamente read × 0,1 + write × 1,25 del precio de input', () => {
    // 1M read × $3 × 0,1 = $0,30 · 100k write × $3 × 1,25 = $0,375
    const viejo = calcularCostoUsd('claude-sonnet-5', conCache.tokensIn, conCache.tokensOut)
    expect(costoDePeriodo('claude-sonnet-5', conCache).costoUsd - viejo).toBeCloseTo(0.3 + 0.375, 6)
  })

  it('sin caché (meses viejos, columnas null → 0) da el mismo número que antes', () => {
    const sinCache = { tokensIn: 18_531, tokensOut: 7_288, cacheRead: 0, cacheCreation: 0 }
    expect(costoDePeriodo('claude-sonnet-5', sinCache).costoUsd).toBeCloseTo(
      calcularCostoUsd('claude-sonnet-5', 18_531, 7_288),
      6,
    )
  })

  it('devuelve los tokens tal cual, para que el tablero los pueda mostrar', () => {
    const r = costoDePeriodo('claude-sonnet-5', conCache)
    expect(r.cacheRead).toBe(1_000_000)
    expect(r.cacheCreation).toBe(100_000)
  })
})

describe('porcentajeCap', () => {
  it('calcula el porcentaje consumido', () => {
    expect(porcentajeCap(80, 100)).toBe(80)
    expect(porcentajeCap(50, 200)).toBe(25)
  })

  it('cap ≤ 0 devuelve 0 (el estado apagado se decide aparte)', () => {
    expect(porcentajeCap(500, 0)).toBe(0)
  })
})

describe('estadoAlerta — umbrales (decisión 6)', () => {
  it('cap 0 = apagado, sin alerta', () => {
    expect(estadoAlerta(500, 0)).toBe('apagado')
  })

  it('por debajo del 80% es ok', () => {
    expect(estadoAlerta(79, 100)).toBe('ok')
  })

  it('amarillo desde 80% (inclusive) hasta antes de 100%', () => {
    expect(estadoAlerta(80, 100)).toBe('amarillo')
    expect(estadoAlerta(99, 100)).toBe('amarillo')
  })

  it('rojo al 100% o más', () => {
    expect(estadoAlerta(100, 100)).toBe('rojo')
    expect(estadoAlerta(150, 100)).toBe('rojo')
  })
})

describe('regla de piso (decisión 10)', () => {
  it('el piso es dólar × 3', () => {
    expect(pisoArs(1520)).toBe(4560)
  })

  it('redondea el piso al millar hacia arriba', () => {
    expect(precioSugerido(4560)).toBe(5000)
    expect(precioSugerido(5000)).toBe(5000) // ya en el millar, no sube
    expect(precioSugerido(5001)).toBe(6000)
  })

  it('con dólar ~1.520 y precio 7.000: cubre, sin sugerido', () => {
    const r = evaluarPiso(7000, 1520)
    expect(r.piso).toBe(4560)
    expect(r.cubre).toBe(true)
    expect(r.sugerido).toBeNull()
    expect(r.margen).toBeCloseTo(7000 / 4560, 6)
  })

  it('con dólar alto el precio queda por debajo: sugiere el piso redondeado al millar', () => {
    // dólar 2.500 ⇒ piso 7.500 > 7.000 ⇒ no cubre; sugerido = 8.000
    const r = evaluarPiso(7000, 2500)
    expect(r.piso).toBe(7500)
    expect(r.cubre).toBe(false)
    expect(r.sugerido).toBe(8000)
  })

  it('el disparador nominal (dólar ~2.333) toca el piso exacto contra 7.000', () => {
    // 2333 × 3 = 6.999 < 7.000 ⇒ todavía cubre por 1 peso
    expect(evaluarPiso(7000, 2333).cubre).toBe(true)
    // 2334 × 3 = 7.002 > 7.000 ⇒ ya no cubre
    expect(evaluarPiso(7000, 2334).cubre).toBe(false)
  })
})
