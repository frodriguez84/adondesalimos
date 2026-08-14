'use client'

import * as React from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowLeft, Check, Share2 } from 'lucide-react'

import { compartirLink } from '@/components/shared/boton-compartir'
import { Button } from '@/components/ui/button'
import { decidirVolver, huboNavegacionEnLaApp } from '@/lib/navegacion/volver'

/**
 * Volver y compartir (FICHA, § Diseño). Cliente porque el historial y la Web
 * Share API viven en el browser. La regla de compartir (nativo con fallback a
 * copiar) ya no vive acá: es `compartirLink`, que comparten esta ficha y las dos
 * pantallas de votación (PBETA-R4-01). Acá queda solo la presentación de ícono.
 *
 * El «Volver» es híbrido (NAVEGACION, decisión 5) y **la regla no vive acá**: la
 * decide `lib/navegacion/volver.ts`, su dueño único. Con historia propia vuelve
 * al listado con los filtros puestos; en frío —el link de WhatsApp— sube a la
 * home con `push`, que no atrapa: el back físico devuelve a la ficha y el
 * siguiente sale de la app, el contrato normal del browser (decisión 8).
 */
export function FichaActions({
  nombre,
  accion,
}: {
  nombre: string
  /** Slot para guardar el lugar (FAVORITOS, decisión 6): al lado de compartir. */
  accion?: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [copiado, setCopiado] = React.useState(false)

  function volver() {
    const modo = decidirVolver({
      navegoEnLaApp: huboNavegacionEnLaApp(pathname),
      historyLength: window.history.length,
    })
    if (modo === 'atras') router.back()
    else router.push('/')
  }

  async function compartir() {
    const resultado = await compartirLink(window.location.href, nombre)
    if (resultado !== 'copiado') return
    setCopiado(true)
    window.setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="flex items-center justify-between">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Volver"
        onClick={volver}
      >
        <ArrowLeft className="size-5" />
      </Button>
      <div className="flex items-center gap-1">
        {accion}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Compartir"
          onClick={compartir}
        >
          {copiado ? <Check className="size-5" /> : <Share2 className="size-5" />}
        </Button>
      </div>
    </div>
  )
}
