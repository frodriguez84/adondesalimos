import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { getConfidenceThreshold } from '@/lib/db/settings'
import { pollOptions, pollVotes, polls, places, users } from '@/lib/db/schema'
import { publishedWhere } from '@/lib/db/visibility'
import type { Resultado } from '@/lib/claims/acciones'
import { MAX_OPCIONES_TOTAL, MAX_SUGERENCIAS_POR_VOTANTE } from './constantes'
import { estaActiva, estaExpirada, expiracionDesde } from './estado'
import { generarTokenVotacion } from './token'
import type { CrearVotacionPayload } from './validacion'

/**
 * Escrituras de la votación (spec VOTACION). Mismo reparto que el resto del
 * proyecto: acá vive todo lo que cambia estado y el route handler queda como
 * adaptador (rate limit → sesión → validar forma → llamar → mapear código a
 * status). Se testea contra la base sin HTTP.
 */

const fallo = (code: string, message: string) => ({ ok: false as const, code, message })

/** Error de negocio para cortar dentro de una transacción y mapear afuera. */
class ErrorVotacion extends Error {
  constructor(
    readonly code: string,
    readonly mensaje: string,
  ) {
    super(mensaje)
  }
}

export type VotacionCreada = { token: string; pollId: string }

/**
 * Crea una votación con su shortlist (F1). Dos reglas server-side, siempre:
 *
 * 1. **Solo lugares publicados** (decisión 12): se congela la cancha con la regla
 *    de visibilidad de CATALOGO. Un invisible no tiene ficha que compartir.
 * 2. **Gate "1 activa"** (decisión 16): un `free` con una votación activa no puede
 *    abrir otra. El chequeo cuenta con la fila del **usuario** tomada `FOR UPDATE`
 *    —la fila que ancla el límite— para que dos POST simultáneos no pasen los dos
 *    (lección AUTH F3: "un cap que se cuenta y después inserta necesita el lock de
 *    la fila que lo ancla"). "Activa" es `status='open' AND expires_at > now()`,
 *    no solo el status (decisión 11): una expirada no bloquea.
 *
 * El límite de 2-5 lugares ya lo enforzó `crearVotacionSchema` en el boundary; acá
 * `placeIds` llega deduplicado y dentro del rango.
 */
export async function crearVotacion(
  userId: string,
  payload: CrearVotacionPayload,
): Promise<Resultado<VotacionCreada>> {
  // 1. Todos los lugares tienen que estar publicados (decisión 12).
  const umbral = await getConfidenceThreshold()
  const publicados = await db
    .select({ id: places.id })
    .from(places)
    .where(and(inArray(places.id, payload.placeIds), publishedWhere(umbral)))

  const setPublicados = new Set(publicados.map((p) => p.id))
  const faltan = payload.placeIds.filter((id) => !setPublicados.has(id))
  if (faltan.length > 0) {
    return fallo(
      'LUGAR_NO_PUBLICADO',
      'Alguno de los lugares elegidos no está disponible. Actualizá la lista y probá de nuevo.',
    )
  }

  const ahora = new Date()
  const token = generarTokenVotacion()

  try {
    const creada = await db.transaction(async (tx) => {
      // Lock de la fila que ancla el límite (el usuario): serializa las creaciones
      // de ESTE usuario, no de la tabla entera.
      const [dueno] = await tx
        .select({ id: users.id, plan: users.plan })
        .from(users)
        .where(eq(users.id, userId))
        .for('update')

      if (!dueno) throw new ErrorVotacion('NO_SESSION', 'Iniciá sesión para continuar.')

      // Gate "1 activa" — solo para free (decisión 16). Premium: ilimitadas.
      if (dueno.plan !== 'premium') {
        const [{ activas }] = await tx
          .select({ activas: sql<number>`count(*)::int` })
          .from(polls)
          .where(
            and(
              eq(polls.creatorId, userId),
              eq(polls.status, 'open'),
              sql`${polls.expiresAt} > now()`,
            ),
          )
        if (activas > 0) {
          throw new ErrorVotacion(
            'LIMITE_ACTIVA',
            'Ya tenés una votación activa. Cerrala o esperá a que expire para abrir otra.',
          )
        }
      }

      const [poll] = await tx
        .insert(polls)
        .values({
          creatorId: userId,
          token,
          title: payload.title ?? null,
          // Sin dato explícito manda el default de la columna: `true`
          // (SUGERIR_EN_VOTACION, decisión 10).
          allowSuggestions: payload.allowSuggestions ?? true,
          createdAt: ahora,
          expiresAt: expiracionDesde(ahora),
        })
        .returning({ id: polls.id })

      await tx.insert(pollOptions).values(
        payload.placeIds.map((placeId, i) => ({
          pollId: poll.id,
          placeId,
          position: i,
        })),
      )

      return { token, pollId: poll.id }
    })

    return { ok: true, data: creada }
  } catch (error) {
    if (error instanceof ErrorVotacion) return fallo(error.code, error.mensaje)
    throw error
  }
}

