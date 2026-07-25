import { auth } from '@/lib/auth'
import { checkCheckoutRateLimit } from '@/lib/middleware/rate-limit'
import { crearSuscripcion, type EntradaCheckout } from '@/lib/billing/checkout'

/**
 * `POST /api/billing/checkout` — alta de suscripción con el token del Brick
 * (MONETIZACION F2). Adaptador fino: resuelve la sesión y delega en
 * `crearSuscripcion`. Rate limit 5/h/IP (decisión 29). Body:
 * `{ tipo: 'b2c' } | { tipo: 'b2b', placeId }` + `card_token_id` + `amount`
 * (el monto que mostró el Brick, decisión 27) + `payer_email` opcional.
 */

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const bloqueado = checkCheckoutRateLimit(request)
  if (bloqueado) return bloqueado

  const session = await auth.api.getSession({ headers: request.headers }).catch(() => null)
  if (!session?.user) {
    return Response.json(
      { data: null, error: { message: 'Iniciá sesión para suscribirte.', code: 'NO_SESSION' } },
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

  const b = (body as Record<string, unknown> | null) ?? {}
  const tipo = b.tipo
  const cardTokenId = b.card_token_id
  const amount = b.amount
  const payerEmail = typeof b.payer_email === 'string' ? b.payer_email : null

  if (tipo !== 'b2c' && tipo !== 'b2b') {
    return Response.json(
      { data: null, error: { message: 'Tipo de suscripción inválido.', code: 'INVALID_TIPO' } },
      { status: 400 },
    )
  }
  if (typeof cardTokenId !== 'string' || cardTokenId.length === 0) {
    return Response.json(
      { data: null, error: { message: 'No se pudo validar la tarjeta.', code: 'NO_TOKEN' } },
      { status: 400 },
    )
  }
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return Response.json(
      { data: null, error: { message: 'Monto inválido.', code: 'INVALID_AMOUNT' } },
      { status: 400 },
    )
  }

  let entrada: EntradaCheckout
  if (tipo === 'b2b') {
    if (typeof b.placeId !== 'string' || b.placeId.length === 0) {
      return Response.json(
        { data: null, error: { message: 'Falta el lugar.', code: 'NO_PLACE' } },
        { status: 400 },
      )
    }
    entrada = {
      tipo: 'b2b',
      placeId: b.placeId,
      userId: session.user.id,
      cardTokenId,
      payerEmail,
      amountEsperado: amount,
    }
  } else {
    entrada = {
      tipo: 'b2c',
      userId: session.user.id,
      cardTokenId,
      payerEmail,
      amountEsperado: amount,
    }
  }

  try {
    const resultado = await crearSuscripcion(entrada)
    if (!resultado.ok) {
      return Response.json(
        { data: null, error: { message: resultado.message, code: resultado.code } },
        { status: resultado.httpStatus },
      )
    }
    return Response.json({ data: { status: resultado.status }, error: null }, { status: 201 })
  } catch (err) {
    // Error de la API de MP (tarjeta rechazada, antifraude): `mercadopago.ts` ya lo
    // tradujo al español en `err.message`. No se persistió nada.
    const message =
      err instanceof Error && err.message.startsWith('Mercado Pago:')
        ? err.message.replace(/^Mercado Pago:\s*/, '')
        : 'No se pudo completar el pago. Probá de nuevo.'
    console.error('[billing/checkout] error:', err)
    return Response.json(
      { data: null, error: { message, code: 'MP_ERROR' } },
      { status: 402 },
    )
  }
}
