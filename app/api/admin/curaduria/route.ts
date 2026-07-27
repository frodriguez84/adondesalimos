import { sesionAdmin } from '@/lib/auth/sesion'
import { proximoLugarDeZona, zonasConCola } from '@/lib/curation/query'

/**
 * `GET /api/admin/curaduria?zona=<slug>` — el próximo lugar a revisar de una zona
 * (CURADURIA, F2), para que la cola avance sin recargar toda la página. Sin `zona`,
 * devuelve las zonas con cola (para refrescar los conteos tras revisar un lugar).
 *
 * Gate de admin inline, mismo patrón que el resto de `/api/admin/*`.
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

  const zona = new URL(request.url).searchParams.get('zona')

  if (!zona) {
    const zonas = await zonasConCola()
    return Response.json({ data: { zonas }, error: null })
  }

  const lugar = await proximoLugarDeZona(zona)
  const zonas = await zonasConCola()
  return Response.json({ data: { lugar, zonas }, error: null })
}
