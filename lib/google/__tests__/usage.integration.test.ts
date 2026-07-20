import 'dotenv/config'
import { and, eq, sql } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'

import { db } from '@/lib/db'
import { googleApiUsage } from '@/lib/db/schema'
import { contarUsoMensual, hayCuota, incrementarUsoMensual } from '../usage'
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

describe.runIf(process.env.DATABASE_URL)('contarUsoMensual / incrementarUsoMensual', () => {
  afterEach(borrarCentinela)

  it('arranca en 0 y cada incremento suma 1 en el mes actual', async () => {
    await borrarCentinela()
    expect(await contarUsoMensual(SKU_TEST)).toBe(0)
    await incrementarUsoMensual(SKU_TEST)
    await incrementarUsoMensual(SKU_TEST)
    expect(await contarUsoMensual(SKU_TEST)).toBe(2)
  })
})
