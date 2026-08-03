import { describe, expect, it } from 'vitest'
import { TAXONOMIA } from '@/lib/db/taxonomy'
import { CATEGORY_TAG_MAP, tagsForCategory } from '@/lib/overture/tag-map'
import { EXCLUDE_CATEGORIES, INCLUDE_CATEGORIES, isIncluded } from '../categories'

const SLUGS = new Set(TAXONOMIA.flatMap((f) => f.tags.map((t) => t.slug)))
const TIPOS = new Set(TAXONOMIA.find((f) => f.facet === 'tipo')!.tags.map((t) => t.slug))

describe('selección de categorías de Overture', () => {
  it('excluye heladerías, panaderías y casas de postres ("salida vs compra")', () => {
    for (const cat of ['ice_cream_shop', 'bakery', 'dessert_shop']) {
      expect(EXCLUDE_CATEGORIES.has(cat)).toBe(true)
      expect(isIncluded(cat)).toBe(false)
    }
  })

  it('la denylist gana aunque la categoría estuviera en la allowlist', () => {
    const colada = 'bakery'
    expect(new Set([...INCLUDE_CATEGORIES, colada]).has(colada)).toBe(true)
    expect(isIncluded(colada)).toBe(false)
  })

  it('incluye lo obvio del alcance', () => {
    for (const cat of ['restaurant', 'bar', 'cafe', 'brewery', 'wine_bar', 'dance_club', 'bowling_alley', 'escape_room', 'karaoke_venue', 'theatre_venue']) {
      expect(isIncluded(cat)).toBe(true)
    }
  })

  it('no incluye compra ni servicios', () => {
    for (const cat of ['health_food_store', 'food_delivery_service', 'delicatessen', 'wine_wholesaler', 'barber', 'dance_studio']) {
      expect(isIncluded(cat)).toBe(false)
    }
  })

  it('ignora categoría nula', () => {
    expect(isIncluded(null)).toBe(false)
    expect(isIncluded(undefined)).toBe(false)
    expect(isIncluded('')).toBe(false)
  })
})

describe('mapeo categoría → tags', () => {
  it('cada categoría incluida tiene mapeo', () => {
    const sinMapeo = [...INCLUDE_CATEGORIES].filter((c) => tagsForCategory(c).length === 0)
    expect(sinMapeo).toEqual([])
  })

  // Sin este test, un slug mal tipeado explota recién a mitad del import.
  it('todos los slugs del mapeo existen en la taxonomía', () => {
    const desconocidos = Object.entries(CATEGORY_TAG_MAP).flatMap(([cat, slugs]) =>
      slugs.filter((s) => !SLUGS.has(s)).map((s) => `${cat} → ${s}`),
    )
    expect(desconocidos).toEqual([])
  })

  it('cada categoría mapeada asigna al menos un Tipo', () => {
    const sinTipo = Object.entries(CATEGORY_TAG_MAP)
      .filter(([, slugs]) => !slugs.some((s) => TIPOS.has(s)))
      .map(([cat]) => cat)
    expect(sinTipo).toEqual([])
  })

  it('no mapea categorías que no se importan', () => {
    for (const cat of Object.keys(CATEGORY_TAG_MAP)) {
      expect(EXCLUDE_CATEGORIES.has(cat)).toBe(false)
    }
  })

  it('mapea los ejemplos que fija el spec', () => {
    expect(tagsForCategory('pizza_restaurant')).toEqual(['restaurante', 'pizza'])
    expect(tagsForCategory('wine_bar')).toEqual(['wine-bar'])
    expect(tagsForCategory('sushi_restaurant')).toEqual(['restaurante', 'japonesa-sushi'])
  })
})
