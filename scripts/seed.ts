import 'dotenv/config'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { appSettings, tags } from '@/lib/db/schema'
import { TOTAL_CHIPS } from '@/lib/db/chips'
import { sembrarChips } from './seed-chips'
import { TAXONOMIA, TOTAL_TAGS } from '@/lib/db/taxonomy'
import {
  BAND_LIMITS_KEY,
  CONFIDENCE_THRESHOLD_KEY,
  DEFAULT_BAND_LIMITS,
  DEFAULT_CONFIDENCE_THRESHOLD,
} from '@/lib/db/visibility'
import {
  DEFAULT_DETAILS_MONTHLY_CAP,
  DEFAULT_MATCH_RETRY_DAYS,
  DEFAULT_PHOTOS_MONTHLY_CAP,
  DETAILS_MONTHLY_CAP_KEY,
  MATCH_RETRY_DAYS_KEY,
  PHOTOS_MONTHLY_CAP_KEY,
} from '@/lib/google/settings'
import {
  DEFAULT_PRECIO_B2B_ARS,
  DEFAULT_PRECIO_B2C_ARS,
  PRECIO_B2B_ARS_KEY,
  PRECIO_B2C_ARS_KEY,
} from '@/lib/billing/settings'
import {
  CHAT_MODEL_KEY,
  CHAT_MONTHLY_CAP_KEY,
  CHAT_QUOTA_PREMIUM_KEY,
  CHAT_QUOTA_TRIAL_KEY,
  DEFAULT_CHAT_MODEL,
  DEFAULT_CHAT_MONTHLY_CAP,
  DEFAULT_CHAT_QUOTA_PREMIUM,
  DEFAULT_CHAT_QUOTA_TRIAL,
} from '@/lib/ai/settings'
import {
  CURATION_MODEL_KEY,
  CURATION_ZONE_QUOTA_KEY,
  DEFAULT_CURATION_MODEL,
  DEFAULT_CURATION_ZONE_QUOTA,
} from '@/lib/curation/settings'
import { CADENAS_KEY, DEFAULT_CADENAS } from '@/lib/search/cadenas'
import { CHIPS_SCHEDULE_KEY, DEFAULT_CHIPS_SCHEDULE } from '@/lib/search/rotacion'

/**
 * Seed idempotente de la taxonomía (105 filas) + los chips de Ocasión + los 2
 * settings iniciales.
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

  const chips = await sembrarChips()

  // Settings iniciales: solo se insertan si no existen. Un re-run NO pisa un
  // umbral que el admin haya cambiado a mano — ese es justamente el mecanismo.
  await db
    .insert(appSettings)
    .values([
      { key: CONFIDENCE_THRESHOLD_KEY, value: DEFAULT_CONFIDENCE_THRESHOLD },
      { key: BAND_LIMITS_KEY, value: DEFAULT_BAND_LIMITS },
      // FICHA (decisiones 10 y 19): topes de Google y reintento de match.
      { key: DETAILS_MONTHLY_CAP_KEY, value: DEFAULT_DETAILS_MONTHLY_CAP },
      { key: PHOTOS_MONTHLY_CAP_KEY, value: DEFAULT_PHOTOS_MONTHLY_CAP },
      { key: MATCH_RETRY_DAYS_KEY, value: DEFAULT_MATCH_RETRY_DAYS },
      // MONETIZACION (decisiones 1 y 5): precios de los planes, editables desde
      // `/admin`. El `onConflictDoNothing` NO pisa un precio ya editado a mano —
      // ese es justamente el mecanismo (mismo criterio que el umbral de confidence).
      { key: PRECIO_B2B_ARS_KEY, value: DEFAULT_PRECIO_B2B_ARS },
      { key: PRECIO_B2C_ARS_KEY, value: DEFAULT_PRECIO_B2C_ARS },
      // CHAT_IA (decisiones 3, 5, 6, 15): modelo, cupos y tope global del chat.
      // `onConflictDoNothing` no pisa un valor ya editado a mano — el mecanismo.
      { key: CHAT_MODEL_KEY, value: DEFAULT_CHAT_MODEL },
      { key: CHAT_QUOTA_PREMIUM_KEY, value: DEFAULT_CHAT_QUOTA_PREMIUM },
      { key: CHAT_QUOTA_TRIAL_KEY, value: DEFAULT_CHAT_QUOTA_TRIAL },
      { key: CHAT_MONTHLY_CAP_KEY, value: DEFAULT_CHAT_MONTHLY_CAP },
      // CURADURIA (decisiones 2 y 4): cuota por zona y modelo del batch offline.
      // `onConflictDoNothing` no pisa un valor ya editado a mano — el mecanismo.
      { key: CURATION_ZONE_QUOTA_KEY, value: DEFAULT_CURATION_ZONE_QUOTA },
      { key: CURATION_MODEL_KEY, value: DEFAULT_CURATION_MODEL },
      // CHIPS_ROTACION (decisión 9): las reglas de rotación de los chips de la
      // home. `onConflictDoNothing` no pisa reglas ya afinadas a mano — el
      // mecanismo: se editan con un UPDATE, sin deploy.
      { key: CHIPS_SCHEDULE_KEY, value: DEFAULT_CHIPS_SCHEDULE },
      // ORDEN_ORGANICO (decisiones 5 y 14): los nombres que el orden trata como
      // cadena. `onConflictDoNothing` no pisa una lista ya curada a mano — el
      // mecanismo: sacar Havanna es un UPDATE, no un deploy.
      { key: CADENAS_KEY, value: DEFAULT_CADENAS },
    ])
    .onConflictDoNothing({ target: appSettings.key })

  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(tags)

  console.log(`Tags sembradas: ${count} (esperadas ${TOTAL_TAGS})`)
  console.log(`Total en la tabla: ${total}`)
  console.log(
    `Chips de Ocasión: ${chips.total} (esperados ${TOTAL_CHIPS})` +
      (chips.resincronizados > 0
        ? ` · ${chips.resincronizados} con los tags resincronizados`
        : ' · tags al día'),
  )
  console.log(
    `Settings: ${CONFIDENCE_THRESHOLD_KEY}, ${BAND_LIMITS_KEY}, ${DETAILS_MONTHLY_CAP_KEY}, ${PHOTOS_MONTHLY_CAP_KEY}, ${MATCH_RETRY_DAYS_KEY}, ${PRECIO_B2B_ARS_KEY}, ${PRECIO_B2C_ARS_KEY}, ${CHAT_MODEL_KEY}, ${CHAT_QUOTA_PREMIUM_KEY}, ${CHAT_QUOTA_TRIAL_KEY}, ${CHAT_MONTHLY_CAP_KEY}, ${CURATION_ZONE_QUOTA_KEY}, ${CURATION_MODEL_KEY}, ${CHIPS_SCHEDULE_KEY}, ${CADENAS_KEY}`,
  )

  if (total !== TOTAL_TAGS) {
    throw new Error(`Se esperaban ${TOTAL_TAGS} tags en la tabla y hay ${total}`)
  }

  if (chips.total !== TOTAL_CHIPS) {
    throw new Error(`Se esperaban ${TOTAL_CHIPS} chips en la tabla y hay ${chips.total}`)
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
