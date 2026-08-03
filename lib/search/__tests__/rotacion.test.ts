import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  chipsFueraDeVentana,
  chipsPrimero,
  DEFAULT_CHIPS_SCHEDULE,
  resetAvisoRotacion,
  validarReglas,
  type ReglaRotacion,
} from '../rotacion'

/**
 * La rotación de los chips de Ocasión (CHIPS_ROTACION).
 *
 * Mismo enfoque que `ahora.test.ts` y `horarios.test.ts`: `Date` fijos en UTC con
 * su equivalente en hora de AR (UTC−3, sin horario de verano), para no depender
 * del reloj ni de la TZ de la máquina. **`2024-01-01` fue lunes**, así que el
 * día del mes `N + 1` es el día de la semana `N` de la convención del proyecto
 * (0 = lunes).
 */

const LUNES = 0
const MARTES = 1
const MIERCOLES = 2
const JUEVES = 3
const VIERNES = 4
const SABADO = 5
const DOMINGO = 6

/** `hh:mm` de AR del día de semana `dia` (2024-01-01 = lunes) → `Date` en UTC. */
function enAR(dia: number, hh: number, mm = 0): Date {
  const utc = hh + 3
  const diaDelMes = dia + 1 + (utc >= 24 ? 1 : 0)
  const p = (n: number) => String(n).padStart(2, '0')
  return new Date(`2024-01-${p(diaDelMes)}T${p(utc % 24)}:${p(mm)}:00Z`)
}

beforeEach(() => {
  resetAvisoRotacion()
})

describe('chipsPrimero — las reglas semilla (decisión 9)', () => {
  const reglas = validarReglas(DEFAULT_CHIPS_SCHEDULE)

  const casos: [string, number, number, number, string[]][] = [
    ['martes 18:00 ⇒ after office (ROT-01)', MARTES, 18, 0, ['after-office']],
    ['martes 10:00 ⇒ nada, orden por sort (ROT-02)', MARTES, 10, 0, []],
    ['martes 15:00 ⇒ nada (el DoD lo nombra junto al martes 18:00)', MARTES, 15, 0, []],
    ['sábado 15:00 ⇒ nada (el DoD lo nombra junto al sábado 01:00)', SABADO, 15, 0, []],
    ['sábado 01:00 ⇒ bailar, del viernes (ROT-03)', SABADO, 1, 0, ['salir-a-bailar']],
    ['sábado 17:00 ⇒ merienda (ROT-11)', SABADO, 17, 0, ['merienda']],
    ['viernes 23:00 ⇒ bailar (ROT-10)', VIERNES, 23, 0, ['salir-a-bailar']],
    ['domingo 17:00 ⇒ merienda', DOMINGO, 17, 0, ['merienda']],
    ['sábado 18:00 ⇒ merienda, no after office (no es día hábil)', SABADO, 18, 0, ['merienda']],
    ['domingo 23:00 ⇒ nada (bailar es viernes y sábado)', DOMINGO, 23, 0, []],
    ['miércoles 23:00 ⇒ nada', MIERCOLES, 23, 0, []],
    ['domingo 12:00 ⇒ nada (día sin regla a esa hora)', DOMINGO, 12, 0, []],
  ]

  for (const [rotulo, dia, hh, mm, esperado] of casos) {
    it(rotulo, () => {
      expect(chipsPrimero(reglas, enAR(dia, hh, mm))).toEqual(esperado)
    })
  }
})

