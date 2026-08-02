import 'dotenv/config'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { eq, like } from 'drizzle-orm'
import { db } from '@/lib/db'
import { pollOptions, polls, places, users, type PollStatus } from '@/lib/db/schema'
import { getConfidenceThreshold } from '@/lib/db/settings'
import { HISTORIAL_PAGE_SIZE, historialDeVotaciones, votacionesActivas } from '../query'

/**
 * El historial paginado del panel (pulido de UI (d)). Lo que no ve un helper puro:
 *
 * - **qué entra** (decisión 3): cerradas y expiradas sí, **canceladas no**, activas
 *   tampoco —esas van arriba con la card completa (decisión 4)—,
 * - el **techo de 20 + cursor** (decisión 1): encadena sin repetir ni saltear, y un
 *   cursor manoseado sirve la primera página en vez de romper,
 * - los dos nombres que **no están en `polls`** (decisión 2): el ganador por join a
 *   `places` y las primeras 2 opciones con "…" para las votaciones sin título.
 */

const PREFIJO = '__test_hist__'
const EMAIL = '__test_hist__creador@ejemplo.com'
const OBELISCO = { lat: -34.6037, lng: -58.3816 }

let hayDb = true
let creadorId = ''
let pub: string[] = []

async function limpiar() {
  await db.delete(users).where(like(users.email, `${PREFIJO}%`))
  await db.delete(places).where(like(places.name, `${PREFIJO}%`))
}

/**
 * Inserta una votación ya terminada (o no) directo en la base: el historial se
 * prueba con estados que `crearVotacion` no puede producir —cancelada, expirada,
 * cerrada con ganador— y con fechas escalonadas para ejercer el cursor.
 */
async function sembrar(opts: {
  status: PollStatus
  minutosAtras: number
  vencida?: boolean
  title?: string | null
  ganador?: string | null
  placeIds?: string[]
}): Promise<string> {
  const creado = new Date(Date.now() - opts.minutosAtras * 60_000)
  const [poll] = await db
    .insert(polls)
    .values({
      creatorId: creadorId,
      token: `${PREFIJO}${crypto.randomUUID()}`,
      title: opts.title ?? null,
      status: opts.status,
      winnerPlaceId: opts.ganador ?? null,
      createdAt: creado,
      // Vencida = venció justo después de crearse; si no, sigue vigente un rato.
      expiresAt: opts.vencida
        ? new Date(creado.getTime() + 60_000)
        : new Date(Date.now() + 60 * 60_000),
    })
    .returning({ id: polls.id })

  const lugares = opts.placeIds ?? pub.slice(0, 2)
  await db
    .insert(pollOptions)
    .values(lugares.map((placeId, i) => ({ pollId: poll.id, placeId, position: i })))

  return poll.id
}

beforeAll(async () => {
  try {
    await getConfidenceThreshold()
  } catch {
    hayDb = false
    return
  }
  await limpiar()
  const [usuario] = await db
    .insert(users)
    .values({ email: EMAIL, name: 'Creador', emailVerified: true, plan: 'premium' })
    .returning({ id: users.id })
  creadorId = usuario.id
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
})

describe.runIf(process.env.DATABASE_URL)('historial — qué entra (decisiones 3 y 4)', () => {
  it('cerradas y expiradas sí; cancelada y activa no', async () => {
    const cerrada = await sembrar({ status: 'closed', minutosAtras: 10 })
    const expirada = await sembrar({ status: 'open', minutosAtras: 20, vencida: true })
    const cancelada = await sembrar({ status: 'cancelled', minutosAtras: 30 })
    const activa = await sembrar({ status: 'open', minutosAtras: 5 })

    const { filas } = await historialDeVotaciones(creadorId)
    const ids = filas.map((f) => f.id)

    expect(ids).toContain(cerrada)
    expect(ids).toContain(expirada)
    expect(ids, 'una cancelada no tiene nada que contar').not.toContain(cancelada)
    expect(ids, 'la activa va arriba con la card completa').not.toContain(activa)

    expect(filas.find((f) => f.id === expirada)!.estado).toBe('expired')
    expect(filas.find((f) => f.id === cerrada)!.estado).toBe('closed')

    // Y la activa sigue estando donde tiene que estar.
    expect((await votacionesActivas(creadorId)).map((v) => v.id)).toEqual([activa])
  })
})

