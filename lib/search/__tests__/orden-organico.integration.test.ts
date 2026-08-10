import 'dotenv/config'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { inArray, like, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { appSettings, placeTags, placeZones, places, tags, zones } from '@/lib/db/schema'
import { CADENAS_KEY } from '../cadenas'
import { EMPTY_SEARCH, PAGE_SIZE, type SearchParams } from '../params'
import { countPlaces, searchPlaces } from '../query'

/**
 * El orden orgánico enmendado (ORDEN_ORGANICO): **dueño > banda > confidence >
 * nombre**, donde la banda es `3` no-cadena curado · `2` no-cadena · `1` cadena
 * curada · `0` cadena.
 *
 * Los fixtures viven en zonas de test propias y con `search.cadenas` propio: el
 * test no puede depender ni del catálogo real ni de la lista que un humano esté
 * editando en `app_settings`. El setting se restaura en `afterAll` — es dato de
 * producto, no de QA (mismo cuidado que el test de precios).
 *
 * Las coordenadas caen en la Patagonia, lejos del bbox de AMBA, por lo mismo que
 * en `busqueda.integration.test.ts`.
 */

const PREFIJO = '__test_ord__'
const ZONA = '__test-orden-zona__'
const ZONA_ACENTO = '__test-orden-acento__'
const ZONA_PAGINA = '__test-orden-pagina__'

const BASE_LAT = -42.5
const BASE_LNG = -69.5

/** El tag por el que se filtra: aísla el fixture del resto de la zona. */
const TAG_FILTRO = 'wine-bar'
/** El tag que marca "curado". Lo que importa es el `source='admin'`, no cuál sea. */
const TAG_CURADO = 'romantico'

/**
 * La lista de cadenas del test. Va normalizada (minúsculas, sin acentos) como la
 * emite el generador — salvo la última, que existe para probar que el match
 * normaliza **los dos lados**: el lugar se llama «Cadéna Acentuada».
 */
const CADENAS_TEST = [
  `${PREFIJO} duenio cadena`,
  `${PREFIJO} cadena curada`,
  `${PREFIJO} cadena pelada`,
  `${PREFIJO} cadena acentuada`,
  `${PREFIJO} cadena paginada`,
  `${PREFIJO} hamburguesa cadena`,
  `${PREFIJO} gps cadena`,
]

let hayDb = true
let cadenasOriginal: unknown = null
let idsDeZona: Record<string, number> = {}

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
  zona: string
  /** Tiene un `place_tags` con `source='admin'` ⇒ suma 1 a la banda. */
  curado?: boolean
  confidence?: number | null
  owner?: boolean
  lat?: number
  lng?: number
}

/**
 * El bloque que prueba las 4 bandas. Los `confidence` están **invertidos a
 * propósito**: la cadena pelada es la de mejor dato (0,99) y el único curado la de
 * peor (0,60). Con el orden viejo el resultado sería exactamente al revés, así que
 * el test falla si la banda no entra antes que `confidence`.
 */
const BANDAS: Fixture[] = [
  // Dueño: gana igual, aunque sea cadena y no esté curado (decisión 10 — la banda
  // va DESPUÉS de `ownerRank`).
  { nombre: 'Duenio Cadena', zona: ZONA, owner: true, confidence: null },
  { nombre: 'Unico Curado', zona: ZONA, curado: true, confidence: 0.6 },
  { nombre: 'Unico Pelado', zona: ZONA, confidence: 0.7 },
  { nombre: 'Cadena Curada', zona: ZONA, curado: true, confidence: 0.98 },
  { nombre: 'Cadena Pelada', zona: ZONA, confidence: 0.99 },
]

const FIXTURES: Fixture[] = [
  ...BANDAS,

  // Acento: el lugar tiene tilde y la lista no. Tiene el mejor `confidence` de su
  // zona, así que si el match fallara encabezaría.
  { nombre: 'Cadéna Acentuada', zona: ZONA_ACENTO, confidence: 0.99 },
  { nombre: 'Unico Sin Tilde', zona: ZONA_ACENTO, confidence: 0.6 },

  // Texto libre: los dos contienen "hamburguesa" entero ⇒ misma similitud ⇒ la
  // banda desempata (decisión 10, segunda mitad).
  { nombre: 'Hamburguesa Cadena', zona: ZONA, confidence: 0.99 },
  { nombre: 'Hamburguesa Unica', zona: ZONA, confidence: 0.6 },

  // GPS: la cadena es la más cercana y tiene que quedar primera igual.
  { nombre: 'Gps Cadena', zona: ZONA, lat: BASE_LAT + 0.002, lng: BASE_LNG },
  { nombre: 'Gps Unico Curado', zona: ZONA, curado: true, lat: BASE_LAT + 0.008, lng: BASE_LNG },
]

