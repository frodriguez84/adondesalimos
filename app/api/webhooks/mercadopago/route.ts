import { validateWebhookSignature } from '@/lib/billing/mercadopago'
import { procesarPreapproval } from '@/lib/billing/webhook'
import { aplicarPagoAutorizado } from '@/lib/billing/renovacion'

/**
 * `POST /api/webhooks/mercadopago` (MONETIZACION, decisiones 16-17). **Firma HMAC
 * obligatoria**: sin ella o inválida ⇒ 401, sin tocar la DB ni consumir cupo (no
 * lleva rate limit — el 401 es barato y limitar los reintentos legítimos de MP
 * sería un gol en contra, decisión 29). **Sin rama IPN legacy** (decisión 16): acá
 * no hay à la carte. Solo dos topics: `subscription_preapproval` y
 * `subscription_authorized_payment`. Respuestas: 200 = procesado o nada que hacer;
 * 500 = error transitorio (MP reintenta; el handler es idempotente); 404 de MP en
 * el GET defensivo ⇒ 200 (data de prueba o borrada).
 */

export const dynamic = 'force-dynamic'

function ok() {
  return Response.json({ received: true })
}

export async function POST(request: Request) {
  const url = new URL(request.url)
  let body: { type?: string; action?: string; data?: { id?: string | number } } = {}
  try {
    body = await request.json()
  } catch {
    // algunos webhooks llegan sin body útil; seguimos con los query params
  }

  const signatureDataId = url.searchParams.get('data.id')

  const valido = validateWebhookSignature({
    xSignature: request.headers.get('x-signature'),
    xRequestId: request.headers.get('x-request-id'),
    dataId: signatureDataId,
  })
  if (!valido) {
    console.warn('[webhooks/mercadopago] Firma inválida o ausente', {
      type: url.searchParams.get('type') ?? url.searchParams.get('topic'),
      dataId: signatureDataId,
    })
    return Response.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const type = url.searchParams.get('type') ?? url.searchParams.get('topic') ?? body.type ?? ''
  const resourceId =
    signatureDataId ?? (body.data?.id != null ? String(body.data.id) : null)
  if (!resourceId) return ok()

  try {
    if (type === 'subscription_preapproval') {
      await procesarPreapproval(resourceId)
    } else if (type === 'subscription_authorized_payment') {
      await aplicarPagoAutorizado(resourceId)
    }
    // Cualquier otro topic: 200 y nada que hacer (no se procesa, no reintenta).
  } catch (err) {
    // 404 de MP (data.id de prueba o recurso borrado): no es transitorio, ackear con 200.
    if ((err as { status?: number })?.status === 404) {
      console.warn('[webhooks/mercadopago] Recurso inexistente:', resourceId)
      return ok()
    }
    console.error('[webhooks/mercadopago] Error procesando webhook:', err)
    return Response.json({ error: 'Processing failed' }, { status: 500 })
  }

  return ok()
}
