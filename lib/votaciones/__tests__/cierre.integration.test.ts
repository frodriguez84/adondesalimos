import 'dotenv/config'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { eq, like } from 'drizzle-orm'
import { db } from '@/lib/db'
import { pollOptions, polls, places, users } from '@/lib/db/schema'
import { getConfidenceThreshold } from '@/lib/db/settings'
import { cancelarVotacion, cerrarVotacion, crearVotacion, votar } from '../acciones'
import { misVotaciones } from '../query'

/**
 * Cierre, cancelación y panel (F3). Lo que no ve un helper puro:
 *
 * - **solo el creador** cierra/cancela (decisión 14/20): un ajeno recibe 403,
 * - cerrar elige el ganador **aunque no sea el más votado** (decisión 4/14),
 * - **idempotencia** de cerrar/cancelar (edge cases),
 * - cancelar **libera el cupo "1 activa"** al instante (decisión 24),
 * - el panel **gatea por plan** (decisión 19): free = activa; premium = historial.
 */

const PREFIJO = '__test_cierre__'
const EMAIL = '__test_cierre__creador@ejemplo.com'
const EMAIL_AJENO = '__test_cierre__ajeno@ejemplo.com'
const OBELISCO = { lat: -34.6037, lng: -58.3816 }

let hayDb = true
let creadorId = ''
let ajenoId = ''
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
  const insertados = await db
    .insert(users)
    .values([
      { email: EMAIL, name: 'Creador', emailVerified: true },
      { email: EMAIL_AJENO, name: 'Ajeno', emailVerified: true },
    ])
    .returning({ id: users.id, email: users.email })
  creadorId = insertados.find((u) => u.email === EMAIL)!.id
  ajenoId = insertados.find((u) => u.email === EMAIL_AJENO)!.id
})

afterAll(async () => {
  if (hayDb) await limpiar()
})

beforeEach(async () => {
  if (!hayDb) return
  await db.delete(polls).where(eq(polls.creatorId, creadorId))
  await db.delete(polls).where(eq(polls.creatorId, ajenoId))
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

  const creada = await crearVotacion(creadorId, { placeIds: pub })
  if (!creada.ok) throw new Error('setup')
  token = creada.data.token
  pollId = creada.data.pollId
  opciones = await db
    .select({ optionId: pollOptions.id, placeId: pollOptions.placeId })
    .from(pollOptions)
    .where(eq(pollOptions.pollId, pollId))
    .orderBy(pollOptions.position)
})

describe.runIf(process.env.DATABASE_URL)('cerrar — solo el creador, elige ganador', () => {
  it('un no-creador no puede cerrar ⇒ NO_AUTORIZADO (403)', async () => {
    const r = await cerrarVotacion(ajenoId, token, pub[0])
    expect(r.ok === false && r.code).toBe('NO_AUTORIZADO')
  })

  it('el creador cierra eligiendo un ganador ≠ el más votado', async () => {
    // pub[0] recibe 2 votos; el creador igual elige pub[1] (decisión 14: él arma la cancha).
    await votar(token, opciones[0].optionId, 'a')
    await votar(token, opciones[0].optionId, 'b')

    const r = await cerrarVotacion(creadorId, token, pub[1])
    expect(r.ok).toBe(true)
    expect(r.ok && r.data.winnerPlaceId).toBe(pub[1])

    const [fila] = await db
      .select({ status: polls.status, winner: polls.winnerPlaceId, closedAt: polls.closedAt })
      .from(polls)
      .where(eq(polls.id, pollId))
    expect(fila.status).toBe('closed')
    expect(fila.winner).toBe(pub[1])
    expect(fila.closedAt).not.toBeNull()
  })

  it('un ganador que no es opción de la votación ⇒ GANADOR_INVALIDO', async () => {
    const r = await cerrarVotacion(creadorId, token, '00000000-0000-4000-8000-000000000000')
    expect(r.ok === false && r.code).toBe('GANADOR_INVALIDO')
  })

  it('cerrar dos veces es idempotente: no re-elige ganador ni pisa closed_at', async () => {
    await cerrarVotacion(creadorId, token, pub[0])
    const [antes] = await db
      .select({ winner: polls.winnerPlaceId, closedAt: polls.closedAt })
      .from(polls)
      .where(eq(polls.id, pollId))

    // Segundo intento con OTRO ganador: no debe pisar.
    const r = await cerrarVotacion(creadorId, token, pub[2])
    expect(r.ok).toBe(true)

    const [despues] = await db
      .select({ winner: polls.winnerPlaceId, closedAt: polls.closedAt })
      .from(polls)
      .where(eq(polls.id, pollId))
    expect(despues.winner).toBe(pub[0])
    expect(despues.closedAt).toEqual(antes.closedAt)
  })
})

