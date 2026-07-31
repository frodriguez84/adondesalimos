import { cookies } from 'next/headers'

import { checkSugerenciaRateLimit } from '@/lib/middleware/rate-limit'
import { sugerirOpcion } from '@/lib/votaciones/acciones'
import { VOTER_COOKIE, VOTER_COOKIE_MAX_AGE } from '@/lib/votaciones/constantes'
import { getResultados } from '@/lib/votaciones/query'
import { sugerirOpcionSchema } from '@/lib/votaciones/validacion'

/**
 * `POST /api/votaciones/[token]/opciones` — sumar un lugar a la cancha
 * (SUGERIR_EN_VOTACION, decisión 14). **Sin cuenta**, mismo patrón que el voto: la
 * identidad es la cookie `voter_id` por dispositivo, que se crea acá si falta (un
 * Server Component no puede escribir cookies y el proyecto no tiene `middleware.ts`).
 *
 * Adaptador fino: rate limit → cookie → zod → acción de dominio → `{data, error}`.
 * El único input aceptado es un `placeId`; que sea un lugar publicado lo decide
 * `sugerirOpcion` contra `lib/db/visibility.ts` (decisión 4), nunca el cliente.
 */

export const dynamic = 'force-dynamic'

const STATUS_POR_CODIGO: Record<string, number> = {
  VOTACION_NO_ENCONTRADA: 404,
  VOTACION_CERRADA: 409,
  SUGERENCIAS_CERRADAS: 403,
  VOTACION_LLENA: 409,
  LIMITE_SUGERENCIAS: 409,
  LUGAR_REPETIDO: 409,
  LUGAR_NO_PUBLICADO: 422,
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  // Decisión 13: 20/min por IP, bucket propio. Antes que nada.
  const bloqueado = checkSugerenciaRateLimit(request)
  if (bloqueado) return bloqueado

  const { token } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json(
      { data: null, error: { message: 'Datos inválidos.', code: 'BAD_JSON' } },
      { status: 400 },
    )
  }

  const parsed = sugerirOpcionSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { data: null, error: { message: 'Elegí un lugar del catálogo.', code: 'INVALID' } },
      { status: 400 },
    )
  }

  const store = await cookies()
  let voterToken = store.get(VOTER_COOKIE)?.value
  if (!voterToken) {
    voterToken = crypto.randomUUID()
    store.set(VOTER_COOKIE, voterToken, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: VOTER_COOKIE_MAX_AGE,
      secure: process.env.NODE_ENV === 'production',
    })
  }

  try {
    const resultado = await sugerirOpcion(token, parsed.data.placeId, voterToken)
    if (!resultado.ok) {
      return Response.json(
        { data: null, error: { message: resultado.message, code: resultado.code } },
        { status: STATUS_POR_CODIGO[resultado.code] ?? 400 },
      )
    }

    // La cancha nueva en la misma respuesta: la UI la muestra sin esperar al
    // próximo tick del polling (y sin la carrera de "lo sumé pero no aparece").
    const resultados = await getResultados(token)
    return Response.json(
      { data: { optionId: resultado.data.optionId, resultados }, error: null },
      { status: 201 },
    )
  } catch (error) {
    console.error('[api/votaciones/opciones POST]', error)
    return Response.json(
      { data: null, error: { message: 'No pudimos sumar el lugar.', code: 'SUGGEST_FAILED' } },
      { status: 500 },
    )
  }
}
