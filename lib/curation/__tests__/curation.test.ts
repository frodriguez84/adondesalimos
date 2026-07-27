import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FACETAS_SUGERIBLES, TIPO_RELEVANTE_CHIPS } from '../facetas'
import { htmlATexto } from '../fetch-sitio'

/**
 * Candados del spec CURADURIA verificables sin DB (DoD: "no importa nada de
 * lib/google/", decisiones 3 y 6).
 */

const DIR_CURATION = join(__dirname, '..')
const SCRIPT_BATCH = join(__dirname, '..', '..', '..', 'scripts', 'curar.ts')

function fuentesDeCuraduria(): { archivo: string; codigo: string }[] {
  const archivos = readdirSync(DIR_CURATION)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => join(DIR_CURATION, f))
  archivos.push(SCRIPT_BATCH)
  return archivos.map((archivo) => ({ archivo, codigo: readFileSync(archivo, 'utf8') }))
}

describe('candado de costos: el batch no toca Google', () => {
  it('ningún módulo de curación importa lib/google ni lee google_place_id', () => {
    for (const { archivo, codigo } of fuentesDeCuraduria()) {
      // Import real de lib/google (los comentarios que lo mencionan como "prohibido"
      // son documentación, no una dependencia — por eso se mira el `from '...'`).
      expect(codigo, `${archivo} importa lib/google`).not.toMatch(/from\s+['"][^'"]*lib\/google/)
      // El único dato de Google en el schema: no debe leerse en el batch.
      expect(codigo, `${archivo} lee google_place_id`).not.toMatch(/google_place_id/)
      expect(codigo, `${archivo} lee googlePlaceId`).not.toMatch(/googlePlaceId/)
    }
  })
})

describe('TIPO_RELEVANTE_CHIPS', () => {
  it('contiene los Tipo que aparecen en los chips y ninguno más', () => {
    // Los 7 Tipo que los chips (objetivo + V1) referencian, medido en el canon.
    expect([...TIPO_RELEVANTE_CHIPS].sort()).toEqual(
      ['bar', 'boliche', 'cafe', 'cerveceria', 'patio-gastronomico', 'restaurante', 'wine-bar'].sort(),
    )
  })

  it('no incluye tags que no son de Tipo', () => {
    // 'dj' y 'grupos-grandes' aparecen en chips pero no son Tipo.
    expect(TIPO_RELEVANTE_CHIPS.has('dj')).toBe(false)
    expect(TIPO_RELEVANTE_CHIPS.has('grupos-grandes')).toBe(false)
  })
})

describe('FACETAS_SUGERIBLES', () => {
  it('son exactamente las 3 facetas ralas (decisión 6)', () => {
    expect([...FACETAS_SUGERIBLES].sort()).toEqual(['actividad', 'ambiente', 'momento'])
  })
})

describe('htmlATexto', () => {
  it('quita scripts, estilos y tags dejando el texto', () => {
    const html =
      '<html><head><style>.a{color:red}</style></head><body><h1>Bar Tranqui</h1><script>evil()</script><p>Happy hour de 18 a 20</p></body></html>'
    const texto = htmlATexto(html)
    expect(texto).toContain('Bar Tranqui')
    expect(texto).toContain('Happy hour de 18 a 20')
    expect(texto).not.toContain('evil')
    expect(texto).not.toContain('color:red')
    expect(texto).not.toContain('<')
  })
})
