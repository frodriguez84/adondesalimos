'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { signOut } from '@/lib/auth/client'

type Props = { user: { name: string | null; email: string } | null }

/**
 * Entrada de cuenta del header de la home (spec AUTH F1). Sin sesión: link a
 * ingresar. Con sesión: menú con Mi cuenta y salir. "Mi negocio" se suma en F2
 * (todavía no existe la ruta).
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
      <Link
        href="/login"
        className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        Ingresar
      </Link>
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