describe.runIf(process.env.DATABASE_URL)('cancelar — libera el cupo "1 activa"', () => {
  it('un no-creador no puede cancelar ⇒ NO_AUTORIZADO', async () => {
    const r = await cancelarVotacion(ajenoId, token)
    expect(r.ok === false && r.code).toBe('NO_AUTORIZADO')
  })

  it('cancelar libera el cupo: el free crea otra de inmediato', async () => {
    // Con la primera activa, el free no puede crear otra.
    const bloqueada = await crearVotacion(creadorId, { placeIds: [pub[0], pub[1]] })
    expect(bloqueada.ok === false && bloqueada.code).toBe('LIMITE_ACTIVA')

    const cancelada = await cancelarVotacion(creadorId, token)
    expect(cancelada.ok).toBe(true)

    const nueva = await crearVotacion(creadorId, { placeIds: [pub[0], pub[1]] })
    expect(nueva.ok).toBe(true)

    const [fila] = await db.select({ status: polls.status }).from(polls).where(eq(polls.id, pollId))
    expect(fila.status).toBe('cancelled')
  })

  it('cancelar una ya cancelada es idempotente', async () => {
    await cancelarVotacion(creadorId, token)
    const r = await cancelarVotacion(creadorId, token)
    expect(r.ok).toBe(true)
  })

  it('no se puede cancelar una ya cerrada ⇒ YA_CERRADA', async () => {
    await cerrarVotacion(creadorId, token, pub[0])
    const r = await cancelarVotacion(creadorId, token)
    expect(r.ok === false && r.code).toBe('YA_CERRADA')
  })
})

describe.runIf(process.env.DATABASE_URL)('panel — gate de plan (decisión 19)', () => {
  it('free ve solo la activa; una expirada no aparece', async () => {
    // Cerramos la del setup y creamos dos: una vigente, una expirada.
    await db.update(polls).set({ status: 'closed' }).where(eq(polls.id, pollId))

    const vigente = await crearVotacion(creadorId, { placeIds: [pub[0], pub[1]] })
    expect(vigente.ok).toBe(true)

    // free: solo la vigente.
    const freeVista = await misVotaciones(creadorId, false)
    expect(freeVista).toHaveLength(1)
    expect(freeVista[0].estado).toBe('open')

    // Empujamos la vigente al pasado: ya no es activa ⇒ desaparece del panel free.
    if (vigente.ok) {
      await db
        .update(polls)
        .set({ expiresAt: new Date(Date.now() - 60_000) })
        .where(eq(polls.id, vigente.data.pollId))
    }
    expect(await misVotaciones(creadorId, false)).toHaveLength(0)
  })

  it('premium ve el historial completo (cerradas y expiradas incluidas)', async () => {
    await db.update(polls).set({ status: 'closed' }).where(eq(polls.id, pollId))
    const premiumVista = await misVotaciones(creadorId, true)
    // Al menos la del setup (cerrada) aparece en el historial.
    expect(premiumVista.length).toBeGreaterThanOrEqual(1)
    expect(premiumVista.some((v) => v.id === pollId)).toBe(true)
  })

  it('el panel trae el conteo por opción para elegir ganador', async () => {
    await votar(token, opciones[0].optionId, 'a')
    const vista = await misVotaciones(creadorId, false)
    const activa = vista.find((v) => v.id === pollId)
    expect(activa!.totalVotos).toBe(1)
    const op0 = activa!.opciones.find((o) => o.placeId === pub[0])
    expect(op0!.votos).toBe(1)
  })
})
