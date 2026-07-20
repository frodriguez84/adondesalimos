/**
 * DTOs del enriquecimiento en vivo de Google (FICHA, F2). Viven acá —y no en
 * `places.ts`— porque el bloque cliente (`components/lugar/ficha-google.tsx`)
 * importa **solo estos tipos** para tipar la respuesta del endpoint. `places.ts`
 * es server-only (tiene la API key); si el cliente importara un tipo de ahí, el
 * bundler arrastraría el módulo. Este archivo no toca la key ni la red: es seguro
 * de importar desde cualquier lado.
 *
 * Nada de esto se persiste (ToS): son datos que viajan del server al cliente en
 * la misma request que ya se pagó y se descartan al terminar el render.
 */

/** SKUs pagos que se cuentan contra los topes de `app_settings` (decisión 19). */
export type GoogleSku = 'details' | 'photos'

/** Horarios de Google, lo mínimo que la ficha muestra (decisión 11). */
export type GoogleHorarios = {
  /** `currentOpeningHours.openNow`: abierto/cerrado ahora, o `null` si no vino. */
  abierto: boolean | null
  /** `weekdayDescriptions` en español: una línea por día para el acordeón. */
  semana: string[]
}

/**
 * El bloque de Google que el endpoint devuelve al cliente (decisión 11). La foto
 * es F3 y no está acá todavía. Todo campo es opcional a nivel semántico: Google
 * puede no traer rating o horarios de un lugar, y la ficha degrada campo por campo.
 */
export type GoogleEnriquecimiento = {
  horarios: GoogleHorarios | null
  rating: number | null
  userRatingCount: number | null
  /** Ya mapeado a `$..$$$$` (o `null`), no el enum crudo de Google. */
  priceLevel: string | null
  googleMapsUri: string | null
}
