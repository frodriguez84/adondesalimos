import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  pollOptions,
  pollVotes,
  polls,
  placeTags,
  placeZones,
  places,
  tags,
  zones,
  type PollOptionOrigin,
} from '@/lib/db/schema'
import { tagsDestacados } from '@/lib/search/card'
import { estaExpirada, estadoVisible, type EstadoVisible } from './estado'

/**
 * Lecturas de la votación (spec VOTACION). La página `/votacion/[token]` es
 * **server-render sin Google ni IA** (decisión 22): lee solo nuestra DB (datos
 * base de `places` + conteos). Barato de crawlear — el preview de WhatsApp no
 * dispara ninguna llamada paga.
 *
 * Los votos son **agregado por opción**: el conteo sale de un `GROUP BY`; el
 * `voter_token` nunca se expone a ningún cliente (decisión 21).
 */

/**
 * Una opción con su lugar (datos base) y su conteo. Nunca trae `voter_token` ni
 * `suggested_by`: **quién sugirió qué no sale del server** (SUGERIR_EN_VOTACION,
 * decisión 12 — mismo invariante que `poll_votes.voter_token`). Lo único que viaja
 * es `origin`, que dice *que* la sumó el grupo, no *quién*.
 */
export type OpcionPublica = {
  optionId: string
  placeId: string
  name: string
  location: string | null
  tags: string[]
  votos: number
  origin: PollOptionOrigin
}

export type VotacionPublica = {
  id: string
  token: string
  title: string | null
  /** Ya resuelta la expiración perezosa: una `open` vencida se ve `expired`. */
  estado: EstadoVisible
  winnerPlaceId: string | null
  totalVotos: number
  opciones: OpcionPublica[]
  /** ¿El grupo puede sumar lugares? (SUGERIR_EN_VOTACION, decisión 10). */
  allowSuggestions: boolean
  expiresAt: Date
  closedAt: Date | null
}

/**
 * La votación completa para la página pública. `null` = token inexistente (⇒ 404;
 * es el **único** 404 — cerrada/expirada/cancelada se muestran en solo-lectura,
 * decisión 15).
 *
 * **Expiración lazy** (decisión 11): si la votación venció pero su columna
 * `status` sigue `'open'`, se persiste el cierre en este acceso (best-effort, sin
 * cron) y se devuelve ya en modo cerrado.
 */
export async function getVotacionPublica(token: string): Promise<VotacionPublica | null> {
  const [poll] = await db
    .select({
      id: polls.id,
      token: polls.token,
      title: polls.title,
      status: polls.status,
      winnerPlaceId: polls.winnerPlaceId,
      allowSuggestions: polls.allowSuggestions,
      expiresAt: polls.expiresAt,
      closedAt: polls.closedAt,
    })
    .from(polls)
    .where(eq(polls.token, token))
    .limit(1)

  if (!poll) return null

  const ahora = new Date()

  // Expiración perezosa: persiste el cierre best-effort. No fija ganador — la
  // votación venció sin que el creador eligiera (el ganador es acción suya,
  // decisión 14); se muestran los conteos sin ganador declarado.
  let closedAt = poll.closedAt
  if (estaExpirada(poll, ahora)) {
    closedAt = ahora
    await db
      .update(polls)
      .set({ status: 'closed', closedAt: ahora })
      .where(and(eq(polls.id, poll.id), eq(polls.status, 'open')))
      .catch(() => {})
  }

  const opciones = await opcionesConConteo(poll.id)
  const totalVotos = opciones.reduce((acc, o) => acc + o.votos, 0)

  return {
    id: poll.id,
    token: poll.token,
    title: poll.title,
    estado: estadoVisible(poll, ahora),
    winnerPlaceId: poll.winnerPlaceId,
    totalVotos,
    opciones,
    allowSuggestions: poll.allowSuggestions,
    expiresAt: poll.expiresAt,
    closedAt,
  }
}

/** El conteo por opción, ya con los datos base del lugar (sin Google). */
async function opcionesConConteo(pollId: string): Promise<OpcionPublica[]> {
  const filas = await db
    .select({
      optionId: pollOptions.id,
      placeId: pollOptions.placeId,
      position: pollOptions.position,
      origin: pollOptions.origin,
      name: places.name,
      locality: places.locality,
    })
    .from(pollOptions)
    .innerJoin(places, eq(places.id, pollOptions.placeId))
    .where(eq(pollOptions.pollId, pollId))
    .orderBy(pollOptions.position)

  const placeIds = filas.map((f) => f.placeId)
  const optionIds = filas.map((f) => f.optionId)

  const [conteos, tagsPorLugar, zonaPorLugar] = await Promise.all([
    conteoPorOpcion(optionIds),
    tagsDestacadosDeLugares(placeIds),
    zonaPrimariaDeLugares(placeIds),
  ])

  return filas.map((f) => ({
    optionId: f.optionId,
    placeId: f.placeId,
    name: f.name,
    location: zonaPorLugar.get(f.placeId) ?? f.locality ?? null,
    tags: tagsPorLugar.get(f.placeId) ?? [],
    votos: conteos.get(f.optionId) ?? 0,
    origin: f.origin,
  }))
}

