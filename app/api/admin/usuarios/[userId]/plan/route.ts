import { z } from 'zod'

import { sesionAdmin } from '@/lib/auth/sesion'
import { otorgarCortesia, revocarCortesia } from '@/lib/billing/subscriptions'

/**
 * `POST /api/admin/usuarios/[userId]/plan` — dar o sacar el premium de cortesía
 * (ADMIN_USUARIOS, `FB-01`). Body: `{ accion, placeId?, motivo }`; sin `placeId` es
 * el eje B2C, con `placeId` el plan de ese lugar.
 *
 * Es **solo el adaptador HTTP**: la validación de negocio —motivo mínimo, eje sin
 * suscripción viva, reclamo aprobado— vive en `otorgarCortesia` / `revocarCortesia`,
 * que son las que escriben el flag por dentro de su dueño único. Mismo reparto que
 * `PATCH /api/admin/settings` ↔ `editarPrecio`: acá no se decide nada.
 *
 * Gate de admin inline y sin rate limit, como el resto de `/api/admin/*`. **Ningún
 * log de acá imprime un mail** (decisión 8): el error se loguea con el `userId`.
 */

export const dynamic = 'force-dynamic'

const cortesiaSchema = z.object({
  accion: z.enum(['otorgar', 'revocar']),
  placeId: z.uuid().optional(),
  motivo: z.string(),
})

/** El código de negocio manda el status; el mensaje ya viene en rioplatense. */
const STATUS: Record<string, number> = {
  MOTIVO_CORTO: 400,
  MOTIVO_LARGO: 400,
  NO_EXISTE: 404,
  NO_ES_DUENO: 404,
  TIENE_SUSCRIPCION: 409,
}

export async function POST(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const admin = await sesionAdmin(request.headers)
  if (!admin) {
    return Response.json(
      { data: null, error: { message: 'No autorizado.', code: 'FORBIDDEN' } },
      { status: 403 },
    )
  }

  const { userId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json(
      { data: null, error: { message: 'Datos inválidos.', code: 'BAD_JSON' } },
      { status: 400 },
    )
  }

  const parsed = cortesiaSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { data: null, error: { message: 'Datos inválidos.', code: 'INVALID' } },
      { status: 400 },
    )
  }

  const eje = { userId, placeId: parsed.data.placeId ?? null }
  const opts = { motivo: parsed.data.motivo, adminEmail: admin.email }

  try {
    const resultado =
      parsed.data.accion === 'otorgar'
        ? await otorgarCortesia(eje, opts)
        : await revocarCortesia(eje, opts)

    if (!resultado.ok) {
      return Response.json(
        { data: null, error: { message: resultado.message, code: resultado.code } },
        { status: STATUS[resultado.code] ?? 400 },
      )
    }

    return Response.json({ data: resultado.data, error: null })
  } catch (error) {
    // Con el userId alcanza para rastrearlo; el mail no va a los logs (decisión 8).
    console.error('[api/admin/usuarios/plan POST]', userId, error)
    return Response.json(
      { data: null, error: { message: 'No pudimos guardarlo. Probá de nuevo.', code: 'FAILED' } },
      { status: 500 },
    )
  }
}
