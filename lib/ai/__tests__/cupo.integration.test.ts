import 'dotenv/config'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { and, eq, inArray, like, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  aiApiUsage,
  appSettings,
  chatConversations,
  chatMessages,
  chatQuotaGrants,
  chatUsageMonthly,
  users,
} from '@/lib/db/schema'
import { getConfidenceThreshold } from '@/lib/db/settings'
import {
  CHAT_MONTHLY_CAP_KEY,
  CHAT_QUOTA_PREMIUM_KEY,
  CHAT_QUOTA_TRIAL_KEY,
} from '@/lib/ai/settings'
import { CupoError, resumenCupo, reservarCupo, revertirReserva } from '../cupo'

/**
 * El cupo del chat contra la base real (CHAT_IA, decisiones 5, 6, 13, 14, 15). Lo
 * que no ve un helper puro: el `FOR UPDATE` que serializa concurrencia, el tope
 * global como kill switch, los grants que suben el cupo sin tocar el plan, y que
 * borrar contenido no devuelve cupo.
 *
 * Baja los cupos vía `app_settings` para no tener que consumir 30 mensajes por
 * test, y restaura todo al terminar. Limpia sus usuarios.
 *
 * `ai_api_usage` (sku `chat_messages`) es la fila del **mes calendario real** —
 * el contador del kill switch global (decisión 15) que también alimenta el
 * tablero de COSTOS_ADMIN. Las reservas la incrementan y los tests la resetean
 * entre casos, pero borrarla de cuajo perdería el conteo real del mes. Por eso se
 * hace **snapshot en `beforeAll` y restore en `afterAll`**: la suite deja el
 * contador real exactamente como lo encontró.
 */

const PREFIJO = '__test_cupo__'
const EMAIL_PREM = '__test_cupo__prem@ejemplo.com'
const EMAIL_FREE = '__test_cupo__free@ejemplo.com'
const MES = sql`to_char(current_date, 'YYYY-MM')`

// Cupos chicos para el test (se restauran en afterAll).
const CUPO_PREM = 3
const CUPO_TRIAL = 2
const CAP_ALTO = 1_000_000

let hayDb = true
let premId = ''
let freeId = ''
const settingsOriginales = new Map<string, unknown>()
// Conteo real de `ai_api_usage` del mes en curso al arrancar (null = no había fila).
let usoGlobalOriginal: number | null = null

async function setSetting(key: string, value: unknown) {
  await db
    .insert(appSettings)
    .values({ key, value })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: sql`excluded.value` } })
}

async function snapshotSetting(key: string) {
  const [row] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, key))
  settingsOriginales.set(key, row?.value ?? null)
}

async function limpiarUsuarios() {
  await db.delete(users).where(like(users.email, `${PREFIJO}%`))
}

async function limpiarUsoGlobal() {
  await db.delete(aiApiUsage).where(and(sql`${aiApiUsage.month} = ${MES}`, eq(aiApiUsage.sku, 'chat_messages')))
}

async function snapshotUsoGlobal() {
  const [row] = await db
    .select({ count: aiApiUsage.count })
    .from(aiApiUsage)
    .where(and(sql`${aiApiUsage.month} = ${MES}`, eq(aiApiUsage.sku, 'chat_messages')))
  usoGlobalOriginal = row?.count ?? null
}

/** Borra lo que dejaron los tests y devuelve la fila real a su valor de arranque. */
async function restaurarUsoGlobal() {
  await limpiarUsoGlobal()
  if (usoGlobalOriginal !== null) {
    await db
      .insert(aiApiUsage)
      .values({ month: MES as unknown as string, sku: 'chat_messages', count: usoGlobalOriginal })
      .onConflictDoUpdate({
        target: [aiApiUsage.month, aiApiUsage.sku],
        set: { count: sql`excluded.count` },
      })
  }
}

async function usadosPremium(): Promise<number> {
  const [row] = await db
    .select({ used: chatUsageMonthly.used })
    .from(chatUsageMonthly)
    .where(and(eq(chatUsageMonthly.userId, premId), sql`${chatUsageMonthly.month} = ${MES}`))
  return row?.used ?? 0
}

beforeAll(async () => {
  try {
    await getConfidenceThreshold()
  } catch {
    hayDb = false
    return
  }
  for (const k of [CHAT_QUOTA_PREMIUM_KEY, CHAT_QUOTA_TRIAL_KEY, CHAT_MONTHLY_CAP_KEY]) {
    await snapshotSetting(k)
  }
  await snapshotUsoGlobal()
  await limpiarUsuarios()
  const [prem] = await db
    .insert(users)
    .values({ email: EMAIL_PREM, name: 'Prem', emailVerified: true, plan: 'premium' })
    .returning({ id: users.id })
  const [free] = await db
    .insert(users)
    .values({ email: EMAIL_FREE, name: 'Free', emailVerified: true })
    .returning({ id: users.id })
  premId = prem.id
  freeId = free.id
})

afterAll(async () => {
  if (!hayDb) return
  for (const [k, v] of settingsOriginales) {
    if (v !== null) await setSetting(k, v)
  }
  await limpiarUsuarios()
  await restaurarUsoGlobal()
})

