import { cache } from 'react'
import type { Metadata, ResolvingMetadata } from 'next'
import Link from 'next/link'
import { cookies, headers } from 'next/headers'
import { notFound } from 'next/navigation'

import { auth } from '@/lib/auth'
import { VOTER_COOKIE } from '@/lib/votaciones/constantes'
import { cierreEnPalabras } from '@/lib/votaciones/estado'
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

/**
 * ¿La cerró alguien, o venció sola? (PBETA-R2-08). El estado no alcanza: la
 * expiración perezosa persiste `status='closed'` también en la que venció, así
 * que la única señal es *cuándo* se cerró respecto de su vencimiento.
 */
function cerradaPorElCreador(v: { closedAt: Date | null; expiresAt: Date }): boolean {
  return v.closedAt !== null && v.closedAt.getTime() < v.expiresAt.getTime()
}

/** Solo el nombre de pila: alcanza para reconocer a quien te invitó y no expone más. */
function primerNombre(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] ?? nombre
}

/**
 * El título de la votación, **uno solo** para el H1 y para el `og:title`
 * (INVITACION, decisión 4).
 *
 * `PBETA-R2-04`: el fallback era la lista de nombres concatenada y ocupaba el
 * tercio superior de la pantalla —3 líneas a 390 px, 4 a 360— para repetir lo que
 * ya dicen las cards de abajo. Ahora es un texto fijo, y de paso deja de poder
 * desactualizarse cuando alguien suma un lugar (`PBETA-R2-13`).
 *
 * Los nombres no se pierden: siguen en la descripción del preview
 * («Votá entre X, Y, Z»), que es donde sirven.
 */
function tituloDe(votacion: { title: string | null }): string {
  return votacion.title || '¿A dónde vamos?'
}

/**
 * ⚠️ Una página que declara `openGraph` **pisa el del padre entero**, imagen
 * incluida: sin esto, la imagen de `app/og/route.tsx` no llega hasta acá y el link
 * vuelve a verse pelado, que es justo lo que arregla `PBETA-R2-02`. La imagen se
 * hereda del padre en vez de escribir la ruta a mano, así sigue habiendo **un
 * solo** archivo que la define.
 */
export async function generateMetadata(
  { params }: { params: Promise<{ token: string }> },
  parent: ResolvingMetadata,
): Promise<Metadata> {
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
    openGraph: {
      title: titulo,
      description: descripcion,
      images: (await parent).openGraph?.images,
    },
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

  // Hasta cuándo se puede votar (PBETA-R2-06). Se calcula en el server, que es
  // donde ya se resolvió la expiración perezosa; una votación cerrada no tiene
  // plazo que anunciar y la línea desaparece entera.
  const plazo = votacion.estado === 'open' ? cierreEnPalabras(votacion.expiresAt, new Date()) : null

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 px-4 py-8">
      <BrandHeader />

      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          {/* PBETA-R2-03: el que abre el link es un desconocido que no sabe quién
              lo invitó ni qué es esto. El eyebrow decía "Votación" y nada más.
              FB-08: pero el creador NO es un desconocido — a él no se le anuncia
              quién lo invitó ni se le ofrece armar la votación que ya armó. */}
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {esCreador
              ? 'Tu votación'
              : votacion.creatorName
                ? `Te invitó ${primerNombre(votacion.creatorName)}`
                : 'Te invitaron a votar'}
          </p>
          <h1 className="text-2xl font-bold leading-tight tracking-tight text-foreground">
            {tituloDe(votacion)}
          </h1>
          {votacion.estado === 'open' && (
            <p className="text-sm text-muted-foreground">
              Elegí a dónde ir: votás sin crear cuenta. Esto es{' '}
              <span className="text-foreground">¿A dónde salimos?</span>, la app para decidir la
              salida con el grupo.
            </p>
          )}
          {/* PBETA-R2-06 + PBETA-R2-07 en una sola línea, y arriba: cuánto tiempo
              queda, y que el voto es reversible **antes** de tocar — que es cuando
              esa frase abarata el click. Después de votar ya no hace falta, así que
              no se repite en el pie. */}
          {plazo && (
            <p className="text-xs text-muted-foreground">
              {plazo} · Podés cambiar tu voto cuando quieras
            </p>
          )}
        </div>
        {/* PBETA-R2-05: medía 35×20. Los márgenes negativos son el precio de que el
            área de toque crezca sin mover el texto: `-mr-2` compensa el padding
            lateral y `-mt-3.5` los 14 px que el alto de 44 le corría respecto del
            eyebrow, con el que tiene que seguir alineado. */}
        <Link
          href="/"
          className="-mr-2 -mt-3.5 inline-flex h-11 shrink-0 items-center px-2 text-sm text-muted-foreground transition-colors hover:text-primary"
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
        cerradaPorElCreador={cerradaPorElCreador(votacion)}
      />

      <footer className="mt-auto pt-4 text-xs text-muted-foreground">
        {esCreador ? (
          <>
            Esta votación la armaste vos. Pasale el link al grupo y seguila desde{' '}
            <Link
              href="/mis-votaciones"
              className="inline-flex min-h-11 items-center underline underline-offset-4"
            >
              Mis votaciones
            </Link>
            .
          </>
        ) : (
          <>
            Armá tu propia votación desde{' '}
            {/* PBETA-R2-05: era la única salida de la página y medía 106×15. */}
            <Link
              href="/"
              className="inline-flex min-h-11 items-center underline underline-offset-4"
            >
              ¿A dónde salimos?
            </Link>
          </>
        )}
      </footer>
    </main>
  )
}
