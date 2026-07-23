import 'dotenv/config'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { eq, like } from 'drizzle-orm'
import { db } from '@/lib/db'
import { pollOptions, pollVotes, polls, places, users } from '@/lib/db/schema'
import { getConfidenceThreshold } from '@/lib/db/settings'
import { crearVotacion, votar } from '../acciones'
import { getResultados, getVotacionPublica, votoDelDispositivo } from '../query'

/**
 * Votar contra la base (F2). Lo que no ve un helper puro:
 *
 * - **un voto por dispositivo**, cambiable (upsert por `(poll_id, voter_token)`),
 * - **la IP no es la identidad**: dos cookies distintas cuentan 2 (decisión 7),
 * - votar en una cerrada/expirada rebota (decisión / edge case),
 * - **expiración lazy**: una `open` vencida se lee cerrada, sin cron (decisión 11),
 * - el conteo es **agregado por opción**, sin exponer el token (decisión 21).
 */

const PREFIJO = '__test_voto__'
const EMAIL = '__test_voto__creador@ejemplo.com'
const OBELISCO = { lat: -34.6037, lng: -58.3816 }

let hayDb = true
let creadorId = ''
let pub: string[] = []
let token = ''
let pollId = ''
let opciones: { optionId: string; placeId: string }[] = []

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
  const [u] = await db
    .insert(users)
    .values({ email: EMAIL, name: 'Creador', emailVerified: true })
    .returning({ id: users.id })
  creadorId = u.id
})

afterAll(async () => {
  if (hayDb) await limpiar()
})

beforeEach(async () => {
  if (!hayDb) return
  await db.delete(polls).where(eq(polls.creatorId, creadorId))
  await db.delete(places).where(like(places.name, `${PREFIJO}%`))

  const insertados = await db
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
  pub = insertados.map((p) => p.id)

  const creada = await crearVotacion(creadorId, { placeIds: pub, title: 'Test' })
  if (!creada.ok) throw new Error('setup: no se creó la votación')
  token = creada.data.token
  pollId = creada.data.pollId

  opciones = await db
    .select({ optionId: pollOptions.id, placeId: pollOptions.placeId })
    .from(pollOptions)
    .where(eq(pollOptions.pollId, pollId))
    .orderBy(pollOptions.position)
})

describe.runIf(process.env.DATABASE_URL)('voto anónimo por dispositivo', () => {
  it('un dispositivo vota y el conteo de esa opción sube', async () => {
    const r = await votar(token, opciones[0].optionId, 'device-A')
    expect(r.ok).toBe(true)

    const res = await getResultados(token)
    expect(res!.totalVotos).toBe(1)
    expect(res!.opciones.find((o) => o.optionId === opciones[0].optionId)!.votos).toBe(1)
  })

  it('la IP no es la identidad: dos cookies distintas cuentan 2 (decisión 7)', async () => {
    await votar(token, opciones[0].optionId, 'device-A')
    await votar(token, opciones[0].optionId, 'device-B')

    const res = await getResultados(token)
    expect(res!.totalVotos).toBe(2)
    expect(res!.opciones.find((o) => o.optionId === opciones[0].optionId)!.votos).toBe(2)
  })

  it('revotar cambia la elección sin sumar (upsert por poll+voter)', async () => {
    await votar(token, opciones[0].optionId, 'device-A')
    await votar(token, opciones[1].optionId, 'device-A')

    const res = await getResultados(token)
    expect(res!.totalVotos).toBe(1)
    expect(res!.opciones.find((o) => o.optionId === opciones[0].optionId)!.votos).toBe(0)
    expect(res!.opciones.find((o) => o.optionId === opciones[1].optionId)!.votos).toBe(1)

    // Y el dispositivo ve su voto actual en la opción B.
    expect(await votoDelDispositivo(pollId, 'device-A')).toBe(opciones[1].optionId)
  })

  it('revotar la misma opción es idempotente (no duplica)', async () => {
    await votar(token, opciones[0].optionId, 'device-A')
    await votar(token, opciones[0].optionId, 'device-A')

    const res = await getResultados(token)
    expect(res!.totalVotos).toBe(1)

    const filas = await db.select({ id: pollVotes.id }).from(pollVotes).where(eq(pollVotes.pollId, pollId))
    expect(filas).toHaveLength(1)
  })

  it('el mismo dispositivo vota una vez en CADA votación distinta (edge case)', async () => {
    await votar(token, opciones[0].optionId, 'device-A')

    // Segunda votación del mismo creador: cerramos la primera para liberar el cupo.
    await db.update(polls).set({ status: 'closed' }).where(eq(polls.id, pollId))
    const otra = await crearVotacion(creadorId, { placeIds: [pub[1], pub[2]] })
    expect(otra.ok).toBe(true)
    if (!otra.ok) return

    const [opcionOtra] = await db
      .select({ id: pollOptions.id })
      .from(pollOptions)
      .where(eq(pollOptions.pollId, otra.data.pollId))
      .limit(1)

    // El mismo device vota en la segunda: la restricción es (poll, voter), así que
    // no choca con su voto de la primera — vota una vez por votación.
    const r = await votar(otra.data.token, opcionOtra.id, 'device-A')
    expect(r.ok).toBe(true)

    const filas = await db
      .select({ id: pollVotes.id })
      .from(pollVotes)
      .where(eq(pollVotes.voterToken, 'device-A'))
    expect(filas).toHaveLength(2)
  })
})

describe.runIf(process.env.DATABASE_URL)('no se vota en cerrada / expirada', () => {
  it('cerrada ⇒ VOTACION_CERRADA', async () => {
    await db.update(polls).set({ status: 'closed' }).where(eq(polls.id, pollId))
    const r = await votar(token, opciones[0].optionId, 'device-A')
    expect(r.ok === false && r.code).toBe('VOTACION_CERRADA')
  })

  it('expirada (open pero vencida) ⇒ VOTACION_CERRADA y persiste el cierre', async () => {
    await db
      .update(polls)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(polls.id, pollId))

    const r = await votar(token, opciones[0].optionId, 'device-A')
    expect(r.ok === false && r.code).toBe('VOTACION_CERRADA')

    // Persistió el cierre perezoso (decisión 11).
    const [fila] = await db.select({ status: polls.status }).from(polls).where(eq(polls.id, pollId))
    expect(fila.status).toBe('closed')
  })

  it('una opción de otra votación no se puede votar acá ⇒ OPCION_INVALIDA', async () => {
    const r = await votar(token, '00000000-0000-4000-8000-000000000000', 'device-A')
    expect(r.ok === false && r.code).toBe('OPCION_INVALIDA')
  })
})

describe.runIf(process.env.DATABASE_URL)('lectura pública', () => {
  it('token inexistente ⇒ null (⇒ 404, el único)', async () => {
    expect(await getVotacionPublica('token-que-no-existe')).toBeNull()
  })

  it('expiración lazy: una open vencida se lee cerrada (expired), sin cron', async () => {
    await db
      .update(polls)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(polls.id, pollId))

    const v = await getVotacionPublica(token)
    expect(v!.estado).toBe('expired')

    // Y quedó persistido: la próxima lectura ya lo ve closed.
    const [fila] = await db.select({ status: polls.status }).from(polls).where(eq(polls.id, pollId))
    expect(fila.status).toBe('closed')
  })

  it('el conteo agregado no expone el voter_token', async () => {
    await votar(token, opciones[0].optionId, 'device-secreto')
    const v = await getVotacionPublica(token)
    const serializado = JSON.stringify(v)
    expect(serializado).not.toContain('device-secreto')
    expect(serializado).not.toContain('voterToken')
  })
})
