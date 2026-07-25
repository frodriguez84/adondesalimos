import { and, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { chatConversations } from '@/lib/db/schema'

/**
 * `DELETE /api/chat/conversaciones/[id]` — borra una conversación del usuario
 * (CHAT_IA, decisión 7). El `ON DELETE CASCADE` se lleva sus mensajes.
 *
 * **Borrar contenido, nunca cupo** (decisión 14): esto NO toca `chat_usage_monthly`
 * ni `users.chat_trial_used` — el consumo se cuenta aparte, así borrar no devuelve
 * cupo (evita el exploit del free). Solo borra lo del propio usuario (el `and` con
 * `user_id` es la autorización).
 */

export const dynamic = 'force-dynamic'

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
