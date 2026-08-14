'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  className?: string
}

/** Cuánto hay que bajarlo para que cierre al soltar. Menos que eso, vuelve solo. */
const UMBRAL_CIERRE_PX = 80
/** A partir de acá el gesto es un arrastre y no un toque (para no cerrar de más). */
const UMBRAL_MOVIMIENTO_PX = 8

/**
 * Sheet inferior mobile-first: overlay + panel deslizante, resuelto con CSS + estado.
 * Sin librería extra. El padre controla `open` y provee `onClose`.
 *
 * **FB-09 — la barrita promete y ahora cumple.** El handle se dibujaba desde el
 * día 1 y no había un solo handler de touch: el gesto obvio en mobile (bajarlo
 * con el dedo) no hacía nada. Se arrastra hacia abajo y cierra al soltar pasado
 * el umbral; además el handle es un **botón real** con `aria-label`, así que
 * también cierra con un toque y con teclado (cierra de paso `PBETA-R2-09`: el
 * sheet "Sumá un lugar" no tenía ninguna forma visible de cerrarse).
 *
 * Dos cosas que el arrastre **no** puede romper, y por eso están explícitas:
 * - el tap en el overlay, que ya cerraba (los handlers viven en el panel, no acá);
 * - el scroll interno (`max-h-[85vh] overflow-y-auto`). El arrastre solo arranca
 *   con el contenido en el tope (`scrollTop === 0`); si el sheet está scrolleado,
 *   el dedo hacia abajo es scroll y nada más. Es el mismo criterio que usan los
 *   sheets nativos.
 *
 * Solo touch: el reporte es de mobile y en desktop el overlay y el botón ya
 * alcanzan. No se usa `preventDefault` porque React registra `touchmove` como
 * pasivo — de ahí el `overscroll-contain`, que evita que el gesto se encadene a
 * la página de atrás.
 */
function BottomSheet({ open, onClose, children, className }: BottomSheetProps) {
  const panelRef = React.useRef<HTMLDivElement>(null)
  /** Y del dedo al empezar. `null` = este gesto no es un arrastre. */
  const inicioY = React.useRef<number | null>(null)
  /** Hubo desplazamiento real: el click que sigue al touchend no debe cerrar. */
  const movio = React.useRef(false)
  const [dy, setDy] = React.useState(0)

  // Si lo cierra otro camino (overlay, Ver N lugares) en medio de un arrastre, el
  // offset no puede quedar pegado para la próxima apertura.
  React.useEffect(() => {
    if (!open) {
      inicioY.current = null
      movio.current = false
      setDy(0)
    }
  }, [open])

  function alEmpezar(e: React.TouchEvent) {
    const el = panelRef.current
    inicioY.current = null
    movio.current = false
    if (!open || !el || el.scrollTop > 0) return
    inicioY.current = e.touches[0]?.clientY ?? null
  }

  function alMover(e: React.TouchEvent) {
    if (inicioY.current === null) return
    const delta = (e.touches[0]?.clientY ?? 0) - inicioY.current
    if (Math.abs(delta) > UMBRAL_MOVIMIENTO_PX) movio.current = true
    // Hacia arriba no se estira: ahí el gesto es scroll (o nada).
    setDy(delta > 0 ? delta : 0)
  }

  function alSoltar() {
    if (inicioY.current === null) return
    const cerrar = dy > UMBRAL_CIERRE_PX
    inicioY.current = null
    setDy(0)
    if (cerrar) onClose()
  }

  const arrastrando = dy > 0

  return (
    <div
      data-slot="bottom-sheet"
      aria-hidden={!open}
      className={cn('fixed inset-0 z-50', open ? 'pointer-events-auto' : 'pointer-events-none')}
    >
      <div
        onClick={onClose}
        className={cn(
          'absolute inset-0 bg-black/60 transition-opacity duration-300',
          open ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        onTouchStart={alEmpezar}
        onTouchMove={alMover}
        onTouchEnd={alSoltar}
        onTouchCancel={() => {
          inicioY.current = null
          setDy(0)
        }}
        style={arrastrando ? { transform: `translateY(${dy}px)` } : undefined}
        className={cn(
          'absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto overscroll-contain rounded-t-2xl border-t border-border bg-card p-4 transition-transform duration-300',
          open ? 'translate-y-0' : 'translate-y-full',
          // Siguiendo al dedo no hay animación: la transición es para el snap.
          arrastrando && 'transition-none',
          className,
        )}
      >
        <button
          type="button"
          aria-label="Cerrar"
          onClick={() => {
            // Soltar después de arrastrar dispara un click igual: si el gesto no
            // llegó al umbral, el sheet vuelve y no se cierra por la ventana.
            if (movio.current) {
              movio.current = false
              return
            }
            onClose()
          }}
          // `INV-A`: medía 96×16 y es el único cierre visible del sheet en
          // mobile. Sube a 44 de alto con el `mb` recortado, así lo que se come
          // arriba del contenido son 20 px y no 28 (medido: el contenido del
          // sheet de zona arranca en 192 px).
          className="mx-auto mb-1 flex min-h-11 w-24 items-center justify-center"
        >
          <span className="block h-1 w-10 rounded-full bg-muted-foreground/40" />
        </button>
        {children}
      </div>
    </div>
  )
}

export { BottomSheet }
