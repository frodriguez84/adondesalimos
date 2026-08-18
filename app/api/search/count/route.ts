import { checkSearchRateLimit } from '@/lib/middleware/rate-limit'
import { parseSearchParams, tieneBusqueda } from '@/lib/search/params'
import { countPlaces } from '@/lib/search/query'

/**
 * `GET /api/search/count` — el número de "Ver N lugares" (decisión 20).
 *
 * Lo llaman los sheets de zona y de filtros en vivo, mientras el usuario toca
 * chips y ANTES de aplicar: es lo que evita el "0 resultados" sorpresa. Usa el
 * mismo constructor de `where` que la lista, así el N del botón y lo que
 * después se ve no pueden divergir.
 *
 * Mismo rate limit que `/api/search`: se llama en cada toque de chip.
 */

export const dynamic = 'force-dynamic'
/** `SEC-17`: una lectura no puede retener su slot 300 s, que es el default sin esto. */
export const maxDuration = 15

export async function GET(request: Request) {
  const bloqueado = checkSearchRateLimit(request)
  if (bloqueado) return bloqueado

  const url = new URL(request.url)
  const params = parseSearchParams(Object.fromEntries(url.searchParams))

  // Sin criterios el botón no anuncia "18.993 lugares": la primera visita no
  // lista el catálogo entero (decisión 2), así que el número sería mentira.
  if (!tieneBusqueda(params)) {
    return Response.json({ data: { count: 0 }, error: null })
  }

  try {
    const count = await countPlaces(params)
    return Response.json({ data: { count }, error: null })
  } catch (error) {
    console.error('[api/search/count]', error)
    return Response.json(
      { data: null, error: { message: 'No pudimos contar ahora.', code: 'COUNT_FAILED' } },
      { status: 500 },
    )
  }
}
