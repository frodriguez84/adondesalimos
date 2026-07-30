import { describe, expect, it } from 'vitest'

import { FRANJAS, franjaActual, NOMBRE_AHORA } from '../ahora'

/**
 * La franja del chip «Para ahora» (ABIERTO_AHORA F1).
 *
 * Igual que `lib/negocio/__tests__/horarios.test.ts`: `Date` fijos en UTC con su
 * equivalente en hora de AR (UTC−3, sin horario de verano), para no depender del
 * reloj ni de la TZ de la máquina que corre los tests. `2024-01-01` fue **lunes**.
 *
 * Los bordes son el criterio AHORA-10 del spec: 05:59 / 06:00 / 10:59 / 11:00 /
 * 15:29 / 15:30 / 19:59 / 20:00 / 23:59, más la medianoche.
 */

/** `hh:mm` de AR (UTC−3) del 2024-01-01 → el `Date` en UTC que le corresponde. */
function enAR(hh: number, mm = 0): Date {
  const utc = hh + 3
  const dia = utc >= 24 ? 2 : 1
  const h = String(utc % 24).padStart(2, '0')
  return new Date(`2024-01-0${dia}T${h}:${String(mm).padStart(2, '0')}:00Z`)
}

describe('franjaActual — una hora por franja', () => {
  const casos: [string, number, number, string, string[]][] = [
    ['madrugada', 2, 0, 'madrugada', ['trasnoche', 'hasta-tarde']],
    ['media mañana', 8, 30, 'desayuno', ['desayuno']],
    ['mediodía', 13, 0, 'almuerzo', ['almuerzo']],
    ['tarde', 17, 0, 'merienda', ['merienda']],
    ['noche', 21, 30, 'cena', ['cena']],
  ]

  for (const [rotulo, hh, mm, slug, tags] of casos) {
    it(`${rotulo} (${hh}:${String(mm).padStart(2, '0')} AR) ⇒ ${slug}`, () => {
      const f = franjaActual(enAR(hh, mm))
      expect(f.slug).toBe(slug)
      expect(f.tags).toEqual(tags)
    })
  }
})

describe('franjaActual — los bordes de la decisión 3 (AHORA-10)', () => {
  const bordes: [number, number, string][] = [
    [0, 0, 'madrugada'], // medianoche justa
    [5, 59, 'madrugada'],
    [6, 0, 'desayuno'],
    [10, 59, 'desayuno'],
    [11, 0, 'almuerzo'],
    [15, 29, 'almuerzo'],
    [15, 30, 'merienda'],
    [19, 59, 'merienda'],
    [20, 0, 'cena'],
    [23, 59, 'cena'],
  ]

  for (const [hh, mm, slug] of bordes) {
    it(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} AR ⇒ ${slug}`, () => {
      expect(franjaActual(enAR(hh, mm)).slug).toBe(slug)
    })
  }
})

describe('franjaActual — cobertura y semántica', () => {
  it('cubre los 1.440 minutos del día sin huecos', () => {
    // La garantía del DoD, verificada minuto a minuto en vez de por muestreo.
    for (let m = 0; m < 24 * 60; m++) {
      const f = franjaActual(enAR(Math.floor(m / 60), m % 60))
      expect(f, `minuto ${m}`).toBeDefined()
      expect(f.tags.length, `minuto ${m}`).toBeGreaterThan(0)
    }
  })

  it('es puro respecto de `now`: la misma hora de AR da la misma franja otro día', () => {
    // 21:00 AR del lunes y del domingo siguiente ⇒ la misma franja.
    expect(franjaActual(new Date('2024-01-02T00:00:00Z')).slug).toBe('cena')
    expect(franjaActual(new Date('2024-01-08T00:00:00Z')).slug).toBe('cena')
  })

  it('el domingo no suma `abre-domingos` (decisión 7)', () => {
    // Domingo 2024-01-07 al mediodía AR (15:00Z): solo `almuerzo`.
    const f = franjaActual(new Date('2024-01-07T15:00:00Z'))
    expect(f.slug).toBe('almuerzo')
    expect(f.tags).toEqual(['almuerzo'])
  })

  it('ninguna franja incluye `abre-domingos`: en la misma faceta ensancharía', () => {
    expect(FRANJAS.some((f) => f.tags.includes('abre-domingos'))).toBe(false)
  })

  it('la madrugada lleva los dos tags: ahí el OR es lo que se quiere (decisión 8)', () => {
    expect(franjaActual(enAR(3)).tags).toEqual(['trasnoche', 'hasta-tarde'])
  })

  it('ninguna franja usa `abierto-ahora`, el tag retirado (decisión 10)', () => {
    expect(FRANJAS.some((f) => f.tags.includes('abierto-ahora'))).toBe(false)
  })

  it('el rótulo nunca dice "abierto" (decisión 2: el copy es el contrato)', () => {
    expect(NOMBRE_AHORA).toBe('Para ahora')
    expect(NOMBRE_AHORA.toLowerCase()).not.toContain('abierto')
  })

  it('las franjas están ordenadas y arrancan en 00:00 (de ahí sale la cobertura)', () => {
    expect(FRANJAS[0].desde).toBe(0)
    for (let i = 1; i < FRANJAS.length; i++) {
      expect(FRANJAS[i].desde).toBeGreaterThan(FRANJAS[i - 1].desde)
    }
  })
})
