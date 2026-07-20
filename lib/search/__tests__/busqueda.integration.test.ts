import 'dotenv/config'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq, inArray, like, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { placeTags, placeZones, places, tags, zones } from '@/lib/db/schema'
import { EMPTY_SEARCH, type SearchParams } from '../params'
import { countPlaces, searchPlaces } from '../query'

/**
 * Semántica del motor contra el Postgres real (DoD de BUSQUEDA).
 *
 * Los fixtures viven en **zonas de test propias** y no en zonas reales: una zona
 * real tiene hasta 1.706 lugares publicados y la página es de 20, así que los
 * lugares de prueba no entrarían en el resultado y el test no probaría nada.
 * Filtrando por una zona propia el resultado es exactamente el fixture.
 *
 * Las coordenadas caen en la Patagonia, lejos del bbox de AMBA, para que el test
 * de GPS no arrastre lugares reales.
 */

const PREFIJO = '__test_busq__'
const ZONA_A = '__test-busq-zona-a__'
const ZONA_B = '__test-busq-zona-b__'
const ZONA_PAGINA = '__test-busq-zona-pagina__'

/** Lejos de AMBA: garantiza que el radio de 2 km solo encuentre fixtures. */
const BASE_LAT = -41.5
const BASE_LNG = -68.5

let hayDb = true
let idsDeZona: Record<string, number> = {}

/** Polígono mínimo válido. No se usa para nada: `place_zones` se llena a mano. */
const POLIGONO = {
  type: 'Polygon' as const,
  coordinates: [
    [
      [BASE_LNG - 1, BASE_LAT - 1],
      [BASE_LNG + 1, BASE_LAT - 1],
      [BASE_LNG + 1, BASE_LAT + 1],
      [BASE_LNG - 1, BASE_LAT + 1],
      [BASE_LNG - 1, BASE_LAT - 1],
    ],
  ],
}

type Fixture = {
  nombre: string
  tags?: string[]
  zona?: string
  confidence?: number | null
  owner?: boolean
  override?: boolean
  lat?: number
  lng?: number
}

const FIXTURES: Fixture[] = [
  // --- Semántica de facetas (zona A) ---------------------------------------
  { nombre: 'Bar Solo', tags: ['bar'], zona: ZONA_A },
  { nombre: 'Cerveceria Sola', tags: ['cerveceria'], zona: ZONA_A },
  { nombre: 'Bar con Juegos', tags: ['bar', 'juegos-de-mesa'], zona: ZONA_A },
  { nombre: 'Sushi Test', tags: ['japonesa-sushi'], zona: ZONA_A },
  { nombre: 'Cafe Con Tilde Café', tags: ['cafe'], zona: ZONA_A },

  // --- Visibilidad: nunca deben aparecer -----------------------------------
  { nombre: 'Invisible Bajo Umbral', tags: ['bar'], zona: ZONA_A, confidence: 0.1 },
  { nombre: 'Duenio Sin Override', tags: ['bar'], zona: ZONA_A, owner: true, confidence: null },

  // --- Zona B: prueba la multiselección ------------------------------------
  { nombre: 'Bar de Zona B', tags: ['bar'], zona: ZONA_B },

  // --- Orden (decisión 16) — todos en zona A con tag propio ----------------
  { nombre: 'Orden Z Alta', tags: ['wine-bar'], zona: ZONA_A, confidence: 0.9 },
  { nombre: 'Orden A Baja', tags: ['wine-bar'], zona: ZONA_A, confidence: 0.6 },
  {
    nombre: 'Orden M Duenio',
    tags: ['wine-bar'],
    zona: ZONA_A,
    owner: true,
    confidence: null,
    override: true,
  },
  { nombre: 'Orden B Empate', tags: ['wine-bar'], zona: ZONA_A, confidence: 0.7 },
  { nombre: 'Orden C Empate', tags: ['wine-bar'], zona: ZONA_A, confidence: 0.7 },

  // --- Orden CON texto: la similitud tiene que ganarle al orden orgánico ---
  // Medido con `word_similarity` contra la base: "petunia roja" da 1.000 contra
  // "Petunia Roja" y 0.615 contra "Petunia Azul Marino", y las dos pasan el
  // umbral de `<%` (0.6). El de dueño es el de MENOR similitud a propósito: sin
  // texto encabezaría por la decisión 16, así que si igual queda segundo, lo que
  // manda es la similitud.
  {
    nombre: 'Petunia Azul Marino',
    tags: ['wine-bar'],
    zona: ZONA_B,
    owner: true,
    confidence: null,
    override: true,
  },
  { nombre: 'Petunia Roja', tags: ['wine-bar'], zona: ZONA_B, confidence: 0.6 },

  // --- GPS: uno adentro del radio de 2 km, otro afuera ---------------------
  { nombre: 'GPS Cerca', tags: ['bar'], zona: ZONA_B, lat: BASE_LAT + 0.005, lng: BASE_LNG },
  { nombre: 'GPS Lejos', tags: ['bar'], zona: ZONA_B, lat: BASE_LAT + 0.5, lng: BASE_LNG },
]

