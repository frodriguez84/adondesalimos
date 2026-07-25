import type { SubscriptionStatus } from '@/lib/db/schema'

/**
 * Tipos de billing (MONETIZACION F2). MercadoPago es el **único** proveedor
 * (decisión 12): no hay abstracción `BillingProvider` ni el legacy Stripe de
 * StressPlan. Acá viven las formas de los recursos de MP tal como llegan por la
 * red y los parámetros que consume `lib/billing/mercadopago.ts`.
 */

/** A qué se suscribe: premium del usuario (B2C) o el plan de un lugar (B2B). */
export type TipoSuscripcion = 'b2c' | 'b2b'

/**
 * Parámetros del checkout que recibe `createPreapproval` (el Brick ya tokenizó la
 * tarjeta). **Sin plan pre-creado** (decisión 10): el monto viaja explícito y sale
 * del precio vigente en DB, no de un `preapproval_plan_id`.
 */
export interface MpCheckoutParams {
  cardTokenId: string
  payerEmail: string
  /** Congelado al contratar; es el `transaction_amount` del `auto_recurring`. */
  amountArs: number
  /** Trazabilidad en MP: nuestro `user_id` (quién paga). */
  externalReference: string
}

/** Estado de un preapproval en MP. */
export type MpPreapprovalStatus = 'pending' | 'authorized' | 'paused' | 'cancelled'

/** Datos crudos del preapproval que la app necesita. */
export interface MpPreapproval {
  id: string
  status: MpPreapprovalStatus
  payer_id?: number | string
  external_reference?: string
  next_payment_date?: string
  auto_recurring?: {
    frequency?: number
    frequency_type?: string
    transaction_amount?: number
    currency_id?: string
  }
}

export type MpAuthorizedPaymentStatus = 'scheduled' | 'processed' | 'recycling' | 'cancelled'

/** Estado de un cobro recurrente (lo que importa para renovaciones). */
export interface MpAuthorizedPayment {
  id: number | string
  preapproval_id?: string
  status: MpAuthorizedPaymentStatus
  /** El detalle real del cobro vive acá: approved | rejected | ... */
  payment?: { id?: number; status?: string }
}

export type { SubscriptionStatus }
