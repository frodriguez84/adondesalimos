import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { subscriptions, subscriptionPayments } from '@/lib/db/schema'
import { getAuthorizedPayment, getPreapproval } from '@/lib/billing/mercadopago'
import { activarFlagDelPlan, resolverFinDePeriodo } from '@/lib/billing/subscriptions'

/**
 * Resultado de procesar un `subscription_authorized_payment`. Informativo (el
 * webhook ackea 200 en todos los casos): distingue "renovó" de "ya estaba" en logs
 * y tests.
 */
export type ResultadoRenovacion = 'ignored' | 'duplicate' | 'renewed' | 'past_due'

/**
 * Cobro recurrente de MP (renovación de suscripción). Port de `subscriptionRenewal.ts`
 * de StressPlan.
 *
 * **Idempotente por `authorized_payment_id`** (decisión 17, lección OBS-002): el
 * período solo avanza la PRIMERA vez que se aplica un cobro; re-entregar el mismo id
 * (reintento de MP o reenvío manual) sale por `duplicate`. El guard
 * (`subscription_payments`, UNIQUE) se registra **solo en la rama `approved`** —
 * nunca al rechazar—, porque MP reusa el mismo id al reintentar y ese reintento
 * aprobado SÍ tiene que renovar: un guard puesto al rechazar mataría la renovación real.
 *
 * El read-modify-write sobre `subscriptions` va con `FOR UPDATE` (decisión 17): dos
 * reintentos casi simultáneos de MP no intercalan sus escrituras.
 */
export async function aplicarPagoAutorizado(
  authorizedPaymentId: string,
): Promise<ResultadoRenovacion> {
  const authPayment = await getAuthorizedPayment(authorizedPaymentId)
  const preapprovalId = authPayment.preapproval_id
  if (!preapprovalId) return 'ignored'

  const paymentStatus = authPayment.payment?.status
  if (paymentStatus !== 'approved' && paymentStatus !== 'rejected') return 'ignored'

  // next_payment_date de MP (red, fuera de la TX). Best-effort: si falla, el fin de
  // período cae en el +1 mes de resolverFinDePeriodo con nextPaymentDate undefined.
  let nextPaymentDate: string | undefined
  if (paymentStatus === 'approved') {
    try {
      nextPaymentDate = (await getPreapproval(preapprovalId)).next_payment_date
    } catch {
      // si falla el GET, usamos el +1 mes calculado
    }
  }

  return await db.transaction(async (tx): Promise<ResultadoRenovacion> => {
    const [sub] = await tx
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.mpPreapprovalId, preapprovalId))
      .for('update')
    if (!sub) return 'ignored' // no es nuestra o aún no persistida (el POST de checkout la crea)

    // Una sub en cancelación diferida no debería recibir cobros (decisión 15); ignorar defensivamente.
    if (sub.cancelAtPeriodEnd) return 'ignored'

    const now = new Date()

    if (paymentStatus === 'rejected') {
      // Pago rechazado: past_due, el acceso se CONSERVA mientras MP reintenta
      // (decisión 14). El downgrade real llega con paused/cancelled del preapproval.
      await tx
        .update(subscriptions)
        .set({ status: 'past_due', updatedAt: now })
        .where(eq(subscriptions.id, sub.id))
      return 'past_due'
    }

    // ¿Este cobro ya extendió el período? El SELECT va dentro del lock de subscriptions;
    // el UNIQUE de la columna es la red final.
    const [already] = await tx
      .select({ id: subscriptionPayments.id })
      .from(subscriptionPayments)
      .where(eq(subscriptionPayments.mpAuthorizedPaymentId, authorizedPaymentId))
      .limit(1)
    if (already) return 'duplicate'

    // Renovación confirmada: extender período y volver a active si venía de past_due.
    const periodStart =
      sub.currentPeriodEnd && sub.currentPeriodEnd > now ? sub.currentPeriodEnd : now
    const periodEnd = resolverFinDePeriodo(periodStart, nextPaymentDate)

    await tx
      .update(subscriptions)
      .set({
        status: 'active',
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        updatedAt: now,
      })
      .where(eq(subscriptions.id, sub.id))

    // Restaurar el flag pago por si lo habíamos bajado (defensivo, decisión 8).
    await activarFlagDelPlan(tx, sub, now)

    await tx.insert(subscriptionPayments).values({
      subscriptionId: sub.id,
      mpAuthorizedPaymentId: authorizedPaymentId,
      amountArs: sub.amountArs,
      periodStart,
      periodEnd,
    })

    return 'renewed'
  })
}
