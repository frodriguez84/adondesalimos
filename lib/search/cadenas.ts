import { cache } from 'react'
import { sql, type SQL } from 'drizzle-orm'
import { places } from '@/lib/db/schema'
import { getSetting } from '@/lib/db/settings'
import type { DbOrTx } from '@/lib/db'
import { normalizado } from './nombre'

/**
 * Quién es una cadena, a los efectos del orden orgánico (ORDEN_ORGANICO).
 *
 * **Dueño único de esa regla** (`CLAUDE.md` § Una regla, un dueño): nadie más lee
 * `search.cadenas` ni escribe un `IN (…)` de nombres al lado. Mismo tamaño y misma
 * forma que `lib/search/pintado.ts` — un módulo chico que el server consulta.
 *
 * **Por qué una lista y no un `COUNT` por nombre al vuelo** (decisión 5): (a) un
 * agregado global dentro del `ORDER BY` se paga en cada búsqueda, y (b) sobre todo,
 * quién es cadena **necesita criterio humano**. Havanna (110 locales) y Café Martínez
 * (95) son cadenas para cualquier detector y son opciones reales en el conurbano:
 * sacarlas tiene que ser un `UPDATE`, no un deploy. La lista la propone
 * `npm run cadenas:proponer` (`scripts/cadenas.ts`) y la acepta un humano.
 *
 * **Degradación silenciosa** (decisión 16): setting ausente, no-lista o con basura
 * adentro ⇒ lista vacía ⇒ ninguna cadena se despriorizá y el orden vuelve a no
 * distinguirlas, sin error y sin pantalla rota. Mismo criterio que `chips.schedule`.
 */

/** La clave de `app_settings` (decisión 5). Editable sin deploy. */
export const CADENAS_KEY = 'search.cadenas'

/**
 * La lista inicial del seed (decisión 14): los 19 nombres normalizados con ≥ 8
 * locales que midió el anexo del spec, más las tres variantes que el umbral de 8 se
 * pierde y un humano reconoce al toque (`mc donalds`, `starbucks argentina`,
 * `burger king argentina`).
 *
 * Van **normalizadas** —minúsculas y sin acentos, como las emite el generador—,
 * aunque el match tolera que un humano escriba «Café Martínez» en el `UPDATE`:
 * la comparación normaliza los dos lados (ver `esCadenaSql`).
 *
 * Quedan **afuera** a propósito las cadenas chicas que sí son un buen plan
 * (Antares, La Birra Bar, Lattente, Tostado Café Club): el usuario no se quejó de
 * «cadena», se quejó de fast food genérico (decisión 15).
 */
export const DEFAULT_CADENAS: string[] = [
  "mcdonald's",
  'mc donalds',
  'starbucks',
  'starbucks argentina',
  'burger king',
  'burger king argentina',
  'havanna',
  'subway',
  'cafe martinez',
  'sabores express',
  'mostaza',
  'bonafide',
  'kentucky',
  'club milanesa',
  'hamburguesas extremas',
  'fabric sushi',
  'el club de la milanesa',
  'le pain quotidien',
  'the coffee store',
  'brioche doree',
  'kfc',
  'almacen de pizzas',
]

/**
 * Lo que vino del `jsonb` → lista usable. **Entrada por entrada**, igual que
 * `validarReglas`: una basura entre dos nombres buenos se descarta sola en vez de
 * invalidar la lista entera. Un valor ausente (`null`) no es un error —es el caso
 * normal antes del seed— y no loguea nada.
 */
export function validarCadenas(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const limpias = raw
    .filter((n): n is string => typeof n === 'string')
    .map((n) => n.trim())
    .filter((n) => n.length > 0)
  return [...new Set(limpias)]
}

/**
 * La lista vigente. `React.cache` deduplica dentro de un mismo render/request —el
 * mismo dedupe que `getPlaceDetail`, no una caché entre requests—: la lista se lee
 * en cada búsqueda a propósito, para que un `UPDATE` cambie el orden sin redeploy.
 */
export const getCadenas = cache(async (database?: DbOrTx): Promise<string[]> =>
  validarCadenas(await getSetting<unknown>(CADENAS_KEY, database)),
)

/**
 * El predicado "este lugar es una cadena", para el `ORDER BY`.
 *
 * **Igualdad exacta sobre el nombre normalizado, nunca `LIKE` ni prefijo**
 * (decisión 6): un prefijo se comería «La Parrilla» al querer «La Parrilla del
 * Tío». La normalización sale de `lib/search/nombre.ts` —la misma que usa el match
 * por texto, no una segunda— y se aplica **a los dos lados**, así el nombre de la
 * lista matchea lo escriba quien lo escriba («Café Martínez» = `cafe martinez`).
 *
 * Lista vacía ⇒ `false`: nadie es cadena y la banda colapsa (decisión 16).
 */
export function esCadenaSql(cadenas: readonly string[]): SQL {
  if (cadenas.length === 0) return sql`false`
  return sql`${normalizado(places.name)} IN (
    SELECT ${normalizado(sql`c.nombre`)} FROM unnest(${sql.param([...cadenas])}::text[]) AS c(nombre)
  )`
}
