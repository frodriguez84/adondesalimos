'use client'

import * as React from 'react'

/**
 * Headline del hero del home. Rota entre tres frases rioplatenses para darle vida
 * a la primera visita.
 *
 * Por qué client-side (lección AUTH F4 — "un valor que depende del reloj/azar no se
 * calcula en el render"): elegir la frase al azar en el render del server no
 * coincide con lo que elige el cliente al hidratar ⇒ hydration mismatch. La
 * solución: el server (y el primer render del cliente) muestran SIEMPRE la primera
 * frase —determinista, idéntica en ambos lados—, y recién después de montar un
 * `useEffect` elige una al azar. Una sola elección por visita: nada de carrusel.
 */

const FRASES = ['¿Qué sale?', '¿Qué pinta?', '¿Qué hacemos?'] as const

export function RotatingHeadline() {
  // 0 en el primer render (server + cliente): sin azar hasta después de montar.
  const [i, setI] = React.useState(0)

  React.useEffect(() => {
    setI(Math.floor(Math.random() * FRASES.length))
  }, [])

  return (
    <h1 className="bg-gradient-to-r from-[#FF2D75] via-[#FF8A00] to-[#FFD400] bg-clip-text text-4xl font-extrabold tracking-tight text-transparent">
      {FRASES[i]}
    </h1>
  )
}
