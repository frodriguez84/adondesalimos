'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Bookmark } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Guardar / sacar un lugar (FAVORITOS F1). El único componente con lógica de
 * datos de la feature en el cliente: `PlaceCard` lo recibe por el slot `accion`
 * (decisión 6) y la ficha lo monta derecho.
 *
 * **Sin sesión el botón se muestra igual** (decisión 7) y al tocarlo manda a
 * `/login?callbackUrl=<url actual>`. Es deliberado: es el punto de conversión más
 * natural que tiene la app —el usuario ya quiere algo— y esconderlo tira a la
 * basura el único momento en que un consumidor tiene motivo para registrarse.
 *
 * **Estado optimista**: el ícono cambia en el tap y se revierte si el server dice
 * que no. El revert *es* el feedback (no hay toasts en el proyecto: el criterio
 * vigente es feedback inline, y en una card no hay dónde ponerlo). Sin sheet de
 * selección: en F1 nadie tiene más de una lista, porque crear listas es F2.
 */

type Props = {
  placeId: string
  /** Estado resuelto server-side (decisión 9), no una query por card. */
  guardadoInicial?: boolean
  /** Sin sesión el tap no guarda: lleva a login y vuelve a esta misma URL. */
  autenticado: boolean
  /** `card` = chico, sobre la card. `ficha` = con rótulo, en la ficha. */
  variante?: 'card' | 'ficha'
  className?: string
}

export function BotonGuardar({
  placeId,
  guardadoInicial = false,
  autenticado,
  variante = 'card',
  className,
}: Props) {
  const router = useRouter()
  const [guardado, setGuardado] = React.useState(guardadoInicial)
  const [enVuelo, setEnVuelo] = React.useState(false)

  // El server manda: si la página se re-renderiza con otro estado (navegación,
  // login y vuelta), el botón lo sigue en vez de quedarse con lo último tocado.
  React.useEffect(() => {
    setGuardado(guardadoInicial)
  }, [guardadoInicial])

  const alTocar = React.useCallback(
    async (e: React.MouseEvent) => {
      // La card entera es un link: sin esto, guardar navegaría a la ficha.
      e.preventDefault()
      e.stopPropagation()

      if (!autenticado) {
        const destino = `${window.location.pathname}${window.location.search}`
        router.push(`/login?callbackUrl=${encodeURIComponent(destino)}`)
        return
      }
      if (enVuelo) return

      const siguiente = !guardado
      setGuardado(siguiente)
      setEnVuelo(true)
      try {
        const res = await fetch('/api/favoritos', {
          method: siguiente ? 'POST' : 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ placeId }),
        })
        // Revertir es el feedback: si el botón vuelve solo, no se guardó.
        if (!res.ok) setGuardado(!siguiente)
      } catch {
        setGuardado(!siguiente)
      } finally {
        setEnVuelo(false)
      }
    },
    [autenticado, enVuelo, guardado, placeId, router],
  )

  const etiqueta = guardado ? 'Sacar de guardados' : 'Guardar'

  if (variante === 'ficha') {
    return (
      <button
        type="button"
        onClick={alTocar}
        aria-pressed={guardado}
        aria-label={etiqueta}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground transition-colors hover:border-muted-foreground/50',
          guardado && 'border-primary/60 text-primary',
          className,
        )}
      >
        <Bookmark className={cn('size-4', guardado && 'fill-current')} />
        {guardado ? 'Guardado' : 'Guardar'}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={alTocar}
      aria-pressed={guardado}
      aria-label={etiqueta}
      title={etiqueta}
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
        guardado && 'text-primary hover:text-primary',
        className,
      )}
    >
      <Bookmark className={cn('size-5', guardado && 'fill-current')} />
    </button>
  )
}
