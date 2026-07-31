import 'dotenv/config'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { eq, like } from 'drizzle-orm'
import { db } from '@/lib/db'
import { pollOptions, pollVotes, polls, places, users } from '@/lib/db/schema'
import { getConfidenceThreshold } from '@/lib/db/settings'
import { crearVotacion, quitarOpcion, sugerirOpcion, cambiarSugerencias } from '../acciones'
import { MAX_OPCIONES_TOTAL, MAX_SUGERENCIAS_POR_VOTANTE } from '../constantes'
import { getVotacionPublica } from '../query'

/**
 * `sugerirOpcion` / `quitarOpcion` contra la base (SUGERIR_EN_VOTACION). Todo lo
 * del DoD que solo se puede verificar con datos reales:
 *
 * - el **candado de grounding** (decisión 4): un uuid inventado y un lugar
 *   despublicado se rechazan igual — no hay camino a una opción con texto libre,
 * - el **techo total** (decisión 2), incluso con dos sugerencias **concurrentes**,
 * - el **tope por dispositivo** (decisión 7) y `allow_suggestions` (decisión 10),
 * - quién puede **quitar** qué (decisión 8) y que `suggested_by` no sale nunca en
 *   lo que devuelve la query pública (decisión 12).
 */

const PREFIJO = '__test_sug__'
const EMAIL_CREADOR = '__test_sug__creador@ejemplo.com'
const EMAIL_OTRO = '__test_sug__otro@ejemplo.com'
const OBELISCO = { lat: -34.6037, lng: -58.3816 }

const VOTANTE_A = '__test_sug__votante_a'
const VOTANTE_B = '__test_sug__votante_b'

let hayDb = true
let creadorId = ''
let otroId = ''
let pub: string[] = []
let invisibleId = ''
let token = ''
let pollId = ''

async function limpiar() {
  // Igual que el test de votaciones: los usuarios primero (se llevan sus polls por
  // cascade) y recién después los places, que ya quedaron sin referencias.
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
      { email: EMAIL_CREADOR, name: 'Creador', emailVerified: true, plan: 'premium' },
      { email: EMAIL_OTRO, name: 'Otro', emailVerified: true, plan: 'premium' },
    ])
    .returning({ id: users.id, email: users.email })

  creadorId = insertados.find((u) => u.email === EMAIL_CREADOR)!.id
  otroId = insertados.find((u) => u.email === EMAIL_OTRO)!.id
})

afterAll(async () => {
  if (hayDb) await limpiar()
})

