import { z } from 'zod'
import { auth } from '@/lib/auth'
import { checkChatRateLimit } from '@/lib/middleware/rate-limit'
import { esPremium } from '@/lib/votaciones/planes'
import { CupoError, reservarCupo, type CupoErrorCode } from '@/lib/ai/cupo'
import { streamChatTurn } from '@/lib/ai/chat'

/**
 * `POST /api/chat` — mandar un mensaje al chat IA (CHAT_IA F1, decisiones 18-20).
 *
 * Orden del gate (todo server-side, nunca se confía en el cliente): rate limit →
 * sesión (401) → validación (400) → `esPremium` por request → reserva de cupo
 * (503 tope / 403 sin cupo / 404 conversación ajena). Si la reserva pasa, se
 * devuelve el stream SSE; si Anthropic falla, `streamChatTurn` revierte el cupo.
 */

export const dynamic = 'force-dynamic'

/**
 * Techo de duración de la función (DEPLOY F1). El turno es SSE con rondas de
 * tool: streamear la respuesta más una búsqueda contra Neon —con cold start del
 * plan Free— no entra en un default chico.
 *
 * Verificado en la doc de Vercel el 2026-08-07: con **fluid compute** (prendido
 * por defecto en proyectos nuevos) Hobby da 300 s de default **y** de máximo, así
 * que el default de hoy no cortaría nada. Se declara igual, y en 60: es un valor
 * válido en los dos regímenes —también si el proyecto quedara sin fluid, donde el
 * máximo de Hobby es 60— y queda muy por encima de cualquier turno real, sin
 * dejar que una función colgada corra cinco minutos. No depender del default es
 * justamente la lección: ese default ya cambió una vez.
 */
export const maxDuration = 60

const bodySchema = z.object({
  message: z.string().min(1).max(1000),
  /** Si no viene, se crea una conversación nueva. */
  conversationId: z.string().uuid().optional(),
  /** Solo aplica al crear una conversación nueva (decisión 21). */
  modo: z.enum(['chat', 'shortlist']).optional(),
})

/** Código de dominio → status HTTP + mensaje rioplatense de cara al usuario. */
const RESPUESTA_CUPO: Record<CupoErrorCode, { status: number; message: string }> = {
  CHAT_PAUSADO: {
    status: 503,
    message: 'El chat está descansando un rato, volvé más tarde.',
  },
  TRIAL_AGOTADO: {
    status: 403,
    message: 'Usaste tus mensajes de prueba. Hacete premium para seguir chateando con la IA.',
  },
  CUPO_AGOTADO: {
    status: 403,
    message: 'Llegaste al tope de mensajes del mes. Se renueva el 1º del mes que viene.',
  },
  CONVERSACION_NO_ENCONTRADA: {
    status: 404,
    message: 'No encontramos esa conversación.',
  },
}

export async function POST(request: Request) {
  // 1. Anti-ráfaga por IP (decisión 22), antes de tocar sesión o base.
  const bloqueado = checkChatRateLimit(request)
  if (bloqueado) return bloqueado

  // 2. Sin login no hay chat (decisión 6): el cupo necesita identidad.
  const session = await auth.api.getSession({ headers: request.headers }).catch(() => null)
  if (!session?.user) {
    return Response.json(
      { data: null, error: { message: 'Iniciá sesión para usar el chat.', code: 'NO_SESSION' } },
      { status: 401 },
    )
  }

  // 3. Boundary (decisión 23): body JSON, mensaje 1..1000.
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json(
      { data: null, error: { message: 'Datos inválidos.', code: 'BAD_JSON' } },
      { status: 400 },
    )
  }
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { data: null, error: { message: 'Escribí un mensaje (hasta 1000 caracteres).', code: 'INVALID' } },
      { status: 400 },
    )
  }

  // 4. Gate de plan por request (fuente única, VOTACION d.17): decide trial vs premium.
  const esPrem = await esPremium(session.user.id)

  // 5. Reserva de cupo TOCTOU-safe (decisión 13): inserta el mensaje = la reserva.
  let reserva
  try {
    reserva = await reservarCupo({
      userId: session.user.id,
      esPrem,
      conversationId: parsed.data.conversationId ?? null,
      modo: parsed.data.modo ?? 'chat',
      contenido: parsed.data.message,
    })
  } catch (err) {
    if (err instanceof CupoError) {
      const r = RESPUESTA_CUPO[err.code]
      return Response.json(
        { data: null, error: { message: r.message, code: err.code } },
        { status: r.status },
      )
    }
    console.error('[api/chat] reserva falló:', err)
    return Response.json(
      { data: null, error: { message: 'No pudimos procesar el mensaje.', code: 'RESERVE_FAILED' } },
      { status: 500 },
    )
  }

  // 6. Stream SSE del turno (deltas, estado, lugares, [DONE]). El id de la
  // conversación viaja en un header para que el cliente lo retome.
  const stream = streamChatTurn({
    conversationId: reserva.conversationId,
    userId: session.user.id,
    esPrem,
    reservaMessageId: reserva.messageId,
    plan: reserva.plan,
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Conversation-Id': reserva.conversationId,
    },
  })
}
