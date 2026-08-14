/**
 * ¿El «Volver» de una pantalla hace `back` o sube a la home? (NAVEGACION,
 * decisiones 5, 6 y 9). **Dueño único** de esa regla: nadie llama `router.back()`
 * suelto — hoy el único llamador es `components/lugar/ficha-actions.tsx` y pasa
 * por acá.
 *
 * El problema que arregla está medido: en entrada fría (el link de WhatsApp, que
 * es el loop viral del producto) `/lugar/<id>` → «Volver» dejaba `about:blank`.
 * En `standalone` no hay barra de URL que dé una salida.
 *
 * **Cómo se detecta «hay historia propia»**, y por qué así: `history.state` de
 * Next **no sirve** (solo trae `__NA` y `__PRIVATE_NEXTJS_INTERNALS_TREE`,
 * internals privados) y `document.referrer` **tampoco** (`""` en entrada fría, y
 * no cambia en navegación client-side). Las dos se midieron y se descartaron —
 * no re-intentarlas. Queda un marcador propio por pestaña, con **guardia doble**:
 * el marcador vive en `sessionStorage`, que se **clona** al abrir una pestaña
 * nueva desde un link, así que solo puede venir mentido; por eso además se exige
 * `history.length > 1`.
 */
const CLAVE_ENTRADA = 'ads:pantalla-de-entrada'

export type Volver = 'atras' | 'subir'

/**
 * La decisión, pura y testeable sin browser. `atras` vuelve al listado **con los
 * filtros puestos**, que es el contexto que subir siempre perdería.
 */
export function decidirVolver({
  navegoEnLaApp,
  historyLength,
}: {
  navegoEnLaApp: boolean
  historyLength: number
}): Volver {
  return navegoEnLaApp && historyLength > 1 ? 'atras' : 'subir'
}

/**
 * ¿Hay una pantalla de la app detrás de esta? Se compara contra la pantalla por
 * la que **entró** la pestaña, y no con un booleano "hubo alguna navegación",
 * porque el booleano se prende con la subida del propio «Volver»: medido en vivo,
 * `ficha en frío → Volver → home → back físico → Volver` volvía a dejar
 * `about:blank` — el mismo agujero que este spec cierra, tres toques más tarde.
 *
 * Se compara **pathname**, no URL: filtrar cambia la query y no es una pantalla
 * nueva (decisión 1).
 */
export function hayPantallaDetras({
  pathnameDeEntrada,
  pathnameActual,
}: {
  pathnameDeEntrada: string | null
  pathnameActual: string
}): boolean {
  return pathnameDeEntrada !== null && pathnameDeEntrada !== pathnameActual
}

/** La pantalla por la que entró la pestaña. Solo la primera gana. */
export function marcarPantalla(pathname: string): void {
  if (typeof window === 'undefined') return
  try {
    if (window.sessionStorage.getItem(CLAVE_ENTRADA) === null) {
      window.sessionStorage.setItem(CLAVE_ENTRADA, pathname)
    }
  } catch {
    // Modo privado o storage lleno: se degrada a subir a la home, que nunca
    // atrapa al usuario. El costo es perder los filtros, no la salida.
  }
}

export function huboNavegacionEnLaApp(pathnameActual: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return hayPantallaDetras({
      pathnameDeEntrada: window.sessionStorage.getItem(CLAVE_ENTRADA),
      pathnameActual,
    })
  } catch {
    return false
  }
}
