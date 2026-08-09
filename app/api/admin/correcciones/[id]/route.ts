import { sesionAdmin } from '@/lib/auth/sesion'
import { decidirCorreccion, decisionCorreccionSchema } from '@/lib/negocio/correcciones'

/**
 * `POST /api/admin/correcciones/[id]` — aprobar o rechazar la propuesta de un
 * dueño (CORRECCION_DATOS, decisión 11). Gemelo de `PATCH /api/admin/claims/[id]`:
 * misma cola, mismo criterio, misma persona.
 *
 * Aprobar aplica la corrección por el mismo camino que la edición de admin (las
 * cinco cosas en una transacción); rechazar deja `places` intacto y guarda el
 * motivo, que es lo que el dueño ve en su panel. **Sin mail en ninguna dirección**
 * (decisión 14).
 *
 * Gate de admin inline, sin rate limit, como el resto de `/api/admin/*`.
 */

export const dynamic = 'force-dynamic'

const STATUS: Record<string, number> = {
  NO_EXISTE: 404,
  YA_DECIDIDA: 409,
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const parsed = decisionCorreccionSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { data: null, error: { message: 'Falta el motivo del rechazo.', code: 'INVALID' } },
      { status: 400 },
    )
  }

  try {
    const resultado = await decidirCorreccion(id, parsed.data, admin.email)
    if (!resultado.ok) {
      return Response.json(
        { data: null, error: { message: resultado.message, code: resultado.code } },
        { status: STATUS[resultado.code] ?? 400 },
      )
    }
    return Response.json({ data: resultado.data, error: null })
  } catch (error) {
    console.error('[api/admin/correcciones]', id, error)
    return Response.json(
      { data: null, error: { message: 'No pudimos aplicar la decisión.', code: 'FAILED' } },
      { status: 500 },
    )
  }
}