// ---------------------------------------------------------------------------
// Votar (F2)
// ---------------------------------------------------------------------------

export type VotoEmitido = { votedOptionId: string }

/**
 * Vota o revota (F2). Un voto por dispositivo por votación, cambiable mientras
 * esté abierta (decisión 8): el `voter_token` es la cookie por dispositivo
 * (decisión 7), **nunca la IP** —un grupo entero comparte IP y se pisaría—.
 *
 * Es un **upsert** sobre la restricción única `(poll_id, voter_token)`: revotar es
 * un `UPDATE` de `option_id`, no una fila nueva; revotar la misma opción es
 * idempotente (solo mueve `updated_at`). Así el conteo nunca duplica.
 *
 * Rechaza si la votación no está genuinamente activa (cerrada/expirada/cancelada
 * ⇒ `VOTACION_CERRADA`, mensaje claro, no un 409 silencioso). Si estaba vencida,
 * persiste el cierre perezoso de paso (decisión 11).
 */
export async function votar(
  token: string,
  optionId: string,
  voterToken: string,
): Promise<Resultado<VotoEmitido>> {
  const [poll] = await db
    .select({ id: polls.id, status: polls.status, expiresAt: polls.expiresAt })
    .from(polls)
    .where(eq(polls.token, token))
    .limit(1)

  if (!poll) return fallo('VOTACION_NO_ENCONTRADA', 'Esa votación no existe.')

  const ahora = new Date()
  if (!estaActiva(poll, ahora)) {
    // Vencida pero todavía 'open': persistimos el cierre de paso (decisión 11).
    if (estaExpirada(poll, ahora)) {
      await db
        .update(polls)
        .set({ status: 'closed', closedAt: ahora })
        .where(and(eq(polls.id, poll.id), eq(polls.status, 'open')))
        .catch(() => {})
    }
    return fallo('VOTACION_CERRADA', 'Esta votación ya cerró. No se puede votar.')
  }

  // La opción tiene que ser de ESTA votación (no una opción de otra pegada a mano).
  const [opcion] = await db
    .select({ id: pollOptions.id })
    .from(pollOptions)
    .where(and(eq(pollOptions.id, optionId), eq(pollOptions.pollId, poll.id)))
    .limit(1)

  if (!opcion) return fallo('OPCION_INVALIDA', 'Esa opción no es de esta votación.')

  await db
    .insert(pollVotes)
    .values({ pollId: poll.id, optionId, voterToken, createdAt: ahora, updatedAt: ahora })
    .onConflictDoUpdate({
      target: [pollVotes.pollId, pollVotes.voterToken],
      set: { optionId, updatedAt: ahora },
    })

  return { ok: true, data: { votedOptionId: optionId } }
}

// ---------------------------------------------------------------------------
// Sugerir / quitar opciones — SUGERIR_EN_VOTACION
// ---------------------------------------------------------------------------

export type OpcionSugerida = { optionId: string; placeId: string }

/**
 * Suma un lugar del catálogo a la cancha (SUGERIR_EN_VOTACION). Lo puede hacer
 * **cualquiera con el link**, sin cuenta (decisión 1): la identidad es la misma
 * cookie `voter_id` con la que vota.
 *
 * **Todos** los gates viven acá, no en la UI (apagar el botón es cosmética: el
 * sheet que quedó abierto cuando la votación expiró tiene que fallar en el POST):
 *
 * 1. **Lugar real y publicado** (decisión 4) — `publishedWhere`, el mismo candado
 *    que usa `crearVotacion` para la shortlist del creador. Nunca hay texto libre.
 * 2. **Votación abierta** (decisión 6) — la definición de "activa" sale de
 *    `estaActiva`, no se reimplementa acá.
 * 3. **`allow_suggestions`** (decisión 10) — el creador pudo cerrar las suyas.
 * 4. **Techo total** (decisión 2) y **tope por dispositivo** (decisión 7).
 *
 * El conteo del techo y el del tope se hacen **dentro de la transacción con la
 * fila de la votación tomada `FOR UPDATE`** — la fila que ancla el límite (misma
 * lección que el cupo de listas y el gate "1 activa"): dos personas sugiriendo con
 * una sola vacante entran serializadas, una suma y la otra recibe "está llena", no
 * una novena opción.
 */
