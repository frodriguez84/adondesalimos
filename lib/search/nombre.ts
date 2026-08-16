import { sql, type AnyColumn, type SQL } from 'drizzle-orm'
import { places } from '@/lib/db/schema'

/**
 * Match por NOMBRE de lugar — fuente única (BUSQUEDA, decisión 15).
 *
 * Vivía privado en `lib/search/query.ts`; se extrajo tal cual (sin cambio de
 * comportamiento) cuando la curaduría necesitó el mismo match para su buscador de
 * admin (CURADURIA_POR_NOMBRE, decisión 4). Quien tenga que buscar un lugar por
 * nombre consume esto: escribir un `LIKE '%…%'` al lado sería una segunda
 * implementación de la regla, y peor — sin acentos ni tolerancia a typos.
 */

/** Sin acentos y en minúsculas; hay un índice GIN sobre esta misma expresión. */
export function normalizado(expr: SQL | AnyColumn) {
  return sql`immutable_unaccent(lower(${expr}))`
}

/**
 * `word_similarity` y no `similarity`: compara el término contra la mejor
 * subcadena del nombre, así "parrila" encuentra "Parrila El Juanca" aunque el
 * nombre entero sea mucho más largo que el término. Medido: 877 matches contra
 * 611 de `similarity`, y usa el mismo índice GIN.
 */
export function simKey(q: string) {
  return sql<number>`word_similarity(${normalizado(sql`${q}`)}, ${normalizado(places.name)})`
}

/**
 * El predicado del match: "el término aparece, con tolerancia, en el nombre".
 *
 * `minimo` sube la exigencia por encima del umbral de `<%` (0,6 por default en
 * Postgres) para las pantallas donde un match flojo cuesta caro. **No es una
 * segunda regla**: es la misma, con el piso como parámetro — el día que el match
 * cambie, cambia acá para todos.
 */
export function coincideNombre(q: string, minimo?: number): SQL {
  const predicado = sql`${normalizado(sql`${q}`)} <% ${normalizado(places.name)}`
  // Con paréntesis: devuelve UN predicado, no dos pegados. Sin ellos, el día que
  // alguien lo meta dentro de un `or()` el `and` se le escapa y el filtro se cae.
  return minimo === undefined ? predicado : sql`(${predicado} and ${simKey(q)} >= ${minimo})`
}
