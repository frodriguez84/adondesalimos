import { describe, expect, it } from 'vitest'

import { TIPO } from '@/lib/db/taxonomy'
import {
  MARCA,
  PLURAL_TIPO,
  bajadaDeZona,
  bajadaDeZonaTipo,
  descripcionDeZona,
  descripcionDeZonaTipo,
  enMinuscula,
  h1DeZona,
  h1DeZonaTipo,
  numero,
  pluralDeTipo,
  titleDeZonaTipo,
} from '../textos'

/**
 * El copy de las 301 páginas. Lo que estos tests defienden no es la redacción:
 * es que **todo salga de datos** (decisión 6) y que la tabla de plurales no se
 * quede atrás de la taxonomía — un `<h1>` que dijera «Bar en Palermo Soho» o
 * «wine-bar en Palermo Soho» delata la plantilla en la única línea que Google lee
 * como el título de la página.
 */

describe('PLURAL_TIPO cubre la taxonomía', () => {
  // Si CATALOGO suma un Tipo, este test falla antes de que se publiquen 30
  // landings con el slug crudo en el `<h1>`.
  it('tiene una entrada por cada Tipo de lib/db/taxonomy.ts', () => {
    const faltantes = TIPO.filter((t) => !PLURAL_TIPO[t.slug]).map((t) => t.slug)
    expect(faltantes, `Tipos sin plural en PLURAL_TIPO: ${faltantes.join(', ')}`).toEqual([])
  })

  it('no sobra ninguno', () => {
    const slugs = new Set(TIPO.map((t) => t.slug))
    expect(Object.keys(PLURAL_TIPO).filter((s) => !slugs.has(s))).toEqual([])
  })

  it('un slug desconocido no rompe: cae a algo mostrable', () => {
    expect(pluralDeTipo('no-existe')).toBe('no-existe')
  })
})

describe('enMinuscula — solo la primera letra', () => {
  it('baja la inicial', () => {
    expect(enMinuscula('Bares')).toBe('bares')
    expect(enMinuscula('Cervecerías')).toBe('cervecerías')
  })

  it('respeta el resto del nombre propio', () => {
    expect(enMinuscula('Wine bars y vinotecas')).toBe('wine bars y vinotecas')
  })
})

describe('numero — formato es-AR', () => {
  it('usa el punto como separador de miles', () => {
    expect(numero(1707)).toBe('1.707')
    expect(numero(142)).toBe('142')
  })
})

describe('títulos y bajadas', () => {
  it('el h1 del combo es la keyword, textual', () => {
    expect(h1DeZonaTipo('bar', 'Palermo Soho')).toBe('Bares en Palermo Soho')
    expect(h1DeZonaTipo('cafe', 'Villa Crespo')).toBe('Cafés en Villa Crespo')
  })

  it('el h1 del hub nombra la zona', () => {
    expect(h1DeZona('Palermo Soho')).toBe('Salir en Palermo Soho')
  })

  it('el title cierra con la marca', () => {
    expect(titleDeZonaTipo('bar', 'Palermo Soho')).toBe(`Bares en Palermo Soho — ${MARCA}`)
  })

  it('la bajada lleva el conteo real y de dónde sale el orden', () => {
    const bajada = bajadaDeZonaTipo(142, 'bar', 'Palermo Soho')
    expect(bajada).toBe(
      'Hay 142 bares publicados en Palermo Soho. Primero los que tenemos mejor cargados.',
    )
  })

  // Un combo puede caer por debajo del piso entre builds y la página sigue viva
  // (§ Edge cases): «Hay 1 bares publicado» sería el detalle que delata la plantilla.
  it('concuerda en singular cuando el conteo da 1', () => {
    expect(bajadaDeZonaTipo(1, 'bar', 'Merlo')).toBe(
      'Hay 1 bar publicado en Merlo. Primero los que tenemos mejor cargados.',
    )
    expect(bajadaDeZona(1, 'Merlo')).toContain('1 lugar publicado')
  })
})

describe('descripciones — distintas entre sí, y sin una palabra inventada', () => {
  it('el hub enumera hasta tres tipos que existen de verdad en esa zona', () => {
    expect(descripcionDeZona(1707, 'Palermo Soho', ['bar', 'cafe', 'restaurante'])).toBe(
      '1.707 lugares para salir en Palermo Soho: bares, cafés, restaurantes. Con dirección, qué vas a encontrar y cómo llegar.',
    )
  })

  it('con más de tres corta y lo dice', () => {
    const d = descripcionDeZona(1707, 'Palermo Soho', ['bar', 'cafe', 'restaurante', 'boliche'])
    expect(d).toContain('bares, cafés, restaurantes y más')
  })

  it('sin ningún tipo por encima del piso no queda una lista colgada', () => {
    expect(descripcionDeZona(181, 'Merlo', [])).toBe(
      '181 lugares para salir en Merlo. Con dirección, qué vas a encontrar y cómo llegar.',
    )
  })

  it('la del combo lleva el conteo y el tipo', () => {
    expect(descripcionDeZonaTipo(142, 'bar', 'Palermo Soho')).toContain('142 bares en Palermo Soho')
  })

  // Google corta la description alrededor de los 160 caracteres. No es un límite
  // duro, pero una plantilla que se pasa siempre está desperdiciando el snippet.
  it('entran en el snippet', () => {
    expect(descripcionDeZona(1707, 'Botánico y Alto Palermo', ['patio-gastronomico', 'teatro-espacio-cultural', 'centro-entretenimiento', 'bar']).length).toBeLessThanOrEqual(200)
    expect(descripcionDeZonaTipo(142, 'teatro-espacio-cultural', 'Villa Devoto y Villa del Parque').length).toBeLessThanOrEqual(200)
  })
})
