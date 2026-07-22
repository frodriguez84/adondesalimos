import type { OwnerPlan } from '@/lib/db/schema'

/**
 * Las dos reglas de negocio de F3, puras y sin DB:
 *
 * 1. **COALESCE dueño → base** (decisión 13): lo que el dueño cargó gana sobre lo
 *    que trajo Overture; lo que dejó vacío cae a la base. Nunca se escribe sobre
 *    las columnas de `places` — el re-import las pisa.
 * 2. **Gating por plan** (decisiones 17 y 18): los tres campos pagos existen
 *    siempre en la base pero solo se muestran (y se escriben) con `owner_plan =
 *    'paid'`. Volver a `free` los **oculta**, no los borra.
 *
 * Vive acá y no en la query porque es la parte que tiene que estar bien: un
 * `null` mal resuelto muestra el teléfono viejo de Overture en la ficha de un
 * dueño que lo corrigió, y un gate mal puesto regala el plan pago.
 */

/** Los tres campos que el plan pago habilita (decisión 5). */
export const CAMPOS_PAGOS = ['description', 'menuUrl', 'news'] as const
export type CampoPago = (typeof CAMPOS_PAGOS)[number]

/**
 * Cap de fotos por plan (decisiones 5 y 17). Se aplica **desde el día 1** y
 * server-side: "subir un cupo es un regalo; bajarlo es una traición".
 */
export const CAP_FOTOS: Record<OwnerPlan, number> = { free: 3, paid: 15 }

export function capDeFotos(plan: OwnerPlan): number {
  return CAP_FOTOS[plan]
}

export function esPlanPago(plan: OwnerPlan): boolean {
  return plan === 'paid'
}

/** La fila de `place_owner_content`, o `null` si el lugar no tiene ninguna. */
export type ContenidoCrudo = {
  phone: string | null
  website: string | null
  socials: string[] | null
  description: string | null
  menuUrl: string | null
  news: string | null
} | null

/** Lo que Overture dejó en las columnas base. Listas, no escalares (dec. 19 CATALOGO). */
export type ContactoBase = {
  phones: string[]
  websites: string[]
  socials: string[]
}

/** Contacto y huecos ya resueltos: es exactamente lo que la ficha renderiza. */
export type ContenidoResuelto = {
  phone: string | null
  website: string | null
  socials: string[]
  /** Los tres de abajo son `null` salvo con plan pago **y** dato cargado. */
  description: string | null
  menuUrl: string | null
  news: string | null
}

/**
 * Resuelve qué muestra la ficha. `null` en un campo del dueño significa "no
 * cargado" y cae a la base — el endpoint normaliza el string vacío a `null`
 * justamente para que borrar un campo devuelva el dato de Overture en vez de
 * dejar un hueco.
 *
 * `socials` es reemplazo, no mezcla: si el dueño cargó sus redes, son **las
 * suyas**. Mezclarlas con las de Overture le devolvería a la ficha la cuenta de
 * Instagram vieja que el dueño justamente vino a corregir.
 */
export function resolverContenidoDueno(input: {
  base: ContactoBase
  owner: ContenidoCrudo
  plan: OwnerPlan
}): ContenidoResuelto {
  const { base, owner, plan } = input
  const pago = esPlanPago(plan)
  const socialesDueno = owner?.socials

  return {
    phone: owner?.phone ?? base.phones[0] ?? null,
    website: owner?.website ?? base.websites[0] ?? null,
    socials: socialesDueno && socialesDueno.length > 0 ? socialesDueno : base.socials,
    // Sin plan pago no se muestran, aunque estén cargados (decisión 18).
    description: pago ? (owner?.description ?? null) : null,
    menuUrl: pago ? (owner?.menuUrl ?? null) : null,
    news: pago ? (owner?.news ?? null) : null,
  }
}
