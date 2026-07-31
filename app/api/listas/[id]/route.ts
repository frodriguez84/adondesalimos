import { auth } from '@/lib/auth'
import { borrarLista, renombrarLista } from '@/lib/favoritos/acciones'
import { renombrarListaSchema } from '@/lib/favoritos/validacion'
import { checkFavoritosRateLimit } from '@/lib/middleware/rate-limit'

/**
 * `PATCH /api/listas/[id]` — renombrar · `DELETE /api/listas/[id]` — borrar
 * (FAVORITOS F2, decisión 14).
 *
 * Mismo orden que el resto: rate limit → sesión inline → zod → acción de dominio.
 * **La lista nunca sale del payload**: la acción la busca en `listasVisibles`, así
 * que una lista ajena, inexistente o escondida por bajar de plan son la misma
 * respuesta (404). Y la **default no se toca** (decisión 15), validado en el
 * dominio y no solo en la UI.
 */

export const dynamic = 'force-dynamic'

const STATUS_POR_CODIGO: Record<string, number> = {
  LISTA_NO_ENCONTRADA: 404,
  LISTA_DEFAULT: 403,
  NOMBRE_REPETIDO: 409,
  NO_SESSION: 401,
}

const sinSesion = () =>
  Response.json(
    { data: null, error: { message: 'Iniciá sesión para continuar.', code: 'NO_SESSION' } },
    { status: 401 },
  )

async function sesionDe(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers }).catch(() => null)
  return session?.user ?? null
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const bloqueado = checkFavoritosRateLimit(request)
  if (bloqueado) return bloqueado

  const user = await sesionDe(request)
  if (!user) return sinSesion()

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

  const parsed = renombrarListaSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { data: null, error: { message: 'Poné un nombre de hasta 40 caracteres.', code: 'INVALID' } },
      { status: 400 },
    )
  }

  try {
    const resultado = await renombrarLista(user.id, id, parsed.data)
    if (!resultado.ok) {
      return Response.json(
        { data: null, error: { message: resultado.message, code: resultado.code } },
        { status: STATUS_POR_CODIGO[resultado.code] ?? 400 },
      )
    }
    return Response.json({
      data: {
        id: resultado.data.id,
        name: resultado.data.name,
        isDefault: resultado.data.isDefault,
      },
      error: null,
    })
  } catch (error) {
    console.error('[api/listas PATCH]', error)
    return Response.json(
      { data: null, error: { message: 'No pudimos renombrar la lista.', code: 'PATCH_FAILED' } },
      { status: 500 },
    )
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const bloqueado = checkFavoritosRateLimit(request)
  if (bloqueado) return bloqueado

  const user = await sesionDe(request)
  if (!user) return sinSesion()

  const { id } = await params

  try {
    const resultado = await borrarLista(user.id, id)
    if (!resultado.ok) {
      return Response.json(
        { data: null, error: { message: resultado.message, code: resultado.code } },
        { status: STATUS_POR_CODIGO[resultado.code] ?? 400 },
      )
    }
    return Response.json({ data: resultado.data, error: null })
  } catch (error) {
    console.error('[api/listas DELETE]', error)
    return Response.json(
      { data: null, error: { message: 'No pudimos borrar la lista.', code: 'DELETE_FAILED' } },
      { status: 500 },
    )
  }
}
