import { describe, expect, it } from 'vitest'
import { calcularCostoUsd, PRECIO_DEFAULT, PRECIOS_POR_MODELO } from '../logging'

/**
 * El cálculo de costo del chat (COSTOS_ADMIN, decisión 2): puro, exportado del
 * mismo módulo que loguea, para que el tablero de `/admin` importe de acá y no
 * duplique los precios de Anthropic.
 */

describe('calcularCostoUsd', () => {
  it('cobra input y output según el precio del modelo (Sonnet 5 = $3/$15 por millón)', () => {
    // 1M in × $3 + 1M out × $15 = $18
    expect(calcularCostoUsd('claude-sonnet-5', 1_000_000, 1_000_000)).toBeCloseTo(18, 6)
  })

  it('usa el precio de Haiku 4.5 ($1/$5 por millón)', () => {
    // 500k in × $1 + 200k out × $5 = $0,5 + $1 = $1,5
    expect(calcularCostoUsd('claude-haiku-4-5', 500_000, 200_000)).toBeCloseTo(1.5, 6)
  })

  it('modelo desconocido cae al precio default (el de Haiku)', () => {
    expect(calcularCostoUsd('modelo-inexistente', 1_000_000, 1_000_000)).toBeCloseTo(
      PRECIO_DEFAULT.input + PRECIO_DEFAULT.output,
      6,
    )
  })

  it('tokens 0 o null cuentan como 0 (no rompe ni suma)', () => {
    expect(calcularCostoUsd('claude-sonnet-5', 0, 0)).toBe(0)
    expect(calcularCostoUsd('claude-sonnet-5', null, null)).toBe(0)
    expect(calcularCostoUsd('claude-sonnet-5', undefined, undefined)).toBe(0)
    // Solo input: no cuenta output.
    expect(calcularCostoUsd('claude-sonnet-5', 1_000_000, null)).toBeCloseTo(3, 6)
  })

  it('la tabla de precios mantiene $3/$15 para Sonnet 5 (decisión 4)', () => {
    expect(PRECIOS_POR_MODELO['claude-sonnet-5']).toEqual({ input: 3.0, output: 15.0 })
  })
})