/**
 * 45 lugares para el cursor: 3 páginas de 20 con las tres bandas mezcladas. Las
 * cadenas comparten nombre a propósito —hay 15 «Cadena Paginada»—: empatan en
 * banda, en `confidence` y en nombre, así que el keyset tiene que apoyarse en el
 * `id` para no repetir ni saltear.
 */
const TOTAL_PAGINA = 45
for (let i = 0; i < TOTAL_PAGINA; i++) {
  const resto = i % 3
  FIXTURES.push({
    nombre:
      resto === 0
        ? 'Cadena Paginada'
        : resto === 1
          ? `Curado Paginado ${String(i).padStart(2, '0')}`
          : `Pelado Paginado ${String(i).padStart(2, '0')}`,
    zona: ZONA_PAGINA,
    curado: resto === 1,
    confidence: 0.8,
    lat: BASE_LAT + 5,
    lng: BASE_LNG + 5,
  })
}

function buscar(parcial: Partial<SearchParams>) {
  return searchPlaces({ ...EMPTY_SEARCH, tags: [TAG_FILTRO], ...parcial })
}

function nombres(r: { places: { name: string }[] }): string[] {
  return r.places.map((p) => p.name.replace(`${PREFIJO} `, ''))
}

/** Pone la lista de cadenas vigente. `[]` = apagar la mitad "cadena" del orden. */
async function ponerCadenas(lista: string[]) {
  await db
    .insert(appSettings)
    .values({ key: CADENAS_KEY, value: lista })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: sql`excluded.value` } })
}

async function limpiar() {
  await db.delete(places).where(like(places.name, `${PREFIJO}%`))
  await db.delete(zones).where(inArray(zones.slug, [ZONA, ZONA_ACENTO, ZONA_PAGINA]))
}

beforeAll(async () => {
  try {
    await db.select({ n: sql`1` }).from(zones).limit(1)
  } catch {
    hayDb = false
    return
  }

  const [fila] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(sql`${appSettings.key} = ${CADENAS_KEY}`)
  cadenasOriginal = fila ? fila.value : null

  await limpiar()

  const zonasCreadas = await db
    .insert(zones)
    .values(
      [ZONA, ZONA_ACENTO, ZONA_PAGINA].map((slug) => ({
        region: 'caba' as const,
        name: slug,
        slug,
        polygon: POLIGONO,
        polygonSearch: POLIGONO,
      })),
    )
    .returning({ id: zones.id, slug: zones.slug })
  idsDeZona = Object.fromEntries(zonasCreadas.map((z) => [z.slug, z.id]))

  const filasTags = await db
    .select({ id: tags.id, slug: tags.slug })
    .from(tags)
    .where(inArray(tags.slug, [TAG_FILTRO, TAG_CURADO]))
  const idDeTag = Object.fromEntries(filasTags.map((t) => [t.slug, t.id]))
  for (const slug of [TAG_FILTRO, TAG_CURADO]) {
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
        publishOverride: f.owner ?? false,
      })),
    )
    .returning({ id: places.id })

  // Por índice y no por nombre: las 15 «Cadena Paginada» comparten nombre.
  const idDeFixture = creados.map((p) => p.id)

  await db.insert(placeTags).values(
    FIXTURES.flatMap((f, i) => [
      { placeId: idDeFixture[i], tagId: idDeTag[TAG_FILTRO], source: 'import' as const },
      ...(f.curado
        ? [{ placeId: idDeFixture[i], tagId: idDeTag[TAG_CURADO], source: 'admin' as const }]
        : []),
    ]),
  )

  await db.insert(placeZones).values(
    FIXTURES.map((f, i) => ({
      placeId: idDeFixture[i],
      zoneId: idsDeZona[f.zona],
      isPrimary: true,
    })),
  )

  await ponerCadenas(CADENAS_TEST)
})

afterAll(async () => {
  if (!hayDb) return
  await limpiar()
  // El setting es dato de producto: vuelve como estaba, exista o no.
  if (cadenasOriginal === null) {
    await db.delete(appSettings).where(sql`${appSettings.key} = ${CADENAS_KEY}`)
  } else {
    await ponerCadenas(cadenasOriginal as string[])
  }
})

