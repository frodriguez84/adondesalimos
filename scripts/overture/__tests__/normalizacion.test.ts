import { describe, expect, it } from 'vitest'
import { toStringArray } from '../normalize'

/**
 * Regresión: las listas de Overture (`VARCHAR[]`) no llegan como array de JS
 * desde @duckdb/node-api. La primera versión del import usaba `Array.isArray`
 * sobre el valor crudo y guardó los 26.057 lugares con teléfonos, webs y redes
 * en null — sin un solo error. Estos tests fijan el contrato.
 */
describe('toStringArray', () => {
  it('parsea el JSON serializado que devuelve la query', () => {
    expect(toStringArray('["+541143210000"]')).toEqual(['+541143210000'])
    expect(toStringArray('["https://a.com","https://b.com"]')).toEqual([
      'https://a.com',
      'https://b.com',
    ])
  })

  it('acepta también un array ya parseado', () => {
    expect(toStringArray(['x', 'y'])).toEqual(['x', 'y'])
  })

  it('devuelve null cuando no hay dato', () => {
    expect(toStringArray(null)).toBeNull()
    expect(toStringArray(undefined)).toBeNull()
    expect(toStringArray('null')).toBeNull()
    expect(toStringArray('[]')).toBeNull()
    expect(toStringArray([])).toBeNull()
  })

  it('descarta strings vacíos y valores no-string', () => {
    expect(toStringArray('["ok","",null,123]')).toEqual(['ok'])
  })

  it('no explota con JSON inválido', () => {
    expect(toStringArray('{no es json')).toBeNull()
  })
})
