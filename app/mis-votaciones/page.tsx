import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { auth } from '@/lib/auth'
import { esPremium } from '@/lib/votaciones/planes'
import {
  historialDeVotaciones,
  votacionesActivas,
  type PaginaHistorial,
} from '@/lib/votaciones/query'
import { BrandHeader } from '@/components/shared/brand-header'
import { MisVotaciones } from './mis-votaciones-client'

/**
 * `/mis-votaciones` — el panel del creador (VOTACION F3, decisión 19). Sesión
 * requerida (decisión 20: el votante nunca ve un panel).
 *
 * **Gate de plan server-side** (decisión 19): las **activas** las ven los dos
 * planes —el free tiene una sola y necesita gestionarla—; el **historial** es
 * premium y ni siquiera se consulta para un free (decisión 5 del pulido: no hay
 * teaser en gris de lo que no se puede abrir). El corte se hace acá y en la query,
 * nunca en el cliente.
 */

export const metadata: Metadata = { title: 'Mis votaciones — ¿A dónde salimos?' }
export const dynamic = 'force-dynamic'

const SIN_HISTORIAL: PaginaHistorial = { filas: [], nextCursor: null }

export default async function MisVotacionesPage() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session?.user) redirect('/login?callbackUrl=/mis-votaciones')

  const premium = await esPremium(session.user.id)
  const [activas, historial] = await Promise.all([
    votacionesActivas(session.user.id),
    premium ? historialDeVotaciones(session.user.id) : Promise.resolve(SIN_HISTORIAL),
  ])
  const vacio = activas.length === 0 && historial.filas.length === 0

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 px-4 py-8">
      {/* El renglón del título ya lo ocupa el CTA: la marca y el volver van arriba. */}
      <div className="flex items-center justify-between gap-3">
        <BrandHeader />
        <Link
          href="/"
          className="shrink-0 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          ← Volver
        </Link>
      </div>

      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Mis votaciones</h1>
        <Link
          href="/votacion/nueva"
          className="shrink-0 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Armar votación
        </Link>
      </header>

      {vacio ? (
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
          <h2 className="text-base font-semibold text-foreground">
            {premium ? 'Todavía no armaste ninguna' : 'No tenés una votación activa'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {premium
              ? 'Armá una votación, compartí el link al grupo y seguí los resultados en vivo.'
              : 'Armá una votación para decidir a dónde salir. Las cerradas siguen accesibles por su link.'}
          </p>
          <Link
            href="/votacion/nueva"
            className="rounded-xl bg-primary py-3 text-center font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Armar votación
          </Link>
        </div>
      ) : (
        <MisVotaciones
          activas={activas}
          historial={historial.filas}
          cursorInicial={historial.nextCursor}
          esPremium={premium}
        />
      )}

      {!premium && activas.length > 0 && (
        <p className="rounded-xl border border-dashed border-border px-4 py-3 text-xs text-muted-foreground">
          Con el plan premium vas a poder tener varias votaciones a la vez y el historial completo
          de las pasadas. Por ahora ves solo la activa; las cerradas siguen por su link.
        </p>
      )}
    </main>
  )
}
