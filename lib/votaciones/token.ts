/**
 * Token del link de una votación (decisión 10). La URL `/votacion/[token]` es la
 * *capability*: quien tiene el token, vota. Es **aleatorio y no adivinable**, y
 * está separado del `id` de la fila justamente para que el pk no sea el link —
 * así no se pueden enumerar votaciones ajenas.
 *
 * 16 bytes de `crypto.getRandomValues` en base64url ⇒ 22 chars, ~128 bits. Sin
 * dependencia nueva (`nanoid` no está instalado); mismo criterio de aleatoriedad
 * que `crypto.randomUUID` que ya usa `lib/auth`.
 */
export function generarTokenVotacion(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Buffer.from(bytes).toString('base64url')
}
