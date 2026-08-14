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
  proximaApertura,
  semanaVacia,
  textoProximaApertura,
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

/**
 * PBETA-R1-07: «Cerrado ahora» no respondía la única pregunta que importa cuando
 * estás por salir. Los `Date` siguen siendo fijos en UTC (2024-01-01 = lunes).
 */
describe('proximaApertura', () => {
  it('abre hoy más tarde: lunes 15:00 con rango 19:00–02:00', () => {
    const semana = soloDia('lunes', [{ abre: '19:00', cierra: '02:00' }])
    expect(proximaApertura(semana, new Date('2024-01-01T18:00:00Z'))).toEqual({
      dia: 0,
      minutos: 19 * 60,
      enDias: 0,
    })
  })

  it('el rango de hoy ya pasó: salta al día siguiente', () => {
    const semana = {
      ...semanaVacia(),
      lunes: [{ abre: '09:00', cierra: '18:00' }],
      martes: [{ abre: '09:00', cierra: '18:00' }],
    }
    // Lunes 20:00 AR = 23:00Z del lunes.
    expect(proximaApertura(semana, new Date('2024-01-01T23:00:00Z'))).toEqual({
      dia: 1,
      minutos: 9 * 60,
      enDias: 1,
    })
  })

  it('elige la apertura más temprana de las que quedan en el día', () => {
    const semana = soloDia('lunes', [
      { abre: '19:00', cierra: '23:00' },
      { abre: '09:00', cierra: '12:00' },
    ])
    // Lunes 13:00 AR: la de las 09:00 ya pasó.
    expect(proximaApertura(semana, new Date('2024-01-01T16:00:00Z'))?.minutos).toBe(19 * 60)
  })

  it('cruza el fin de semana: sábado 22:00 → domingo', () => {
    const semana = soloDia('domingo', [{ abre: '20:00', cierra: '23:00' }])
    // Sábado 2024-01-06 22:00 AR = 01:00Z del domingo 07.
    expect(proximaApertura(semana, new Date('2024-01-07T01:00:00Z'))).toEqual({
      dia: 6,
      minutos: 20 * 60,
      enDias: 1,
    })
  })

  it('si recién abre dentro de 7 días ⇒ null (decir "abre el lunes" un lunes confunde)', () => {
    const semana = soloDia('lunes', [{ abre: '10:00', cierra: '14:00' }])
    // Lunes 15:00 AR: la próxima es el lunes que viene, fuera de la ventana.
    expect(proximaApertura(semana, new Date('2024-01-01T18:00:00Z'))).toBeNull()
  })

  it('una semana sin horarios no abre nunca', () => {
    expect(proximaApertura(semanaVacia(), new Date('2024-01-01T18:00:00Z'))).toBeNull()
  })
})

describe('textoProximaApertura — la frase de la ficha', () => {
  it('hoy, mañana y el resto de la semana', () => {
    expect(textoProximaApertura({ dia: 0, minutos: 19 * 60, enDias: 0 })).toBe('abre a las 19')
    expect(textoProximaApertura({ dia: 1, minutos: 9 * 60, enDias: 1 })).toBe('abre mañana a las 9')
    expect(textoProximaApertura({ dia: 3, minutos: 19 * 60, enDias: 3 })).toBe(
      'abre el jueves a las 19',
    )
  })

  it('el día lleva su acento y va en minúscula dentro de la oración', () => {
    expect(textoProximaApertura({ dia: 2, minutos: 20 * 60, enDias: 2 })).toBe(
      'abre el miércoles a las 20',
    )
  })

  it('la una lleva artículo singular, y la medianoche se dice con todas las letras', () => {
    expect(textoProximaApertura({ dia: 0, minutos: 60, enDias: 0 })).toBe('abre a la 1')
    expect(textoProximaApertura({ dia: 0, minutos: 90, enDias: 0 })).toBe('abre a la 1:30')
    expect(textoProximaApertura({ dia: 0, minutos: 0, enDias: 0 })).toBe('abre a la medianoche')
  })

  it('los minutos van con dos dígitos', () => {
    expect(textoProximaApertura({ dia: 0, minutos: 19 * 60 + 5, enDias: 0 })).toBe('abre a las 19:05')
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
