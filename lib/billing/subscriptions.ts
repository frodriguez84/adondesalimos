import { and, eq, isNull, ne } from 'drizzle-orm'
import { db, type DbOrTx } from '@/lib/db'
import { places, subscriptions, users, type Subscription } from '@/lib/db/schema'

/**
 * Sync de los flags de plan (MONETIZACION, decisión 8). La suscripción es lo único
 * que **mueve** `users.plan` (B2C) y `places.owner_plan` (B2B); los helpers de
 * gating (`esPremium`, `resolverContenidoDueno`, cap de fotos, gates de votación)
 * no se tocan, solo consultan el flag. Cuál flag se mueve lo decide el eje de la
 * suscripción: `place_id IS NULL` ⇒ premium del usuario; con valor ⇒ el lugar.
 *
 * Este módulo es la fuente única de esa regla — nadie más escribe los flags (se
 * retiró el "UPDATE documentado" de AUTH/VOTACION).
 */

/** Sube el flag: premium (B2C) o paid (B2B) según el eje. */
export async function activarFlagDelPlan(
  tx: DbOrTx,
  sub: Pick<Subscription, 'userId' | 'placeId'>,
  now: Date,
): Promise<void> {
  if (sub.placeId === null) {
    await tx.update(users).set({ plan: 'premium', updatedAt: now }).where(eq(users.id, sub.userId))
  } else {
    await tx
      .update(places)
      .set({ ownerPlan: 'paid', updatedAt: now })
      .where(eq(places.id, sub.placeId))
  }
}

/**
 * Baja el flag a free (decisión 19: ocultar ≠ borrar — el contenido pago queda,
 * solo deja de mostrarse). No borra nada más; re-suscribir lo trae todo de vuelta.
 */
export async function bajarFlagDelPlan(
  tx: DbOrTx,
  sub: Pick<Subscription, 'userId' | 'placeId'>,
  now: Date,
): Promise<void> {
  if (sub.placeId === null) {
    await tx.update(users).set({ plan: 'free', updatedAt: now }).where(eq(users.id, sub.userId))
  } else {
    await bajarFlagDeLugar(tx, sub.placeId, now)
  }
}

/**
 * La bajada del eje B2B **sin** eje completo, para los llamadores que bajan el plan
 * de un lugar sin tener una suscripción a mano: `cancelarSuscripcionDeLugar` baja el
 * flag incluso cuando no hay fila viva (`lib/billing/baja.ts`), así que no puede
 * armar el `{ userId, placeId }` que pide `bajarFlagDelPlan`.
 *
 * Existe para que ese caso no tenga que escribir el `UPDATE` por su cuenta: era la
 * **segunda implementación** de la regla (ADMIN_USUARIOS, `ADMU-QA-01`) y dos copias
 * driftean. Sigue habiendo un solo lugar donde `places.owner_plan` se escribe.
 */
export async function bajarFlagDeLugar(
  tx: DbOrTx,
  placeId: string,
  now: Date,
): Promise<void> {
  await tx.update(places).set({ ownerPlan: 'free', updatedAt: now }).where(eq(places.id, placeId))
}

/**
 * La suscripción **viva** (≠ canceled) de un eje. `placeId=null` ⇒ la B2C del
 * usuario; con valor ⇒ la B2B de ese lugar. Los índices únicos parciales garantizan
 * a lo sumo una (decisión 12). Una cancelada en gracia sigue siendo "viva" hasta
 * `canceled` — por eso el filtro es por `status`, no por `cancel_at_period_end`.
 */
export async function getSuscripcionViva(
  opts: { userId: string; placeId: null } | { placeId: string },
  database: DbOrTx = db,
): Promise<Subscription | undefined> {
  const cond =
    'userId' in opts
      ? and(
          eq(subscriptions.userId, opts.userId),
          isNull(subscriptions.placeId),
          ne(subscriptions.status, 'canceled'),
        )
      : and(eq(subscriptions.placeId, opts.placeId), ne(subscriptions.status, 'canceled'))

  const [sub] = await database.select().from(subscriptions).where(cond).limit(1)
  return sub
}

/** Lee una suscripción por su preapproval de MP (la clave que trae el webhook). */
export async function getSuscripcionPorPreapproval(
  preapprovalId: string,
  database: DbOrTx = db,
): Promise<Subscription | undefined> {
  const [sub] = await database
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.mpPreapprovalId, preapprovalId))
    .limit(1)
  return sub
}

/** Suma un mes calendario (maneja fin de mes). Compartido con la reconciliación. */
export function sumarUnMes(from: Date): Date {
  const d = new Date(from)
  d.setMonth(d.getMonth() + 1)
  return d
}

/**
 * Fin del período de facturación: usa el `next_payment_date` de MP solo si es
 * posterior al inicio; si no, +1 mes (MP a veces devuelve fechas inválidas al crear
 * el preapproval). Port de `resolvePeriodEnd` de StressPlan.
 */
export function resolverFinDePeriodo(periodStart: Date, nextPaymentDate?: string | null): Date {
  const fallback = sumarUnMes(periodStart)
  if (!nextPaymentDate) return fallback
  const parsed = new Date(nextPaymentDate)
  if (Number.isNaN(parsed.getTime()) || parsed <= periodStart) return fallback
  return parsed
}
