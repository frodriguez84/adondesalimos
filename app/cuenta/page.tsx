import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { CuentaClient } from './cuenta-client'

/**
 * `/cuenta` mínima (spec AUTH F1): nombre, email, cambio de contraseña y eliminar
 * cuenta. El tab de suscripción es del spec 7.
 *
 * Sesión verificada inline con `getSession` (decisión 9 — sin `middleware.ts`
 * global). Sin sesión, redirige a login.
 */
export default async function CuentaPage() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session?.user) redirect('/login?callbackUrl=/cuenta')

  return (
    <CuentaClient
      user={{ name: session.user.name ?? '', email: session.user.email }}
    />
  )
}
