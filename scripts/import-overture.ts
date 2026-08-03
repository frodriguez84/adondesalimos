import 'dotenv/config'
import { DuckDBInstance } from '@duckdb/node-api'
import { inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { reemplazarTagsDeImport } from '@/lib/claims/ownership'
import { AMBA_BBOX } from '@/lib/geo/amba'
import { places, tags } from '@/lib/db/schema'
import { tagsForCategory } from '@/lib/overture/tag-map'
import { EXCLUDE_CATEGORIES, INCLUDE_CATEGORIES, isIncluded } from './overture/categories'
import { toStringArray } from './overture/normalize'

/**
 * Import del catálogo desde Overture Maps.
 *
 * Se importa **TODO** lo que pasa el filtro de categoría, sin cortar por
 * confidence: el corte vive en la query de publicación con el umbral de
 * `app_settings` (decisión 4). Cortar acá sería más limpio y sería peor —
 * bajar el umbral no podría revivir a nadie.
 *
 * Idempotente por `overture_id`: re-correrlo actualiza los datos de Overture y
 * preserva lo que Overture no sabe — `google_place_id`, `publish_override` y las
 * tags con `source != 'import'`.
 */

const RELEASE = '2026-06-17.0'
const SRC = `s3://overturemaps-us-west-2/release/${RELEASE}/theme=places/type=place/*`

/** bbox AMBA (decisión 2 del spec). Fuente única: `lib/geo/amba.ts`. */
const BBOX = AMBA_BBOX

const BATCH = 500

type OvertureRow = {
  id: string
  name: string | null
  lng: number | null
  lat: number | null
  address: string | null
  locality: string | null
  /** Llegan como JSON serializado, no como array — ver `toStringArray`. */
  phones: string | null
  websites: string | null
  socials: string | null
  emails: string | null
  category: string | null
  confidence: number | null
  operating_status: string | null
}

function sqlList(values: Iterable<string>): string {
  return [...values].map((v) => `'${v.replace(/'/g, "''")}'`).join(', ')
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}


async function fetchFromOverture(): Promise<OvertureRow[]> {
  const instance = await DuckDBInstance.create(':memory:')
  const conn = await instance.connect()
  await conn.run(`INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial; SET s3_region='us-west-2';`)

  // El filtro de categoría se empuja a DuckDB: traer 282.865 filas para
  // descartar el 90% en Node sería tirar ancho de banda a la basura.
  const query = `
    SELECT
      id,
      names.primary                       AS name,
      ST_X(geometry)                      AS lng,
      ST_Y(geometry)                      AS lat,
      addresses[1].freeform               AS address,
      addresses[1].locality               AS locality,
      -- Serializadas a JSON a propósito: las listas no cruzan el driver como array.
      CAST(to_json(phones) AS VARCHAR)    AS phones,
      CAST(to_json(websites) AS VARCHAR)  AS websites,
      CAST(to_json(socials) AS VARCHAR)   AS socials,
      CAST(to_json(emails) AS VARCHAR)    AS emails,
      taxonomy.primary                    AS category,
      confidence,
      operating_status
    FROM read_parquet('${SRC}', hive_partitioning=1)
    WHERE bbox.xmin > ${BBOX.xmin} AND bbox.xmax < ${BBOX.xmax}
      AND bbox.ymin > ${BBOX.ymin} AND bbox.ymax < ${BBOX.ymax}
      AND taxonomy.primary IN (${sqlList(INCLUDE_CATEGORIES)})
      AND taxonomy.primary NOT IN (${sqlList(EXCLUDE_CATEGORIES)})
  `

  const reader = await conn.runAndReadAll(query)
  return reader.getRowObjects() as unknown as OvertureRow[]
}

async function main() {
  console.log(`Import de Overture — release ${RELEASE}`)
  console.log(`bbox AMBA: lon ${BBOX.xmin}/${BBOX.xmax} · lat ${BBOX.ymin}/${BBOX.ymax}`)
  console.log('Consultando el parquet en S3 (puede tardar unos minutos)…')

  const rows = await fetchFromOverture()
  console.log(`Filas leídas del bbox con categoría incluida: ${rows.length}`)

  // Red de seguridad: si una categoría excluida se colara, el import falla en vez
  // de ensuciar el catálogo en silencio.
  const coladas = rows.filter((r) => !isIncluded(r.category))
  if (coladas.length > 0) {
    throw new Error(
      `${coladas.length} filas con categoría no incluida: ${[...new Set(coladas.map((r) => r.category))].join(', ')}`,
    )
  }

  // Slug → id, para traducir el mapeo de categorías a place_tags.
  const tagRows = await db.select({ id: tags.id, slug: tags.slug }).from(tags)
  if (tagRows.length === 0) {
    throw new Error('La tabla `tags` está vacía: corré `npm run db:seed` antes del import.')
  }
  const tagIdBySlug = new Map(tagRows.map((t) => [t.slug, t.id]))

  const usables = rows.filter((r) => r.name && r.lat !== null && r.lng !== null)
  const descartadas = rows.length - usables.length
  const antes = await countPlaces()

  const porCategoria = new Map<string, number>()
  let conTags = 0
  let sinMapeo = 0
  /** Lugares cuyas tags no se tocaron por tener dueño aprobado (decisión 14). */
  let conDueno = 0

  for (const batch of chunk(usables, BATCH)) {
    const inserted = await db
      .insert(places)
      .values(
        batch.map((r) => ({
          source: 'overture' as const,
          overtureId: r.id,
          name: r.name!,
          lat: r.lat!,
          lng: r.lng!,
          address: r.address ?? null,
          locality: r.locality ?? null,
          phones: toStringArray(r.phones),
          websites: toStringArray(r.websites),
          socials: toStringArray(r.socials),
          emails: toStringArray(r.emails),
          overtureCategory: r.category ?? null,
          confidence: r.confidence ?? null,
          operatingStatus: r.operating_status ?? 'open',
        })),
      )
      .onConflictDoUpdate({
        target: places.overtureId,
        set: {
          // Solo lo que Overture es dueño de saber. `google_place_id`,
          // `publish_override` y `source` quedan intactos a propósito.
          name: sql`excluded.name`,
          lat: sql`excluded.lat`,
          lng: sql`excluded.lng`,
          address: sql`excluded.address`,
          locality: sql`excluded.locality`,
          phones: sql`excluded.phones`,
          websites: sql`excluded.websites`,
          socials: sql`excluded.socials`,
          emails: sql`excluded.emails`,
          overtureCategory: sql`excluded.overture_category`,
          confidence: sql`excluded.confidence`,
          operatingStatus: sql`excluded.operating_status`,
          updatedAt: sql`now()`,
        },
      })
      .returning({ id: places.id, overtureId: places.overtureId })

    const idByOvertureId = new Map(inserted.map((p) => [p.overtureId!, p.id]))
    const placeIds = [...idByOvertureId.values()]

    const nuevas: { placeId: string; tagId: number }[] = []
    for (const r of batch) {
      porCategoria.set(r.category ?? 'null', (porCategoria.get(r.category ?? 'null') ?? 0) + 1)
      const placeId = idByOvertureId.get(r.id)
      if (!placeId) continue

      const slugs = tagsForCategory(r.category)
      if (slugs.length === 0) {
        sinMapeo++
        continue
      }
      let asignadas = 0
      for (const slug of slugs) {
        const tagId = tagIdBySlug.get(slug)
        if (!tagId) {
          throw new Error(`El mapeo de "${r.category}" usa el slug "${slug}", que no existe en tags`)
        }
        nuevas.push({ placeId, tagId })
        asignadas++
      }
      if (asignadas > 0) conTags++
    }

    // Tags semilla del batch. La regla vive en `lib/claims/ownership.ts`: se
    // reemplazan solo las de source='import' —las que puso un dueño o un admin
    // ya sobrevivían— y **los lugares con reclamo aprobado se saltean enteros**
    // (AUTH, decisión 14): sin eso, una tag que el dueño borró reaparecería en
    // el import siguiente.
    const { protegidos } = await reemplazarTagsDeImport(placeIds, nuevas)
    conDueno += protegidos
  }

  const despues = await countPlaces()
  await reportar({ leidas: rows.length, usables: usables.length, descartadas, antes, despues, porCategoria, conTags, sinMapeo, conDueno })
}

async function countPlaces(): Promise<number> {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(places)
  return n
}

async function reportar(r: {
  leidas: number
  usables: number
  descartadas: number
  antes: number
  despues: number
  porCategoria: Map<string, number>
  conTags: number
  sinMapeo: number
  conDueno: number
}) {
  const dist = await db
    .select({
      banda: sql<string>`width_bucket(${places.confidence}, 0, 1, 10)`,
      n: sql<number>`count(*)::int`,
    })
    .from(places)
    .groupBy(sql`1`)
    .orderBy(sql`1`)

  const [{ bajo }] = await db
    .select({ bajo: sql<number>`count(*) filter (where ${places.confidence} < 0.5)::int` })
    .from(places)

  const [{ excluidas }] = await db
    .select({ excluidas: sql<number>`count(*)::int` })
    .from(places)
    .where(inArray(places.overtureCategory, [...EXCLUDE_CATEGORIES]))

  const top = [...r.porCategoria.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)

  console.log('\n─── Reporte ───────────────────────────────')
  console.log(`Leídas del bbox (categoría incluida): ${r.leidas}`)
  console.log(`Descartadas por falta de nombre o coordenadas: ${r.descartadas}`)
  console.log(`Procesadas: ${r.usables}`)
  console.log(`places antes: ${r.antes} · después: ${r.despues} · nuevas: ${r.despues - r.antes}`)
  console.log(`Actualizadas (ya existían): ${r.usables - (r.despues - r.antes)}`)
  console.log(`Con tags de import: ${r.conTags} · sin mapeo de categoría: ${r.sinMapeo}`)
  console.log(`Con dueño aprobado (tags intactas, decisión 14 de AUTH): ${r.conDueno}`)
  console.log(`Filas con confidence < 0.5 (importadas igual, invisibles): ${bajo}`)
  console.log(`Filas con categoría excluida (debe ser 0): ${excluidas}`)
  console.log('\nDistribución de confidence (décimas):')
  for (const d of dist) console.log(`  ${d.banda ?? '—'}: ${d.n}`)
  console.log('\nTop categorías importadas:')
  for (const [cat, n] of top) console.log(`  ${n}\t${cat}`)
  console.log('───────────────────────────────────────────')
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