/** Conteo agregado por opción — un `GROUP BY`, sin exponer nunca el token. */
async function conteoPorOpcion(optionIds: string[]): Promise<Map<string, number>> {
  const mapa = new Map<string, number>()
  if (optionIds.length === 0) return mapa

  const filas = await db
    .select({ optionId: pollVotes.optionId, total: sql<number>`count(*)::int` })
    .from(pollVotes)
    .where(inArray(pollVotes.optionId, optionIds))
    .groupBy(pollVotes.optionId)

  for (const f of filas) mapa.set(f.optionId, f.total)
  return mapa
}

/**
 * El estado en vivo para el polling: estado + total + ganador + **la cancha
 * completa**. Reusa la expiración lazy leyendo la votación entera —barato, ≤8
 * opciones— así el polling también detecta el vencimiento y pasa a solo-lectura.
 *
 * Manda las opciones enteras y no solo `{optionId, votos}` porque desde
 * SUGERIR_EN_VOTACION **la cancha puede crecer mientras la pantalla está abierta**:
 * con solo conteos, el total subiría por votos de una opción que el cliente no
 * conoce y no tendría dónde mostrarlos. `allowSuggestions` viaja por lo mismo — si
 * el creador cierra las sugerencias, el botón se apaga solo.
 */
export type ResultadosEnVivo = {
  estado: EstadoVisible
  totalVotos: number
  winnerPlaceId: string | null
  allowSuggestions: boolean
  opciones: OpcionPublica[]
}

export async function getResultados(token: string): Promise<ResultadosEnVivo | null> {
  const votacion = await getVotacionPublica(token)
  if (!votacion) return null
  return {
    estado: votacion.estado,
    totalVotos: votacion.totalVotos,
    winnerPlaceId: votacion.winnerPlaceId,
    allowSuggestions: votacion.allowSuggestions,
    opciones: votacion.opciones,
  }
}

// ---------------------------------------------------------------------------
// Panel del creador — "Mis votaciones" (F3)
// ---------------------------------------------------------------------------

export type OpcionDelPanel = {
  placeId: string
  name: string
  votos: number
}

export type VotacionDelPanel = {
  id: string
  token: string
  title: string | null
  estado: EstadoVisible
  winnerPlaceId: string | null
  totalVotos: number
  createdAt: Date
  expiresAt: Date
  opciones: OpcionDelPanel[]
  /** El interruptor de "que el grupo pueda sumar" (SUGERIR_EN_VOTACION, d. 10). */
  allowSuggestions: boolean
}

/**
 * Las votaciones del creador para `/mis-votaciones` (decisión 19). El gate de plan
 * se aplica **en esta query**:
 *
 * - **free** (`incluirHistorial=false`): solo la **activa** (`status='open' AND
 *   expires_at > now()`) — para gestionarla/cerrarla. Las cerradas siguen vivas
 *   por su link, pero no hay lista persistente.
 * - **premium** (`incluirHistorial=true`): todas, más nuevas primero (el historial
 *   navegable es premium).
 *
 * Trae las opciones con su conteo: el creador elige el ganador al cerrar y el
 * default sugerido es el más votado (decisión 14).
 */
export async function misVotaciones(
  userId: string,
  incluirHistorial: boolean,
): Promise<VotacionDelPanel[]> {
  const filas = await db
    .select({
      id: polls.id,
      token: polls.token,
      title: polls.title,
      status: polls.status,
      winnerPlaceId: polls.winnerPlaceId,
      allowSuggestions: polls.allowSuggestions,
      createdAt: polls.createdAt,
      expiresAt: polls.expiresAt,
    })
    .from(polls)
    .where(
      incluirHistorial
        ? eq(polls.creatorId, userId)
        : and(eq(polls.creatorId, userId), eq(polls.status, 'open'), sql`${polls.expiresAt} > now()`),
    )
    .orderBy(sql`${polls.createdAt} DESC`)

  if (filas.length === 0) return []

  const ahora = new Date()
  const pollIds = filas.map((f) => f.id)
  const opcionesPorPoll = await opcionesConConteoPorPoll(pollIds)

  return filas.map((f) => {
    const opciones = opcionesPorPoll.get(f.id) ?? []
    return {
      id: f.id,
      token: f.token,
      title: f.title,
      estado: estadoVisible(f, ahora),
      winnerPlaceId: f.winnerPlaceId,
      totalVotos: opciones.reduce((acc, o) => acc + o.votos, 0),
      createdAt: f.createdAt,
      expiresAt: f.expiresAt,
      opciones,
      allowSuggestions: f.allowSuggestions,
    }
  })
}

