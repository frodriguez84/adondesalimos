import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { auth } from '@/lib/auth'
import { puedeCrearLista } from '@/lib/favoritos/planes'
import { listasDelUsuario } from '@/lib/favoritos/query'
import { esPremium } from '@/lib/votaciones/planes'
import { MisLugares } from './mis-lugares-client'

/**
 * `/mis-lugares` — lo guardado (FAVORITOS F2, decisión 10). Página propia y no
 * una tab de `/cuenta`: `/cuenta` es configuración, esto es contenido — el mismo
 * tipo de objeto que `/mis-votaciones`, y con el mismo patrón (server + client).
 *
 * Sesión requerida: sin lo guardado no hay nada que mostrar.
 *
 * **Las listas visibles y el cupo salen del dueño único** (`lib/favoritos/planes.ts`):
 * acá no se decide cuántas listas puede tener nadie. El botón de "nueva lista" que
 * esta pantalla esconde es cosmética; el candado está en `POST /api/listas`.
 */

export const metadata: Metadata = { title: 'Mis lugares — ¿A dónde salimos?' }
export const dynamic = 'force-dynamic'

export default async function MisLugaresPage() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session?.user) redirect('/login?callbackUrl=/mis-lugares')

  const [listas, cupo, premium] = await Promise.all([
    listasDelUsuario(session.user.id),
    puedeCrearLista(session.user.id),
    esPremium(session.user.id),
  ])

  return <MisLugares listas={listas} puedeCrear={cupo.puede} esPremium={premium} />
}
