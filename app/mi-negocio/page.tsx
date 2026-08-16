import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { Eye, ImageIcon, Store } from 'lucide-react'

import { auth } from '@/lib/auth'
import { solicitudesPendientesDelUsuario } from '@/lib/claims/query'
import { misLugares } from '@/lib/negocio/query'
import { BrandHeader } from '@/components/shared/brand-header'

/**
 * `/mi-negocio` — la lista de lugares con reclamo aprobado del usuario
 * (decisión 8: ser dueño es tener un claim aprobado, no una columna `role`).
 *
 * Server component con sesión verificada inline (decisión 9). Sin lugares
 * aprobados la pantalla no está vacía: manda al flujo de alta, que es la única
 * acción que tiene sentido ahí.
 *
 * **Lo aprobado no es todo lo que el dueño mandó** (PBETA-R6-01): la lista de
 * lugares sale de los claims `approved`, así que una solicitud recién enviada no
 * aparecía por ningún lado y la pantalla invitaba a mandar de nuevo la que se
 * acababa de mandar. Las pendientes se muestran arriba, y el estado vacío queda
 * solo para el que de verdad no mandó nada.
 */

export const metadata: Metadata = { title: 'Mi negocio — ¿A dónde salimos?' }
export const dynamic = 'force-dynamic'

export default async function MiNegocioPage() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session?.user) redirect('/login?callbackUrl=/mi-negocio')

  const [lugares, pendientes] = await Promise.all([
    misLugares(session.user.id),
    solicitudesPendientesDelUsuario(session.user.id),
  ])

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 px-4 py-8">
      <BrandHeader />

      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Mi negocio</h1>
        <Link
          href="/"
          className="shrink-0 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          ← Volver
        </Link>
      </header>

      {pendientes.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            En revisión
          </h2>
          <ul className="flex flex-col gap-3">
            {pendientes.map((solicitud) => {
              const donde = [solicitud.zone, solicitud.address ?? solicitud.locality]
                .filter(Boolean)
                .join(' · ')
              return (
                <li
                  key={solicitud.id}
                  className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-card p-4"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{solicitud.placeName}</p>
                    {donde && <p className="truncate text-xs text-muted-foreground">{donde}</p>}
                  </div>
                  {/* El título de la sección ya dice «En revisión»: el badge
                      usa el lugar para decir qué mandaste, que es lo que no se
                      deduce mirando la fila. */}
                  <span className="shrink-0 rounded-full border border-primary/40 px-2.5 py-0.5 text-xs text-primary">
                    {solicitud.kind === 'new' ? 'Alta' : 'Reclamo'}
                  </span>
                </li>
              )
            })}
          </ul>
          <p className="text-xs text-muted-foreground">
            Las miramos a mano, una por una. Te avisamos por mail cuando estén resueltas — no hace
            falta que las mandes de nuevo.
          </p>
        </section>
      )}

      {lugares.length === 0 && pendientes.length === 0 && (
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
          <h2 className="text-base font-semibold text-foreground">Todavía no tenés lugares</h2>
          <p className="text-sm text-muted-foreground">
            Cuando aprobemos tu solicitud, el lugar aparece acá y vas a poder editar sus datos,
            tags y fotos. Si todavía no la mandaste, empezá por acá.
          </p>
          <Link
            href="/registrar-negocio"
            className="rounded-xl bg-primary py-3 text-center font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Registrá tu negocio
          </Link>
        </div>
      )}

      {lugares.length > 0 && (
        <ul className="flex flex-col gap-3">
          {lugares.map((lugar) => {
            const ubicacion = [lugar.zone, lugar.address ?? lugar.locality]
              .filter(Boolean)
              .join(' · ')
            return (
              <li key={lugar.id}>
                <Link
                  href={`/mi-negocio/${lugar.id}`}
                  className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{lugar.name}</p>
                      {ubicacion && (
                        <p className="truncate text-xs text-muted-foreground">{ubicacion}</p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs ${
                        lugar.publicado
                          ? 'bg-secondary text-secondary-foreground'
                          : 'border border-border text-muted-foreground'
                      }`}
                    >
                      {lugar.publicado ? 'Publicado' : 'Sin publicar'}
                    </span>
                  </div>

                  {/* Teaser (decisión 24): solo el número. El desglose es del spec 7. */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Eye className="size-3.5" />
                      {lugar.visitasDelMes} {lugar.visitasDelMes === 1 ? 'visita' : 'visitas'} este
                      mes
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <ImageIcon className="size-3.5" />
                      {lugar.fotos}/{lugar.capFotos} fotos
                    </span>
                    {lugar.plan === 'paid' && (
                      <span className="inline-flex items-center gap-1 text-primary">
                        <Store className="size-3.5" />
                        Plan pago
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
