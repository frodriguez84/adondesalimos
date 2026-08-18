import 'dotenv/config'
import { and, eq, sql } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'

import { db } from '@/lib/db'
import { googleApiUsage } from '@/lib/db/schema'
import { contarUsoMensual, hayCuota, reservarUsoMensual } from '../usage'
import type { GoogleSku } from '../types'

/**
 * El contador mensual por SKU contra la base real (FICHA, decisión 19). Usa un SKU
 * centinela —no `details`/`photos`— para no ensuciar los contadores reales del dev,
 * y limpia su fila al terminar.
 */

// El SKU es texto libre en la tabla (no enum): un centinela no rompe nada.
const SKU_TEST = 'test-usage' as unknown as GoogleSku
const MES = sql`to_char(current_date, 'YYYY-MM')`

async function borrarCentinela() {
  await db
    .delete(googleApiUsage)
    .where(and(sql`${googleApiUsage.month} = ${MES}`, eq(googleApiUsage.sku, SKU_TEST)))
}

describe('hayCuota — puro', () => {
  it('hay cuota mientras usados < tope', () => {
    expect(hayCuota(0, 1)).toBe(true)
    expect(hayCuota(99, 100)).toBe(true)
  })
  it('sin cuota al alcanzar o pasar el tope (bajar a 0 lo apaga)', () => {
    expect(hayCuota(100, 100)).toBe(false)
    expect(hayCuota(0, 0)).toBe(false)
  })
})

describe.runIf(process.env.DATABASE_URL)('contarUsoMensual / reservarUsoMensual', () => {
  afterEach(borrarCentinela)

  it('arranca en 0 y cada reserva concedida suma 1 en el mes actual', async () => {
    await borrarCentinela()
    expect(await contarUsoMensual(SKU_TEST)).toBe(0)
    expect(await reservarUsoMensual(SKU_TEST, 10)).toBe(true)
    expect(await reservarUsoMensual(SKU_TEST, 10)).toBe(true)
    expect(await contarUsoMensual(SKU_TEST)).toBe(2)
  })

  it('alcanzado el tope devuelve false y NO sigue contando', async () => {
    await borrarCentinela()
    expect(await reservarUsoMensual(SKU_TEST, 1)).toBe(true)
    expect(await reservarUsoMensual(SKU_TEST, 1)).toBe(false)
    expect(await reservarUsoMensual(SKU_TEST, 1)).toBe(false)
    expect(await contarUsoMensual(SKU_TEST)).toBe(1)
  })

  it('tope 0 ⇒ ninguna reserva y el contador no se mueve (apagar sin redeploy)', async () => {
    await borrarCentinela()
    expect(await reservarUsoMensual(SKU_TEST, 0)).toBe(false)
    expect(await contarUsoMensual(SKU_TEST)).toBe(0)
  })

  /**
   * El caso que motiva `SEC-15`: con SELECT + upsert en dos viajes, las 8 leían el
   * mismo valor por debajo del tope y pasaban todas. Con la TX + `FOR UPDATE` pasan
   * exactamente 3, que es el tope.
   */
  it('8 reservas concurrentes con tope 3 ⇒ pasan 3 (TOCTOU)', async () => {
    await borrarCentinela()
    const resultados = await Promise.all(
      Array.from({ length: 8 }, () => reservarUsoMensual(SKU_TEST, 3)),
    )
    expect(resultados.filter(Boolean)).toHaveLength(3)
    expect(await contarUsoMensual(SKU_TEST)).toBe(3)
  })
})
