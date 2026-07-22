import { describe, expect, it } from 'vitest'
import {
  CONTENIDO_VACIO,
  contenidoSchema,
  listaANull,
  MAX_SOCIALS,
  vacioANull,
} from '../validacion'

/**
 * El boundary del panel: el mismo schema corre en el editor y en el `PATCH`. Lo
 * que importa acá es que un link raro no llegue a ser un `href` de la ficha, y
 * que vaciar un campo se distinga de no tocarlo.
 */

const ok = { ...CONTENIDO_VACIO }

describe('contenidoSchema', () => {
  it('acepta todo vacío: es un lugar sin nada cargado', () => {
    expect(contenidoSchema.safeParse(ok).success).toBe(true)
  })

  it('acepta http y https', () => {
    expect(contenidoSchema.safeParse({ ...ok, website: 'https://x.example' }).success).toBe(true)
    expect(contenidoSchema.safeParse({ ...ok, website: 'http://x.example' }).success).toBe(true)
  })

  it('rechaza un link que no es http(s) — nada de javascript: en un href', () => {
    expect(contenidoSchema.safeParse({ ...ok, website: 'javascript:alert(1)' }).success).toBe(false)
    expect(contenidoSchema.safeParse({ ...ok, menuUrl: '//evil.example' }).success).toBe(false)
    expect(contenidoSchema.safeParse({ ...ok, website: 'x.example' }).success).toBe(false)
  })

  it('rechaza más redes que el tope', () => {
    const muchas = Array.from({ length: MAX_SOCIALS + 1 }, () => 'https://x.example')
    expect(contenidoSchema.safeParse({ ...ok, socials: muchas }).success).toBe(false)
  })

  it('rechaza una novedad larga (es una línea, no un párrafo)', () => {
    expect(contenidoSchema.safeParse({ ...ok, news: 'x'.repeat(141) }).success).toBe(false)
  })

  it('la forma de los campos pagos se valida SIEMPRE, con plan o sin plan', () => {
    // El permiso lo decide `acciones.ts` con el `owner_plan`; el schema no lo sabe
    // ni tiene que saberlo.
    expect(contenidoSchema.safeParse({ ...ok, menuUrl: 'no-es-url' }).success).toBe(false)
  })
})

describe('normalización a null (lo que hace que borrar devuelva la base)', () => {
  it('string vacío o con espacios ⇒ null', () => {
    expect(vacioANull('')).toBeNull()
    expect(vacioANull('   ')).toBeNull()
  })

  it('string con contenido ⇒ trim', () => {
    expect(vacioANull('  hola  ')).toBe('hola')
  })

  it('lista vacía o de vacíos ⇒ null', () => {
    expect(listaANull([])).toBeNull()
    expect(listaANull(['', '  '])).toBeNull()
  })

  it('lista con contenido ⇒ solo lo que tiene algo', () => {
    expect(listaANull(['https://a.example', '', ' https://b.example '])).toEqual([
      'https://a.example',
      'https://b.example',
    ])
  })
})