export async function sugerirOpcion(
  token: string,
  placeId: string,
  voterToken: string,
): Promise<Resultado<OpcionSugerida>> {
  // Candado de grounding (decisión 4), fuera de la transacción: no toma locks y
  // el caso "ese lugar no existe" no tiene por qué serializar la votación.
  const umbral = await getConfidenceThreshold()
  const [publicado] = await db
    .select({ id: places.id })
    .from(places)
    .where(and(eq(places.id, placeId), publishedWhere(umbral)))
    .limit(1)

  if (!publicado) {
    return fallo('LUGAR_NO_PUBLICADO', 'Ese lugar no está disponible para sumar.')
  }

  const ahora = new Date()

  // Estado de la votación **antes** de abrir la transacción, igual que al votar:
  // el cierre perezoso (decisión 11 de VOTACION) es un efecto que tiene que
  // sobrevivir, y adentro se lo llevaría puesto el rollback del error de negocio.
  const [previa] = await db
    .select({ id: polls.id, status: polls.status, expiresAt: polls.expiresAt })
    .from(polls)
    .where(eq(polls.token, token))
    .limit(1)

  if (!previa) return fallo('VOTACION_NO_ENCONTRADA', 'Esa votación no existe.')

  if (!estaActiva(previa, ahora)) {
    if (estaExpirada(previa, ahora)) {
      await db
        .update(polls)
        .set({ status: 'closed', closedAt: ahora })
        .where(and(eq(polls.id, previa.id), eq(polls.status, 'open')))
        .catch(() => {})
    }
    return fallo('VOTACION_CERRADA', 'Esta votación ya cerró. No se puede sumar.')
  }

  try {
    return await db.transaction(async (tx) => {
      // Re-lectura con la fila tomada: es la que ancla el techo, y de paso
      // revalida el estado por si algo cambió entre el pre-chequeo y el lock.
      const [poll] = await tx
        .select({
          id: polls.id,
          status: polls.status,
          expiresAt: polls.expiresAt,
          allowSuggestions: polls.allowSuggestions,
        })
        .from(polls)
        .where(eq(polls.token, token))
        .for('update')

      if (!poll) throw new ErrorVotacion('VOTACION_NO_ENCONTRADA', 'Esa votación no existe.')

      if (!estaActiva(poll, ahora)) {
        throw new ErrorVotacion('VOTACION_CERRADA', 'Esta votación ya cerró. No se puede sumar.')
      }

      if (!poll.allowSuggestions) {
        throw new ErrorVotacion(
          'SUGERENCIAS_CERRADAS',
          'Quien armó esta votación no habilitó sumar lugares.',
        )
      }

      const [{ total }] = await tx
        .select({ total: sql<number>`count(*)::int` })
        .from(pollOptions)
        .where(eq(pollOptions.pollId, poll.id))

      if (total >= MAX_OPCIONES_TOTAL) {
        throw new ErrorVotacion(
          'VOTACION_LLENA',
          `Esta votación ya tiene ${MAX_OPCIONES_TOTAL} lugares, que es el máximo.`,
        )
      }

      const [{ mias }] = await tx
        .select({ mias: sql<number>`count(*)::int` })
        .from(pollOptions)
        .where(and(eq(pollOptions.pollId, poll.id), eq(pollOptions.suggestedBy, voterToken)))

      if (mias >= MAX_SUGERENCIAS_POR_VOTANTE) {
        throw new ErrorVotacion(
          'LIMITE_SUGERENCIAS',
          `Ya sumaste ${MAX_SUGERENCIAS_POR_VOTANTE} lugares a esta votación. Dejale lugar al resto.`,
        )
      }

      // Al final de la cancha: la shortlist del creador se lee primero.
      const [{ ultima }] = await tx
        .select({ ultima: sql<number | null>`max(${pollOptions.position})` })
        .from(pollOptions)
        .where(eq(pollOptions.pollId, poll.id))

      // El repetido lo corta el índice único `(poll_id, place_id)`, que ya existía:
      // sin fila devuelta = ese lugar ya estaba en la cancha.
      const [insertada] = await tx
        .insert(pollOptions)
        .values({
          pollId: poll.id,
          placeId,
          position: (ultima ?? -1) + 1,
          origin: 'voter',
          suggestedBy: voterToken,
          createdAt: ahora,
        })
        .onConflictDoNothing()
        .returning({ id: pollOptions.id })

      if (!insertada) {
        throw new ErrorVotacion('LUGAR_REPETIDO', 'Ese lugar ya está en la votación.')
      }

      return { ok: true as const, data: { optionId: insertada.id, placeId } }
    })
  } catch (error) {
    if (error instanceof ErrorVotacion) return fallo(error.code, error.mensaje)
    throw error
  }
}

