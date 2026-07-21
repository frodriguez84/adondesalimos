import { auth } from '@/lib/auth'
import { crearAlta, crearReclamo } from '@/lib/claims/acciones'
import { claimPayloadSchema } from '@/lib/claims/validacion'
import { checkClaimsRateLimit } from '@/lib/middleware/rate-limit'

/**
 * `POST /api/claims` — las dos entradas del flujo dueño (decisión 11): reclamar
 * un lugar existente (`kind: 'claim'`) o dar de alta uno nuevo (`kind: 'new'`).
 *
 * Adaptador fino: rate limit → sesión inline → validación → acción de dominio.
 * Nada de lógica de negocio acá.
 */

export const dynamic = 'force-dynamic'

/** Códigos de dominio → status HTTP. Lo que no está mapeado es un 400. */
const STATUS_POR_CODIGO: Record<string, number> = {
  PLACE_NOT_FOUND: 404,
  YA_RECLAMADO: 409,
  YA_PENDIENTE: 409,
}

export async function POST(request: Request) {
  // Decisión 23: 3 por día por IP. Antes que nada, para que el abuso ni llegue
  // a tocar la sesión ni la base.
  const bloqueado = checkClaimsRateLimit(request)
  if (bloqueado) return bloqueado

  // Sesión verificada inline (decisión 9). Sin `middleware.ts` global: cada
  // handler protegido lo hace por su cuenta. La sesión implica email verificado
  // — `requireEmailVerification: true` no deja loguear sin verificar.
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

  const parsed = claimPayloadSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { data: null, error: { message: 'Revisá los datos del formulario.', code: 'INVALID' } },
      { status: 400 },
    )
  }

  try {
    const resultado =
      parsed.data.kind === 'claim'
        ? await crearReclamo(session.user.id, parsed.data)
        : await crearAlta(session.user.id, parsed.data)

    if (!resultado.ok) {
      return Response.json(
        { data: null, error: { message: resultado.message, code: resultado.code } },
        { status: STATUS_POR_CODIGO[resultado.code] ?? 400 },
      )
    }

    return Response.json({ data: resultado.data, error: null }, { status: 201 })
  } catch (error) {
    // No se filtra el detalle al cliente (regla global de seguridad).
    console.error('[api/claims]', error)
    return Response.json(
      { data: null, error: { message: 'No pudimos guardar tu solicitud.', code: 'CLAIM_FAILED' } },
      { status: 500 },
    )
  }
}
