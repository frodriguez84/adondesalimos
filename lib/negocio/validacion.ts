import { z } from 'zod'
import {
  DIAS,
  esHoraValida,
  haySolapamiento,
  minutosDe,
  semanaVacia,
  type RangoHorario,
} from './horarios'

/**
 * Validación del payload del panel (`PATCH /api/mi-negocio/[placeId]/content`).
 *
 * Pura y sin DB, como `lib/claims/validacion.ts`: el editor valida con **estos
 * mismos schemas** antes de postear y el endpoint los vuelve a correr. Una sola
 * definición de qué es un dato válido.
 *
 * El gating por plan **no** está acá a propósito: depende del `owner_plan` del
 * lugar, que es estado de la base. La forma se valida acá; el permiso, en
 * `acciones.ts` (server-side, decisión 17). Los horarios son **free** (decisión
 * 20): no pasan por ese gate.
 */

/** Texto opcional que se puede vaciar: `''` es válido y significa "borralo". */
const opcional = (max: number) => z.string().trim().max(max)

/**
 * Link http(s). Vacío se acepta (borrar el campo); con contenido tiene que ser
 * una URL absoluta — la ficha la usa tal cual como `href`, y un `javascript:` o
 * un `//evil` ahí serían un agujero.
 */
const link = (max: number) =>
  opcional(max).refine((v) => v === '' || /^https?:\/\/\S+$/i.test(v), {
    message: 'Tiene que empezar con http:// o https://',
  })

/** Tope de redes: 6 alcanza y sobra, y acota el payload. */
export const MAX_SOCIALS = 6
/** Tope duro del array de tags: cota del payload, no regla de negocio (dec. 15). */
export const MAX_TAGS = 100
/** Tope de rangos por día: 3 (mañana / tarde / trasnoche) alcanza y acota el payload. */
export const MAX_RANGOS_POR_DIA = 3

/**
 * Un rango `hh:mm`: apertura y cierre bien formados, y cierre distinto de la
 * apertura (`20:00–20:00` es ambiguo entre "cerrado" y "24 h", no se acepta). El
 * cruce de medianoche —cierre menor que apertura— **sí** es válido: es lo normal
 * en una app de salidas (`20:00–02:00`).
 */
const rangoSchema = z
  .object({
    abre: z.string().refine(esHoraValida, { message: 'Hora inválida' }),
    cierra: z.string().refine(esHoraValida, { message: 'Hora inválida' }),
  })
  .refine((r: RangoHorario) => minutosDe(r.abre) !== minutosDe(r.cierra), {
    message: 'El cierre no puede ser igual a la apertura',
  })

/** Los rangos de un día: sin superar el tope y sin pisarse entre sí. */
const diaSchema = z
  .array(rangoSchema)
  .max(MAX_RANGOS_POR_DIA)
  .refine((rangos) => !haySolapamiento(rangos), { message: 'Hay horarios que se pisan' })

/** La semana entera: los 7 días, cada uno con su lista de rangos. */
export const horariosSchema = z.object({
  lunes: diaSchema,
  martes: diaSchema,
  miercoles: diaSchema,
  jueves: diaSchema,
  viernes: diaSchema,
  sabado: diaSchema,
  domingo: diaSchema,
})

export const contenidoSchema = z.object({
  // --- Free ---------------------------------------------------------------
  phone: opcional(40),
  website: link(300),
  socials: z.array(link(300)).max(MAX_SOCIALS),
  /** Slugs de la taxonomía. Los que no existan o estén inactivos se descartan. */
  tags: z.array(z.string().trim().min(1).max(80)).max(MAX_TAGS),
  /** Horarios propios (free): la ficha los prioriza sobre los de Google. */
  openingHours: horariosSchema,

  // --- Pago: la forma se valida siempre; el permiso lo checkea `acciones.ts` --
  description: opcional(2000),
  menuUrl: link(500),
  news: opcional(140),
})

export type ContenidoPayload = z.infer<typeof contenidoSchema>

export const CONTENIDO_VACIO: ContenidoPayload = {
  phone: '',
  website: '',
  socials: [],
  tags: [],
  openingHours: semanaVacia(),
  description: '',
  menuUrl: '',
  news: '',
}

/**
 * `''` → `null` antes de guardar. Es lo que hace que borrar un campo del dueño
 * devuelva el dato de Overture en la ficha (COALESCE de `contenido.ts`) en vez de
 * dejar un hueco: un string vacío guardado ganaría el COALESCE y taparía la base.
 */
export function vacioANull(valor: string): string | null {
  const limpio = valor.trim()
  return limpio.length > 0 ? limpio : null
}

/** Idem para las redes: sin ninguna, `null` y la ficha cae a las de Overture. */
export function listaANull(valores: string[]): string[] | null {
  const limpias = valores.map((v) => v.trim()).filter((v) => v.length > 0)
  return limpias.length > 0 ? limpias : null
}