/**
 * Quién pide quitar una opción. Son dos autorizados distintos y **ninguno de los
 * dos sale del payload**: el creador se identifica con su sesión y el que sugirió,
 * con la cookie que ya tiene.
 */
export type QuienQuita =
  | { tipo: 'creador'; userId: string }
  | { tipo: 'votante'; voterToken: string }

export type OpcionQuitada = { optionId: string; votosPerdidos: number }

/**
 * Quita una opción **sugerida** (decisión 8). Es el poder de moderación mínimo que
 * hace innecesaria la aprobación previa.
 *
 * - **El creador** puede quitar cualquier sugerencia, tenga votos o no. Borrarla
 *   **se lleva sus votos** por el cascade de `poll_votes.option_id`; por eso la UI
 *   avisa cuántos se pierden antes de confirmar y el resultado devuelve el número.
 * - **El que la sugirió** puede sacar la suya **solo mientras nadie la haya votado**
 *   (decisión 12): una vez que hay votos de otros, dejó de ser solo suya.
 *
 * Lo que **nadie** puede quitar es una opción original del creador (`origin =
 * 'creator'`): VOTACION no tiene edición de la shortlist y este spec no la agrega.
 *
 * Solo con la votación abierta: sobre una cerrada, borrar una opción cambiaría un
 * resultado ya publicado.
 */
export async function quitarOpcion(
  token: string,
  optionId: string,
  quien: QuienQuita,
): Promise<Resultado<OpcionQuitada>> {
  const [poll] = await db
    .select({
      id: polls.id,
      creatorId: polls.creatorId,
      status: polls.status,
      expiresAt: polls.expiresAt,
    })
    .from(polls)
    .where(eq(polls.token, token))
    .limit(1)

  if (!poll) return fallo('VOTACION_NO_ENCONTRADA', 'Esa votación no existe.')

  const ahora = new Date()
  if (!estaActiva(poll, ahora)) {
    return fallo('VOTACION_CERRADA', 'Esta votación ya cerró. No se puede cambiar la cancha.')
  }

  if (quien.tipo === 'creador' && poll.creatorId !== quien.userId) {
    return fallo('NO_AUTORIZADO', 'No podés gestionar esta votación.')
  }

  const [opcion] = await db
    .select({
      id: pollOptions.id,
      origin: pollOptions.origin,
      suggestedBy: pollOptions.suggestedBy,
    })
    .from(pollOptions)
    .where(and(eq(pollOptions.id, optionId), eq(pollOptions.pollId, poll.id)))
    .limit(1)

  if (!opcion) return fallo('OPCION_INVALIDA', 'Esa opción no es de esta votación.')

  if (opcion.origin !== 'voter') {
    return fallo(
      'OPCION_ORIGINAL',
      'Esa opción es parte de la votación original y no se puede quitar.',
    )
  }

  if (quien.tipo === 'votante' && opcion.suggestedBy !== quien.voterToken) {
    return fallo('NO_AUTORIZADO', 'Solo podés sacar los lugares que sumaste vos.')
  }

  const [{ votos }] = await db
    .select({ votos: sql<number>`count(*)::int` })
    .from(pollVotes)
    .where(eq(pollVotes.optionId, optionId))

  if (quien.tipo === 'votante' && votos > 0) {
    return fallo('OPCION_CON_VOTOS', 'Ese lugar ya tiene votos: no lo podés sacar.')
  }

  // Los votos se van con la opción (cascade). El votante que la había elegido
  // encuentra su voto vacío y puede votar de nuevo: la pantalla se lo dice, no se
  // le reasigna en silencio.
  await db.delete(pollOptions).where(eq(pollOptions.id, optionId))

  return { ok: true, data: { optionId, votosPerdidos: votos } }
}

/**
 * Abre o cierra las sugerencias de una votación propia (decisión 10). Es una
 * acción del creador más, con el mismo camino de autorización que cerrar/cancelar.
 * Cerrarlas **no toca lo ya sugerido**: apaga la puerta, no deshace lo que entró.
 */