/** Opciones con conteo para un lote de votaciones (una consulta por pieza). */
async function opcionesConConteoPorPoll(
  pollIds: string[],
): Promise<Map<string, OpcionDelPanel[]>> {
  const mapa = new Map<string, OpcionDelPanel[]>()
  if (pollIds.length === 0) return mapa

  const filas = await db
    .select({
      pollId: pollOptions.pollId,
      optionId: pollOptions.id,
      placeId: pollOptions.placeId,
      position: pollOptions.position,
      name: places.name,
      votos: sql<number>`count(${pollVotes.id})::int`,
    })
    .from(pollOptions)
    .innerJoin(places, eq(places.id, pollOptions.placeId))
    .leftJoin(pollVotes, eq(pollVotes.optionId, pollOptions.id))
    .where(inArray(pollOptions.pollId, pollIds))
    .groupBy(pollOptions.pollId, pollOptions.id, pollOptions.placeId, pollOptions.position, places.name)
    .orderBy(pollOptions.pollId, pollOptions.position)

  for (const f of filas) {
    const actual = mapa.get(f.pollId) ?? []
    actual.push({ placeId: f.placeId, name: f.name, votos: f.votos })
    mapa.set(f.pollId, actual)
  }
  return mapa
}

/** La opción que ya votó este dispositivo en esta votación, o null. */
export async function votoDelDispositivo(
  pollId: string,
  voterToken: string,
): Promise<string | null> {
  const [fila] = await db
    .select({ optionId: pollVotes.optionId })
    .from(pollVotes)
    .where(and(eq(pollVotes.pollId, pollId), eq(pollVotes.voterToken, voterToken)))
    .limit(1)
  return fila?.optionId ?? null
}

/**
 * Las opciones que sumó **este** dispositivo (SUGERIR_EN_VOTACION). Es la forma de
 * que la pantalla ofrezca "sacar lo mío" y sepa cuántas vacantes le quedan **sin
 * mandarle `suggested_by` a nadie** (decisión 12): el cruce con la cookie se hace
 * acá, en el server, y lo que viaja son ids de opciones de uno mismo — el mismo
 * criterio con el que `votoDelDispositivo` marca el voto propio.
 */
export async function sugerenciasDelDispositivo(
  pollId: string,
  voterToken: string,
): Promise<string[]> {
  const filas = await db
    .select({ optionId: pollOptions.id })
    .from(pollOptions)
    .where(and(eq(pollOptions.pollId, pollId), eq(pollOptions.suggestedBy, voterToken)))
  return filas.map((f) => f.optionId)
}

/**
 * ¿Este usuario es el creador de esta votación? Se pregunta así, y no exponiendo
 * `creator_id` en `VotacionPublica`, para que todo lo que devuelve esa query siga
 * siendo publicable tal cual (decisión 21 de VOTACION).
 */
export async function esCreadorDeVotacion(pollId: string, userId: string): Promise<boolean> {
  const [fila] = await db
    .select({ id: polls.id })
    .from(polls)
    .where(and(eq(polls.id, pollId), eq(polls.creatorId, userId)))
    .limit(1)
  return !!fila
}

// ---------------------------------------------------------------------------
// Helpers de datos base del lugar (sin Google, decisión 22)
// ---------------------------------------------------------------------------

/** Tags destacados (Tipo + 2) por lugar, mismo criterio que la card de búsqueda. */
async function tagsDestacadosDeLugares(ids: string[]): Promise<Map<string, string[]>> {
  const mapa = new Map<string, { slug: string; name: string; facet: string }[]>()
  if (ids.length === 0) return new Map()

  const filas = await db
    .select({
      placeId: placeTags.placeId,
      slug: tags.slug,
      name: tags.name,
      facet: tags.facet,
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

  const destacados = new Map<string, string[]>()
  for (const [placeId, lista] of mapa) destacados.set(placeId, tagsDestacados(lista))
  return destacados
}

/** Zona primaria por lugar. Puede no haber (ZONAS, decisión 17). */
async function zonaPrimariaDeLugares(ids: string[]): Promise<Map<string, string>> {
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
