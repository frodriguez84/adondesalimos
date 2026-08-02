import { describe, expect, it } from 'vitest'
import { BARRIOS_POR_ZONA } from '../../../scripts/zones/composicion'
import { normalizar } from '../../search/suggest'
import { ALIASES, SLUGS, ZONAS } from '../canon'

/**
 * Propiedades de los alias — no la lista.
 *
 * La lista crece a mano y por pasadas de datos; lo que no puede cambiar es que
 * cada alias apunte a una zona que existe y que ninguno se duplique. El chequeo
 * geométrico (que el barrio o el hito caiga de verdad en su zona) se hace al
 * cargarlos, contra los polígonos y el catálogo; acá queda lo que se puede
 * afirmar sin las fuentes, que no se versionan.
 */

describe('alias de zona', () => {
  it('todos apuntan a un slug que existe en el canon', () => {
    for (const a of ALIASES) {
      expect(SLUGS.has(a.slug), `el alias "${a.alias}" apunta a "${a.slug}", que no es una zona`).toBe(true)
    }
  })

  it('no repite alias — dos filas para el mismo texto son una contradicción esperando', () => {
    const vistos = new Map<string, string>()
    for (const a of ALIASES) {
      const clave = normalizar(a.alias)
      expect(vistos.has(clave), `"${a.alias}" está dos veces (${vistos.get(clave)} y ${a.slug})`).toBe(false)
      vistos.set(clave, a.slug)
    }
  })
})

describe('cobertura de CABA', () => {
  /** Cómo resuelve el buscador: substring sobre el nombre de la zona o sobre un alias. */
  function resuelve(termino: string): string[] {
    const t = normalizar(termino)
    const porNombre = ZONAS.filter((z) => normalizar(z.name).includes(t)).map((z) => z.slug)
    const porAlias = ALIASES.filter((a) => normalizar(a.alias).includes(t)).map((a) => a.slug)
    return [...new Set([...porNombre, ...porAlias])]
  }

  it('los 47 barrios oficiales resuelven a la zona que los contiene', () => {
    for (const [slug, barrios] of Object.entries(BARRIOS_POR_ZONA)) {
      for (const barrio of barrios) {
        expect(resuelve(barrio), `tipear "${barrio}" no lleva a ${slug}`).toContain(slug)
      }
    }
  })
})
