import { after } from 'next/server'

import { auth } from '@/lib/auth'
import { guardadosDeLaPagina } from '@/lib/favoritos/query'
import { checkSearchRateLimit } from '@/lib/middleware/rate-limit'
import {
  registrarDestacados,
  registrarImpresiones,
  registrarTagsDeBusqueda,
} from '@/lib/search/impressions'
import { parseSearchParams, tieneBusqueda } from '@/lib/search/params'
import { buscarDestacados, searchPlaces, type SearchedPlace } from '@/lib/search/query'

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
    return Response.json({
      data: { places: [], nextCursor: null, featured: [], guardados: [] },
      error: null,
    })
  }

  try {
    // El destaque va solo en la primera página (decisión 21): con `cursor` es una
    // página interior. En este endpoint la primera página se pide para el modo GPS
    // (el server no tiene las coordenadas) y para el scroll interior.
    const [resultado, destacados] = await Promise.all([
      searchPlaces(params),
      params.cursor ? Promise.resolve<SearchedPlace[]>([]) : buscarDestacados(params),
    ])

    // Decisión 22 + 20: cada página que se sirve cuenta, no solo la primera. El
    // scroll infinito muestra lugares nuevos y esos también fueron vistos. Las
    // impresiones cuentan orgánico ∪ destacados (un destacado fuera del orgánico
    // igual apareció). El mapa (`/api/search/pins`) NO cuenta.
    const idsVistos = [
      ...new Set([...resultado.places.map((p) => p.id), ...destacados.map((d) => d.id)]),
    ]
    if (idsVistos.length > 0) {
      after(() => registrarImpresiones(idsVistos))
      // Decisión 22b: "qué filtros te encontraron". +1 por tag activo (incluidos
      // los expandidos por chips) para cada lugar servido, en el mismo after().
      after(() => registrarTagsDeBusqueda(idsVistos, params.tags))
    }
    // Decisión 20: cada destacado servido suma +1 a `featured_impressions`.
    if (destacados.length > 0) {
      after(() => registrarDestacados(destacados.map((d) => d.id)))
    }

    // FAVORITOS, decisión 9: las páginas del scroll también nacen con su estado
    // "guardado" resuelto, o las cards paginadas mostrarían todas sin guardar. La
    // sesión se lee acá y no en el motor (pre-vuelo P1): `lib/search/query.ts` no
    // sabe quién mira. Sin sesión no se consulta nada.
    const session = await auth.api.getSession({ headers: request.headers }).catch(() => null)
    const guardados =
      session?.user && idsVistos.length > 0
        ? await guardadosDeLaPagina(session.user.id, idsVistos)
        : []

    return Response.json({
      data: { ...resultado, featured: destacados, guardados },
      error: null,
    })
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
