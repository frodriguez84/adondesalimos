import { describe, expect, it } from 'vitest'
import { beneficiosDe } from '@/lib/billing/beneficios'
import { CAP_FOTOS } from '@/lib/negocio/contenido'

/**
 * Regresión del dueño único de "qué incluye cada plan". Lo que se protege acá no es
 * el copy —ese cambia— sino las dos formas en que la lista puede volver a mentir:
 * prometer un cupo sin decirlo, y quedar con un número viejo en la página estática.
 */
describe('beneficiosDe', () => {
  it('dice el cupo del chat cuando lo tiene, y no lo omite cuando no', () => {
    // El bug original: el pitch prometía el chat sin mencionar que tiene tope.
    const conCupo = beneficiosDe('b2c', { chatMensual: 30, listas: 10 })
    expect(conCupo.some((b) => b.includes('30 mensajes por mes'))).toBe(true)
    expect(conCupo.some((b) => b.includes('Hasta 10 listas'))).toBe(true)

    const sinCupo = beneficiosDe('b2c')
    expect(sinCupo.some((b) => b.includes('cupo mensual'))).toBe(true)
    expect(sinCupo.some((b) => /listas/.test(b))).toBe(true)
  })

  it('sin cupos no inventa números: `/legales/**` es estático y no lee app_settings', () => {
    // Si acá aparece un dígito, alguien hardcodeó un cupo que un UPDATE deja viejo.
    for (const beneficio of beneficiosDe('b2c')) {
      expect(beneficio).not.toMatch(/\d/)
    }
  })

  it('el cap de fotos del B2B sale de su dueño, no de un literal', () => {
    const b2b = beneficiosDe('b2b')
    expect(b2b.some((b) => b.includes(`Hasta ${CAP_FOTOS.paid} fotos`))).toBe(true)
    // Los otros tres gates pagos que el pitch tiene que nombrar.
    expect(b2b.some((b) => /carta/.test(b))).toBe(true)
    expect(b2b.some((b) => /destacado/.test(b))).toBe(true)
    expect(b2b.some((b) => /estadísticas/.test(b))).toBe(true)
  })

  it('no promete votaciones ilimitadas de más ni de menos', () => {
    // El gate de "1 activa" corre solo para free, así que "ilimitadas" es cierto.
    expect(beneficiosDe('b2c').some((b) => /ilimitadas/.test(b))).toBe(true)
    expect(beneficiosDe('b2b').some((b) => /ilimitadas/.test(b))).toBe(false)
  })
})
