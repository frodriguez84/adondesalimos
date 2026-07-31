import { and, eq, inArray, sql } from 'drizzle-orm'
import { db, type DbOrTx } from '@/lib/db'
import { placeListItems, placeLists, places, users, type PlaceList } from '@/lib/db/schema'
import type { Resultado } from '@/lib/claims/acciones'
import { getMaxItemsPorLista, listasVisibles, MAX_LISTAS_FREE, puedeCrearLista } from './planes'
import type {
  CrearListaPayload,
  GuardarLugarPayload,
  RenombrarListaPayload,
  SacarLugarPayload,
} from './validacion'

/**
 * Escrituras de favoritos (FAVORITOS F1). Mismo reparto que el resto del
 * proyecto: **todos los gates viven acá**, y el route handler queda como
 * adaptador (rate limit → sesión → validar forma → llamar → mapear código a
 * status). Se testea contra la base sin HTTP.
 *
 * Dos invariantes que no se negocian y por eso están escritos una sola vez:
 *
 * - **Nunca se opera sobre la lista de otro usuario.** El destino no sale del
 *   payload: sale de `listasVisibles(userId)`, que ya filtra por dueño. Un
 *   `listId` ajeno no es un 403 con explicación — es una lista que no existe.
 * - **Una lista escondida por bajar de plan no recibe escrituras.** Se resuelve
 *   solo, por usar `listasVisibles` en vez de leer `place_lists` derecho.
 */

const fallo = (code: string, message: string) => ({ ok: false as const, code, message })

/** Nombre de la lista que nace en el primer guardado (decisión 2). */
export const NOMBRE_LISTA_DEFAULT = 'Mis lugares'

export type LugarGuardado = {
  listId: string
  listName: string
  /**
   * `false` si el lugar ya estaba en esa lista. Es lo que decide si el contador
   * agregado `saves` suma: re-guardar no es un evento nuevo, y el contador mide
   * "cuánta gente lo guardó", no cuántos taps hubo.
   */
  nuevo: boolean
}

/**
 * Guarda un lugar en una lista (decisiones 2, 8, 16).
 *
 * Sin `listId` va a la default, **creándola si es el primer guardado de la vida**
 * del usuario. Con `listId`, tiene que ser una de sus listas visibles.
 *
 * El `placeId` se valida contra `places` (existe), **no** contra `publishedWhere`
 * (decisión 16): se guarda solo lo que se puede ver, y lo que se vio ya pasó por
 * el filtro de visibilidad en la búsqueda o la ficha. Chequear publicado otra vez
 * acá rompería el re-guardado del caso de la decisión 11 (lugar despublicado que
 * sigue en la lista).
 *
 * Todo dentro de una transacción con la fila del **usuario** tomada `FOR UPDATE`:
 * es la fila que ancla tanto la creación de la default (índice único parcial: dos
 * POST simultáneos crearían dos y una fallaría) como el conteo del tope de ítems
 * (lección AUTH F3: "un cap que se cuenta y después inserta necesita el lock de la
 * fila que lo ancla"). El lock serializa a ESTE usuario, no a la tabla.
 */
