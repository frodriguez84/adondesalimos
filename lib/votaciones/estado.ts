import type { PollStatus } from '@/lib/db/schema'
import { VOTACION_TTL_HORAS } from './constantes'

/**
 * El estado temporal de una votación, puro y sin DB (decisión 11). Vive acá y no
 * en la query porque es la parte con casos de borde reales —una votación vencida
 * sigue con `status='open'` en la columna— y así se testea sin base.
 *
 * La regla clave: **"activa" no es solo el status**. Una votación cuyo
 * `expires_at` ya pasó cuenta como cerrada aunque su columna `status` siga
 * `'open'`; la expiración se resuelve **perezosa al leer**, sin cron.
 */

type EstadoTemporal = { status: PollStatus; expiresAt: Date }

/** Cuándo expira una votación creada en `createdAt` (decisión 11). */
export function expiracionDesde(createdAt: Date): Date {
  return new Date(createdAt.getTime() + VOTACION_TTL_HORAS * 60 * 60 * 1000)
}

/** Abierta y no vencida: se puede votar, cuenta para el gate "1 activa". */
export function estaActiva(poll: EstadoTemporal, ahora: Date): boolean {
  return poll.status === 'open' && poll.expiresAt.getTime() > ahora.getTime()
}

/**
 * Vencida por tiempo pero todavía marcada `'open'` en la base. Es el caso en el
 * que la lectura tiene que persistir el cierre perezoso (best-effort) y mostrar
 * la votación en modo solo-lectura.
 */
export function estaExpirada(poll: EstadoTemporal, ahora: Date): boolean {
  return poll.status === 'open' && poll.expiresAt.getTime() <= ahora.getTime()
}

/**
 * Cómo se muestra una votación al leerla, ya resuelta la expiración perezosa.
 * `'open'` solo si de verdad sigue activa; una `'open'` vencida se ve `'expired'`.
 */
export type EstadoVisible = 'open' | 'closed' | 'cancelled' | 'expired'

export function estadoVisible(poll: EstadoTemporal, ahora: Date): EstadoVisible {
  if (poll.status === 'cancelled') return 'cancelled'
  if (poll.status === 'closed') return 'closed'
  return estaActiva(poll, ahora) ? 'open' : 'expired'
}

/** ¿Se puede votar? Solo si está genuinamente activa (decisión 8/15). */
export function sePuedeVotar(poll: EstadoTemporal, ahora: Date): boolean {
  return estaActiva(poll, ahora)
}

/**
 * Cuánto falta para que cierre, en palabras (INVITACION, decisión 5 —
 * `PBETA-R2-06`): el invitado no sabía que las votaciones **vencen solas a las
 * 72 h**, así que no sabía si tenía 5 minutos o dos días.
 *
 * Es **relativo y sin huso horario a propósito**: una fecha absoluta obligaría a
 * pasar por la hora de AR (`partesEnAR`, `lib/negocio/horarios.ts`) y sumaría un
 * consumidor a esa regla para una pregunta que no lo necesita — lo que se quiere
 * saber es *si da el tiempo*, y eso es una resta. Vive acá porque este módulo ya
 * es el dueño de lo temporal de una votación, y así se testea sin base.
 *
 * **Siempre redondea para abajo**: nunca promete más tiempo del que hay.
 * Devuelve `null` si ya venció — esa votación se muestra en modo cerrado y no
 * tiene plazo que anunciar.
 */
export function cierreEnPalabras(expiresAt: Date, ahora: Date): string | null {
  const ms = expiresAt.getTime() - ahora.getTime()
  if (ms <= 0) return null

  const horas = Math.floor(ms / (60 * 60 * 1000))
  const dias = Math.floor(horas / 24)

  if (dias >= 1) return `Cierra en ${dias} ${dias === 1 ? 'día' : 'días'}`
  if (horas >= 1) return `Cierra en ${horas} ${horas === 1 ? 'hora' : 'horas'}`
  return 'Cierra en menos de una hora'
}
