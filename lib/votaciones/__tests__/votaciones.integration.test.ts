import 'dotenv/config'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { and, eq, like } from 'drizzle-orm'
import { db } from '@/lib/db'
import { pollOptions, polls, places, users } from '@/lib/db/schema'
import { getConfidenceThreshold } from '@/lib/db/settings'
import { crearVotacion } from '../acciones'

/**
 * `crearVotacion` contra la base (F1). Lo que no se puede verificar con un helper
 * puro:
 *
 * - **solo lugares publicados** entran a la shortlist (decisión 12),
 * - el **gate "1 activa" server-side** (decisión 16): un free con una activa no
 *   abre otra; premium sí; una **expirada no bloquea** (decisión 11),
 * - las opciones se guardan con su `position`.
 */

const PREFIJO = '__test_votac__'
const EMAIL_FREE = '__test_votac__free@ejemplo.com'
const EMAIL_PREMIUM = '__test_votac__premium@ejemplo.com'
const OBELISCO = { lat: -34.6037, lng: -58.3816 }

let hayDb = true
let freeId = ''
let premiumId = ''
let pub: string[] = []
let invisibleId = ''

async function limpiar() {
  // Orden importa: `poll_options.place_id` NO cascadea (un place no se borra por
  // debajo de una votación). Borrar los usuarios primero se lleva sus polls por
  // cascade (creator_id) → poll_options → poll_votes, y recién ahí los places
  // quedan sin referencias.
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
      { email: EMAIL_FREE, name: 'Free', emailVerified: true, plan: 'free' },
      { email: EMAIL_PREMIUM, name: 'Premium', emailVerified: true, plan: 'premium' },
    ])
    .returning({ id: users.id, email: users.email })

  freeId = insertados.find((u) => u.email === EMAIL_FREE)!.id
  premiumId = insertados.find((u) => u.email === EMAIL_PREMIUM)!.id
})

afterAll(async () => {
  if (hayDb) await limpiar()
})

beforeEach(async () => {
  if (!hayDb) return
  await db.delete(polls).where(eq(polls.creatorId, freeId))
  await db.delete(polls).where(eq(polls.creatorId, premiumId))
  await db.delete(places).where(like(places.name, `${PREFIJO}%`))

  // 3 lugares publicados (confidence alta) + 1 invisible (confidence baja, sin override).
  const publicados = await db
    .insert(places)
    .values(
      [0, 1, 2].map((i) => ({
        source: 'overture' as const,
        name: `${PREFIJO} Bar ${i}`,
        lat: OBELISCO.lat,
        lng: OBELISCO.lng,
        confidence: 0.9,
      })),
    )
    .returning({ id: places.id })
  pub = publicados.map((p) => p.id)

  const [inv] = await db
    .insert(places)
    .values({
      source: 'overture',
      name: `${PREFIJO} Invisible`,
      lat: OBELISCO.lat,
      lng: OBELISCO.lng,
      confidence: 0.01,
    })
    .returning({ id: places.id })
  invisibleId = inv.id
})

describe.runIf(process.env.DATABASE_URL)('crear votación — lugares publicados', () => {
  it('feliz: 3 publicados ⇒ token + opciones con position', async () => {
    const r = await crearVotacion(freeId, { placeIds: pub, title: 'Viernes' })
    expect(r.ok).toBe(true)
    if (!r.ok) return

    expect(r.data.token).toMatch(/^[A-Za-z0-9_-]{16,}$/)

    const opciones = await db
      .select({ placeId: pollOptions.placeId, position: pollOptions.position })
      .from(pollOptions)
      .where(eq(pollOptions.pollId, r.data.pollId))
      .orderBy(pollOptions.position)
    expect(opciones.map((o) => o.placeId)).toEqual(pub)
    expect(opciones.map((o) => o.position)).toEqual([0, 1, 2])
  })

  it('un lugar invisible en la shortlist ⇒ LUGAR_NO_PUBLICADO, no se crea nada', async () => {
    const r = await crearVotacion(freeId, { placeIds: [pub[0], invisibleId] })
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.code).toBe('LUGAR_NO_PUBLICADO')

    const quedan = await db.select({ id: polls.id }).from(polls).where(eq(polls.creatorId, freeId))
    expect(quedan).toHaveLength(0)
  })
})

describe.runIf(process.env.DATABASE_URL)('gate "1 activa" — server-side (decisión 16)', () => {
  it('free con una activa no puede abrir otra', async () => {
    const primera = await crearVotacion(freeId, { placeIds: [pub[0], pub[1]] })
    expect(primera.ok).toBe(true)

    const segunda = await crearVotacion(freeId, { placeIds: [pub[1], pub[2]] })
    expect(segunda.ok).toBe(false)
    expect(segunda.ok === false && segunda.code).toBe('LIMITE_ACTIVA')
  })

  it('tras cerrar la primera, la segunda se crea', async () => {
    const primera = await crearVotacion(freeId, { placeIds: [pub[0], pub[1]] })
    expect(primera.ok).toBe(true)
    if (!primera.ok) return

    await db.update(polls).set({ status: 'closed' }).where(eq(polls.id, primera.data.pollId))

    const segunda = await crearVotacion(freeId, { placeIds: [pub[1], pub[2]] })
    expect(segunda.ok).toBe(true)
  })

  it('una votación EXPIRADA no bloquea (decisión 11): sigue open pero venció', async () => {
    const primera = await crearVotacion(freeId, { placeIds: [pub[0], pub[1]] })
    expect(primera.ok).toBe(true)
    if (!primera.ok) return

    // La empujamos al pasado: status sigue 'open', expires_at ya pasó.
    await db
      .update(polls)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(polls.id, primera.data.pollId))

    const segunda = await crearVotacion(freeId, { placeIds: [pub[1], pub[2]] })
    expect(segunda.ok, 'una expirada no cuenta como activa').toBe(true)
  })

  it('premium abre varias activas sin bloqueo', async () => {
    const a = await crearVotacion(premiumId, { placeIds: [pub[0], pub[1]] })
    const b = await crearVotacion(premiumId, { placeIds: [pub[1], pub[2]] })
    expect(a.ok).toBe(true)
    expect(b.ok).toBe(true)

    const activas = await db
      .select({ id: polls.id })
      .from(polls)
      .where(and(eq(polls.creatorId, premiumId), eq(polls.status, 'open')))
    expect(activas.length).toBeGreaterThanOrEqual(2)
  })
})
