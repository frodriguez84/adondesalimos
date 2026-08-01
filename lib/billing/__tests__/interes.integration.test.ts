import 'dotenv/config'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { eq, like } from 'drizzle-orm'
import { db } from '@/lib/db'
import { placeClaims, places, premiumInterest, users } from '@/lib/db/schema'
import { getConfidenceThreshold } from '@/lib/db/settings'
import { contarInteresados, registrarInteres, tieneInteres } from '../interes'

/**
 * "Avisame cuando abra" contra la base (DEPLOY, decisión 6). Lo que ningún helper
 * puro puede probar, y que es justo lo que hace útil al contador:
 *
 * - el **dedupe B2C** — el caso que un `unique(user_id, place_id)` común dejaría
 *   pasar, porque en Postgres `NULL ≠ NULL`,
 * - el dedupe B2B es **por lugar**: dos lugares del mismo dueño son dos señales,
 * - un lugar **ajeno** no se puede anotar (el número decide un gasto).
 */

const PREFIJO = '__test_interes__'
const EMAIL = '__test_interes__duenio@ejemplo.com'
const EMAIL_AJENO = '__test_interes__ajeno@ejemplo.com'

let hayDb = true
let userId = ''
let ajenoId = ''
let lugares: string[] = []

async function limpiar() {
  await db.delete(users).where(like(users.email, `${PREFIJO}%`))
  await db.delete(places).where(like(places.name, `${PREFIJO}%`))
}

beforeAll(async () => {
  try {
    await getConfidenceThreshold()
  } catch {
    hayDb = false
    return
  }
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
})

afterAll(async () => {
  if (hayDb) await limpiar()
})

beforeEach(async () => {
  if (!hayDb) return
  await db.delete(premiumInterest).where(eq(premiumInterest.userId, userId))
  await db.delete(premiumInterest).where(eq(premiumInterest.userId, ajenoId))
  await db.delete(places).where(like(places.name, `${PREFIJO}%`))

  const insertados = await db
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
  lugares = insertados.map((p) => p.id)

  // El dueño reclamó y le aprobaron el lugar 0 — el gate de la señal B2B.
  await db.insert(placeClaims).values({
    placeId: lugares[0],
    userId,
    kind: 'claim',
    status: 'approved',
  })
})

describe.skipIf(!process.env.DATABASE_URL)('interés en el premium', () => {
  it('dos clicks B2C dejan UNA fila (índice único parcial, no NULL ≠ NULL)', async () => {
    if (!hayDb) return
    const primera = await registrarInteres(userId, {})
    const segunda = await registrarInteres(userId, {})

    expect(primera.ok && primera.data.nuevo).toBe(true)
    expect(segunda.ok && segunda.data.nuevo).toBe(false)

    const filas = await db
      .select()
      .from(premiumInterest)
      .where(eq(premiumInterest.userId, userId))
    expect(filas).toHaveLength(1)
    expect(filas[0].placeId).toBeNull()
  })

  it('el dedupe B2B es por lugar: otro lugar del mismo dueño es otra señal', async () => {
    if (!hayDb) return
    await db.insert(placeClaims).values({
      placeId: lugares[1],
      userId,
      kind: 'claim',
      status: 'approved',
    })

    const a = await registrarInteres(userId, { placeId: lugares[0] })
    const repetida = await registrarInteres(userId, { placeId: lugares[0] })
    const b = await registrarInteres(userId, { placeId: lugares[1] })

    expect(a.ok && a.data.nuevo).toBe(true)
    expect(repetida.ok && repetida.data.nuevo).toBe(false)
    expect(b.ok && b.data.nuevo).toBe(true)

    const filas = await db
      .select()
      .from(premiumInterest)
      .where(eq(premiumInterest.userId, userId))
    expect(filas).toHaveLength(2)
  })

  it('la señal B2C y la del lugar conviven: son dos intenciones distintas', async () => {
    if (!hayDb) return
    await registrarInteres(userId, {})
    await registrarInteres(userId, { placeId: lugares[0] })

    expect(await tieneInteres(userId)).toBe(true)
    expect(await tieneInteres(userId, lugares[0])).toBe(true)
    expect(await tieneInteres(userId, lugares[1])).toBe(false)
  })

  it('no se puede anotar un lugar ajeno', async () => {
    if (!hayDb) return
    const r = await registrarInteres(ajenoId, { placeId: lugares[0] })

    expect(r.ok).toBe(false)
    expect(!r.ok && r.code).toBe('NO_ES_DUENO')
    const filas = await db
      .select()
      .from(premiumInterest)
      .where(eq(premiumInterest.userId, ajenoId))
    expect(filas).toHaveLength(0)
  })

  it('el conteo del admin cuenta filas, no clicks', async () => {
    if (!hayDb) return
    const antes = await contarInteresados()
    await registrarInteres(userId, {})
    await registrarInteres(userId, {})
    expect(await contarInteresados()).toBe(antes + 1)
  })
})
