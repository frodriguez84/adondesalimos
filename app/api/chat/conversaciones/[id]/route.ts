import { and, asc, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { chatConversations, chatMessages } from '@/lib/db/schema'
import { validarGrounding } from '@/lib/ai/grounding'
import { cardsPorIds, type LugarCard } from '@/lib/ai/tools'

/**
 * `GET /api/chat/conversaciones/[id]` — devuelve una conversación del usuario con
 * sus mensajes, para **retomar** el hilo en la UI (CHAT_IA F2, decisión 7). Las
 * cards de cada mensaje del assistant se reconstruyen enriqueciendo los marcadores
 * `[[lugar:id]]` ya persistidos (reusa `validarGrounding` + `cardsPorIds` — no hay
 * segunda implementación del grounding). Solo la conversación propia (entra por
 * `user_id`).
 *
 * `DELETE /api/chat/conversaciones/[id]` — borra una conversación del usuario
 * (CHAT_IA, decisión 7). El `ON DELETE CASCADE` se lleva sus mensajes.
 *
 * **Borrar contenido, nunca cupo** (decisión 14): esto NO toca `chat_usage_monthly`
 * ni `users.chat_trial_used` — el consumo se cuenta aparte, así borrar no devuelve
 * cupo (evita el exploit del free). Solo borra lo del propio usuario (el `and` con
 * `user_id` es la autorización).
 */

export const dynamic = 'force-dynamic'

export type MensajeRetomado = {
  role: 'user' | 'assistant'
  content: string
  lugares: LugarCard[]
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const session = await auth.api.getSession({ headers: request.headers }).catch(() => null)
  if (!session?.user) {
    return Response.json(
      { data: null, error: { message: 'Iniciá sesión.', code: 'NO_SESSION' } },
      { status: 401 },
    )
  }

  const [conv] = await db
    .select({
      id: chatConversations.id,
      titulo: chatConversations.titulo,
      modo: chatConversations.modo,
      seen: chatConversations.seenPlaceIds,
    })
    .from(chatConversations)
    .where(and(eq(chatConversations.id, id), eq(chatConversations.userId, session.user.id)))
    .limit(1)

  if (!conv) {
    return Response.json(
      { data: null, error: { message: 'No encontramos esa conversación.', code: 'NOT_FOUND' } },
      { status: 404 },
    )
  }

  const filas = await db
    .select({ role: chatMessages.role, content: chatMessages.content })
    .from(chatMessages)
    .where(eq(chatMessages.conversationId, id))
    .orderBy(asc(chatMessages.createdAt))

  // Enriquecido de cards en una sola pasada a DB: se juntan los ids citados de todos
  // los mensajes, se traen las cards de una y se reparten en el orden de cita de cada
  // mensaje. Los marcadores ya fueron validados al persistir, pero se re-valida contra
  // `seen_place_ids` por las dudas (mismo candado b).
  const seen = new Set(conv.seen ?? [])
  const idsPorMensaje = filas.map((f) =>
    f.role === 'assistant' ? validarGrounding(f.content, seen).idsValidos : [],
  )
  const todosLosIds = [...new Set(idsPorMensaje.flat())]
  const cards = await cardsPorIds(todosLosIds)
  const cardPorId = new Map(cards.map((c) => [c.id, c]))

  const mensajes: MensajeRetomado[] = filas.map((f, i) => ({
    role: f.role as 'user' | 'assistant',
    content: f.content,
    lugares: idsPorMensaje[i]
      .map((pid) => cardPorId.get(pid))
      .filter((c): c is LugarCard => c !== undefined),
  }))

  return Response.json({
    data: { id: conv.id, titulo: conv.titulo, modo: conv.modo, mensajes },
    error: null,
  })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const session = await auth.api.getSession({ headers: request.headers }).catch(() => null)
  if (!session?.user) {
    return Response.json(
      { data: null, error: { message: 'Iniciá sesión.', code: 'NO_SESSION' } },
      { status: 401 },
    )
  }

  const borradas = await db
    .delete(chatConversations)
    .where(and(eq(chatConversations.id, id), eq(chatConversations.userId, session.user.id)))
    .returning({ id: chatConversations.id })

  if (borradas.length === 0) {
    return Response.json(
      { data: null, error: { message: 'No encontramos esa conversación.', code: 'NOT_FOUND' } },
      { status: 404 },
    )
  }

  return Response.json({ data: { id }, error: null })
}
