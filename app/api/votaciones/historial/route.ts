import { auth } from '@/lib/auth'
import { esPremium } from '@/lib/votaciones/planes'
import { historialDeVotaciones } from '@/lib/votaciones/query'

/**
 * `GET /api/votaciones/historial?cursor=…` — la página siguiente del historial del
 * creador (pulido de UI (d), decisión 1: 20 de entrada y "Ver más", sin scroll
 * infinito).
 *
 * Adaptador fino, mismo patrón que el resto: sesión inline → gate de plan → query.
 * El **historial es premium** (decisión 19 de VOTACION) y eso se verifica acá,
 * server-side, igual que en la pantalla: el endpoint no puede ser la puerta de
 * atrás del gate que la página aplica.
 *
 * Un cursor manoseado no rompe: `historialDeVotaciones` sirve la primera página
 * (mismo criterio que el cursor de la búsqueda).
 */

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers }).catch(() => null)
  if (!session?.user) {
    return Response.json(
      { data: null, error: { message: 'Iniciá sesión para continuar.', code: 'NO_SESSION' } },
      { status: 401 },
    )
  }

  if (!(await esPremium(session.user.id))) {
    return Response.json(
      {
        data: null,
        error: { message: 'El historial de votaciones es del plan premium.', code: 'NO_PREMIUM' },
      },
      { status: 403 },
    )
  }

  try {
    const cursor = new URL(request.url).searchParams.get('cursor')
    const pagina = await historialDeVotaciones(session.user.id, cursor)
    return Response.json({ data: pagina, error: null })
  } catch (error) {
    // No se filtra el detalle al cliente (regla global de seguridad).
    console.error('[api/votaciones/historial]', error)
    return Response.json(
      { data: null, error: { message: 'No pudimos traer el historial.', code: 'READ_FAILED' } },
      { status: 500 },
    )
  }
}
