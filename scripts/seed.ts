import 'dotenv/config'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { appSettings, tags } from '@/lib/db/schema'
import { TAXONOMIA, TOTAL_TAGS } from '@/lib/db/taxonomy'
import {
  BAND_LIMITS_KEY,
  CONFIDENCE_THRESHOLD_KEY,
  DEFAULT_BAND_LIMITS,
  DEFAULT_CONFIDENCE_THRESHOLD,
} from '@/lib/db/visibility'

/**
 * Seed idempotente de la taxonomía (105 filas) + los 2 settings iniciales.
 *
 * Idempotencia: upsert por `slug`. Al re-correr se actualizan name/facet/orden
 * (para poder corregir un label) pero NUNCA `active`: ese campo es curaduría
 * manual y el seed no lo pisa.
 */
async function main() {
  // Los padres de Cocina van primero: los hijos necesitan su id para parent_id.
  const parentIds = new Map<string, number>()
  let sort = 0
  let count = 0

  for (const { facet, tags: facetTags } of TAXONOMIA) {
    // Dentro de Cocina los padres ya vienen antes que los hijos (ver TAXONOMIA).
    for (const tag of facetTags) {
      const parentId = tag.parent ? parentIds.get(tag.parent) : null
      if (tag.parent && parentId === undefined) {
        throw new Error(`Tag "${tag.slug}" referencia un padre inexistente: "${tag.parent}"`)
      }

      const [row] = await db
        .insert(tags)
        .values({
          facet,
          slug: tag.slug,
          name: tag.name,
          parentId: parentId ?? null,
          groupLabel: tag.group ?? null,
          sort: sort++,
        })
        .onConflictDoUpdate({
          target: tags.slug,
          set: {
            facet: sql`excluded.facet`,
            name: sql`excluded.name`,
            parentId: sql`excluded.parent_id`,
            groupLabel: sql`excluded.group_label`,
            sort: sql`excluded.sort`,
            // `active` deliberadamente ausente: es curaduría, no semilla.
          },
        })
        .returning({ id: tags.id })

      if (!tag.parent) parentIds.set(tag.slug, row.id)
      count++
    }
  }

  // Settings iniciales: solo se insertan si no existen. Un re-run NO pisa un
  // umbral que el admin haya cambiado a mano — ese es justamente el mecanismo.
  await db
    .insert(appSettings)
    .values([
      { key: CONFIDENCE_THRESHOLD_KEY, value: DEFAULT_CONFIDENCE_THRESHOLD },
      { key: BAND_LIMITS_KEY, value: DEFAULT_BAND_LIMITS },
    ])
    .onConflictDoNothing({ target: appSettings.key })

  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(tags)

  console.log(`Tags sembradas: ${count} (esperadas ${TOTAL_TAGS})`)
  console.log(`Total en la tabla: ${total}`)
  console.log(`Settings: ${CONFIDENCE_THRESHOLD_KEY}, ${BAND_LIMITS_KEY}`)

  if (total !== TOTAL_TAGS) {
    throw new Error(`Se esperaban ${TOTAL_TAGS} tags en la tabla y hay ${total}`)
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
