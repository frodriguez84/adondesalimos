import { cookies } from 'next/headers'

import { auth } from '@/lib/auth'
import { checkSugerenciaRateLimit } from '@/lib/middleware/rate-limit'
import { quitarOpcion, type QuienQuita } from '@/lib/votaciones/acciones'
import { VOTER_COOKIE } from '@/lib/votaciones/constantes'
import { getResultados } from '@/lib/votaciones/query'

/**
 * `DELETE /api/votaciones/[token]/opciones/[optionId]` — quitar una opción
 * **sugerida** (SUGERIR_EN_VOTACION, decisión 8 y 14).
 *
 * Tiene **dos autorizados distintos** y por eso resuelve quién pide antes de
 * llamar al dominio: el **creador** (sesión, se verifica `creator_id`) o **el que
 * la sugirió** (cookie `voter_id`, y solo mientras nadie la haya votado). Si hay
 * sesión se prueba como creador; si esa sesión no es del dueño de la votación, se
 * cae al camino del votante —el creador de OTRA votación es un votante más acá—.
 *
 * Acá la cookie **no se crea**: quien no tiene ninguna no sugirió nada.
 */

export const dynamic = 'force-dynamic'

const STATUS_POR_CODIGO: Record<string, number> = {
  VOTACION_NO_ENCONTRADA: 404,
  VOTACION_CERRADA: 409,
  OPCION_INVALIDA: 400,
  OPCION_ORIGINAL: 403,
  OPCION_CON_VOTOS: 409,
  NO_AUTORIZADO: 403,
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ token: string; optionId: string }> },
) {
  const bloqueado = checkSugerenciaRateLimit(request)
  if (bloqueado) return bloqueado

  const { token, optionId } = await params

  const session = await auth.api.getSession({ headers: request.headers }).catch(() => null)
  const voterToken = (await cookies()).get(VOTER_COOKIE)?.value

  const candidatos: QuienQuita[] = []
  if (session?.user) candidatos.push({ tipo: 'creador', userId: session.user.id })
  if (voterToken) candidatos.push({ tipo: 'votante', voterToken })

  if (candidatos.length === 0) {
    return Response.json(
      { data: null, error: { message: 'No podés sacar este lugar.', code: 'NO_AUTORIZADO' } },
      { status: 403 },
    )
  }

  try {
    let ultimo = await quitarOpcion(token, optionId, candidatos[0])
    // Con sesión ajena a esta votación, el segundo intento es el que corresponde:
    // el mismo dispositivo puede haber sugerido el lugar sin ser el creador.
    if (!ultimo.ok && ultimo.code === 'NO_AUTORIZADO' && candidatos[1]) {
      ultimo = await quitarOpcion(token, optionId, candidatos[1])
    }

    if (!ultimo.ok) {
      return Response.json(
        { data: null, error: { message: ultimo.message, code: ultimo.code } },
        { status: STATUS_POR_CODIGO[ultimo.code] ?? 400 },
      )
    }

    const resultados = await getResultados(token)
    return Response.json({
      data: { optionId: ultimo.data.optionId, votosPerdidos: ultimo.data.votosPerdidos, resultados },
      error: null,
    })
  } catch (error) {
    console.error('[api/votaciones/opciones DELETE]', error)
    return Response.json(
      { data: null, error: { message: 'No pudimos sacar el lugar.', code: 'REMOVE_FAILED' } },
      { status: 500 },
    )
  }
}
