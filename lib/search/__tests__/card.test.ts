import { describe, expect, it } from 'vitest'
import { tagsDestacados, ubicacionDeCard } from '../card'

const tag = (slug: string, facet: string) => ({ slug, name: slug, facet })

describe('tagsDestacados', () => {
  it('muestra el Tipo primero y hasta 2 de Actividad/Cocina', () => {
    expect(
      tagsDestacados([
        tag('parrilla', 'cocina'),
        tag('bar', 'tipo'),
        tag('musica-en-vivo', 'actividad'),
        tag('dj', 'actividad'),
      ]),
    ).toEqual(['bar', 'parrilla', 'musica-en-vivo'])
  })

  it('con más de un Tipo muestra uno solo: la card se satura', () => {
    const r = tagsDestacados([tag('bar', 'tipo'), tag('cerveceria', 'tipo')])
    expect(r).toEqual(['bar'])
  })

  it('sin Tipo igual muestra los secundarios', () => {
    expect(tagsDestacados([tag('parrilla', 'cocina')])).toEqual(['parrilla'])
  })

  it('ignora facetas que no van en la card', () => {
    expect(tagsDestacados([tag('bar', 'tipo'), tag('precio-2', 'precio')])).toEqual(['bar'])
  })

  it('sin tags devuelve lista vacía, no rompe', () => {
    expect(tagsDestacados([])).toEqual([])
  })
})

describe('ubicacionDeCard', () => {
  it('usa la zona primaria cuando existe', () => {
    expect(ubicacionDeCard({ zone: 'Palermo Soho', locality: 'CABA' })).toBe('Palermo Soho')
  })

  it('cae a la localidad cuando no hay zona primaria — 1.890 lugares reales', () => {
    expect(ubicacionDeCard({ zone: null, locality: 'José C. Paz' })).toBe('José C. Paz')
  })

  it('devuelve null si no hay ninguna de las dos, en vez de un placeholder vacío', () => {
    expect(ubicacionDeCard({ zone: null, locality: null })).toBeNull()
  })
})
