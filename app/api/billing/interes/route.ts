import { auth } from '@/lib/auth'
import { registrarInteres, registrarInteresSchema } from '@/lib/billing/interes'
import { checkInteresRateLimit } from '@/lib/middleware/rate-limit'

/**
 * `POST /api/billing/interes` — "Avisame cuando abra" (DEPLOY, decisión 6).
 *
 * Adaptador fino, mismo orden que el resto: rate limit → **sesión inline antes de
 * mirar el payload** (decisión 7 de PULIDO) → zod → acción de dominio →
 * `{data, error:{message, code}}`. El dedupe y el gate de dueño viven en
 * `lib/billing/interes.ts`, no acá.
 *
 * No se gatea por `cobroApagado()`: si el cobro se prende, el panel deja de
 * ofrecer el botón y una fila extra acá no rompe nada. Un gate más sería una
 * segunda lectura del interruptor sin nada que proteger.
 */

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const bloqueado = checkInteresRateLimit(request)
  if (bloqueado) return bloqueado

  const session = await auth.api.getSession({ headers: request.headers }).catch(() => null)
  if (!session?.user) {
    return Response.json(
      { data: null, error: { message: 'Iniciá sesión para que te avisemos.', code: 'NO_SESSION' } },
      { status: 401 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const parsed = registrarInteresSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { data: null, error: { message: 'Datos inválidos.', code: 'INVALID' } },
      { status: 400 },
    )
  }

  try {
    const resultado = await registrarInteres(session.user.id, parsed.data)
    if (!resultado.ok) {
      // Un lugar ajeno no es un 403 con explicación: no existe para quien no es
      // el dueño (mismo criterio que `/mi-negocio`).
      return Response.json(
        { data: null, error: { message: resultado.message, code: resultado.code } },
        { status: 404 },
      )
    }
    return Response.json({ data: resultado.data, error: null }, { status: 201 })
  } catch (error) {
    console.error('[api/billing/interes POST]', error)
    return Response.json(
      { data: null, error: { message: 'No pudimos anotarte. Probá de nuevo.', code: 'FAILED' } },
      { status: 500 },
    )
  }
}
