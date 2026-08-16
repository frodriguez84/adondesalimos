/**
 * El guardado que quedó del otro lado del login (PULIDO_BETA, PBETA-R3-03).
 *
 * Tocar "Guardar" sin cuenta manda a `/login`, y hasta ahora la acción se perdía
 * en el camino: el usuario pagaba el peaje de registrarse y volvía a una lista
 * donde el lugar seguía sin guardar. Acá vive **la única** definición de ese
 * pendiente; lo deja `BotonGuardar` y lo consume `ReanudarGuardado`.
 *
 * Va en `sessionStorage` y no en la URL: mismo patrón que la shortlist del chat
 * (`SHORTLIST_STORAGE_KEY`), y así un link de un tercero no puede guardarle un
 * lugar a nadie.
 *
 * **Enmienda (`PBETA-R3-07`, 2026-08-16).** `sessionStorage` es **por pestaña**, y
 * en un alta nueva el usuario vuelve por el link de un mail —que casi siempre abre
 * otra pestaña, otra app u otro navegador—: ahí el pendiente no existe y el lugar
 * que motivó todo el registro se pierde. Para ese caso, y **solo** para ese, el
 * pendiente viaja en el `callbackURL` del mail de verificación como
 * `?guardar=<id>`. El vector que la decisión original evitaba sigue cubierto por
 * otro lado: al aterrizar con ese parámetro **no se guarda nada solo** — se pide
 * un toque (`ReanudarGuardado`), así un link ajeno no escribe en la lista de
 * nadie. `localStorage` no servía: cruza pestañas del mismo navegador pero no el
 * webview del cliente de correo, y deja el pendiente colgado para la próxima visita.
 */
const CLAVE = 'ads:guardar-pendiente'

/** Cómo se llama el pendiente cuando viaja en la URL (ver enmienda de arriba). */
export const PARAM_PENDIENTE = 'guardar'

/**
 * El `callbackURL` del mail de verificación con el pendiente colgado: conserva a
 * dónde volvía el usuario (su búsqueda) y le suma el lugar. Devuelve una ruta
 * relativa —el origen es solo para poder parsear— porque es lo que espera
 * better-auth y lo que evita mandar a nadie fuera del sitio.
 */
export function destinoConPendiente(callbackUrl: string, placeId: string): string {
  try {
    const url = new URL(callbackUrl, 'http://local')
    url.searchParams.set(PARAM_PENDIENTE, placeId)
    return `${url.pathname}${url.search}`
  } catch {
    return `/?${PARAM_PENDIENTE}=${encodeURIComponent(placeId)}`
  }
}

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
