import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { subscriptions } from '@/lib/db/schema'
import { cancelPreapproval } from '@/lib/billing/mercadopago'
import { getSuscripcionViva } from '@/lib/billing/subscriptions'

/**
 * Cancelación diferida simulada (MONETIZACION, decisión 15). MP no cancela a fecha
 * futura, así que: se cancela **ya** el preapproval en MP y en DB queda
 * `cancel_at_period_end=true` con `current_period_end` intacto — el acceso sigue
 * hasta el fin del período pagado; el flag lo baja el lazy check al vencer. No hay
 * "reactivar antes de vencer" (un preapproval cancelado no se descancela): se
 * ofrece un checkout nuevo cuando venza.
 */

export type ResultadoCancelacion =
  | { ok: true }
  | { ok: false; code: string; message: string; httpStatus: number }

export async function cancelarSuscripcion(opts: {
  userId: string
  /** `undefined`/`null` = la B2C del usuario; con valor = la B2B de ese lugar. */
  placeId?: string | null
}): Promise<ResultadoCancelacion> {
  const placeId = opts.placeId ?? null

  const sub = placeId
    ? await getSuscripcionViva({ placeId })
    : await getSuscripcionViva({ userId: opts.userId, placeId: null })

  // El que cancela tiene que ser el que paga (el tab B2B solo lo ve el dueño, que
  // además es el pagador — pero se verifica igual, defensivo).
  if (!sub || sub.userId !== opts.userId) {
    return {
      ok: false,
      code: 'SIN_SUSCRIPCION',
      message: 'No tenés una suscripción activa para cancelar.',
      httpStatus: 404,
    }
  }

  if (sub.cancelAtPeriodEnd) {
    return { ok: true } // ya estaba en cancelación diferida; idempotente
  }

  // Cancelar en MP primero: si esto falla, no tocamos la DB — el usuario reintenta
  // y no queda una fila "cancelada" que MP sigue cobrando.
  try {
    await cancelPreapproval(sub.mpPreapprovalId)
  } catch (err) {
    console.error('[billing/cancelacion] no se pudo cancelar en MP:', err)
    return {
      ok: false,
      code: 'MP_ERROR',
      message: 'No pudimos cancelar ahora. Probá de nuevo en un rato.',
      httpStatus: 502,
    }
  }

  const now = new Date()
  await db
    .update(subscriptions)
    .set({ cancelAtPeriodEnd: true, canceledAt: now, updatedAt: now })
    .where(eq(subscriptions.id, sub.id))

  return { ok: true }
}
