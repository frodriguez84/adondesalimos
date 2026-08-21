import { TIPO } from '@/lib/db/taxonomy'

/**
 * El copy de las páginas de `/salir` — **dueño único** (SEO, decisión 6).
 *
 * ⚠️ **La regla que defiende este archivo es "cero prosa generada".** Todo lo que
 * sale de acá es una plantilla sobre **datos** —un conteo real, un nombre de zona
 * del canon, un nombre de tipo de la taxonomía—: ni una frase de color, ni un
 * párrafo escrito por un LLM. No es purismo. 255 páginas de plantilla con un
 * párrafo inventado cada una es la definición literal de *doorway page* en la guía
 * de Google, y lo que salva a estas páginas de serlo es que el cuerpo son los
 * lugares de verdad. Si alguna vez alguien quiere "que la página respire", la
 * respuesta es más datos, no más adjetivos.
 *
 * Módulo puro: no toca la base y por eso se testea sin montar nada.
 */

/** El nombre de la app tal como cierra un `<title>`. */
export const MARCA = '¿A dónde salimos?'

/**
 * Plural de cada Tipo, escrito a mano — **son diez y es data, no prosa**.
 *
 * Existe porque `lib/db/taxonomy.ts` guarda el singular («Bar», «Cervecería»),
 * que es lo que va en un chip de filtro, y un `<h1>` de landing necesita el plural
 * («Bares en Palermo Soho»). Pluralizar en castellano por regla es un pozo
 * (`Café → Cafés`, `Wine bar / vinoteca → Wine bars y vinotecas`): diez entradas
 * a mano son más honestas y más cortas que cualquier heurística.
 *
 * ⚠️ Si la taxonomía suma un Tipo, sumarlo acá. Hay un test que falla si falta.
 */
export const PLURAL_TIPO: Record<string, string> = {
  restaurante: 'Restaurantes',
  bar: 'Bares',
  cerveceria: 'Cervecerías',
  cafe: 'Cafés',
  'wine-bar': 'Wine bars y vinotecas',
  boliche: 'Boliches',
  'patio-gastronomico': 'Patios gastronómicos',
  'teatro-espacio-cultural': 'Teatros y espacios culturales',
  'club-de-juegos': 'Clubes de juegos',
  'centro-entretenimiento': 'Centros de entretenimiento',
}

/** Nombre del Tipo en la taxonomía, por slug. Fallback honesto: el slug. */
const NOMBRE_TIPO = new Map(TIPO.map((t) => [t.slug, t.name]))

/** «bar» → «Bares». Un slug desconocido cae al nombre de la taxonomía. */
export function pluralDeTipo(slug: string): string {
  return PLURAL_TIPO[slug] ?? NOMBRE_TIPO.get(slug) ?? slug
}

/** «bar» → «Bar». El singular de la taxonomía, para cuando el conteo da 1. */
export function nombreDeTipo(slug: string): string {
  return NOMBRE_TIPO.get(slug) ?? slug
}

/** «Bares» → «bares». Solo la primera letra: «Wine bars y vinotecas» se respeta. */
export function enMinuscula(texto: string): string {
  return texto.charAt(0).toLowerCase() + texto.slice(1)
}

/** Número en formato es-AR («1.707»), que es el del producto. */
export function numero(n: number): string {
  return n.toLocaleString('es-AR')
}

// ---------------------------------------------------------------------------
// `/salir/<zona>`
// ---------------------------------------------------------------------------

/** `<h1>` del hub de una zona. */
export function h1DeZona(zona: string): string {
  return `Salir en ${zona}`
}

export function titleDeZona(zona: string): string {
  return `Salir en ${zona} — ${MARCA}`
}

/**
 * Bajada visible del hub: el conteo real y de dónde sale el orden. La segunda
 * frase no es relleno — es lo único honesto que se puede decir sobre por qué
 * estos lugares están arriba (`ORDEN_ORGANICO`).
 */
export function bajadaDeZona(total: number, zona: string): string {
  return `${numero(total)} ${total === 1 ? 'lugar publicado' : 'lugares publicados'} en ${zona}. Primero los que tenemos mejor cargados.`
}

/**
 * `<meta description>` del hub. Enumera hasta tres tipos **que existen de verdad
 * en esa zona** (salen de `paginasDeZonaTipo`), así las 46 descripciones son
 * distintas entre sí sin inventar una palabra.
 */
export function descripcionDeZona(total: number, zona: string, tiposSlugs: string[]): string {
  const cabeza = `${numero(total)} lugares para salir en ${zona}`
  const tipos = tiposSlugs.slice(0, 3).map((s) => enMinuscula(pluralDeTipo(s)))
  const cola = 'Con dirección, qué vas a encontrar y cómo llegar.'

  if (tipos.length === 0) return `${cabeza}. ${cola}`
  const lista = tipos.join(', ') + (tiposSlugs.length > 3 ? ' y más' : '')
  return `${cabeza}: ${lista}. ${cola}`
}

// ---------------------------------------------------------------------------
// `/salir/<zona>/<tipo>`
// ---------------------------------------------------------------------------

/** `<h1>` del combo: «Bares en Palermo Soho». Es la keyword, textual. */
export function h1DeZonaTipo(tipoSlug: string, zona: string): string {
  return `${pluralDeTipo(tipoSlug)} en ${zona}`
}

export function titleDeZonaTipo(tipoSlug: string, zona: string): string {
  return `${h1DeZonaTipo(tipoSlug, zona)} — ${MARCA}`
}

/**
 * Bajada visible: «Hay 142 bares publicados en Palermo Soho. Primero…».
 *
 * El singular existe aunque el piso sea 10: un combo puede caer por debajo entre
 * builds y la página sigue viva hasta la próxima revalidación (§ Edge cases). Un
 * «Hay 1 bares publicado» sería la clase de detalle que delata una plantilla.
 */
export function bajadaDeZonaTipo(total: number, tipoSlug: string, zona: string): string {
  const que = enMinuscula(total === 1 ? nombreDeTipo(tipoSlug) : pluralDeTipo(tipoSlug))
  return `Hay ${numero(total)} ${que} ${total === 1 ? 'publicado' : 'publicados'} en ${zona}. Primero los que tenemos mejor cargados.`
}

export function descripcionDeZonaTipo(total: number, tipoSlug: string, zona: string): string {
  const que = enMinuscula(total === 1 ? nombreDeTipo(tipoSlug) : pluralDeTipo(tipoSlug))
  return `${numero(total)} ${que} en ${zona}, con dirección, qué vas a encontrar y cómo llegar. Primero los que tenemos mejor cargados.`
}
