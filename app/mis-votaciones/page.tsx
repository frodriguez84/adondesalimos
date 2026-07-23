import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { auth } from '@/lib/auth'
import { esPremium } from '@/lib/votaciones/planes'
import { misVotaciones } from '@/lib/votaciones/query'
import { MisVotaciones } from './mis-votaciones-client'

/**
 * `/mis-votaciones` — el panel del creador (VOTACION F3, decisión 19). Sesión
 * requerida (decisión 20: el votante nunca ve un panel).
 *
 * **Gate de plan server-side** (decisión 19): `free` ve solo la **activa** (para
 * gestionarla/cerrarla); `premium` ve el **historial** completo. El corte se hace
 * en la query (`misVotaciones`), no en el cliente.
 */

export const metadata: Metadata = { title: 'Mis votaciones — ¿A dónde salimos?' }
export const dynamic = 'force-dynamic'

export default async function MisVotacionesPage() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session?.user) redirect('/login?callbackUrl=/mis-votaciones')

  const premium = await esPremium(session.user.id)
  const votaciones = await misVotaciones(session.user.id, premium)

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Mis votaciones</h1>
        <Link
          href="/votacion/nueva"
          className="shrink-0 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Armar votación
        </Link>
      </header>

      {votaciones.length === 0 ? (
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
        <MisVotaciones votaciones={votaciones} esPremium={premium} />
      )}

      {!premium && votaciones.length > 0 && (
        <p className="rounded-xl border border-dashed border-border px-4 py-3 text-xs text-muted-foreground">
          Con el plan premium vas a poder tener varias votaciones a la vez y el historial completo
          de las pasadas. Por ahora ves solo la activa; las cerradas siguen por su link.
        </p>
      )}
    </main>
  )
}
