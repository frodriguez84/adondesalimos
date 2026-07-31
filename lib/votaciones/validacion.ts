import { z } from 'zod'
import { MAX_OPCIONES, MIN_OPCIONES } from './constantes'

/**
 * Validación de los payloads de votación — pura y sin DB (regla global de
 * seguridad: todo input público se valida en el boundary). El límite de 2-5
 * lugares (decisión 3) **se enforça acá**, server-side: menos de 2 o más de 5
 * distintos se rechaza antes de tocar la base.
 */

/**
 * Crear votación. Los `placeIds` se **deduplican** antes de contar: repetir un
 * lugar no cuenta doble ni cuela un 6º disfrazado. Tras deduplicar tienen que
 * quedar entre 2 y 5 (decisión 3). El tope de 20 en el array crudo es solo un
 * corte anti-payload-gigante antes de deduplicar.
 */
export const crearVotacionSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  /**
   * ¿El grupo puede sumar lugares? (SUGERIR_EN_VOTACION, decisión 10). Opcional:
   * si no viene, manda el default `true` de la columna.
   */
  allowSuggestions: z.boolean().optional(),
  placeIds: z
    .array(z.uuid())
    .min(1)
    .max(20)
    .transform((ids) => [...new Set(ids)])
    .refine((ids) => ids.length >= MIN_OPCIONES && ids.length <= MAX_OPCIONES, {
      message: `Elegí entre ${MIN_OPCIONES} y ${MAX_OPCIONES} lugares.`,
    }),
})

export type CrearVotacionPayload = z.infer<typeof crearVotacionSchema>

/** Votar / revotar: solo la opción elegida. El votante se identifica por cookie. */
export const votarSchema = z.object({
  optionId: z.uuid(),
})

export type VotarPayload = z.infer<typeof votarSchema>

/**
 * Sugerir un lugar (SUGERIR_EN_VOTACION, decisión 4). **Un uuid y nada más**: no
 * hay campo de nombre ni un "otro" —el texto libre es justo lo que este spec
 * cierra—. Que el uuid sea un lugar **publicado** lo decide el server contra
 * `lib/db/visibility.ts`, no este schema.
 */
export const sugerirOpcionSchema = z.object({
  placeId: z.uuid(),
})

export type SugerirOpcionPayload = z.infer<typeof sugerirOpcionSchema>

/**
 * Cerrar, cancelar o abrir/cerrar las sugerencias (decisión 14 y 24 de VOTACION;
 * decisión 10 de SUGERIR_EN_VOTACION). Cerrar exige el ganador elegido (default
 * en la UI = el más votado, pero lo confirma el creador). Cancelar no lleva nada.
 *
 * `suggestions` va acá y **no** en un endpoint nuevo: el PATCH del creador ya es
 * un `discriminatedUnion` por acción y esto es una acción más del mismo dueño
 * sobre la misma votación.
 */
export const gestionVotacionSchema = z.discriminatedUnion('accion', [
  z.object({ accion: z.literal('close'), winnerPlaceId: z.uuid() }),
  z.object({ accion: z.literal('cancel') }),
  z.object({ accion: z.literal('suggestions'), allowSuggestions: z.boolean() }),
])

export type GestionVotacionPayload = z.infer<typeof gestionVotacionSchema>
