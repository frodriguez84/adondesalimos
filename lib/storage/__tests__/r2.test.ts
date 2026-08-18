import { describe, expect, it } from 'vitest'
import {
  claveDeFoto,
  claveDeUrl,
  esTipoPermitido,
  MAX_BYTES,
  tipoRealDeFoto,
  urlPublica,
} from '../r2'

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

describe('tipoRealDeFoto — la firma manda, no el header del cliente (`SEC-13`)', () => {
  /** Bytes con la firma pedida y relleno hasta `largo`. */
  function conFirma(firma: number[], largo = 32): Uint8Array {
    const b = new Uint8Array(largo)
    b.set(firma)
    return b
  }

  const JPEG = conFirma([0xff, 0xd8, 0xff, 0xe0])
  const PNG = conFirma([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const WEBP = (() => {
    const b = conFirma([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00])
    b.set([0x57, 0x45, 0x42, 0x50], 8)
    return b
  })()

  it('reconoce los tres formatos permitidos', () => {
    expect(tipoRealDeFoto(JPEG)).toBe('image/jpeg')
    expect(tipoRealDeFoto(PNG)).toBe('image/png')
    expect(tipoRealDeFoto(WEBP)).toBe('image/webp')
  })

  it('un HTML/PHP/ELF disfrazado de jpeg da null — el vector de `SEC-13`', () => {
    const html = new TextEncoder().encode('<html><script>alert(1)</script></html>')
    const php = new TextEncoder().encode('<?php system($_GET["c"]); ?>')
    const elf = conFirma([0x7f, 0x45, 0x4c, 0x46])
    expect(tipoRealDeFoto(html)).toBeNull()
    expect(tipoRealDeFoto(php)).toBeNull()
    expect(tipoRealDeFoto(elf)).toBeNull()
  })

  it('formatos de imagen que no están en la allowlist también dan null', () => {
    const gif = new TextEncoder().encode('GIF89a')
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>')
    expect(tipoRealDeFoto(gif)).toBeNull()
    expect(tipoRealDeFoto(svg)).toBeNull()
  })

  it('un RIFF que no es WEBP (un .wav) no pasa por webp', () => {
    const wav = conFirma([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00])
    wav.set([0x57, 0x41, 0x56, 0x45], 8) // "WAVE"
    expect(tipoRealDeFoto(wav)).toBeNull()
  })

  it('archivos más cortos que la firma no rompen', () => {
    expect(tipoRealDeFoto(new Uint8Array(0))).toBeNull()
    expect(tipoRealDeFoto(new Uint8Array([0xff, 0xd8]))).toBeNull()
    expect(tipoRealDeFoto(new Uint8Array([0x52, 0x49, 0x46, 0x46]))).toBeNull() // RIFF sin los 12
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
