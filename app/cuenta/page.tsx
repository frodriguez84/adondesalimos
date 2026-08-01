import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getPrecioB2cArs } from '@/lib/billing/settings'
import { estadoSuscripcionB2C } from '@/lib/billing/estado'
import { cobroApagado } from '@/lib/billing/apagado'
import { tieneInteres } from '@/lib/billing/interes'
import { CuentaClient } from './cuenta-client'

/**
 * `/cuenta` (spec AUTH F1 + tab de Suscripción del spec 7): nombre, email, cambio
 * de contraseña, suscripción premium (B2C) y eliminar cuenta.
 *
 * Sesión verificada inline con `getSession` (decisión 9 — sin `middleware.ts`
 * global). Sin sesión, redirige a login. El estado de la suscripción se resuelve
 * server-side con lazy check (MONETIZACION, decisión 18).
 */
export const dynamic = 'force-dynamic'

export default async function CuentaPage() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session?.user) redirect('/login?callbackUrl=/cuenta')

  const [suscripcion, precioB2c, interesRegistrado] = await Promise.all([
    estadoSuscripcionB2C(session.user.id),
    getPrecioB2cArs(),
    // Solo hace falta con el cobro apagado (DEPLOY, decisión 6); con el cobro
    // prendido el panel ni lo mira, así que no se paga la query.
    cobroApagado() ? tieneInteres(session.user.id) : Promise.resolve(false),
  ])

  return (
    <CuentaClient
      user={{ name: session.user.name ?? '', email: session.user.email }}
      suscripcion={suscripcion}
      precioB2cArs={precioB2c}
      interesRegistrado={interesRegistrado}
    />
  )
}