export async function guardarLugar(
  userId: string,
  payload: GuardarLugarPayload,
): Promise<Resultado<LugarGuardado>> {
  const [lugar] = await db
    .select({ id: places.id })
    .from(places)
    .where(eq(places.id, payload.placeId))
    .limit(1)
  if (!lugar) {
    return fallo('LUGAR_INEXISTENTE', 'Ese lugar ya no está.')
  }

  const maxItems = await getMaxItemsPorLista()

  return db.transaction(async (tx) => {
    const [dueno] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .for('update')
    if (!dueno) return fallo('NO_SESSION', 'Iniciá sesión para continuar.')

    const visibles = await listasVisibles(userId, tx)

    // Destino. Nunca sale del payload a secas: sale de las listas visibles.
    let destino = payload.listId
      ? visibles.find((l) => l.id === payload.listId)
      : visibles.find((l) => l.isDefault)

    if (payload.listId && !destino) {
      // Lista ajena, inexistente, o escondida por haber bajado de plan. Las tres
      // se contestan igual: para este usuario, esa lista no existe.
      return fallo('LISTA_NO_ENCONTRADA', 'Esa lista no existe.')
    }

    if (!destino) {
      // Primer guardado de la vida: la default nace acá (decisión 2), no en el
      // signup. El lock de arriba garantiza que nace una sola.
      const [creada] = await tx
        .insert(placeLists)
        .values({ userId, name: NOMBRE_LISTA_DEFAULT, isDefault: true })
        .returning()
      destino = creada
    }

    const [{ items }] = await tx
      .select({ items: sql<number>`count(*)::int` })
      .from(placeListItems)
      .where(eq(placeListItems.listId, destino.id))

    if (items >= maxItems) {
      return fallo(
        'LIMITE_ITEMS',
        `Esa lista ya tiene ${maxItems} lugares. Sacá alguno para sumar otro.`,
      )
    }

    // Idempotente por el índice único `(list_id, place_id)`: guardar dos veces no
    // duplica ni tira error (FAV-08). `returning()` vacío = ya estaba.
    const insertadas = await tx
      .insert(placeListItems)
      .values({ listId: destino.id, placeId: payload.placeId })
      .onConflictDoNothing()
      .returning({ id: placeListItems.id })

    return {
      ok: true as const,
      data: { listId: destino.id, listName: destino.name, nuevo: insertadas.length > 0 },
    }
  })
}

export type LugarSacado = { sacado: boolean }

/**
 * Saca un lugar de una lista, o de todas las visibles si no se indica cuál.
 *
 * **Idempotente**: sacar algo que no estaba guardado devuelve `ok` con
 * `sacado: false`. El botón de la card ya lo muestra en no-guardado; contestarle
 * un error sería mentirle sobre un estado que es el que él quiere.
 *
 * **No toca `saves`** (decisión 12 + DoD): el contador es un histórico de
 * eventos, no un stock. Que alguien lo haya guardado en marzo sigue siendo cierto
 * aunque hoy lo saque.
 */
export async function sacarLugar(
  userId: string,
  payload: SacarLugarPayload,
): Promise<Resultado<LugarSacado>> {
  const visibles = await listasVisibles(userId)

  const objetivo = payload.listId
    ? visibles.filter((l) => l.id === payload.listId)
    : visibles

  if (payload.listId && objetivo.length === 0) {
    return fallo('LISTA_NO_ENCONTRADA', 'Esa lista no existe.')
  }
  if (objetivo.length === 0) {
    // Sin listas todavía: no hay nada que sacar y tampoco es un error.
    return { ok: true as const, data: { sacado: false } }
  }

  const borradas = await db
    .delete(placeListItems)
    .where(
      and(
        eq(placeListItems.placeId, payload.placeId),
        inArray(
          placeListItems.listId,
          objetivo.map((l) => l.id),
        ),
      ),
    )
    .returning({ id: placeListItems.id })

  return { ok: true as const, data: { sacado: borradas.length > 0 } }
}

// ---------------------------------------------------------------------------
// Listas (F2) — crear · renombrar · borrar
// ---------------------------------------------------------------------------

/**
 * ¿Ya tiene una lista con ese nombre? Se pregunta **incluidas las escondidas**
 * por bajar de plan: el índice único `(user_id, lower(name))` las cuenta igual, y
 * un 500 por violación de índice es peor mensaje que este.
 */
async function nombreOcupado(
  tx: DbOrTx,
  userId: string,
  name: string,
  exceptoId?: string,
): Promise<boolean> {
  const [fila] = await tx
    .select({ id: placeLists.id })
    .from(placeLists)
    .where(
      and(eq(placeLists.userId, userId), sql`lower(${placeLists.name}) = lower(${name})`),
    )
    .limit(1)
  return fila ? fila.id !== exceptoId : false
}