describe.runIf(process.env.DATABASE_URL)('historial — página y cursor (decisión 1)', () => {
  it(`sirve ${HISTORIAL_PAGE_SIZE} por página y encadena sin repetir ni saltear`, async () => {
    // 25 cerradas, cada una un minuto más vieja que la anterior.
    for (let i = 0; i < 25; i++) {
      await sembrar({ status: 'closed', minutosAtras: 10 + i, title: `Salida ${i}` })
    }

    const p1 = await historialDeVotaciones(creadorId)
    expect(p1.filas).toHaveLength(HISTORIAL_PAGE_SIZE)
    expect(p1.nextCursor).not.toBeNull()
    // Más nuevas primero.
    expect(p1.filas[0].title).toBe('Salida 0')

    const p2 = await historialDeVotaciones(creadorId, p1.nextCursor)
    expect(p2.filas).toHaveLength(25 - HISTORIAL_PAGE_SIZE)
    expect(p2.nextCursor).toBeNull()

    const ids = [...p1.filas, ...p2.filas].map((f) => f.id)
    expect(new Set(ids).size).toBe(25)
  })

  it('un cursor manoseado sirve la primera página en vez de romper', async () => {
    await sembrar({ status: 'closed', minutosAtras: 10, title: 'Única' })
    const r = await historialDeVotaciones(creadorId, 'basura-no-base64')
    expect(r.filas).toHaveLength(1)
  })

  it('sin historial devuelve la página vacía, sin cursor', async () => {
    const r = await historialDeVotaciones(creadorId)
    expect(r.filas).toEqual([])
    expect(r.nextCursor).toBeNull()
  })
})

describe.runIf(process.env.DATABASE_URL)('historial — lo que hace reconocible la fila (decisión 2)', () => {
  it('el ganador sale del join por winner_place_id; sin ganador ⇒ null', async () => {
    const conGanador = await sembrar({ status: 'closed', minutosAtras: 10, ganador: pub[1] })
    const sinGanador = await sembrar({ status: 'open', minutosAtras: 20, vencida: true })

    const { filas } = await historialDeVotaciones(creadorId)
    expect(filas.find((f) => f.id === conGanador)!.ganador).toBe(`${PREFIJO} Bar 1`)
    expect(filas.find((f) => f.id === sinGanador)!.ganador).toBeNull()
  })

  it('sin título: 2 opciones y el aviso de que hay más', async () => {
    const dos = await sembrar({ status: 'closed', minutosAtras: 10, placeIds: pub.slice(0, 2) })
    const tres = await sembrar({ status: 'closed', minutosAtras: 20, placeIds: pub })
    const conTitulo = await sembrar({ status: 'closed', minutosAtras: 30, title: 'Cumple de Fer' })

    const { filas } = await historialDeVotaciones(creadorId)

    const filaDos = filas.find((f) => f.id === dos)!
    expect(filaDos.opciones).toEqual([`${PREFIJO} Bar 0`, `${PREFIJO} Bar 1`])
    expect(filaDos.masOpciones).toBe(false)

    const filaTres = filas.find((f) => f.id === tres)!
    expect(filaTres.opciones).toHaveLength(2)
    expect(filaTres.masOpciones).toBe(true)

    // Con título no se piden nombres: la fila los deja vacíos.
    const filaTitulo = filas.find((f) => f.id === conTitulo)!
    expect(filaTitulo.title).toBe('Cumple de Fer')
    expect(filaTitulo.opciones).toEqual([])
  })
})
