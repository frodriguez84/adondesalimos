import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'

import { auth } from '@/lib/auth'
import { esPremium } from '@/lib/votaciones/planes'
import { NuevaVotacion } from './nueva-client'

/**
 * `/votacion/nueva` — armar una votación (VOTACION F1). Sesión requerida
 * (decisión 1: el creador siempre tiene cuenta). Server component con sesión
 * verificada inline (AUTH decisión 9); el armado en sí lo maneja el cliente, que
 * reusa el motor de búsqueda vía `/api/search` (decisión 12).
 *
 * **Sin login ya NO se redirige** (HOME_ENTRADAS, decisión 4): se muestra una
 * pantalla de bienvenida con CTA a ingresar, con la misma forma que la de
 * `/chat` (CHAT_IA decisión 20 — conviene venderla antes de pedir cuenta).
 * Ahora que la home anuncia la votación, mandar al anónimo a un `/login` pelado
 * es peor que no anunciarla. El gate de sesión **no cambia**: sigue siendo
 * server-side en `crearVotacion`.
 *
 * El gate "1 activa" es **server-side** (`crearVotacion`): esta pantalla no lo
 * pre-chequea — si el free ya tiene una activa, el POST responde 409 y el cliente
 * lo muestra. El cliente no es un boundary de seguridad.
 */

export const metadata: Metadata = { title: 'Armar votación — ¿A dónde salimos?' }
export const dynamic = 'force-dynamic'

export default async function NuevaVotacionPage() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)

  if (!session?.user) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-6 px-4 py-8 text-center">
        <div className="flex flex-col items-center gap-3">
          <span className="text-4xl">🗳️</span>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Dejá que elija el grupo
          </h1>
          <p className="text-sm text-muted-foreground">
            Elegí 2 a 5 lugares, mandá el link al grupo y cada uno vota. Ellos votan sin crear
            cuenta; para armarla sí necesitás una.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2">
          <Link
            href="/login?callbackUrl=/votacion/nueva"
            className="rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Ingresar para armarla
          </Link>
          <Link
            href="/"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Volver
          </Link>
        </div>
      </main>
    )
  }

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
