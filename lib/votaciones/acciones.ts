import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { getConfidenceThreshold } from '@/lib/db/settings'
import { pollOptions, pollVotes, polls, places, users } from '@/lib/db/schema'
import { publishedWhere } from '@/lib/db/visibility'
import type { Resultado } from '@/lib/claims/acciones'
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
