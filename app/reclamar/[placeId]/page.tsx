import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'

import { auth } from '@/lib/auth'
import { getLugarAReclamar } from '@/lib/claims/query'
import { BrandHeader } from '@/components/shared/brand-header'
import { urlDeLugar } from '@/lib/lugar/url'
import { ReclamoForm } from './reclamo-form'
import { ROBOTS_PRIVADO } from '@/lib/seo/robots'

/**
 * `/reclamar/[placeId]` — formulario de reclamo de un lugar existente. Se llega
 * desde el botón "¿Sos el dueño?" de la ficha (decisión 21) o desde la búsqueda
 * de `/registrar-negocio` (decisión 11).
 *
 * Sesión inline (decisión 9): sin sesión redirige a login y **vuelve acá**, para
 * no perder el flujo. El lugar se busca en el catálogo completo, no en el
 * publicado: reclamar un lugar invisible es el caso de negocio del spec.
 */

export const metadata: Metadata = {
  title: 'Reclamar un negocio — ¿A dónde salimos?',
  robots: ROBOTS_PRIVADO,
}

export default async function ReclamarPage({
  params,
}: {
  params: Promise<{ placeId: string }>
}) {
  const { placeId } = await params

  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session?.user) redirect(`/login?callbackUrl=/reclamar/${placeId}`)

  const lugar = await getLugarAReclamar(placeId)
  if (!lugar) notFound()

  const ubicacion = [lugar.zone, lugar.address ?? lugar.locality].filter(Boolean).join(' · ')

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 px-4 py-8">
      {/* PBETA-R4-06: ver la nota en `/votacion/nueva`. */}
      <BrandHeader />

      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">¿Es tu negocio?</h1>
        <Link
          href={urlDeLugar(lugar.id)}
          className="shrink-0 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          ← Volver
        </Link>
      </header>

      <section className="rounded-2xl border border-border bg-card p-5">
        <p className="text-base font-semibold text-foreground">{lugar.name}</p>
        {ubicacion && <p className="mt-1 text-sm text-muted-foreground">{ubicacion}</p>}
      </section>

      {lugar.reclamado ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center">
          <p className="text-sm font-medium text-foreground">Este lugar ya tiene dueño</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Si creés que hay un error, escribinos y lo revisamos.
          </p>
        </div>
      ) : (
        <ReclamoForm placeId={lugar.id} />
      )}
    </main>
  )
}
