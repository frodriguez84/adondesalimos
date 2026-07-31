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

/** Nombre de lista: 1-40 chars, trim. Lo usa F2 (crear / renombrar). */
export const nombreListaSchema = z.string().trim().min(1).max(40)
