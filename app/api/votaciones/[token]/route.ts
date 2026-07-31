import { auth } from '@/lib/auth'
import { cambiarSugerencias, cancelarVotacion, cerrarVotacion } from '@/lib/votaciones/acciones'
import { getResultados } from '@/lib/votaciones/query'
import { gestionVotacionSchema } from '@/lib/votaciones/validacion'

/**
 * `GET /api/votaciones/[token]` — resultados en vivo (F2, decisión 13). Público y
 * sin sesión: la página lo poletea mientras la votación está abierta para que el
 * conteo suba solo. Conteo **agregado por opción** — nunca quién votó qué
 * (decisión 21). Cuando el estado deja de ser `open`, el cliente corta el polling.
 *
 * `PATCH /api/votaciones/[token]` — cerrar (con ganador), cancelar (F3, decisión
 * 14/24) o abrir/cerrar las sugerencias del grupo (SUGERIR_EN_VOTACION, decisión
 * 10). **Solo el creador** (sesión inline que verifica `creator_id` en el
 * dominio); un no-creador recibe 403.
 */

export const dynamic = 'force-dynamic'

const STATUS_POR_CODIGO: Record<string, number> = {
  NO_AUTORIZADO: 403,
  GANADOR_INVALIDO: 400,
  YA_CANCELADA: 409,
  YA_CERRADA: 409,
}

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  try {
    const resultados = await getResultados(token)
    if (!resultados) {
      return Response.json(
        { data: null, error: { message: 'Esa votación no existe.', code: 'NOT_FOUND' } },
        { status: 404 },
      )
    }
    return Response.json({ data: resultados, error: null })
  } catch (error) {
    console.error('[api/votaciones GET]', error)
    return Response.json(
      { data: null, error: { message: 'No pudimos leer la votación.', code: 'READ_FAILED' } },
      { status: 500 },
    )
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  // Sesión inline (AUTH decisión 9): gestionar es acción del creador (decisión 14).
  const session = await auth.api.getSession({ headers: request.headers }).catch(() => null)
  if (!session?.user) {
    return Response.json(
      { data: null, error: { message: 'Iniciá sesión para continuar.', code: 'NO_SESSION' } },
      { status: 401 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json(
      { data: null, error: { message: 'Datos inválidos.', code: 'BAD_JSON' } },
      { status: 400 },
    )
  }

  const parsed = gestionVotacionSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { data: null, error: { message: 'Elegí una acción válida.', code: 'INVALID' } },
      { status: 400 },
    )
  }

  try {
    const resultado =
      parsed.data.accion === 'close'
        ? await cerrarVotacion(session.user.id, token, parsed.data.winnerPlaceId)
        : parsed.data.accion === 'suggestions'
          ? await cambiarSugerencias(session.user.id, token, parsed.data.allowSuggestions)
          : await cancelarVotacion(session.user.id, token)

    if (!resultado.ok) {
      return Response.json(
        { data: null, error: { message: resultado.message, code: resultado.code } },
        { status: STATUS_POR_CODIGO[resultado.code] ?? 400 },
      )
    }
    return Response.json({ data: resultado.data, error: null })
  } catch (error) {
    console.error('[api/votaciones PATCH]', error)
    return Response.json(
      { data: null, error: { message: 'No pudimos actualizar la votación.', code: 'PATCH_FAILED' } },
      { status: 500 },
    )
  }
}
