/**
 * Cómo se llama una votación, en un solo lugar (`INV-B`).
 *
 * Había **dos** implementaciones de la misma regla —`tituloDe()` en la página
 * pública y `tituloDeVotacion()` en el panel del creador— y daban resultados
 * distintos para la misma votación sin título: el invitado leía «¿A dónde
 * vamos?» y el creador «Congo Club Cultural · La Conga».
 *
 * La decisión (Fer, 2026-08-14) fue **unificar el dueño, no el resultado**:
 * siguen difiriendo, pero a propósito y desde acá. Encabezar una **página** y
 * distinguir filas de una **lista** son dos preguntas distintas: en el historial,
 * N filas «¿A dónde vamos?» se distinguirían solo por la fecha y el ganador. Por
 * eso las dos funciones se nombran por su rol — y nadie las reimplementa.
 */

/**
 * El H1 de la votación y su `og:title` (INVITACION, decisión 4), que son **uno
 * solo** y no se parten en dos strings.
 *
 * `PBETA-R2-04`: el fallback era la lista de nombres concatenada y ocupaba el
 * tercio superior de la pantalla —3 líneas a 390 px, 4 a 360— para repetir lo que
 * ya dicen las cards de abajo. Ahora es un texto fijo, y de paso deja de poder
 * desactualizarse cuando alguien suma un lugar (`PBETA-R2-13`).
 *
 * Los nombres no se pierden: siguen en la descripción del preview
 * («Votá entre X, Y, Z»), que es donde sirven.
 */
export function tituloDePagina(votacion: { title: string | null }): string {
  return votacion.title || '¿A dónde vamos?'
}

/**
 * El rótulo de una votación dentro de una **lista** (el panel del creador y su
 * historial). Sin título propio, los nombres son lo único que distingue una fila
 * de otra, así que acá el fallback sí son los nombres.
 *
 * En el historial llegan ya recortados a 2 y con el «…» si había más (decisión 2
 * del pulido de `VOTACION`).
 */
export function rotuloEnLista(title: string | null, nombres: string[], hayMas = false): string {
  return title || nombres.join(' · ') + (hayMas ? ' · …' : '')
}
