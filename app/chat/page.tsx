import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'

import { auth } from '@/lib/auth'
import { getPrecioB2cArs } from '@/lib/billing/settings'
import { esPremium } from '@/lib/votaciones/planes'
import { resumenCupo } from '@/lib/ai/cupo'
import { ChatClient } from './chat-client'
import { ROBOTS_PRIVADO } from '@/lib/seo/robots'

/**
 * `/chat` — chat IA "armá tu salida" (CHAT_IA F2). Server component con gate por
 * sesión inline (AUTH decisión 9; mismo patrón que `/votacion/nueva`).
 *
 * **Sin login NO se redirige**: se muestra una pantalla de bienvenida con CTA a
 * ingresar (CHAT-01, decisión 20) — es la feature estrella del premium, conviene
 * venderla antes de pedir cuenta. Con sesión, el gating real es server-side en cada
 * request de `/api/chat`; acá solo se calcula el estado inicial para pintar el
 * contador y el CTA correcto sin un fetch extra (decisión 20).
 */

export const metadata: Metadata = {
  title: 'Chat IA — ¿A dónde salimos?',
  robots: ROBOTS_PRIVADO,
}
export const dynamic = 'force-dynamic'

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ modo?: string }>
}) {
  // Modo shortlist (CHAT_IA F3, decisión 21): entrada desde el botón de
  // `/votacion/nueva`. Solo cambia la directiva del prompt y muestra el botón
  // "Usar esta shortlist"; todo lo demás es el mismo chat y el mismo cupo.
  const { modo } = await searchParams
  const modoChat = modo === 'shortlist' ? 'shortlist' : 'chat'

  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)

  if (!session?.user) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-6 px-4 py-8 text-center">
        <div className="flex flex-col items-center gap-3">
          <span className="text-4xl">✨</span>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Chat IA para salir</h1>
          <p className="text-sm text-muted-foreground">
            Contale qué pinta —“algo tranqui con mi vieja en Palermo el domingo”— y te tira lugares
            reales, al toque. Necesitás una cuenta para arrancar.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2">
          <Link
            href="/login?callbackUrl=/chat"
            className="rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Ingresar para chatear
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

  const premium = await esPremium(session.user.id)
  // El precio lo pinta el gate del cupo agotado (PBETA-R5-03). Se lee de
  // `lib/billing/settings` —dueño único del precio— igual que `/cuenta`.
  const [cupo, precioB2c] = await Promise.all([
    resumenCupo(session.user.id, premium),
    getPrecioB2cArs(),
  ])

  return (
    <ChatClient
      plan={premium ? 'premium' : 'trial'}
      restantesIniciales={cupo.restantes}
      cupoTotal={cupo.cupo}
      precioB2cArs={precioB2c}
      modo={modoChat}
    />
  )
}
