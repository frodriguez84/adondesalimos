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
 * Techo **total** de opciones de una votación (SUGERIR_EN_VOTACION, decisión 2).
 *
 * Son dos constantes y no una a propósito: `MAX_OPCIONES` es lo que el **creador**
 * puede poner al armar la cancha (2-5, decisión 3 de VOTACION, que NO se revierte)
 * y esto es cuánto puede crecer con lo que suma el grupo. La preocupación original
 * ("más de 5 diluye") era el creador solo con 9 lugares; acá **cada opción extra
 * viene con alguien que la quiere**, que es lo que la vuelve votable. Llegado a
 * este techo, el botón de sugerir se apaga con el motivo a la vista.
 */
export const MAX_OPCIONES_TOTAL = 8

/**
 * Cuántas puede sumar un mismo dispositivo por votación (decisión 7). Evita que
 * uno solo se quede con todas las vacantes y deja margen para dos o tres que
 * aporten. Se cuenta por `voter_token` con el mismo trade-off asumido en la
 * decisión 7 de VOTACION: la cookie es evadible y está bien que lo sea.
 */
export const MAX_SUGERENCIAS_POR_VOTANTE = 2

/**
 * Traspaso de la shortlist armada por el chat IA → `/votacion/nueva` (CHAT_IA
 * decisión 21). El chat guarda los lugares elegidos bajo esta clave de
 * `sessionStorage` y navega; el picker los lee al montar y precarga los
 * `elegidos`. `sessionStorage` (no query) evita una URL con N ids y no ensucia
 * el historial. Los ids se **revalidan** server-side al crear (`isPlacePublished`,
 * VOTACION d.12): la precarga es cosmética, la doble red está en el POST.
 */
export const SHORTLIST_STORAGE_KEY = 'adonde:shortlist-ia'

/**
 * Cookie opaca por dispositivo del votante (decisión 7). Es **funcional** (dedupe
 * del voto), no analítica: no se cruza con métricas, no hay `user_id`, no rastrea
 * entre sitios. `httpOnly` + `SameSite=Lax`, larga duración, reutilizada entre
 * votaciones.
 */
export const VOTER_COOKIE = 'voter_id'
export const VOTER_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 año, en segundos