// 25 lugares para ejercer la página de 20 y el cursor. Van lejos del punto base
// a propósito: en el mismo lugar quedarían a distancia 0 y coparían la página
// del test de GPS, que es de 20.
for (let i = 0; i < 25; i++) {
  FIXTURES.push({
    nombre: `Paginado ${String(i).padStart(2, '0')}`,
    tags: ['bar'],
    zona: ZONA_PAGINA,
    confidence: 0.8,
    lat: BASE_LAT + 5,
    lng: BASE_LNG + 5,
  })
}

function buscar(parcial: Partial<SearchParams>) {
  return searchPlaces({ ...EMPTY_SEARCH, ...parcial })
}

/** Nombres del resultado, sin el prefijo, para que las aserciones se lean. */
function nombres(r: { places: { name: string }[] }): string[] {
  return r.places.map((p) => p.name.replace(`${PREFIJO} `, ''))
}

async function limpiar() {
  await db.delete(places).where(like(places.name, `${PREFIJO}%`))
  await db.delete(zones).where(inArray(zones.slug, [ZONA_A, ZONA_B, ZONA_PAGINA]))
}

beforeAll(async () => {
  try {
    await db.select({ n: sql`1` }).from(zones).limit(1)
  } catch {
    hayDb = false
    return
  }

  await limpiar()

  const zonasCreadas = await db
    .insert(zones)
    .values(
      [ZONA_A, ZONA_B, ZONA_PAGINA].map((slug) => ({
        region: 'caba' as const,
        name: slug,
        slug,
        polygon: POLIGONO,
        polygonSearch: POLIGONO,
      })),
    )
    .returning({ id: zones.id, slug: zones.slug })
  idsDeZona = Object.fromEntries(zonasCreadas.map((z) => [z.slug, z.id]))

  const tagsNecesarios = [...new Set(FIXTURES.flatMap((f) => f.tags ?? []))]
  const filasTags = await db
    .select({ id: tags.id, slug: tags.slug })
    .from(tags)
    .where(inArray(tags.slug, tagsNecesarios))
  const idDeTag = Object.fromEntries(filasTags.map((t) => [t.slug, t.id]))

  // Si la taxonomía no tiene alguno de estos slugs, el test miente en silencio.
  for (const slug of tagsNecesarios) {
    if (!idDeTag[slug]) throw new Error(`El fixture usa un tag que no existe: ${slug}`)
  }

  const creados = await db
    .insert(places)
    .values(
      FIXTURES.map((f) => ({
        source: f.owner ? ('owner' as const) : ('overture' as const),
        name: `${PREFIJO} ${f.nombre}`,
        lat: f.lat ?? BASE_LAT,
        lng: f.lng ?? BASE_LNG,
        confidence: f.confidence === undefined ? 0.8 : f.confidence,
        publishOverride: f.override ?? false,
      })),
    )
    .returning({ id: places.id, name: places.name })

  const idDeLugar = Object.fromEntries(creados.map((p) => [p.name, p.id]))

  await db.insert(placeTags).values(
    FIXTURES.flatMap((f) =>
      (f.tags ?? []).map((slug) => ({
        placeId: idDeLugar[`${PREFIJO} ${f.nombre}`],
        tagId: idDeTag[slug],
      })),
    ),
  )

  await db.insert(placeZones).values(
    FIXTURES.filter((f) => f.zona).map((f) => ({
      placeId: idDeLugar[`${PREFIJO} ${f.nombre}`],
      zoneId: idsDeZona[f.zona!],
      isPrimary: true,
    })),
  )
})

