import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getPrecioB2cArs } from '@/lib/billing/settings'
import { getChatQuotaPremium } from '@/lib/ai/settings'
import { getMaxListasPremium } from '@/lib/favoritos/planes'
import { estadoSuscripcionB2C } from '@/lib/billing/estado'
import { cobroApagado } from '@/lib/billing/apagado'
import { tieneInteres } from '@/lib/billing/interes'
import { CuentaClient } from './cuenta-client'
import { ROBOTS_PRIVADO } from '@/lib/seo/robots'

/**
 * `/cuenta` (spec AUTH F1 + tab de Suscripción del spec 7): nombre, email, cambio
 * de contraseña, suscripción premium (B2C) y eliminar cuenta.
 *
 * Sesión verificada inline con `getSession` (decisión 9 — sin `middleware.ts`
 * global). Sin sesión, redirige a login. El estado de la suscripción se resuelve
 * server-side con lazy check (MONETIZACION, decisión 18).
 */
export const dynamic = 'force-dynamic'

/**
 * Pantalla privada: `noindex, nofollow` (SEO, decisión 11). No hay nada acá que un
 * crawler deba indexar ni recorrer. `/api/` y `/admin` ya están en `robots.txt`;
 * esto es la segunda barrera, mismo criterio que FICHA decisión 16.
 */
export const metadata: Metadata = { robots: ROBOTS_PRIVADO }

export default async function CuentaPage() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session?.user) redirect('/login?callbackUrl=/cuenta')

  // Los cupos van al copy de beneficios (`lib/billing/beneficios.ts`): el panel es
  // cliente, así que los números de `app_settings` bajan como props. Se leen de sus
  // dueños —nadie reimplementa la clave—, y esta ruta ya es `force-dynamic`.
  const [suscripcion, precioB2c, interesRegistrado, chatMensual, listas] = await Promise.all([
    estadoSuscripcionB2C(session.user.id),
    getPrecioB2cArs(),
    // Solo hace falta con el cobro apagado (DEPLOY, decisión 6); con el cobro
    // prendido el panel ni lo mira, así que no se paga la query.
    cobroApagado() ? tieneInteres(session.user.id) : Promise.resolve(false),
    getChatQuotaPremium(),
    getMaxListasPremium(),
  ])

  return (
    <CuentaClient
      user={{ name: session.user.name ?? '', email: session.user.email }}
      suscripcion={suscripcion}
      precioB2cArs={precioB2c}
      interesRegistrado={interesRegistrado}
      cupos={{ chatMensual, listas }}
    />
  )
}
