import { describe, expect, it } from 'vitest'
import {
  DIAS,
  esHoraValida,
  estaAbierto,
  haySolapamiento,
  lineasSemana,
  minutosDe,
  normalizarSemana,
  partesEnAR,
  semanaVacia,
  tieneAlgunHorario,
  type HorariosSemana,
} from '../horarios'

/**
 * El cálculo de "abierto ahora" con rangos que cruzan la medianoche es lo que más
 * fácil sale mal (edge case explícito del spec). Se testea con `Date` fijos en
 * UTC y su equivalente en hora de AR (UTC−3, sin horario de verano) para no
 * depender del reloj de la máquina.
 *
 * Referencia: 2024-01-01 fue **lunes**. AR = UTC−3, así que las 23:00 del lunes
 * en AR son las 02:00Z del martes.
 */

/** Semana con un solo día abierto, con los rangos dados. */
function soloDia(dia: (typeof DIAS)[number], rangos: HorariosSemana[keyof HorariosSemana]) {
  return { ...semanaVacia(), [dia]: rangos }
}

describe('partesEnAR — hora local de Buenos Aires', () => {
  it('las 23:00 del lunes AR (02:00Z del martes) son lunes 23:00', () => {
    const p = partesEnAR(new Date('2024-01-02T02:00:00Z'))
    expect(p.dia).toBe(0) // lunes
    expect(p.minutos).toBe(23 * 60)
  })

  it('la 01:30 del martes AR (04:30Z del martes) es martes 01:30', () => {
    const p = partesEnAR(new Date('2024-01-02T04:30:00Z'))
    expect(p.dia).toBe(1) // martes
    expect(p.minutos).toBe(90)
  })
})

describe('estaAbierto — rango que cruza la medianoche (20:00–02:00)', () => {
  const semana = soloDia('lunes', [{ abre: '20:00', cierra: '02:00' }])

  it('lunes 23:00: abierto (tramo de la noche de hoy)', () => {
    expect(estaAbierto(semana, new Date('2024-01-02T02:00:00Z'))).toBe(true)
  })

  it('martes 01:30: abierto (cola de la madrugada, pertenece al lunes)', () => {
    expect(estaAbierto(semana, new Date('2024-01-02T04:30:00Z'))).toBe(true)
  })

  it('martes 03:00: cerrado (ya cerró a las 02:00)', () => {
    expect(estaAbierto(semana, new Date('2024-01-02T06:00:00Z'))).toBe(false)
  })

  it('lunes 19:00: cerrado (todavía no abrió)', () => {
    expect(estaAbierto(semana, new Date('2024-01-01T22:00:00Z'))).toBe(false)
  })

  it('lunes 20:00 justo: abierto (borde inclusivo de apertura)', () => {
    expect(estaAbierto(semana, new Date('2024-01-01T23:00:00Z'))).toBe(true)
  })
})

describe('estaAbierto — el cruce respeta el salto de semana (domingo → lunes)', () => {
  // Domingo 2024-01-07, rango 20:00–02:00: cierra la madrugada del lunes.
  const semana = soloDia('domingo', [{ abre: '20:00', cierra: '02:00' }])

  it('domingo 23:00: abierto', () => {
    // Domingo 23:00 AR = 02:00Z del lunes 2024-01-08.
    expect(estaAbierto(semana, new Date('2024-01-08T02:00:00Z'))).toBe(true)
  })

  it('lunes 01:30: abierto (cola del domingo, día anterior = domingo)', () => {
    // Lunes 01:30 AR = 04:30Z del lunes 2024-01-08.
    expect(estaAbierto(semana, new Date('2024-01-08T04:30:00Z'))).toBe(true)
  })
})

describe('estaAbierto — rango normal dentro del día', () => {
  const semana = soloDia('martes', [{ abre: '09:00', cierra: '18:00' }])

  it('martes 12:00: abierto', () => {
    expect(estaAbierto(semana, new Date('2024-01-02T15:00:00Z'))).toBe(true)
  })

  it('martes 18:00 justo: cerrado (borde de cierre exclusivo)', () => {
    expect(estaAbierto(semana, new Date('2024-01-02T21:00:00Z'))).toBe(false)
  })

  it('miércoles 12:00: cerrado (otro día)', () => {
    expect(estaAbierto(semana, new Date('2024-01-03T15:00:00Z'))).toBe(false)
  })

  it('un día sin rangos siempre está cerrado', () => {
    expect(estaAbierto(semanaVacia(), new Date('2024-01-02T15:00:00Z'))).toBe(false)
  })
})

describe('haySolapamiento', () => {
  it('dos rangos que no se tocan: no', () => {
    expect(
      haySolapamiento([
        { abre: '09:00', cierra: '13:00' },
        { abre: '20:00', cierra: '23:00' },
      ]),
    ).toBe(false)
  })

  it('dos rangos que se pisan: sí', () => {
    expect(
      haySolapamiento([
        { abre: '09:00', cierra: '14:00' },
        { abre: '13:00', cierra: '18:00' },
      ]),
    ).toBe(true)
  })

  it('un rango que cruza la medianoche pisa otro de esa misma noche', () => {
    expect(
      haySolapamiento([
        { abre: '20:00', cierra: '02:00' },
        { abre: '21:00', cierra: '23:00' },
      ]),
    ).toBe(true)
  })

  it('un cierre en la madrugada NO pisa una franja de mañana del mismo día', () => {
    // 20:00–02:00 cierra a las 02:00 del día siguiente; 09:00–13:00 es de la
    // mañana de HOY. Como intervalos literales no se tocan (la cola cae al otro día).
    expect(
      haySolapamiento([
        { abre: '20:00', cierra: '02:00' },
        { abre: '09:00', cierra: '13:00' },
      ]),
    ).toBe(false)
  })
})

describe('lineasSemana', () => {
  it('rotula cada día, y "Cerrado" cuando no hay rangos', () => {
    const semana = soloDia('viernes', [{ abre: '20:00', cierra: '02:00' }])
    const lineas = lineasSemana(semana)
    expect(lineas).toHaveLength(7)
    expect(lineas[4]).toBe('Viernes: 20:00–02:00')
    expect(lineas[0]).toBe('Lunes: Cerrado')
  })
})

describe('helpers de forma', () => {
  it('tieneAlgunHorario distingue una semana vacía de una con rangos', () => {
    expect(tieneAlgunHorario(semanaVacia())).toBe(false)
    expect(tieneAlgunHorario(null)).toBe(false)
    expect(tieneAlgunHorario(soloDia('lunes', [{ abre: '09:00', cierra: '18:00' }]))).toBe(true)
  })

  it('normalizarSemana completa los 7 días y descarta basura', () => {
    const norm = normalizarSemana({ lunes: [{ abre: '09:00', cierra: '18:00' }], basura: 1 })
    expect(Object.keys(norm).sort()).toEqual([...DIAS].sort())
    expect(norm.lunes).toEqual([{ abre: '09:00', cierra: '18:00' }])
    expect(norm.martes).toEqual([])
  })

  it('normalizarSemana de null o de algo que no es objeto ⇒ semana vacía', () => {
    expect(tieneAlgunHorario(normalizarSemana(null))).toBe(false)
    expect(tieneAlgunHorario(normalizarSemana('x'))).toBe(false)
  })

  it('esHoraValida y minutosDe', () => {
    expect(esHoraValida('00:00')).toBe(true)
    expect(esHoraValida('23:59')).toBe(true)
    expect(esHoraValida('24:00')).toBe(false)
    expect(esHoraValida('9:00')).toBe(false)
    expect(minutosDe('02:30')).toBe(150)
  })
})
