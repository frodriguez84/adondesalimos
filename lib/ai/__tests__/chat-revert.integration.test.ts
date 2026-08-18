import 'dotenv/config'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/ai/client', () => ({ getAnthropic: vi.fn() }))

import { and, eq, like, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { aiApiUsage, chatMessages, users } from '@/lib/db/schema'
import { getConfidenceThreshold } from '@/lib/db/settings'
import { getAnthropic } from '@/lib/ai/client'
import { reservarCupo } from '@/lib/ai/cupo'
import { streamChatTurn } from '@/lib/ai/chat'

/**
 * `SEC-06`: **dónde** falla el turno decide si el cupo vuelve o no.
 *
 * Antes un `catch` único revertía la reserva ante cualquier excepción, así que
 * cortar el SSE después de recibir la respuesta devolvía un mensaje ya facturado —
 * y bastaba con cerrar la pestaña. Estos tests fijan el límite: antes de que
 * Anthropic conteste el cupo vuelve; después, no vuelve nunca.
 *
 * El cliente de Anthropic está mockeado: no sale ninguna llamada real. La reserva y
 * el revert corren contra el Postgres local, que es donde vive lo que se afirma.
 */

const EMAIL = '__test_sec06__@qa.local'
/** El mes de facturación lo pone Postgres, igual que en `cupo.ts`. */
const MES = sql`to_char(current_date, 'YYYY-MM')`

let hayDb = true
let userId = ''
/**
 * `reservarCupo` incrementa el contador global del mes y **no lo revierte** (es
 * deliberado). Como es el contador real de dev, se anota cuánto había y se deja
 * como estaba: un test no tiene por qué mover la factura del mes.
 */
let usoGlobalAlEmpezar = 0

/** Un stream falso con la forma que consume `chat.ts`: iterable + `finalMessage()`. */
function streamFalso(opts: {
  deltas?: string[]
  stopReason?: 'end_turn' | 'tool_use'
  /** Se espera acá antes de terminar de iterar (para cortar en el medio). */
  esperar?: Promise<void>
}) {
  const { deltas = ['hola'], stopReason = 'end_turn', esperar } = opts
  return {
    async *[Symbol.asyncIterator]() {
      for (const text of deltas) {
        yield { type: 'content_block_delta', delta: { type: 'text_delta', text } }
      }
      if (esperar) await esperar
    },
    async finalMessage() {
      return {
        content: [],
        stop_reason: stopReason,
        usage: { input_tokens: 10, output_tokens: 5 },
      }
    },
  }
}

/** Instala el fake y devuelve las `RequestOptions` con las que se llamó cada ronda. */
function instalarAnthropic(porRonda: Array<ReturnType<typeof streamFalso> | Error>) {
  const opciones: Array<{ signal?: AbortSignal | null }> = []
  let ronda = 0
  vi.mocked(getAnthropic).mockReturnValue({
    messages: {
      stream: (_body: unknown, options?: { signal?: AbortSignal | null }) => {
        opciones.push(options ?? {})
        const siguiente = porRonda[ronda++]
        if (siguiente instanceof Error) throw siguiente
        return siguiente
      },
    },
    // El módulo solo usa `messages.stream`; el resto del SDK no hace falta.
  } as unknown as ReturnType<typeof getAnthropic>)
  return opciones
}

async function usoGlobal(): Promise<number> {
  const [row] = await db
    .select({ count: aiApiUsage.count })
    .from(aiApiUsage)
    .where(and(sql`${aiApiUsage.month} = ${MES}`, eq(aiApiUsage.sku, 'chat_messages')))
  return row?.count ?? 0
}

async function trialUsado(): Promise<number> {
  const [u] = await db.select({ t: users.chatTrialUsed }).from(users).where(eq(users.id, userId))
  return u?.t ?? 0
}

async function mensajesDelUsuario(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(chatMessages)
    .where(eq(chatMessages.role, 'user'))
  return row?.n ?? 0
}

/** Consume el stream hasta el final para que `start()` termine antes de aseverar. */
async function drenar(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader()
  let salida = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    salida += new TextDecoder().decode(value)
  }
  return salida
}

