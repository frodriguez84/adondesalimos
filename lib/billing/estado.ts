import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { places } from '@/lib/db/schema'
import { esPremium } from '@/lib/votaciones/planes'
import { getSuscripcionViva } from '@/lib/billing/subscriptions'
import { reconciliarVencimiento } from '@/lib/billing/vencimiento'
import type { SubscriptionStatus } from '@/lib/db/schema'

/**
 * Estado de la suscripción para pintar los tabs de `/cuenta` (B2C) y
 * `/mi-negocio/[placeId]` (B2B) — MONETIZACION F2. Hace el **lazy check** al leer
 * (decisión 18: los webhooks de MP no son confiables): reconcilia la fila vencida
 * contra MP antes de decidir qué mostrar. `activo` sale del **flag** (la fuente del
 * gate, decisión 8), leído después de reconciliar; el resto es la fila viva.
 */
export type EstadoSuscripcion = {
  /** El flag de gating: premium (B2C) o paid (B2B). */
  activo: boolean
  /** Status de la fila viva, o `null` si no hay ninguna. */
  status: SubscriptionStatus | null
  /** Fin del período vigente en ISO, o `null`. */
  currentPeriodEnd: string | null
  /** Cancelación diferida en curso (decisión 15). */
  cancelAtPeriodEnd: boolean
}

async function resolver(
  axis: { userId: string; placeId: null } | { placeId: string },
  leerFlag: () => Promise<boolean>,
): Promise<EstadoSuscripcion> {
  let sub = await getSuscripcionViva(axis)
  if (sub) {
    await reconciliarVencimiento(sub)
    // Re-leer: la reconciliación pudo cancelarla (ya no sería "viva").
    sub = await getSuscripcionViva(axis)
  }
  const activo = await leerFlag()
  return {
    activo,
    status: sub?.status ?? null,
    currentPeriodEnd: sub?.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
  }
}

/** Estado de la suscripción premium (B2C) de un usuario. */
export function estadoSuscripcionB2C(userId: string): Promise<EstadoSuscripcion> {
  return resolver({ userId, placeId: null }, () => esPremium(userId))
}

/** Estado de la suscripción (B2B) de un lugar. */
export function estadoSuscripcionB2B(placeId: string): Promise<EstadoSuscripcion> {
  return resolver({ placeId }, async () => {
    const [fila] = await db
      .select({ ownerPlan: places.ownerPlan })
      .from(places)
      .where(eq(places.id, placeId))
      .limit(1)
    return fila?.ownerPlan === 'paid'
  })
}
