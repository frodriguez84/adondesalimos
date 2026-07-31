import { auth } from '@/lib/auth'
import { crearLista } from '@/lib/favoritos/acciones'
import { crearListaSchema } from '@/lib/favoritos/validacion'
import { checkFavoritosRateLimit } from '@/lib/middleware/rate-limit'

/**
 * `POST /api/listas` — crear una lista con nombre (FAVORITOS F2, decisión 14).
 *
 * Adaptador fino, mismo orden que `POST /api/favoritos`: rate limit → **sesión
 * inline antes de mirar el payload** → zod → acción de dominio →
 * `{data, error:{message, code}}`.
 *
 * El gate free/premium **no está acá**: vive en `crearLista`, que lo consulta al
 * dueño único del cupo (`lib/favoritos/planes.ts`). Esconder el botón en el
 * cliente es cosmética; el candado es este 403.
 */

export const dynamic = 'force-dynamic'

const STATUS_POR_CODIGO: Record<string, number> = {
  LIMITE_LISTAS: 403,
  NOMBRE_REPETIDO: 409,
  NO_SESSION: 401,
}

export async function POST(request: Request) {
  const bloqueado = checkFavoritosRateLimit(request)
  if (bloqueado) return bloqueado

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

  const parsed = crearListaSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { data: null, error: { message: 'Poné un nombre de hasta 40 caracteres.', code: 'INVALID' } },
      { status: 400 },
    )
  }

  try {
    const resultado = await crearLista(session.user.id, parsed.data)
    if (!resultado.ok) {
      return Response.json(
        { data: null, error: { message: resultado.message, code: resultado.code } },
        { status: STATUS_POR_CODIGO[resultado.code] ?? 400 },
      )
    }
    return Response.json(
      {
        data: {
          id: resultado.data.id,
          name: resultado.data.name,
          isDefault: resultado.data.isDefault,
        },
        error: null,
      },
      { status: 201 },
    )
  } catch (error) {
    // No se filtra el detalle al cliente (regla global de seguridad).
    console.error('[api/listas POST]', error)
    return Response.json(
      { data: null, error: { message: 'No pudimos crear la lista.', code: 'CREATE_FAILED' } },
      { status: 500 },
    )
  }
}