beforeEach(async () => {
  if (!hayDb) return
  await db.delete(polls).where(eq(polls.creatorId, creadorId))
  await db.delete(places).where(like(places.name, `${PREFIJO}%`))

  // 12 publicados (alcanzan para llenar el techo) + 1 invisible.
  const publicados = await db
    .insert(places)
    .values(
      Array.from({ length: 12 }, (_, i) => ({
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

  // La cancha del creador: 2 lugares, con sugerencias habilitadas.
  const creada = await crearVotacion(creadorId, { placeIds: [pub[0], pub[1]] })
  if (!creada.ok) throw new Error('no se pudo crear la votación de prueba')
  token = creada.data.token
  pollId = creada.data.pollId
})

describe.runIf(process.env.DATABASE_URL)('sugerir — candado de grounding (decisión 4)', () => {
  it('un lugar publicado entra como sugerencia, al final y con su origen', async () => {
    const r = await sugerirOpcion(token, pub[2], VOTANTE_A)
    expect(r.ok).toBe(true)
    if (!r.ok) return

    const [fila] = await db
      .select({
        origin: pollOptions.origin,
        position: pollOptions.position,
        suggestedBy: pollOptions.suggestedBy,
      })
      .from(pollOptions)
      .where(eq(pollOptions.id, r.data.optionId))

    expect(fila.origin).toBe('voter')
    expect(fila.position).toBe(2) // detrás de las 2 del creador (0 y 1)
    expect(fila.suggestedBy).toBe(VOTANTE_A)
  })

  it('un uuid inventado ⇒ LUGAR_NO_PUBLICADO, sin insertar nada', async () => {
    const r = await sugerirOpcion(token, crypto.randomUUID(), VOTANTE_A)
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.code).toBe('LUGAR_NO_PUBLICADO')

    const opciones = await db
      .select({ id: pollOptions.id })
      .from(pollOptions)
      .where(eq(pollOptions.pollId, pollId))
    expect(opciones).toHaveLength(2)
  })

  it('un lugar despublicado ⇒ LUGAR_NO_PUBLICADO', async () => {
    const r = await sugerirOpcion(token, invisibleId, VOTANTE_A)
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.code).toBe('LUGAR_NO_PUBLICADO')
  })

  it('un lugar que ya está en la cancha ⇒ LUGAR_REPETIDO', async () => {
    const r = await sugerirOpcion(token, pub[0], VOTANTE_A)
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.code).toBe('LUGAR_REPETIDO')
  })
})

describe.runIf(process.env.DATABASE_URL)('sugerir — los topes (decisiones 2 y 7)', () => {
  it(`el techo de ${MAX_OPCIONES_TOTAL} se aplica en el server`, async () => {
    // 6 sugerencias más (2 del creador + 6 = 8), cada una de un votante distinto
    // para no chocar con el tope por dispositivo.
    for (let i = 0; i < MAX_OPCIONES_TOTAL - 2; i++) {
      const r = await sugerirOpcion(token, pub[2 + i], `${VOTANTE_A}_${i}`)
      expect(r.ok, `la sugerencia ${i} tendría que entrar`).toBe(true)
    }

    const llena = await sugerirOpcion(token, pub[MAX_OPCIONES_TOTAL], `${VOTANTE_A}_extra`)
    expect(llena.ok).toBe(false)
    expect(llena.ok === false && llena.code).toBe('VOTACION_LLENA')

    const [{ total }] = await db
      .select({ total: pollOptions.id })
      .from(pollOptions)
      .where(eq(pollOptions.pollId, pollId))
      .then((filas) => [{ total: filas.length }])
    expect(total).toBe(MAX_OPCIONES_TOTAL)
  })

  it('dos sugerencias concurrentes con UNA vacante ⇒ entra una sola', async () => {
    // Dejamos la votación en 7 opciones: queda exactamente un lugar libre.
    for (let i = 0; i < MAX_OPCIONES_TOTAL - 3; i++) {
      const r = await sugerirOpcion(token, pub[2 + i], `${VOTANTE_A}_${i}`)
      expect(r.ok).toBe(true)
    }

    const [uno, dos] = await Promise.all([
      sugerirOpcion(token, pub[MAX_OPCIONES_TOTAL - 1], `${VOTANTE_B}_1`),
      sugerirOpcion(token, pub[MAX_OPCIONES_TOTAL], `${VOTANTE_B}_2`),
    ])

    const oks = [uno, dos].filter((r) => r.ok)
    const fallos = [uno, dos].filter((r) => !r.ok)
    expect(oks).toHaveLength(1)
    expect(fallos).toHaveLength(1)
    expect(fallos[0].ok === false && fallos[0].code).toBe('VOTACION_LLENA')

    const opciones = await db
      .select({ id: pollOptions.id })
      .from(pollOptions)
      .where(eq(pollOptions.pollId, pollId))
    expect(opciones, 'nunca una opción de más').toHaveLength(MAX_OPCIONES_TOTAL)
  })

  it(`el tope de ${MAX_SUGERENCIAS_POR_VOTANTE} por dispositivo se aplica en el server`, async () => {
    for (let i = 0; i < MAX_SUGERENCIAS_POR_VOTANTE; i++) {
      const r = await sugerirOpcion(token, pub[2 + i], VOTANTE_A)
      expect(r.ok).toBe(true)
    }

    const tercera = await sugerirOpcion(token, pub[5], VOTANTE_A)
    expect(tercera.ok).toBe(false)
    expect(tercera.ok === false && tercera.code).toBe('LIMITE_SUGERENCIAS')

    // Otro dispositivo sí puede: el tope es por votante, no por votación.
    const deOtro = await sugerirOpcion(token, pub[5], VOTANTE_B)
    expect(deOtro.ok).toBe(true)
  })
})

describe.runIf(process.env.DATABASE_URL)('sugerir — gates de estado (decisiones 6 y 10)', () => {
  it('con allow_suggestions = false ⇒ SUGERENCIAS_CERRADAS', async () => {
    const cambio = await cambiarSugerencias(creadorId, token, false)
    expect(cambio.ok).toBe(true)

    const r = await sugerirOpcion(token, pub[2], VOTANTE_A)
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.code).toBe('SUGERENCIAS_CERRADAS')
  })

  it('solo el creador cambia el interruptor', async () => {
    const ajeno = await cambiarSugerencias(otroId, token, false)
    expect(ajeno.ok).toBe(false)
    expect(ajeno.ok === false && ajeno.code).toBe('NO_AUTORIZADO')
  })

  it('votación cerrada ⇒ VOTACION_CERRADA', async () => {
    await db.update(polls).set({ status: 'closed' }).where(eq(polls.id, pollId))

    const r = await sugerirOpcion(token, pub[2], VOTANTE_A)
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.code).toBe('VOTACION_CERRADA')
  })

  it('votación expirada (sigue open pero venció) ⇒ VOTACION_CERRADA y se persiste el cierre', async () => {
    await db
      .update(polls)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(polls.id, pollId))

    const r = await sugerirOpcion(token, pub[2], VOTANTE_A)
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.code).toBe('VOTACION_CERRADA')

    const [poll] = await db.select({ status: polls.status }).from(polls).where(eq(polls.id, pollId))
    expect(poll.status, 'cierre perezoso, decisión 11 de VOTACION').toBe('closed')
  })

  it('token inexistente ⇒ VOTACION_NO_ENCONTRADA (el único 404)', async () => {
    const r = await sugerirOpcion('token-que-no-existe', pub[2], VOTANTE_A)
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.code).toBe('VOTACION_NO_ENCONTRADA')
  })
})

