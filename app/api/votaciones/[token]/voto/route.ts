import { cookies } from 'next/headers'

import { checkVotoRateLimit } from '@/lib/middleware/rate-limit'
import { votar } from '@/lib/votaciones/acciones'
import { VOTER_COOKIE, VOTER_COOKIE_MAX_AGE } from '@/lib/votaciones/constantes'
import { getResultados } from '@/lib/votaciones/query'
import { votarSchema } from '@/lib/votaciones/validacion'

/**
 * `POST /api/votaciones/[token]/voto` — votar / revotar **sin cuenta** (F2, el
 * loop viral). No hay sesión: la identidad es la cookie `voter_id` por dispositivo
 * (decisión 7), no la IP —un grupo entero comparte IP y se pisaría—.
 *
 * La cookie se crea acá si falta. **Divergencia menor de la decisión 7** ("al
 * abrir el link se setea"): se setea en el primer voto y no en el render de la
 * página, porque un Server Component no puede escribir cookies y el proyecto no
 * tiene `middleware.ts`. Es funcionalmente idéntico para el dedupe —quien no votó
 * no necesita identidad— y evita sumar middleware por esto.
 */

export const dynamic = 'force-dynamic'

const STATUS_POR_CODIGO: Record<string, number> = {
  VOTACION_NO_ENCONTRADA: 404,
  VOTACION_CERRADA: 409,
  OPCION_INVALIDA: 400,
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  // Decisión 9: 20/min por IP, generoso. Antes que nada.
  const bloqueado = checkVotoRateLimit(request)
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

  const parsed = votarSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { data: null, error: { message: 'Elegí una opción válida.', code: 'INVALID' } },
      { status: 400 },
    )
  }

  // Identidad por dispositivo: cookie opaca, `httpOnly` (decisión 7). Si falta, se
  // crea un UUID nuevo y se guarda en la respuesta.
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
    const resultado = await votar(token, parsed.data.optionId, voterToken)
    if (!resultado.ok) {
      return Response.json(
        { data: null, error: { message: resultado.message, code: resultado.code } },
        { status: STATUS_POR_CODIGO[resultado.code] ?? 400 },
      )
    }

    // Conteos frescos en la misma respuesta: la UI actualiza sin un round-trip
    // extra y sin la carrera de "voté pero el conteo todavía no subió".
    const resultados = await getResultados(token)
    return Response.json({
      data: { votedOptionId: resultado.data.votedOptionId, resultados },
      error: null,
    })
  } catch (error) {
    console.error('[api/votaciones/voto]', error)
    return Response.json(
      { data: null, error: { message: 'No pudimos registrar tu voto.', code: 'VOTE_FAILED' } },
      { status: 500 },
    )
  }
}
