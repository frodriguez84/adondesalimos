import { auth } from './index'
import { esAdmin } from './admin'

/**
 * Sesión de admin verificada **inline** (decisión 9: sin `middleware.ts`
 * global). Devuelve el email del admin o `null` — el llamador decide si eso es
 * un 404 (la página) o un 403 (el endpoint).
 *
 * La usan `/admin` (con `await headers()`) y `PATCH /api/admin/claims/[id]`
 * (con `request.headers`): una sola implementación del gate para los dos.
 */
export async function sesionAdmin(headers: Headers): Promise<{ email: string } | null> {
  const session = await auth.api.getSession({ headers }).catch(() => null)
  const email = session?.user?.email
  if (!email || !esAdmin(email)) return null
  return { email }
}
