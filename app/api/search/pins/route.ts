import { checkSearchRateLimit } from '@/lib/middleware/rate-limit'
import { parseSearchParams, tieneBusqueda } from '@/lib/search/params'
import { searchPins } from '@/lib/search/query'

/**
 * `GET /api/search/pins` — los pins de la vista mapa (decisión 21).
 *
 * Endpoint propio y no `/api/search` porque el mapa necesita **otra cantidad**:
 * la lista pagina de a 20 y el mapa muestra hasta 200 de una (ver `searchPins`
 * para por qué no trae el resultado entero). Mismos params y mismo `where` que
 * la lista, así el mapa y los resultados nunca muestran cosas distintas.
 *
 * Mismo rate limit que `/api/search`: es un endpoint público de lectura.
 */

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const bloqueado = checkSearchRateLimit(request)
  if (bloqueado) return bloqueado

  const url = new URL(request.url)
  const params = parseSearchParams(Object.fromEntries(url.searchParams))

  // Sin criterios no se mapea el catálogo entero, igual que la lista no lo
  // lista (decisión 2).
  if (!tieneBusqueda(params)) {
    return Response.json({ data: { places: [], truncated: false }, error: null })
  }

  try {
    const resultado = await searchPins(params)
    return Response.json({ data: resultado, error: null })
  } catch (error) {
    // No se filtra el detalle al cliente (regla global de seguridad).
    console.error('[api/search/pins]', error)
    return Response.json(
      { data: null, error: { message: 'No pudimos cargar el mapa.', code: 'PINS_FAILED' } },
      { status: 500 },
    )
  }
}
