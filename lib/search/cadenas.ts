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
 * La lista del seed: **43 nombres** (decisión 14). Nació con 22 el 2026-08-10 —los 19
 * del anexo del spec más tres variantes que el umbral de 8 se pierde y un humano
 * reconoce (`mc donalds`, `starbucks argentina`, `burger king argentina`)— y ese mismo
 * día sumó 21 tras correr el detector contra el catálogo completo.
 *
 * Van **normalizadas** —minúsculas y sin acentos, como las emite el generador—,
 * aunque el match tolera que un humano escriba «Café Martínez» en el `UPDATE`:
 * la comparación normaliza los dos lados (ver `esCadenaSql`).
 *
 * **Esto es la semilla, no la verdad.** Manda `app_settings['search.cadenas']`, que se
 * edita con un `UPDATE` sin deploy — y hay **dos bases**: un cambio acá no llega solo a
 * producción (lección del 2026-08-10). Quedan **afuera** a propósito las cadenas chicas
 * que sí son un buen plan (Antares, La Birra Bar, Lattente, Tostado Café Club) y las
 * que se listan en `EXCLUIDAS_A_PROPOSITO`.
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

  // --- Segunda tanda (2026-08-10): las 21 que el detector veía y la lista no ---
  // Aceptadas por Fer tras medir que **todas comparten un dominio web propio y
  // dominante** (`lo de carlitos` 19/19 en `lodecarlitos.com`, `rincon norteno` 10/10):
  // el dato descartó la sospecha de que fueran homónimos. La pregunta dejó de ser
  // "¿es cadena?" y pasó a ser "¿la despriorizo?", que es la decisión 5.
  'mccafe',
  'la continental',
  'la farola express',
  'taco box',
  'sushiclub',
  'betos',
  'el noble',
  'deniro',
  'green eat',
  'dean & dennys',
  "wendy's",
  'sensu',
  'delicity',
  'romario',
  'pizza lo+hot',
  'tomasso pizzas',
  // Cafeterías de cadena. Van porque sus pares **ya estaban** (The Coffee Store, Le
  // Pain Quotidien, Brioche Dorée): dejarlas afuera le daría mejor trato a unas que a
  // otras por accidente de cuándo se armó la lista.
  'tienda de cafe',
  'tea connection',
  'le ble',
  'nucha',
  'croque madame',
]

/**
 * Cadenas que el detector encuentra y que **quedan afuera a propósito** (2026-08-10).
 * Se escriben acá para que la próxima corrida de `npm run cadenas:proponer` no las
 * vuelva a proponer como novedad y alguien las sume sin saber que ya se decidió:
 *
 *  - `tostado cafe club` y `cervelar` — la **decisión 15 del spec las nombra** entre las
 *    cadenas chicas que **sí son un buen plan** (junto a Antares, La Birra Bar, Lattente).
 *    El usuario no se quejó de "cadena", se quejó de fast food genérico.
 *  - `cinemark hoyts argentina` — son **cines**, no gastronomía; ir al cine es un plan
 *    legítimo y despriorizarlo es otra discusión.
 *  - `lo de carlitos`, `mi gusto`, `la fabrica`, `rincon norteno` — cadenas de bodegón y
 *    rotisería. Quedaron sin decidir: no está claro que sean "fast food genérico".
 */
export const EXCLUIDAS_A_PROPOSITO: string[] = [
  'tostado cafe club',
  'cervelar',
  'cinemark hoyts argentina',
  'lo de carlitos',
  'mi gusto',
  'la fabrica',
  'rincon norteno',
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