describe('chipsPrimero — los bordes de cada rango', () => {
  const reglas = validarReglas(DEFAULT_CHIPS_SCHEDULE)

  const bordes: [string, number, number, number, string[]][] = [
    // After office: 17:00–21:00, `desde` inclusive / `hasta` exclusivo.
    ['lunes 16:59', LUNES, 16, 59, []],
    ['lunes 17:00', LUNES, 17, 0, ['after-office']],
    ['lunes 20:59', LUNES, 20, 59, ['after-office']],
    ['lunes 21:00', LUNES, 21, 0, []],
    // Merienda del finde: 16:00–19:00.
    ['sábado 15:59', SABADO, 15, 59, []],
    ['sábado 16:00', SABADO, 16, 0, ['merienda']],
    ['sábado 18:59', SABADO, 18, 59, ['merienda']],
    ['sábado 19:00', SABADO, 19, 0, []],
    // Viernes/sábado 22:00–05:00: el cruce de medianoche (decisión 3).
    ['viernes 21:59', VIERNES, 21, 59, []],
    ['viernes 22:00', VIERNES, 22, 0, ['salir-a-bailar']],
    ['viernes 23:59', VIERNES, 23, 59, ['salir-a-bailar']],
    ['sábado 00:00', SABADO, 0, 0, ['salir-a-bailar']],
    ['sábado 04:59', SABADO, 4, 59, ['salir-a-bailar']],
    ['sábado 05:00', SABADO, 5, 0, []],
    // La madrugada del domingo pertenece al sábado que la empezó.
    ['domingo 02:00', DOMINGO, 2, 0, ['salir-a-bailar']],
    ['domingo 05:00', DOMINGO, 5, 0, []],
    // …y la del viernes NO: el jueves no está en `dias`.
    ['viernes 02:00', VIERNES, 2, 0, []],
  ]

  for (const [rotulo, dia, hh, mm, esperado] of bordes) {
    it(`${rotulo} ⇒ ${esperado.length ? esperado.join(',') : 'nada'}`, () => {
      expect(chipsPrimero(reglas, enAR(dia, hh, mm))).toEqual(esperado)
    })
  }
})

describe('chipsPrimero — prioridad y forma del resultado', () => {
  it('gana la primera regla que matchea, no la más específica (decisión 2)', () => {
    const reglas = validarReglas([
      { dias: [MARTES], desde: '10:00', hasta: '20:00', primero: ['general'] },
      { dias: [MARTES], desde: '18:00', hasta: '19:00', primero: ['especifica'] },
    ])
    expect(chipsPrimero(reglas, enAR(MARTES, 18, 30))).toEqual(['general'])
  })

  it('respeta el orden de `primero` dentro de la regla', () => {
    const reglas = validarReglas([
      { dias: [JUEVES], desde: '09:00', hasta: '10:00', primero: ['b', 'a', 'c'] },
    ])
    expect(chipsPrimero(reglas, enAR(JUEVES, 9, 30))).toEqual(['b', 'a', 'c'])
  })

  it('sin reglas devuelve [] (la home queda con su orden por `sort`)', () => {
    expect(chipsPrimero([], enAR(MARTES, 18, 0))).toEqual([])
  })

  it('`desde === hasta` cubre las 24 h del día listado (borde de la decisión 3)', () => {
    const reglas = validarReglas([
      { dias: [MARTES], desde: '12:00', hasta: '12:00', primero: ['todo-el-dia'] },
    ])
    expect(chipsPrimero(reglas, enAR(MARTES, 12, 0))).toEqual(['todo-el-dia'])
    expect(chipsPrimero(reglas, enAR(MARTES, 23, 59))).toEqual(['todo-el-dia'])
    // La cola de la madrugada pertenece al martes que la empezó.
    expect(chipsPrimero(reglas, enAR(MIERCOLES, 3, 0))).toEqual(['todo-el-dia'])
    expect(chipsPrimero(reglas, enAR(MIERCOLES, 13, 0))).toEqual([])
  })
})

