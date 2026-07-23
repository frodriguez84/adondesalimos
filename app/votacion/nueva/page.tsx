import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { auth } from '@/lib/auth'
import { esPremium } from '@/lib/votaciones/planes'
import { NuevaVotacion } from './nueva-client'

/**
 * `/votacion/nueva` — armar una votación (VOTACION F1). Sesión requerida
 * (decisión 1: el creador siempre tiene cuenta). Server component con sesión
 * verificada inline (AUTH decisión 9); el armado en sí lo maneja el cliente, que
 * reusa el motor de búsqueda vía `/api/search` (decisión 12).
 *
 * El gate "1 activa" es **server-side** (`crearVotacion`): esta pantalla no lo
 * pre-chequea — si el free ya tiene una activa, el POST responde 409 y el cliente
 * lo muestra. El cliente no es un boundary de seguridad.
 */

export const metadata: Metadata = { title: 'Armar votación — ¿A dónde salimos?' }
export const dynamic = 'force-dynamic'

export default async function NuevaVotacionPage() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session?.user) redirect('/login?callbackUrl=/votacion/nueva')

  // Gate premium server-side (decisión 18): el botón "que la IA elija" se ofrece
  // solo a premium y en v1 no llama a ninguna IA (no-op). Free no lo ve.
  const premium = await esPremium(session.user.id)

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Armar votación</h1>
          <p className="text-sm text-muted-foreground">
            Elegí 2 a 5 lugares y compartí el link al grupo.
          </p>
        </div>
        <Link
          href="/"
          className="shrink-0 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          ← Volver
        </Link>
      </header>

      <NuevaVotacion esPremium={premium} />
    </main>
  )
}
