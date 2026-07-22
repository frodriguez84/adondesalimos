import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { Eye } from 'lucide-react'

import { auth } from '@/lib/auth'
import { getPanelLugar } from '@/lib/negocio/query'
import { EditorClient } from './editor-client'

/**
 * `/mi-negocio/[placeId]` — el editor. Datos de contacto, tags de las 7 facetas,
 * fotos y los campos pagos (bloqueados en `free`).
 *
 * **404 y no 403 para un lugar ajeno** (mismo criterio que `/admin` en F2): la
 * ruta no existe para quien no es el dueño. El gate lo resuelve `getPanelLugar`
 * con `esDuenoDe` — la misma función que usan los dos endpoints, así la pantalla
 * y la API no pueden discrepar sobre quién puede editar qué.
 */

export const metadata: Metadata = { title: 'Editar mi negocio — ¿A dónde salimos?' }
export const dynamic = 'force-dynamic'

export default async function EditorPage({ params }: { params: Promise<{ placeId: string }> }) {
  const { placeId } = await params
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session?.user) redirect(`/login?callbackUrl=/mi-negocio/${placeId}`)

  const lugar = await getPanelLugar(placeId, session.user.id)
  if (!lugar) notFound()

  const ubicacion = [lugar.zone, lugar.address ?? lugar.locality].filter(Boolean).join(' · ')

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <h1 className="min-w-0 truncate text-2xl font-bold tracking-tight text-foreground">
            {lugar.name}
          </h1>
          <Link
            href="/mi-negocio"
            className="shrink-0 text-sm text-muted-foreground transition-colors hover:text-primary"
          >
            ← Volver
          </Link>
        </div>
        {ubicacion && <p className="text-sm text-muted-foreground">{ubicacion}</p>}

        {/* Teaser (decisión 24): el número del mes corriente y nada más. */}
        <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <Eye className="size-4" />
          <strong className="font-semibold text-foreground">{lugar.visitasDelMes}</strong>
          {lugar.visitasDelMes === 1 ? 'visita a tu ficha' : 'visitas a tu ficha'} este mes
        </p>

        {lugar.publicado ? (
          <Link
            href={`/lugar/${lugar.id}`}
            className="w-fit text-sm text-primary underline underline-offset-4"
          >
            Ver mi ficha
          </Link>
        ) : (
          <p className="text-xs text-muted-foreground">
            Tu ficha todavía no se ve en la app. Escribinos si creés que es un error.
          </p>
        )}
      </header>

      <EditorClient lugar={lugar} />
    </main>
  )
}