beforeEach(async () => {
  if (!hayDb) return
  // Estado limpio de cupo por test + cupos chicos y tope holgado.
  await db.delete(chatConversations).where(inArray(chatConversations.userId, [premId, freeId]))
  await db.delete(chatUsageMonthly).where(inArray(chatUsageMonthly.userId, [premId, freeId]))
  await db.delete(chatQuotaGrants).where(inArray(chatQuotaGrants.userId, [premId, freeId]))
  await db.update(users).set({ chatTrialUsed: 0 }).where(inArray(users.id, [premId, freeId]))
  await limpiarUsoGlobal()
  await setSetting(CHAT_QUOTA_PREMIUM_KEY, CUPO_PREM)
  await setSetting(CHAT_QUOTA_TRIAL_KEY, CUPO_TRIAL)
  await setSetting(CHAT_MONTHLY_CAP_KEY, CAP_ALTO)
})

const reservaPrem = () =>
  reservarCupo({ userId: premId, esPrem: true, conversationId: null, modo: 'chat', contenido: 'hola' })
const reservaFree = () =>
  reservarCupo({ userId: freeId, esPrem: false, conversationId: null, modo: 'chat', contenido: 'hola' })

describe.runIf(process.env.DATABASE_URL)('cupo del chat IA', () => {
  it('premium: consume hasta el cupo y el siguiente da CUPO_AGOTADO', async () => {
    for (let i = 0; i < CUPO_PREM; i++) await reservaPrem()
    await expect(reservaPrem()).rejects.toMatchObject({ code: 'CUPO_AGOTADO' })
    expect(await usadosPremium()).toBe(CUPO_PREM)
  })

  it('free: la probadita se agota y el siguiente da TRIAL_AGOTADO', async () => {
    for (let i = 0; i < CUPO_TRIAL; i++) await reservaFree()
    await expect(reservaFree()).rejects.toMatchObject({ code: 'TRIAL_AGOTADO' })
    const [u] = await db.select({ t: users.chatTrialUsed }).from(users).where(eq(users.id, freeId))
    expect(u.t).toBe(CUPO_TRIAL)
  })

  it('concurrencia: N reservas simultáneas no evaden el cupo (FOR UPDATE)', async () => {
    const intentos = CUPO_PREM + 4
    const resultados = await Promise.allSettled(Array.from({ length: intentos }, () => reservaPrem()))
    const ok = resultados.filter((r) => r.status === 'fulfilled').length
    const agotado = resultados.filter(
      (r) => r.status === 'rejected' && (r.reason as CupoError).code === 'CUPO_AGOTADO',
    ).length
    expect(ok).toBe(CUPO_PREM)
    expect(agotado).toBe(intentos - CUPO_PREM)
    expect(await usadosPremium()).toBe(CUPO_PREM)
  })

  it('un grant sube el cupo efectivo del mes sin tocar users.plan', async () => {
    for (let i = 0; i < CUPO_PREM; i++) await reservaPrem()
    await expect(reservaPrem()).rejects.toMatchObject({ code: 'CUPO_AGOTADO' })

    await db.insert(chatQuotaGrants).values({
      userId: premId,
      month: MES as unknown as string,
      amount: 5,
      reason: 'test-grant',
    })
    // Ahora hay cupo de nuevo.
    await expect(reservaPrem()).resolves.toMatchObject({ plan: 'premium' })
    const [u] = await db.select({ plan: users.plan }).from(users).where(eq(users.id, premId))
    expect(u.plan).toBe('premium') // intacto
    const resumen = await resumenCupo(premId, true)
    expect(resumen.cupo).toBe(CUPO_PREM + 5)
  })

  it('tope global en 0 ⇒ CHAT_PAUSADO sin incrementar ai_api_usage', async () => {
    await setSetting(CHAT_MONTHLY_CAP_KEY, 0)
    await expect(reservaPrem()).rejects.toMatchObject({ code: 'CHAT_PAUSADO' })
    const [uso] = await db
      .select({ count: aiApiUsage.count })
      .from(aiApiUsage)
      .where(and(sql`${aiApiUsage.month} = ${MES}`, eq(aiApiUsage.sku, 'chat_messages')))
    expect(uso?.count ?? 0).toBe(0)
  })

  it('revertir una reserva devuelve el cupo y borra el mensaje', async () => {
    const reserva = await reservaPrem()
    expect(await usadosPremium()).toBe(1)
    await revertirReserva({ userId: premId, esPrem: true, messageId: reserva.messageId })
    expect(await usadosPremium()).toBe(0)
    const [msg] = await db.select({ id: chatMessages.id }).from(chatMessages).where(eq(chatMessages.id, reserva.messageId))
    expect(msg).toBeUndefined()
  })

  it('borrar la conversación NO devuelve cupo (decisión 14)', async () => {
    const reserva = await reservaPrem()
    expect(await usadosPremium()).toBe(1)
    await db.delete(chatConversations).where(eq(chatConversations.id, reserva.conversationId))
    // La cascada borró los mensajes, pero el contador queda.
    expect(await usadosPremium()).toBe(1)
  })
})
