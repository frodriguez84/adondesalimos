import { sesionAdmin } from '@/lib/auth/sesion'
import { decidirClaim } from '@/lib/claims/acciones'
import { decisionSchema } from '@/lib/claims/validacion'
import { sendClaimApprovedEmail, sendClaimRejectedEmail } from '@/lib/email'

/**
 * `PATCH /api/admin/claims/[id]` — aprobar o rechazar una solicitud
 * (decisión 22). Rechazar un aprobado es la revocación (decisión 10).
 *
 * Gate de admin inline: sin `ADMIN_EMAIL` seteado, `sesionAdmin` devuelve null
 * para todos y esto responde 403 — nunca un admin abierto por default.
 *
 * Idempotente ante doble click: si el claim ya estaba en ese estado, la acción
 * no repite la escritura ni **re-manda el mail**.
 */

export const dynamic = 'force-dynamic'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await sesionAdmin(request.headers)
  if (!admin) {
    return Response.json(
      { data: null, error: { message: 'No autorizado.', code: 'FORBIDDEN' } },
      { status: 403 },
    )
  }

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json(
      { data: null, error: { message: 'Datos inválidos.', code: 'BAD_JSON' } },
      { status: 400 },
    )
  }

  const parsed = decisionSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { data: null, error: { message: 'Falta el motivo del rechazo.', code: 'INVALID' } },
      { status: 400 },
    )
  }

  try {
    const resultado = await decidirClaim(id, parsed.data, admin.email)

    if (!resultado.ok) {
      return Response.json(
        { data: null, error: { message: resultado.message, code: resultado.code } },
        { status: resultado.code === 'CLAIM_NOT_FOUND' ? 404 : 409 },
      )
    }

    const decidido = resultado.data

    // El mail va DESPUÉS de que la base quedó consistente, y solo si el estado
    // cambió de verdad. Si Resend falla, la decisión ya está tomada: se loguea y
    // la respuesta sigue siendo un éxito (el admin no tiene que reintentar la
    // aprobación por un problema de mail).
    if (!decidido.yaEstaba) {
      try {
        if (parsed.data.accion === 'approve') {
          await sendClaimApprovedEmail(decidido.userEmail, decidido.placeName, decidido.placeId)
        } else {
          await sendClaimRejectedEmail(decidido.userEmail, decidido.placeName, parsed.data.motivo)
        }
      } catch (err) {
        console.error('[api/admin/claims] no se pudo enviar el mail:', err)
      }
    }

    return Response.json({ data: decidido, error: null })
  } catch (error) {
    console.error('[api/admin/claims]', error)
    return Response.json(
      { data: null, error: { message: 'No pudimos aplicar la decisión.', code: 'DECISION_FAILED' } },
      { status: 500 },
    )
  }
}
