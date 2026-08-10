import { and, eq, inArray, sql, type SQL } from 'drizzle-orm'
import { db } from '@/lib/db'
import { getConfidenceThreshold } from '@/lib/db/settings'
import { placeImpressionsDaily, placeTags, placeZones, places, tags, zones } from '@/lib/db/schema'
import { publishedWhere } from '@/lib/db/visibility'
import { esCadenaSql, getCadenas } from './cadenas'
import { coincideNombre, simKey } from './nombre'
import { GPS_RADIUS_KM, MAP_PIN_LIMIT, PAGE_SIZE, type SearchParams } from './params'

/**
 * Motor de búsqueda (F1 de BUSQUEDA). Una query sobre el catálogo publicado.
 *
 * Reglas que implementa, todas del spec:
 *  - visibilidad: SIEMPRE vía `publishedWhere` (CATALOGO, fuente única)
 *  - decisión 13: OR dentro de una faceta, AND entre facetas; padre de Cocina
 *    expande a sus hijos
 *  - decisión 16, **enmendada por ORDEN_ORGANICO**: orden orgánico
 *    dueño > banda > confidence > nombre; con texto manda la similitud; con GPS
 *    manda la distancia
 *  - decisión 17: GPS = 2 km fijos, Haversine con prefiltro por bounding box
 *  - decisión 19: paginación por cursor (keyset), página de 20
 *
 * Lo que NO hace: sugerencias del campo de texto (F2), chips (F3), impresiones
 * (F3). El texto acá busca por NOMBRE de lugar, que es lo que hace Enter sin
 * elegir sugerencia (decisión 15).
 */

/** Lo que necesita la card. Nada de Google: no es persistible (CATALOGO). */
export type SearchedPlace = {
  id: string
  name: string
  lat: number
  lng: number
  address: string | null
  locality: string | null
  /**
   * Nombre de la zona primaria. **Puede ser null**: 301 lugares publicados caen
   * dentro del buffer de 400 m sin estar en ningún polígono exacto, y 1.589 no
   * tienen zona ninguna (ZONAS, decisión 17). La card tiene que tolerarlo.
   */
  zone: string | null
  tags: { slug: string; name: string; facet: string }[]
  /** Distancia en km desde las coordenadas del usuario. Solo en modo GPS. */
  distanceKm: number | null
}

export type SearchResult = {
  places: SearchedPlace[]
  /** Null = no hay más páginas. */
  nextCursor: string | null
}

export type PinsResult = {
  places: SearchedPlace[]
  /** El resultado excede `MAP_PIN_LIMIT` y el mapa muestra solo los primeros. */
  truncated: boolean
}

// ---------------------------------------------------------------------------
// Expresiones de orden — nombradas porque el cursor las reusa tal cual
// ---------------------------------------------------------------------------

/** Decisión 16: los lugares reclamados/de dueño primero, tienen mejor dato. */
const ownerRank = sql<number>`(CASE WHEN ${places.source} = 'owner' OR ${places.publishOverride} THEN 1 ELSE 0 END)`

/** Los lugares de dueño tienen confidence null; -1 los ordena de forma estable. */
const confKey = sql<number>`COALESCE(${places.confidence}, -1)`

/**
 * "Alguien miró este lugar y le encontró una ocasión" (ORDEN_ORGANICO, decisión 4).
 * Es la única señal de calidad **del lugar** que tiene el catálogo: `confidence` es
 * la confianza de Overture en el **dato**, que es otra cosa y es justo lo que rompía
 * el orden.
 *
 * `"places"."id"` va escrito a mano y calificado a propósito: la banda también viaja
 * en la lista de SELECT (como `k_b`, para el cursor) y ahí Drizzle **omite la tabla**
 * al renderizar `${places.id}` — el mismo filo que documenta `filtrosDeTags`. Con
 * `"id"` a secas la correlación quedaría resuelta por scoping en vez de por contrato.
 */
const curadoRank = sql<number>`(CASE WHEN EXISTS (
  SELECT 1 FROM ${placeTags} pt WHERE pt.place_id = "places"."id" AND pt.source = 'admin'
) THEN 1 ELSE 0 END)`

