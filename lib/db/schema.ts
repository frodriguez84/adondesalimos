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
import type { HorariosSemana } from '@/lib/negocio/horarios'
import { TAP_KINDS } from '@/lib/lugar/tap-kinds'

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

/** Por cuál de las dos entradas llegó el reclamo (AUTH, decisión 10). */
export const claimKindEnum = pgEnum('claim_kind', ['claim', 'new'])

/** Estado de la cola de aprobación manual (AUTH, decisiones 4 y 10). */
export const claimStatusEnum = pgEnum('claim_status', ['pending', 'approved', 'rejected'])

/**
 * Plan del lugar (AUTH, decisión 18). **Por lugar, no por usuario**: el destaque y
 * las stats del spec 7 son por ficha. Hasta ese spec se cambia a mano con un
 * UPDATE documentado — mismo criterio que el umbral de confidence antes de `/admin`.
 */
export const ownerPlanEnum = pgEnum('owner_plan', ['free', 'paid'])

/**
 * Plan del **usuario** (VOTACION, decisión 17). Espejo B2C de `owner_plan` (que es
 * B2B, por lugar): gatea votaciones ilimitadas · IA arma shortlist · historial.
 * Hasta el spec 7 (MercadoPago) se cambia con un UPDATE a mano, mismo camino que
 * `owner_plan`. `free` es el default por construcción — better-auth inserta el
 * user sin tocar esta columna y la base pone el default.
 */
export const userPlanEnum = pgEnum('user_plan', ['free', 'premium'])

/**
 * Estado de una votación (VOTACION, decisión 21). Una votación **expirada** sigue
 * con `status='open'` en la columna: "activa" no es solo el status, es
 * `status='open' AND expires_at > now()` (decisión 11). La expiración se resuelve
 * perezosa al leer, sin cron.
 */
export const pollStatusEnum = pgEnum('poll_status', ['open', 'closed', 'cancelled'])

/**
 * Estado de una suscripción (MONETIZACION, decisión 13). Enum propio, **sin
 * `trialing`** (no hay trials, decisión "Qué NO es"). El mapeo desde el
 * preapproval de MP vive en F2 (`authorized→active` · `pending→past_due` ·
 * `paused`/`cancelled→canceled`); el enum ya nace con la migración de F1.
 */
export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'active',
  'past_due',
  'canceled',
])

/**
 * Las 5 acciones tappables de la ficha que se instrumentan (MONETIZACION,
 * decisión 22a). El conjunto es `TAP_KINDS`, compartido con el `<TapLink>` del
 * cliente — una sola fuente para que el enum de la base no driftee del literal
 * que dispara el beacon.
 */
export const tapKindEnum = pgEnum('tap_kind', TAP_KINDS)

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

    /**
     * Plan del dueño de ESTE lugar (AUTH, decisión 18). Nace `free` para todos y
     * hasta el spec 7 solo cambia con un UPDATE a mano. Gatea qué campos de
     * `place_owner_content` se pueden editar y cuáles se muestran en la ficha:
     * volver a `free` **oculta** el contenido pago, no lo borra.
     */
    ownerPlan: ownerPlanEnum('owner_plan').notNull().default('free'),

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
    /**
     * Cuántas veces el lugar salió **destacado** en una búsqueda ese día
     * (MONETIZACION, decisión 20). La escribe el destaque (F3) en el mismo batch
     * `after()` de las impresiones; nace en 0 y sin backfill (antes del destaque
     * el valor real es 0). Es el contador que decide la rotación *y* el que
     * reporta la transparencia del panel ("destacada en X de las Y búsquedas").
     */
    featuredImpressions: integer('featured_impressions').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.placeId, t.date] })],
)

/**
 * Taps por lugar, día y tipo de acción (MONETIZACION, decisión 22a). El "qué
 * hizo la gente en tu ficha" del desglose B2B (F4): tocó el teléfono, pidió cómo
 * llegar, abrió la carta. No se puede reconstruir después.
 *
 * **Agregado puro**: sin `user_id`, sin cookies, sin IP — mismo invariante que
 * `place_impressions_daily`. Solo un contador por (lugar, día, tipo). El cliente
 * dispara un beacon best-effort; un tap perdido no rompe nada.
 */
