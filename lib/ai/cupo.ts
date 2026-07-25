import { and, eq, sql } from 'drizzle-orm'
import { db, type DbOrTx } from '@/lib/db'
import {
  aiApiUsage,
  chatConversations,
  chatMessages,
  chatQuotaGrants,
  chatUsageMonthly,
  users,
  type ChatModo,
  type ChatPlan,
} from '@/lib/db/schema'
import { getChatMonthlyCap, getChatQuotaPremium, getChatQuotaTrial } from './settings'

/**
 * Cupo del chat IA (CHAT_IA, decisiones 5, 6, 13, 14, 15). Tres candados de gasto:
 *
 *  1. **Tope global por SKU** (`ai.chat_monthly_cap` + `ai_api_usage`, decisión 15):
 *     el kill switch. Superado ⇒ 503 sin llamar. Se incrementa ANTES de la llamada.
 *  2. **Cupo del usuario** (decisión 5/6): premium = `ai.chat_quota_premium` +
 *     SUM(grants del mes) vs `chat_usage_monthly.used`; free = probadita de por vida
 *     (`ai.chat_quota_trial` vs `users.chat_trial_used`).
 *  3. **Reserva TOCTOU-safe** (decisión 13, patrón StressPlan AUD-07): TX +
 *     `FOR UPDATE` sobre la fila de uso; el INSERT del mensaje del usuario ES la
 *     reserva. Si la IA falla después, `revertirReserva` deshace mensaje y cupo.
 *
 * El consumo NUNCA se cuenta desde `chat_messages` (decisión 14): borrar una
 * conversación no devuelve cupo. `owner_plan` no aparece acá (sin sesgo pago).
 */

/** El mes de facturación lo pone Postgres, no el proceso (mismo criterio Google). */
const MES = sql`to_char(current_date, 'YYYY-MM')`
const SKU = 'chat_messages'

export type CupoErrorCode = 'CHAT_PAUSADO' | 'TRIAL_AGOTADO' | 'CUPO_AGOTADO' | 'CONVERSACION_NO_ENCONTRADA'

/** Señaliza el motivo de rechazo desde dentro de la TX; la route mapea a HTTP. */
export class CupoError extends Error {
  constructor(readonly code: CupoErrorCode) {
    super(code)
    this.name = 'CupoError'
  }
}

export type Reserva = {
  messageId: string
  conversationId: string
  plan: ChatPlan
}

/**
 * Reserva el cupo y persiste el mensaje del usuario, todo en una TX (decisión 13).
 * Orden: tope global (503) → cupo del usuario (403) → incremento global → crear/
 * verificar conversación → INSERT del mensaje. Cualquier throw revierte la TX
 * entera, así que un 503/403 no deja mitad de trabajo hecho ni cuenta la llamada.
 *
 * El tope global va primero: es el kill switch de sistema y su 503 tiene
 * precedencia — si el chat está apagado para todos, esa es la respuesta honesta.
 */
