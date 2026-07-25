import 'dotenv/config'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Solo se mockean las llamadas de RED a MP; la lógica pura (mapeo de estados,
// período) queda real vía importOriginal.
vi.mock('@/lib/billing/mercadopago', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/billing/mercadopago')>()
  return {
    ...actual,
    getAuthorizedPayment: vi.fn(),
    getPreapproval: vi.fn(),
    cancelPreapproval: vi.fn(),
  }
})

import { db } from '@/lib/db'
import { subscriptions, subscriptionPayments, users } from '@/lib/db/schema'
import { getAuthorizedPayment, getPreapproval } from '@/lib/billing/mercadopago'
import { aplicarPagoAutorizado } from '@/lib/billing/renovacion'
import { reconciliarVencimiento } from '@/lib/billing/vencimiento'

/**
 * Cobro recurrente y vencimiento contra la base (MONETIZACION F2, DoD):
 * idempotencia por `authorized_payment_id` (guard UNIQUE), renovación rechazada
 * que conserva el acceso, y lazy check que baja el flag adelantando fechas.
 */

const mockAuthPayment = vi.mocked(getAuthorizedPayment)
const mockPreapproval = vi.mocked(getPreapproval)

const dia = 24 * 60 * 60 * 1000

describe.runIf(process.env.DATABASE_URL)('renovación y vencimiento (F2)', () => {
  let userId: string
  const email = `qa-mp-${Date.now()}-${Math.round(performance.now())}@qa.local`
  const preapprovalId = `PA-${email}`

  beforeEach(async () => {
    const [u] = await db.insert(users).values({ email, plan: 'free' }).returning()
    userId = u.id
  })

  afterEach(async () => {
    // Borra el usuario (cascade → subscriptions → payments).
    await db.delete(users).where(eq(users.id, userId))
    vi.clearAllMocks()
  })

  async function crearSubB2C(overrides: Partial<typeof subscriptions.$inferInsert> = {}) {
    const now = new Date()
    const [sub] = await db
      .insert(subscriptions)
      .values({
        userId,
        placeId: null,
        status: 'active',
        mpPreapprovalId: preapprovalId,
        amountArs: 7000,
        currentPeriodStart: now,
        currentPeriodEnd: now,
        ...overrides,
      })
      .returning()
    return sub
  }

  it('renueva una vez y es idempotente ante el mismo authorized_payment_id', async () => {
    const sub = await crearSubB2C()
    const authId = `AP-${preapprovalId}`
    const next = new Date(Date.now() + 30 * dia).toISOString()
    mockAuthPayment.mockResolvedValue({
      id: authId,
      preapproval_id: preapprovalId,
      status: 'processed',
      payment: { status: 'approved' },
    })
    mockPreapproval.mockResolvedValue({ id: preapprovalId, status: 'authorized', next_payment_date: next })

    // Primer cobro: renueva.
    expect(await aplicarPagoAutorizado(authId)).toBe('renewed')

    const pagos1 = await db
      .select()
      .from(subscriptionPayments)
      .where(eq(subscriptionPayments.subscriptionId, sub.id))
    expect(pagos1).toHaveLength(1)

    const [u1] = await db.select({ plan: users.plan }).from(users).where(eq(users.id, userId))
    expect(u1.plan).toBe('premium') // flag arriba

    const [s1] = await db.select().from(subscriptions).where(eq(subscriptions.id, sub.id))
    const finTrasPrimero = s1.currentPeriodEnd.getTime()

    // Replay del mismo id: duplicate, sin doble pago ni doble extensión.
    expect(await aplicarPagoAutorizado(authId)).toBe('duplicate')
    const pagos2 = await db
      .select()
      .from(subscriptionPayments)
      .where(eq(subscriptionPayments.subscriptionId, sub.id))
    expect(pagos2).toHaveLength(1)
    const [s2] = await db.select().from(subscriptions).where(eq(subscriptions.id, sub.id))
    expect(s2.currentPeriodEnd.getTime()).toBe(finTrasPrimero)
  })

  it('renovación rechazada → past_due y el acceso se conserva', async () => {
    const sub = await crearSubB2C()
    // Simulamos que ya estaba premium (una renovación previa dejó el flag arriba).
    await db.update(users).set({ plan: 'premium' }).where(eq(users.id, userId))
    const authId = `AP-rej-${preapprovalId}`
    mockAuthPayment.mockResolvedValue({
      id: authId,
      preapproval_id: preapprovalId,
      status: 'processed',
      payment: { status: 'rejected' },
    })

    expect(await aplicarPagoAutorizado(authId)).toBe('past_due')

    const [s] = await db.select().from(subscriptions).where(eq(subscriptions.id, sub.id))
    expect(s.status).toBe('past_due')
    const [u] = await db.select({ plan: users.plan }).from(users).where(eq(users.id, userId))
    expect(u.plan).toBe('premium') // acceso intacto durante los reintentos
  })

  it('cancelación diferida vencida → baja a free sin webhook (lazy)', async () => {
    await db.update(users).set({ plan: 'premium' }).where(eq(users.id, userId))
    const sub = await crearSubB2C({
      cancelAtPeriodEnd: true,
      currentPeriodEnd: new Date(Date.now() - 1 * dia), // ya venció
    })

    await reconciliarVencimiento(sub)

    const [s] = await db.select().from(subscriptions).where(eq(subscriptions.id, sub.id))
    expect(s.status).toBe('canceled')
    const [u] = await db.select({ plan: users.plan }).from(users).where(eq(users.id, userId))
    expect(u.plan).toBe('free')
  })

  it('período vencido + gracia + MP dice cancelled → free', async () => {
    await db.update(users).set({ plan: 'premium' }).where(eq(users.id, userId))
    const sub = await crearSubB2C({
      currentPeriodEnd: new Date(Date.now() - 4 * dia), // vencido y pasada la gracia de 3 días
    })
    mockPreapproval.mockResolvedValue({ id: preapprovalId, status: 'cancelled' })

    await reconciliarVencimiento(sub)

    const [s] = await db.select().from(subscriptions).where(eq(subscriptions.id, sub.id))
    expect(s.status).toBe('canceled')
    const [u] = await db.select({ plan: users.plan }).from(users).where(eq(users.id, userId))
    expect(u.plan).toBe('free')
  })

  it('no baja el flag dentro de la gracia (período recién vencido)', async () => {
    await db.update(users).set({ plan: 'premium' }).where(eq(users.id, userId))
    const sub = await crearSubB2C({
      currentPeriodEnd: new Date(Date.now() - 1 * dia), // vencido hace 1 día, dentro de la gracia
    })

    await reconciliarVencimiento(sub)

    const [u] = await db.select({ plan: users.plan }).from(users).where(eq(users.id, userId))
    expect(u.plan).toBe('premium') // todavía no se reconcila
    expect(mockPreapproval).not.toHaveBeenCalled()
  })
})
