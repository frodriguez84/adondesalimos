/**
 * Gate de admin (decisión 8): **no hay tabla de roles**. Admin es el email que
 * coincide con `ADMIN_EMAIL`, y nada más.
 *
 * Regla dura del spec (edge case): con `ADMIN_EMAIL` sin setear, esto devuelve
 * `false` para todos — nunca un admin abierto por default. Por eso el chequeo de
 * "hay admin configurado" va primero y no se puede saltear con un email vacío.
 *
 * Sin imports a propósito: es la autorización del panel y tiene que poder
 * testearse sin levantar better-auth ni el cliente de mails. La versión con
 * sesión vive en `lib/auth/sesion.ts`.
 */

/** Decisión pura, sin `process.env`: es lo que se puede testear derecho. */
export function emailEsAdmin(
  email: string | null | undefined,
  adminEmail: string | null | undefined,
): boolean {
  const configurado = adminEmail?.trim().toLowerCase()
  if (!configurado) return false
  const candidato = email?.trim().toLowerCase()
  if (!candidato) return false
  return candidato === configurado
}

export function esAdmin(email: string | null | undefined): boolean {
  return emailEsAdmin(email, process.env.ADMIN_EMAIL)
}
