import { and, inArray } from 'drizzle-orm'
import { db, type DbOrTx } from '@/lib/db'
import { placeListItems } from '@/lib/db/schema'
import { listasVisibles } from './planes'

/**
 * Lecturas de favoritos (FAVORITOS F1).
 *
 * **Fuera del motor de búsqueda, a propósito** (decisión de pre-vuelo P1): el
 * spec promete que `lib/search/query.ts` no se toca, y guardar no cambia el orden
 * ni los chips — el estado "guardado" no es del lugar, es de quien mira. Se
 * resuelve con los ids ya obtenidos, donde se los tenga a mano: el server
 * component de `/`, la ficha y `/api/search` (que sirve las páginas del scroll).
 */

/**
 * Qué lugares de esta página ya tiene guardados el usuario (decisión 9).
 *
 * **Un `inArray` por página, no una query por card**: mismo criterio que
 * `tagsDeLugares` en el motor. Con 20 cards son 20 ids en una query, no 20
 * round-trips.
 *
 * Pasa por `listasVisibles` y no por `place_lists` derecho: un lugar guardado en
 * una lista que quedó **escondida por bajar de plan** no cuenta como guardado
 * (decisión 4). Si contara, el botón mostraría "guardado" algo que `sacarLugar`
 * —que también opera solo sobre visibles— no podría sacar: la pantalla mentiría.
 * Volver a premium lo devuelve solo, sin tocar una fila.
 *
 * Devuelve un `string[]` y no un `Set` porque cruza el boundary server→cliente:
 * un `Set` no es serializable en props de React.
 */
export async function guardadosDeLaPagina(
  userId: string,
  placeIds: string[],
  database: DbOrTx = db,
): Promise<string[]> {
  if (placeIds.length === 0) return []

  const visibles = await listasVisibles(userId, database)
  if (visibles.length === 0) return []

  const filas = await database
    .selectDistinct({ placeId: placeListItems.placeId })
    .from(placeListItems)
    .where(
      and(
        inArray(
          placeListItems.listId,
          visibles.map((l) => l.id),
        ),
        inArray(placeListItems.placeId, placeIds),
      ),
    )

  return filas.map((f) => f.placeId)
}
