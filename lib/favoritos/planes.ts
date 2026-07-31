import { and, asc, eq } from 'drizzle-orm'
import { db, type DbOrTx } from '@/lib/db'
import { getSetting } from '@/lib/db/settings'
import { placeLists, type PlaceList } from '@/lib/db/schema'
import { esPremium } from '@/lib/votaciones/planes'

/**
 * **Dueño único de la regla de cupo de favoritos** (FAVORITOS, decisión 5).
 *
 * Nadie más decide cuántas listas puede tener un usuario ni cuáles ve. Si esta
 * regla aparece escrita en un segundo lugar, es el cleanup de máxima prioridad
 * (CLAUDE.md § Una regla, un dueño).
 *
 * Lo que **no** vive acá: el gate de plan en sí. Eso es `esPremium`
 * (`lib/votaciones/planes.ts`), que se reusa y no se duplica.
 */

/** Cuántas listas puede crear un usuario premium (decisión 3). */
export const MAX_LISTAS_PREMIUM_KEY = 'favoritos.max_listas_premium'
/** Techo anti-abuso de lugares por lista. Ningún humano lo toca. */
export const MAX_ITEMS_POR_LISTA_KEY = 'favoritos.max_items_por_lista'

/**
 * Free = **una** lista, la default. Constante en código y no en `app_settings` a
 * propósito: no es un cupo a tunear, es la *definición* del plan free y el gancho
 * comercial entero. Cambiarlo es una decisión de producto con deploy, no un UPDATE.
 */
export const MAX_LISTAS_FREE = 1

/**
 * Defaults en código, pisables por una fila de `app_settings` sin deploy (mismo
 * patrón que `getConfidenceThreshold` y los cupos del chat). **La fila puede no
 * existir**: en una base que no corrió el seed nuevo, el feature tiene que nacer
 * funcionando igual.
 *
 * 10 listas es holgado para el uso real ("birras", "citas", "con los viejos") sin
 * volverse un gestor de carpetas; 200 ítems es red anti-abuso, no fricción.
 * Los dos **suben** sin traición: subir un cupo es un regalo, bajarlo no.
 */
export const DEFAULT_MAX_LISTAS_PREMIUM = 10
export const DEFAULT_MAX_ITEMS_POR_LISTA = 200

async function getNumber(key: string, fallback: number, database?: DbOrTx): Promise<number> {
  const value = await getSetting<number>(key, database)
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/** Tope de listas de un premium. Un UPDATE lo cambia en caliente. */
export function getMaxListasPremium(database?: DbOrTx): Promise<number> {
  return getNumber(MAX_LISTAS_PREMIUM_KEY, DEFAULT_MAX_LISTAS_PREMIUM, database)
}

/** Tope de lugares por lista, para cualquier plan. */
export function getMaxItemsPorLista(database?: DbOrTx): Promise<number> {
  return getNumber(MAX_ITEMS_POR_LISTA_KEY, DEFAULT_MAX_ITEMS_POR_LISTA, database)
}

/** Cuántas listas puede tener este usuario **hoy**, según su plan. */
export async function maxListasDelUsuario(userId: string, tx: DbOrTx = db): Promise<number> {
  return (await esPremium(userId, tx)) ? getMaxListasPremium(tx) : MAX_LISTAS_FREE
}

/**
 * Las listas que el usuario **ve**, en orden: la default primero, después por
 * fecha de creación.
 *
 * Acá se aplica la decisión 4 — **bajar de plan oculta, no borra**. Un premium
 * con 5 listas que vuelve a `free` ve solo su default; las otras siguen en la
 * base, invisibles, y reaparecen intactas al volver a premium. Mismo invariante
 * que el contenido pago del dueño: ocultar ≠ borrar, en los dos ejes.
 *
 * **Nunca** un DELETE disparado por un cambio de plan. El recorte es de lectura.
 *
 * El orden del recorte importa: se cortan las **últimas** creadas, así el usuario
 * que vuelve a premium recupera lo mismo que perdió y no una selección al azar.
 */
export async function listasVisibles(userId: string, tx: DbOrTx = db): Promise<PlaceList[]> {
  const [todas, max] = await Promise.all([
    tx
      .select()
      .from(placeLists)
      .where(eq(placeLists.userId, userId))
      // La default primero (`is_default desc` no existe en booleanos de forma
      // portable acá): se ordena por fecha y se reacomoda abajo.
      .orderBy(asc(placeLists.createdAt)),
    maxListasDelUsuario(userId, tx),
  ])

  const ordenadas = [
    ...todas.filter((l) => l.isDefault),
    ...todas.filter((l) => !l.isDefault),
  ]
  return ordenadas.slice(0, max)
}

/** La lista default del usuario, o null si todavía no guardó nada (decisión 2). */
export async function listaDefault(userId: string, tx: DbOrTx = db): Promise<PlaceList | null> {
  const [fila] = await tx
    .select()
    .from(placeLists)
    .where(and(eq(placeLists.userId, userId), eq(placeLists.isDefault, true)))
    .limit(1)
  return fila ?? null
}
