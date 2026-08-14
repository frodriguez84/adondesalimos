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

import type { HorariosSemana } from '@/lib/negocio/horarios'

/** SKUs pagos que se cuentan contra los topes de `app_settings` (decisión 19). */
export type GoogleSku = 'details' | 'photos'

/** Horarios de Google, lo mínimo que la ficha muestra (decisión 11). */
export type GoogleHorarios = {
  /** `currentOpeningHours.openNow`: abierto/cerrado ahora, o `null` si no vino. */
  abierto: boolean | null
  /** `weekdayDescriptions` en español: una línea por día para el acordeón. */
  semana: string[]
  /**
   * Los mismos horarios habituales pero **estructurados** (PBETA-R1-07), sacados de
   * los `periods` que ya vienen en la respuesta — sin tocar el field mask. Con esto
   * la ficha puede decir *cuándo* abre y marcar el día de hoy, reusando
   * `lib/negocio/horarios.ts`. `null` cuando Google no manda `periods` o el caso no
   * es representable (24 h): ahí la ficha se queda con las frases de `semana`.
   */
  dias: HorariosSemana | null
}

/**
 * La foto de Google **ya resuelta** que viaja al cliente (F3, decisiones 5 y 15).
 * Lleva la `uri` efímera de `googleusercontent` (no la API key ni el `photo name`,
 * que quedan en el server) y el crédito obligatorio al autor. El acceso al
 * original va por `googleMapsUri` del enriquecimiento, no acá.
 */
export type GoogleFoto = {
  /** URL efímera de la imagen (googleusercontent). NO se persiste (ToS). */
  uri: string
  /** `authorAttributions[0].displayName`, o `null` si Google no lo trae. */
  autorNombre: string | null
  /** `authorAttributions[0].uri`: perfil del autor, para linkear el crédito. */
  autorUri: string | null
}

/**
 * El bloque de Google que el endpoint devuelve al cliente (decisiones 11 y 5).
 * Todo campo es opcional a nivel semántico: Google puede no traer rating, horarios
 * o foto de un lugar, y la ficha degrada campo por campo.
 */
export type GoogleEnriquecimiento = {
  horarios: GoogleHorarios | null
  /**
   * La dirección que Google tiene para ese lugar (CORRECCION_DATOS, decisión 18).
   * **Pista, no fuente**, y la señal es asimétrica: el match se resuelve a ±300 m
   * del pin **nuestro**, así que *que coincida no prueba nada* — solo *que difiera*
   * es señal. La consume el editor de admin; **la ficha pública no la renderiza**
   * (dos direcciones contradictorias confunden y no arreglan el pin) y no se
   * persiste en ningún lado (decisión 19).
   */
  formattedAddress: string | null
  rating: number | null
  userRatingCount: number | null
  /** Ya mapeado a `$..$$$$` (o `null`), no el enum crudo de Google. */
  priceLevel: string | null
  googleMapsUri: string | null
  /** Foto de Google ya resuelta (F3), o `null` si no hay, no hubo cuota o falló. */
  foto: GoogleFoto | null
}
