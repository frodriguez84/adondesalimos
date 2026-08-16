'use client'

import * as React from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'

/**
 * El aviso flotante de una acción que ya pasó (PULIDO_BETA, `PBETA-R3-04`).
 *
 * **Estrena un patrón que el proyecto había descartado**, así que el motivo queda
 * acá: `BotonGuardar` decía «no hay toasts en el proyecto: el criterio vigente es
 * feedback inline, y en una card no hay dónde ponerlo». Ese argumento es contra el
 * *inline* en una card, no contra el aviso — guardar es la única acción de la app
 * cuyo resultado vive en **otra pantalla**, así que el feedback tiene que decir
 * dónde quedó. El resto de las acciones sigue con feedback inline: esto no es una
 * invitación a llenar la app de toasts.
 *
 * Un aviso a la vez: el nuevo pisa al anterior. Los apilados obligan a decidir
 * altura, orden y colas, y acá nunca hay dos cosas que avisar juntas.
 *
 * `persistente` es para el aviso que **pide** algo (el guardado que vuelve del
 * mail, `PBETA-R3-07`): si se desvanece solo, el usuario pierde justo la acción
 * que fue a buscar.
 */

type Accion = {
  texto: string
  /** Navegación (ej. «Ver» → `/mis-lugares`). Excluyente con `alTocar`. */
  href?: string
  /** Acción en el lugar (ej. «Guardar»). Excluyente con `href`. */
  alTocar?: () => void
}

export type Aviso = {
  texto: string
  accion?: Accion
  /** Queda hasta que lo toquen o lo cierren. Por defecto se va solo. */
  persistente?: boolean
}

const DURACION_MS = 5000

const AvisoContext = React.createContext<(aviso: Aviso) => void>(() => {})

/** Cómo se muestra un aviso desde cualquier componente cliente. */
export function useAviso() {
  return React.useContext(AvisoContext)
}

export function AvisoProvider({ children }: { children: React.ReactNode }) {
  const [aviso, setAviso] = React.useState<Aviso | null>(null)

  React.useEffect(() => {
    if (!aviso || aviso.persistente) return
    const id = window.setTimeout(() => setAviso(null), DURACION_MS)
    return () => window.clearTimeout(id)
  }, [aviso])

  const cerrar = React.useCallback(() => setAviso(null), [])

  return (
    <AvisoContext.Provider value={setAviso}>
      {children}
      {aviso && <Cartel aviso={aviso} onCerrar={cerrar} />}
    </AvisoContext.Provider>
  )
}

function Cartel({ aviso, onCerrar }: { aviso: Aviso; onCerrar: () => void }) {
  const { texto, accion } = aviso

  return (
    // `role="status"` + `aria-live`: lo lee el lector de pantalla sin robar el foco,
    // que es lo que corresponde a algo que aparece sin que lo pidan.
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 mx-auto flex w-full max-w-md justify-center px-4"
    >
      <div className="pointer-events-auto flex w-full items-center gap-2 rounded-xl border border-border bg-card py-1.5 pl-4 pr-1.5 shadow-lg">
        <p className="min-w-0 flex-1 text-sm text-foreground">{texto}</p>

        {accion?.href && (
          // 44 px por lado, el piso de un toque (`PBETA-R1-08`): «Ver» son tres
          // letras, así que el ancho lo tiene que poner el padding.
          <Link
            href={accion.href}
            onClick={onCerrar}
            className="inline-flex h-11 min-w-11 shrink-0 items-center justify-center px-3 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
          >
            {accion.texto}
          </Link>
        )}

        {accion?.alTocar && (
          <button
            type="button"
            onClick={() => {
              onCerrar()
              accion.alTocar?.()
            }}
            className="inline-flex h-11 min-w-11 shrink-0 items-center justify-center px-3 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
          >
            {accion.texto}
          </button>
        )}

        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}
