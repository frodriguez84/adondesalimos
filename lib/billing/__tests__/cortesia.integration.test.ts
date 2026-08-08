import 'dotenv/config'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { eq, like } from 'drizzle-orm'
import { db } from '@/lib/db'
import { placeClaims, places, planGrants, subscriptions, users } from '@/lib/db/schema'
import { getConfidenceThreshold } from '@/lib/db/settings'
import { otorgarCortesia, revocarCortesia } from '../subscriptions'

/**
 * El premium de cortesía contra la base (ADMIN_USUARIOS, `FB-01`). Lo que se prueba
 * acá es exactamente lo que un helper puro no puede: que el flag y la bitácora se
 * muevan **juntos**, y que los tres rechazos no escriban nada.
 *
 * Los tres rechazos son las tres reglas del spec:
 *  - `TIENE_SUSCRIPCION` (decisión 3) — lo que mantiene válido el discriminante
 *    "premium sin fila viva = cortesía" que ya está en producción,
 *  - `NO_ES_DUENO` (decisión 5) — el eje B2B es sobre lugares con reclamo aprobado,
 *  - motivo corto (decisión 6) — validado **en la función**, no solo en la UI.
 *
 * Limpieza acotada al prefijo: `plan_grants` se va por `cascade` con el usuario.
 * Nada de borrar tablas enteras (lección del test de cupo).
 */

const PREFIJO = '__test_cortesia__'
const EMAIL = '__test_cortesia__duenio@ejemplo.com'
const EMAIL_AJENO = '__test_cortesia__ajeno@ejemplo.com'
const ADMIN = 'admin@ejemplo.com'
const OPTS = { motivo: 'beta testers', adminEmail: ADMIN }

let hayDb = true
let userId = ''
let ajenoId = ''
let lugares: string[] = []

async function limpiar() {
  await db.delete(subscriptions).where(like(subscriptions.mpPreapprovalId, `${PREFIJO}%`))
  await db.delete(users).where(like(users.email, `${PREFIJO}%`))
  await db.delete(places).where(like(places.name, `${PREFIJO}%`))
}

async function bitacora(uid = userId) {
  return db.select().from(planGrants).where(eq(planGrants.userId, uid))
}

async function planDe(uid = userId) {
  const [u] = await db.select({ plan: users.plan }).from(users).where(eq(users.id, uid))
  return u?.plan
}

async function planDelLugar(placeId: string) {
  const [p] = await db.select({ plan: places.ownerPlan }).from(places).where(eq(places.id, placeId))
  return p?.plan
}

beforeAll(async () => {
  try {
    await getConfidenceThreshold()
  } catch {
    hayDb = false
    return
  }
  await limpiar()
})

afterAll(async () => {
  if (hayDb) await limpiar()
})

beforeEach(async () => {
  if (!hayDb) return
  await limpiar()

  const insertados = await db
    .insert(users)
    .values([
      { email: EMAIL, name: 'Dueño', emailVerified: true },
      { email: EMAIL_AJENO, name: 'Ajeno', emailVerified: true },
    ])
    .returning({ id: users.id, email: users.email })
  userId = insertados.find((u) => u.email === EMAIL)!.id
  ajenoId = insertados.find((u) => u.email === EMAIL_AJENO)!.id

  const creados = await db
    .insert(places)
    .values(
      [0, 1].map((i) => ({
        name: `${PREFIJO}lugar ${i}`,
        source: 'overture' as const,
        confidence: 0.9,
        lat: -34.6037,
        lng: -58.3816,
      })),
    )
    .returning({ id: places.id })
  lugares = creados.map((p) => p.id)

  // El lugar 0 es del dueño (reclamo aprobado); el 1 no es de nadie.
  await db
    .insert(placeClaims)
    .values({ placeId: lugares[0], userId, kind: 'claim', status: 'approved' })
})

