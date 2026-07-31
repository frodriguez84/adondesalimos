import { cache } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies, headers } from 'next/headers'
import { notFound } from 'next/navigation'

import { auth } from '@/lib/auth'
import { VOTER_COOKIE } from '@/lib/votaciones/constantes'
import {
  esCreadorDeVotacion,
  getVotacionPublica,
  sugerenciasDelDispositivo,
  votoDelDispositivo,
} from '@/lib/votaciones/query'
import { BrandHeader } from '@/components/shared/brand-header'
import { VotacionPublicaCliente } from './votacion-client'

/**
 * `/votacion/[token]` — la página **pública** (sin sesión) de una votación (F2).
 *
 * Server-render **sin Google ni IA** (decisión 22): lee solo nuestra DB. El
 * preview de WhatsApp del link (`generateMetadata`) sale de datos propios y no
 * dispara ninguna llamada paga. Cerrada/expirada/cancelada ⇒ solo-lectura, nunca
 * 404 (decisión 15); el único 404 es un token inexistente.
 */

export const dynamic = 'force-dynamic'

// React.cache: `generateMetadata` y el render comparten la misma lectura dentro
// del request (un solo query, una sola expiración lazy). Mismo criterio que FICHA.
const cargar = cache((token: string) => getVotacionPublica(token))

function tituloDe(votacion: { title: string | null; opciones: { name: string }[] }): string {
  if (votacion.title) return votacion.title
  const nombres = votacion.opciones.map((o) => o.name)
  return nombres.length > 0 ? `¿A dónde salimos? ${nombres.join(' · ')}` : '¿A dónde salimos?'
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>
}): Promise<Metadata> {
  const { token } = await params
  const votacion = await cargar(token)
  if (!votacion) return { title: 'Votación no encontrada — ¿A dónde salimos?' }

  const titulo = tituloDe(votacion)
  const descripcion =
    votacion.opciones.length > 0
      ? `Votá entre ${votacion.opciones.map((o) => o.name).join(', ')}.`
      : 'Votá a dónde salir con tu grupo.'

  return {
    title: `${titulo} — ¿A dónde salimos?`,
    description: descripcion,
    openGraph: { title: titulo, description: descripcion },
  }
}

export default async function VotacionPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const votacion = await cargar(token)
  if (!votacion) notFound()

  // La opción que ya votó este dispositivo (decisión 8: al reabrir, la ve marcada)
  // y las que sumó él mismo (SUGERIR_EN_VOTACION: puede sacarlas mientras nadie las
  // vote). Las dos salen de cruzar la cookie **acá**, en el server.
  const voterToken = (await cookies()).get(VOTER_COOKIE)?.value
  const votedOptionId = voterToken ? await votoDelDispositivo(votacion.id, voterToken) : null
  const misSugerencias = voterToken ? await sugerenciasDelDispositivo(votacion.id, voterToken) : []

  // Moderación del creador (decisión 8): el botón de quitar se muestra solo si la
  // sesión es la del dueño de ESTA votación. Es cosmética —el gate real está en la
  // acción de dominio— pero evita ofrecer algo que va a fallar.
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  const esCreador = session?.user
    ? await esCreadorDeVotacion(votacion.id, session.user.id)
    : false

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 px-4 py-8">
      <BrandHeader />

      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Votación
          </p>
          <h1 className="text-2xl font-bold leading-tight tracking-tight text-foreground">
            {tituloDe(votacion)}
          </h1>
        </div>
        <Link
          href="/"
          className="shrink-0 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          Inicio
        </Link>
      </header>

      <VotacionPublicaCliente
        token={token}
        estadoInicial={votacion.estado}
        winnerPlaceId={votacion.winnerPlaceId}
        totalInicial={votacion.totalVotos}
        opciones={votacion.opciones}
        votedOptionIdInicial={votedOptionId}
        allowSuggestionsInicial={votacion.allowSuggestions}
        misSugerenciasInicial={misSugerencias}
        esCreador={esCreador}
      />

      <footer className="mt-auto pt-4 text-xs text-muted-foreground">
        Armá tu propia votación desde{' '}
        <Link href="/" className="underline underline-offset-4">
          ¿A dónde salimos?
        </Link>
      </footer>
    </main>
  )
}