export type SugerenciasCambiadas = { allowSuggestions: boolean }

export async function cambiarSugerencias(
  userId: string,
  token: string,
  allowSuggestions: boolean,
): Promise<Resultado<SugerenciasCambiadas>> {
  const cargada = await cargarPropia(userId, token)
  if (!cargada.ok) return cargada

  await db
    .update(polls)
    .set({ allowSuggestions })
    .where(eq(polls.id, cargada.poll.id))

  return { ok: true, data: { allowSuggestions } }
}

// ---------------------------------------------------------------------------
// Cerrar / cancelar — solo el creador (F3)
// ---------------------------------------------------------------------------

type PollDelCreador = {
  id: string
  creatorId: string
  status: 'open' | 'closed' | 'cancelled'
  winnerPlaceId: string | null
  closedAt: Date | null
}

/**
 * Carga una votación por token y verifica que sea del usuario (decisión 14/20:
 * solo el creador gestiona). Un token ajeno o inexistente devuelve el mismo error
 * —no se distingue "no existe" de "no es tuya"—.
 */
async function cargarPropia(
  userId: string,
  token: string,
): Promise<{ ok: true; poll: PollDelCreador } | { ok: false; code: string; message: string }> {
  const [poll] = await db
    .select({
      id: polls.id,
      creatorId: polls.creatorId,
      status: polls.status,
      winnerPlaceId: polls.winnerPlaceId,
      closedAt: polls.closedAt,
    })
    .from(polls)
    .where(eq(polls.token, token))
    .limit(1)

  if (!poll || poll.creatorId !== userId) {
    return fallo('NO_AUTORIZADO', 'No podés gestionar esta votación.')
  }
  return { ok: true, poll }
}

export type VotacionCerrada = { token: string; winnerPlaceId: string }

/**
 * Cierra la votación eligiendo el ganador (decisión 14). Cubre de un solo camino
 * el empate (decisión 4: desempata el creador) y el "ganó X pero elijo Y". El
 * `winnerPlaceId` tiene que ser una de las opciones.
 *
 * **Idempotente** (edge case): cerrar una ya cerrada devuelve su ganador actual,
 * sin re-elegir ni pisar `closed_at`. Cancelada no se puede cerrar.
 */
export async function cerrarVotacion(
  userId: string,
  token: string,
  winnerPlaceId: string,
): Promise<Resultado<VotacionCerrada>> {
  const cargada = await cargarPropia(userId, token)
  if (!cargada.ok) return cargada
  const { poll } = cargada

  if (poll.status === 'cancelled') {
    return fallo('YA_CANCELADA', 'Esa votación está cancelada.')
  }
  if (poll.status === 'closed') {
    // Idempotente: no re-elige ganador ni pisa closed_at.
    return { ok: true, data: { token, winnerPlaceId: poll.winnerPlaceId ?? winnerPlaceId } }
  }

  // El ganador tiene que ser una opción de ESTA votación.
  const [opcion] = await db
    .select({ id: pollOptions.id })
    .from(pollOptions)
    .where(and(eq(pollOptions.pollId, poll.id), eq(pollOptions.placeId, winnerPlaceId)))
    .limit(1)

  if (!opcion) return fallo('GANADOR_INVALIDO', 'El ganador tiene que ser uno de los lugares.')

  await db
    .update(polls)
    .set({ status: 'closed', winnerPlaceId, closedAt: new Date() })
    .where(and(eq(polls.id, poll.id), eq(polls.status, 'open')))

  return { ok: true, data: { token, winnerPlaceId } }
}

export type VotacionCancelada = { token: string }

/**
 * Cancela la votación (decisión 24): libera el cupo "1 activa" al instante sin
 * esperar la expiración. No se borra la fila —los votos ya emitidos son dato—; el
 * link pasa a solo-lectura "cancelada". Idempotente sobre una ya cancelada.
 */
export async function cancelarVotacion(
  userId: string,
  token: string,
): Promise<Resultado<VotacionCancelada>> {
  const cargada = await cargarPropia(userId, token)
  if (!cargada.ok) return cargada
  const { poll } = cargada

  if (poll.status === 'cancelled') return { ok: true, data: { token } }
  if (poll.status === 'closed') {
    return fallo('YA_CERRADA', 'Esa votación ya está cerrada.')
  }

  await db
    .update(polls)
    .set({ status: 'cancelled', closedAt: new Date() })
    .where(and(eq(polls.id, poll.id), eq(polls.status, 'open')))

  return { ok: true, data: { token } }
}