describe('chipsFueraDeVentana — un chip con `solo` no se ve fuera de su ventana', () => {
  const reglas = validarReglas(DEFAULT_CHIPS_SCHEDULE)

  const casos: [string, number, number, string[]][] = [
    ['martes 18:00 ⇒ dentro de la ventana', MARTES, 18, []],
    ['martes 10:00 ⇒ fuera (es día hábil, pero no la hora)', MARTES, 10, ['after-office']],
    ['martes 21:00 ⇒ fuera (el `hasta` es exclusivo)', MARTES, 21, ['after-office']],
    ['domingo 11:00 ⇒ fuera (el caso que lo motivó)', DOMINGO, 11, ['after-office']],
    ['sábado 18:00 ⇒ fuera (la hora sí, el día no)', SABADO, 18, ['after-office']],
    ['lunes 17:00 ⇒ dentro, justo en el borde', LUNES, 17, []],
    ['viernes 20:00 ⇒ dentro, justo antes del otro borde', VIERNES, 20, []],
  ]

  for (const [rotulo, dia, hh, esperado] of casos) {
    it(rotulo, () => {
      expect([...chipsFueraDeVentana(reglas, enAR(dia, hh))]).toEqual(esperado)
    })
  }

  it('un chip sin `solo` en ninguna regla nunca está restringido', () => {
    // `salir-a-bailar` y `merienda` tienen regla pero no ventana: se ven a toda
    // hora, que es el comportamiento de siempre.
    for (const dia of [LUNES, SABADO, DOMINGO]) {
      for (const hh of [3, 11, 18, 23]) {
        const fuera = chipsFueraDeVentana(reglas, enAR(dia, hh))
        expect(fuera.has('salir-a-bailar')).toBe(false)
        expect(fuera.has('merienda')).toBe(false)
      }
    }
  })

  it('sin reglas no hay nada restringido', () => {
    expect([...chipsFueraDeVentana([], enAR(DOMINGO, 11))]).toEqual([])
  })

  it('alcanza con que UNA de sus ventanas esté vigente (no gana la primera regla)', () => {
    // A diferencia de `primero`, se miran todas las reglas: `solo` es un permiso.
    const dos = validarReglas([
      { dias: [LUNES], desde: '10:00', hasta: '12:00', solo: ['x'] },
      { dias: [LUNES], desde: '20:00', hasta: '22:00', solo: ['x'] },
    ])
    expect(chipsFueraDeVentana(dos, enAR(LUNES, 11)).has('x')).toBe(false)
    expect(chipsFueraDeVentana(dos, enAR(LUNES, 21)).has('x')).toBe(false)
    expect(chipsFueraDeVentana(dos, enAR(LUNES, 15)).has('x')).toBe(true)
  })

  it('una regla vigente que no lo nombra no le abre la ventana a nadie', () => {
    const mezcla = validarReglas([
      { dias: [LUNES], desde: '10:00', hasta: '20:00', primero: ['otro'] },
      { dias: [LUNES], desde: '18:00', hasta: '19:00', solo: ['x'] },
    ])
    expect(chipsFueraDeVentana(mezcla, enAR(LUNES, 11)).has('x')).toBe(true)
    expect(chipsFueraDeVentana(mezcla, enAR(LUNES, 18)).has('x')).toBe(false)
  })

  it('la ventana también cruza la medianoche (misma semántica que `primero`)', () => {
    const nocturna = validarReglas([
      { dias: [VIERNES], desde: '22:00', hasta: '05:00', solo: ['trasnoche'] },
    ])
    expect(chipsFueraDeVentana(nocturna, enAR(VIERNES, 23)).has('trasnoche')).toBe(false)
    expect(chipsFueraDeVentana(nocturna, enAR(SABADO, 2)).has('trasnoche')).toBe(false)
    expect(chipsFueraDeVentana(nocturna, enAR(SABADO, 6)).has('trasnoche')).toBe(true)
  })
})

describe('chipsPrimero — convivencia con las reglas que solo restringen', () => {
  it('una regla sin `primero` no tapa a la siguiente que sí adelanta', () => {
    // Sin esto, poner una ventana arriba de todo apagaría en silencio el
    // adelanto de una regla posterior (gana la primera que matchea, decisión 2).
    const reglas = validarReglas([
      { dias: [MARTES], desde: '10:00', hasta: '20:00', solo: ['restringido'] },
      { dias: [MARTES], desde: '18:00', hasta: '19:00', primero: ['adelantado'] },
    ])
    expect(chipsPrimero(reglas, enAR(MARTES, 18, 30))).toEqual(['adelantado'])
  })
})

