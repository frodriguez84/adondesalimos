import { describe, expect, it } from 'vitest'

import { CHIPS } from '@/lib/db/chips'
import { chipsPintados, tagsAlTocar, type ChipPintable } from '../pintado'

/**
 * El pintado y el toque de los chips de Ocasión (`lib/search/pintado.ts`).
 *
 * **Por qué existe este archivo:** FB-02 salió en dos vueltas y el bug del
 * 2026-08-09 (apagar «Tomar algo» apagaba «Primera cita» y prendía «Cenar afuera»
 * y «Un café») los cazó Fer clickeando. Son funciones puras de `(chips, tags)`,
 * así que las 17 × 17 = 289 combinaciones entran en un test y el CI las cuida
 * para siempre.
 *
 * Los chips salen del **seed** (`lib/db/chips.ts`), no de la base: el pintado no
 * depende de los conteos ni de qué chip está en la home. Si la curaduría edita
 * `occasion_chips` sin deploy, la regla que se verifica acá no cambia.
 */

const TODOS: ChipPintable[] = CHIPS.map(({ slug, tags }) => ({ slug, tags: [...tags] }))

function chip(slug: string): ChipPintable {
  const c = TODOS.find((x) => x.slug === slug)
  if (!c) throw new Error(`No existe el chip «${slug}» en el seed`)
  return c
}

const contieneEstricto = (mayor: readonly string[], menor: readonly string[]) =>
  mayor.length > menor.length && menor.every((t) => mayor.includes(t))

const ordenados = (tags: readonly string[]) => [...tags].sort()
const pintadosDe = (tags: readonly string[]) => [...chipsPintados(TODOS, tags)].sort()

describe('el repro del 2026-08-09 (bug reportado por Fer)', () => {
  // «Tomar algo» = {bar, cerveceria} · «Primera cita» = {bar, cafe, restaurante,
  // tranqui, romantico}: comparten `bar`, que está en 7 de los 17 chips.
  const conLosDos = tagsAlTocar(TODOS, chip('tomar-algo').tags, chip('primera-cita'))

  it('tocar los dos los deja a los dos prendidos y a nadie más', () => {
    expect(pintadosDe(conLosDos)).toEqual(['primera-cita', 'tomar-algo'])
  })

  it('apagar «Tomar algo» deja «Primera cita» prendido y no prende nada', () => {
    const despues = tagsAlTocar(TODOS, conLosDos, chip('tomar-algo'))

    expect(pintadosDe(despues)).toEqual(['primera-cita'])
    // Se va `cerveceria`, que era lo único suyo. `bar` se queda porque lo sostiene
    // «Primera cita».
    expect(ordenados(despues)).toEqual(ordenados(chip('primera-cita').tags))
  })
})

describe('FB-02 — lo decidido el 2026-08-08 sigue en pie', () => {
  it('tocar «Primera cita» desde cero prende UNO solo', () => {
    const despues = tagsAlTocar(TODOS, [], chip('primera-cita'))

    // «Cenar afuera» (`restaurante`) y «Un café» (`cafe`) quedan aplicados pero
    // tapados: se ven apagados.
    expect(pintadosDe(despues)).toEqual(['primera-cita'])
  })

  it('dos chips incomparables se prenden los dos', () => {
    const uno = tagsAlTocar(TODOS, [], chip('cenar-afuera'))
    const dos = tagsAlTocar(TODOS, uno, chip('un-cafe'))

    expect(pintadosDe(dos)).toEqual(['cenar-afuera', 'un-cafe'])
  })

  it('tocar un chip tapado lo promueve (y el que lo tapaba se apaga)', () => {
    const conPrimeraCita = tagsAlTocar(TODOS, [], chip('primera-cita'))
    const despues = tagsAlTocar(TODOS, conPrimeraCita, chip('un-cafe'))

    expect(pintadosDe(despues)).toEqual(['un-cafe'])
    expect(ordenados(despues)).toEqual(['cafe'])
  })
})

/**
 * El invariante, en una línea: **un toque cambia el estado pintado del chip que se
 * tocó y de ningún otro**, con la excepción declarada de la promoción (tocar un
 * chip tapado apaga a los que lo tapaban).
 *
 * El barrido parte de cada chip aplicado solo —el estado real de la home después
 * de un toque— y toca cada uno de los 17, incluido él mismo.
 */
