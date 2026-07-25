import 'dotenv/config'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { and, eq, inArray, like, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { placeImpressionsDaily, placeTags, placeZones, places, tags, zones } from '@/lib/db/schema'
import { EMPTY_SEARCH, type SearchParams } from '../params'
import { buscarDestacados } from '../query'
import { registrarDestacados, registrarImpresiones } from '../impressions'

/**
 * El destaque B2B en búsqueda contra el Postgres real (MONETIZACION, F3 —
 * decisiones 20-21). Se verifica lo que la rotación promete y no se puede probar
 * sin la base: candidatos = pago ∩ publicado ∩ el where de la búsqueda, orden por
 * `featured_impressions` ascendente (menor-mostrado-primero), determinista dentro
 * del día, tope de 3 y nada de relleno con no-pagos.
 *
 * Fixtures en una zona de test propia: una zona real tiene cientos de lugares y
 * el candidato de destaque no se distinguiría del ruido.
 */

const PREFIJO = '__test_dest__'
const ZONA = '__test-dest-zona__'

const POLIGONO = {
  type: 'Polygon' as const,
  coordinates: [
    [
      [-69.5, -42.5],
      [-67.5, -42.5],
      [-67.5, -40.5],
      [-69.5, -40.5],
      [-69.5, -42.5],
    ],
  ],
}

type Fixture = {
  nombre: string
  tags: string[]
  paid: boolean
  /** Publicado salvo que se baje la confidence bajo el umbral. */
  confidence?: number
}

const FIXTURES: Fixture[] = [
  // 4 pagos publicados que matchean "bar": son los candidatos del destaque.
  { nombre: 'Pago 1', tags: ['bar'], paid: true },
  { nombre: 'Pago 2', tags: ['bar'], paid: true },
  { nombre: 'Pago 3', tags: ['bar'], paid: true },
  { nombre: 'Pago 4', tags: ['bar'], paid: true },
  // Free: matchea y está publicado, pero NUNCA se destaca.
  { nombre: 'Free Bar', tags: ['bar'], paid: false },
  // Pago pero despublicado (bajo umbral): el `publishedWhere` lo saca.
  { nombre: 'Pago Despublicado', tags: ['bar'], paid: true, confidence: 0.05 },
  // Pago publicado pero de otro tag: no matchea la búsqueda de "bar".
  { nombre: 'Pago Cafe', tags: ['cafe'], paid: true },
]

let hayDb = true
let idDeLugar: Record<string, string> = {}

/** Solo los ids de los fixtures, para limpiar sus filas de contador. */
function idsFixture(): string[] {
  return Object.values(idDeLugar)
}

function buscar(parcial: Partial<SearchParams>) {
  return buscarDestacados({ ...EMPTY_SEARCH, ...parcial })
}

/** Nombres del resultado, sin prefijo, para que las aserciones se lean. */
function nombres(r: { name: string }[]): string[] {
  return r.map((p) => p.name.replace(`${PREFIJO} `, ''))
}

async function limpiar() {
  const filas = await db
    .select({ id: places.id })
    .from(places)
    .where(like(places.name, `${PREFIJO}%`))
  const ids = filas.map((f) => f.id)
  if (ids.length > 0) {
    await db.delete(placeImpressionsDaily).where(inArray(placeImpressionsDaily.placeId, ids))
  }
  await db.delete(places).where(like(places.name, `${PREFIJO}%`))
  await db.delete(zones).where(eq(zones.slug, ZONA))
}

beforeAll(async () => {
  try {
    await db.select({ n: sql`1` }).from(zones).limit(1)
  } catch {
    hayDb = false
    return
  }

  await limpiar()

  const [zona] = await db
    .insert(zones)
    .values({ region: 'caba', name: ZONA, slug: ZONA, polygon: POLIGONO, polygonSearch: POLIGONO })
    .returning({ id: zones.id })

  const slugsTag = [...new Set(FIXTURES.flatMap((f) => f.tags))]
  const filasTags = await db
    .select({ id: tags.id, slug: tags.slug })
    .from(tags)
    .where(inArray(tags.slug, slugsTag))
  const idDeTag = Object.fromEntries(filasTags.map((t) => [t.slug, t.id]))
  for (const slug of slugsTag) {
    if (!idDeTag[slug]) throw new Error(`El fixture usa un tag que no existe: ${slug}`)
  }

  const creados = await db
    .insert(places)
    .values(
      FIXTURES.map((f) => ({
        source: 'overture' as const,
        name: `${PREFIJO} ${f.nombre}`,
        lat: -41.5,
        lng: -68.5,
        confidence: f.confidence ?? 0.8,
        ownerPlan: (f.paid ? 'paid' : 'free') as 'paid' | 'free',
      })),
    )
    .returning({ id: places.id, name: places.name })
  idDeLugar = Object.fromEntries(
    creados.map((p) => [p.name.replace(`${PREFIJO} `, ''), p.id]),
  )

  await db.insert(placeTags).values(
    FIXTURES.flatMap((f) =>
      f.tags.map((slug) => ({ placeId: idDeLugar[f.nombre], tagId: idDeTag[slug] })),
    ),
  )

  await db.insert(placeZones).values(
    FIXTURES.map((f) => ({ placeId: idDeLugar[f.nombre], zoneId: zona.id, isPrimary: true })),
  )
})

// Cada test que toca `featured_impressions` deja la fila del día en cero para que
// la rotación del siguiente arranque limpia (el orden depende del contador).
afterEach(async () => {
  if (!hayDb) return
  const ids = idsFixture()
  if (ids.length > 0) {
    await db
      .delete(placeImpressionsDaily)
      .where(
        and(
          inArray(placeImpressionsDaily.placeId, ids),
          eq(placeImpressionsDaily.date, sql`current_date` as unknown as string),
        ),
      )
  }
})

afterAll(async () => {
  if (hayDb) await limpiar()
})

describe.runIf(process.env.DATABASE_URL)('destaque en búsqueda (MONETIZACION F3)', () => {
  it('con 4+ pagos que matchean, devuelve exactamente 3 y todos pagos publicados', async () => {
    const r = await buscar({ zones: [ZONA], tags: ['bar'] })

    expect(r).toHaveLength(3)
    // Nunca un free, un despublicado ni uno de otro tag.
    expect(nombres(r)).not.toContain('Free Bar')
    expect(nombres(r)).not.toContain('Pago Despublicado')
    expect(nombres(r)).not.toContain('Pago Cafe')
    // Los 3 salen del pool de pagos que matchean.
    for (const n of nombres(r)) {
      expect(['Pago 1', 'Pago 2', 'Pago 3', 'Pago 4']).toContain(n)
    }
  })

  it('solo destaca si matchea los filtros: con "cafe" aparece el pago de cafe, con "bar" no', async () => {
    const cafe = await buscar({ zones: [ZONA], tags: ['cafe'] })
    expect(nombres(cafe)).toEqual(['Pago Cafe'])

    const bar = await buscar({ zones: [ZONA], tags: ['bar'] })
    expect(nombres(bar)).not.toContain('Pago Cafe')
  })

  it('rota: el que menos salió destacado hoy va primero', async () => {
    // Pago 1 y Pago 2 ya salieron 5 veces hoy; Pago 3 y Pago 4, cero.
    await db.insert(placeImpressionsDaily).values(
      ['Pago 1', 'Pago 2'].map((n) => ({
        placeId: idDeLugar[n],
        date: sql`current_date` as unknown as string,
        featuredImpressions: 5,
      })),
    )

    const r = await buscar({ zones: [ZONA], tags: ['bar'] })

    // Los dos primeros son los de menor contador (0), en cualquier orden entre sí.
    expect(nombres(r).slice(0, 2).sort()).toEqual(['Pago 3', 'Pago 4'])
    // El tercero sale del pool rezagado.
    expect(['Pago 1', 'Pago 2']).toContain(nombres(r)[2])
  })

  it('es determinista dentro del día: la misma búsqueda dos veces da el mismo orden', async () => {
    const a = await buscar({ zones: [ZONA], tags: ['bar'] })
    const b = await buscar({ zones: [ZONA], tags: ['bar'] })
    expect(nombres(a)).toEqual(nombres(b))
  })

  it('no se deadlockea con impresiones y destacados concurrentes sobre las mismas filas', async () => {
    // Regresión del deadlock (40P01) que encontró el QA en vivo de F3: dos
    // upserts concurrentes sobre `place_impressions_daily` que comparten filas y
    // las lockeaban en distinto orden. Los inputs van en orden OPUESTO a propósito
    // (el fix ordena por place_id adentro, así que el orden de locking igual queda
    // estable). Sin el fix, algunos upserts se deadlockean y el try/catch se los
    // traga → el conteo queda corto. Se afirma el conteo exacto: si algo se
    // perdió, falla.
    const ids = [idDeLugar['Pago 1'], idDeLugar['Pago 2'], idDeLugar['Pago 3']]
    const asc = [...ids].sort()
    const desc = [...asc].reverse()

    const contar = async (placeId: string) => {
      const [fila] = await db
        .select({ imp: placeImpressionsDaily.impressions, feat: placeImpressionsDaily.featuredImpressions })
        .from(placeImpressionsDaily)
        .where(
          and(
            eq(placeImpressionsDaily.placeId, placeId),
            eq(placeImpressionsDaily.date, sql`current_date` as unknown as string),
          ),
        )
      return { imp: fila?.imp ?? 0, feat: fila?.feat ?? 0 }
    }

    const antes = Object.fromEntries(await Promise.all(ids.map(async (id) => [id, await contar(id)])))

    const N = 10
    const ops: Promise<void>[] = []
    for (let i = 0; i < N; i++) {
      ops.push(registrarImpresiones(asc)) // orgánico ∪ destacados, orden ascendente
      ops.push(registrarDestacados(desc)) // destacados, orden opuesto
    }
    await Promise.all(ops)

    for (const id of ids) {
      const ahora = await contar(id)
      expect(ahora.imp).toBe(antes[id].imp + N) // ni un increment perdido
      expect(ahora.feat).toBe(antes[id].feat + N)
    }
  })

  it('registrarDestacados suma 1 en featured_impressions del día', async () => {
    const id = idDeLugar['Pago 1']

    const antes = async () => {
      const [fila] = await db
        .select({ n: placeImpressionsDaily.featuredImpressions })
        .from(placeImpressionsDaily)
        .where(
          and(
            eq(placeImpressionsDaily.placeId, id),
            eq(placeImpressionsDaily.date, sql`current_date` as unknown as string),
          ),
        )
      return fila?.n ?? 0
    }

    const base = await antes()
    await registrarDestacados([id])
    expect(await antes()).toBe(base + 1)
  })
})
