import { sesionAdmin } from '@/lib/auth/sesion'
import { guardarCuraduria, rechazarLugar } from '@/lib/curation/acciones'
import { accionSchema } from '@/lib/curation/validacion'

/**
 * `POST /api/admin/curaduria/[placeId]` — resolver un lugar de la cola de curaduría
 * (CURADURIA, F2). `guardar` acepta/corrige (escribe `place_tags` con
 * `source='admin'`); `rechazar` descarta sin tocar `place_tags`.
 *
 * Gate de admin inline, mismo patrón que `/api/admin/claims/[id]`: sin
 * `ADMIN_EMAIL` seteado, `sesionAdmin` devuelve null y esto responde 403 — nunca
 * un admin abierto por default.
 */

export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: { params: Promise<{ placeId: string }> }) {
  const admin = await sesionAdmin(request.headers)
  if (!admin) {
    return Response.json(
      { data: null, error: { message: 'No autorizado.', code: 'FORBIDDEN' } },
      { status: 403 },
    )
  }

  const { placeId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json(
      { data: null, error: { message: 'Datos inválidos.', code: 'BAD_JSON' } },
      { status: 400 },
    )
  }

  const parsed = accionSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { data: null, error: { message: 'Datos inválidos.', code: 'INVALID' } },
      { status: 400 },
    )
  }

  try {
    const resultado =
      parsed.data.accion === 'guardar'
        ? await guardarCuraduria(placeId, parsed.data.tags, parsed.data.precio)
        : await rechazarLugar(placeId)

    return Response.json({ data: resultado.data, error: null })
  } catch (error) {
    console.error('[api/admin/curaduria]', error)
    return Response.json(
      { data: null, error: { message: 'No pudimos guardar la revisión.', code: 'FAILED' } },
      { status: 500 },
    )
  }
}
