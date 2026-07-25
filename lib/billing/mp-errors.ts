/**
 * Mapeo de errores de la API de MercadoPago a mensajes de cara al usuario
 * (MONETIZACION, § Reuso — port de StressPlan, re-traducido al rioplatense).
 * MP devuelve `{ message, cause: [{ code, description }] }`; acá se extrae el
 * código y se traduce a algo que el dueño o el usuario entiendan.
 */

/** Parsea el body de error de la API de MP (`message` + `cause[]`). */
export function parseMpApiErrorBody(body: unknown): {
  message: string
  code: string | null
  userMessage: string
} {
  const b = body as {
    message?: string
    code?: string
    cause?: Array<{ code?: string; description?: string }>
  }
  const message = b.message ?? 'Error de Mercado Pago'
  const causeCode =
    b.cause?.[0]?.code ||
    (b.code && b.code.length > 0 ? b.code : null) ||
    (/([A-Z]+_\d+)/.exec(message)?.[1] ?? null)
  const userMessage = userMessageForMpCode(causeCode, message)
  return { message, code: causeCode, userMessage }
}

// Los mensajes son de cara al usuario FINAL (producción): nada de "titular APRO",
// "comprador de prueba" ni números de tarjeta de test — eso es guía de sandbox y va
// en comentarios, no en la UI. La guía de QA vive en el spec (decisión 31 / incógnita
// (b)) y en LECCIONES.
export function userMessageForMpCode(code: string | null, fallback: string): string {
  switch (code) {
    case 'CC_VAL_433':
      // En sandbox: antifraude de MP tras varios intentos (no es un bug — decisión 31);
      // se destraba esperando unos minutos o con otra tarjeta. En prod es el mismo
      // síntoma (MP no valida la tarjeta), así que el mensaje sirve para los dos.
      return (
        'Mercado Pago no pudo validar la tarjeta. Esperá unos minutos y probá de nuevo, ' +
        'o usá otra tarjeta. Si sigue, escribinos.'
      )
    case 'Invalid_payment_method':
    case 'Unsupported_credit_card_for_recurring_payment':
      return 'Esa tarjeta no se puede usar para una suscripción. Probá con otra.'
    default:
      if (fallback.includes('CC_VAL_433')) {
        return userMessageForMpCode('CC_VAL_433', fallback)
      }
      return fallback
  }
}
