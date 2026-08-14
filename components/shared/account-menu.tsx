'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Menu, Sparkles } from 'lucide-react'
import { signOut } from '@/lib/auth/client'

type Props = { user: { name: string | null; email: string } | null }

/**
 * Entrada de cuenta del header de la home (spec AUTH F1). Con sesión: menú con
 * las rutas del usuario.
 *
 * HOME_ENTRADAS (decisiones 5 y 6): **sin sesión el menú también se abre**, con
 * los items públicos. El control del header deja de ser el link "Ingresar" y
 * pasa a ser ☰ — no conviven los dos: en 390 px el header ya lleva el wordmark
 * y con sesión el patrón ya es *un solo control a la derecha*. El costo está
 * aceptado y declarado en el spec (ingresar deja de estar a un toque), y se
 * mitiga poniendo "Ingresar" **primero y resaltado** en el menú.
 *
 * F2 suma "Registrá tu negocio": es la única puerta al alta de un lugar nuevo
 * (el botón de la ficha solo cubre reclamar lo que ya existe). F3 suma "Mi
 * negocio", la lista de lugares propios.
 *
 * "Mi negocio" se muestra a **todos** los que tienen sesión, no solo a los
 * dueños: preguntar por reclamos aprobados sería una query en el header de cada
 * página, y la pantalla ya resuelve el caso sin lugares mandando al alta.
 *
 * VOTACION suma "Armar votación" y "Mis votaciones" (decisión / rutas): visibles
 * para todo usuario con sesión, con el mismo criterio que "Mi negocio" — la
 * pantalla destino resuelve el caso vacío, no se pre-consulta acá.
 *
 * CHAT_IA (F2) suma "Chat IA": visible para todo usuario con sesión; el gate de
 * plan (probadita free vs premium) lo resuelve `/chat` server-side, no acá.
 *
 * FAVORITOS (F2) suma "Mis lugares", al lado de "Mis votaciones" (decisión 10):
 * es el mismo tipo de objeto —algo mío, con su propia pantalla— y la página
 * resuelve sola el caso de no tener nada guardado.
 */
export function AccountMenu({ user }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  if (!user) {
    return (
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Menú"
          className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Menu className="size-5" />
        </button>
        {open && (
          <div
            role="menu"
            className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-xl border border-border bg-popover shadow-lg"
          >
            <Link
              href="/login"
              role="menuitem"
              className="block border-b border-border px-4 py-3 text-sm font-semibold text-primary transition-colors hover:bg-secondary"
              onClick={() => setOpen(false)}
            >
              Ingresar
            </Link>
            <Link
              href="/votacion/nueva"
              role="menuitem"
              className="block px-4 py-3 text-sm text-foreground transition-colors hover:bg-secondary"
              onClick={() => setOpen(false)}
            >
              Armar votación
            </Link>
            <Link
              href="/chat"
              role="menuitem"
              className="flex items-center gap-1.5 px-4 py-3 text-sm text-foreground transition-colors hover:bg-secondary"
              onClick={() => setOpen(false)}
            >
              <Sparkles className="size-4 text-primary" />
              Chat IA
            </Link>
          </div>
        )}
      </div>
    )
  }

  const inicial = (user.name?.trim()?.[0] ?? user.email[0] ?? '?').toUpperCase()

  async function salir() {
    await signOut()
    window.location.assign('/')
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menú de cuenta"
        className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        {inicial}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-xl border border-border bg-popover shadow-lg"
        >
          <div className="border-b border-border px-4 py-3">
            <p className="truncate text-sm font-medium text-foreground">{user.name || 'Mi cuenta'}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
          <Link
            href="/chat"
            role="menuitem"
            className="flex items-center gap-1.5 px-4 py-3 text-sm text-foreground transition-colors hover:bg-secondary"
            onClick={() => setOpen(false)}
          >
            <Sparkles className="size-4 text-primary" />
            Chat IA
          </Link>
          <Link
            href="/votacion/nueva"
            role="menuitem"
            className="block px-4 py-3 text-sm text-foreground transition-colors hover:bg-secondary"
            onClick={() => setOpen(false)}
          >
            Armar votación
          </Link>
          <Link
            href="/mis-votaciones"
            role="menuitem"
            className="block px-4 py-3 text-sm text-foreground transition-colors hover:bg-secondary"
            onClick={() => setOpen(false)}
          >
            Mis votaciones
          </Link>
          <Link
            href="/mis-lugares"
            role="menuitem"
            className="block px-4 py-3 text-sm text-foreground transition-colors hover:bg-secondary"
            onClick={() => setOpen(false)}
          >
            Mis lugares
          </Link>
          <Link
            href="/mi-negocio"
            role="menuitem"
            className="block px-4 py-3 text-sm text-foreground transition-colors hover:bg-secondary"
            onClick={() => setOpen(false)}
          >
            Mi negocio
          </Link>
          <Link
            href="/registrar-negocio"
            role="menuitem"
            className="block px-4 py-3 text-sm text-foreground transition-colors hover:bg-secondary"
            onClick={() => setOpen(false)}
          >
            Registrá tu negocio
          </Link>
          <Link
            href="/cuenta"
            role="menuitem"
            className="block px-4 py-3 text-sm text-foreground transition-colors hover:bg-secondary"
            onClick={() => setOpen(false)}
          >
            Mi cuenta
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={salir}
            className="block w-full px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            Salir
          </button>
        </div>
      )}
    </div>
  )
}
