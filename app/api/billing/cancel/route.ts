import { auth } from '@/lib/auth'
import { cancelarSuscripcion } from '@/lib/billing/cancelacion'

/**
 * `POST /api/billing/cancel` — cancelación diferida (MONETIZACION, decisión 15).
 * Body `{ placeId? }`: sin `placeId` cancela la B2C del usuario; con valor, la B2B
 * de ese lugar. Cancela ya en MP y deja el acceso hasta fin de período.
 */

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
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
    body = {}
  }

  const placeId = (body as { placeId?: unknown } | null)?.placeId
  if (placeId !== undefined && placeId !== null && typeof placeId !== 'string') {
    return Response.json(
      { data: null, error: { message: 'Lugar inválido.', code: 'INVALID_PLACE' } },
      { status: 400 },
    )
  }

  const resultado = await cancelarSuscripcion({ userId: session.user.id, placeId })
  if (!resultado.ok) {
    return Response.json(
      { data: null, error: { message: resultado.message, code: resultado.code } },
      { status: resultado.httpStatus },
    )
  }

  return Response.json({ data: { ok: true }, error: null })
}
