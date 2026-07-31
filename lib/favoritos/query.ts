import { and, desc, eq, inArray } from 'drizzle-orm'
import { db, type DbOrTx } from '@/lib/db'
import { placeListItems, placeZones, places, zones, type PlaceList } from '@/lib/db/schema'
import { getConfidenceThreshold } from '@/lib/db/settings'
import { isPlacePublished } from '@/lib/db/visibility'
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
  return guardadosEnListas(visibles, placeIds, database)
}

/** El núcleo, con las listas visibles ya resueltas. No se exporta: la regla de
 *  qué listas cuentan sigue entrando por una sola puerta (`listasVisibles`). */
async function guardadosEnListas(
  visibles: PlaceList[],
  placeIds: string[],
  database: DbOrTx,
): Promise<string[]> {
  if (visibles.length === 0 || placeIds.length === 0) return []

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

/** Una lista como destino posible de un guardado (lo que el sheet necesita). */
export type ListaDestino = { id: string; name: string; isDefault: boolean }

/**
 * Lo que el botón de guardar necesita saber de una pantalla: qué está guardado
 * **y a qué listas puede ir** (decisión 8 — el sheet aparece solo con más de una).
 *
 * Las dos cosas salen de la misma resolución de `listasVisibles`, así una pantalla
 * no paga dos veces la misma pregunta. Las páginas siguientes del scroll infinito
 * siguen usando `guardadosDeLaPagina`: las listas no cambian entre páginas y el
 * cliente ya las tiene.
 */
export async function estadoDeFavoritos(
  userId: string,
  placeIds: string[],
  database: DbOrTx = db,
): Promise<{ guardados: string[]; listas: ListaDestino[] }> {
  const visibles = await listasVisibles(userId, database)
  const guardados = await guardadosEnListas(visibles, placeIds, database)
  return {
    guardados,
    listas: visibles.map((l) => ({ id: l.id, name: l.name, isDefault: l.isDefault })),
  }
}

/** Un lugar dentro de una lista, con lo que la card necesita para dibujarse. */
export type LugarDeLista = {
  placeId: string
  name: string
  /** Zona primaria; puede no haber (ZONAS, decisión 17) — lo resuelve `ubicacionDeCard`. */
  zone: string | null
  locality: string | null
  /**
   * `false` = el lugar se despublicó después de guardarlo (decisión 11). **Sigue
   * en la lista**: se muestra atenuado y sin link, porque la ficha le daría 404.
   */
  publicado: boolean
}

export type ListaConLugares = ListaDestino & { lugares: LugarDeLista[] }

/**
 * Las listas visibles del usuario con sus lugares, para `/mis-lugares`.
 *
 * **La lista nunca se filtra por visibilidad** (decisión 11): un lugar
 * despublicado viene igual, con `publicado: false`, y la pantalla lo atenúa. Que
 * un guardado desaparezca sin explicación es peor que verlo tachado.
 *
 * Una query para todos los ítems de todas las listas, no una por lista.
 */
export async function listasDelUsuario(
  userId: string,
  database: DbOrTx = db,
): Promise<ListaConLugares[]> {
  const visibles = await listasVisibles(userId, database)
  if (visibles.length === 0) return []

  const [filas, threshold] = await Promise.all([
    database
      .select({
        listId: placeListItems.listId,
        placeId: places.id,
        name: places.name,
        locality: places.locality,
        zone: zones.name,
        operatingStatus: places.operatingStatus,
        confidence: places.confidence,
        publishOverride: places.publishOverride,
      })
      .from(placeListItems)
      .innerJoin(places, eq(places.id, placeListItems.placeId))
      .leftJoin(
        placeZones,
        and(eq(placeZones.placeId, places.id), eq(placeZones.isPrimary, true)),
      )
      .leftJoin(zones, eq(zones.id, placeZones.zoneId))
      .where(
        inArray(
          placeListItems.listId,
          visibles.map((l) => l.id),
        ),
      )
      // Más recientes primero (DoD § Página `/mis-lugares`).
      .orderBy(desc(placeListItems.createdAt)),
    getConfidenceThreshold(),
  ])

  const porLista = new Map<string, LugarDeLista[]>()
  for (const f of filas) {
    const actual = porLista.get(f.listId) ?? []
    actual.push({
      placeId: f.placeId,
      name: f.name,
      zone: f.zone,
      locality: f.locality,
      publicado: isPlacePublished(f, threshold),
    })
    porLista.set(f.listId, actual)
  }

  return visibles.map((l) => ({
    id: l.id,
    name: l.name,
    isDefault: l.isDefault,
    lugares: porLista.get(l.id) ?? [],
  }))
}
