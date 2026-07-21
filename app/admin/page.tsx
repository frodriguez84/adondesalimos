import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'

import { sesionAdmin } from '@/lib/auth/sesion'
import { claimsPorEstado } from '@/lib/claims/query'
import { ColaClient } from './cola-client'

/**
 * `/admin` — nace con **solo la cola de aprobación** (decisión 22). El resto del
 * admin (umbral, precios, cupos, stats) sigue en BACKLOG a propósito.
 *
 * Gate inline con `ADMIN_EMAIL` (decisión 8) y **404, no 403**: para cualquiera
 * que no sea el admin, esta ruta no existe. Con `ADMIN_EMAIL` sin setear no hay
 * admin posible — nunca un panel abierto por default.
 */

export const metadata: Metadata = { title: 'Cola de aprobación — ¿A dónde salimos?' }
export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const admin = await sesionAdmin(await headers())
  if (!admin) notFound()

  const [pendientes, aprobados] = await Promise.all([
    claimsPorEstado('pending'),
    claimsPorEstado('approved'),
  ])

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Cola de aprobación</h1>
          <p className="text-sm text-muted-foreground">{admin.email}</p>
        </div>
        <Link href="/" className="shrink-0 text-sm text-muted-foreground transition-colors hover:text-primary">
          ← Volver
        </Link>
      </header>

      <ColaClient pendientes={pendientes} aprobados={aprobados} />
    </main>
  )
}
