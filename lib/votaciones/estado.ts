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