export const placeTapsDaily = pgTable(
  'place_taps_daily',
  {
    placeId: uuid('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    kind: tapKindEnum('kind').notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.placeId, t.date, t.kind] })],
)

/**
 * "Qué filtros te encontraron" (MONETIZACION, decisión 22b): por cada búsqueda
 * servida con tags activos, cada lugar mostrado suma +1 en cada uno de esos tags
 * (incluye los expandidos por chips de Ocasión). El texto libre y la zona no se
 * registran (cardinalidad + privacidad).
 *
 * **Agregado puro**, igual que las impresiones: sin datos por usuario. Cardinalidad
 * acotada: ~20 lugares × ~3 tags por búsqueda.
 */
export const placeTagImpressionsDaily = pgTable(
  'place_tag_impressions_daily',
  {
    placeId: uuid('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    tagId: integer('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    count: integer('count').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.placeId, t.date, t.tagId] })],
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
 * Consumo mensual de la API de Anthropic por SKU (CHAT_IA, decisión 15). Espejo de
 * `google_api_usage`: alimenta el tope global editable `ai.chat_monthly_cap` de
 * `app_settings`. Superado el tope, el chat **degrada** ("está descansando") en vez
 * de disparar el gasto. Se incrementa **antes** de llamar — contar de menos por una
 * excepción es peor que contar de más. Único SKU hoy: `'chat_messages'`.
 */
export const aiApiUsage = pgTable(
  'ai_api_usage',
  {
    /** `YYYY-MM`, lo pone Postgres (`to_char(current_date, 'YYYY-MM')`). */
    month: text('month').notNull(),
    /** `'chat_messages'`. Texto, no enum: sumar un SKU no es una migración. */
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

/**
 * Historial de cambios de `app_settings` (MONETIZACION, decisión 25). Genérico y
 * barato: una fila por cada edición hecha desde `/admin` (INSERT en el mismo
 * PATCH). Cubre "¿qué precio regía en marzo?" para cualquier setting, no solo
 * billing.
 *
 * **Lo operativo no depende de esto**: qué paga cada suscripto está congelado en
 * `subscriptions.amount_ars`; este historial es auditoría, no fuente de verdad.
 */
export const appSettingsHistory = pgTable('app_settings_history', {
  id: serial('id').primaryKey(),
  key: text('key').notNull(),
  value: jsonb('value').notNull(),
  /** Email del admin que hizo el cambio (no hay tabla de roles que referenciar). */
  changedBy: text('changed_by').notNull(),
  changedAt: timestamp('changed_at').notNull().defaultNow(),
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
  /**
   * Plan del usuario (VOTACION, decisión 17). Nace `free` para todos; hasta el
   * spec 7 solo cambia con un UPDATE a mano. Gatea el tramo premium de las
   * votaciones (ilimitadas · IA · historial). **No se agrega vía
   * `additionalFields` de better-auth**: como `owner_plan`, se consulta siempre
   * server-side (`esPremium`), nunca viaja en la sesión — así "bajar el plan" es
   * inmediato y no depende de refrescar un token. Ver `lib/votaciones/planes.ts`.
   */
  plan: userPlanEnum('plan').notNull().default('free'),
  /**
   * Probadita del chat IA consumida de por vida (CHAT_IA, decisión 6). Contador
   * propio, NO derivado de `chat_messages`: borrar una conversación no devuelve la
   * probadita (decisión 14). Nace en 0; el gate free la compara contra
   * `ai.chat_quota_trial`.
   */
  chatTrialUsed: integer('chat_trial_used').notNull().default(0),
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
// Reclamo de negocio — spec AUTH F2
// ---------------------------------------------------------------------------

/**
 * El reclamo y la propiedad son la misma fila (decisión 10): quién pide, sobre
 * qué lugar, por cuál entrada llegó, en qué estado está y qué decidió el admin.
 *
 * **Un dueño por lugar**, garantizado por el índice único parcial sobre los
 * aprobados: dos solicitudes sobre el mismo lugar pueden convivir `pending` (el
 * admin las compara), pero aprobar la segunda con una ya aprobada rompe en la
 * base, no en la aplicación.
 *
 * `status='approved'` es lo único que hace dueño a alguien: no hay columna
 * `role` (decisión 8). La revocación es volver una aprobada a `rejected` y bajar
 * `publish_override` — por eso la fila no se borra nunca.
 */
export const placeClaims = pgTable(
  'place_claims',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** El alta nueva crea el lugar primero: acá siempre hay un `places.id`. */
    placeId: uuid('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: claimKindEnum('kind').notNull(),
    status: claimStatusEnum('status').notNull().default('pending'),

    // Lo que el admin usa para verificar el vínculo con el negocio.
    applicantName: text('applicant_name'),
    applicantPhone: text('applicant_phone'),
    applicantRole: text('applicant_role'),
    comment: text('comment'),

    decidedAt: timestamp('decided_at'),
    /** Email del admin que decidió (no hay tabla de roles que referenciar). */
    decidedBy: text('decided_by'),
    /** Motivo del rechazo / notas internas. */
    adminNotes: text('admin_notes'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    // Único aprobado por lugar (decisión 10). Parcial: los pendientes y los
    // rechazados pueden repetirse cuantas veces haga falta.
    uniqueIndex('place_claims_aprobado_idx')
      .on(t.placeId)
      .where(sql`${t.status} = 'approved'`),
    // El panel lista "mis lugares" y la ficha pregunta por lugar.
    index('place_claims_user_idx').on(t.userId),
    // Parcial: la cola de `/admin` lee solo los pendientes, que son pocos.
    index('place_claims_pendientes_idx')
      .on(t.createdAt)
      .where(sql`${t.status} = 'pending'`),
  ],
)

// ---------------------------------------------------------------------------
// Contenido del dueño — spec AUTH F3
// ---------------------------------------------------------------------------

/**
 * Lo que el dueño edita de SU lugar (decisión 13). 1-a-1 con `places`.
 *
 * **Nada de esto va a las columnas base de `places`**: el re-import de Overture
 * las pisa (CATALOGO dec. 17 solo preserva `google_place_id`, `publish_override`
 * y las tags no-import). La ficha resuelve `COALESCE(dueño → base)`, así que
 * borrar un campo de acá devuelve el dato de Overture en vez de dejar un hueco.
 *
 * **Todo nullable**: cada campo sobrescribe la base solo si está cargado. La fila
 * existe o no existe; un lugar sin fila se comporta exactamente como antes de F3.
 *
 * Los tres campos pagos (`description`, `menu_url`, `news`) se guardan igual que
 * el resto, pero solo se **escriben** y se **muestran** con `places.owner_plan =
 * 'paid'` (decisión 18): si el dueño deja de pagar, se ocultan sin borrarse.
 */
export const placeOwnerContent = pgTable('place_owner_content', {
  placeId: uuid('place_id')
    .primaryKey()
    .references(() => places.id, { onDelete: 'cascade' }),

  // --- Free ---------------------------------------------------------------
  /** Pisa `places.phones[0]` en la ficha. */
  phone: text('phone'),
  /** Pisa `places.websites[0]`. */
  website: text('website'),
  /** Reemplaza `places.socials` **entero** si está cargado (no se mezclan). */
  socials: jsonb('socials').$type<string[]>(),
  /**
   * Horarios propios semanales (decisión 20). La columna nace con la tabla —
   * crear una tabla entera de una es más barato que un ALTER después— pero
   * **nadie la lee ni la escribe hasta F4**, que trae el editor semanal, la
   * prioridad dueño → Google y el cálculo de abierto/cerrado en TZ AR.
   */
  openingHours: jsonb('opening_hours').$type<HorariosSemana>(),

  // --- Pago (decisión 5; los huecos de la ficha son la decisión 19) --------
  /** Descripción larga: va debajo de "Qué vas a encontrar". */
  description: text('description'),
  /** Link a la carta: acción junto al website. */
  menuUrl: text('menu_url'),
  /** Novedad corta ("happy hour 18-20"): banner bajo el header. */
  news: text('news'),

  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// ---------------------------------------------------------------------------
// Votación en grupo — spec VOTACION
// ---------------------------------------------------------------------------

/**
 * La votación (decisión 21). El creador siempre tiene cuenta (`creator_id`); los
 * votantes jamás (decisión 1). El link es el `token` aleatorio, no el `id`
 * (decisión 10): quien tiene el token, vota — la URL es la *capability*.
 */
export const polls = pgTable(
  'polls',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    creatorId: uuid('creator_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** El del link (`/votacion/[token]`): opaco, no adivinable (decisión 10). */
    token: text('token').notNull().unique(),
    /** Opcional; si falta, la UI arma uno con los nombres de los lugares. */
    title: text('title'),
    status: pollStatusEnum('status').notNull().default('open'),
    /** Lo fija el creador al cerrar, entre las opciones (decisión 14). */
    winnerPlaceId: uuid('winner_place_id').references(() => places.id),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    /** `created_at + VOTACION_TTL_HORAS`. Expirada = `open` + esto en el pasado. */
    expiresAt: timestamp('expires_at').notNull(),
    closedAt: timestamp('closed_at'),
  },
  (t) => [
    uniqueIndex('polls_token_idx').on(t.token),
    // El panel "Mis votaciones" y el gate "1 activa" entran por creador.
    index('polls_creator_idx').on(t.creatorId),
  ],
)

/**
 * Los lugares de la shortlist (2-5 por poll, decisión 3). Se congela al crear:
 * si un lugar se vuelve invisible después, la opción **sigue** (decisión / edge
 * case) — la cancha ya está armada.
 */
export const pollOptions = pgTable(
  'poll_options',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pollId: uuid('poll_id')
      .notNull()
      .references(() => polls.id, { onDelete: 'cascade' }),
    placeId: uuid('place_id')
      .notNull()
      .references(() => places.id),
    /** Orden en que el creador los puso; desempate determinista (edge case). */
    position: integer('position').notNull(),
  },
  (t) => [
    // No repetir un lugar en la misma votación.
    uniqueIndex('poll_options_poll_place_idx').on(t.pollId, t.placeId),
    index('poll_options_poll_idx').on(t.pollId),
  ],
)

/**
 * Los votos (decisión 8). **Agregado a nivel opción**: el conteo sale de un
 * `GROUP BY option_id`; el `voter_token` (cookie por dispositivo, decisión 7) no
 * se expone a ningún cliente. Un voto por dispositivo por votación, cambiable
 * mientras esté abierta — revotar es un `UPDATE` de `option_id`, no una fila nueva.
 */
export const pollVotes = pgTable(
  'poll_votes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Denormalizado para la restricción única y el conteo por votación. */
    pollId: uuid('poll_id')
      .notNull()
      .references(() => polls.id, { onDelete: 'cascade' }),
    optionId: uuid('option_id')
      .notNull()
      .references(() => pollOptions.id, { onDelete: 'cascade' }),
    /** El UUID de la cookie `voter_id`. Nunca se expone (decisión 7). */
    voterToken: text('voter_token').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    // Un voto por dispositivo por votación; revotar es UPDATE (decisión 8).
    uniqueIndex('poll_votes_poll_voter_idx').on(t.pollId, t.voterToken),
    // Conteo por opción.
    index('poll_votes_option_idx').on(t.optionId),
  ],
)

// ---------------------------------------------------------------------------
// Suscripciones (MercadoPago) — spec MONETIZACION
// ---------------------------------------------------------------------------
//
// Estas dos tablas nacen con la migración de F1 aunque **recién se usan en F2**
// (el cobro): mismo criterio que AUTH F3, que creó `place_owner_content` entera
// de una para no encadenar un ALTER después. F1 solo instrumenta y precios; nada
// escribe acá todavía.

/**
 * Una fila por suscripción (MONETIZACION, decisión 12). Nombres MP nativos, sin
 * el alias `stripe_*` legacy ni `billing_provider` (MP es el único proveedor).
 *
 * **La suscripción es por lugar, no por cuenta** (decisión 2): `place_id`
 * nullable — `null` = premium B2C del usuario; con valor = B2B de ESE lugar.
 * `user_id` (quién paga) siempre. Un usuario puede tener 1 fila B2C + N B2B.
 *
 * `amount_ars` queda **congelado al contratar** (decisión 25): cambiar el precio
 * en `/admin` afecta altas nuevas, no las filas vivas.
 */
export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** `null` = B2C premium; con valor = B2B de ese lugar (decisión 2). */
    placeId: uuid('place_id').references(() => places.id, { onDelete: 'cascade' }),
    status: subscriptionStatusEnum('status').notNull(),
    /** id del preapproval en MP. Unique: un preapproval, una fila. */
    mpPreapprovalId: text('mp_preapproval_id').notNull().unique(),
    /** El que pagó (puede diferir del email de la cuenta). */
    mpPayerEmail: text('mp_payer_email'),
    /** Congelado al contratar (decisión 25). */
    amountArs: integer('amount_ars').notNull(),
    currentPeriodStart: timestamp('current_period_start').notNull(),
    currentPeriodEnd: timestamp('current_period_end').notNull(),
    /** Cancelación diferida simulada (decisión 15): true = corta al fin del período. */
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    canceledAt: timestamp('canceled_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    // Una B2C viva por usuario. Parcial: las canceladas quedan como historial y
    // re-suscribir crea fila nueva (decisión 12).
    uniqueIndex('subscriptions_b2c_viva_idx')
      .on(t.userId)
      .where(sql`${t.placeId} IS NULL AND ${t.status} <> 'canceled'`),
    // Una B2B viva por lugar.
    uniqueIndex('subscriptions_b2b_viva_idx')
      .on(t.placeId)
      .where(sql`${t.placeId} IS NOT NULL AND ${t.status} <> 'canceled'`),
    // El panel y la reconciliación entran por usuario y por lugar.
    index('subscriptions_user_idx').on(t.userId),
    index('subscriptions_place_idx').on(t.placeId),
  ],
)

/**
 * Guard de idempotencia de renovaciones + historial de cobros (MONETIZACION,
 * decisión 17). `mp_authorized_payment_id` es UNIQUE y se inserta **solo al
 * aprobar** —nunca al rechazar—, porque MP reusa el mismo id en el reintento
 * (lección OBS-002: el guard va donde se aplica el efecto, no donde llega el
 * evento).
 */
export const subscriptionPayments = pgTable('subscription_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  subscriptionId: uuid('subscription_id')
    .notNull()
    .references(() => subscriptions.id, { onDelete: 'cascade' }),
  /** El guard de idempotencia (decisión 17). */
  mpAuthorizedPaymentId: text('mp_authorized_payment_id').notNull().unique(),
  amountArs: integer('amount_ars').notNull(),
  /** El período que este pago extendió. */
  periodStart: timestamp('period_start').notNull(),
  periodEnd: timestamp('period_end').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// ---------------------------------------------------------------------------
// Chat IA — spec CHAT_IA
// ---------------------------------------------------------------------------
//
// Cuatro tablas nuevas (+ la columna `users.chat_trial_used` y `ai_api_usage`
// arriba). **Divergencia consciente del invariante "agregado puro sin user_id"**
// de las tablas de stats (decisión 7): esto es contenido del usuario (como sus
// votaciones), no telemetría. El invariante sigue intacto para
// `place_impressions_daily` y compañía.

/** 'chat' (default) o 'shortlist' (VOTACION, F3). */
export const chatModoEnum = pgEnum('chat_modo', ['chat', 'shortlist'])
/** El plan con el que se mandó el mensaje: telemetría de cupo, solo en el user. */
export const chatPlanEnum = pgEnum('chat_plan', ['trial', 'premium'])

/**
 * Una conversación del chat por usuario (decisión 7). `seen_place_ids` es el set
 * de grounding que persiste (decisión 17): acumula los IDs que las tools
 * devolvieron, y la validación del candado (b) valida contra él — funciona aunque
 * el turno actual no haya llamado tools ("dale, el segundo que me dijiste").
 */
export const chatConversations = pgTable(
  'chat_conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    modo: chatModoEnum('modo').notNull().default('chat'),
    /** Primeros ~60 chars del primer mensaje. */
    titulo: text('titulo'),
    /** Set de grounding (decisión 17): IDs de lugares que las tools devolvieron. */
    seenPlaceIds: jsonb('seen_place_ids').$type<string[]>().notNull().default([]),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [index('chat_conversations_user_idx').on(t.userId, t.updatedAt)],
)

/**
 * Los mensajes de una conversación. `content` es texto plano con los marcadores
 * `[[lugar:id]]` **ya validados** (decisión 11): los inválidos se quitaron. El
 * consumo NO se cuenta desde acá (decisión 14) — borrar una conversación borra
 * contenido, nunca cupo.
 */
export const chatMessages = pgTable(
  'chat_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => chatConversations.id, { onDelete: 'cascade' }),
    role: text('role').notNull(), // 'user' | 'assistant'
    content: text('content').notNull(),
    /** Telemetría de costos (decisión 24). Solo en assistant. */
    modelUsed: text('model_used'),
    tokensIn: integer('tokens_in'),
    tokensOut: integer('tokens_out'),
    /** 'trial' | 'premium', solo en user (con qué plan se mandó). */
    planAtSend: chatPlanEnum('plan_at_send'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('chat_messages_conversation_idx').on(t.conversationId, t.createdAt)],
)

/**
 * Consumo premium por usuario y mes (decisión 14). La fila se lockea `FOR UPDATE`
 * en la reserva TOCTOU-safe (decisión 13). Contador propio: si se contara desde
 * `chat_messages`, borrar una conversación devolvería cupo (exploit del free).
 */
export const chatUsageMonthly = pgTable(
  'chat_usage_monthly',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** `YYYY-MM` (patrón `google_api_usage`). */
    month: text('month').notNull(),
    used: integer('used').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.month] })],
)

/**
 * Bonus de cupo (decisión 5): un mes-del-amigo es un INSERT, no tocar el plan de
 * nadie. Cupo efectivo del mes = `ai.chat_quota_premium` + SUM(grants del user+mes).
 */
export const chatQuotaGrants = pgTable(
  'chat_quota_grants',
  {
    id: serial('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    month: text('month').notNull(),
    amount: integer('amount').notNull(),
    /** 'mes-del-amigo-2026', etc. */
    reason: text('reason').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('chat_quota_grants_user_month_idx').on(t.userId, t.month)],
)

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
export type PlaceClaim = typeof placeClaims.$inferSelect
export type NewPlaceClaim = typeof placeClaims.$inferInsert
export type ClaimKind = (typeof claimKindEnum.enumValues)[number]
export type ClaimStatus = (typeof claimStatusEnum.enumValues)[number]
export type PlaceOwnerContent = typeof placeOwnerContent.$inferSelect
export type NewPlaceOwnerContent = typeof placeOwnerContent.$inferInsert
export type OwnerPlan = (typeof ownerPlanEnum.enumValues)[number]
export type UserPlan = (typeof userPlanEnum.enumValues)[number]
export type Poll = typeof polls.$inferSelect
export type NewPoll = typeof polls.$inferInsert
export type PollOption = typeof pollOptions.$inferSelect
export type NewPollOption = typeof pollOptions.$inferInsert
export type PollVote = typeof pollVotes.$inferSelect
export type NewPollVote = typeof pollVotes.$inferInsert
export type PollStatus = (typeof pollStatusEnum.enumValues)[number]
export type PlaceTapDaily = typeof placeTapsDaily.$inferSelect
export type PlaceTagImpressionDaily = typeof placeTagImpressionsDaily.$inferSelect
export type AppSettingsHistory = typeof appSettingsHistory.$inferSelect
export type Subscription = typeof subscriptions.$inferSelect
export type NewSubscription = typeof subscriptions.$inferInsert
export type SubscriptionPayment = typeof subscriptionPayments.$inferSelect
export type NewSubscriptionPayment = typeof subscriptionPayments.$inferInsert
export type SubscriptionStatus = (typeof subscriptionStatusEnum.enumValues)[number]
export type AiApiUsage = typeof aiApiUsage.$inferSelect
export type ChatConversation = typeof chatConversations.$inferSelect
export type NewChatConversation = typeof chatConversations.$inferInsert
export type ChatMessage = typeof chatMessages.$inferSelect
export type NewChatMessage = typeof chatMessages.$inferInsert
export type ChatUsageMonthly = typeof chatUsageMonthly.$inferSelect
export type ChatQuotaGrant = typeof chatQuotaGrants.$inferSelect
export type ChatModo = (typeof chatModoEnum.enumValues)[number]
export type ChatPlan = (typeof chatPlanEnum.enumValues)[number]
