import { and, eq, ne } from 'drizzle-orm'
import { db } from '@/lib/db'
import { places, subscriptions } from '@/lib/db/schema'
import { cancelPreapproval } from '@/lib/billing/mercadopago'

/**
 * Bajas de suscripción por causas externas al usuario pagador (MONETIZACION,
 * decisión 28): revocación del reclamo (AUTH-13) y borrado de cuenta (AUTH F2).
 * En ambas se cancela el preapproval en MP **best-effort** y se baja el flag **ya**
 * — si el `PUT` a MP falla, la reconciliación lazy termina el trabajo. No se le
 * puede seguir cobrando a alguien por un lugar que ya no controla, ni a una cuenta
 * que se borró.
 */

async function cancelarEnMpBestEffort(preapprovalId: string): Promise<void> {
  try {
    await cancelPreapproval(preapprovalId)
  } catch (err) {
    // La reconciliación lazy cierra el ciclo (decisión 28). El flag baja igual.
    console.error('[billing/baja] no se pudo cancelar el preapproval en MP:', preapprovalId, err)
  }
}

/**
 * Revocación del reclamo de un lugar (decisión 28): cancela la suscripción B2B viva
 * de ese lugar en MP (best-effort) y baja `owner_plan` a free ya. Se llama desde la
 * revocación de `/admin` (`decidirClaim`). Idempotente: si no hay sub viva, solo
 * baja el flag por las dudas.
 */
export async function cancelarSuscripcionDeLugar(placeId: string): Promise<void> {
  const now = new Date()

  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.placeId, placeId), ne(subscriptions.status, 'canceled')))
    .limit(1)

  if (sub) {
    await cancelarEnMpBestEffort(sub.mpPreapprovalId)
    await db
      .update(subscriptions)
      .set({ status: 'canceled', canceledAt: now, updatedAt: now })
      .where(eq(subscriptions.id, sub.id))
  }

  await db
    .update(places)
    .set({ ownerPlan: 'free', updatedAt: now })
    .where(eq(places.id, placeId))
}

/**
 * Borrado de cuenta (decisión 28): cancela **todas** las suscripciones vivas del
 * usuario en MP (best-effort) —su B2C y las B2B de sus lugares— y baja el
 * `owner_plan` de esos lugares. Las filas de `subscriptions` caen por cascade con
 * el usuario; esto corre en `beforeDelete`, antes del cascade, para poder leerlas.
 */
export async function cancelarSuscripcionesDeUsuario(userId: string): Promise<void> {
  const now = new Date()

  const vivas = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, userId), ne(subscriptions.status, 'canceled')))

  for (const sub of vivas) {
    await cancelarEnMpBestEffort(sub.mpPreapprovalId)
    if (sub.placeId) {
      await db
        .update(places)
        .set({ ownerPlan: 'free', updatedAt: now })
        .where(eq(places.id, sub.placeId))
    }
  }
}
