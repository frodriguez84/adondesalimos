import { sesionAdmin } from '@/lib/auth/sesion'
import { buscarLugaresPorNombre } from '@/lib/curation/query'
import { getLugarParaCorregir } from '@/lib/negocio/query'

/**
 * `GET /api/admin/lugares` — las lecturas de la tab **Lugares**
 * (CORRECCION_DATOS, decisión 16). Dos ramas, un solo gate, mismo patrón que
 * `/api/admin/curaduria`:
 *
 *  - `?q=<texto>` — buscar el lugar por nombre. Reusa `buscarLugaresPorNombre`
 *    (decisión 15) **sin moverlo de `lib/curation/`**: ya usa el dueño único del
 *    match por nombre y —lo que lo vuelve el encaje correcto— **omite
 *    `publishedWhere` a propósito**, que es justo lo que hace falta acá: un lugar
 *    despublicado es uno de los que hay que poder corregir.
 *  - `?placeId=<uuid>` — el lugar entero para el editor, con su bitácora.
 *
 * Sin rate limit, igual que el resto de `/api/admin/*`: es admin gateado, no
 * superficie pública.
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
  const placeId = params.get('placeId')

  if (placeId) {
    const lugar = await getLugarParaCorregir(placeId)
    return Response.json({ data: { lugar }, error: null })
  }

  const lugares = await buscarLugaresPorNombre(params.get('q') ?? '')
  return Response.json({ data: { lugares }, error: null })
}
