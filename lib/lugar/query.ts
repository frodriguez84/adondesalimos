import { cache } from 'react'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { getConfidenceThreshold } from '@/lib/db/settings'
import {
  placeOwnerContent,
  placePhotos,
  placeTags,
  placeZones,
  places,
  tags,
  zones,
} from '@/lib/db/schema'
import { isPlacePublished } from '@/lib/db/visibility'
import { tieneDuenoAprobado } from '@/lib/claims/ownership'
import { resolverContenidoDueno } from '@/lib/negocio/contenido'
import {
  normalizarSemana,
  tieneAlgunHorario,
  type HorariosSemana,
} from '@/lib/negocio/horarios'
import type { FichaTag } from './ficha'

/**
 * Datos propios de la ficha de un lugar (FICHA, fase 1). **Todo de Overture y
 * ZONAS** — nada de Google, que entra en vivo desde el cliente (F2) y no se
 * persiste. Es lo que hace que la pantalla se vea entera con la API de Google
 * apagada.
 */
export type PlaceDetail = {
  id: string
  name: string
  lat: number
  lng: number
  address: string | null
  locality: string | null
  /** Zona primaria, o `null`: 1.890 lugares publicados no tienen (ZONAS, dec. 17). */
  zone: string | null
  /**
   * Contacto ya resuelto `COALESCE(dueño → Overture)` (AUTH, decisión 13). Lo que
   * el dueño cargó gana; lo que dejó vacío cae a la base. La ficha no ve el
   * origen — solo el dato que corresponde mostrar.
   */
  phone: string | null
  website: string | null
  socials: string[]
  /**
   * Huecos del plan pago (AUTH, decisiones 18 y 19). `null` con `owner_plan =
   * 'free'` **aunque estén cargados**: dejar de pagar los oculta, no los borra.
   */
  description: string | null
  menuUrl: string | null
  news: string | null
  /**
   * Horarios propios del dueño (AUTH F4, decisión 20), o `null` si no cargó
   * ninguno o el lugar ya no tiene reclamo aprobado. Cuando hay, la ficha los
   * muestra **en lugar** de los de Google (mismo patrón que las fotos); Google
   * sigue aportando solo el rating.
   */
  horariosDueno: HorariosSemana | null
  /** Todos los tags activos, ordenados por `sort`. */
  tags: FichaTag[]
  /** Fotos del dueño, ordenadas. Vacío hasta el spec de reclamo (dec. 3). */
  ownerPhotos: string[]
  /** Único dato de Google persistido: alimenta el deep link "cómo llegar". */
  googlePlaceId: string | null
  /**
   * Ya tiene un reclamo aprobado (AUTH, decisión 21). La ficha esconde el botón
   * "¿Sos el dueño?" cuando es true: ofrecer reclamar algo que ya tiene dueño
   * sería una promesa que el endpoint rechaza.
   */
  reclamado: boolean
}

/** Formato de UUID v4 de Postgres. Un `id` que no matchea no toca la base. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * La ficha de un lugar publicado, o `null` si no existe, el `id` no es un UUID o
 * no pasa la visibilidad (decisión 23: no publicado ⇒ 404, y **cero** llamadas a
 * Google). La visibilidad se resuelve con el helper de CATALOGO, única puerta al
 * catálogo publicado.
 *
 * `React.cache` deduplica la consulta dentro de un mismo render: `generateMetadata`
 * y el componente la piden una vez cada uno y la base se toca una sola vez. Es el
 * único dedupe permitido (decisión 17) — no es caché entre requests.
 */
