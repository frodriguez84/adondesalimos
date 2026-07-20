import { sql } from 'drizzle-orm'
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
 * Suma 1 al contador del SKU en el mes actual. Se llama **antes** de la llamada
 * paga (decisión 19): contar de menos por una excepción a mitad de camino es peor
 * que contar de más — una request que Google ya recibió puede facturarse aunque
 * después falle.
 */
export async function incrementarUsoMensual(sku: GoogleSku): Promise<void> {
  await db
    .insert(googleApiUsage)
    .values({ month: MES_SQL as unknown as string, sku, count: 1 })
    .onConflictDoUpdate({
      target: [googleApiUsage.month, googleApiUsage.sku],
      set: { count: sql`${googleApiUsage.count} + 1` },
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