describe('validarReglas — un UPDATE mal tipeado no puede romper la home (decisión 6)', () => {
  const buena: ReglaRotacion = {
    dias: [LUNES],
    desde: '10:00',
    hasta: '12:00',
    primero: ['un-cafe'],
  }

  const basura: [string, unknown][] = [
    ['`dias` como string', { ...buena, dias: 'lunes' }],
    ['`dias` vacío', { ...buena, dias: [] }],
    ['`dias` con un día inexistente', { ...buena, dias: [7] }],
    ['`dias` con un decimal', { ...buena, dias: [1.5] }],
    ['`dias` negativo', { ...buena, dias: [-1] }],
    ['hora imposible', { ...buena, desde: '25:99' }],
    ['hora sin ceros', { ...buena, hasta: '9:00' }],
    ['hora como número', { ...buena, desde: 1700 }],
    ['`primero` vacío', { ...buena, primero: [] }],
    ['`primero` como string', { ...buena, primero: 'after-office' }],
    ['`primero` con un slug vacío', { ...buena, primero: [''] }],
    ['`primero` con un número', { ...buena, primero: [3] }],
    ['campos faltantes', { dias: [LUNES] }],
    ['null adentro del array', null],
    ['un string suelto', 'after-office'],
    ['`solo` vacío', { ...buena, solo: [] }],
    ['`solo` como string', { ...buena, solo: 'after-office' }],
    ['`solo` con un slug vacío', { ...buena, solo: [''] }],
    ['sin `primero` ni `solo` no hace nada', { dias: [LUNES], desde: '10:00', hasta: '12:00' }],
  ]

  for (const [rotulo, mala] of basura) {
    it(`descarta la regla mala (${rotulo}) y conserva las buenas`, () => {
      expect(validarReglas([buena, mala, buena])).toEqual([buena, buena])
    })
  }

  it('un valor que no es array se ignora entero', () => {
    expect(validarReglas({ dias: [LUNES] })).toEqual([])
    expect(validarReglas('[]')).toEqual([])
    expect(validarReglas(42)).toEqual([])
  })

  it('ausente (null) no es un error: [] y **sin log**', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(validarReglas(null)).toEqual([])
    expect(validarReglas(undefined)).toEqual([])
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('avisa una sola vez, no por request', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    validarReglas([{ roto: true }])
    validarReglas([{ roto: true }])
    validarReglas('nada que ver')
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })

  it('una regla con `solo` y sin `primero` es válida y no adelanta nada', () => {
    const reglas = validarReglas([{ dias: [LUNES], desde: '10:00', hasta: '12:00', solo: ['x'] }])
    expect(reglas).toHaveLength(1)
    expect(reglas[0].primero).toEqual([])
    expect(reglas[0].solo).toEqual(['x'])
    expect(chipsPrimero(reglas, enAR(LUNES, 11))).toEqual([])
  })

  it('deduplica los slugs repetidos de una regla', () => {
    const reglas = validarReglas([{ ...buena, primero: ['un-cafe', 'un-cafe', 'merienda'] }])
    expect(reglas[0].primero).toEqual(['un-cafe', 'merienda'])
  })

  it('un slug inexistente pasa la validación: se ignora al cruzarlo con los vivos', () => {
    const reglas = validarReglas([{ ...buena, primero: ['chip-que-no-existe'] }])
    expect(chipsPrimero(reglas, enAR(LUNES, 11, 0))).toEqual(['chip-que-no-existe'])
  })

  it('la semilla es válida (nada se descarta en silencio)', () => {
    expect(validarReglas(DEFAULT_CHIPS_SCHEDULE)).toEqual(DEFAULT_CHIPS_SCHEDULE)
  })

  it('las reglas devueltas no comparten estado con el setting crudo', () => {
    const crudo = [{ ...buena, dias: [LUNES], primero: ['un-cafe'] }]
    const reglas = validarReglas(crudo)
    reglas[0].dias.push(DOMINGO)
    reglas[0].primero.push('otro')
    expect(crudo[0].dias).toEqual([LUNES])
    expect(crudo[0].primero).toEqual(['un-cafe'])
  })
})
