import { auth } from '@/lib/auth'
import { toNextJsHandler } from 'better-auth/next-js'
import { isDisposableEmail } from '@/lib/auth/disposableEmails'
import { checkAuthRateLimit } from '@/lib/middleware/rate-limit'
import { NextRequest } from 'next/server'

const { GET, POST: authPost } = toNextJsHandler(auth)

export { GET }

export async function POST(req: NextRequest) {
  // Rate limit propio en memoria (decisión 23): 20 POST/hora por IP.
  const limited = checkAuthRateLimit(req)
  if (limited) return limited

  const url = new URL(req.url)

  if (url.pathname.endsWith('/sign-up/email')) {
    const cloned = req.clone()
    try {
      const body = await cloned.json()
      if (body?.email && isDisposableEmail(body.email)) {
        // Shape top-level `{ message, code }` — es lo que el cliente de better-auth
        // parsea hacia result.error; el shape anidado hace caer al form en el
        // fallback genérico (cicatriz BUG-027 de StressPlan).
        return Response.json(
          {
            message: 'Usá un email permanente para registrarte.',
            code: 'DISPOSABLE_EMAIL',
          },
          { status: 400 },
        )
      }
    } catch {
      // body no parseable — que lo maneje better-auth
    }
  }

  return authPost(req)
}