export const getPlaceDetail = cache(async (id: string): Promise<PlaceDetail | null> => {
  // Un id manoseado en la URL no puede llegar a una query `WHERE id = $1` sobre
  // una columna uuid: Postgres tira. Se corta acá y el route lo vuelve 404.
  if (!UUID_RE.test(id)) return null

  const [place] = await db
    .select({
      id: places.id,
      name: places.name,
      lat: places.lat,
      lng: places.lng,
      address: places.address,
      locality: places.locality,
      phones: places.phones,
      websites: places.websites,
      socials: places.socials,
      confidence: places.confidence,
      operatingStatus: places.operatingStatus,
      publishOverride: places.publishOverride,
      googlePlaceId: places.googlePlaceId,
      ownerPlan: places.ownerPlan,
    })
    .from(places)
    .where(eq(places.id, id))
    .limit(1)

  if (!place) return null

  const umbral = await getConfidenceThreshold()
  const publicado = isPlacePublished(
    {
      operatingStatus: place.operatingStatus,
      confidence: place.confidence,
      publishOverride: place.publishOverride,
    },
    umbral,
  )
  if (!publicado) return null

  const [tagsDelLugar, zonaPrimaria, fotosDueno, reclamado, contenidoDueno] = await Promise.all([
    tagsDeLugar(id),
    zonaPrimariaDeLugar(id),
    fotosDeDueno(id),
    tieneDuenoAprobado(id),
    contenidoDeDueno(id),
  ])

  // COALESCE dueño → base y gating por plan, en el helper puro (AUTH F3): la
  // regla que decide qué se ve está testeada sin base, y acá solo se aplica.
  //
  // El contenido se aplica **solo mientras el lugar tenga dueño aprobado**. Es lo
  // que hace que revocar un reclamo (AUTH-13) o eliminar la cuenta del dueño
  // devuelvan la ficha a los datos de Overture: sin esta condición, el teléfono
  // de un ex-dueño quedaría publicado para siempre. La fila **no se borra** — se
  // deja de aplicar, igual que el contenido pago cuando se cae el plan.
  const contenido = resolverContenidoDueno({
    base: {
      phones: place.phones ?? [],
      websites: place.websites ?? [],
      socials: place.socials ?? [],
    },
    owner: reclamado ? contenidoDueno : null,
    plan: place.ownerPlan,
  })

  // Horarios: misma condición que el resto del contenido (solo con dueño
  // aprobado) pero **fuera** del gate de plan — son free (decisión 20). No pasan
  // por `resolverContenidoDueno`: la prioridad dueño → Google la resuelve la
  // ficha en el cliente, no hay dato base de Overture que hacer COALESCE.
  const semana = reclamado ? normalizarSemana(contenidoDueno?.openingHours) : null
  const horariosDueno = semana && tieneAlgunHorario(semana) ? semana : null

  return {
    id: place.id,
    name: place.name,
    lat: place.lat,
    lng: place.lng,
    address: place.address,
    locality: place.locality,
    zone: zonaPrimaria,
    phone: contenido.phone,
    website: contenido.website,
    socials: contenido.socials,
    description: contenido.description,
    menuUrl: contenido.menuUrl,
    news: contenido.news,
    horariosDueno,
    tags: tagsDelLugar,
    ownerPhotos: fotosDueno,
    googlePlaceId: place.googlePlaceId,
    reclamado,
  }
})

/** Los tags activos del lugar, ordenados por `sort` (mismo criterio que la card). */
async function tagsDeLugar(id: string): Promise<FichaTag[]> {
  const filas = await db
    .select({ slug: tags.slug, name: tags.name, facet: tags.facet, sort: tags.sort })
    .from(placeTags)
    .innerJoin(tags, eq(tags.id, placeTags.tagId))
    .where(and(eq(placeTags.placeId, id), eq(tags.active, true)))
    .orderBy(asc(tags.sort))

  return filas.map((f) => ({ slug: f.slug, name: f.name, facet: f.facet }))
}

/** Zona primaria del lugar, o `null` si cae fuera de todo polígono (ZONAS, dec. 17). */
async function zonaPrimariaDeLugar(id: string): Promise<string | null> {
  const [fila] = await db
    .select({ name: zones.name })
    .from(placeZones)
    .innerJoin(zones, eq(zones.id, placeZones.zoneId))
    .where(and(eq(placeZones.placeId, id), eq(placeZones.isPrimary, true)))
    .limit(1)

  return fila?.name ?? null
}

/**
 * La fila de `place_owner_content`, o `null` si el dueño no editó nada (o no hay
 * dueño). Query aparte y no un `leftJoin` sobre la de arriba: la ficha ya hace
 * varias en paralelo y así la del lugar no cambia de forma.
 */
async function contenidoDeDueno(id: string) {
  const [fila] = await db
    .select({
      phone: placeOwnerContent.phone,
      website: placeOwnerContent.website,
      socials: placeOwnerContent.socials,
      openingHours: placeOwnerContent.openingHours,
      description: placeOwnerContent.description,
      menuUrl: placeOwnerContent.menuUrl,
      news: placeOwnerContent.news,
    })
    .from(placeOwnerContent)
    .where(eq(placeOwnerContent.placeId, id))
    .limit(1)

  return fila ?? null
}

/** Fotos del dueño, ordenadas. Vacío hasta que el spec de reclamo las cargue. */
async function fotosDeDueno(id: string): Promise<string[]> {
  const filas = await db
    .select({ url: placePhotos.url })
    .from(placePhotos)
    .where(eq(placePhotos.placeId, id))
    .orderBy(asc(placePhotos.sort))

  return filas.map((f) => f.url)
}
