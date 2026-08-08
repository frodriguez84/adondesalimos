import 'dotenv/config'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { and, eq, like } from 'drizzle-orm'
import { db } from '@/lib/db'
import { placeTagSuggestions, placeTags, placeZones, places, tags, zones } from '@/lib/db/schema'
import { getConfidenceThreshold } from '@/lib/db/settings'
import { FACETAS_SUGERIBLES } from '../facetas'
import { buscarLugaresPorNombre, lugarParaCurar, proximoLugarDeZona, zonasConCola } from '../query'

/**
 * CURADURIA_POR_NOMBRE — las dos mitades del spec contra la DB local:
 *
 *  - `FB-10b` (decisión 3): el armador de la cola devuelve el precio que el lugar
 *    ya tiene, para que el editor no arranque en "No sé" y guardar no lo borre.
 *  - `FB-10` (decisión 1): el buscador de admin NO filtra por publicado — un lugar
 *    despublicado aparece, marcado como tal.
 */

const PREFIJO = '__test_curnom__'

let hayDb = true
let zonaSlug = ''
let placeConPrecio = ''
let placeDespublicado = ''
let tagPrecioSlug = ''

async function limpiar() {
  await db.delete(places).where(like(places.name, `${PREFIJO}%`))
}

beforeAll(async () => {
  try {
    await getConfidenceThreshold()
  } catch {
    hayDb = false
    return
  }
  await limpiar()

  // Una zona SIN cola: así el lugar de prueba es sí o sí el próximo de esa zona.
  const conCola = new Set((await zonasConCola()).map((z) => z.slug))
  const zona = (await db.select({ id: zones.id, slug: zones.slug }).from(zones)).find(
    (z) => !conCola.has(z.slug),
  )
  const [tagPrecio] = await db.select({ id: tags.id, slug: tags.slug }).from(tags).where(eq(tags.facet, 'precio')).limit(1)
  const [tagSugerible] = await db
    .select({ id: tags.id })
    .from(tags)
    .where(eq(tags.facet, FACETAS_SUGERIBLES[0]))
    .limit(1)
  if (!zona || !tagPrecio || !tagSugerible) {
    hayDb = false
    return
  }
  zonaSlug = zona.slug
  tagPrecioSlug = tagPrecio.slug

  // Un lugar con precio ya asignado, en la cola de una zona.
  const [creado] = await db
    .insert(places)
    .values({ source: 'overture', name: `${PREFIJO} con precio`, lat: -34.6, lng: -58.4, confidence: 0.9 })
    .returning({ id: places.id })
  placeConPrecio = creado.id
  await db.insert(placeZones).values({ placeId: placeConPrecio, zoneId: zona.id, isPrimary: true })
  // El precio lo puso el import, no la curaduría: el editor igual debe mostrarlo.
  await db.insert(placeTags).values({ placeId: placeConPrecio, tagId: tagPrecio.id, source: 'import' })
  // Un lugar despublicado (confidence bajo el umbral, sin override): el buscador
  // de admin tiene que encontrarlo igual (decisión 1).
  const [oculto] = await db
    .insert(places)
    .values({
      source: 'overture',
      name: `${PREFIJO} despublicado`,
      lat: -34.6,
      lng: -58.4,
      confidence: 0,
    })
    .returning({ id: places.id })
  placeDespublicado = oculto.id

  await db.insert(placeTagSuggestions).values({
    placeId: placeConPrecio,
    tagId: tagSugerible.id,
    status: 'pending',
    evidence: 'test',
    modelUsed: 'test',
  })
})

afterAll(async () => {
  if (!hayDb) return
  await limpiar()
})

describe.runIf(process.env.DATABASE_URL)('FB-10b — el armador trae el precio asignado', () => {
  it('proximoLugarDeZona devuelve precioSlug del lugar (sin filtrar por source)', async () => {
    if (!hayDb) return
    const lugar = await proximoLugarDeZona(zonaSlug)
    expect(lugar?.id).toBe(placeConPrecio)
    expect(lugar?.precioSlug).toBe(tagPrecioSlug)
  })
})

describe.runIf(process.env.DATABASE_URL)('FB-10 — buscador por nombre', () => {
  it('encuentra un lugar despublicado y lo marca como tal (decisión 1)', async () => {
    if (!hayDb) return
    const resultados = await buscarLugaresPorNombre(`${PREFIJO} despublicado`)
    const encontrado = resultados.find((r) => r.id === placeDespublicado)
    expect(encontrado).toBeDefined()
    expect(encontrado?.publicado).toBe(false)
  })

  it('el flag `publicado` sale de la fuente única: el publicado da true', async () => {
    if (!hayDb) return
    const resultados = await buscarLugaresPorNombre(`${PREFIJO} con precio`)
    expect(resultados.find((r) => r.id === placeConPrecio)?.publicado).toBe(true)
  })

  it('con menos de 2 caracteres devuelve lista vacía, sin explotar', async () => {
    if (!hayDb) return
    expect(await buscarLugaresPorNombre('a')).toEqual([])
    expect(await buscarLugaresPorNombre('  ')).toEqual([])
  })

  it('lugarParaCurar arma el mismo editor: sin sugerencias y con el precio ya asignado', async () => {
    if (!hayDb) return
    const lugar = await lugarParaCurar(placeConPrecio)
    expect(lugar?.sugerencias).toEqual([])
    expect(lugar?.precioSlug).toBe(tagPrecioSlug)
    expect(lugar?.facetas.length).toBe(FACETAS_SUGERIBLES.length)
  })

  it('un placeId que no existe (o no es uuid) devuelve null, no un error', async () => {
    if (!hayDb) return
    expect(await lugarParaCurar('no-soy-un-uuid')).toBeNull()
    expect(await lugarParaCurar('00000000-0000-0000-0000-000000000000')).toBeNull()
  })
})