afterAll(async () => {
  if (hayDb) await limpiar()
})

describe.runIf(process.env.DATABASE_URL)('motor de búsqueda', () => {
  describe('visibilidad (CATALOGO, fuente única)', () => {
    it('nunca devuelve lugares bajo el umbral ni de dueño sin override', async () => {
      const r = await buscar({ zones: [ZONA_A] })
      expect(nombres(r)).not.toContain('Invisible Bajo Umbral')
      expect(nombres(r)).not.toContain('Duenio Sin Override')
    })

    it('tampoco los devuelve buscando por texto, que es otro camino a la query', async () => {
      const r = await buscar({ q: 'Invisible Bajo Umbral' })
      expect(nombres(r)).not.toContain('Invisible Bajo Umbral')
    })
  })

  describe('decisión 13 — OR dentro de faceta, AND entre facetas', () => {
    it('dos tags de la misma faceta amplían (OR)', async () => {
      const soloBar = await buscar({ zones: [ZONA_A], tags: ['bar'] })
      const barOCerveceria = await buscar({ zones: [ZONA_A], tags: ['bar', 'cerveceria'] })

      expect(nombres(soloBar).sort()).toEqual(['Bar Solo', 'Bar con Juegos'])
      expect(nombres(barOCerveceria).sort()).toEqual([
        'Bar Solo',
        'Bar con Juegos',
        'Cerveceria Sola',
      ])
    })

    it('tags de facetas distintas achican (AND)', async () => {
      const r = await buscar({ zones: [ZONA_A], tags: ['bar', 'juegos-de-mesa'] })
      expect(nombres(r)).toEqual(['Bar con Juegos'])
    })

    it('un padre de Cocina trae a sus hijos', async () => {
      const hijo = await buscar({ zones: [ZONA_A], tags: ['japonesa-sushi'] })
      const padre = await buscar({ zones: [ZONA_A], tags: ['asiatica'] })

      expect(nombres(hijo)).toEqual(['Sushi Test'])
      // El padre es superconjunto del hijo (BUSQ-04).
      expect(nombres(padre)).toEqual(expect.arrayContaining(nombres(hijo)))
    })

    it('un slug inexistente se ignora en vez de vaciar el resultado', async () => {
      const r = await buscar({ zones: [ZONA_A], tags: ['no-existe-este-tag'] })
      expect(nombres(r).length).toBeGreaterThan(0)
    })
  })

  describe('zonas', () => {
    it('multiselección: dos zonas devuelven la unión', async () => {
      const a = await buscar({ zones: [ZONA_A], tags: ['bar'] })
      const ab = await buscar({ zones: [ZONA_A, ZONA_B], tags: ['bar'] })

      expect(nombres(a)).not.toContain('Bar de Zona B')
      expect(nombres(ab)).toContain('Bar de Zona B')
      expect(nombres(ab).length).toBeGreaterThan(nombres(a).length)
    })
  })

  describe('decisión 3 y 17 — GPS', () => {
    it('devuelve solo lo que está a 2 km o menos', async () => {
      const r = await buscar({ gps: true, coords: { lat: BASE_LAT, lng: BASE_LNG } })
      expect(nombres(r)).toContain('GPS Cerca')
      expect(nombres(r)).not.toContain('GPS Lejos')
    })

    it('informa la distancia y ordena por cercanía', async () => {
      const r = await buscar({ gps: true, coords: { lat: BASE_LAT, lng: BASE_LNG } })
      const distancias = r.places.map((p) => p.distanceKm!)
      expect(distancias.every((d) => typeof d === 'number' && d <= 2)).toBe(true)
      expect([...distancias].sort((a, b) => a - b)).toEqual(distancias)
    })

    it('REEMPLAZA a las zonas elegidas, no se suma a ellas', async () => {
      // ZONA_B tiene 'GPS Cerca' y 'Bar de Zona B'. Con GPS encendido, el filtro
      // de zona no aplica: manda el radio.
      const r = await buscar({
        zones: [ZONA_A],
        gps: true,
        coords: { lat: BASE_LAT + 0.005, lng: BASE_LNG },
      })
      expect(nombres(r)).toContain('GPS Cerca')
    })

    it('con gps encendido pero sin coordenadas cae al filtro de zona, no rompe', async () => {
      const r = await buscar({ zones: [ZONA_A], tags: ['juegos-de-mesa'], gps: true })
      expect(nombres(r)).toEqual(['Bar con Juegos'])
    })
  })

  describe('decisión 14 — texto', () => {
    it('sin tilde matchea con tilde', async () => {
      const r = await buscar({ q: 'cafe con tilde cafe' })
      expect(nombres(r)).toContain('Cafe Con Tilde Café')
    })

    it('tolera un typo razonable', async () => {
      const r = await buscar({ q: 'cerveceria sola' })
      expect(nombres(r)).toContain('Cerveceria Sola')
      const conTypo = await buscar({ q: 'cerveseria sola' })
      expect(nombres(conTypo)).toContain('Cerveceria Sola')
    })
  })

  describe('decisión 16 — orden orgánico', () => {
    it('dueño primero, después confidence desc, después nombre', async () => {
      const r = await buscar({ zones: [ZONA_A], tags: ['wine-bar'] })
      expect(nombres(r)).toEqual([
        'Orden M Duenio', // reclamado: mejor dato
        'Orden Z Alta', // 0.9
        'Orden B Empate', // 0.7, nombre antes que C
        'Orden C Empate', // 0.7
        'Orden A Baja', // 0.6
      ])
    })

    it('es estable: la misma búsqueda dos veces da el mismo orden', async () => {
      const a = await buscar({ zones: [ZONA_A], tags: ['wine-bar'] })
      const b = await buscar({ zones: [ZONA_A], tags: ['wine-bar'] })
      expect(nombres(a)).toEqual(nombres(b))
    })

    it('con texto manda la similitud, incluso por encima del lugar de dueño', async () => {
      // Sin `q`, el de dueño va primero (es lo que verifica el test de arriba).
      const sinTexto = await buscar({ zones: [ZONA_B], tags: ['wine-bar'] })
      expect(nombres(sinTexto)[0]).toBe('Petunia Azul Marino')

      // Con `q`, el que más se parece encabeza aunque no sea de dueño ni tenga
      // mejor confidence. Es la segunda mitad de la decisión 16.
      const conTexto = await buscar({ zones: [ZONA_B], tags: ['wine-bar'], q: 'petunia roja' })
      expect(nombres(conTexto).slice(0, 2)).toEqual(['Petunia Roja', 'Petunia Azul Marino'])
    })
  })

  describe('decisión 19 — paginación por cursor', () => {
    it('sirve 20 por página y encadena sin repetir ni saltear', async () => {
      const p1 = await buscar({ zones: [ZONA_PAGINA] })
      expect(p1.places).toHaveLength(20)
      expect(p1.nextCursor).not.toBeNull()

      const p2 = await buscar({ zones: [ZONA_PAGINA], cursor: p1.nextCursor })
      expect(p2.places).toHaveLength(5)
      expect(p2.nextCursor).toBeNull()

      const todos = [...nombres(p1), ...nombres(p2)]
      expect(new Set(todos).size).toBe(25)
    })

    it('un cursor manoseado sirve la primera página en vez de romper', async () => {
      const r = await buscar({ zones: [ZONA_PAGINA], cursor: 'basura-no-base64' })
      expect(r.places).toHaveLength(20)
    })
  })

  describe('lugares sin zona primaria', () => {
    it('la card recibe zone null y no se cae', async () => {
      const [huerfano] = await db
        .insert(places)
        .values({
          source: 'overture',
          name: `${PREFIJO} Sin Zona Primaria`,
          lat: BASE_LAT,
          lng: BASE_LNG,
          confidence: 0.8,
        })
        .returning({ id: places.id })

      // Solo zona de búsqueda, sin primaria: el caso de los 301 reales.
      await db
        .insert(placeZones)
        .values({ placeId: huerfano.id, zoneId: idsDeZona[ZONA_A], isPrimary: false })

      const r = await buscar({ zones: [ZONA_A] })
      const encontrado = r.places.find((p) => p.id === huerfano.id)
      expect(encontrado).toBeDefined()
      expect(encontrado!.zone).toBeNull()

      await db.delete(places).where(eq(places.id, huerfano.id))
    })
  })

  /**
   * El contador de "Ver N lugares" (decisión 20). Lo que se verifica no es que
   * cuente bien en abstracto, sino el invariante que hace útil al botón:
   * **el N que anuncia el sheet es el N que después se ve** (BUSQ-11). Por eso
   * cada caso compara contra el resultado real de la misma búsqueda.
   */
  describe('contador del sheet (decisión 20)', () => {
    const contar = (parcial: Partial<SearchParams>) =>
      countPlaces({ ...EMPTY_SEARCH, ...parcial })

    it('anuncia exactamente lo que la lista devuelve', async () => {
      const filtro = { zones: [ZONA_A], tags: ['bar'] }
      const [n, r] = await Promise.all([contar(filtro), buscar(filtro)])
      expect(n).toBe(r.places.length)
    })

    it('cuenta el total, no la página: 25 lugares con página de 20', async () => {
      const filtro = { zones: [ZONA_PAGINA] }
      const [n, r] = await Promise.all([contar(filtro), buscar(filtro)])
      expect(n).toBe(25)
      expect(r.places.length).toBe(20)
      expect(r.nextCursor).not.toBeNull()
    })

    it('respeta la visibilidad igual que la lista', async () => {
      // Zona A tiene dos lugares invisibles sembrados: si el contador no usara
      // `publishedWhere`, el botón prometería más de lo que hay.
      const [n, r] = await Promise.all([contar({ zones: [ZONA_A] }), buscar({ zones: [ZONA_A] })])
      expect(n).toBe(r.places.length)
    })

    it('cuenta cero cuando la combinación no existe, que es el caso que el botón evita', async () => {
      // "Bar + juegos de mesa" existe; "sushi + juegos de mesa" no. Es la forma
      // real del problema: cruzar facetas ralas da 0 seguido.
      expect(await contar({ zones: [ZONA_A], tags: ['japonesa-sushi', 'juegos-de-mesa'] })).toBe(0)
    })

    it('sigue al GPS, que reemplaza a las zonas', async () => {
      const filtro = {
        gps: true,
        coords: { lat: BASE_LAT, lng: BASE_LNG },
        zones: [ZONA_PAGINA],
      }
      const [n, r] = await Promise.all([contar(filtro), buscar(filtro)])
      expect(n).toBe(r.places.length)
      // Los 25 del paginado están a 5 grados: si contaran, el GPS no reemplazó.
      expect(n).toBeLessThan(25)
    })
  })
})
