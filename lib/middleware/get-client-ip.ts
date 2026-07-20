/**
 * Portado de StressPlan (`lib/middleware/getClientIp.ts`) sin cambios de lógica:
 * el modelo de confianza aplica igual acá.
 *
 * Los headers de IP (`x-real-ip`, `x-forwarded-for`) los puede mandar cualquier
 * cliente. Confiar en ellos por default vuelve decorativo el rate limit: el
 * atacante rota el header y listo.
 *
 * Fail-closed: NO se lee ningún header salvo que la infra declare cuál
 * **sobrescribe** en cada request entrante, vía `TRUSTED_IP_HEADER` (en Vercel:
 * `x-real-ip`). Sin esa declaración todas las requests caen en el mismo bucket y
 * comparten cupo — spoofear no sirve de nada.
 *
 * Requisito de deploy: el proxy debe SOBRESCRIBIR, no hacer append. Si solo hace
 * append, dejar `TRUSTED_IP_HEADER` vacío: se pierde granularidad, no el límite.
 */
export const UNKNOWN_IP = 'unknown'

export function getClientIp(request: Request): string {
  const trustedHeader = process.env.TRUSTED_IP_HEADER?.trim()
  if (!trustedHeader) return UNKNOWN_IP

  const value = request.headers.get(trustedHeader)
  if (!value) return UNKNOWN_IP

  return value.split(',')[0].trim() || UNKNOWN_IP
}
