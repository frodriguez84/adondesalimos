import { describe, expect, it } from 'vitest'

import { jsonLdDeLugar, jsonLdSerializado, tipoSchema, type LugarParaJsonLd } from '../jsonld'

/**
 * Regresión de ToS del JSON-LD de la ficha (SEO, decisión 14 = FICHA decisión 16).
 *
 * El JSON-LD es contenido **publicado y cacheado por terceros**: meter ahí un dato
 * de Google es persistirlo, y el ToS lo prohíbe. Mismo criterio que los tests del
 * field mask de FICHA — un campo de más no es un detalle de estilo, es la línea
 * entre gratis y una violación de términos.
 */

const tag = (facet: string, slug: string, name: string) => ({ slug, name, facet })

const base: LugarParaJsonLd = {
  id: '11111111-2222-3333-4444-555555555555',
  name: 'Bar de prueba',
  lat: -34.588,
  lng: -58.43,
  address: 'Thames 1234',
  locality: 'Palermo',
  tags: [tag('tipo', 'bar', 'Bar'), tag('cocina', 'pizza', 'Pizza')],
  horariosDueno: null,
}

/**
 * Las claves que **no pueden aparecer nunca**. Si alguien agrega una, este test
 * falla y hay que leer la decisión 14 antes de tocarlo.
 */
const CLAVES_PROHIBIDAS = [
  'aggregateRating',
  'ratingValue',
  'reviewCount',
  'userRatingCount',
  'review',
  'reviews',
  'priceRange',
  'image',
  'photo',
  'photos',
  'editorialSummary',
  'currentOpeningHours',
  'regularOpeningHours',
  'openingHours',
]

/** Recorre el objeto entero: una clave prohibida anidada cuenta igual. */
function clavesDe(valor: unknown, acc: string[] = []): string[] {
  if (Array.isArray(valor)) {
    for (const v of valor) clavesDe(v, acc)
  } else if (valor && typeof valor === 'object') {
    for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
      acc.push(k)
      clavesDe(v, acc)
    }
  }
  return acc
}

describe('jsonLdDeLugar — solo datos propios (ToS de Google)', () => {
  it('no emite ninguna clave de rating, precio, reseñas ni imagen de Google', () => {
    const claves = clavesDe(jsonLdDeLugar(base))
    for (const prohibida of CLAVES_PROHIBIDAS) {
      expect(claves, `clave prohibida en el JSON-LD: ${prohibida}`).not.toContain(prohibida)
    }
  })

  it('tampoco las emite con horarios del dueño cargados', () => {
    const conHorarios = jsonLdDeLugar({
      ...base,
      horariosDueno: {
        lunes: [{ abre: '18:00', cierra: '23:30' }],
        martes: [],
        miercoles: [],
        jueves: [],
        viernes: [{ abre: '18:00', cierra: '02:00' }],
        sabado: [],
        domingo: [],
      },
    })
    const claves = clavesDe(conHorarios)
    for (const prohibida of CLAVES_PROHIBIDAS) {
      expect(claves, `clave prohibida en el JSON-LD: ${prohibida}`).not.toContain(prohibida)
    }
  })

  it('emite los datos propios: nombre, dirección, geo y url absoluta', () => {
    const ld = jsonLdDeLugar(base)
    expect(ld['@context']).toBe('https://schema.org')
    expect(ld.name).toBe('Bar de prueba')
    expect(ld.url).toContain('/lugar/' + base.id)
    expect(ld.url).toMatch(/^https?:\/\//)
    expect(ld.geo).toEqual({
      '@type': 'GeoCoordinates',
      latitude: -34.588,
      longitude: -58.43,
    })
    expect(ld.address).toEqual({
      '@type': 'PostalAddress',
      streetAddress: 'Thames 1234',
      addressLocality: 'Palermo',
      addressCountry: 'AR',
    })
  })

  it('sin dirección ni localidad no emite una PostalAddress vacía', () => {
    const ld = jsonLdDeLugar({ ...base, address: null, locality: null })
    expect(ld.address).toBeUndefined()
  })

  it('los horarios del DUEÑO sí van (son datos nuestros)', () => {
    const ld = jsonLdDeLugar({
      ...base,
      horariosDueno: {
        lunes: [{ abre: '18:00', cierra: '23:30' }],
        martes: [],
        miercoles: [],
        jueves: [],
        viernes: [],
        sabado: [],
        domingo: [],
      },
    })
    expect(ld.openingHoursSpecification).toEqual([
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: 'https://schema.org/Monday',
        opens: '18:00',
        closes: '23:30',
      },
    ])
  })

  it('sin horarios del dueño no emite la clave', () => {
    expect(jsonLdDeLugar(base).openingHoursSpecification).toBeUndefined()
  })
})

describe('jsonLdSerializado', () => {
  // El `name` no es dato nuestro: viene de Overture, de una corrección de admin o
  // del dueño del negocio. `JSON.stringify` **no escapa `<`**, así que sin este
  // escape el nombre de abajo cerraría el `<script type="application/ld+json">` y
  // abriría uno ejecutable. El CSP no salva: está en `Report-Only` y con
  // `'unsafe-inline'`.
  const HOSTIL = 'Bar </script><script>alert(1)</script>'

  it('no deja ni un `<` literal en la salida', () => {
    const salida = jsonLdSerializado({ ...base, name: HOSTIL })
    expect(salida).not.toContain('<')
    expect(salida.toLowerCase()).not.toContain('</script')
  })

  it('sigue siendo JSON válido y el nombre vuelve intacto', () => {
    const salida = jsonLdSerializado({ ...base, name: HOSTIL })
    expect(JSON.parse(salida).name).toBe(HOSTIL)
  })

  it('escapa también un `<` que venga en la dirección', () => {
    const salida = jsonLdSerializado({ ...base, address: 'Thames <b>1234</b>' })
    expect(salida).not.toContain('<')
    expect(JSON.parse(salida).address.streetAddress).toBe('Thames <b>1234</b>')
  })
})

describe('tipoSchema', () => {
  it('mapea el tag de Tipo al @type de schema.org', () => {
    expect(tipoSchema([tag('tipo', 'bar', 'Bar')])).toBe('BarOrPub')
    expect(tipoSchema([tag('tipo', 'restaurante', 'Restaurante')])).toBe('Restaurant')
    expect(tipoSchema([tag('tipo', 'cafe', 'Café')])).toBe('CafeOrCoffeeShop')
    expect(tipoSchema([tag('tipo', 'boliche', 'Boliche')])).toBe('NightClub')
  })

  it('sin tag de Tipo cae al fallback', () => {
    expect(tipoSchema([tag('cocina', 'pizza', 'Pizza')])).toBe('LocalBusiness')
    expect(tipoSchema([])).toBe('LocalBusiness')
  })
})
