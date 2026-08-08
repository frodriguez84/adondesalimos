import { and, desc, eq, ilike, inArray, ne, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { placeClaims, places, planGrants, subscriptions, users } from '@/lib/db/schema'
import type { OwnerPlan, PlanGrantAction, SubscriptionStatus, UserPlan } from '@/lib/db/schema'

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

// ---------------------------------------------------------------------------
// Usuarios y premium de cortesía — spec ADMIN_USUARIOS
// ---------------------------------------------------------------------------

/** Un lugar del usuario (reclamo aprobado) con el plan de ESE lugar. */
export type LugarDelUsuario = {
  id: string
  nombre: string
  ownerPlan: OwnerPlan
  /** `true` = hay suscripción B2B viva ⇒ el plan es **pago**, no cortesía. */
  paga: boolean
}

/**
 * Una fila de la tab Usuarios (decisión 8). **Exactamente** estos campos: no va
 * `image` (ruido) ni `chat_trial_used` (dato de cupo, vive en Costos), ni nada de
 * `session`/`account`/`verification`.
 */
export type UsuarioAdmin = {
  id: string
  email: string
  nombre: string | null
  plan: UserPlan
  /** `true` = hay suscripción B2C viva ⇒ premium **pago**; `false` con premium ⇒ cortesía. */
  paga: boolean
  emailVerified: boolean
  createdAt: Date
  lugares: LugarDelUsuario[]
}

/**
 * El listado de la tab Usuarios (`FB-01`). Los más nuevos primero, topeado —el
 * conteo real sale de `contarUsuarios()`, aparte, mismo criterio que la lista de
 * interesados (INT2-28)—.
 *
 * `q` busca por mail **o** nombre, sin distinguir mayúsculas. Vacío ⇒ sin filtro.
 *
 * El badge de origen del plan («paga» vs «cortesía») necesita saber si hay
 * suscripción viva: se resuelve con **una** query para todo el lote, no una por
 * fila. La cortesía es, por definición, premium **sin** fila viva (decisión 3) —
 * este read usa el mismo discriminante que el panel del usuario, no otro.
 */
export async function getUsuariosAdmin(q?: string, limite = 50): Promise<UsuarioAdmin[]> {
  const texto = q?.trim() ?? ''
  const filtro =
    texto.length > 0
      ? or(ilike(users.email, `%${texto}%`), ilike(users.name, `%${texto}%`))
      : undefined

  const filas = await db
    .select({
      id: users.id,
      email: users.email,
      nombre: users.name,
      plan: users.plan,
      emailVerified: users.emailVerified,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(filtro)
    .orderBy(desc(users.createdAt))
    .limit(limite)

  if (filas.length === 0) return []
  const userIds = filas.map((f) => f.id)

  // Sus lugares: la propiedad se deriva del reclamo aprobado (`ownership.ts`), no
  // hay columna de rol. Es el mismo criterio que gatea el panel del dueño.
  const lugares = await db
    .select({
      userId: placeClaims.userId,
      id: places.id,
      nombre: places.name,
      ownerPlan: places.ownerPlan,
    })
    .from(placeClaims)
    .innerJoin(places, eq(places.id, placeClaims.placeId))
    .where(and(inArray(placeClaims.userId, userIds), eq(placeClaims.status, 'approved')))
    .orderBy(places.name)

  const placeIds = lugares.map((l) => l.id)

  // Las vivas de todo el lote. Por `place_id` además de por `user_id` porque el que
  // paga un lugar puede no ser el mismo que lo reclamó.
  const vivas = await db
    .select({ userId: subscriptions.userId, placeId: subscriptions.placeId })
    .from(subscriptions)
    .where(
      and(
        ne(subscriptions.status, 'canceled'),
        placeIds.length > 0
          ? or(inArray(subscriptions.userId, userIds), inArray(subscriptions.placeId, placeIds))
          : inArray(subscriptions.userId, userIds),
      ),
    )

  const pagaB2C = new Set(vivas.filter((v) => v.placeId === null).map((v) => v.userId))
  const pagaB2B = new Set(vivas.map((v) => v.placeId).filter((id): id is string => id !== null))

  return filas.map((f) => ({
    ...f,
    paga: pagaB2C.has(f.id),
    lugares: lugares
      .filter((l) => l.userId === f.id)
      .map((l) => ({ id: l.id, nombre: l.nombre, ownerPlan: l.ownerPlan, paga: pagaB2B.has(l.id) })),
  }))
}

/** El total de cuentas, **sin** el techo del listado (ADMU-02). */
export async function contarUsuarios(): Promise<number> {
  const [fila] = await db.select({ total: sql<number>`count(*)::int` }).from(users)
  return fila?.total ?? 0
}

/** Una línea de la bitácora del premium de cortesía. */
export type MovimientoCortesia = {
  id: string
  accion: PlanGrantAction
  /** Nombre del lugar (B2B) o `null` (B2C). */
  lugar: string | null
  motivo: string
  grantedBy: string
  createdAt: Date
}

/**
 * La bitácora de un usuario (decisión 7): quién le dio o le sacó la cortesía,
 * cuándo y por qué. **Solo para mostrar** — ningún gate lee `plan_grants`; el
 * estado vigente sale siempre de `users.plan` / `places.owner_plan`.
 *
 * Son un puñado de filas por usuario (un movimiento manual es la acción más rara
 * de todo `/admin`), así que no lleva tope.
 */
export async function getBitacoraCortesia(userId: string): Promise<MovimientoCortesia[]> {
  return db
    .select({
      id: planGrants.id,
      accion: planGrants.accion,
      lugar: places.name,
      motivo: planGrants.motivo,
      grantedBy: planGrants.grantedBy,
      createdAt: planGrants.createdAt,
    })
    .from(planGrants)
    .leftJoin(places, eq(places.id, planGrants.placeId))
    .where(eq(planGrants.userId, userId))
    .orderBy(desc(planGrants.createdAt))
}
