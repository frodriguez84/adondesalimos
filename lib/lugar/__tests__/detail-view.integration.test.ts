import 'dotenv/config'
import { and, eq, sql } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'

import { db } from '@/lib/db'
import { placeImpressionsDaily, places } from '@/lib/db/schema'
import { registrarDetailView } from '@/lib/search/impressions'

/**
 * El contador de aperturas de ficha (FICHA, decisión 24) contra la base real.
 *
 * Comparte tabla con las impresiones pero suma en `detail_views`, no en
 * `impressions`: es el "cuánta gente vio tu ficha" del B2B y, como el histórico
 * de impresiones, no se puede reconstruir después.
 */
describe.runIf(process.env.DATABASE_URL)('aperturas de ficha (detail_views)', () => {
  const usados: string[] = []

  async function unLugar(): Promise<string> {
    const [fila] = await db.select({ id: places.id }).from(places).limit(1)
    usados.push(fila.id)
    return fila.id
  }

  async function contadores(placeId: string): Promise<{ detail: number; impresiones: number }> {
    const [fila] = await db
      .select({ detail: placeImpressionsDaily.detailViews, impresiones: placeImpressionsDaily.impressions })
      .from(placeImpressionsDaily)
      .where(
        and(
          eq(placeImpressionsDaily.placeId, placeId),
          eq(placeImpressionsDaily.date, sql`current_date` as unknown as string),
        ),
      )
    return { detail: fila?.detail ?? 0, impresiones: fila?.impresiones ?? 0 }
  }

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

  it('suma 1 por apertura, en la fila de hoy', async () => {
    const id = await unLugar()
    const antes = await contadores(id)

    await registrarDetailView(id)

    expect((await contadores(id)).detail).toBe(antes.detail + 1)
  })

  it('acumula entre aperturas en vez de pisar', async () => {
    const id = await unLugar()
    const antes = await contadores(id)

    await registrarDetailView(id)
    await registrarDetailView(id)
    await registrarDetailView(id)

    expect((await contadores(id)).detail).toBe(antes.detail + 3)
  })

  it('no toca la columna de impresiones — son métricas distintas', async () => {
    const id = await unLugar()
    const antes = await contadores(id)

    await registrarDetailView(id)

    expect((await contadores(id)).impresiones).toBe(antes.impresiones)
  })

  it('un id inexistente no tumba la ficha', async () => {
    await expect(
      registrarDetailView('00000000-0000-0000-0000-000000000000'),
    ).resolves.toBeUndefined()
  })
})
