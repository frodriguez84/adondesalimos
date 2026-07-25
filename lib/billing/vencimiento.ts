import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { subscriptions, type Subscription } from '@/lib/db/schema'
import { getPreapproval, preapprovalStatusToDb } from '@/lib/billing/mercadopago'
import { bajarFlagDelPlan } from '@/lib/billing/subscriptions'

/**
 * Margen tras el vencimiento del período antes de reconciliar contra MP (decisión
 * 14): cubre el webhook de renovación que llega tarde y los reintentos de cobro de
 * MP. Cortar el acceso al primer rechazo castigaría una tarjeta sin fondos un
 * viernes; el costo de 3 días de gracia es cero.
 */
const GRACIA_MS = 3 * 24 * 60 * 60 * 1000

/**
 * Baja el plan a free de forma serializada (decisión 8 + 17). Re-lee la fila con
 * `FOR UPDATE` y solo baja si sigue viva: si un webhook la reactivó entremedio, no
 * la pisa. Ocultar ≠ borrar — el contenido pago queda (decisión 19).
 */
async function bajarAFree(sub: Subscription, now: Date): Promise<void> {
  await db.transaction(async (tx) => {
    const [fresca] = await tx
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, sub.id))
      .for('update')
    if (!fresca || fresca.status === 'canceled') return
    await tx
      .update(subscriptions)
      .set({ status: 'canceled', canceledAt: fresca.canceledAt ?? now, updatedAt: now })
      .where(eq(subscriptions.id, fresca.id))
    await bajarFlagDelPlan(tx, fresca, now)
  })
}

/**
 * Lazy check del período vencido (decisión 18: los webhooks de MP no son
 * confiables — BUG-020). Port de `expiry.ts` de StressPlan, adaptado a que acá la
 * suscripción es por eje (una fila concreta), no una por usuario. Idempotente; se
 * llama al renderizar los tabs de suscripción. Cubre dos caminos:
 *
 * 1. **Cancelación diferida vencida** (decisión 15): el preapproval ya está
 *    cancelado en MP, no hace falta preguntar — baja a free.
 * 2. **Período vencido sin cancelar**: pasada la gracia, reconcilia contra
 *    `GET /preapproval` y escribe el estado real (extiende o baja). Si MP no
 *    responde, se reintenta al próximo ingreso — nunca degrada a ciegas.
 */
export async function reconciliarVencimiento(sub: Subscription): Promise<void> {
  if (sub.status === 'canceled') return

  const now = new Date()
  if (sub.currentPeriodEnd > now) return // período vigente, nada que reconciliar

  // 1. Cancelación diferida vencida.
  if (sub.cancelAtPeriodEnd) {
    await bajarAFree(sub, now)
    return
  }

  // 2. Período vencido sin cancelar: esperar la gracia (renovación en curso / webhook demorado).
  if (now.getTime() - sub.currentPeriodEnd.getTime() < GRACIA_MS) return

  let preapproval
  try {
    preapproval = await getPreapproval(sub.mpPreapprovalId)
  } catch (err) {
    // El preapproval no existe en MP (404) → no hay suscripción que sostenga el plan.
    if ((err as { status?: number }).status === 404) {
      await bajarAFree(sub, now)
      return
    }
    // MP caído o error transitorio: no degradamos por las dudas; se reintenta al próximo ingreso.
    console.error('[billing/vencimiento] No se pudo reconciliar con MP:', err)
    return
  }

  const status = preapprovalStatusToDb(preapproval.status)

  if (status === 'canceled') {
    await bajarAFree(sub, now)
    return
  }

  const renewedEnd = preapproval.next_payment_date ? new Date(preapproval.next_payment_date) : null
  const renewed = renewedEnd && !Number.isNaN(renewedEnd.getTime()) && renewedEnd > now

  await db
    .update(subscriptions)
    .set({
      status,
      // Solo movemos el período si MP confirma una próxima fecha de cobro futura (cobró de verdad).
      ...(renewed ? { currentPeriodStart: sub.currentPeriodEnd, currentPeriodEnd: renewedEnd } : {}),
      updatedAt: now,
    })
    .where(eq(subscriptions.id, sub.id))
}
