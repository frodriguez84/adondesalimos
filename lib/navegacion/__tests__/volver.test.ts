import { describe, expect, it } from 'vitest'
import { decidirVolver, hayPantallaDetras } from '../volver'

describe('«Volver» de la ficha: ¿back o subo?', () => {
  // DoD caso 1: navegó dentro de la app ⇒ back, que devuelve el listado con los
  // filtros puestos.
  it('vuelve atrás cuando hay historia propia en la pestaña', () => {
    expect(decidirVolver({ navegoEnLaApp: true, historyLength: 3 })).toBe('atras')
    expect(decidirVolver({ navegoEnLaApp: true, historyLength: 2 })).toBe('atras')
  })

  // DoD caso 2: entrada fría (el link de WhatsApp). Sin esto el back deja
  // `about:blank` y el usuario se va de la app.
  it('sube a la home cuando no navegó dentro de la app', () => {
    expect(decidirVolver({ navegoEnLaApp: false, historyLength: 1 })).toBe('subir')
    // Pestaña reusada: hay historia, pero es de otros sitios, no de la app.
    expect(decidirVolver({ navegoEnLaApp: false, historyLength: 5 })).toBe('subir')
  })

  // DoD caso 3: el `sessionStorage` se CLONA al abrir una pestaña nueva desde un
  // link, así que el flag puede llegar en `true` mintiendo. La segunda guardia
  // es la que salva: en una pestaña recién abierta `history.length` es 1.
  it('sube igual con el flag clonado si no hay historia', () => {
    expect(decidirVolver({ navegoEnLaApp: true, historyLength: 1 })).toBe('subir')
  })
})

describe('¿hay una pantalla de la app detrás?', () => {
  it('sí cuando la pantalla actual no es la de entrada de la pestaña', () => {
    expect(
      hayPantallaDetras({ pathnameDeEntrada: '/', pathnameActual: '/lugar/abc' }),
    ).toBe(true)
  })

  // El agujero que se midió en vivo: en frío, «Volver» sube a la home (push) y el
  // back físico devuelve a la ficha. Ahí un flag "hubo alguna navegación" ya
  // estaría prendido por la subida misma, y el segundo «Volver» volvía a dejar
  // `about:blank`. Contra la pantalla de entrada, no.
  it('no en la pantalla por la que entró la pestaña, se haya vuelto como se haya vuelto', () => {
    expect(
      hayPantallaDetras({ pathnameDeEntrada: '/lugar/abc', pathnameActual: '/lugar/abc' }),
    ).toBe(false)
  })

  it('no sin marcador (storage bloqueado o modo privado): degrada a subir', () => {
    expect(hayPantallaDetras({ pathnameDeEntrada: null, pathnameActual: '/lugar/abc' })).toBe(false)
  })
})
