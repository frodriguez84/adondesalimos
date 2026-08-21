/**
 * Headline del hero del home. Rota entre cuatro **ocasiones** rioplatenses.
 *
 * ⚠️ Rota sobre ocasiones y no sobre sinónimos, y ese es el punto (2026-08-21). Antes
 * eran «¿Qué sale?» / «¿Qué pinta?» / «¿Qué hacemos?»: tres formas de decir lo mismo,
 * o sea variedad en la única dimensión que no informa nada. Ahora **cada variante le
 * hace de anticipo a un chip que está unos centímetros más abajo en la misma
 * pantalla**, y la bajada de `app/page.tsx` la completa con la función.
 *
 * Al tocar esta lista: que cada frase pueda señalar **un chip que exista y catálogo que
 * lo respalde**. Una ocasión sin con qué responder es peor que una frase genérica.
 * `escape-room` es la más flaca a propósito —34 lugares en todo el AMBA, y su chip
 * («Jugar») ni siquiera es `in_home`—; se banca porque el H1 **no linkea a un resultado
 * filtrado**, así que no promete un número.
 *
 * ## Por qué el sorteo vive en el SERVER y no en un `useEffect`
 *
 * Este componente era `'use client'` con `useState(0)` + `useEffect(() => setI(random()))`.
 * Funcionaba, pero tenía un defecto que **se veía**: el HTML servido traía siempre
 * `FRASES[0]`, y recién al montar se sorteaba ⇒ **3 de cada 4 recargas mostraban el
 * reemplazo en vivo**. Con las frases viejas —todas cortas, del mismo largo y de una
 * línea— era un parpadeo sutil; con estas, que varían de ancho y una parte en dos líneas
 * a 360 px, el reemplazo **mueve el layout**. Reportado por Fer el 2026-08-21 con el
 * síntoma exacto: *«pasa cuando aparece "¿Birra con amigos?"»* — que es, justamente,
 * `FRASES[0]`.
 *
 * ⚠️ **La lección AUTH F4 («un valor que depende del reloj o del azar no se calcula en
 * el render») NO se está violando: se está leyendo bien.** Esa lección es sobre un
 * componente **cliente que también renderiza en el server**, donde los dos lados
 * calculan y pueden discrepar ⇒ hydration mismatch. Acá hay **un solo render**: lo hace
 * el server, el cliente no recalcula nada, y no existen dos resultados que puedan no
 * coincidir. Por eso este archivo ya no lleva `'use client'` — y volver a ponérselo con
 * el sorteo adentro reabre el salto.
 *
 * ⚠️ **Depende de que la home sea dinámica, y hoy lo es** porque `app/page.tsx` lee
 * `headers()` para la sesión. Si algún día la home se volviera estática o con ISR, este
 * `Math.random()` se evaluaría **una sola vez** —en el build o en la revalidación— y la
 * frase quedaría congelada para todos hasta el próximo deploy. No tira error: la
 * rotación simplemente deja de rotar.
 */

const FRASES = [
  '¿Birra con amigos?',
  '¿Cena tranqui?',
  '¿Salir a bailar?',
  '¿Sala de escape?',
] as const

export function RotatingHeadline() {
  const frase = FRASES[Math.floor(Math.random() * FRASES.length)]

  return (
    <h1 className="bg-gradient-to-r from-[#FF2D75] via-[#FF8A00] to-[#FFD400] bg-clip-text text-4xl font-extrabold tracking-tight text-transparent">
      {frase}
    </h1>
  )
}
