'use client'

import * as React from 'react'
import { Share2 } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Compartir un link, en un solo lugar (PULIDO_BETA, PBETA-R4-01).
 *
 * La regla vivía embebida en `ficha-actions.tsx` y las dos pantallas de votación
 * —donde el loop viral realmente arranca— solo ofrecían "Copiar". Acá queda la
 * regla sola (`compartirLink`) y un botón con rótulo para reusarla; la ficha
 * conserva su botón de ícono y llama al mismo helper.
 *
 * En mobile abre el menú nativo (WhatsApp en un toque); donde no existe
 * `navigator.share` cae a copiar al portapapeles. Nunca queda muerto.
 */
export async function compartirLink(
  url: string,
  titulo: string,
): Promise<'compartido' | 'copiado' | 'nada'> {
  if (navigator.share) {
    try {
      await navigator.share({ title: titulo, url })
      return 'compartido'
    } catch {
      // El usuario canceló el diálogo nativo: no es un error, no se hace nada.
      return 'nada'
    }
  }
  try {
    await navigator.clipboard.writeText(url)
    return 'copiado'
  } catch {
    // Sin permiso de portapapeles no hay fallback razonable.
    return 'nada'
  }
}

export function BotonCompartir({
  url,
  titulo,
  etiqueta = 'Compartir',
  className,
}: {
  url: string
  /** Lo que ve el usuario en el menú nativo. */
  titulo: string
  etiqueta?: string
  className?: string
}) {
  const [copiado, setCopiado] = React.useState(false)

  async function alTocar() {
    const resultado = await compartirLink(url, titulo)
    if (resultado !== 'copiado') return
    setCopiado(true)
    window.setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={alTocar}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90',
        className,
      )}
    >
      <Share2 className="size-4" />
      {copiado ? 'Link copiado' : etiqueta}
    </button>
  )
}
