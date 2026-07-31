import { z } from 'zod'

/**
 * Validación de los payloads de favoritos — pura y sin DB (regla global: todo
 * input público se valida en el boundary).
 *
 * Lo que **no** se valida acá: el cupo de listas y la pertenencia de la lista.
 * Eso es estado, vive en las acciones de dominio (`lib/favoritos/acciones.ts`) y
 * se decide con la base a la vista.
 */

/** Guardar. Sin `listId` va a la default, creándola si es el primer guardado. */
export const guardarLugarSchema = z.object({
  placeId: z.uuid(),
  listId: z.uuid().optional(),
})

export type GuardarLugarPayload = z.infer<typeof guardarLugarSchema>

/**
 * Sacar. El `listId` es **opcional a propósito**: el botón de la card sabe qué
 * lugar sacar pero no de qué lista salió el estado "guardado" (que se resuelve
 * por lugar, decisión 9). Sin `listId` se saca de todas las listas visibles.
 */
export const sacarLugarSchema = z.object({
  placeId: z.uuid(),
  listId: z.uuid().optional(),
})

export type SacarLugarPayload = z.infer<typeof sacarLugarSchema>

/** Nombre de lista: 1-40 chars, trim. Lo usan crear y renombrar (F2). */
export const nombreListaSchema = z.string().trim().min(1).max(40)

/** Crear una lista con nombre (F2, decisión 14). El cupo lo decide la acción. */
export const crearListaSchema = z.object({ name: nombreListaSchema })

export type CrearListaPayload = z.infer<typeof crearListaSchema>

/** Renombrar. Mismo nombre válido; qué lista se puede tocar lo decide la acción. */
export const renombrarListaSchema = z.object({ name: nombreListaSchema })

export type RenombrarListaPayload = z.infer<typeof renombrarListaSchema>

/**
 * Cuántos ids acepta la lectura por lote (`GET /api/favoritos?ids=`). Es el
 * techo de lo que puede pedir una pantalla de una: el chat manda la tanda de
 * cards que acaba de recibir y la búsqueda sirve 20 por página. Alto para el uso
 * real, acotado para que un `?ids=` armado a mano no sea un `IN` de mil valores.
 */
export const MAX_IDS_POR_LOTE = 100

/**
 * Los ids del query string, ya separados por coma. Se **descartan** los que no
 * son UUID en vez de rechazar todo el lote: es una lectura de estado, y que una
 * card nazca sin estado es mejor que romper la pantalla entera.
 */
export function parsearIdsDelLote(raw: string | null): string[] {
  if (!raw) return []
  const ids = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => z.uuid().safeParse(s).success)
  return [...new Set(ids)].slice(0, MAX_IDS_POR_LOTE)
}
