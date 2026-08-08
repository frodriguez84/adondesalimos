import { sesionAdmin } from '@/lib/auth/sesion'
import { contarUsuarios, getBitacoraCortesia, getUsuariosAdmin } from '@/lib/billing/admin'

/**
 * `GET /api/admin/usuarios` — las lecturas de la tab Usuarios (ADMIN_USUARIOS,
 * `FB-01`). Dos ramas, un solo gate:
 *
 *  - `?userId=<uuid>` — la bitácora de cortesía de ese usuario, que se pide al
 *    desplegarlo (es la acción más rara de `/admin`: no se carga de entrada).
 *  - `?q=<texto>` o sin nada — el listado (topeado) más el conteo real.
 *
 * Sin rate limit a propósito, mismo criterio que `/api/admin/curaduria`: es admin
 * gateado, no superficie pública. Gate inline, mismo shape de error que el resto
 * de `/api/admin/*`.
 *
 * **Nada de lo que se loguea acá lleva un mail** (decisión 8): la respuesta los
 * devuelve porque son el dato de la pantalla, pero no van a stdout.
 */

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const admin = await sesionAdmin(request.headers)
  if (!admin) {
    return Response.json(
      { data: null, error: { message: 'No autorizado.', code: 'FORBIDDEN' } },
      { status: 403 },
    )
  }

  const params = new URL(request.url).searchParams
  const userId = params.get('userId')

  if (userId) {
    const bitacora = await getBitacoraCortesia(userId)
    return Response.json({ data: { bitacora }, error: null })
  }

  const q = params.get('q') ?? ''
  const [usuarios, total] = await Promise.all([getUsuariosAdmin(q), contarUsuarios()])
  return Response.json({ data: { usuarios, total }, error: null })
}
