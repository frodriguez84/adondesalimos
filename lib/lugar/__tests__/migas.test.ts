import { describe, expect, it } from 'vitest'

import { breadcrumbJsonLd } from '@/lib/seo/jsonld'

import { migasDeFicha } from '../migas'

/**
 * Regresión de Search Console (2026-08-24): *«Falta el campo "item" (en
 * "itemListElement")»* sobre **2.250 de las 18.993 fichas publicadas**.
 *
 * En un `BreadcrumbList` de Google, `item` es obligatorio en **todos** los
 * escalones menos el último. `breadcrumbJsonLd` omite `item` cuando la miga no
 * tiene `path` —y está bien que lo haga, es lo que permite que el último escalón
 * no se linkee a sí mismo—, así que **el invariante tiene que sostenerlo quien
 * arma la lista**: ninguna miga que no sea la última puede venir sin `path`.
 *
 * El caso real era el Tipo: se emitía siempre pero solo linkea si el combo
 * zona × tipo tiene página propia, y con el Nombre cerrando la ruta quedaba en el
 * medio sin `item`, invalidando el breadcrumb entero.
 */
describe('migasDeFicha — el invariante del BreadcrumbList', () => {
  const zona = { name: 'Palermo Soho', slug: 'palermo-soho' }
  const tipo = { name: 'Bar', slug: 'bar' }

  /** Lo que Google exige: solo la última puede ir sin `path`. */
  const soloLaUltimaSinPath = (migas: { path: string | null }[]) =>
    migas.slice(0, -1).every((m) => m.path !== null)

  it('con página de tipo emite los cuatro escalones y solo el último va sin path', () => {
    const migas = migasDeFicha({ zona, tipo, tipoConPagina: true, nombre: 'Don Julio' })
    expect(migas.map((m) => m.name)).toEqual(['Inicio', 'Palermo Soho', 'Bar', 'Don Julio'])
    expect(migas[2].path).toBe('/salir/palermo-soho/bar')
    expect(soloLaUltimaSinPath(migas)).toBe(true)
  })

  // El caso de Baum Ranelagh: Berazategui no llega al piso de 10 cervecerías.
  it('sin página de tipo NO emite el escalón de Tipo (era el bug)', () => {
    const migas = migasDeFicha({
      zona: { name: 'Berazategui', slug: 'berazategui' },
      tipo: { name: 'Cervecería', slug: 'cerveceria' },
      tipoConPagina: false,
      nombre: 'Baum Ranelagh',
    })
    expect(migas.map((m) => m.name)).toEqual(['Inicio', 'Berazategui', 'Baum Ranelagh'])
    expect(soloLaUltimaSinPath(migas)).toBe(true)
  })

  // Los 1.890 sin zona primaria, que eran el grueso de las 2.250.
  it('sin zona no hay combo posible, así que el Tipo tampoco entra', () => {
    const migas = migasDeFicha({ zona: null, tipo, tipoConPagina: true, nombre: 'Un lugar' })
    expect(migas.map((m) => m.name)).toEqual(['Inicio', 'Un lugar'])
    expect(soloLaUltimaSinPath(migas)).toBe(true)
  })

  it('sin tipo la ruta es Inicio › Zona › Nombre', () => {
    const migas = migasDeFicha({ zona, tipo: null, tipoConPagina: false, nombre: 'Un lugar' })
    expect(migas.map((m) => m.name)).toEqual(['Inicio', 'Palermo Soho', 'Un lugar'])
    expect(soloLaUltimaSinPath(migas)).toBe(true)
  })

  // El barrido: ninguna de las 8 combinaciones puede violar el invariante.
  it('el invariante se sostiene en las 8 combinaciones posibles', () => {
    for (const z of [zona, null]) {
      for (const t of [tipo, null]) {
        for (const conPagina of [true, false]) {
          const migas = migasDeFicha({
            zona: z,
            tipo: t,
            tipoConPagina: conPagina,
            nombre: 'X',
          })
          expect(
            soloLaUltimaSinPath(migas),
            `zona=${Boolean(z)} tipo=${Boolean(t)} conPagina=${conPagina}`,
          ).toBe(true)
          // Y el Nombre cierra siempre: es lo que deja al Tipo linkeable cuando
          // existe (`components/shared/breadcrumb.tsx` nunca linkea la última).
          expect(migas.at(-1)).toEqual({ name: 'X', path: null })
        }
      }
    }
  })

  // La otra mitad: lo que sale de acá tiene que producir un BreadcrumbList válido.
  it('el JSON-LD resultante nunca deja un ListItem del medio sin `item`', () => {
    const migas = migasDeFicha({
      zona: { name: 'Berazategui', slug: 'berazategui' },
      tipo: { name: 'Cervecería', slug: 'cerveceria' },
      tipoConPagina: false,
      nombre: 'Baum Ranelagh',
    })
    const items = (breadcrumbJsonLd(migas) as Record<string, unknown>)
      .itemListElement as Record<string, unknown>[]
    for (const item of items.slice(0, -1)) {
      expect(item, `posición ${item.position} sin item`).toHaveProperty('item')
    }
  })
})
