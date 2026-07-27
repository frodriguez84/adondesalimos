import { z } from 'zod'

/**
 * Schema del endpoint de la cola de curaduría (CURADURIA, F2). Mismo criterio que
 * `lib/claims/validacion.ts`: el cliente valida con esto y el servidor **vuelve a
 * validar** con el mismo schema — el cliente no es un boundary de seguridad.
 *
 * Los slugs se aceptan con forma de slug del canon; que existan de verdad y sean
 * de la faceta correcta lo decide `guardarCuraduria` contra la DB (no el schema).
 */

const slug = z.string().regex(/^[a-z0-9-]{1,60}$/)

export const guardarSchema = z.object({
  accion: z.literal('guardar'),
  /** Slugs tildados de Ambiente/Momento/Actividad. */
  tags: z.array(slug).max(100),
  /** `precio-1..4` o null ("no sé", el default). */
  precio: slug.nullable().default(null),
})

export const rechazarSchema = z.object({
  accion: z.literal('rechazar'),
})

export const accionSchema = z.discriminatedUnion('accion', [guardarSchema, rechazarSchema])

export type AccionCuraduria = z.infer<typeof accionSchema>