describe.runIf(process.env.DATABASE_URL)('orden orgánico con banda (ORDEN_ORGANICO)', () => {
  describe('decisiones 1, 2, 3 y 10 — las cuatro bandas', () => {
    it('ordena dueño > banda > confidence, con el confidence en contra', async () => {
      const r = await buscar({ zones: [ZONA] })
      // Los de texto y GPS viven en la misma zona; se miran solo los 5 de bandas.
      const soloBandas = nombres(r).filter((n) => BANDAS.some((b) => b.nombre === n))
      expect(soloBandas).toEqual([
        'Duenio Cadena', // dueño: gana aunque sea cadena y esté sin curar
        'Unico Curado', // banda 3 — con el PEOR confidence (0,60)
        'Unico Pelado', // banda 2
        'Cadena Curada', // banda 1 — curada, pero cadena primero
        'Cadena Pelada', // banda 0 — con el MEJOR confidence (0,99)
      ])
    })

    it('la precedencia es cadena antes que curado: una cadena curada no sube', async () => {
      // El caso «Un café · Palermo Soho» en chico: curar una cadena la mejora
      // dentro de las cadenas, nunca la mezcla con los lugares únicos.
      const r = await buscar({ zones: [ZONA] })
      const lista = nombres(r)
      expect(lista.indexOf('Unico Pelado')).toBeLessThan(lista.indexOf('Cadena Curada'))
    })

    it('el match de cadena normaliza los dos lados (tilde en el lugar, no en la lista)', async () => {
      const r = await buscar({ zones: [ZONA_ACENTO] })
      expect(nombres(r)).toEqual(['Unico Sin Tilde', 'Cadéna Acentuada'])
    })
  })

  describe('decisión 16 — degradación: `search.cadenas` vacío', () => {
    it('sin lista nadie es cadena y vuelve a mandar el confidence, sin romper', async () => {
      await ponerCadenas([])
      try {
        const r = await buscar({ zones: [ZONA] })
        const soloBandas = nombres(r).filter((n) => BANDAS.some((b) => b.nombre === n))
        // La mitad "cadena" se apaga; la de curaduría no se apaga desde acá (no es
        // lo que rompía la primera pantalla) y sigue arriba de los no curados.
        expect(soloBandas).toEqual([
          'Duenio Cadena',
          'Cadena Curada', // 0,98 y curada
          'Unico Curado', // 0,60 y curada
          'Cadena Pelada', // 0,99 pero sin curar
          'Unico Pelado', // 0,70
        ])
      } finally {
        await ponerCadenas(CADENAS_TEST)
      }
    })

    it('un setting con basura degrada igual que la lista vacía', async () => {
      await ponerCadenas('esto no es una lista' as unknown as string[])
      try {
        const r = await buscar({ zones: [ZONA] })
        expect(r.places.length).toBeGreaterThan(0)
        expect(nombres(r)).toContain('Cadena Pelada')
      } finally {
        await ponerCadenas(CADENAS_TEST)
      }
    })
  })

  /**
   * El invariante que separa "orden" de "filtro" (decisión 8). Si esto se rompe se
   * mueve `countPlaces`, y con él el piso de los chips (`PISO_HOME` / `PISO_ZONA`),
   * que vaciaría la home sin que nadie toque los chips.
   */
  describe('decisión 8 — la banda ordena, NUNCA filtra', () => {
    const MATRIZ: { caso: string; params: Partial<SearchParams> }[] = [
      { caso: 'con zona', params: { zones: [ZONA] } },
      { caso: 'con zona y chip', params: { zones: [ZONA_PAGINA], tags: [TAG_FILTRO] } },
      { caso: 'sin zona (AMBA entero)', params: { tags: [] } },
      { caso: 'sin zona con chip', params: { tags: ['restaurante'] } },
      { caso: 'con texto', params: { q: 'hamburguesa' } },
      { caso: 'con zona y texto', params: { zones: [ZONA], q: 'cadena' } },
    ]

    it.each(MATRIZ)('$caso: countPlaces no se mueve al prender o apagar la lista', async ({ params }) => {
      const filtro = { ...EMPTY_SEARCH, ...params }
      const conLista = await countPlaces(filtro)
      await ponerCadenas([])
      try {
        expect(await countPlaces(filtro)).toBe(conLista)
      } finally {
        await ponerCadenas(CADENAS_TEST)
      }
      expect(await countPlaces(filtro)).toBe(conLista)
    })

    it('devuelve el mismo conjunto de lugares, solo que en otro orden', async () => {
      const conBanda = await buscar({ zones: [ZONA] })
      await ponerCadenas([])
      let sinBanda
      try {
        sinBanda = await buscar({ zones: [ZONA] })
      } finally {
        await ponerCadenas(CADENAS_TEST)
      }
      expect(nombres(sinBanda).sort()).toEqual(nombres(conBanda).sort())
      // …y el orden sí cambió: si fueran iguales, el test de arriba no probaría nada.
      expect(nombres(sinBanda)).not.toEqual(nombres(conBanda))
    })

    it('el contador sigue anunciando lo que la lista devuelve', async () => {
      const filtro = { zones: [ZONA] }
      const [n, r] = await Promise.all([
        countPlaces({ ...EMPTY_SEARCH, tags: [TAG_FILTRO], ...filtro }),
        buscar(filtro),
      ])
      expect(n).toBe(r.places.length)
    })
  })

  /**
   * Decisión 11: la banda es una clave más del keyset porque `clavesDeOrden` es
   * fuente única. No hay código de cursor nuevo — este test verifica que tampoco
   * hacía falta.
   */
  describe('decisión 11 — el cursor sobrevive a la clave nueva', () => {
    it('tres páginas sin repetir, sin saltear y con las bandas en orden', async () => {
      const p1 = await buscar({ zones: [ZONA_PAGINA] })
      const p2 = await buscar({ zones: [ZONA_PAGINA], cursor: p1.nextCursor })
      const p3 = await buscar({ zones: [ZONA_PAGINA], cursor: p2.nextCursor })

      expect(p1.places).toHaveLength(PAGE_SIZE)
      expect(p2.places).toHaveLength(PAGE_SIZE)
      expect(p3.places).toHaveLength(TOTAL_PAGINA - 2 * PAGE_SIZE)
      expect(p3.nextCursor).toBeNull()

      const ids = [...p1.places, ...p2.places, ...p3.places].map((p) => p.id)
      // Ni repetidos ni salteados: el conjunto es exactamente el universo.
      expect(new Set(ids).size).toBe(TOTAL_PAGINA)

      // La banda no puede subir al pasar de página: eso sería el keyset perdiendo
      // la clave nueva y volviendo a empezar.
      const banda = [...p1.places, ...p2.places, ...p3.places].map((p) =>
        p.name.includes('Curado') ? 3 : p.name.includes('Pelado') ? 2 : 0,
      )
      expect(banda).toEqual([...banda].sort((a, b) => b - a))
    })

    it('un cursor viejo (sin la clave `b`) sirve la primera página en vez de romper', async () => {
      // Es lo que pasa con un link abierto justo cuando sale el deploy.
      const viejo = Buffer.from(JSON.stringify({ o: 0, c: 0.8, n: 'x', i: 'y' })).toString(
        'base64url',
      )
      const r = await buscar({ zones: [ZONA_PAGINA], cursor: viejo })
      expect(r.places).toHaveLength(PAGE_SIZE)
    })
  })

  describe('decisión 10 — dónde la banda NO manda', () => {
    it('en GPS ordena la distancia: la cadena más cercana va primera', async () => {
      const params = { gps: true, coords: { lat: BASE_LAT, lng: BASE_LNG }, tags: [TAG_FILTRO] }
      const r = await searchPlaces({ ...EMPTY_SEARCH, ...params })
      const cerca = nombres(r).filter((n) => n.startsWith('Gps '))
      expect(cerca).toEqual(['Gps Cadena', 'Gps Unico Curado'])

      // Y es idéntico con la lista apagada: en GPS la banda no participa.
      await ponerCadenas([])
      try {
        const sinLista = await searchPlaces({ ...EMPTY_SEARCH, ...params })
        expect(nombres(sinLista)).toEqual(nombres(r))
      } finally {
        await ponerCadenas(CADENAS_TEST)
      }
    })

    it('con texto manda la similitud: una cadena que matchea mejor va primera', async () => {
      const r = await buscar({ zones: [ZONA], q: 'hamburguesa cadena' })
      expect(nombres(r)[0]).toBe('Hamburguesa Cadena')
    })

    it('con texto la banda desempata, que es donde hace falta', async () => {
      // "hamburguesa" está entero en los dos nombres ⇒ misma similitud ⇒ decide la
      // banda, y la cadena baja.
      const r = await buscar({ zones: [ZONA], q: 'hamburguesa' })
      const soloHamburguesas = nombres(r).filter((n) => n.startsWith('Hamburguesa'))
      expect(soloHamburguesas).toEqual(['Hamburguesa Unica', 'Hamburguesa Cadena'])
    })
  })
})
