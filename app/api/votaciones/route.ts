import { auth } from '@/lib/auth'
import { checkVotacionesRateLimit } from '@/lib/middleware/rate-limit'
import { crearVotacion } from '@/lib/votaciones/acciones'
import { crearVotacionSchema } from '@/lib/votaciones/validacion'

/**
 * `POST /api/votaciones` — crear una votación (VOTACION F1).
 *
 * Adaptador fino, mismo patrón que `POST /api/claims`: rate limit → sesión inline
 * → validación → acción de dominio. El gate "1 activa" y la validación de lugares
 * publicados viven en `crearVotacion`, no acá.
 */

export const dynamic = 'force-dynamic'

/** Códigos de dominio → status HTTP. Lo que no está mapeado es un 400. */
const STATUS_POR_CODIGO: Record<string, number> = {
  LIMITE_ACTIVA: 409,
  LUGAR_NO_PUBLICADO: 422,
  NO_SESSION: 401,
}

export async function POST(request: Request) {
  // Decisión 9: mismo cupo que claims, 3/día por IP, con prefijo propio. Antes
  // que nada, para que el spam ni toque la sesión ni la base.
  const bloqueado = checkVotacionesRateLimit(request)
  if (bloqueado) return bloqueado

  // Sesión verificada inline (AUTH decisión 9): la sesión implica email
  // verificado. El creador siempre tiene cuenta; los votantes jamás (decisión 1).
  const session = await auth.api.getSession({ headers: request.headers }).catch(() => null)
  if (!session?.user) {
    return Response.json(
      { data: null, error: { message: 'Iniciá sesión para armar una votación.', code: 'NO_SESSION' } },
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

  const parsed = crearVotacionSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      {
        data: null,
        error: { message: 'Elegí entre 2 y 5 lugares para votar.', code: 'INVALID' },
      },
      { status: 400 },
    )
  }

  try {
    const resultado = await crearVotacion(session.user.id, parsed.data)
    if (!resultado.ok) {
      return Response.json(
        { data: null, error: { message: resultado.message, code: resultado.code } },
        { status: STATUS_POR_CODIGO[resultado.code] ?? 400 },
      )
    }
    return Response.json({ data: resultado.data, error: null }, { status: 201 })
  } catch (error) {
    // No se filtra el detalle al cliente (regla global de seguridad).
    console.error('[api/votaciones]', error)
    return Response.json(
      { data: null, error: { message: 'No pudimos crear la votación.', code: 'CREATE_FAILED' } },
      { status: 500 },
    )
  }
}