/**
 * La banda del orden orgánico (ORDEN_ORGANICO, decisiones 2 y 3). Un entero 0-3, no
 * un score con pesos: una banda se lee de un vistazo, se testea con igualdad y se
 * puede explicar ("está 4º porque es cadena").
 *
 * ```
 *  3  no-cadena y curado      2  no-cadena      1  cadena curada      0  cadena
 * ```
 *
 * **La precedencia es cadena ANTES que curado y no es un detalle de gusto**: la
 * curaduría curó 85 McDonald's y 41 Starbucks, así que con "curado primero" *Un café
 * · Palermo Soho* abriría con Starbucks 2º y 3º. Por eso ser cadena vale 2 y estar
 * curado vale 1: la suma no puede empatar una cadena curada con un lugar único.
 *
 * Lista de cadenas vacía o ausente ⇒ nadie es cadena ⇒ la banda colapsa a 2/3
 * (decisión 16): la mitad "cadena" del orden se apaga con un `UPDATE`, sin deploy.
 */
function bandaKey(cadenas: readonly string[]): SQL<number> {
  return sql<number>`((CASE WHEN ${esCadenaSql(cadenas)} THEN 0 ELSE 2 END) + ${curadoRank})`
}

/**
 * Haversine en SQL, sin PostGIS — consistente con ZONAS, que resuelve la
 * geometría con turf y precomputa. `least(1, ...)` evita que el redondeo saque
 * el argumento del dominio de acos().
 */
function distKey(lat: number, lng: number) {
  return sql<number>`(6371 * acos(least(1, cos(radians(${lat})) * cos(radians(${places.lat})) * cos(radians(${places.lng}) - radians(${lng})) + sin(radians(${lat})) * sin(radians(${places.lat})))))`
}

// ---------------------------------------------------------------------------
// Cursor
// ---------------------------------------------------------------------------

/** Valores de la clave de orden de la última fila servida. */
type Cursor = Record<string, string | number>

function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c)).toString('base64url')
}

function decodeCursor(raw: string | null): Cursor | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString())
    return parsed && typeof parsed === 'object' ? (parsed as Cursor) : null
  } catch {
    // Cursor manoseado en la URL: se ignora y se sirve la primera página.
    return null
  }
}

/**
 * Keyset: "todo lo que va DESPUÉS de esta fila en este orden".
 *
 * Se arma como cadena de OR porque las direcciones son mixtas (dueño desc,
 * nombre asc) y `(a,b) < (x,y)` de SQL solo sirve si todas van igual. Cada
 * término fija los anteriores en igualdad y compara el siguiente.
 */
function keysetWhere(claves: { expr: SQL; valor: string | number; desc: boolean }[]): SQL {
  const terminos: SQL[] = []
  for (let i = 0; i < claves.length; i++) {
    const iguales = claves.slice(0, i).map((k) => sql`${k.expr} = ${k.valor}`)
    const k = claves[i]
    const comparacion = k.desc ? sql`${k.expr} < ${k.valor}` : sql`${k.expr} > ${k.valor}`
    terminos.push(sql`(${sql.join([...iguales, comparacion], sql` AND `)})`)
  }
  return sql`(${sql.join(terminos, sql` OR `)})`
}

// ---------------------------------------------------------------------------
// Filtros
// ---------------------------------------------------------------------------

/**
 * Decisión 13. Un EXISTS por faceta pedida: dentro de la faceta los tags van en
 * OR, y las facetas se acumulan en AND porque son cláusulas separadas.
 *
 * Un padre de Cocina ("Asiática") trae a sus hijos **y a sí mismo**: el import
 * pudo haber asignado el genérico.
 */