export async function reservarCupo(args: {
  userId: string
  esPrem: boolean
  conversationId: string | null
  modo: ChatModo
  contenido: string
}): Promise<Reserva> {
  const { userId, esPrem, conversationId, modo, contenido } = args
  const plan: ChatPlan = esPrem ? 'premium' : 'trial'

  return db.transaction(async (tx) => {
    // 1. Tope global (decisión 15). Se asegura la fila del mes y se lockea, así
    // dos primeros-mensajes concurrentes no leen 0 los dos.
    const cap = await getChatMonthlyCap(tx)
    await tx
      .insert(aiApiUsage)
      .values({ month: MES as unknown as string, sku: SKU, count: 0 })
      .onConflictDoNothing()
    const [usoGlobal] = await tx
      .select({ count: aiApiUsage.count })
      .from(aiApiUsage)
      .where(and(sql`${aiApiUsage.month} = ${MES}`, eq(aiApiUsage.sku, SKU)))
      .for('update')
    if (cap <= 0 || (usoGlobal?.count ?? 0) >= cap) {
      throw new CupoError('CHAT_PAUSADO')
    }

    // 2. Cupo del usuario (decisión 5/6), con FOR UPDATE sobre la fila de uso.
    if (esPrem) {
      await tx
        .insert(chatUsageMonthly)
        .values({ userId, month: MES as unknown as string, used: 0 })
        .onConflictDoNothing()
      const [uso] = await tx
        .select({ used: chatUsageMonthly.used })
        .from(chatUsageMonthly)
        .where(and(eq(chatUsageMonthly.userId, userId), sql`${chatUsageMonthly.month} = ${MES}`))
        .for('update')

      const base = await getChatQuotaPremium(tx)
      const [grants] = await tx
        .select({ total: sql<number>`coalesce(sum(${chatQuotaGrants.amount}), 0)::int` })
        .from(chatQuotaGrants)
        .where(and(eq(chatQuotaGrants.userId, userId), sql`${chatQuotaGrants.month} = ${MES}`))
      const cupoEfectivo = base + (grants?.total ?? 0)

      if ((uso?.used ?? 0) >= cupoEfectivo) throw new CupoError('CUPO_AGOTADO')

      await tx
        .update(chatUsageMonthly)
        .set({ used: sql`${chatUsageMonthly.used} + 1` })
        .where(and(eq(chatUsageMonthly.userId, userId), sql`${chatUsageMonthly.month} = ${MES}`))
    } else {
      const [u] = await tx
        .select({ trial: users.chatTrialUsed })
        .from(users)
        .where(eq(users.id, userId))
        .for('update')
      const cupoTrial = await getChatQuotaTrial(tx)
      if ((u?.trial ?? 0) >= cupoTrial) throw new CupoError('TRIAL_AGOTADO')

      await tx
        .update(users)
        .set({ chatTrialUsed: sql`${users.chatTrialUsed} + 1` })
        .where(eq(users.id, userId))
    }

    // 3. Incremento global ANTES de la llamada (decisión 15).
    await tx
      .update(aiApiUsage)
      .set({ count: sql`${aiApiUsage.count} + 1` })
      .where(and(sql`${aiApiUsage.month} = ${MES}`, eq(aiApiUsage.sku, SKU)))

    // 4. Conversación: crear una nueva o verificar que la existente es del usuario.
    let convId = conversationId
    if (convId) {
      const [conv] = await tx
        .select({ id: chatConversations.id, userId: chatConversations.userId })
        .from(chatConversations)
        .where(eq(chatConversations.id, convId))
        .limit(1)
      if (!conv || conv.userId !== userId) throw new CupoError('CONVERSACION_NO_ENCONTRADA')
    } else {
      const [conv] = await tx
        .insert(chatConversations)
        .values({ userId, modo, titulo: contenido.slice(0, 60) })
        .returning({ id: chatConversations.id })
      convId = conv.id
    }

    // 5. INSERT del mensaje del usuario = la reserva (decisión 13).
    const [msg] = await tx
      .insert(chatMessages)
      .values({ conversationId: convId, role: 'user', content: contenido, planAtSend: plan })
      .returning({ id: chatMessages.id })

    return { messageId: msg.id, conversationId: convId, plan }
  })
}

/**
 * Revierte la reserva cuando la llamada a Anthropic falla (decisión 13, DoD): un
 * error nuestro o de la API no consume cupo del usuario. Deshace el contador y
 * borra el mensaje. **`ai_api_usage` NO se revierte** (decisión 15: contar de más
 * es tolerable, contar de menos es el peligro) — el gasto ya pudo haber ocurrido.
 */
export async function revertirReserva(args: {
  userId: string
  esPrem: boolean
  messageId: string
}): Promise<void> {
  const { userId, esPrem, messageId } = args
  await db.transaction(async (tx) => {
    if (esPrem) {
      await tx
        .update(chatUsageMonthly)
        .set({ used: sql`greatest(${chatUsageMonthly.used} - 1, 0)` })
        .where(and(eq(chatUsageMonthly.userId, userId), sql`${chatUsageMonthly.month} = ${MES}`))
    } else {
      await tx
        .update(users)
        .set({ chatTrialUsed: sql`greatest(${users.chatTrialUsed} - 1, 0)` })
        .where(eq(users.id, userId))
    }
    await tx.delete(chatMessages).where(eq(chatMessages.id, messageId))
  })
}

/**
 * Cupo efectivo y consumido del mes, para pintar "te quedan N" (F2) o mandarlo en
 * un evento SSE. Premium: setting + grants vs `used`. Free: trial vs `chat_trial_used`.
 */
export async function resumenCupo(
  userId: string,
  esPrem: boolean,
  database: DbOrTx = db,
): Promise<{ cupo: number; usados: number; restantes: number }> {
  if (esPrem) {
    const [base, grants, uso] = await Promise.all([
      getChatQuotaPremium(database),
      database
        .select({ total: sql<number>`coalesce(sum(${chatQuotaGrants.amount}), 0)::int` })
        .from(chatQuotaGrants)
        .where(and(eq(chatQuotaGrants.userId, userId), sql`${chatQuotaGrants.month} = ${MES}`)),
      database
        .select({ used: chatUsageMonthly.used })
        .from(chatUsageMonthly)
        .where(and(eq(chatUsageMonthly.userId, userId), sql`${chatUsageMonthly.month} = ${MES}`)),
    ])
    const cupo = base + (grants[0]?.total ?? 0)
    const usados = uso[0]?.used ?? 0
    return { cupo, usados, restantes: Math.max(0, cupo - usados) }
  }
  const [cupoTrial, u] = await Promise.all([
    getChatQuotaTrial(database),
    database.select({ trial: users.chatTrialUsed }).from(users).where(eq(users.id, userId)),
  ])
  const usados = u[0]?.trial ?? 0
  return { cupo: cupoTrial, usados, restantes: Math.max(0, cupoTrial - usados) }
}
