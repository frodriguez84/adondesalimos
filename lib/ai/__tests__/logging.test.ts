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

  // Los tokens de caché no vienen dentro de `input_tokens` (la API los reporta
  // aparte) y NO son gratis: leerlos sale 0,1× y escribirlos 1,25× del precio de
  // input. Omitirlos subestima el costo — el bug que tenían el log del chat y el
  // reporte de `npm run curar`.
  it('cobra los tokens de caché a 0,1× (read) y 1,25× (write) del precio de input', () => {
    // 1M leídos del caché × $3 × 0,1 = $0,30
    expect(calcularCostoUsd('claude-sonnet-5', 0, 0, 1_000_000, 0)).toBeCloseTo(0.3, 6)
    // 1M escritos al caché × $3 × 1,25 = $3,75
    expect(calcularCostoUsd('claude-sonnet-5', 0, 0, 0, 1_000_000)).toBeCloseTo(3.75, 6)
    // Se suman al input no cacheado: 1M pleno + 1M read = $3 + $0,30
    expect(calcularCostoUsd('claude-sonnet-5', 1_000_000, 0, 1_000_000, 0)).toBeCloseTo(3.3, 6)
  })

  it('omitir los tokens de caché deja el costo igual que antes (retrocompatible)', () => {
    // Los dos parámetros nuevos son opcionales: el tablero de `/admin` y todo
    // llamador viejo siguen dando el mismo número.
    expect(calcularCostoUsd('claude-sonnet-5', 1_000_000, 1_000_000)).toBeCloseTo(
      calcularCostoUsd('claude-sonnet-5', 1_000_000, 1_000_000, 0, 0),
      6,
    )
    expect(calcularCostoUsd('claude-sonnet-5', 100, 200, null, undefined)).toBeCloseTo(
      calcularCostoUsd('claude-sonnet-5', 100, 200),
      6,
    )
  })

  it('cachear es más barato que no cachear el mismo prefijo (el punto del fix)', () => {
    const prefijo = 1_260 // el system del sugeridor, medido el 2026-07-29
    const llamadas = 1_840 // los lugares de la corrida de CURADURIA F3
    const sinCache = calcularCostoUsd('claude-sonnet-5', prefijo * llamadas, 0)
    const conCache = calcularCostoUsd(
      'claude-sonnet-5',
      0,
      0,
      prefijo * (llamadas - 1), // reads
      prefijo, // un solo write
    )
    expect(conCache).toBeLessThan(sinCache)
    // El ahorro es ~90% del input repetido.
    expect(conCache / sinCache).toBeLessThan(0.11)
  })
})
