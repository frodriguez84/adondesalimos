import { after } from 'next/server'

import { checkSearchRateLimit } from '@/lib/middleware/rate-limit'
import { registrarImpresiones } from '@/lib/search/impressions'
import { parseSearchParams, tieneBusqueda } from '@/lib/search/params'
import { searchPlaces } from '@/lib/search/query'

/**
 * `GET /api/search` — misma función de query que el server component de `/`.
 *
 * La consumen el infinite scroll (F2) y la vista mapa (F3). Acepta exactamente
 * los mismos params que la URL de la home, más `lat`/`lng`, que solo viajan acá:
 * las coordenadas del usuario no van en un link compartible (ver `params.ts`).
 */

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const bloqueado = checkSearchRateLimit(request)
  if (bloqueado) return bloqueado

  const url = new URL(request.url)
  const params = parseSearchParams(Object.fromEntries(url.searchParams))

  // Sin criterios no se devuelve el catálogo entero (decisión 2): la primera
  // visita muestra cero resultados hasta que se elige zona.
  if (!tieneBusqueda(params)) {
    return Response.json({ data: { places: [], nextCursor: null }, error: null })
  }

  try {
    const resultado = await searchPlaces(params)

    // Decisión 22: cada página que se sirve cuenta, no solo la primera. El
    // scroll infinito muestra lugares nuevos y esos también fueron vistos. El
    // mapa (`/api/search/pins`) NO cuenta: un pin no es una impresión de ficha.
    if (resultado.places.length > 0) {
      after(() => registrarImpresiones(resultado.places.map((p) => p.id)))
    }

    return Response.json({ data: resultado, error: null })
  } catch (error) {
    // No se filtra el detalle al cliente: puede traer nombres de tablas o del
    // driver (regla global de seguridad).
    console.error('[api/search]', error)
    return Response.json(
      { data: null, error: { message: 'No pudimos buscar ahora.', code: 'SEARCH_FAILED' } },
      { status: 500 },
    )
  }
}
