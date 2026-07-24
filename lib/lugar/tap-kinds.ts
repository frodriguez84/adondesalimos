/**
 * Los tipos de tap que instrumenta la ficha (MONETIZACION, decisión 22a).
 *
 * Vive **solo** con literales, sin tocar la base: lo importan tanto el schema
 * Drizzle (`tapKindEnum`, server) como el `<TapLink>` del cliente. Una sola
 * fuente para el conjunto de valores, sin arrastrar código de DB al bundle del
 * browser y sin que el enum de la base y el del cliente driftee.
 *
 *  - `telefono`    tocar el teléfono (link `tel:`)
 *  - `como_llegar` el botón "Cómo llegar" (mapa)
 *  - `website`     el sitio del lugar
 *  - `redes`       una red social
 *  - `menu`        la carta del dueño (campo pago, decisión 19 de AUTH)
 */
export const TAP_KINDS = ['telefono', 'como_llegar', 'website', 'redes', 'menu'] as const

export type TapKind = (typeof TAP_KINDS)[number]

/** Guard para el borde del endpoint: descarta un `kind` que no está en el enum. */
export function esTapKind(valor: unknown): valor is TapKind {
  return typeof valor === 'string' && (TAP_KINDS as readonly string[]).includes(valor)
}
