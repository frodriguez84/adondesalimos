import { describe, expect, it } from 'vitest'
import {
  buildTextSearchBody,
  mapPriceLevel,
  parseDetails,
  parseFotoCandidata,
  rectanguloAlrededor,
  PLACE_DETAILS_FIELD_MASK,
  TEXT_SEARCH_FIELD_MASK,
} from '../places'

/**
 * Los field masks son la línea entre $0 y la factura (decisiones 7 y 11). Estos
 * tests fallan si alguien agrega un campo de más — es a propósito: un campo extra
 * en el resolver lo saca del tier gratis ($32/1.000) y uno de Atmosphere en Details
 * dispara el SKU de $25/1.000.
 */

describe('TEXT_SEARCH_FIELD_MASK — matching IDs-Only ($0)', () => {
  it('es exactamente places.id y nada más (decisión 7)', () => {
    expect(TEXT_SEARCH_FIELD_MASK).toBe('places.id')
  })

  it('no incluye ningún campo Pro (displayName/location = $32/1.000)', () => {
    expect(TEXT_SEARCH_FIELD_MASK).not.toMatch(/displayName|location|formattedAddress|,/)
  })
})

describe('PLACE_DETAILS_FIELD_MASK — Enterprise sin Atmosphere', () => {
  // Igualdad exacta, no un `contains`: es lo que hace que un campo de más falle.
  // `formattedAddress` entró con CORRECCION_DATOS (decisión 18) y es Essentials —
  // costo marginal US$0 porque la request ya se factura a Enterprise.
  it('es exactamente el mask de la decisión 11 + formattedAddress', () => {
    expect(PLACE_DETAILS_FIELD_MASK).toBe(
      'id,formattedAddress,regularOpeningHours,currentOpeningHours,rating,userRatingCount,priceLevel,googleMapsUri,photos',
    )
  })

  it('NUNCA pide reviews, editorialSummary ni atributos de ambiente (Atmosphere = $25/1.000)', () => {
    expect(PLACE_DETAILS_FIELD_MASK).not.toMatch(
      /reviews|editorialSummary|servesBeer|outdoorSeating|liveMusic/,
    )
  })
})

describe('buildTextSearchBody — salvaguardas en la entrada (decisión 8)', () => {
  const input = {
    name: 'La Fábrica del Taco',
    address: 'Gorriti 5548',
    locality: 'Villa Crespo',
    lat: -34.6,
    lng: -58.44,
  }

  it('textQuery = nombre, dirección, localidad', () => {
    expect(buildTextSearchBody(input).textQuery).toBe(
      'La Fábrica del Taco, Gorriti 5548, Villa Crespo',
    )
  })

  it('omite las partes nulas de la dirección sin dejar comas sueltas', () => {
    expect(buildTextSearchBody({ ...input, address: null, locality: null }).textQuery).toBe(
      'La Fábrica del Taco',
    )
  })

  it('restringe a un rectángulo alrededor del punto y pide un solo resultado', () => {
    const body = buildTextSearchBody(input) as {
      maxResultCount: number
      locationRestriction: { rectangle: { low: unknown; high: unknown } }
    }
    expect(body.maxResultCount).toBe(1)
    expect(body.locationRestriction.rectangle.low).toBeDefined()
    expect(body.locationRestriction.rectangle.high).toBeDefined()
  })

  it('el body no filtra un field mask disfrazado (el SKU lo fija el header, no el body)', () => {
    const claves = Object.keys(buildTextSearchBody(input))
    expect(claves).not.toContain('fields')
    expect(claves).not.toContain('fieldMask')
  })
})

describe('rectanguloAlrededor', () => {
  it('low es el suroeste y high el noreste del punto', () => {
    const r = rectanguloAlrededor(-34.6, -58.44, 300)
    expect(r.low.latitude).toBeLessThan(-34.6)
    expect(r.high.latitude).toBeGreaterThan(-34.6)
    expect(r.low.longitude).toBeLessThan(-58.44)
    expect(r.high.longitude).toBeGreaterThan(-58.44)
  })

  it('~300 m son ~0,0027° de latitud', () => {
    const r = rectanguloAlrededor(-34.6, -58.44, 300)
    expect(r.high.latitude - -34.6).toBeCloseTo(0.0027, 3)
  })
})

