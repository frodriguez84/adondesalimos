import Link from 'next/link'
import { Wordmark } from './wordmark'

/**
 * Franja de marca para páginas sin presencia de marca propia (BACKLOG, 2026-07-23):
 * el wordmark solo vivía en el Home. Va ARRIBA del header propio de cada página
 * (título + volver), no lo reemplaza — cero rediseño, solo agrega la marca.
 */
export function BrandHeader() {
  return (
    <Link href="/" aria-label="Ir al inicio" className="w-fit">
      <Wordmark />
    </Link>
  )
}