async function filtrosDeTags(slugs: string[]): Promise<SQL[]> {
  if (slugs.length === 0) return []

  const filas = await db
    .select({ id: tags.id, facet: tags.facet })
    .from(tags)
    .where(and(inArray(tags.slug, slugs), eq(tags.active, true)))

  // Slug inexistente o desactivado por curaduría: se ignora, no rompe la
  // búsqueda. Un link viejo con un tag retirado sigue funcionando.
  if (filas.length === 0) return []

  const porFaceta = new Map<string, number[]>()
  for (const f of filas) {
    const actual = porFaceta.get(f.facet) ?? []
    actual.push(f.id)
    porFaceta.set(f.facet, actual)
  }

  // `${places.id}` acá se renderiza **calificado** (`"places"."id"`) porque el
  // fragmento se usa en el WHERE: Drizzle omite la tabla solo en la lista de
  // SELECT, y ahí fue el bug H-1 de `lib/claims/query.ts` (verificado sobre
  // drizzle-orm 0.45 el 2026-07-31). Consecuencia práctica: **no mover estos
  // fragmentos a una posición de SELECT** — ahí `"id"` resolvería contra
  // `place_tags`/`place_zones` y la condición se volvería falsa en silencio.
  return [...porFaceta.values()].map(
    (ids) => sql`EXISTS (
      SELECT 1 FROM ${placeTags} pt
      JOIN ${tags} t ON t.id = pt.tag_id
      WHERE pt.place_id = ${places.id}
        AND (t.id IN ${ids} OR t.parent_id IN ${ids})
    )`,
  )
}

/**
 * Zonas en OR (decisión 4), vía la asignación precomputada de ZONAS.
 * Mismo cuidado que `filtrosDeTags` con `${places.id}`: vale en el WHERE, no en
 * un SELECT.
 */
function filtroDeZonas(slugs: string[]): SQL {
  return sql`EXISTS (
    SELECT 1 FROM ${placeZones} pz
    JOIN ${zones} z ON z.id = pz.zone_id
    WHERE pz.place_id = ${places.id}
      AND z.slug IN ${slugs}
      AND z.active = true
  )`
}

/**
 * Prefiltro por bounding box + Haversine exacto. El bbox es el que puede usar el
 * índice; el Haversine solo se evalúa sobre lo que sobrevive.
 */
function filtroGps(lat: number, lng: number): SQL {
  const gradosLat = GPS_RADIUS_KM / 111.045
  const gradosLng = GPS_RADIUS_KM / (111.045 * Math.cos((lat * Math.PI) / 180))
  return sql`${places.lat} BETWEEN ${lat - gradosLat} AND ${lat + gradosLat}
    AND ${places.lng} BETWEEN ${lng - gradosLng} AND ${lng + gradosLng}
    AND ${distKey(lat, lng)} <= ${GPS_RADIUS_KM}`
}

// ---------------------------------------------------------------------------
// Motor
// ---------------------------------------------------------------------------

/**
 * Las condiciones de una búsqueda, sin orden ni paginación.
 *
 * Vive aparte porque el contador de "Ver N lugares" del sheet de filtros (F2)
 * tiene que contar EXACTAMENTE lo que la lista va a mostrar. Si el `where` se
 * escribiera dos veces, el número del botón y el resultado divergirían en
 * cuanto una de las dos copias cambiara.
 */
async function construirWhere(
  params: SearchParams,
  umbral: number,
): Promise<{ where: SQL[]; usaGps: boolean }> {
  const where: SQL[] = [publishedWhere(umbral)]

  // Decisión 3: GPS REEMPLAZA a las zonas, no se suma. Si está encendido y hay
  // coordenadas, el filtro de zona no se aplica aunque vengan en la URL.
  const usaGps = params.gps && params.coords !== null
  if (usaGps) {
    where.push(filtroGps(params.coords!.lat, params.coords!.lng))
  } else if (params.zones.length > 0) {
    where.push(filtroDeZonas(params.zones))
  }

  where.push(...(await filtrosDeTags(params.tags)))

  if (params.q) {
    where.push(coincideNombre(params.q))
  }

  return { where, usaGps }
}

/**
 * Cuántos lugares devolvería esta búsqueda. Es el número del botón "Ver N
 * lugares" (decisión 20): se muestra ANTES de aplicar, para que el usuario no
 * se coma un "0 resultados" sorpresa — frecuente con Ambiente y Momento, que el
 * import casi no llenó.
 */
export async function countPlaces(params: SearchParams): Promise<number> {
  const umbral = await getConfidenceThreshold()
  const { where } = await construirWhere(params, umbral)

  const [fila] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(places)
    .where(and(...where))

  return fila?.n ?? 0
}

