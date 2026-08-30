import type { TipoSuscripcion } from '@/lib/billing/types'
import { CAP_FOTOS } from '@/lib/negocio/contenido'

/**
 * **Dueño único de "qué incluye cada plan"** (MONETIZACION).
 *
 * Existe porque la lista estaba escrita a mano en tres lugares —el panel de venta,
 * los términos y (por omisión) el checkout— y **divergió**: el panel prometía el
 * chat sin decir que tiene cupo, los términos decían el cupo pero no las votaciones
 * ilimitadas, y el checkout no decía nada. Ninguna de las tres mentía; el problema
 * era la **omisión asimétrica**: el texto de venta omitía justo lo que limita, y lo
 * que sí lo decía eran los términos, que nadie lee para decidir una compra.
 *
 * Cada línea de acá tiene que poder señalar su gate en el código — mismo criterio de
 * redacción que los T&C. Los gates, con su dueño:
 *
 * - **B2C**: votaciones ilimitadas (`lib/votaciones/acciones.ts`, el límite de una
 *   activa corre solo para `free`) · historial (`app/api/votaciones/historial`) ·
 *   chat con cupo mensual (`lib/ai/cupo.ts`) · listas (`lib/favoritos/planes.ts`).
 * - **B2B**: los tres campos pagos y el cap de fotos (`lib/negocio/contenido.ts`) ·
 *   el bloque de destacados de la búsqueda (`buscarDestacados`, candidatos
 *   `owner_plan='paid'`) · el desglose de estadísticas (`desgloseEstadisticas`,
 *   devuelve `null` en `free`).
 *
 * **Nadie escribe esta lista en otro lado.** Si aparece una segunda copia, es el
 * cleanup de máxima prioridad (CLAUDE.md § Una regla, un dueño).
 */

/**
 * Los cupos que el copy dice como número. Salen de `app_settings` en runtime, así
 * que **solo los tiene una superficie dinámica**: los pasa la página server que
 * renderiza el panel.
 *
 * Ausentes a propósito en `/legales/**`, que es estático y no puede leer la base sin
 * convertirse en función serverless (CLAUDE.md § Notas importantes). Sin ellos el
 * texto degrada a la redacción sin número —"con cupo mensual", "más listas"—, que
 * sigue siendo la misma promesa y no puede quedar desactualizada.
 */
export interface CuposDelPlan {
  /** `ai.chat_quota_premium`. Ausente ⇒ "con cupo mensual". */
  chatMensual?: number
  /** `favoritos.max_listas_premium`. Ausente ⇒ "más listas". */
  listas?: number
}

/** Qué incluye el plan, una línea por beneficio, en el orden en que se muestran. */
export function beneficiosDe(tipo: TipoSuscripcion, cupos: CuposDelPlan = {}): string[] {
  if (tipo === 'b2b') {
    return [
      'Descripción, carta y novedades en tu ficha',
      `Hasta ${CAP_FOTOS.paid} fotos`,
      'Tu lugar destacado arriba de las búsquedas',
      'Las estadísticas de tu ficha: cuánta gente la vio y qué buscaba',
    ]
  }
  return [
    'Votaciones ilimitadas, todas las que quieras a la vez',
    'El historial de todo lo que votaron',
    cupos.chatMensual === undefined
      ? 'El chat con la IA, con cupo mensual'
      : `El chat con la IA: ${cupos.chatMensual} mensajes por mes`,
    cupos.listas === undefined
      ? 'Más listas para guardar lugares'
      : `Hasta ${cupos.listas} listas para guardar lugares`,
  ]
}

/** El encabezado que va arriba de la lista, en la pantalla donde se contrata. */
export const INVITACION: Record<TipoSuscripcion, string> = {
  b2c: 'Pasate a Premium y sumás:',
  b2b: 'Activá el plan del lugar y sumás:',
}

/** Lo mismo, cuando el cobro todavía no abrió (DEPLOY, § El premium apagado). */
export const INVITACION_APAGADO: Record<TipoSuscripcion, string> = {
  b2c: 'El Premium está por salir, con:',
  b2b: 'El plan del lugar está por salir, con:',
}
