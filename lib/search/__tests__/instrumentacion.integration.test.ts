import 'dotenv/config'
import { and, eq, sql } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'

import { db } from '@/lib/db'
import {
  placeTagImpressionsDaily,
  placeTapsDaily,
  places,
  tags,
} from '@/lib/db/schema'
import { registrarTagsDeBusqueda, registrarTap } from '../impressions'

/**
 * La instrumentación nueva de MONETIZACION (decisión 22) contra la base real:
 * taps por tipo y "qué filtros te encontraron". Lo que se verifica es que **suma**
 * en la fila del día y que **ninguna** de las dos tablas guarda datos por usuario
 * —es el histórico que vende el B2B y el invariante que lo hace vendible.
 */

describe.runIf(process.env.DATABASE_URL)('instrumentación agregada (taps + tags)', () => {
  const lugaresUsados: string[] = []

  async function unLugar(): Promise<string> {
    const [fila] = await db.select({ id: places.id }).from(places).limit(1)
    lugaresUsados.push(fila.id)
    return fila.id
  }

  async function unTag(): Promise<{ id: number; slug: string }> {
    const [fila] = await db
      .select({ id: tags.id, slug: tags.slug })
      .from(tags)
      .where(eq(tags.active, true))
      .limit(1)
    return fila
  }

  async function contadorTap(placeId: string, kind: 'telefono' | 'como_llegar'): Promise<number> {
    const [fila] = await db
      .select({ n: placeTapsDaily.count })
      .from(placeTapsDaily)
      .where(
        and(
          eq(placeTapsDaily.placeId, placeId),
          eq(placeTapsDaily.kind, kind),
          eq(placeTapsDaily.date, sql`current_date` as unknown as string),
        ),
      )
    return fila?.n ?? 0
  }

  async function contadorTag(placeId: string, tagId: number): Promise<number> {
    const [fila] = await db
      .select({ n: placeTagImpressionsDaily.count })
      .from(placeTagImpressionsDaily)
      .where(
        and(
          eq(placeTagImpressionsDaily.placeId, placeId),
          eq(placeTagImpressionsDaily.tagId, tagId),
          eq(placeTagImpressionsDaily.date, sql`current_date` as unknown as string),
        ),
      )
    return fila?.n ?? 0
  }

  // Los tests escriben en la fila de HOY de lugares reales. Se limpia lo que se
  // sumó para no ensuciar el histórico, que es dato de producto.
  afterEach(async () => {
    for (const id of lugaresUsados) {
      await db
        .delete(placeTapsDaily)
        .where(
          and(
            eq(placeTapsDaily.placeId, id),
            eq(placeTapsDaily.date, sql`current_date` as unknown as string),
          ),
        )
      await db
        .delete(placeTagImpressionsDaily)
        .where(
          and(
            eq(placeTagImpressionsDaily.placeId, id),
            eq(placeTagImpressionsDaily.date, sql`current_date` as unknown as string),
          ),
        )
    }
    lugaresUsados.length = 0
  })

  // --- Taps ----------------------------------------------------------------

  it('un tap suma 1 en su tipo y no toca los otros', async () => {
    const id = await unLugar()
    const antesTel = await contadorTap(id, 'telefono')
    const antesMapa = await contadorTap(id, 'como_llegar')

    await registrarTap(id, 'telefono')

    expect(await contadorTap(id, 'telefono')).toBe(antesTel + 1)
    // El pk es (place, día, kind): otro tipo es otra fila, no se toca.
    expect(await contadorTap(id, 'como_llegar')).toBe(antesMapa)
  })

  it('taps repetidos del mismo tipo acumulan', async () => {
    const id = await unLugar()
    const antes = await contadorTap(id, 'como_llegar')

    await registrarTap(id, 'como_llegar')
    await registrarTap(id, 'como_llegar')
    await registrarTap(id, 'como_llegar')

    expect(await contadorTap(id, 'como_llegar')).toBe(antes + 3)
  })

  it('un tap sobre un id inexistente no rompe (best-effort)', async () => {
    await expect(
      registrarTap('00000000-0000-0000-0000-000000000000', 'telefono'),
    ).resolves.toBeUndefined()
  })

  // --- Tags por búsqueda ---------------------------------------------------

  it('cada lugar servido suma 1 en cada tag activo de la búsqueda', async () => {
    const id = await unLugar()
    const tag = await unTag()
    const antes = await contadorTag(id, tag.id)

    await registrarTagsDeBusqueda([id], [tag.slug])

    expect(await contadorTag(id, tag.id)).toBe(antes + 1)
  })

  it('un lugar repetido en la misma página cuenta una sola vez', async () => {
    const id = await unLugar()
    const tag = await unTag()
    const antes = await contadorTag(id, tag.id)

    await registrarTagsDeBusqueda([id, id, id], [tag.slug])

    expect(await contadorTag(id, tag.id)).toBe(antes + 1)
  })

  it('sin tags activos no registra nada (texto libre / zona no cuentan)', async () => {
    const id = await unLugar()
    const tag = await unTag()
    const antes = await contadorTag(id, tag.id)

    await registrarTagsDeBusqueda([id], [])

    expect(await contadorTag(id, tag.id)).toBe(antes)
  })

  it('un slug inexistente se ignora, no rompe', async () => {
    const id = await unLugar()
    await expect(
      registrarTagsDeBusqueda([id], ['no-existe-este-tag-xyz']),
    ).resolves.toBeUndefined()
  })

  // --- Invariante: agregado puro (decisión 22) -----------------------------

  it('place_taps_daily no guarda ningún dato por usuario', async () => {
    // Si alguien agrega user_id, ip o una cookie, esto falla. El dato es del
    // dueño (agregado), no un rastro de quién tocó qué.
    const columnas = await db.execute<{ column_name: string }>(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'place_taps_daily'
    `)
    const nombres = [...(columnas as unknown as { column_name: string }[])]
      .map((c) => c.column_name)
      .sort()

    expect(nombres).toEqual(['count', 'date', 'kind', 'place_id'])
  })

  it('place_tag_impressions_daily no guarda ningún dato por usuario', async () => {
    const columnas = await db.execute<{ column_name: string }>(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'place_tag_impressions_daily'
    `)
    const nombres = [...(columnas as unknown as { column_name: string }[])]
      .map((c) => c.column_name)
      .sort()

    expect(nombres).toEqual(['count', 'date', 'place_id', 'tag_id'])
  })
})
