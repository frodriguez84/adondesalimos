import { desc, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { chatConversations } from '@/lib/db/schema'

/**
 * `GET /api/chat/conversaciones` — lista las conversaciones del usuario (CHAT_IA,
 * decisión 19), más recientes primero. Solo las propias: entra por `user_id`.
 */

export const dynamic = 'force-dynamic'
/** `SEC-17`: una lectura no puede retener su slot 300 s, que es el default sin esto. */
export const maxDuration = 15

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers }).catch(() => null)
  if (!session?.user) {
    return Response.json(
      { data: null, error: { message: 'Iniciá sesión.', code: 'NO_SESSION' } },
      { status: 401 },
    )
  }

  const conversaciones = await db
    .select({
      id: chatConversations.id,
      titulo: chatConversations.titulo,
      modo: chatConversations.modo,
      updatedAt: chatConversations.updatedAt,
    })
    .from(chatConversations)
    .where(eq(chatConversations.userId, session.user.id))
    .orderBy(desc(chatConversations.updatedAt))

  return Response.json({ data: conversaciones, error: null })
}
