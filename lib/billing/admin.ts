import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { places, subscriptions, users } from '@/lib/db/schema'
import type { SubscriptionStatus } from '@/lib/db/schema'

/**
 * Lista de suscripciones para el panel read-only de `/admin` (MONETIZACION,
 * decisión 26): quién paga · qué lugar (o B2C) · estado · monto · período. Solo
 * lectura — el admin no opera suscripciones desde acá; la reconciliación es
 * automática (lazy). Ordenadas por creación, más nueva primero.
 */
export type SuscripcionAdmin = {
  id: string
  email: string | null
  /** Nombre del lugar (B2B) o `null` (B2C premium). */
  lugar: string | null
  status: SubscriptionStatus
  amountArs: number
  currentPeriodStart: Date
  currentPeriodEnd: Date
  cancelAtPeriodEnd: boolean
}

export async function getSuscripcionesAdmin(limite = 100): Promise<SuscripcionAdmin[]> {
  const filas = await db
    .select({
      id: subscriptions.id,
      email: users.email,
      lugar: places.name,
      status: subscriptions.status,
      amountArs: subscriptions.amountArs,
      currentPeriodStart: subscriptions.currentPeriodStart,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
    })
    .from(subscriptions)
    .leftJoin(users, eq(users.id, subscriptions.userId))
    .leftJoin(places, eq(places.id, subscriptions.placeId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(limite)

  return filas
}
