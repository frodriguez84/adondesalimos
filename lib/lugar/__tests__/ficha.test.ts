import { describe, expect, it } from 'vitest'
import {
  clasificarRed,
  comoLlegarUrl,
  fotoPrincipal,
  precioDeTags,
  queEncontras,
} from '../ficha'

const tag = (facet: string, slug: string, name: string) => ({ slug, name, facet })

describe('precioDeTags', () => {
  it('devuelve el símbolo del tag de precio', () => {
    expect(precioDeTags([tag('tipo', 'bar', 'Bar'), tag('precio', 'precio-2', '$$')])).toBe('$$')
  })

  it('sin tag de precio devuelve null (cae al priceLevel de Google en F2)', () => {
    expect(precioDeTags([tag('tipo', 'bar', 'Bar')])).toBeNull()
  })

  it('con más de un tag de precio toma el primero (vienen ordenados por sort)', () => {
    expect(
      precioDeTags([tag('precio', 'precio-1', '$'), tag('precio', 'precio-3', '$$$')]),
    ).toBe('$')
  })
})

describe('queEncontras', () => {
  it('toma solo Actividad/Ambiente/Momento — el diferencial frente a Google', () => {
    expect(
      queEncontras([
        tag('tipo', 'bar', 'Bar'),
        tag('cocina', 'mexicana', 'Mexicana'),
        tag('actividad', 'musica-en-vivo', 'Música en vivo'),
        tag('ambiente', 'tranqui', 'Tranqui'),
        tag('momento', 'after-office', 'After office'),
        tag('precio', 'precio-2', '$$'),
      ]),
    ).toEqual(['Música en vivo', 'Tranqui', 'After office'])
  })

  it('sin tags de onda devuelve vacío — la sección no se renderiza', () => {
    expect(queEncontras([tag('tipo', 'bar', 'Bar'), tag('precio', 'precio-2', '$$')])).toEqual([])
  })
})

describe('comoLlegarUrl', () => {
  it('usa el lat/lng propio, sin place_id cuando no hay match', () => {
    expect(comoLlegarUrl({ lat: -34.6, lng: -58.44, googlePlaceId: null })).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=-34.6%2C-58.44',
    )
  })

  it('agrega destination_place_id cuando el match ya se resolvió', () => {
    expect(
      comoLlegarUrl({ lat: -34.6, lng: -58.44, googlePlaceId: 'ChIJabc123' }),
    ).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=-34.6%2C-58.44&destination_place_id=ChIJabc123',
    )
  })
})

describe('fotoPrincipal — prioridad dueño → Google → placeholder (decisión 3)', () => {
  it('con fotos de dueño usa la primera y NO pide la de Google', () => {
    expect(
      fotoPrincipal({ ownerPhotos: ['a.jpg', 'b.jpg'], googlePhotoUrl: 'g.jpg' }),
    ).toEqual({ url: 'a.jpg', fuente: 'owner' })
  })

  it('sin fotos de dueño cae a la de Google', () => {
    expect(fotoPrincipal({ ownerPhotos: [], googlePhotoUrl: 'g.jpg' })).toEqual({
      url: 'g.jpg',
      fuente: 'google',
    })
  })

  it('sin ninguna devuelve null (el componente dibuja el placeholder)', () => {
    expect(fotoPrincipal({ ownerPhotos: [] })).toBeNull()
    expect(fotoPrincipal({ ownerPhotos: [], googlePhotoUrl: null })).toBeNull()
  })
})

describe('clasificarRed', () => {
  it('reconoce las plataformas por dominio', () => {
    expect(clasificarRed('https://www.instagram.com/lugar')).toBe('instagram')
    expect(clasificarRed('https://facebook.com/lugar')).toBe('facebook')
    expect(clasificarRed('https://twitter.com/lugar')).toBe('twitter')
    expect(clasificarRed('https://x.com/lugar')).toBe('twitter')
    expect(clasificarRed('https://www.tiktok.com/@lugar')).toBe('tiktok')
  })

  it('un dominio desconocido cae a otro', () => {
    expect(clasificarRed('https://mi-bar.com.ar')).toBe('otro')
  })

  it('una URL basura no rompe, cae a otro', () => {
    expect(clasificarRed('no-es-una-url')).toBe('otro')
  })
})
