import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { area, buffer } from '@turf/turf'
import { sql } from 'drizzle-orm'
import type { Feature, MultiPolygon, Polygon } from 'geojson'
import { db } from '@/lib/db'
import { zoneAliases, zones } from '@/lib/db/schema'
import { ALIASES, TOTAL_ZONAS, ZONAS, sortDe } from '@/lib/zones/canon'

/**
 * Carga las 46 zonas de `data/zones/` + los alias semilla.
 *
 * Idempotente por `slug`: re-correrlo actualiza geometría, nombre y orden (para
 * poder corregir un polígono) pero NUNCA `active` — ese campo es curaduría
 * manual, igual que en el seed de tags.
 *
 * Acá se materializa el buffer de 400 m (decisión 5 + 12): una vez, al cargar.
 * Calcularlo por query sin PostGIS sería inviable.
 */

/** Metros de expansión para el polígono de búsqueda (decisión 5). */
const BUFFER_M = 400

const DIR = join(process.cwd(), 'data', 'zones')

function leerZona(slug: string): Feature<Polygon | MultiPolygon> {
  const path = join(DIR, `${slug}.geojson`)
  let raw: string
  try {
    raw = readFileSync(path, 'utf-8')
  } catch {
    throw new Error(`Falta ${path}. Corré \`npm run zones:build\` o revisá data/zones/README.md.`)
  }

  // Se parsea como Feature genérico a propósito: el tipo declarado de un archivo
  // que viene de afuera es una intención, no una garantía (lección de CATALOGO).
  const f = JSON.parse(raw) as Feature
  if (f.type !== 'Feature' || !f.geometry) throw new Error(`${slug}: no es un Feature GeoJSON`)

  const geom = f.geometry
  if (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon') {
    throw new Error(`${slug}: la geometría es ${geom.type}, se esperaba Polygon o MultiPolygon`)
  }
  if (f.properties?.slug !== slug) {
    throw new Error(`${slug}.geojson declara slug="${f.properties?.slug}" — archivo y contenido no coinciden`)
  }

  // Un anillo válido cierra sobre sí mismo. Un polígono abierto rompe el
  // point-in-polygon en silencio, así que se corta acá.
  const anillos = geom.type === 'Polygon' ? geom.coordinates : geom.coordinates.flat()
  for (const anillo of anillos) {
    const [ax, ay] = anillo[0]
    const [bx, by] = anillo[anillo.length - 1]
    if (ax !== bx || ay !== by) throw new Error(`${slug}: tiene un anillo sin cerrar`)
  }

  const validado = { ...f, geometry: geom } as Feature<Polygon | MultiPolygon>
  if (area(validado) <= 0) throw new Error(`${slug}: área cero`)
  return validado
}

async function main() {
  console.log(`Carga de zonas — buffer de búsqueda: ${BUFFER_M} m`)

  let cargadas = 0
  let areaTotal = 0
  let areaBuffer = 0

  for (const z of ZONAS) {
    const feature = leerZona(z.slug)

    const expandido = buffer(feature, BUFFER_M, { units: 'meters' })
    if (!expandido) throw new Error(`${z.slug}: turf.buffer devolvió vacío`)

    await db
      .insert(zones)
      .values({
        slug: z.slug,
        name: z.name,
        region: z.region,
        sort: sortDe(z.slug),
        polygon: feature.geometry,
        polygonSearch: expandido.geometry as Polygon | MultiPolygon,
      })
      .onConflictDoUpdate({
        target: zones.slug,
        set: {
          name: sql`excluded.name`,
          region: sql`excluded.region`,
          sort: sql`excluded.sort`,
          polygon: sql`excluded.polygon`,
          polygonSearch: sql`excluded.polygon_search`,
          // `active` deliberadamente ausente: es curaduría, no carga.
        },
      })

    cargadas++
    areaTotal += area(feature) / 1e6
    areaBuffer += area(expandido) / 1e6
  }

  // Los alias necesitan el id de su zona, así que van después.
  const filas = await db.select({ id: zones.id, slug: zones.slug }).from(zones)
  const idPorSlug = new Map(filas.map((f) => [f.slug, f.id]))

  for (const a of ALIASES) {
    const zoneId = idPorSlug.get(a.slug)
    if (!zoneId) throw new Error(`El alias "${a.alias}" apunta a "${a.slug}", que no existe`)
    await db.insert(zoneAliases).values({ zoneId, alias: a.alias }).onConflictDoNothing()
  }

  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(zones)
  const [{ totalAlias }] = await db
    .select({ totalAlias: sql<number>`count(*)::int` })
    .from(zoneAliases)
  const porRegion = await db
    .select({ region: zones.region, n: sql<number>`count(*)::int` })
    .from(zones)
    .groupBy(zones.region)
    .orderBy(zones.region)

  console.log('\n─── Reporte de carga ──────────────────────')
  console.log(`Zonas cargadas: ${cargadas} (esperadas ${TOTAL_ZONAS})`)
  console.log(`Total en la tabla: ${total}`)
  console.log(`Alias: ${totalAlias} (semilla ${ALIASES.length})`)
  console.log(`Área exacta: ${areaTotal.toFixed(0)} km² · con buffer: ${areaBuffer.toFixed(0)} km²`)
  for (const r of porRegion) console.log(`  ${r.region.padEnd(6)} ${r.n}`)
  console.log('───────────────────────────────────────────')

  if (total !== TOTAL_ZONAS) {
    throw new Error(`Se esperaban ${TOTAL_ZONAS} zonas en la tabla y hay ${total}`)
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
