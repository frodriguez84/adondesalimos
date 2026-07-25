import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'

import { sesionAdmin } from '@/lib/auth/sesion'
import { claimsPorEstado } from '@/lib/claims/query'
import { getHistorialPrecios, getPreciosActuales } from '@/lib/billing/settings'
import { getSuscripcionesAdmin } from '@/lib/billing/admin'
import { ColaClient } from './cola-client'
import { PreciosClient } from './precios-client'
import { SuscripcionesAdmin } from './suscripciones'

/**
 * `/admin` — cola de aprobación (AUTH, decisión 22) + Precios y Suscripciones
 * read-only (MONETIZACION, decisión 26). El resto del admin (umbral, cupos, stats)
 * sigue en BACKLOG a propósito.
 *
 * Gate inline con `ADMIN_EMAIL` (decisión 8) y **404, no 403**: para cualquiera
 * que no sea el admin, esta ruta no existe. Con `ADMIN_EMAIL` sin setear no hay
 * admin posible — nunca un panel abierto por default.
 */

export const metadata: Metadata = { title: 'Admin — ¿A dónde salimos?' }
export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const admin = await sesionAdmin(await headers())
  if (!admin) notFound()

  const [pendientes, aprobados, precios, historial, suscripciones] = await Promise.all([
    claimsPorEstado('pending'),
    claimsPorEstado('approved'),
    getPreciosActuales(),
    getHistorialPrecios(),
    getSuscripcionesAdmin(),
  ])

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-10 px-4 py-8">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Admin</h1>
          <p className="text-sm text-muted-foreground">{admin.email}</p>
        </div>
        <Link href="/" className="shrink-0 text-sm text-muted-foreground transition-colors hover:text-primary">
          ← Volver
        </Link>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Precios</h2>
        <PreciosClient precios={precios} historial={historial} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Suscripciones</h2>
        <SuscripcionesAdmin suscripciones={suscripciones} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Cola de aprobación</h2>
        <ColaClient pendientes={pendientes} aprobados={aprobados} />
      </section>
    </main>
  )
}
