import type { EvidenciaSitio } from './fetch-sitio'

/**
 * ¿La cita que devolvió el modelo está REALMENTE en el texto que se le pasó?
 * (SEGURIDAD `SEC-07`). Dueño único de esa regla: el auto-apply de
 * `suggestions.ts` la consulta y nadie más la reimplementa.
 *
 * **Por qué existe.** El auto-apply de la decisión 13 escribía a `place_tags`
 * con `source='admin'` toda sugerencia cuyo `evidence` fuera un string no vacío,
 * **sin compararlo nunca contra el texto scrapeado**. Como el texto viene de la
 * web del propio lugar —que su dueño controla— alcanzaba con una instrucción
 * plantada en la página para que el modelo emitiera tags con una cita inventada,
 * y un solo tag `admin` sube la banda del orden orgánico (de 2 a 3).
 *
 * **Qué logra y qué no.** No hace dócil al modelo: exige que la frase esté
 * escrita en la página. Eso mata el camino de la **cita fabricada** (el modelo ya
 * no puede respaldar un tag con algo que no leyó) y convierte el resto en
 * "mentir en tu propio sitio, en texto visible" — que es auditable con
 * `place_tag_suggestions.evidence` + `source_url` y es exactamente el input que
 * el sistema decidió creer. El tope por lugar de `suggestions.ts` acota lo que
 * queda.
 *
 * Falla del lado seguro: si no se puede verificar, la sugerencia **no se
 * descarta**, va a la cola manual (`pending`). Perder auto-apply cuesta un
 * minuto de Fer; auto-aplicar una cita inventada ensucia el orden del catálogo.
 */

/**
 * Piso de largo de una cita, ya normalizada. Por debajo no es una cita: es una
 * palabra suelta que aparece en cualquier página ("bar", "café") y
 * verificarla no prueba nada. Lo que no llega va a la cola manual.
 */
export const MIN_CITA = 10

/**
 * Normaliza para comparar: minúsculas y espacios colapsados. Nada más — no se
 * saca acentos ni puntuación a propósito, para que "café de especialidad" tenga
 * que estar escrito así y no valga cualquier variante.
 *
 * Los espacios se colapsan porque `htmlATexto` ya lo hizo con el texto scrapeado
 * y el modelo puede reproducir la frase con otro espaciado; el resto de la
 * comparación es literal.
 */
export function normalizarParaCotejar(texto: string): string {
  return texto.replace(/\s+/g, ' ').trim().toLowerCase()
}

/**
 * `true` si la cita aparece literalmente en alguna de las evidencias recolectadas.
 *
 * Se coteja contra **todas** las páginas del lugar, no solo contra la del
 * `source_url` que declaró el modelo: equivocarse de URL entre dos páginas del
 * mismo lugar es un error de atribución, no una cita inventada, y no amerita
 * mandar la sugerencia a la cola.
 */
export function citaVerificable(cita: string | null, evidencia: EvidenciaSitio[]): boolean {
  if (cita === null) return false
  const aguja = normalizarParaCotejar(cita)
  if (aguja.length < MIN_CITA) return false
  return evidencia.some((e) => normalizarParaCotejar(e.texto).includes(aguja))
}