beforeAll(async () => {
  try {
    await getConfidenceThreshold()
  } catch {
    hayDb = false
    return
  }
  await db.delete(users).where(like(users.email, '__test_sec06__%'))
  const [u] = await db
    .insert(users)
    .values({ email: EMAIL, name: 'SEC06', emailVerified: true })
    .returning({ id: users.id })
  userId = u.id
  usoGlobalAlEmpezar = await usoGlobal()
})

afterAll(async () => {
  if (!hayDb) return
  await db.delete(users).where(like(users.email, '__test_sec06__%'))
  await db
    .update(aiApiUsage)
    .set({ count: usoGlobalAlEmpezar })
    .where(and(sql`${aiApiUsage.month} = ${MES}`, eq(aiApiUsage.sku, 'chat_messages')))
})

beforeEach(async () => {
  if (!hayDb) return
  await db.update(users).set({ chatTrialUsed: 0 }).where(eq(users.id, userId))
  vi.clearAllMocks()
})

/** Reserva el cupo igual que la route: el INSERT del mensaje ES la reserva. */
async function reservar() {
  return reservarCupo({
    userId,
    esPrem: false,
    conversationId: null,
    modo: 'chat',
    contenido: 'algo para salir',
  })
}

describe.runIf(process.env.DATABASE_URL)('revert del cupo según dónde falla (SEC-06)', () => {
  it('la llamada NUNCA volvió → devuelve el cupo y borra el mensaje del usuario', async () => {
    if (!hayDb) return
    const antes = await mensajesDelUsuario()
    const reserva = await reservar()
    expect(await trialUsado()).toBe(1)

    instalarAnthropic([new Error('503 de Anthropic')])
    const salida = await drenar(
      streamChatTurn({
        conversationId: reserva.conversationId,
        userId,
        esPrem: false,
        reservaMessageId: reserva.messageId,
        plan: 'trial',
      }),
    )

    expect(salida).toContain('error')
    // No se gastó nada: el cupo vuelve y el mensaje reservado se borra (decisión 13).
    expect(await trialUsado()).toBe(0)
    expect(await mensajesDelUsuario()).toBe(antes)
  })

  it('la llamada YA volvió y falla algo después → el cupo NO vuelve', async () => {
    if (!hayDb) return
    const reserva = await reservar()
    expect(await trialUsado()).toBe(1)

    // Ronda 1 contesta y pide tools (ahí se marca `llamadaEmitida`); la ronda 2
    // explota. Es el tramo en el que antes se regalaba una llamada ya facturada.
    instalarAnthropic([
      streamFalso({ deltas: ['bueno, a ver'], stopReason: 'tool_use' }),
      new Error('se cayó en la segunda ronda'),
    ])
    await drenar(
      streamChatTurn({
        conversationId: reserva.conversationId,
        userId,
        esPrem: false,
        reservaMessageId: reserva.messageId,
        plan: 'trial',
      }),
    )

    // La plata ya se gastó: el mensaje del usuario se queda y el cupo también.
    expect(await trialUsado()).toBe(1)
    const [msg] = await db
      .select({ id: chatMessages.id })
      .from(chatMessages)
      .where(eq(chatMessages.id, reserva.messageId))
    expect(msg).toBeDefined()
  })

  it('cortar el stream aborta la llamada a Anthropic en vez de seguir generando', async () => {
    if (!hayDb) return
    const reserva = await reservar()

    // La ronda se queda esperando después del primer delta: así se puede cortar
    // con la llamada todavía en vuelo, que es el caso real de cerrar la pestaña.
    let soltar = () => {}
    const enVuelo = new Promise<void>((resolve) => {
      soltar = resolve
    })
    const opciones = instalarAnthropic([
      streamFalso({ deltas: ['arranco a contestar'], esperar: enVuelo }),
    ])

    const stream = streamChatTurn({
      conversationId: reserva.conversationId,
      userId,
      esPrem: false,
      reservaMessageId: reserva.messageId,
      plan: 'trial',
    })
    const reader = stream.getReader()
    await reader.read()

    expect(opciones[0].signal?.aborted).toBe(false)
    await reader.cancel()
    // Lo que `SEC-06` agrega: la llamada se aborta, no se sigue pagando tokens
    // para un cliente que ya no está.
    expect(opciones[0].signal?.aborted).toBe(true)

    soltar()
  })
})
