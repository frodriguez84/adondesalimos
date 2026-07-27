import { auth } from '@/lib/auth'
import { guardarContenido, verificarDueno } from '@/lib/negocio/acciones'
import { contenidoSchema } from '@/lib/negocio/validacion'

/**
 * `PATCH /api/mi-negocio/[placeId]/content` — datos de contacto, redes y tags del
 * dueño (decisiones 13 y 15), más los tres campos pagos cuando el plan los
 * habilita (decisiones 17 y 18).
 *
 * Adaptador fino: sesión inline (decisión 9) → ownership → validación de forma →
 * acción de dominio. El gating por plan lo resuelve `acciones.ts`: acá no hay
 * ninguna regla de negocio que se pueda desincronizar.
 *
 * Ownership ANTES que la forma del payload (PULIDO, INT-14): antes, un no-dueño
 * con un payload mal formado recibía 400 en vez de 403 (`guardarContenido`
 * verifica ownership recién adentro). No había fuga —nunca escribía—, pero el
 * código de error no distinguía "no sos dueño" de "mandaste cualquier cosa".
 *
 * Sin rate limit propio: exige sesión y solo puede tocar un lugar que ya es del
 * usuario. El cupo de la decisión 23 cubre lo abierto (auth, claims, fotos).
 */

export const dynamic = 'force-dynamic'

/** Códigos de dominio → status HTTP. Lo que no está mapeado es un 400. */
const STATUS_POR_CODIGO: Record<string, number> = {
  NO_AUTORIZADO: 403,
  CAMPO_PAGO: 403,
}

export async function PATCH(request: Request, { params }: { params: Promise<{ placeId: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers }).catch(() => null)
  if (!session?.user) {
    return Response.json(
      { data: null, error: { message: 'Iniciá sesión para continuar.', code: 'NO_SESSION' } },
      { status: 401 },
    )
  }

  const { placeId } = await params

  const dueno = await verificarDueno(session.user.id, placeId)
  if (!dueno.ok) {
    return Response.json(
      { data: null, error: { message: dueno.message, code: dueno.code } },
      { status: STATUS_POR_CODIGO[dueno.code] ?? 400 },
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

  const parsed = contenidoSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { data: null, error: { message: 'Revisá los datos del formulario.', code: 'INVALID' } },
      { status: 400 },
    )
  }

  try {
    const resultado = await guardarContenido(session.user.id, placeId, parsed.data)
    if (!resultado.ok) {
      return Response.json(
        { data: null, error: { message: resultado.message, code: resultado.code } },
        { status: STATUS_POR_CODIGO[resultado.code] ?? 400 },
      )
    }
    return Response.json({ data: resultado.data, error: null })
  } catch (error) {
    // No se filtra el detalle al cliente (regla global de seguridad).
    console.error('[api/mi-negocio/content]', error)
    return Response.json(
      { data: null, error: { message: 'No pudimos guardar los cambios.', code: 'SAVE_FAILED' } },
      { status: 500 },
    )
  }
}
