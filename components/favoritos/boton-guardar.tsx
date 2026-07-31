'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Bookmark } from 'lucide-react'

import { BottomSheet } from '@/components/ui/bottom-sheet'
import type { ListaDestino } from '@/lib/favoritos/query'
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
 * vigente es feedback inline, y en una card no hay dónde ponerlo).
 *
 * **Sheet de destino (F2, decisión 8)**: con más de una lista visible, el tap abre
 * el sheet en vez de guardar derecho. Con una sola —el caso de todo usuario free—
 * sigue siendo un tap y listo: nadie elige lista si solo tiene una.
 */

type Props = {
  placeId: string
  /** Estado resuelto server-side (decisión 9), no una query por card. */
  guardadoInicial?: boolean
  /** Sin sesión el tap no guarda: lleva a login y vuelve a esta misma URL. */
  autenticado: boolean
  /** `card` = chico, sobre la card. `ficha` = con rótulo, en la ficha. */
  variante?: 'card' | 'ficha'
  /**
   * Listas visibles del usuario, resueltas server-side junto con el estado. Con
   * más de una, el tap abre el sheet de destino (decisión 8).
   */
  listas?: ListaDestino[]
  /**
   * Cuando el botón vive **dentro** de una lista concreta (`/mis-lugares`): opera
   * solo sobre ella y nunca abre el sheet. Sin esto, sacar quitaría el lugar de
   * todas las listas visibles, que no es lo que pide quien está mirando una.
   */
  listId?: string
  /** Tras un cambio confirmado por el server. Lo usa `/mis-lugares` para refrescar. */
  onCambio?: () => void
  className?: string
}

export function BotonGuardar({
  placeId,
  guardadoInicial = false,
  autenticado,
  variante = 'card',
  listas = [],
  listId,
  onCambio,
  className,
}: Props) {
  const router = useRouter()
  const [guardado, setGuardado] = React.useState(guardadoInicial)
  const [enVuelo, setEnVuelo] = React.useState(false)
  const [sheetAbierto, setSheetAbierto] = React.useState(false)

  // El server manda: si la página se re-renderiza con otro estado (navegación,
  // login y vuelta), el botón lo sigue en vez de quedarse con lo último tocado.
  React.useEffect(() => {
    setGuardado(guardadoInicial)
  }, [guardadoInicial])

  /** El request en sí. `destino` = a qué lista (sin destino: la default). */
  const enviar = React.useCallback(
    async (siguiente: boolean, destino?: string) => {
      if (enVuelo) return
      setGuardado(siguiente)
      setEnVuelo(true)
      try {
        const res = await fetch('/api/favoritos', {
          method: siguiente ? 'POST' : 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ placeId, listId: destino ?? listId }),
        })
        // Revertir es el feedback: si el botón vuelve solo, no se guardó.
        if (!res.ok) setGuardado(!siguiente)
        else onCambio?.()
      } catch {
        setGuardado(!siguiente)
      } finally {
        setEnVuelo(false)
      }
    },
    [enVuelo, listId, onCambio, placeId],
  )

  // Con más de una lista hay que elegir destino (decisión 8). No aplica cuando el
  // botón ya vive dentro de una lista, ni para sacar (el estado es por lugar).
  const eligeDestino = !listId && !guardado && listas.length > 1

  const alTocar = React.useCallback(
    (e: React.MouseEvent) => {
      // La card entera es un link: sin esto, guardar navegaría a la ficha.
      e.preventDefault()
      e.stopPropagation()

      if (!autenticado) {
        const destino = `${window.location.pathname}${window.location.search}`
        router.push(`/login?callbackUrl=${encodeURIComponent(destino)}`)
        return
      }
      if (eligeDestino) {
        setSheetAbierto(true)
        return
      }
      void enviar(!guardado)
    },
    [autenticado, eligeDestino, enviar, guardado, router],
  )

  const etiqueta = guardado ? 'Sacar de guardados' : 'Guardar'

  const boton =
    variante === 'ficha' ? (
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
    ) : (
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

  return (
    <>
      {boton}
      {/* Se monta solo cuando hace falta: si no, cada card de la página dejaría un
          overlay fijo dormido en el DOM. */}
      {sheetAbierto && (
        <SheetDestino
          listas={listas}
          onElegir={(destino) => {
            setSheetAbierto(false)
            void enviar(true, destino)
          }}
          onClose={() => setSheetAbierto(false)}
        />
      )}
    </>
  )
}

/** "¿En qué lista?" — solo aparece con más de una (decisión 8). */
function SheetDestino({
  listas,
  onElegir,
  onClose,
}: {
  listas: ListaDestino[]
  onElegir: (listId: string) => void
  onClose: () => void
}) {
  return (
    <BottomSheet open onClose={onClose}>
      <h2 className="mb-3 text-base font-semibold text-foreground">¿En qué lista lo ponemos?</h2>
      <ul className="flex flex-col gap-1">
        {listas.map((l) => (
          <li key={l.id}>
            <button
              type="button"
              onClick={() => onElegir(l.id)}
              className="w-full rounded-lg px-3 py-3 text-left text-sm text-foreground transition-colors hover:bg-secondary"
            >
              {l.name}
            </button>
          </li>
        ))}
      </ul>
    </BottomSheet>
  )
}
