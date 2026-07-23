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
 * Cerrar o cancelar (decisión 14 y 24). Cerrar exige el ganador elegido (default
 * en la UI = el más votado, pero lo confirma el creador). Cancelar no lleva nada.
 */
export const gestionVotacionSchema = z.discriminatedUnion('accion', [
  z.object({ accion: z.literal('close'), winnerPlaceId: z.uuid() }),
  z.object({ accion: z.literal('cancel') }),
])

export type GestionVotacionPayload = z.infer<typeof gestionVotacionSchema>