describe.runIf(process.env.DATABASE_URL)('quitar — quién puede sacar qué (decisión 8)', () => {
  async function sugerida(voter = VOTANTE_A, placeIdx = 2) {
    const r = await sugerirOpcion(token, pub[placeIdx], voter)
    if (!r.ok) throw new Error(`no se pudo sugerir: ${r.code}`)
    return r.data.optionId
  }

  async function votarOpcion(optionId: string, voterToken: string) {
    await db.insert(pollVotes).values({ pollId, optionId, voterToken })
  }

  it('el creador saca una sugerencia y se lleva sus votos (con el número a la vista)', async () => {
    const optionId = await sugerida()
    await votarOpcion(optionId, VOTANTE_B)

    const r = await quitarOpcion(token, optionId, { tipo: 'creador', userId: creadorId })
    expect(r.ok).toBe(true)
    expect(r.ok && r.data.votosPerdidos).toBe(1)

    const quedan = await db
      .select({ id: pollOptions.id })
      .from(pollOptions)
      .where(eq(pollOptions.id, optionId))
    expect(quedan).toHaveLength(0)

    const votos = await db.select({ id: pollVotes.id }).from(pollVotes).where(eq(pollVotes.pollId, pollId))
    expect(votos, 'los votos se van con la opción (cascade)').toHaveLength(0)
  })

  it('el creador NO puede sacar una opción original', async () => {
    const [original] = await db
      .select({ id: pollOptions.id })
      .from(pollOptions)
      .where(eq(pollOptions.pollId, pollId))

    const r = await quitarOpcion(token, original.id, { tipo: 'creador', userId: creadorId })
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.code).toBe('OPCION_ORIGINAL')
  })

  it('el que sugirió saca la suya si no tiene votos; con votos, no', async () => {
    const optionId = await sugerida(VOTANTE_A)

    const conVotos = await sugerida(VOTANTE_B, 3)
    await votarOpcion(conVotos, VOTANTE_B)

    const mia = await quitarOpcion(token, optionId, { tipo: 'votante', voterToken: VOTANTE_A })
    expect(mia.ok).toBe(true)

    const votada = await quitarOpcion(token, conVotos, { tipo: 'votante', voterToken: VOTANTE_B })
    expect(votada.ok).toBe(false)
    expect(votada.ok === false && votada.code).toBe('OPCION_CON_VOTOS')
  })

  it('otro dispositivo no puede sacar la sugerencia ajena', async () => {
    const optionId = await sugerida(VOTANTE_A)

    const r = await quitarOpcion(token, optionId, { tipo: 'votante', voterToken: VOTANTE_B })
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.code).toBe('NO_AUTORIZADO')
  })

  it('un usuario que no es el creador no puede moderar', async () => {
    const optionId = await sugerida(VOTANTE_A)

    const r = await quitarOpcion(token, optionId, { tipo: 'creador', userId: otroId })
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.code).toBe('NO_AUTORIZADO')
  })

  it('con la votación cerrada no se toca la cancha', async () => {
    const optionId = await sugerida(VOTANTE_A)
    await db.update(polls).set({ status: 'closed' }).where(eq(polls.id, pollId))

    const r = await quitarOpcion(token, optionId, { tipo: 'creador', userId: creadorId })
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.code).toBe('VOTACION_CERRADA')
  })
})

describe.runIf(process.env.DATABASE_URL)('la query pública nunca expone quién sugirió (decisión 12)', () => {
  it('`suggested_by` no está en lo que devuelve `getVotacionPublica`', async () => {
    const sugerida = await sugerirOpcion(token, pub[2], VOTANTE_A)
    expect(sugerida.ok).toBe(true)

    const votacion = await getVotacionPublica(token)
    expect(votacion).not.toBeNull()
    if (!votacion) return

    const serializada = JSON.stringify(votacion)
    expect(serializada).not.toContain(VOTANTE_A)
    expect(serializada).not.toContain('suggested')

    const opcion = votacion.opciones.find((o) => o.origin === 'voter')
    expect(opcion, 'la sugerida se distingue por `origin`').toBeDefined()
    expect(Object.keys(opcion!).sort()).toEqual(
      ['location', 'name', 'optionId', 'origin', 'placeId', 'tags', 'votos'].sort(),
    )
  })
})
