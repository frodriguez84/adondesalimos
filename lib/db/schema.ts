import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** Origen del lugar. Una sola tabla `places` para ambos (decisión 11 del spec). */
export const placeSourceEnum = pgEnum('place_source', ['overture', 'owner'])

/**
 * Las 6 facetas que tienen tags. La 7ma (Zona) no vive acá: es geografía, la
 * resuelve el spec de Zonas. El set es fijo por decisión de producto — el modelo
 * curado agrega tags, no facetas (decisión 12).
 */
export const facetEnum = pgEnum('facet', [
  'tipo',
  'cocina',
  'actividad',
  'ambiente',
  'precio',
  'momento',
])

/** Procedencia de una asignación de tag: importa para moderación (decisión 14). */
export const placeTagSourceEnum = pgEnum('place_tag_source', ['import', 'owner', 'admin'])

// ---------------------------------------------------------------------------
// Tablas
// ---------------------------------------------------------------------------

export const places = pgTable(
  'places',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    source: placeSourceEnum('source').notNull(),

    /** Clave de idempotencia del import. Null cuando source = 'owner'. */
    overtureId: text('overture_id').unique(),

    /**
     * Único dato de Google persistible (ToS). Se crea vacía: la llena el spec de
     * Ficha. NO hay columnas de nombre/horarios/rating/fotos de Google — no es
     * olvido, es prohibición.
     */
    googlePlaceId: text('google_place_id'),

    name: text('name').notNull(),
    lat: doublePrecision('lat').notNull(),
    lng: doublePrecision('lng').notNull(),
    address: text('address'),
    locality: text('locality'),

    // Contacto tal como viene de Overture (arrays), sin aplanar (decisión 19).
    phones: jsonb('phones').$type<string[]>(),
    websites: jsonb('websites').$type<string[]>(),
    socials: jsonb('socials').$type<string[]>(),
    emails: jsonb('emails').$type<string[]>(),

    /** `taxonomy.primary` de Overture: trazabilidad para re-mapear sin volver a S3. */
    overtureCategory: text('overture_category'),

    /** Null para lugares de dueño: su señal de publicación es el override. */
    confidence: real('confidence'),
    operatingStatus: text('operating_status').notNull().default('open'),

    /** Reclamo de dueño aprobado ⇒ true. Lo opera el spec de Auth/reclamo. */
    publishOverride: boolean('publish_override').notNull().default(false),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    // La query de publicación filtra por confidence siempre.
    index('places_confidence_idx').on(t.confidence),
  ],
)

export const tags = pgTable(
  'tags',
  {
    id: serial('id').primaryKey(),
    facet: facetEnum('facet').notNull(),
    /** Solo Cocina lo usa: 9 padres filtrables con 37 hijos. */
    parentId: integer('parent_id').references((): AnyPgColumn => tags.id),
    /** Grupos de Actividad/Ambiente: ordenan la UI, no filtran. */
    groupLabel: text('group_label'),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    sort: integer('sort').notNull().default(0),
    /** Curaduría: desactivar sin borrar. El seed nunca lo pisa. */
    active: boolean('active').notNull().default(true),
  },
  (t) => [index('tags_facet_idx').on(t.facet)],
)

export const placeTags = pgTable(
  'place_tags',
  {
    placeId: uuid('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
    tagId: integer('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    source: placeTagSourceEnum('source').notNull().default('import'),
  },
  (t) => [
    primaryKey({ columns: [t.placeId, t.tagId] }),
    index('place_tags_tag_idx').on(t.tagId),
  ],
)

/**
 * Settings editables desde admin. Genérica a propósito: nace con el umbral de
 * confidence y las bandas de precio, y el mismo patrón sirve para precios de
 * planes y cupos de IA (decisión 15).
 */
export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// ---------------------------------------------------------------------------
// Tipos inferidos
// ---------------------------------------------------------------------------

export type Place = typeof places.$inferSelect
export type NewPlace = typeof places.$inferInsert
export type Tag = typeof tags.$inferSelect
export type NewTag = typeof tags.$inferInsert
export type PlaceTag = typeof placeTags.$inferSelect
export type AppSetting = typeof appSettings.$inferSelect
export type Facet = (typeof facetEnum.enumValues)[number]
