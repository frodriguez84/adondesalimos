import 'dotenv/config'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { placeZones, places, zones } from '@/lib/db/schema'
import { asignarLugar, prepararZonas } from '@/lib/zones/asignar'

/**
 * Regenera `place_zones` completo para todo el catálogo.
 *
 * Idempotente por construcción (decisión 16): borra y reconstruye dentro de una
 * transacción, así que dos corridas seguidas dan exactamente lo mismo y nunca
 * queda un estado a medias. Corre después de cada import de Overture.
 *
 * Un lugar fuera de toda zona deja **cero** filas: es correcto, no un bug
 * (decisión 17). El reporte los lista para poder auditarlos.
 */

const BATCH = 1000

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

async function main() {
  const zonaRows = await db
    .select({
      id: zones.id,
      slug: zones.slug,
      polygon: zones.polygon,
      polygonSearch: zones.polygonSearch,
    })
    .from(zones)
    .where(sql`${zones.active}`)

  if (zonaRows.length === 0) {
    throw new Error('No hay zonas cargadas: corré `npm run zones:load` antes de asignar.')
  }
  console.log(`Zonas activas: ${zonaRows.length}`)

  const preparadas = prepararZonas(zonaRows)
  const nombrePorId = new Map(preparadas.map((z) => [z.id, z.slug]))

  const lugares = await db
    .select({ id: places.id, lat: places.lat, lng: places.lng, name: places.name, locality: places.locality })
    .from(places)
  console.log(`Lugares a asignar: ${lugares.length}`)

  const filas: { placeId: string; zoneId: number; isPrimary: boolean }[] = []
  const sinZona: typeof lugares = []
  const sinPrimaria: typeof lugares = []
  const porZona = new Map<number, number>()

  for (const l of lugares) {
    const { primariaId, zonaIds } = asignarLugar(l.lng, l.lat, preparadas)

    if (zonaIds.length === 0) {
      sinZona.push(l)
      continue
    }
    if (primariaId === null) sinPrimaria.push(l)

    for (const zoneId of zonaIds) {
      filas.push({ placeId: l.id, zoneId, isPrimary: zoneId === primariaId })
      porZona.set(zoneId, (porZona.get(zoneId) ?? 0) + 1)
    }
  }

  // Todo o nada: si algo falla a mitad, `place_zones` queda como estaba.
  await db.transaction(async (tx) => {
    await tx.delete(placeZones)
    for (const batch of chunk(filas, BATCH)) {
      await tx.insert(placeZones).values(batch)
    }
  })

  await reportar({ total: lugares.length, filas: filas.length, sinZona, sinPrimaria, porZona, nombrePorId })
}

async function reportar(r: {
  total: number
  filas: number
  sinZona: { name: string; locality: string | null }[]
  sinPrimaria: { name: string; locality: string | null }[]
  porZona: Map<number, number>
  nombrePorId: Map<number, string>
}) {
  const asignados = r.total - r.sinZona.length

  // Verificación de la invariante dura contra la base, no contra la memoria.
  const [{ conDosPrimarias }] = await db
    .select({ conDosPrimarias: sql<number>`count(*)::int` })
    .from(
      db
        .select({ placeId: placeZones.placeId })
        .from(placeZones)
        .where(sql`${placeZones.isPrimary}`)
        .groupBy(placeZones.placeId)
        .having(sql`count(*) > 1`)
        .as('dup'),
    )

  const top = [...r.porZona.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)

  // Las localidades más frecuentes entre los sin zona: dice DÓNDE está el hueco,
  // que es lo que importa para decidir si falta una zona.
  const localidades = new Map<string, number>()
  for (const l of r.sinZona) {
    const k = l.locality ?? '(sin locality)'
    localidades.set(k, (localidades.get(k) ?? 0) + 1)
  }
  const topSinZona = [...localidades.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)

  console.log('\n─── Reporte de asignación ─────────────────')
  console.log(`Lugares: ${r.total}`)
  console.log(`Con al menos una zona: ${asignados} (${((100 * asignados) / r.total).toFixed(1)}%)`)
  console.log(`Sin ninguna zona: ${r.sinZona.length} (${((100 * r.sinZona.length) / r.total).toFixed(1)}%)`)
  console.log(`Con zona de búsqueda pero sin primaria (borde del buffer): ${r.sinPrimaria.length}`)
  console.log(`Filas en place_zones: ${r.filas} · promedio por lugar asignado: ${(r.filas / asignados).toFixed(2)}`)
  console.log(`Lugares con 2+ primarias (debe ser 0): ${conDosPrimarias}`)

  console.log('\nTop zonas por cantidad de lugares:')
  for (const [id, n] of top) console.log(`  ${String(n).padStart(5)}\t${r.nombrePorId.get(id)}`)

  console.log('\nSin zona — dónde están:')
  for (const [loc, n] of topSinZona) console.log(`  ${String(n).padStart(5)}\t${loc}`)
  console.log('───────────────────────────────────────────')

  if (conDosPrimarias > 0) {
    throw new Error(`Invariante rota: ${conDosPrimarias} lugares con más de una zona primaria`)
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
