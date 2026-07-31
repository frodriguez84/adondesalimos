'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, Share2 } from 'lucide-react'

import { Button } from '@/components/ui/button'

/**
 * Volver y compartir (FICHA, § Diseño). Cliente porque `router.back()` y la Web
 * Share API viven en el browser. Compartir la ficha por WhatsApp es el loop viral
 * del producto, así que el botón usa `navigator.share` cuando existe (mobile) y
 * cae a copiar el link al portapapeles cuando no (desktop) — nunca queda muerto.
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
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({ title: nombre, url })
      } catch {
        // El usuario canceló el diálogo nativo: no es un error, no se hace nada.
      }
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Sin permiso de portapapeles no hay fallback razonable; se ignora.
    }
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