describe.skipIf(!process.env.DATABASE_URL)('premium de cortesía', () => {
  it('otorgar B2C sube el flag y deja la bitácora, en la misma operación', async () => {
    if (!hayDb) return
    const r = await otorgarCortesia({ userId, placeId: null }, OPTS)

    expect(r.ok && r.data.yaEstaba).toBe(false)
    expect(await planDe()).toBe('premium')

    const filas = await bitacora()
    expect(filas).toHaveLength(1)
    expect(filas[0].accion).toBe('grant')
    expect(filas[0].motivo).toBe('beta testers')
    expect(filas[0].grantedBy).toBe(ADMIN)
    expect(filas[0].placeId).toBeNull()
  })

  it('otorgar dos veces deja UNA fila y la segunda avisa que ya estaba', async () => {
    if (!hayDb) return
    const primera = await otorgarCortesia({ userId, placeId: null }, OPTS)
    const segunda = await otorgarCortesia({ userId, placeId: null }, OPTS)

    expect(primera.ok && primera.data.yaEstaba).toBe(false)
    expect(segunda.ok && segunda.data.yaEstaba).toBe(true)
    expect(await bitacora()).toHaveLength(1)
  })

  it('revocar vuelve a free y AGREGA una fila: la bitácora es append-only', async () => {
    if (!hayDb) return
    await otorgarCortesia({ userId, placeId: null }, OPTS)
    const r = await revocarCortesia({ userId, placeId: null }, { ...OPTS, motivo: 'se fue de la beta' })

    expect(r.ok && r.data.yaEstaba).toBe(false)
    expect(await planDe()).toBe('free')

    const filas = await bitacora()
    expect(filas).toHaveLength(2)
    expect(filas.map((f) => f.accion).sort()).toEqual(['grant', 'revoke'])
  })

  it('revocar a alguien que ya está en free no escribe nada ni falla', async () => {
    if (!hayDb) return
    const r = await revocarCortesia({ userId, placeId: null }, OPTS)

    expect(r.ok && r.data.yaEstaba).toBe(true)
    expect(await planDe()).toBe('free')
    expect(await bitacora()).toHaveLength(0)
  })

  it('otorgar B2B sube el plan de ESE lugar, no el del usuario', async () => {
    if (!hayDb) return
    const r = await otorgarCortesia({ userId, placeId: lugares[0] }, OPTS)

    expect(r.ok && r.data.yaEstaba).toBe(false)
    expect(await planDelLugar(lugares[0])).toBe('paid')
    expect(await planDe()).toBe('free')

    const filas = await bitacora()
    expect(filas).toHaveLength(1)
    expect(filas[0].placeId).toBe(lugares[0])
  })

  it('un lugar que el usuario no tiene aprobado: NO_ES_DUENO y no escribe nada', async () => {
    if (!hayDb) return
    const r = await otorgarCortesia({ userId, placeId: lugares[1] }, OPTS)

    expect(r.ok).toBe(false)
    expect(!r.ok && r.code).toBe('NO_ES_DUENO')
    expect(await planDelLugar(lugares[1])).toBe('free')
    expect(await bitacora()).toHaveLength(0)
  })

  it('el lugar de otro tampoco, aunque el otro sí lo tenga aprobado', async () => {
    if (!hayDb) return
    const r = await otorgarCortesia({ userId: ajenoId, placeId: lugares[0] }, OPTS)

    expect(!r.ok && r.code).toBe('NO_ES_DUENO')
    expect(await planDelLugar(lugares[0])).toBe('free')
    expect(await bitacora(ajenoId)).toHaveLength(0)
  })

  it('con suscripción B2C viva no se toca nada, en ninguna dirección', async () => {
    if (!hayDb) return
    await db.insert(subscriptions).values({
      userId,
      placeId: null,
      status: 'active',
      mpPreapprovalId: `${PREFIJO}b2c`,
      amountArs: 7000,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(),
    })

    const dar = await otorgarCortesia({ userId, placeId: null }, OPTS)
    const sacar = await revocarCortesia({ userId, placeId: null }, OPTS)

    expect(!dar.ok && dar.code).toBe('TIENE_SUSCRIPCION')
    expect(!sacar.ok && sacar.code).toBe('TIENE_SUSCRIPCION')
    expect(await planDe()).toBe('free')
    expect(await bitacora()).toHaveLength(0)
  })

  it('una cancelada no es una suscripción viva: la cortesía se puede dar', async () => {
    if (!hayDb) return
    await db.insert(subscriptions).values({
      userId,
      placeId: null,
      status: 'canceled',
      mpPreapprovalId: `${PREFIJO}vieja`,
      amountArs: 7000,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(),
      canceledAt: new Date(),
    })

    const r = await otorgarCortesia({ userId, placeId: null }, OPTS)

    expect(r.ok && r.data.yaEstaba).toBe(false)
    expect(await planDe()).toBe('premium')
  })

  it('con suscripción B2B viva el lugar no se toca', async () => {
    if (!hayDb) return
    await db.insert(subscriptions).values({
      userId,
      placeId: lugares[0],
      status: 'active',
      mpPreapprovalId: `${PREFIJO}b2b`,
      amountArs: 12000,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(),
    })

    const r = await otorgarCortesia({ userId, placeId: lugares[0] }, OPTS)

    expect(!r.ok && r.code).toBe('TIENE_SUSCRIPCION')
    expect(await planDelLugar(lugares[0])).toBe('free')
    expect(await bitacora()).toHaveLength(0)
  })

  it('el motivo es obligatorio y se valida en la función, no en la UI', async () => {
    if (!hayDb) return
    const vacio = await otorgarCortesia({ userId, placeId: null }, { ...OPTS, motivo: '' })
    const espacios = await otorgarCortesia({ userId, placeId: null }, { ...OPTS, motivo: '   ' })
    const corto = await otorgarCortesia({ userId, placeId: null }, { ...OPTS, motivo: 'ok' })
    const largo = await revocarCortesia({ userId, placeId: null }, { ...OPTS, motivo: 'x'.repeat(281) })

    expect(!vacio.ok && vacio.code).toBe('MOTIVO_CORTO')
    expect(!espacios.ok && espacios.code).toBe('MOTIVO_CORTO')
    expect(!corto.ok && corto.code).toBe('MOTIVO_CORTO')
    expect(!largo.ok && largo.code).toBe('MOTIVO_LARGO')
    expect(await planDe()).toBe('free')
    expect(await bitacora()).toHaveLength(0)
  })

  it('una cuenta que no existe no rompe: NO_EXISTE', async () => {
    if (!hayDb) return
    const r = await otorgarCortesia(
      { userId: '00000000-0000-0000-0000-000000000000', placeId: null },
      OPTS,
    )
    expect(!r.ok && r.code).toBe('NO_EXISTE')
  })
})
