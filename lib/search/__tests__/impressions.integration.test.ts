import 'dotenv/config'
import { and, eq, sql } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'

import { db } from '@/lib/db'
import { placeImpressionsDaily, places } from '@/lib/db/schema'
import { registrarImpresiones } from '../impressions'

/**
 * El contador de impresiones (decisión 22) contra la base real.
 *
 * Lo que se verifica es que **suma** y que suma en la fila del día, porque es el
 * dato que no se puede reconstruir después: si esto se pierde, el histórico del
 * teaser B2B (spec 7) nace vacío y no hay forma de recuperarlo.
 */

describe.runIf(process.env.DATABASE_URL)('impresiones agregadas', () => {
  const usados: string[] = []

  async function unLugar(): Promise<string> {
    const [fila] = await db.select({ id: places.id }).from(places).limit(1)
    usados.push(fila.id)
    return fila.id
  }

  async function contador(placeId: string): Promise<number> {
    const [fila] = await db
      .select({ n: placeImpressionsDaily.impressions })
      .from(placeImpressionsDaily)
      .where(
        and(
          eq(placeImpressionsDaily.placeId, placeId),
          eq(placeImpressionsDaily.date, sql`current_date` as unknown as string),
        ),
      )
    return fila?.n ?? 0
  }

  // Los tests escriben en la fila de HOY de lugares reales. Se limpia lo que se
  // sumó para no ensuciar el histórico, que es un dato de producto.
  afterEach(async () => {
    for (const id of usados) {
      await db
        .delete(placeImpressionsDaily)
        .where(
          and(
            eq(placeImpressionsDaily.placeId, id),
            eq(placeImpressionsDaily.date, sql`current_date` as unknown as string),
          ),
        )
    }
    usados.length = 0
  })

  it('suma 1 al lugar servido', async () => {
    const id = await unLugar()
    const antes = await contador(id)

    await registrarImpresiones([id])

    expect(await contador(id)).toBe(antes + 1)
  })

  it('acumula entre búsquedas en vez de pisar', async () => {
    // El upsert es `impressions + excluded.impressions`, no un SET: dos
    // búsquedas que muestran el mismo lugar suman dos.
    const id = await unLugar()
    const antes = await contador(id)

    await registrarImpresiones([id])
    await registrarImpresiones([id])
    await registrarImpresiones([id])

    expect(await contador(id)).toBe(antes + 3)
  })

  it('un lugar repetido en la misma página cuenta una sola vez', async () => {
    const id = await unLugar()
    const antes = await contador(id)

    await registrarImpresiones([id, id, id])

    expect(await contador(id)).toBe(antes + 1)
  })

  it('con lista vacía no hace nada ni rompe', async () => {
    await expect(registrarImpresiones([])).resolves.toBeUndefined()
  })

  it('un id inexistente no tumba la búsqueda', async () => {
    // La FK rechaza la fila. Una impresión perdida no puede voltear la pantalla
    // que la generó: la función traga el error y loguea.
    await expect(
      registrarImpresiones(['00000000-0000-0000-0000-000000000000']),
    ).resolves.toBeUndefined()
  })

  it('no guarda ningún dato por usuario', async () => {
    // Decisión 22 (+ FICHA decisión 24 + MONETIZACION decisión 20): agregado puro.
    // La tabla suma contadores por lugar y día —impresiones, aperturas de ficha y
    // veces destacado— y ninguna columna identifica a nadie. Si alguien agrega
    // user_id o ip, esto falla.
    const columnas = await db.execute<{ column_name: string }>(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'place_impressions_daily'
    `)
    const nombres = [...(columnas as unknown as { column_name: string }[])]
      .map((c) => c.column_name)
      .sort()

    expect(nombres).toEqual([
      'date',
      'detail_views',
      'featured_impressions',
      'impressions',
      'place_id',
    ])
  })
})
