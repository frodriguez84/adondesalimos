/**
 * El guardado que quedó del otro lado del login (PULIDO_BETA, PBETA-R3-03).
 *
 * Tocar "Guardar" sin cuenta manda a `/login`, y hasta ahora la acción se perdía
 * en el camino: el usuario pagaba el peaje de registrarse y volvía a una lista
 * donde el lugar seguía sin guardar. Acá vive **la única** definición de ese
 * pendiente; lo deja `BotonGuardar` y lo consume `ReanudarGuardado`.
 *
 * Va en `sessionStorage` y no en la URL a propósito: mismo patrón que la
 * shortlist del chat (`SHORTLIST_STORAGE_KEY`), y así un link de un tercero
 * (`/?guardar=<id>`) no puede guardarle un lugar a nadie.
 */
const CLAVE = 'ads:guardar-pendiente'

export function dejarPendiente(placeId: string): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(CLAVE, placeId)
  } catch {
    // Modo privado o storage lleno: se pierde la continuidad, no el recorrido.
  }
}

export function leerPendiente(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage.getItem(CLAVE)
  } catch {
    return null
  }
}

export function limpiarPendiente(): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(CLAVE)
  } catch {
    /* nada que hacer */
  }
}
