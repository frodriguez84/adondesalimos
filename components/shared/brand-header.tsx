import Link from 'next/link'
import { Wordmark } from './wordmark'

/**
 * Franja de marca para páginas sin presencia de marca propia (BACKLOG, 2026-07-23):
 * el wordmark solo vivía en el Home. Va ARRIBA del header propio de cada página
 * (título + volver), no lo reemplaza — cero rediseño, solo agrega la marca.
 *
 * **Desde 2026-08-09 la home también lo usa** (pedido de Fer): era la única pantalla
 * donde tocar el nombre no llevaba a ningún lado, que es justo lo que uno espera de un
 * logo. Este componente es el dueño de "el wordmark linkea al inicio" — no escribir
 * ese `Link` a mano en otra pantalla.
 */
export function BrandHeader() {
  return (
    // `INV-A`: el toque medía 212×**34**. Sube a 44 con `min-h-11` y no tocando
    // el `Wordmark`, que es el asset y se dibuja igual: lo que crece es el área
    // táctil. Radio medido antes de tocarlo (mismo criterio que `PBETA-R1-08`):
    // lo comparten 13 pantallas y el costo es 10 px de alto en cada header, sin
    // reflow lateral y sin mover nada de su eje horizontal.
    <Link href="/" aria-label="Ir al inicio" className="flex min-h-11 w-fit items-center">
      <Wordmark />
    </Link>
  )
}
