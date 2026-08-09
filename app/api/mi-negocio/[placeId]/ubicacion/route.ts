import { auth } from '@/lib/auth'
import { proponerCorreccion } from '@/lib/negocio/correcciones'

/**
 * `POST /api/mi-negocio/[placeId]/ubicacion` — el dueño **propone** un cambio de
 * dirección o de pin (CORRECCION_DATOS, decisión 11). No escribe en `places`:
 * entra a la cola de aprobación que ya existe y la decide el admin.
 *
 * El porqué de que acá se proponga y no se aplique: `description` o `menu_url`
 * solo tocan la ficha de quien los escribe, pero **el pin mueve al lugar en la
 * búsqueda de todos**, y correr el pin a una zona de más tráfico es el incentivo
 * clásico de spam en un directorio.
 *
 * Adaptador fino: sesión → acción de dominio. La propiedad la verifica
 * `proponerCorreccion` con `esDuenoDe` —el mismo gate del resto del panel— y el
 * body va **sin parsear**: el schema del dueño vive en `correcciones.ts` y es
 * estricto, así que mandar `name` se rechaza en vez de ignorarse (decisión 12).
 *
 * Sin rate limit propio, igual que `/content`: exige sesión y solo puede tocar un
 * lugar que ya es del usuario.
 */

export const dynamic = 'force-dynamic'

const STATUS: Record<string, number> = {
  NO_AUTORIZADO: 403,
  YA_PENDIENTE: 409,
  INVALID: 400,
}

export async function POST(request: Request, { params }: { params: Promise<{ placeId: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers }).catch(() => null)
  if (!session?.user) {
    return Response.json(
      { data: null, error: { message: 'Iniciá sesión para continuar.', code: 'NO_SESSION' } },
      { status: 401 },
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

  try {
    const resultado = await proponerCorreccion(session.user.id, placeId, body)
    if (!resultado.ok) {
      return Response.json(
        { data: null, error: { message: resultado.message, code: resultado.code } },
        { status: STATUS[resultado.code] ?? 400 },
      )
    }
    return Response.json({ data: resultado.data, error: null })
  } catch (error) {
    // No se filtra el detalle al cliente (regla global de seguridad).
    console.error('[api/mi-negocio/ubicacion]', placeId, error)
    return Response.json(
      { data: null, error: { message: 'No pudimos mandar el cambio.', code: 'FAILED' } },
      { status: 500 },
    )
  }
}
