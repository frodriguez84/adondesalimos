import { z } from 'zod'

/**
 * Validación del payload de `POST /api/claims` — las dos entradas del flujo
 * dueño (decisión 11): reclamo de un lugar existente y alta de uno nuevo.
 *
 * Pura y sin DB: el endpoint valida forma acá y recién después toca la base.
 * Regla global de seguridad: todo input público se valida en el boundary.
 */

/**
 * bbox de AMBA. **Es el mismo rectángulo que usa `scripts/import-overture.ts`**
 * para traer el catálogo: un alta de dueño no puede caer fuera del área que la
 * app cubre. Hoy está escrito en los dos lados; unificarlo es un cambio aparte
 * (el script corre con `dotenv` y no debería depender de `lib/claims`).
 */
export const AMBA_BBOX = { xmin: -59.1, xmax: -58.1, ymin: -35.05, ymax: -34.28 }

const texto = (min: number, max: number) => z.string().trim().min(min).max(max)

/** Lo que el admin necesita para verificar el vínculo con el negocio. */
const solicitante = z.object({
  applicantName: texto(2, 120),
  applicantPhone: texto(6, 40),
  applicantRole: texto(2, 120),
  comment: texto(0, 1000).optional(),
})

export const reclamoSchema = solicitante.extend({
  kind: z.literal('claim'),
  placeId: z.uuid(),
})

export const altaSchema = solicitante.extend({
  kind: z.literal('new'),
  name: texto(2, 200),
  address: texto(0, 300).optional(),
  locality: texto(0, 120).optional(),
  // Pin en el mapa (decisión 12): sin geocoder pago, las coordenadas las pone el
  // dueño. Se acotan al bbox de AMBA para que un payload armado a mano no meta
  // un lugar en otro continente.
  lat: z.number().min(AMBA_BBOX.ymin).max(AMBA_BBOX.ymax),
  lng: z.number().min(AMBA_BBOX.xmin).max(AMBA_BBOX.xmax),
  // Contacto base del lugar nuevo: en `source='owner'` las columnas base se
  // llenan una vez, al alta (decisión 13).
  phone: texto(0, 40).optional(),
  website: texto(0, 300).optional(),
})

export const claimPayloadSchema = z.discriminatedUnion('kind', [reclamoSchema, altaSchema])

export type ReclamoPayload = z.infer<typeof reclamoSchema>
export type AltaPayload = z.infer<typeof altaSchema>
export type ClaimPayload = z.infer<typeof claimPayloadSchema>

/** Decisión del admin sobre un claim. Rechazar exige motivo: viaja en el mail. */
export const decisionSchema = z.discriminatedUnion('accion', [
  z.object({ accion: z.literal('approve') }),
  z.object({ accion: z.literal('reject'), motivo: texto(3, 1000) }),
])

export type Decision = z.infer<typeof decisionSchema>
