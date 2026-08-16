import { describe, expect, it } from 'vitest'
import { PARAM_PENDIENTE, destinoConPendiente } from '../pendiente'

const PLACE = 'd3695142-1111-4222-8333-444444444444'

describe('destinoConPendiente (PBETA-R3-07)', () => {
  it('le cuelga el lugar al destino sin perder la búsqueda a la que volvía', () => {
    expect(destinoConPendiente('/?z=palermo-soho', PLACE)).toBe(
      `/?z=palermo-soho&${PARAM_PENDIENTE}=${PLACE}`,
    )
  })

  it('sirve para un destino pelado', () => {
    expect(destinoConPendiente('/', PLACE)).toBe(`/?${PARAM_PENDIENTE}=${PLACE}`)
  })

  it('pisa un pendiente anterior en vez de duplicar el parámetro', () => {
    expect(destinoConPendiente(`/?${PARAM_PENDIENTE}=otro`, PLACE)).toBe(
      `/?${PARAM_PENDIENTE}=${PLACE}`,
    )
  })

  it('devuelve una ruta relativa aunque le pasen un destino de otro dominio', () => {
    // El `callbackUrl` viene de la URL, o sea de cualquiera: que se pierda el
    // host es justamente lo que evita mandar a nadie afuera del sitio.
    expect(destinoConPendiente('https://otro.com/algo', PLACE)).toBe(
      `/algo?${PARAM_PENDIENTE}=${PLACE}`,
    )
  })
})
