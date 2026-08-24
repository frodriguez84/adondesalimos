import { describe, expect, it } from 'vitest'

import { APP_URL } from '@/lib/app-url'

import {
  breadcrumbJsonLd,
  itemListJsonLd,
  serializarJsonLd,
  sitioJsonLd,
  type Miga,
} from '../jsonld'
import { DESCRIPCION, MARCA } from '../textos'

/**
 * Dos regresiones distintas sobre el mismo archivo:
 *
 *  1. **El escape de `<`** (XSS). `JSON.stringify` no lo escapa y los nombres de
 *     lugar son dato de terceros. F1 lo descubrió en la ficha; F2 lo mudó acá para
 *     que las páginas de `/salir` no escribieran un segundo escape. Si alguien
 *     "simplifica" `serializarJsonLd` a un `JSON.stringify`, esto falla.
 *  2. **El ToS de Google** (SEO decisión 14 = FICHA decisión 16). El JSON-LD es
 *     contenido cacheado por terceros: un dato de Google acá es un dato persistido.
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

describe('serializarJsonLd — el escape es el dueño único (XSS)', () => {
  const HOSTIL = 'Bar </script><script>alert(1)</script>'

  it('no deja ni un `<` literal en la salida', () => {
    const salida = serializarJsonLd({ name: HOSTIL })
    expect(salida).not.toContain('<')
    expect(salida.toLowerCase()).not.toContain('</script')
  })

  it('sigue siendo JSON válido y el valor vuelve intacto', () => {
    expect(JSON.parse(serializarJsonLd({ name: HOSTIL })).name).toBe(HOSTIL)
  })

  it('escapa también lo que viene anidado', () => {
    const salida = serializarJsonLd({ lista: [{ n: '<b>' }] })
    expect(salida).not.toContain('<')
    expect(JSON.parse(salida).lista[0].n).toBe('<b>')
  })
})

describe('breadcrumbJsonLd', () => {
  const migas: Miga[] = [
    { name: 'Inicio', path: '/' },
    { name: 'Palermo Soho', path: '/salir/palermo-soho' },
    { name: 'Bares', path: null },
  ]

  it('numera las posiciones desde 1 y en orden', () => {
    const ld = breadcrumbJsonLd(migas) as Record<string, unknown>
    const items = ld.itemListElement as Record<string, unknown>[]
    expect(ld['@type']).toBe('BreadcrumbList')
    expect(items.map((i) => i.position)).toEqual([1, 2, 3])
    expect(items.map((i) => i.name)).toEqual(['Inicio', 'Palermo Soho', 'Bares'])
  })

  it('las URLs son absolutas', () => {
    const items = (breadcrumbJsonLd(migas) as Record<string, unknown>)
      .itemListElement as Record<string, unknown>[]
    expect(items[1].item).toMatch(/^https?:\/\/.+\/salir\/palermo-soho$/)
  })

  // La ÚLTIMA miga es la página actual y no se linkea a sí misma: omitir `item`
  // ahí es lo que Google espera («if the breadcrumb is the last item… `item` is
  // not required»), y usa la URL de la página.
  //
  // ⚠️ Este comportamiento es correcto y **no** hay que "arreglarlo", pero decía
  // de más: el comentario viejo lo justificaba con el escalón de Tipo de una ficha
  // sin página de combo, que **no es el último**, y un escalón del medio sin `item`
  // invalida el `BreadcrumbList` entero (Search Console, 2026-08-24). Quien sostiene
  // ese invariante es `migasDeFicha` (`lib/lugar/ficha.ts`), no esta función.
  it('omite `item` cuando la miga no tiene path (la última, que es la página actual)', () => {
    const items = (breadcrumbJsonLd(migas) as Record<string, unknown>)
      .itemListElement as Record<string, unknown>[]
    expect(items[2]).not.toHaveProperty('item')
  })

  it('sin migas devuelve una lista vacía, no una clave rota', () => {
    expect((breadcrumbJsonLd([]) as Record<string, unknown>).itemListElement).toEqual([])
  })
})

describe('itemListJsonLd', () => {
  const lugares = [
    { id: '11111111-2222-3333-4444-555555555555', name: 'Bar Uno' },
    { id: '66666666-7777-8888-9999-000000000000', name: 'Bar Dos' },
  ]

  it('respeta el orden de la página (que es el de ORDEN_ORGANICO)', () => {
    const items = (itemListJsonLd(lugares) as Record<string, unknown>)
      .itemListElement as Record<string, unknown>[]
    expect(items.map((i) => i.position)).toEqual([1, 2])
    expect(items.map((i) => i.name)).toEqual(['Bar Uno', 'Bar Dos'])
  })

  it('las URLs de ficha son absolutas y salen de urlAbsolutaDeLugar', () => {
    const items = (itemListJsonLd(lugares) as Record<string, unknown>)
      .itemListElement as Record<string, unknown>[]
    expect(items[0].url).toMatch(new RegExp(`^https?://.+/lugar/${lugares[0].id}$`))
  })

  it('no emite ninguna clave de rating, precio, reseñas ni imagen de Google', () => {
    const claves = clavesDe(itemListJsonLd(lugares))
    for (const prohibida of CLAVES_PROHIBIDAS) {
      expect(claves, `clave prohibida en el JSON-LD: ${prohibida}`).not.toContain(prohibida)
    }
  })

  it('un nombre hostil sale escapado por el mismo serializador', () => {
    const salida = serializarJsonLd(itemListJsonLd([{ id: lugares[0].id, name: '</script>' }]))
    expect(salida).not.toContain('<')
  })
})

/**
 * La entidad del sitio (GEO, decisión 6). Dos regresiones:
 *
 *  1. **Que exista y esté completa.** Es lo único que le dice a un asistente qué
 *     es `adondesalimos.com.ar`: el `<h1>` de la home rota entre cuatro ocasiones
 *     en cada render, así que si esto se rompe no queda nada estable que leer.
 *  2. **El mismo ToS de Google que la ficha**, más el `aggregateRating` — que acá
 *     ni siquiera sería de Google: sería inventado, porque no tenemos reseñas
 *     propias. Un rating falso en JSON-LD es motivo de acción manual.
 */
