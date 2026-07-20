import 'dotenv/config'
import { eq, sql } from 'drizzle-orm'
import { beforeAll, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import { placeZones, zoneAliases, zones } from '@/lib/db/schema'
import { ZONAS_POR_REGION, TOTAL_ZONAS } from '../canon'
import { asignarLugar, prepararZonas, type ZonaPreparada } from '../asignar'

/**
 * Integración contra el Postgres local: verifica lo que solo se puede verificar
 * con las zonas cargadas y `zones:assign` corrido — la invariante de primaria
 * única y el caso de borde con el buffer de 400 m real.
 *
 * Requiere `npm run zones:load` + `npm run zones:assign`. Sin base, se saltea.
 */

let hayDb = true
let preparadas: ZonaPreparada[] = []
let slugPorId = new Map<number, string>()

beforeAll(async () => {
  try {
    const filas = await db
      .select({
        id: zones.id,
        slug: zones.slug,
        polygon: zones.polygon,
        polygonSearch: zones.polygonSearch,
      })
      .from(zones)
    if (filas.length === 0) {
      hayDb = false
      return
    }
    preparadas = prepararZonas(filas)
    slugPorId = new Map(filas.map((f) => [f.id, f.slug]))
  } catch {
    hayDb = false
  }
})

describe.runIf(process.env.DATABASE_URL)('zonas cargadas', () => {
  it('tiene las 46 zonas con la distribución por región del spec', async () => {
    if (!hayDb) return
    const porRegion = await db
      .select({ region: zones.region, n: sql<number>`count(*)::int` })
      .from(zones)
      .groupBy(zones.region)

    const mapa = Object.fromEntries(porRegion.map((r) => [r.region, r.n]))
    expect(mapa).toEqual(ZONAS_POR_REGION)
    expect(porRegion.reduce((s, r) => s + r.n, 0)).toBe(TOTAL_ZONAS)
  })

  it('el polígono de búsqueda es más grande que el exacto en todas las zonas', async () => {
    if (!hayDb) return
    // Si el buffer no se hubiera aplicado, ambos serían iguales y la búsqueda
    // por zona perdería los lugares del borde sin que nada fallara.
    for (const z of preparadas) {
      const cajaMasAncha =
        z.cajaSearch[0] < z.caja[0] && z.cajaSearch[2] > z.caja[2] && z.cajaSearch[1] < z.caja[1]
      expect(cajaMasAncha, `${z.slug} no tiene buffer`).toBe(true)
    }
  })

  it('los alias semilla apuntan a su zona', async () => {
    if (!hayDb) return
    const filas = await db
      .select({ alias: zoneAliases.alias, slug: zones.slug })
      .from(zoneAliases)
      .innerJoin(zones, eq(zones.id, zoneAliases.zoneId))

    const mapa = Object.fromEntries(filas.map((f) => [f.alias, f.slug]))
    expect(mapa['Villa Ortúzar']).toBe('chacarita-colegiales')
    expect(mapa['Balvanera']).toBe('once-abasto')
    expect(mapa['San Nicolás']).toBe('retiro-microcentro')
  })
})

describe.runIf(process.env.DATABASE_URL)('asignación lugar→zona', () => {
  it('ningún lugar tiene más de una zona primaria', async () => {
    if (!hayDb) return
    // La invariante dura del spec. Se verifica contra la base, no en memoria.
    const dup = await db
      .select({ placeId: placeZones.placeId })
      .from(placeZones)
      .where(sql`${placeZones.isPrimary}`)
      .groupBy(placeZones.placeId)
      .having(sql`count(*) > 1`)

    expect(dup).toHaveLength(0)
  })

  it('todo lugar con filas tiene sus zonas de búsqueda ⊇ su primaria', async () => {
    if (!hayDb) return
    const [{ huerfanas }] = await db
      .select({ huerfanas: sql<number>`count(*)::int` })
      .from(placeZones)
      .where(sql`${placeZones.isPrimary} AND NOT EXISTS (
        SELECT 1 FROM place_zones pz
        WHERE pz.place_id = ${placeZones.placeId} AND pz.zone_id = ${placeZones.zoneId}
      )`)
    expect(huerfanas).toBe(0)
  })

  it('un punto sobre Av. Córdoba queda con 1 primaria y aparece en Villa Crespo y Palermo Soho', () => {
    if (!hayDb) return
    // Av. Córdoba y Thames: vereda de Palermo Soho, con Villa Crespo cruzando la
    // avenida — bastante menos de 400 m. Es el caso del DoD: la card dice una
    // sola zona, pero el bar aparece buscando las dos.
    const { primariaId, zonaIds } = asignarLugar(-58.43, -34.594, preparadas)

    expect(primariaId).not.toBeNull()
    expect(slugPorId.get(primariaId!)).toBe('palermo-soho')

    const slugs = zonaIds.map((id) => slugPorId.get(id)!)
    expect(slugs).toContain('palermo-soho')
    expect(slugs).toContain('villa-crespo')
    expect(slugs.length).toBeGreaterThanOrEqual(2)
  })

  it('un punto en medio del río no cae en ninguna zona', () => {
    if (!hayDb) return
    // Decisión 17: cero filas es un resultado válido, no un error.
    const { primariaId, zonaIds } = asignarLugar(-58.2, -34.5, preparadas)
    expect(primariaId).toBeNull()
    expect(zonaIds).toHaveLength(0)
  })
})
