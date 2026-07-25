import crypto from 'crypto'
import { parseMpApiErrorBody } from '@/lib/billing/mp-errors'
import type {
  MpAuthorizedPayment,
  MpCheckoutParams,
  MpPreapproval,
  SubscriptionStatus,
} from '@/lib/billing/types'

/**
 * **El único módulo que habla con MercadoPago** (MONETIZACION, decisión 11) —
 * mismo criterio que `lib/google/places.ts` (Google) y `lib/storage/r2.ts` (R2).
 * `MP_ACCESS_TOKEN` y `MP_WEBHOOK_SECRET` se leen SOLO acá, de `process.env` en el
 * momento de la llamada (no en el tope: así los helpers puros —`validateWebhookSignature`,
 * el mapeo de estados— se importan en tests sin exigir las claves), y jamás llegan
 * al bundle del browser. La única clave pública es `NEXT_PUBLIC_MP_PUBLIC_KEY` (la
 * necesita el Brick; es pública por diseño y vive en el cliente).
 *
 * Server-only por construcción: lo importan los endpoints y la reconciliación del
 * server, nunca un componente `'use client'`. El guard de abajo es la red barata:
 * si algún día cae en un bundle de browser, revienta en vez de filtrar el token.
 *
 * Sin SDK npm: `fetch` directo a `api.mercadopago.com` con Bearer (patrón StressPlan).
 * **Sin `preapproval_plan_id`** (decisión 10): el monto viaja en el `auto_recurring`
 * y sale del precio vigente en DB — una sola fuente de verdad, cero env de plan IDs.
 */

if (typeof window !== 'undefined') {
  throw new Error('lib/billing/mercadopago.ts es server-only: no puede importarse en el browser')
}

const MP_API = 'https://api.mercadopago.com'

function accessToken(): string {
  const token = process.env.MP_ACCESS_TOKEN
  if (!token) throw new Error('MP_ACCESS_TOKEN no está configurado')
  return token
}

/** URL base del sitio (misma convención que `lib/email`): `back_url` del preapproval. */
function appUrl(): string {
  return process.env.BETTER_AUTH_URL ?? 'http://localhost:5178'
}

async function mpFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${MP_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken()}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    // Cero caché: el estado de una suscripción es la fuente de verdad, no se cachea.
    cache: 'no-store',
  })

  const text = await res.text()
  const json = text ? JSON.parse(text) : {}

  if (!res.ok) {
    const parsed = parseMpApiErrorBody(json)
    console.error('[mercadopago] API error', {
      path,
      status: res.status,
      code: parsed.code,
      message: parsed.message,
    })
    const error = new Error(`Mercado Pago: ${parsed.userMessage}`) as Error & {
      status?: number
      mpCode?: string | null
    }
    error.status = res.status
    error.mpCode = parsed.code
    throw error
  }

  return json as T
}

/**
 * Crea la suscripción (preapproval) ya autorizada con el `card_token` del Brick.
 * **Sin plan** (decisión 10): frecuencia mensual y monto van explícitos en el
 * `auto_recurring`; el monto es el precio vigente en DB, congelado al contratar.
 */
export function createPreapproval(params: MpCheckoutParams): Promise<MpPreapproval> {
  return mpFetch<MpPreapproval>('/preapproval', {
    method: 'POST',
    body: JSON.stringify({
      reason: 'Suscripción A Dónde Salimos',
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: params.amountArs,
        currency_id: 'ARS',
      },
      payer_email: params.payerEmail,
      card_token_id: params.cardTokenId,
      external_reference: params.externalReference,
      back_url: `${appUrl()}/cuenta`,
      status: 'authorized',
    }),
  })
}

export function getPreapproval(id: string): Promise<MpPreapproval> {
  return mpFetch<MpPreapproval>(`/preapproval/${id}`)
}

/** Cancelación inmediata en MP (la app simula la cancelación diferida — decisión 15). */
export function cancelPreapproval(id: string): Promise<MpPreapproval> {
  return mpFetch<MpPreapproval>(`/preapproval/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'cancelled' }),
  })
}

export function getAuthorizedPayment(id: string): Promise<MpAuthorizedPayment> {
  return mpFetch<MpAuthorizedPayment>(`/authorized_payments/${id}`)
}

// ─── Mapeo de estados MP → BD (decisión 13) ─────────────────────────────────

export function preapprovalStatusToDb(status: MpPreapproval['status']): SubscriptionStatus {
  switch (status) {
    case 'authorized':
      return 'active'
    case 'pending':
      return 'past_due'
    case 'paused':
    case 'cancelled':
      return 'canceled'
    default:
      return 'canceled'
  }
}

// ─── Validación de firma del webhook (x-signature, HMAC-SHA256) ──────────────
// Portado TAL CUAL de StressPlan (decisión 16): el manifest es el oficial de MP.

interface SignatureInput {
  xSignature: string | null
  xRequestId: string | null
  /** Query `data.id` del webhook firmado. Ausente → cadena vacía. */
  dataId: string | null
}

/** Manifest HMAC tal como lo documenta MP (PHP oficial): id, request-id y ts. */
export function buildWebhookSignatureManifest(
  dataId: string | null,
  xRequestId: string | null,
  ts: string,
): string {
  const idPart = (dataId ?? '').toLowerCase()
  const requestIdPart = xRequestId ?? ''
  return `id:${idPart};request-id:${requestIdPart};ts:${ts};`
}

/**
 * Valida la autenticidad de un webhook de MP.
 * Template: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` — HMAC-SHA256 con
 * `MP_WEBHOOK_SECRET`, comparación timing-safe.
 */
export function validateWebhookSignature({
  xSignature,
  xRequestId,
  dataId,
}: SignatureInput): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET
  if (!secret || !xSignature) return false

  // x-signature: "ts=1742505638683,v1=hexhash"
  const parts = Object.fromEntries(
    xSignature.split(',').map((kv) => {
      const [k, v] = kv.split('=')
      return [k?.trim(), v?.trim()]
    }),
  ) as { ts?: string; v1?: string }

  if (!parts.ts || !parts.v1) return false

  const manifest = buildWebhookSignatureManifest(dataId, xRequestId, parts.ts)
  const computed = crypto.createHmac('sha256', secret).update(manifest).digest('hex')

  try {
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(parts.v1))
  } catch {
    return false
  }
}
