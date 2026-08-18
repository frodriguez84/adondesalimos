import { checkGoogleRateLimit } from '@/lib/middleware/rate-limit'
import { getDetailsMonthlyCap, getMatchRetryDays, getPhotosMonthlyCap } from '@/lib/google/settings'
import { reservarUsoMensual } from '@/lib/google/usage'
import { fetchFotoUri, fetchPlaceDetails, resolvePlaceId } from '@/lib/google/places'
import {
  getPlaceForEnrichment,
  persistirMatchEncontrado,
  persistirNoEncontrado,
} from '@/lib/lugar/matching'
import { resolverEnriquecimiento } from '@/lib/lugar/enrichment'

/**
 * `GET /api/lugar/[id]/google` — enriquecimiento en vivo de la ficha (FICHA, F2).
 *
 * El bloque de Google se pide **desde el cliente** y no en el render del server
 * (decisión 16): así los crawlers —Googlebot, el preview de WhatsApp al compartir—
 * no disparan llamadas Enterprise sobre fichas que ningún humano abrió. `robots.txt`
 * bloquea `/api/` como segunda barrera.
 *
 * Ruta dinámica y sin caché (decisión 17): cada apertura consulta Google en vivo y
 * nada se persiste salvo el `place_id` del resolver. Este handler es un adaptador
 * fino: arma las dependencias reales y delega la lógica del gasto a
 * `resolverEnriquecimiento` (puro y testeado). `204` en todo camino sin datos.
 */

export const dynamic = 'force-dynamic'
/** `SEC-17`: una lectura no puede retener su slot 300 s, que es el default sin esto. */
export const maxDuration = 15

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // Paso 1: rate limit por IP.
  const bloqueado = checkGoogleRateLimit(request)
  if (bloqueado) return bloqueado

  const { id } = await params

  try {
    // Paso 2: visibilidad otra vez (nunca gastar en un lugar oculto o inexistente).
    const place = await getPlaceForEnrichment(id)
    if (!place) return new Response(null, { status: 404 })

    // Pasos 3-6: estados de match, resolver, topes de cuota, Place Details y foto.
    const [retryDays, detailsCap, photosCap] = await Promise.all([
      getMatchRetryDays(),
      getDetailsMonthlyCap(),
      getPhotosMonthlyCap(),
    ])

    const resultado = await resolverEnriquecimiento({
      place,
      retryDays,
      detailsCap,
      photosCap,
      ahora: new Date(),
      resolvePlaceId,
      fetchDetails: fetchPlaceDetails,
      fetchFoto: fetchFotoUri,
      reservarUso: reservarUsoMensual,
      persistMatch: persistirMatchEncontrado,
      persistNotFound: persistirNoEncontrado,
    })

    if (resultado.status === 200) return Response.json(resultado.data)
    return new Response(null, { status: 204 })
  } catch (error) {
    // Degradación honesta (decisión 20): ante cualquier falla inesperada la ficha
    // igual se ve entera y el bloque cae al mensaje vacío. No se filtra el detalle.
    console.error('[api/lugar/google]', error)
    return new Response(null, { status: 204 })
  }
}