describe('sitioJsonLd — la entidad de la app', () => {
  const tipos = (ld: Record<string, unknown>) =>
    (ld['@graph'] as Record<string, unknown>[]).map((n) => n['@type'])

  const nodo = (ld: Record<string, unknown>, tipo: string) =>
    (ld['@graph'] as Record<string, unknown>[]).find((n) => n['@type'] === tipo)!

  it('emite WebSite y WebApplication en el mismo grafo', () => {
    expect(tipos(sitioJsonLd())).toEqual(['WebSite', 'WebApplication'])
  })

  it('las dos entidades llevan name, url, description e inLanguage', () => {
    const ld = sitioJsonLd()
    for (const tipo of ['WebSite', 'WebApplication']) {
      const n = nodo(ld, tipo)
      expect(n.name, tipo).toBe(MARCA)
      expect(n.description, tipo).toBe(DESCRIPCION)
      expect(n.inLanguage, tipo).toBe('es-AR')
      expect(n.url, tipo).toBe(`${APP_URL}/`)
    }
  })

  // El alcance es la mitad del posicionamiento (decisión 12): lo que las apps de
  // votación internacionales no cruzan es justamente el catálogo local.
  it('declara el área servida y la categoría en la WebApplication', () => {
    const app = nodo(sitioJsonLd(), 'WebApplication')
    expect(app.applicationCategory).toBe('LifestyleApplication')
    expect((app.areaServed as Record<string, unknown>).name).toContain('Buenos Aires')
  })

  it('el WebApplication cuelga del WebSite por @id, no queda suelto', () => {
    const ld = sitioJsonLd()
    const app = nodo(ld, 'WebApplication')
    expect((app.isPartOf as Record<string, unknown>)['@id']).toBe(nodo(ld, 'WebSite')['@id'])
  })

  it('no emite aggregateRating ni ninguna clave con dato de Google', () => {
    const claves = clavesDe(sitioJsonLd())
    for (const prohibida of CLAVES_PROHIBIDAS) {
      expect(claves, `clave prohibida en la entidad del sitio: ${prohibida}`).not.toContain(
        prohibida,
      )
    }
  })

  it('sale por el mismo serializador que todo lo demás', () => {
    expect(serializarJsonLd(sitioJsonLd())).not.toContain('<')
  })
})