/**
 * Crea una lista con nombre (decisión 3: free = 1 · premium = hasta N).
 *
 * **El gate es server-side y sale del dueño único** (`puedeCrearLista`): esconder
 * el botón en el cliente es cosmética. Mismo lock `FOR UPDATE` sobre la fila del
 * usuario que `guardarLugar`, por la misma razón: contar-y-después-insertar
 * necesita el lock de la fila que ancla el límite, o dos POST simultáneos pasan
 * los dos el chequeo de cupo.
 */
export async function crearLista(
  userId: string,
  payload: CrearListaPayload,
): Promise<Resultado<PlaceList>> {
  return db.transaction(async (tx) => {
    const [dueno] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .for('update')
    if (!dueno) return fallo('NO_SESSION', 'Iniciá sesión para continuar.')

    const cupo = await puedeCrearLista(userId, tx)
    if (!cupo.puede) {
      return fallo(
        'LIMITE_LISTAS',
        cupo.max <= MAX_LISTAS_FREE
          ? 'Con el plan free tenés una sola lista. Hacete premium para armar más.'
          : `Llegaste a las ${cupo.max} listas. Borrá alguna para armar otra.`,
      )
    }

    if (await nombreOcupado(tx, userId, payload.name)) {
      return fallo('NOMBRE_REPETIDO', 'Ya tenés una lista con ese nombre.')
    }

    const [creada] = await tx
      .insert(placeLists)
      .values({ userId, name: payload.name, isDefault: false })
      .returning()

    return { ok: true as const, data: creada }
  })
}

/**
 * Renombra una lista propia. **La default no se renombra** (decisión 15): es el
 * contenedor que garantiza que free siempre tenga dónde guardar, y se valida acá,
 * no solo en la UI.
 *
 * La lista sale de `listasVisibles`, nunca del payload: una ajena, inexistente o
 * escondida por bajar de plan se contestan igual — para este usuario no existe.
 */
export async function renombrarLista(
  userId: string,
  listId: string,
  payload: RenombrarListaPayload,
): Promise<Resultado<PlaceList>> {
  return db.transaction(async (tx) => {
    const [dueno] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .for('update')
    if (!dueno) return fallo('NO_SESSION', 'Iniciá sesión para continuar.')

    const visibles = await listasVisibles(userId, tx)
    const lista = visibles.find((l) => l.id === listId)
    if (!lista) return fallo('LISTA_NO_ENCONTRADA', 'Esa lista no existe.')
    if (lista.isDefault) {
      return fallo('LISTA_DEFAULT', 'Esa lista no se puede renombrar.')
    }

    if (await nombreOcupado(tx, userId, payload.name, listId)) {
      return fallo('NOMBRE_REPETIDO', 'Ya tenés una lista con ese nombre.')
    }

    const [actualizada] = await tx
      .update(placeLists)
      .set({ name: payload.name, updatedAt: new Date() })
      .where(and(eq(placeLists.id, listId), eq(placeLists.userId, userId)))
      .returning()

    return { ok: true as const, data: actualizada }
  })
}

export type ListaBorrada = { borrada: true }

/**
 * Borra una lista propia con sus ítems (cascade). **La default no se borra**
 * (decisión 15): dejaría al usuario sin destino para el próximo tap.
 *
 * Este DELETE **no contradice** "ocultar ≠ borrar": ese invariante prohíbe borrar
 * por un cambio de plan. Acá el usuario está pidiendo explícitamente que se vaya.
 */
export async function borrarLista(
  userId: string,
  listId: string,
): Promise<Resultado<ListaBorrada>> {
  const visibles = await listasVisibles(userId)
  const lista = visibles.find((l) => l.id === listId)
  if (!lista) return fallo('LISTA_NO_ENCONTRADA', 'Esa lista no existe.')
  if (lista.isDefault) return fallo('LISTA_DEFAULT', 'Esa lista no se puede borrar.')

  // El `user_id` en el WHERE es red de seguridad, no el filtro: quién puede
  // tocar qué ya se decidió arriba con `listasVisibles`.
  await db
    .delete(placeLists)
    .where(and(eq(placeLists.id, listId), eq(placeLists.userId, userId)))

  return { ok: true as const, data: { borrada: true } }
}
