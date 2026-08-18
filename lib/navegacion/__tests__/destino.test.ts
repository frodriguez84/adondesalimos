import { describe, expect, it } from 'vitest'
import { destinoInterno } from '../destino'

describe('¿este destino es nuestro? (SEC-04, open redirect del login)', () => {
  // El caso normal: los `callbackUrl` que la app se manda a sí misma desde
  // /mis-lugares, /cuenta, /mi-negocio, el botón de guardar, etc.
  it('deja pasar las rutas internas tal cual', () => {
    expect(destinoInterno('/')).toBe('/')
    expect(destinoInterno('/mis-lugares')).toBe('/mis-lugares')
    expect(destinoInterno('/mi-negocio/abc-123')).toBe('/mi-negocio/abc-123')
    // Con query y hash, que es como llega desde la búsqueda con filtros puestos.
    expect(destinoInterno('/?z=palermo-soho&t=bar')).toBe('/?z=palermo-soho&t=bar')
    expect(destinoInterno('/lugar/abc#horarios')).toBe('/lugar/abc#horarios')
  })

  // El agujero reproducido en vivo: login exitoso y el browser terminaba en
  // example.com, con el dominio real como señal de confianza del atacante.
  it('manda a la home cualquier URL absoluta', () => {
    expect(destinoInterno('https://example.com/robado')).toBe('/')
    expect(destinoInterno('http://evil.tld')).toBe('/')
    // Aunque el host arranque con el nuestro: `adondesalimos.com.ar.evil.tld`.
    expect(destinoInterno('https://adondesalimos.com.ar.evil.tld/login')).toBe('/')
  })

  // El que se olvida siempre: sin esquema, y el browser la trata como absoluta.
  it('manda a la home las protocol-relative, con barra y con backslash', () => {
    expect(destinoInterno('//evil.tld')).toBe('/')
    expect(destinoInterno('//evil.tld/algo')).toBe('/')
    // Varios browsers normalizan `\` a `/`, así que mirar solo `//` no alcanza.
    expect(destinoInterno('/\\evil.tld')).toBe('/')
    expect(destinoInterno('\\\\evil.tld')).toBe('/')
  })

  // No se depende de que el browser bloquee `javascript:` en assign() —lo hace,
  // lo verifiqué, pero es una garantía prestada—.
  it('manda a la home los esquemas ejecutables o raros', () => {
    expect(destinoInterno("javascript:document.title='x'")).toBe('/')
    expect(destinoInterno('data:text/html,<script>1</script>')).toBe('/')
    expect(destinoInterno('mailto:alguien@ejemplo.com')).toBe('/')
  })

  // Conservador a propósito: no se intenta "arreglar" la entrada recortándola.
  it('manda a la home lo vacío, lo ausente y lo que no arranca con /', () => {
    expect(destinoInterno(null)).toBe('/')
    expect(destinoInterno(undefined)).toBe('/')
    expect(destinoInterno('')).toBe('/')
    expect(destinoInterno('mis-lugares')).toBe('/')
    expect(destinoInterno('  /mis-lugares')).toBe('/')
  })
})
