'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, Share2 } from 'lucide-react'

import { compartirLink } from '@/components/shared/boton-compartir'
import { Button } from '@/components/ui/button'

/**
 * Volver y compartir (FICHA, § Diseño). Cliente porque `router.back()` y la Web
 * Share API viven en el browser. La regla de compartir (nativo con fallback a
 * copiar) ya no vive acá: es `compartirLink`, que comparten esta ficha y las dos
 * pantallas de votación (PBETA-R4-01). Acá queda solo la presentación de ícono.
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
  const [copiado, setCopiado] = React.useState(false)

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
        onClick={() => router.back()}
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
