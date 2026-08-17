import { describe, expect, it } from 'vitest'
import {
  CAMPOS_DE_CONTACTO,
  CAMPOS_PAGOS,
  capDeFotos,
  puedeEditarContacto,
  resolverContenidoDueno,
} from '../contenido'

/**
 * Las dos reglas de F3 que tienen que estar bien: el COALESCE dueño → Overture
 * (decisión 13) y el gating por plan (decisiones 17 y 18). Puras: se testean sin
 * base y sin R2.
 */

const BASE = {
  phones: ['11 4000 0000'],
  websites: ['https://overture.example'],
  socials: ['https://instagram.com/vieja'],
}

const OWNER = {
  phone: '11 5555 5555',
  website: 'https://propio.example',
  socials: ['https://instagram.com/nueva'],
  description: 'Un bodegón de barrio.',
  menuUrl: 'https://propio.example/carta',
  news: 'Happy hour de 18 a 20',
}

describe('resolverContenidoDueno — COALESCE dueño → base', () => {
  it('sin fila de dueño devuelve la base tal cual', () => {
    const r = resolverContenidoDueno({ base: BASE, owner: null, plan: 'free' })
    expect(r.phone).toBe('11 4000 0000')
    expect(r.website).toBe('https://overture.example')
    expect(r.socials).toEqual(['https://instagram.com/vieja'])
  })

  it('lo que el dueño cargó le gana a Overture', () => {
    const r = resolverContenidoDueno({ base: BASE, owner: OWNER, plan: 'free' })
    expect(r.phone).toBe('11 5555 5555')
    expect(r.website).toBe('https://propio.example')
  })

  it('un campo del dueño en null cae a la base — borrar no deja hueco', () => {
    const r = resolverContenidoDueno({
      base: BASE,
      owner: { ...OWNER, phone: null },
      plan: 'free',
    })
    expect(r.phone).toBe('11 4000 0000')
  })

  it('sin dato en ningún lado, null (la ficha no renderiza la línea)', () => {
    const r = resolverContenidoDueno({
      base: { phones: [], websites: [], socials: [] },
      owner: null,
      plan: 'free',
    })
    expect(r.phone).toBeNull()
    expect(r.website).toBeNull()
    expect(r.socials).toEqual([])
  })

  it('las redes del dueño REEMPLAZAN a las de Overture, no se mezclan', () => {
    const r = resolverContenidoDueno({ base: BASE, owner: OWNER, plan: 'free' })
    expect(r.socials).toEqual(['https://instagram.com/nueva'])
  })

  it('redes del dueño vacías caen a las de Overture', () => {
    const r = resolverContenidoDueno({ base: BASE, owner: { ...OWNER, socials: [] }, plan: 'free' })
    expect(r.socials).toEqual(['https://instagram.com/vieja'])
  })
})

describe('resolverContenidoDueno — gating por plan (decisión 18)', () => {
  it('con free los tres campos pagos NO se muestran aunque estén cargados', () => {
    const r = resolverContenidoDueno({ base: BASE, owner: OWNER, plan: 'free' })
    expect(r.description).toBeNull()
    expect(r.menuUrl).toBeNull()
    expect(r.news).toBeNull()
  })

  it('con paid se muestran', () => {
    const r = resolverContenidoDueno({ base: BASE, owner: OWNER, plan: 'paid' })
    expect(r.description).toBe('Un bodegón de barrio.')
    expect(r.menuUrl).toBe('https://propio.example/carta')
    expect(r.news).toBe('Happy hour de 18 a 20')
  })

  it('volver a free los oculta sin tocar el dato guardado', () => {
    const guardado = { ...OWNER }
    const conPlan = resolverContenidoDueno({ base: BASE, owner: guardado, plan: 'paid' })
    const sinPlan = resolverContenidoDueno({ base: BASE, owner: guardado, plan: 'free' })
    expect(conPlan.description).not.toBeNull()
    expect(sinPlan.description).toBeNull()
    // El objeto de entrada quedó intacto: ocultar no es borrar.
    expect(guardado.description).toBe('Un bodegón de barrio.')
  })

  it('el gating no toca los campos free', () => {
    const r = resolverContenidoDueno({ base: BASE, owner: OWNER, plan: 'free' })
    expect(r.phone).toBe('11 5555 5555')
    expect(r.website).toBe('https://propio.example')
  })
})

describe('caps de fotos (decisiones 5 y 17)', () => {
  it('3 en free, 15 en pago', () => {
    expect(capDeFotos('free')).toBe(3)
    expect(capDeFotos('paid')).toBe(15)
  })

  it('los campos pagos son exactamente los tres del spec', () => {
    expect([...CAMPOS_PAGOS]).toEqual(['description', 'menuUrl', 'news'])
  })
})

describe('recorte del contacto (TITULARIDAD decisiones 1 y 7)', () => {
  it('solo un lugar que nació del dueño deja editar el contacto', () => {
    expect(puedeEditarContacto('owner')).toBe(true)
    // En Overture el contacto es de un negocio preexistente: pisarlo desvía sus
    // llamadas a un competidor.
    expect(puedeEditarContacto('overture')).toBe(false)
  })

  it('los campos recortados son exactamente los tres del spec', () => {
    expect([...CAMPOS_DE_CONTACTO]).toEqual(['phone', 'website', 'socials'])
  })

  it('el recorte es sobre ESCRIBIR: la ficha sigue mostrando lo ya cargado', () => {
    // Un lugar de Overture cuyo dueño cargó su teléfono antes del recorte: la
    // resolución no cambia (decisión: apagar lo cargado sería quitarle un dato
    // correcto a un dueño legítimo por una regla que no existía).
    const r = resolverContenidoDueno({ base: BASE, owner: OWNER, plan: 'free' })
    expect(r.phone).toBe('11 5555 5555')
    expect(r.website).toBe('https://propio.example')
    expect(r.socials).toEqual(['https://instagram.com/nueva'])
  })
})
