import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { placeImpressionsDaily } from '@/lib/db/schema'

/**
 * Impresiones agregadas por lugar y día (decisión 22).
 *
 * Es lo mínimo que **no se puede reconstruir después**: sin esto, el "tu ficha
 * apareció en N búsquedas este mes" del teaser B2B (spec 7) nace sin histórico.
 * Por eso se registra desde el día 1 aunque nada lo consuma todavía.
 *
 * **Agregado puro**: sin `user_id`, sin cookies, sin sesión, sin IP. Solo un
 * contador por lugar y día. No hay forma de reconstruir qué buscó una persona,
 * y es a propósito — el desglose de "qué filtros te encontraron" es del spec 7 y
 * tampoco lleva datos personales.
 */

/**
 * Suma 1 a cada lugar servido, en la fila de hoy.
 *
 * Se llama con **los lugares mostrados** (los 20 de la página), no con todo el
 * resultado: una búsqueda que matchea 11.438 lugares no le da una impresión a
 * cada uno — nadie los vio.
 *
 * No tira nunca: una impresión perdida no puede tumbar una búsqueda. El error se
 * loguea y la pantalla sigue.
 */
export async function registrarImpresiones(placeIds: string[]): Promise<void> {
  if (placeIds.length === 0) return

  // Un lugar repetido en la misma página contaría doble. No debería pasar (la
  // query no repite), pero el upsert de abajo agrupa por (place_id, date) y un
  // duplicado en el mismo INSERT haría fallar el ON CONFLICT.
  const unicos = [...new Set(placeIds)]

  try {
    await db
      .insert(placeImpressionsDaily)
      .values(
        unicos.map((placeId) => ({
          placeId,
          // La fecha la pone Postgres, no el proceso: si el server corre en UTC
          // y la app es de Buenos Aires, dos relojes distintos partirían el día
          // en lugares distintos. Una sola fuente para el día.
          date: sql`current_date` as unknown as string,
          impressions: 1,
        })),
      )
      .onConflictDoUpdate({
        target: [placeImpressionsDaily.placeId, placeImpressionsDaily.date],
        set: {
          impressions: sql`${placeImpressionsDaily.impressions} + excluded.impressions`,
        },
      })
  } catch (error) {
    console.error('[impresiones]', error)
  }
}

/**
 * Suma 1 a las aperturas de ficha de un lugar, en la fila de hoy (FICHA,
 * decisión 24). Comparte tabla y semántica con `registrarImpresiones`: agregado
 * por lugar y día, sin datos por usuario. Es el "cuánta gente vio tu ficha" del
 * B2B (spec 7), que no se puede reconstruir a posteriori.
 *
 * Se llama una vez por apertura de ficha publicada. No tira nunca: un contador
 * perdido no puede tumbar la pantalla que lo generó — se loguea y la ficha sigue.
 */
export async function registrarDetailView(placeId: string): Promise<void> {
  try {
    await db
      .insert(placeImpressionsDaily)
      .values({
        placeId,
        date: sql`current_date` as unknown as string,
        detailViews: 1,
      })
      .onConflictDoUpdate({
        target: [placeImpressionsDaily.placeId, placeImpressionsDaily.date],
        set: {
          detailViews: sql`${placeImpressionsDaily.detailViews} + excluded.detail_views`,
        },
      })
  } catch (error) {
    console.error('[detail-view]', error)
  }
}
