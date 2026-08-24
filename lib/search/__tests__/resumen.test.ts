import { describe, expect, it } from 'vitest'
import { contarLugares, resumirBusqueda } from '../resumen'

describe('contarLugares', () => {
  it('formatea en es-AR (punto de miles, no coma)', () => {
    expect(contarLugares(1095)).toBe('1.095 lugares')
  })

  it('singulariza en 1', () => {
    expect(contarLugares(1)).toBe('1 lugar')
  })

  it('el 0 va en plural', () => {
    expect(contarLugares(0)).toBe('0 lugares')
  })
})

describe('resumirBusqueda', () => {
  it('con una zona nombra la zona y explica el buffer (PBETA-R1-03)', () => {
    const r = resumirBusqueda({ total: 1095, zonas: ['Palermo Soho'], gps: false })
    expect(r.titulo).toBe('1.095 lugares en Palermo Soho')
    expect(r.aclaracion).toBe('Si una card dice otro barrio, está a 400 m o menos.')
  })

  it('con varias zonas no las enumera: el chip de arriba ya dice cuáles son', () => {
    const r = resumirBusqueda({
      total: 40,
      zonas: ['Palermo Soho', 'Villa Crespo', 'Chacarita y Colegiales'],
      gps: false,
    })
    expect(r.titulo).toBe('40 lugares en 3 zonas')
    expect(r.aclaracion).not.toBeNull()
  })

  it('sin zona no habla de bordes: no hay ninguno que explicar', () => {
    const r = resumirBusqueda({ total: 300, zonas: [], gps: false })
    expect(r.titulo).toBe('300 lugares')
    expect(r.aclaracion).toBeNull()
  })

  it('en GPS manda el radio y tampoco hay buffer que aclarar (decisión 3 + 17)', () => {
    const r = resumirBusqueda({ total: 12, zonas: ['Palermo Soho'], gps: true })
    expect(r.titulo).toBe('12 lugares a menos de 2 km')
    expect(r.aclaracion).toBeNull()
  })
})