describe('mapPriceLevel — enum de Google → $..$$$$ (decisión 21)', () => {
  it('mapea los cuatro niveles con precio', () => {
    expect(mapPriceLevel('PRICE_LEVEL_INEXPENSIVE')).toBe('$')
    expect(mapPriceLevel('PRICE_LEVEL_MODERATE')).toBe('$$')
    expect(mapPriceLevel('PRICE_LEVEL_EXPENSIVE')).toBe('$$$')
    expect(mapPriceLevel('PRICE_LEVEL_VERY_EXPENSIVE')).toBe('$$$$')
  })

  it('free, sin especificar o ausente ⇒ null', () => {
    expect(mapPriceLevel('PRICE_LEVEL_FREE')).toBeNull()
    expect(mapPriceLevel('PRICE_LEVEL_UNSPECIFIED')).toBeNull()
    expect(mapPriceLevel(undefined)).toBeNull()
  })
})

describe('parseDetails — respuesta cruda → DTO (degrada campo por campo)', () => {
  it('mapea horarios, rating, precio y el link', () => {
    const dto = parseDetails({
      currentOpeningHours: { openNow: true },
      regularOpeningHours: {
        weekdayDescriptions: ['lunes: 9:00–18:00', 'martes: 9:00–18:00'],
      },
      rating: 4.3,
      userRatingCount: 128,
      priceLevel: 'PRICE_LEVEL_MODERATE',
      googleMapsUri: 'https://maps.google.com/?cid=1',
    })
    expect(dto.horarios).toEqual({
      abierto: true,
      semana: ['lunes: 9:00–18:00', 'martes: 9:00–18:00'],
    })
    expect(dto.rating).toBe(4.3)
    expect(dto.userRatingCount).toBe(128)
    expect(dto.priceLevel).toBe('$$')
    expect(dto.googleMapsUri).toBe('https://maps.google.com/?cid=1')
  })

  it('un lugar sin horarios ni rating devuelve todo en null, no rompe', () => {
    const dto = parseDetails({})
    expect(dto.horarios).toBeNull()
    expect(dto.rating).toBeNull()
    expect(dto.userRatingCount).toBeNull()
    expect(dto.priceLevel).toBeNull()
    expect(dto.googleMapsUri).toBeNull()
  })

  it('con openNow pero sin semana igual arma horarios (abierto/cerrado sirve solo)', () => {
    expect(parseDetails({ currentOpeningHours: { openNow: false } }).horarios).toEqual({
      abierto: false,
      semana: [],
    })
  })

  it('la foto no la resuelve parseDetails (queda null; la trae parseFotoCandidata)', () => {
    expect(parseDetails({}).foto).toBeNull()
  })
})

describe('parseFotoCandidata — una sola foto por ficha (decisión 14)', () => {
  it('toma SOLO la primera de N fotos (10 fotos ⇒ 1 candidata ⇒ 1 media call)', () => {
    const raw = {
      photos: Array.from({ length: 10 }, (_, i) => ({
        name: `places/ChIJx/photos/foto-${i}`,
        authorAttributions: [{ displayName: `Autor ${i}`, uri: `https://maps.google.com/autor-${i}` }],
      })),
    }
    const c = parseFotoCandidata(raw)
    expect(c).toEqual({
      name: 'places/ChIJx/photos/foto-0',
      autorNombre: 'Autor 0',
      autorUri: 'https://maps.google.com/autor-0',
    })
  })

  it('parsea el crédito al autor (displayName + uri)', () => {
    const c = parseFotoCandidata({
      photos: [
        {
          name: 'places/ChIJx/photos/abc',
          authorAttributions: [{ displayName: 'Juana Pérez', uri: 'https://maps.google.com/juana' }],
        },
      ],
    })
    expect(c?.autorNombre).toBe('Juana Pérez')
    expect(c?.autorUri).toBe('https://maps.google.com/juana')
  })

  it('sin fotos ⇒ null (no hay nada que pedir, el contador no se mueve)', () => {
    expect(parseFotoCandidata({})).toBeNull()
    expect(parseFotoCandidata({ photos: [] })).toBeNull()
  })

  it('una foto sin name ⇒ null (sin name el media endpoint no sirve)', () => {
    expect(parseFotoCandidata({ photos: [{ authorAttributions: [] }] })).toBeNull()
  })

  it('foto sin atribución de autor ⇒ candidata con autor null, no rompe', () => {
    const c = parseFotoCandidata({ photos: [{ name: 'places/ChIJx/photos/abc' }] })
    expect(c).toEqual({ name: 'places/ChIJx/photos/abc', autorNombre: null, autorUri: null })
  })
})