/**
 * Las claves de orden de la decisión 16 —**enmendada por ORDEN_ORGANICO**: la banda
 * entra entre el dueño y `confidence`—, en orden de precedencia.
 *
 * Vive aparte por el mismo motivo que `construirWhere`: la vista mapa
 * (`searchPins`) tiene que quedarse con **los mismos** lugares que encabezan la
 * lista cuando el resultado excede el tope de pins. Si el orden se escribiera
 * dos veces, el mapa mostraría otros 200.
 *
 * Y es también la fuente única del **cursor**: el keyset se arma con estas mismas
 * expresiones, así que sumar una clave acá no pide tocar nada de la paginación
 * (ORDEN_ORGANICO, decisión 11).
 *
 * Es `async` desde ORDEN_ORGANICO porque la lista de cadenas se lee de
 * `app_settings` en cada búsqueda —un `UPDATE` tiene que cambiar el orden sin
 * redeploy—; `getCadenas` deduplica por request. En modo GPS ni se pide: la banda
 * no participa.
 */
async function clavesDeOrden(
  params: SearchParams,
  usaGps: boolean,
): Promise<{ nombre: string; expr: SQL; desc: boolean }[]> {
  const claves: { nombre: string; expr: SQL; desc: boolean }[] = []
  if (usaGps) {
    claves.push({ nombre: 'd', expr: distKey(params.coords!.lat, params.coords!.lng), desc: false })
  } else if (params.q) {
    claves.push({ nombre: 's', expr: simKey(params.q), desc: true })
  }
  if (!usaGps) {
    claves.push({ nombre: 'o', expr: ownerRank, desc: true })
    // ORDEN_ORGANICO, decisión 10: la banda va acá y solo acá. En GPS manda la
    // distancia —quien pide "cerca mío" pide cercanía, y un Burger King a 100 m es
    // legítimamente lo más cercano—; con texto manda la similitud y la banda
    // desempata, que es donde hace falta ("cafe" empata mucho).
    claves.push({ nombre: 'b', expr: bandaKey(await getCadenas()), desc: true })
    claves.push({ nombre: 'c', expr: confKey, desc: true })
    claves.push({ nombre: 'n', expr: sql`${places.name}`, desc: false })
  }
  // `id` último siempre: garantiza que el orden sea total y por lo tanto que la
  // paginación no repita ni saltee filas cuando hay empates.
  claves.push({ nombre: 'i', expr: sql`${places.id}::text`, desc: false })
  return claves
}

export async function searchPlaces(params: SearchParams): Promise<SearchResult> {
  const umbral = await getConfidenceThreshold()
  const cursor = decodeCursor(params.cursor)

  const { where, usaGps } = await construirWhere(params, umbral)

  // --- Orden (decisión 16) + cursor sobre las mismas expresiones -------------
  const claves = await clavesDeOrden(params, usaGps)

  if (cursor) {
    const conValor = claves
      .filter((k) => cursor[k.nombre] !== undefined)
      .map((k) => ({ expr: k.expr, valor: cursor[k.nombre], desc: k.desc }))
    if (conValor.length === claves.length) where.push(keysetWhere(conValor))
  }

  const orderBy = sql.join(
    claves.map((k) => sql`${k.expr} ${sql.raw(k.desc ? 'DESC' : 'ASC')}`),
    sql`, `,
  )

  const seleccion = Object.fromEntries(
    claves.map((k) => [`k_${k.nombre}`, k.expr]),
  ) as Record<string, SQL>

  const filas = await db
    .select({
      id: places.id,
      name: places.name,
      lat: places.lat,
      lng: places.lng,
      address: places.address,
      locality: places.locality,
      ...seleccion,
    })
    .from(places)
    .where(and(...where))
    .orderBy(orderBy)
    // Una de más: si vuelve, hay página siguiente. Evita un count() por página.
    .limit(PAGE_SIZE + 1)

  const hayMas = filas.length > PAGE_SIZE
  const pagina = hayMas ? filas.slice(0, PAGE_SIZE) : filas

  const nextCursor =
    hayMas && pagina.length > 0
      ? encodeCursor(
          Object.fromEntries(
            claves.map((k) => [
              k.nombre,
              (pagina[pagina.length - 1] as Record<string, unknown>)[`k_${k.nombre}`] as
                | string
                | number,
            ]),
          ),
        )
      : null

  const ids = pagina.map((f) => f.id)
  const [tagsPorLugar, zonaPorLugar] = await Promise.all([
    tagsDeLugares(ids),
    zonaPrimariaDeLugares(ids),
  ])

  return {
    places: pagina.map((f) => ({
      id: f.id,
      name: f.name,
      lat: f.lat,
      lng: f.lng,
      address: f.address,
      locality: f.locality,
      zone: zonaPorLugar.get(f.id) ?? null,
      tags: tagsPorLugar.get(f.id) ?? [],
      distanceKm: usaGps
        ? Number((f as Record<string, unknown>).k_d as number)
        : null,
    })),
    nextCursor,
  }
}