describe('invariante sobre las 17 × 17 combinaciones', () => {
  type Caso = {
    nombre: string
    rama: 'apagar' | 'promover' | 'prender'
    tocado: ChipPintable
    tagsAntes: string[]
    tagsDespues: string[]
    antes: Set<string>
    despues: Set<string>
  }

  const casos: Caso[] = TODOS.flatMap((inicial) =>
    TODOS.map((tocado) => {
      const tagsAntes = [...inicial.tags]
      const antes = chipsPintados(TODOS, tagsAntes)
      // La rama se clasifica acá y no se le pregunta a la implementación: un test
      // que reusa el criterio que verifica no verifica nada.
      const aplicado = tocado.tags.every((t) => tagsAntes.includes(t))
      const rama = antes.has(tocado.slug) ? 'apagar' : aplicado ? 'promover' : 'prender'
      const tagsDespues = tagsAlTocar(TODOS, tagsAntes, tocado)

      return {
        nombre: `«${inicial.slug}» puesto, toco «${tocado.slug}» (${rama})`,
        rama,
        tocado,
        tagsAntes,
        tagsDespues,
        antes,
        despues: chipsPintados(TODOS, tagsDespues),
        // `as const` no: el tipo ya lo fija `Caso`.
      } as Caso
    }),
  )

  /** Junta los casos que violan `regla` y los reporta por nombre, todos juntos. */
  const violaciones = (aplica: (c: Caso) => boolean, cumple: (c: Caso) => boolean) =>
    casos.filter(aplica).filter((c) => !cumple(c)).map((c) => c.nombre)

  it('el barrido cubre las 289 combinaciones y las tres ramas', () => {
    expect(TODOS).toHaveLength(17)
    expect(casos).toHaveLength(289)
    for (const rama of ['apagar', 'promover', 'prender'] as const) {
      expect(casos.filter((c) => c.rama === rama).length).toBeGreaterThan(0)
    }
  })

  /**
   * En las ramas `apagar` y `promover` el toque **elige** qué tags saca, así que
   * prender a un tercero es siempre culpa del código: la regla no admite excusas.
   *
   * En `prender` no hay elección —sumar los tags del chip es lo que lo prende— y
   * la unión puede **completar** a un tercer chip. Con los tags reales:
   * «Cumpleaños» + «Tomar algo» completa a «Salida con amigos»
   * (`bar, cerveceria, grupos-grandes`). Ese chip está genuinamente entero, así
   * que ningún conjunto de tags que contenga a los dos que el usuario quiere lo
   * puede esconder: la única salida sería romper uno de los dos. Por eso la
   * excepción se verifica en vez de tolerarse — el que se prende de más tiene que
   * estar contenido en la unión.
   */
  it('nunca se prende un chip que no se tocó', () => {
    const forzadoPorLaUnion = (c: Caso, slug: string) => {
      if (c.rama !== 'prender') return false
      const union = new Set([...c.tagsAntes, ...c.tocado.tags])
      return chip(slug).tags.every((t) => union.has(t))
    }

    expect(
      violaciones(
        () => true,
        (c) =>
          [...c.despues].every(
            (slug) => c.antes.has(slug) || slug === c.tocado.slug || forzadoPorLaUnion(c, slug),
          ),
      ),
    ).toEqual([])
  })

  /**
   * Misma excepción, del otro lado: si la unión completa a un chip que **contiene**
   * al que se tocó, el tocado queda tapado y se sigue viendo apagado. Es el único
   * caso de los 289 y no se puede arreglar acá: pide cambiar la regla del pintado
   * (o dejar de derivarla de los tags), que es decisión de producto — anotado en
   * el BACKLOG. El inventario está escrito a mano a propósito: si la curaduría
   * mueve los tags de un chip y aparece un caso nuevo, este test lo dice.
   */
  it('el toque hace lo que el chip muestra: prendido se apaga, apagado se prende', () => {
    const tapadoPorLaUnion = (c: Caso) =>
      c.rama === 'prender' &&
      [...c.despues].some((slug) => contieneEstricto(chip(slug).tags, c.tocado.tags))

    expect(
      violaciones(
        () => true,
        (c) =>
          c.rama === 'apagar'
            ? !c.despues.has(c.tocado.slug)
            : c.despues.has(c.tocado.slug) || tapadoPorLaUnion(c),
      ),
    ).toEqual([])

    expect(casos.filter(tapadoPorLaUnion).map((c) => c.nombre)).toEqual([
      '«cumpleanos» puesto, toco «tomar-algo» (prender)',
    ])
  })

  it('apagar un chip no apaga a ningún otro', () => {
    expect(
      violaciones(
        (c) => c.rama === 'apagar',
        (c) => [...c.antes].every((slug) => slug === c.tocado.slug || c.despues.has(slug)),
      ),
    ).toEqual([])
  })

  it('promover apaga solo a los chips que tapaban al que se tocó', () => {
    expect(
      violaciones(
        (c) => c.rama === 'promover',
        (c) =>
          [...c.antes]
            .filter((slug) => !c.despues.has(slug))
            .every((slug) => contieneEstricto(chip(slug).tags, c.tocado.tags)),
      ),
    ).toEqual([])
  })

  it('prender un chip no saca ningún tag', () => {
    expect(
      violaciones(
        (c) => c.rama === 'prender',
        (c) => c.tagsAntes.every((t) => c.tagsDespues.includes(t)),
      ),
    ).toEqual([])
  })

  it('ningún toque es un botón muerto: siempre cambia el estado', () => {
    expect(
      violaciones(
        () => true,
        (c) => JSON.stringify(ordenados(c.tagsAntes)) !== JSON.stringify(ordenados(c.tagsDespues)),
      ),
    ).toEqual([])
  })
})
