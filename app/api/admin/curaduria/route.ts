import { sesionAdmin } from '@/lib/auth/sesion'
import {
  buscarLugaresPorNombre,
  lugarParaCurar,
  proximoLugarDeZona,
  zonasConCola,
} from '@/lib/curation/query'

/**
 * `GET /api/admin/curaduria` — las lecturas de la tab Curaduría. Cuatro ramas,
 * un solo gate:
 *
 *  - `?zona=<slug>` — el próximo lugar a revisar de esa zona (CURADURIA, F2),
 *    para que la cola avance sin recargar toda la página.
 *  - `?q=<texto>` — buscar un lugar por nombre para curarlo sin pasar por la cola
 *    (CURADURIA_POR_NOMBRE, decisión 5: rama del endpoint que ya existe, no una
 *    ruta nueva). Con menos de 2 caracteres devuelve lista vacía, no error.
 *  - `?placeId=<uuid>` — abrir ese lugar en el mismo editor.
 *  - sin nada — las zonas con cola (para refrescar los conteos).
 *
 * Sin rate limit a propósito (decisión 5): es admin gateado, no superficie
 * pública. Gate de admin inline, mismo patrón que el resto de `/api/admin/*`.
 */

export const dynamic = 'force-dynamic'
/** `SEC-17`: una lectura no puede retener su slot 300 s, que es el default sin esto. */
export const maxDuration = 15

export async function GET(request: Request) {
  const admin = await sesionAdmin(request.headers)
  if (!admin) {
    return Response.json(
      { data: null, error: { message: 'No autorizado.', code: 'FORBIDDEN' } },
      { status: 403 },
    )
  }

  const params = new URL(request.url).searchParams
  const q = params.get('q')
  const placeId = params.get('placeId')
  const zona = params.get('zona')

  if (q !== null) {
    const lugares = await buscarLugaresPorNombre(q)
    return Response.json({ data: { lugares }, error: null })
  }

  if (placeId) {
    const lugar = await lugarParaCurar(placeId)
    return Response.json({ data: { lugar }, error: null })
  }

  if (!zona) {
    const zonas = await zonasConCola()
    return Response.json({ data: { zonas }, error: null })
  }

  const lugar = await proximoLugarDeZona(zona)
  const zonas = await zonasConCola()
  return Response.json({ data: { lugar, zonas }, error: null })
}