/**
 * Los pins de la vista mapa (decisión 21).
 *
 * **Por qué no son "la página actual".** El mapa promete los pins *del
 * resultado*, y la lista sirve de a 20: un mapa de AMBA con 20 puntos se ve
 * vacío y el clustering que pide la decisión 21 no se activaría nunca. Pero
 * traer el resultado entero tampoco va — "Cenar afuera" son 11.438 lugares, o
 * 572 requests contra un endpoint con rate limit.
 *
 * Se trae entonces un tope de `MAP_PIN_LIMIT`, **con el mismo orden que la
 * lista**, así los pins son los mismos lugares que encabezan los resultados y
 * no una muestra arbitraria. Cuando el resultado excede el tope, `truncated`
 * queda en true y el mapa lo dice — un mapa que oculta que hay más miente.
 */
export async function searchPins(params: SearchParams): Promise<PinsResult> {
  const umbral = await getConfidenceThreshold()
  const { where, usaGps } = await construirWhere(params, umbral)
  const claves = await clavesDeOrden(params, usaGps)

  const orderBy = sql.join(
    claves.map((k) => sql`${k.expr} ${sql.raw(k.desc ? 'DESC' : 'ASC')}`),
    sql`, `,
  )

  const filas = await db
    .select({
      id: places.id,
      name: places.name,
      lat: places.lat,
      lng: places.lng,
      address: places.address,
      locality: places.locality,
      ...(usaGps
        ? { k_d: distKey(params.coords!.lat, params.coords!.lng) }
        : {}),
    })
    .from(places)
    .where(and(...where))
    .orderBy(orderBy)
    // Uno de más, igual que la paginación: si vuelve, hay más que el tope.
    .limit(MAP_PIN_LIMIT + 1)

  const truncated = filas.length > MAP_PIN_LIMIT
  const pagina = truncated ? filas.slice(0, MAP_PIN_LIMIT) : filas

  // La mini-card del pin muestra lo mismo que la card de la lista (nombre, tags,
  // zona), así que se arma con los mismos helpers: un solo par de queries para
  // los 200, no una por pin.
  const ids = pagina.map((f) => f.id)
  const [tagsPorLugar, zonaPorLugar] = await Promise.all([
    tagsDeLugares(ids),
    zonaPrimariaDeLugares(ids),
  ])

  return {
    places: pagina.map((f) => ({
      id: f.id,
      name: f.name,
      lat: f.lat,
      lng: f.lng,
      address: f.address,
      locality: f.locality,
      zone: zonaPorLugar.get(f.id) ?? null,
      tags: tagsPorLugar.get(f.id) ?? [],
      distanceKm: usaGps ? Number((f as Record<string, unknown>).k_d as number) : null,
    })),
    truncated,
  }
}

// ---------------------------------------------------------------------------
// Destaque en búsqueda (MONETIZACION, decisiones 20-21)
// ---------------------------------------------------------------------------

/** Máximo de destacados por resultado (decisión 4). Se muestran los que haya (0-3). */
const FEATURED_LIMIT = 3

