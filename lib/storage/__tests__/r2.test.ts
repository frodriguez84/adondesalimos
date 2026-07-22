import { describe, expect, it } from 'vitest'
import { claveDeFoto, claveDeUrl, esTipoPermitido, MAX_BYTES, urlPublica } from '../r2'

/**
 * Las partes de R2 que se pueden testear sin credenciales ni red: qué se acepta,
 * cómo se nombra el objeto y cómo se vuelve de la URL guardada a la clave para
 * poder borrarla.
 */

const BASE = 'https://fotos.example.com'

describe('tipos y tamaño (decisión 16)', () => {
  it('acepta jpeg, png y webp', () => {
    expect(esTipoPermitido('image/jpeg')).toBe(true)
    expect(esTipoPermitido('image/png')).toBe(true)
    expect(esTipoPermitido('image/webp')).toBe(true)
  })

  it('rechaza el resto — incluido el HEIC del iPhone y cualquier cosa que no sea imagen', () => {
    expect(esTipoPermitido('image/heic')).toBe(false)
    expect(esTipoPermitido('image/gif')).toBe(false)
    expect(esTipoPermitido('application/pdf')).toBe(false)
    expect(esTipoPermitido('')).toBe(false)
  })

  it('el tope es 5 MB', () => {
    expect(MAX_BYTES).toBe(5 * 1024 * 1024)
  })
})

describe('claves y URLs', () => {
  const placeId = '11111111-2222-3333-4444-555555555555'

  it('la clave va prefijada por lugar y con la extensión del tipo', () => {
    expect(claveDeFoto(placeId, 'image/jpeg')).toMatch(new RegExp(`^lugares/${placeId}/[0-9a-f-]+\\.jpg$`))
    expect(claveDeFoto(placeId, 'image/webp')).toMatch(/\.webp$/)
  })

  it('dos fotos del mismo lugar nunca comparten clave', () => {
    expect(claveDeFoto(placeId, 'image/png')).not.toBe(claveDeFoto(placeId, 'image/png'))
  })

  it('la URL pública tolera la base con y sin barra final', () => {
    expect(urlPublica('lugares/x/a.jpg', BASE)).toBe(`${BASE}/lugares/x/a.jpg`)
    expect(urlPublica('lugares/x/a.jpg', `${BASE}/`)).toBe(`${BASE}/lugares/x/a.jpg`)
  })

  it('de la URL guardada se recupera la clave', () => {
    expect(claveDeUrl(`${BASE}/lugares/x/a.jpg`, BASE)).toBe('lugares/x/a.jpg')
  })

  it('una URL de otro origen no devuelve clave — nunca un DELETE sobre algo ajeno', () => {
    expect(claveDeUrl('https://otro.example/lugares/x/a.jpg', BASE)).toBeNull()
    expect(claveDeUrl(`${BASE}`, BASE)).toBeNull()
    expect(claveDeUrl(`${BASE}/lugares/x/a.jpg`, '')).toBeNull()
  })
})
