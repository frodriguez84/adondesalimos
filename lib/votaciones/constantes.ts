/**
 * Constantes de negocio de la votación (spec VOTACION). Puras y sin DB: las
 * comparten dominio, validación, UI y tests.
 */

/**
 * TTL de una votación (decisión 11): 72 h = un fin de semana entero para que el
 * grupo vote. Es una **constante documentada**, no un `app_settings`: moverla a
 * runtime es sobre-ingeniería para v1 — el día que haya que ajustarla, es un
 * cambio de una línea acá.
 */
export const VOTACION_TTL_HORAS = 72

/** Shortlist (decisión 3). Menos de 2 no es una votación; más de 5 diluye la decisión. */
export const MIN_OPCIONES = 2
export const MAX_OPCIONES = 5

/**
 * Cookie opaca por dispositivo del votante (decisión 7). Es **funcional** (dedupe
 * del voto), no analítica: no se cruza con métricas, no hay `user_id`, no rastrea
 * entre sitios. `httpOnly` + `SameSite=Lax`, larga duración, reutilizada entre
 * votaciones.
 */
export const VOTER_COOKIE = 'voter_id'
export const VOTER_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 año, en segundos