/**
 * El bloque de hasta 3 lugares destacados que va **arriba** de la primera página
 * de la lista (decisión 21). Solo lista, solo primera página: el mapa no destaca
 * y "Ver N lugares" no cuenta esto (invariantes de la decisión 21) — este módulo
 * no los toca, los sirve aparte.
 *
 * Candidatos (decisión 20): `owner_plan='paid'` ∩ **el `where` completo de la
 * búsqueda**. La regla "solo si matchea los filtros" es la MISMA query que la
 * lista orgánica —se reusa `construirWhere`, no se reimplementa—; se le suma la
 * condición de plan. `construirWhere` ya incluye `publishedWhere`, así que un
 * pago despublicado no se cuela.
 *
 * Rotación (decisión 20): el que MENOS salió destacado hoy va primero
 * (`featured_impressions` ascendente), con desempate determinista por
 * `md5(place_id || fecha)` — estable dentro del día, baraja entre días. El
 * contador lo escribe `registrarDestacados` en el mismo `after()` de las
 * impresiones; acá solo se lee.
 *
 * Baja de plan al instante: el candidato se elige por `owner_plan='paid'` en cada
 * búsqueda, sin caché. `past_due` sigue `paid` durante los reintentos de MP
 * (decisión 14) ⇒ sigue destacando, que es lo correcto: todavía no cayó.
 */
export async function buscarDestacados(params: SearchParams): Promise<SearchedPlace[]> {
  const umbral = await getConfidenceThreshold()
  const { where, usaGps } = await construirWhere(params, umbral)

  const filas = await db
    .select({
      id: places.id,
      name: places.name,
      lat: places.lat,
      lng: places.lng,
      address: places.address,
      locality: places.locality,
      ...(usaGps ? { k_d: distKey(params.coords!.lat, params.coords!.lng) } : {}),
    })
    .from(places)
    // Contador del día para ordenar por rotación. LEFT JOIN: un pago que todavía
    // no salió destacado hoy no tiene fila — cuenta como 0 (COALESCE abajo).
    .leftJoin(
      placeImpressionsDaily,
      and(
        eq(placeImpressionsDaily.placeId, places.id),
        eq(placeImpressionsDaily.date, sql`current_date`),
      ),
    )
    .where(and(...where, eq(places.ownerPlan, 'paid')))
    .orderBy(
      sql`COALESCE(${placeImpressionsDaily.featuredImpressions}, 0) ASC`,
      sql`md5(${places.id}::text || current_date::text) ASC`,
    )
    .limit(FEATURED_LIMIT)

  // Las cards de destaque muestran lo mismo que las orgánicas (nombre, tags,
  // zona): se arman con los mismos helpers, un par de queries para los ≤3.
  const ids = filas.map((f) => f.id)
  const [tagsPorLugar, zonaPorLugar] = await Promise.all([
    tagsDeLugares(ids),
    zonaPrimariaDeLugares(ids),
  ])

  return filas.map((f) => ({
    id: f.id,
    name: f.name,
    lat: f.lat,
    lng: f.lng,
    address: f.address,
    locality: f.locality,
    zone: zonaPorLugar.get(f.id) ?? null,
    tags: tagsPorLugar.get(f.id) ?? [],
    distanceKm: usaGps ? Number((f as Record<string, unknown>).k_d as number) : null,
  }))
}

/** Los tags de la página en una query, no una por card. */
async function tagsDeLugares(ids: string[]) {
  const mapa = new Map<string, SearchedPlace['tags']>()
  if (ids.length === 0) return mapa

  const filas = await db
    .select({
      placeId: placeTags.placeId,
      slug: tags.slug,
      name: tags.name,
      facet: tags.facet,
      sort: tags.sort,
    })
    .from(placeTags)
    .innerJoin(tags, eq(tags.id, placeTags.tagId))
    .where(and(inArray(placeTags.placeId, ids), eq(tags.active, true)))
    .orderBy(tags.sort)

  for (const f of filas) {
    const actual = mapa.get(f.placeId) ?? []
    actual.push({ slug: f.slug, name: f.name, facet: f.facet })
    mapa.set(f.placeId, actual)
  }
  return mapa
}

/** Zona primaria de la página. Un lugar puede no tener — ver `SearchedPlace.zone`. */
async function zonaPrimariaDeLugares(ids: string[]) {
  const mapa = new Map<string, string>()
  if (ids.length === 0) return mapa

  const filas = await db
    .select({ placeId: placeZones.placeId, name: zones.name })
    .from(placeZones)
    .innerJoin(zones, eq(zones.id, placeZones.zoneId))
    .where(and(inArray(placeZones.placeId, ids), eq(placeZones.isPrimary, true)))

  for (const f of filas) mapa.set(f.placeId, f.name)
  return mapa
}
