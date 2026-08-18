import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { googleApiUsage } from '@/lib/db/schema'
import type { GoogleSku } from './types'

/**
 * Consumo mensual de la API paga de Google, por SKU (FICHA, decisión 19). Es el
 * contador que alimenta los topes editables de `app_settings`: superado el cupo,
 * la ficha degrada al modo sin Google en vez de disparar la factura.
 *
 * Solo se cuentan los SKUs **pagos**: `details` y `photos`. El resolver de
 * matching (Text Search IDs-Only) es $0 y no se cuenta — no tiene tope.
 *
 * El mes lo pone Postgres (`to_char(current_date, 'YYYY-MM')`), no el proceso:
 * una sola fuente para el corte mensual, mismo criterio que la fecha de las
 * impresiones. Si el server corre en UTC y factura en otra zona, el desfase es de
 * horas al borde del mes y no justifica arrastrar la zona de facturación acá.
 */

const MES_SQL = sql`to_char(current_date, 'YYYY-MM')`

/** Cuántas llamadas del SKU se hicieron este mes. 0 si no hay fila todavía. */
export async function contarUsoMensual(sku: GoogleSku): Promise<number> {
  const [row] = await db
    .select({ count: googleApiUsage.count })
    .from(googleApiUsage)
    .where(sql`${googleApiUsage.month} = ${MES_SQL} AND ${googleApiUsage.sku} = ${sku}`)
    .limit(1)
  return row?.count ?? 0
}

/**
 * Reserva **una** llamada del SKU: mira el cupo y lo consume en la misma
 * operación. `false` ⇒ no hay cuota y el llamador degrada sin llamar a Google.
 *
 * Es una sola función y no el par `contar` + `incrementar` porque separarlos es
 * exactamente el agujero (`SEC-15`): entre el SELECT y el upsert, N requests
 * concurrentes leen el mismo valor por debajo del tope y pasan todas. **El patrón
 * es el de `lib/ai/cupo.ts`**, que ya resuelve este mismo problema para el chat:
 * TX + fila del mes asegurada con `onConflictDoNothing` + `FOR UPDATE` sobre ella,
 * así el segundo request espera al primero en vez de leer un valor viejo.
 *
 * Se reserva **antes** de la llamada paga (decisión 19): contar de menos por una
 * excepción a mitad de camino es peor que contar de más — una request que Google
 * ya recibió puede facturarse aunque después falle.
 */
export async function reservarUsoMensual(sku: GoogleSku, tope: number): Promise<boolean> {
  return db.transaction(async (tx) => {
    await tx
      .insert(googleApiUsage)
      .values({ month: MES_SQL as unknown as string, sku, count: 0 })
      .onConflictDoNothing()

    const [fila] = await tx
      .select({ count: googleApiUsage.count })
      .from(googleApiUsage)
      .where(and(sql`${googleApiUsage.month} = ${MES_SQL}`, eq(googleApiUsage.sku, sku)))
      .for('update')

    if (!hayCuota(fila?.count ?? 0, tope)) return false

    await tx
      .update(googleApiUsage)
      .set({ count: sql`${googleApiUsage.count} + 1` })
      .where(and(sql`${googleApiUsage.month} = ${MES_SQL}`, eq(googleApiUsage.sku, sku)))
    return true
  })
}

/**
 * ¿Queda cupo para una llamada más de este SKU? Puro y sin DB: la decisión "hay
 * cuota" se testea derecho, y bajar el tope a 0 en `app_settings` la apaga sin
 * tocar código (decisión 19).
 */
export function hayCuota(usados: number, tope: number): boolean {
  return usados < tope
}
