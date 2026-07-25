import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { subscriptions } from '@/lib/db/schema'
import { getPreapproval } from '@/lib/billing/mercadopago'
import {
  activarFlagDelPlan,
  bajarFlagDelPlan,
  resolverFinDePeriodo,
} from '@/lib/billing/subscriptions'

/**
 * Procesa un `subscription_preapproval` del webhook (MONETIZACION, decisiones
 * 16-17). **GET defensivo**: el estado se lee de `GET /preapproval` fresco, nunca
 * del payload del webhook. El read-modify-write va con `FOR UPDATE` para serializar
 * reintentos casi simultáneos de MP. Idempotente: reprocesar el mismo evento no
 * cambia nada distinto. Port de `handlePreapproval` de StressPlan, adaptado al sync
 * de flags por eje (B2C/B2B) y sin el grandfather.
 */
export async function procesarPreapproval(preapprovalId: string): Promise<void> {
  // Fuera de la TX: es una llamada de red, no se sostiene un lock esperando a MP.
  const preapproval = await getPreapproval(preapprovalId)

  await db.transaction(async (tx) => {
    const [sub] = await tx
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.mpPreapprovalId, preapprovalId))
      .for('update')
    if (!sub) return // no es nuestra o aún no persistida (el POST de checkout la crea)

    const now = new Date()

    switch (preapproval.status) {
      case 'authorized': {
        // Confirmación de activación (la activación inicial ya ocurrió en el POST,
        // o llega acá si el checkout quedó pending y MP la autorizó después).
        const periodEnd = resolverFinDePeriodo(
          sub.currentPeriodStart ?? now,
          preapproval.next_payment_date,
        )
        await tx
          .update(subscriptions)
          .set({ status: 'active', currentPeriodEnd: periodEnd, updatedAt: now })
          .where(eq(subscriptions.id, sub.id))
        await activarFlagDelPlan(tx, sub, now)
        return
      }

      case 'paused':
      case 'cancelled': {
        // Exclusión mutua con la cancelación diferida (decisión 15): si el usuario
        // la canceló, el flag NO baja acá — lo baja el lazy check al vencer el
        // período pagado. Solo se sella el `canceledAt`.
        if (sub.cancelAtPeriodEnd) {
          await tx
            .update(subscriptions)
            .set({ canceledAt: sub.canceledAt ?? now, updatedAt: now })
            .where(eq(subscriptions.id, sub.id))
          return
        }
        // Cancelación/pausa externa o reintentos agotados → downgrade inmediato.
        await tx
          .update(subscriptions)
          .set({ status: 'canceled', canceledAt: now, updatedAt: now })
          .where(eq(subscriptions.id, sub.id))
        await bajarFlagDelPlan(tx, sub, now)
        return
      }

      case 'pending': {
        await tx
          .update(subscriptions)
          .set({ status: 'past_due', updatedAt: now })
          .where(eq(subscriptions.id, sub.id))
        return
      }
    }
  })
}
