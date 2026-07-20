import { describe, expect, it } from 'vitest'
import {
  EMPTY_SEARCH,
  parseSearchParams,
  serializeSearchParams,
  tieneBusqueda,
} from '../params'

describe('parseSearchParams', () => {
  it('lee el contrato de URL de la decisión 12', () => {
    const p = parseSearchParams({
      z: 'palermo-soho,villa-crespo',
      t: 'bar,juegos-de-mesa',
      q: 'texto',
    })
    expect(p.zones).toEqual(['palermo-soho', 'villa-crespo'])
    expect(p.tags).toEqual(['bar', 'juegos-de-mesa'])
    expect(p.q).toBe('texto')
    expect(p.gps).toBe(false)
  })

  it('normaliza el orden y los duplicados: la misma búsqueda da el mismo estado', () => {
    const a = parseSearchParams({ t: 'cafe,bar' })
    const b = parseSearchParams({ t: 'bar,cafe,bar' })
    expect(a.tags).toEqual(b.tags)
  })

  it('descarta slugs con caracteres fuera del canon en vez de pasarlos a la query', () => {
    const p = parseSearchParams({ z: "palermo-soho,'; DROP TABLE places--,villa crespo" })
    expect(p.zones).toEqual(['palermo-soho'])
  })

  it('ignora un q de un solo caracter y recorta los largos', () => {
    expect(parseSearchParams({ q: 'a' }).q).toBeNull()
    expect(parseSearchParams({ q: '  ' }).q).toBeNull()
    expect(parseSearchParams({ q: 'x'.repeat(500) }).q).toHaveLength(100)
  })

  it('solo toma coordenadas si gps está encendido y son válidas', () => {
    expect(parseSearchParams({ lat: '-34.6', lng: '-58.4' }).coords).toBeNull()
    expect(parseSearchParams({ gps: '1', lat: '-34.6', lng: '-58.4' }).coords).toEqual({
      lat: -34.6,
      lng: -58.4,
    })
    // Fuera de rango o no numérico: gps queda encendido pero sin coords, y la
    // query cae al comportamiento sin GPS en vez de romper.
    expect(parseSearchParams({ gps: '1', lat: '999', lng: '-58.4' }).coords).toBeNull()
    expect(parseSearchParams({ gps: '1', lat: 'abc', lng: '-58.4' }).coords).toBeNull()
  })

  it('tolera params repetidos tomando el primero', () => {
    expect(parseSearchParams({ q: ['uno', 'dos'] }).q).toBe('uno')
  })
})

describe('URL ↔ estado es bidireccional', () => {
  it('parse(serialize(x)) devuelve x', () => {
    const original = parseSearchParams({
      z: 'villa-crespo,palermo-soho',
      t: 'bar,cafe',
      q: 'birra',
      gps: '1',
      lat: '-34.6',
      lng: '-58.4',
    })
    const ida = serializeSearchParams(original)
    const vuelta = parseSearchParams(Object.fromEntries(new URLSearchParams(ida)))

    // coords NO viajan en la URL a propósito: son del dispositivo que mira, no
    // del que compartió el link.
    expect(vuelta).toEqual({ ...original, coords: null })
  })

  it('no emite params vacíos', () => {
    expect(serializeSearchParams(EMPTY_SEARCH)).toBe('')
  })
})

describe('tieneBusqueda', () => {
  it('es falso sin criterios: la primera visita no lista el catálogo entero', () => {
    expect(tieneBusqueda(EMPTY_SEARCH)).toBe(false)
  })

  it('es verdadero con cualquier criterio', () => {
    expect(tieneBusqueda({ ...EMPTY_SEARCH, zones: ['palermo-soho'] })).toBe(true)
    expect(tieneBusqueda({ ...EMPTY_SEARCH, tags: ['bar'] })).toBe(true)
    expect(tieneBusqueda({ ...EMPTY_SEARCH, q: 'birra' })).toBe(true)
    expect(
      tieneBusqueda({ ...EMPTY_SEARCH, gps: true, coords: { lat: -34.6, lng: -58.4 } }),
    ).toBe(true)
  })

  it('gps SIN coordenadas no es una búsqueda: si no, listaría el catálogo entero', () => {
    expect(tieneBusqueda({ ...EMPTY_SEARCH, gps: true })).toBe(false)
    // Pero con otro criterio sí busca, ignorando el gps inútil.
    expect(tieneBusqueda({ ...EMPTY_SEARCH, gps: true, zones: ['palermo-soho'] })).toBe(true)
  })
})
