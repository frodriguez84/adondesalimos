import { describe, expect, it } from 'vitest'
import { DEFAULT_CADENAS, validarCadenas } from '../cadenas'

/**
 * La validación del setting `search.cadenas` (ORDEN_ORGANICO, decisión 16).
 *
 * Lo que se prueba es la **degradación silenciosa**: el valor es un `jsonb` que un
 * humano edita a mano con un `UPDATE`, así que todo lo que entra puede ser
 * cualquier cosa. Nada de esto puede tirar la home — mismo criterio que
 * `chips.schedule`, y por el mismo motivo: el orden es una mejora, no un
 * prerrequisito para que la pantalla exista.
 */
describe('validarCadenas', () => {
  it('sin setting (null/undefined) la lista queda vacía y nadie es cadena', () => {
    expect(validarCadenas(null)).toEqual([])
    expect(validarCadenas(undefined)).toEqual([])
  })

  it('un valor que no es lista degrada a vacío en vez de romper', () => {
    expect(validarCadenas('burger king')).toEqual([])
    expect(validarCadenas(42)).toEqual([])
    expect(validarCadenas({ cadenas: ['burger king'] })).toEqual([])
  })

  it('la lista vacía es válida: es la forma de apagar la mitad "cadena" del orden', () => {
    expect(validarCadenas([])).toEqual([])
  })

  it('descarta entrada por entrada, sin invalidar las buenas', () => {
    expect(validarCadenas(['burger king', 42, null, '', '   ', ['x'], 'subway'])).toEqual([
      'burger king',
      'subway',
    ])
  })

  it('recorta espacios y deduplica: pegar dos veces el mismo nombre no lo duplica', () => {
    expect(validarCadenas(['  subway  ', 'subway'])).toEqual(['subway'])
  })

  it('la lista del seed sobrevive su propia validación', () => {
    expect(validarCadenas(DEFAULT_CADENAS)).toEqual(DEFAULT_CADENAS)
  })
})
