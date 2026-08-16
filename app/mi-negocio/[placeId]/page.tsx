import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { Eye } from 'lucide-react'

import { auth } from '@/lib/auth'
import { solicitudesPendientesDelUsuario, type SolicitudPendiente } from '@/lib/claims/query'
import { desgloseEstadisticas, getPanelLugar } from '@/lib/negocio/query'
import { getPrecioB2bArs } from '@/lib/billing/settings'
import { estadoSuscripcionB2B } from '@/lib/billing/estado'
import { cobroApagado } from '@/lib/billing/apagado'
import { tieneInteres } from '@/lib/billing/interes'
import { SuscripcionPanel } from '@/components/billing/suscripcion-panel'
import { DesglosePanel } from '@/components/negocio/desglose-panel'
import { BrandHeader } from '@/components/shared/brand-header'
import { EditorClient } from './editor-client'

/**
 * `/mi-negocio/[placeId]` — el editor. Datos de contacto, tags de las 7 facetas,
 * fotos y los campos pagos (bloqueados en `free`).
 *
 * **404 y no 403 para un lugar ajeno** (mismo criterio que `/admin` en F2): la
 * ruta no existe para quien no es el dueño. El gate lo resuelve `getPanelLugar`
 * con `esDuenoDe` — la misma función que usan los dos endpoints, así la pantalla
 * y la API no pueden discrepar sobre quién puede editar qué.
 *
 * **Con una solicitud propia todavía en revisión, en cambio, la ruta sí existe**
 * (PBETA-R6-02): el que reclamó y guardó la URL aterrizaba en un 404 que le decía
 * que su lugar no existe. Se le muestra el estado en su lugar. No filtra nada —
 * solo se entra con un `pending` **de ese mismo usuario sobre ese mismo lugar**,
 * que es algo que él ya sabe porque lo mandó. Sigue sin poder editar: hasta que
 * el claim no esté aprobado no hay panel.
 */

export const metadata: Metadata = { title: 'Editar mi negocio — ¿A dónde salimos?' }
export const dynamic = 'force-dynamic'

export default async function EditorPage({ params }: { params: Promise<{ placeId: string }> }) {
  const { placeId } = await params
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session?.user) redirect(`/login?callbackUrl=/mi-negocio/${placeId}`)

  const lugar = await getPanelLugar(placeId, session.user.id)
  if (!lugar) {
    const solicitud = (await solicitudesPendientesDelUsuario(session.user.id)).find(
      (s) => s.placeId === placeId,
    )
    if (!solicitud) notFound()
    return <EnRevision solicitud={solicitud} />
  }

  const [suscripcion, precioB2b, desglose, interesRegistrado] = await Promise.all([
    estadoSuscripcionB2B(placeId),
    getPrecioB2bArs(),
    // Gateado por `owner_plan='paid'` en la query: `free` devuelve null y el
    // dueño se queda con el teaser de arriba (decisión 24).
    desgloseEstadisticas(placeId),
    // Solo con el cobro apagado (DEPLOY, decisión 6).
    cobroApagado() ? tieneInteres(session.user.id, placeId) : Promise.resolve(false),
  ])

  const ubicacion = [lugar.zone, lugar.address ?? lugar.locality].filter(Boolean).join(' · ')

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 px-4 py-8">
      <BrandHeader />

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

      <SuscripcionPanel
        tipo="b2b"
        placeId={placeId}
        estado={suscripcion}
        precioArs={precioB2b}
        email={session.user.email}
        interesRegistrado={interesRegistrado}
      />

      {desglose && <DesglosePanel desglose={desglose} />}

      <EditorClient lugar={lugar} />
    </main>
  )
}

/**
 * El panel de un lugar cuya solicitud todavía está en la cola. Dice las dos cosas
 * que el dueño vino a averiguar: que llegó, y qué va a pasar cuando se apruebe.
 */
function EnRevision({ solicitud }: { solicitud: SolicitudPendiente }) {
  const donde = [solicitud.zone, solicitud.address ?? solicitud.locality]
    .filter(Boolean)
    .join(' · ')

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 px-4 py-8">
      <BrandHeader />

      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <h1 className="min-w-0 truncate text-2xl font-bold tracking-tight text-foreground">
            {solicitud.placeName}
          </h1>
          <Link
            href="/mi-negocio"
            className="shrink-0 text-sm text-muted-foreground transition-colors hover:text-primary"
          >
            ← Volver
          </Link>
        </div>
        {donde && <p className="text-sm text-muted-foreground">{donde}</p>}
      </header>

      <section className="flex flex-col gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-6">
        <h2 className="text-base font-semibold text-foreground">Tu solicitud está en revisión</h2>
        <p className="text-sm text-muted-foreground">
          {solicitud.kind === 'new'
            ? 'Todavía no lo publicamos: lo miramos a mano antes de que aparezca en la app.'
            : 'La miramos a mano, una por una. No hace falta que la mandes de nuevo.'}{' '}
          Te avisamos por mail cuando esté resuelta.
        </p>
        <p className="text-sm text-muted-foreground">
          Cuando la aprobemos vas a poder editar acá los datos, las tags, los horarios y las fotos
          de tu lugar.
        </p>
      </section>
    </main>
  )
}
