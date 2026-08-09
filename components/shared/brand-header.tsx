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
    <Link href="/" aria-label="Ir al inicio" className="w-fit">
      <Wordmark />
    </Link>
  )
}
