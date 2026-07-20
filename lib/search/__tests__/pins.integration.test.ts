import 'dotenv/config'
import { describe, expect, it } from 'vitest'

import { EMPTY_SEARCH, MAP_PIN_LIMIT } from '../params'
import { searchPins, searchPlaces } from '../query'

/**
 * Los pins de la vista mapa contra la base real.
 *
 * El invariante que importa: **el mapa y la lista muestran lo mismo**. Traen
 * distinta cantidad (20 contra 200) a propósito, pero comparten `where` y orden,
 * así que los pins tienen que ser el encabezado exacto de la lista. Si
 * divergieran, "ver en mapa" mostraría otros lugares que los resultados — que es
 * justo lo que el botón promete que no pasa.
 */

describe.runIf(process.env.DATABASE_URL)('pins del mapa', () => {
  const zonaDensa = { ...EMPTY_SEARCH, zones: ['palermo-soho'] }

  it('nunca devuelve más pins que el tope', async () => {
    const { places } = await searchPins(zonaDensa)
    expect(places.length).toBeLessThanOrEqual(MAP_PIN_LIMIT)
  })

  it('marca truncated cuando el resultado excede el tope', async () => {
    // Palermo Soho tiene bastante más de 200 lugares publicados, así que el
    // mapa tiene que avisar que está mostrando una parte.
    const { places, truncated } = await searchPins(zonaDensa)
    if (truncated) {
      expect(places.length).toBe(MAP_PIN_LIMIT)
    } else {
      expect(places.length).toBeLessThan(MAP_PIN_LIMIT)
    }
  })

  it('los pins son el encabezado exacto de la lista, en el mismo orden', async () => {
    const lista = await searchPlaces(zonaDensa)
    const { places: pins } = await searchPins(zonaDensa)

    expect(pins.slice(0, lista.places.length).map((p) => p.id)).toEqual(
      lista.places.map((p) => p.id),
    )
  })

  it('respeta los filtros igual que la lista', async () => {
    const conTag = { ...zonaDensa, tags: ['bar'] }
    const { places } = await searchPins(conTag)

    expect(places.length).toBeGreaterThan(0)
    for (const p of places) {
      expect(p.tags.some((t) => t.slug === 'bar')).toBe(true)
    }
  })

  it('todo pin trae coordenadas usables', async () => {
    // Un pin sin lat/lng rompe el `fitBounds` del mapa y no se dibuja.
    const { places } = await searchPins(zonaDensa)
    for (const p of places) {
      expect(Number.isFinite(p.lat), p.name).toBe(true)
      expect(Number.isFinite(p.lng), p.name).toBe(true)
    }
  })

  it('sin criterios de búsqueda no mapea el catálogo entero', async () => {
    // La contraparte de la decisión 2 para el mapa. El route handler ya corta
    // antes, pero la función no debería depender de eso para ser segura.
    const { places } = await searchPins(EMPTY_SEARCH)
    expect(places.length).toBeLessThanOrEqual(MAP_PIN_LIMIT)
  })
})
