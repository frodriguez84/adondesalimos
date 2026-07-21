import {
  boolean,
  date,
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
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import type { MultiPolygon, Polygon } from 'geojson'

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

/**
 * Las 4 regiones de AMBA. Enum y no tabla porque el set es chico y estable
 * (decisión 11 de ZONAS): sumar La Plata algún día es un `ALTER TYPE ... ADD
 * VALUE`, no un rediseño.
 */
export const regionEnum = pgEnum('region', ['caba', 'norte', 'oeste', 'sur'])

/**
 * Estado del matching Overture↔Google de un lugar (FICHA, decisión 10):
 *  - `pending`   nunca se intentó
 *  - `matched`   lo resolvió el matching automático (Text Search IDs-Only)
 *  - `manual`    lo fijó un humano — el resolver NUNCA lo pisa
 *  - `not_found` Google no devolvió nada; reintenta pasados `google.match_retry_days`
 *  - `blocked`   match malo o el lugar no está en Google; no reintentar nunca
 */
export const googleMatchStatusEnum = pgEnum('google_match_status', [
  'pending',
  'matched',
  'manual',
  'not_found',
  'blocked',
])

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

    /**
     * Estado del matching con Google (FICHA, decisión 10). Nace `pending`: el
     * resolver perezoso lo mueve la primera vez que alguien abre la ficha.
     */
    googleMatchStatus: googleMatchStatusEnum('google_match_status')
      .notNull()
      .default('pending'),
    /** Último intento (éxito o `not_found`): base del reintento a 30 días. */
    googleMatchedAt: timestamp('google_matched_at'),

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
    // Parcial: las consultas de estado del matching (reintentos de `not_found`,
    // conteo de `pending`) miran los que no están resueltos. La inmensa mayoría
    // queda `pending` hasta que alguien abre su ficha, así que el índice apunta
    // a los pocos que ya se tocaron.
    index('places_google_match_status_idx')
      .on(t.googleMatchStatus)
      .where(sql`${t.googleMatchStatus} <> 'pending'`),
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
 * Las 46 zonas de salida de AMBA. Los polígonos son artefactos curados que viven
 * versionados en `data/zones/` (decisión 13): esta tabla es su proyección, la
 * carga `npm run zones:load`.
 */
export const zones = pgTable(
  'zones',
  {
    id: serial('id').primaryKey(),
    region: regionEnum('region').notNull(),
    name: text('name').notNull(),
    /** Clave de upsert del loader y del canon. Contrato: vive en URLs. */
    slug: text('slug').notNull().unique(),

    /** Polígono exacto. Define la zona **primaria** de un lugar. */
    polygon: jsonb('polygon').$type<Polygon | MultiPolygon>().notNull(),
    /**
     * El mismo expandido 400 m (decisión 5), materializado una vez por el
     * loader. Define en qué zonas **aparece** el lugar al buscar. No se calcula
     * por query: sin PostGIS, el buffer en runtime sería inviable.
     */
    polygonSearch: jsonb('polygon_search').$type<Polygon | MultiPolygon>().notNull(),

    /** Orden dentro de la región en el selector de Búsqueda. */
    sort: integer('sort').notNull().default(0),
    /** Curaduría: desactivar una zona sin borrarla ni perder sus asignaciones. */
    active: boolean('active').notNull().default(true),
  },
  (t) => [index('zones_region_idx').on(t.region)],
)

/**
 * Nombres viejos y absorbidos ("Villa Ortúzar" → Chacarita y Colegiales).
 * Es tabla y no lógica (decisión 19): sumar un alias es un INSERT.
 */
export const zoneAliases = pgTable(
  'zone_aliases',
  {
    id: serial('id').primaryKey(),
    zoneId: integer('zone_id')
      .notNull()
      .references(() => zones.id, { onDelete: 'cascade' }),
    alias: text('alias').notNull(),
  },
  (t) => [
    uniqueIndex('zone_aliases_zone_alias_idx').on(t.zoneId, t.alias),
    index('zone_aliases_alias_idx').on(t.alias),
  ],
)

/**
 * Asignación precomputada lugar→zonas (decisión 12: sin PostGIS en v1).
 * La regenera `npm run zones:assign` por completo; el runtime solo lee.
 *
 * Un lugar tiene **a lo sumo una** fila `is_primary` (invariante con test) y
 * cero o más filas de búsqueda. Cero filas en total es un estado válido: el
 * lugar cae fuera de toda zona (decisión 17).
 */
export const placeZones = pgTable(
  'place_zones',
  {
    placeId: uuid('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
    zoneId: integer('zone_id')
      .notNull()
      .references(() => zones.id, { onDelete: 'cascade' }),
    isPrimary: boolean('is_primary').notNull().default(false),
  },
  (t) => [
    primaryKey({ columns: [t.placeId, t.zoneId] }),
    // La query de búsqueda entra por zona: `zone_id IN (...)`.
    index('place_zones_zone_idx').on(t.zoneId),
    // Parcial: la card resuelve la primaria de un lugar con un solo salto.
    index('place_zones_primary_idx')
      .on(t.placeId)
      .where(sql`${t.isPrimary}`),
  ],
)

/**
 * Chips de Ocasión: combinaciones prearmadas de tags (decisión 18 de BUSQUEDA).
 * Viven en DB y no hardcodeados porque son **curaduría**: ajustarlos no es un
 * deploy, es un UPDATE — mismo patrón que el umbral de confidence.
 *
 * `active` es curaduría manual (apagar un chip a mano). NO se usa para ocultar
 * los que hoy no tienen resultados: eso es un conteo en runtime (decisión 25),
 * así un chip se prende solo cuando la curaduría le llena los tags.
 */
export const occasionChips = pgTable('occasion_chips', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  /** Contrato: puede viajar en URLs al compartir una búsqueda armada por chip. */
  slug: text('slug').notNull().unique(),
  /** Los 4 que se muestran sin abrir "ver más". */
  inHome: boolean('in_home').notNull().default(false),
  sort: integer('sort').notNull().default(0),
  active: boolean('active').notNull().default(true),
})

/** Los tags que aplica cada chip. Misma semántica que un filtro a mano: OR dentro de faceta, AND entre facetas. */
export const chipTags = pgTable(
  'chip_tags',
  {
    chipId: integer('chip_id')
      .notNull()
      .references(() => occasionChips.id, { onDelete: 'cascade' }),
    tagId: integer('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.chipId, t.tagId] })],
)

/**
 * Impresiones agregadas por lugar y día (decisión 22). Es lo mínimo que **no se
 * puede reconstruir después**: sin esto, el "tu ficha apareció en N búsquedas
 * este mes" del B2B (spec 7) nace sin histórico.
 *
 * Agregado puro: sin user_id, sin cookies, sin sesión. Solo un contador.
 */
export const placeImpressionsDaily = pgTable(
  'place_impressions_daily',
  {
    placeId: uuid('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    impressions: integer('impressions').notNull().default(0),
    /**
     * Aperturas de ficha del día (FICHA, decisión 24). Es la métrica que vende el
     * B2B ("cuánta gente vio tu ficha") y no se puede reconstruir a posteriori.
     * Misma tabla que las impresiones: agregado por día, sin datos por usuario.
     */
    detailViews: integer('detail_views').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.placeId, t.date] })],
)

/**
 * Fotos del dueño de un lugar (FICHA, decisión 3). Se crea **vacía**: la llena el
 * spec de Auth/reclamo. Existe desde ya porque la prioridad de foto —dueño antes
 * que Google— es lógica de la ficha y tiene que poder testearse insertando una
 * fila a mano. Las fotos de Google NO viven acá: no se persisten (ToS).
 */
export const placePhotos = pgTable('place_photos', {
  id: uuid('id').primaryKey().defaultRandom(),
  placeId: uuid('place_id')
    .notNull()
    .references(() => places.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  sort: integer('sort').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

/**
 * Consumo mensual de la API de Google por SKU (FICHA, decisión 19). Alimenta los
 * topes editables de `app_settings`: superado el cupo, la ficha degrada al modo
 * sin Google en vez de disparar la factura. Se incrementa **antes** de llamar —
 * contar de menos por una excepción es peor que contar de más.
 */
export const googleApiUsage = pgTable(
  'google_api_usage',
  {
    /** `YYYY-MM`, en la zona horaria de facturación. */
    month: text('month').notNull(),
    /** `'details'` | `'photos'`. Texto, no enum: sumar un SKU no es una migración. */
    sku: text('sku').notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.month, t.sku] })],
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
// Auth (better-auth) — spec AUTH F1
// ---------------------------------------------------------------------------
//
// Tablas estándar del adapter de better-auth. Nombres y columnas son los que el
// adapter espera (patrón StressPlan). **Sin columna `role`** (decisión 8): admin
// se resuelve por `ADMIN_EMAIL` y dueño se deriva de un reclamo aprobado — sin
// columna de rol el registro único queda garantizado por construcción.
//
// `users.id` es uuid; `session`/`account`/`verification` usan ids `text` que
// better-auth genera con `crypto.randomUUID()` (columnas text aceptan el string).
// Los `user_id` de session/account NO declaran FK (los maneja better-auth), igual
// que en StressPlan — evita el choque de tipos text→uuid.

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name'),
  image: text('image'),
  emailVerified: boolean('email_verified').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull(),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
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
export type Zone = typeof zones.$inferSelect
export type NewZone = typeof zones.$inferInsert
export type ZoneAlias = typeof zoneAliases.$inferSelect
export type PlaceZone = typeof placeZones.$inferSelect
export type Region = (typeof regionEnum.enumValues)[number]
export type OccasionChip = typeof occasionChips.$inferSelect
export type NewOccasionChip = typeof occasionChips.$inferInsert
export type ChipTag = typeof chipTags.$inferSelect
export type PlaceImpressionDaily = typeof placeImpressionsDaily.$inferSelect
export type PlacePhoto = typeof placePhotos.$inferSelect
export type NewPlacePhoto = typeof placePhotos.$inferInsert
export type GoogleApiUsage = typeof googleApiUsage.$inferSelect
export type GoogleMatchStatus = (typeof googleMatchStatusEnum.enumValues)[number]
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Session = typeof session.$inferSelect
export type Account = typeof account.$inferSelect
