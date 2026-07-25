import { db } from '@/lib/db'
import { subscriptions } from '@/lib/db/schema'
import { esDuenoDe } from '@/lib/claims/ownership'
import { getPrecioB2bArs, getPrecioB2cArs } from '@/lib/billing/settings'
import { createPreapproval, preapprovalStatusToDb } from '@/lib/billing/mercadopago'
import {
  activarFlagDelPlan,
  getSuscripcionViva,
  resolverFinDePeriodo,
} from '@/lib/billing/subscriptions'
import type { TipoSuscripcion } from '@/lib/billing/types'

/**
 * Alta de suscripción (MONETIZACION F2). El route es un adaptador fino: la sesión
 * la resuelve él y le pasa el `userId`; toda la lógica de cobro vive acá y es
 * testeable. El Brick ya tokenizó la tarjeta (`cardTokenId`); acá se valida el
 * monto (decisión 27), la propiedad B2B (decisión 2), se crea el preapproval sin
 * plan (decisión 10) y —si MP autoriza— se persiste la fila y se sube el flag en
 * la misma respuesta (decisión 9).
 */

export type EntradaCheckout = {
  userId: string
  cardTokenId: string
  payerEmail: string | null
  /** El monto que el Brick mostró; se compara con el precio vigente (decisión 27). */
  amountEsperado: number
} & ({ tipo: 'b2c' } | { tipo: 'b2b'; placeId: string })

export type ResultadoCheckout =
  | { ok: true; status: 'active'; httpStatus: 201 }
  | { ok: false; code: string; message: string; httpStatus: number }

const PRECIO_CAMBIO = {
  ok: false as const,
  code: 'PRECIO_CAMBIO',
  message: 'El precio cambió. Actualizá la página y volvé a intentar.',
  httpStatus: 409,
}

const YA_SUSCRIPTO = {
  ok: false as const,
  code: 'YA_SUSCRIPTO',
  message: 'Ya tenés una suscripción activa.',
  httpStatus: 409,
}

export async function crearSuscripcion(entrada: EntradaCheckout): Promise<ResultadoCheckout> {
  const placeId = entrada.tipo === 'b2b' ? entrada.placeId : null

  // Propiedad + reclamo aprobado (B2B): no se puede cobrar por un lugar ajeno (decisión 2).
  if (entrada.tipo === 'b2b') {
    const dueno = await esDuenoDe(entrada.userId, entrada.placeId)
    if (!dueno) {
      return {
        ok: false,
        code: 'NO_AUTORIZADO',
        message: 'No sos el dueño aprobado de este lugar.',
        httpStatus: 403,
      }
    }
  }

  // Precio vigente en DB (fuente única, decisión 5). El que cobra es este, no el
  // que mandó el cliente; el `amountEsperado` solo se valida (decisión 27).
  const precio =
    entrada.tipo === 'b2b' ? await getPrecioB2bArs() : await getPrecioB2cArs()
  if (entrada.amountEsperado !== precio) return PRECIO_CAMBIO

  // Corte temprano del doble-click / ya-suscripto (edge case). El índice único
  // parcial es la red final; esto da un 409 claro sin ir a MP.
  const yaViva =
    entrada.tipo === 'b2b'
      ? await getSuscripcionViva({ placeId: entrada.placeId })
      : await getSuscripcionViva({ userId: entrada.userId, placeId: null })
  if (yaViva) return YA_SUSCRIPTO

  // Crear el preapproval en MP. Un rechazo de tarjeta viene como error de la API
  // (throw con status/mpCode) — lo mapea el route al mensaje en español; acá no se
  // persiste nada, el plan sigue free (MONE-04).
  const preapproval = await createPreapproval({
    cardTokenId: entrada.cardTokenId,
    payerEmail: entrada.payerEmail ?? '',
    amountArs: precio,
    externalReference: entrada.userId,
  })

  const status = preapprovalStatusToDb(preapproval.status)
  const now = new Date()
  const periodEnd = resolverFinDePeriodo(now, preapproval.next_payment_date)

  try {
    await db.transaction(async (tx) => {
      const [fila] = await tx
        .insert(subscriptions)
        .values({
          userId: entrada.userId,
          placeId,
          status,
          mpPreapprovalId: preapproval.id,
          mpPayerEmail: entrada.payerEmail,
          amountArs: precio,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        })
        .returning()
      // El plan se activa solo si MP autorizó (decisión 9). Un preapproval
      // `pending` deja la fila persistida para que el webhook la complete, pero
      // sin subir el flag todavía.
      if (status === 'active') await activarFlagDelPlan(tx, fila, now)
    })
  } catch (err) {
    // Choque con el índice único parcial (carrera doble-click): ya hay una viva.
    if ((err as { code?: string }).code === '23505') return YA_SUSCRIPTO
    throw err
  }

  if (status !== 'active') {
    return {
      ok: false,
      code: 'PAGO_PENDIENTE',
      message: 'El pago quedó pendiente. Si se aprueba, tu plan se activa solo en unos minutos.',
      httpStatus: 402,
    }
  }

  return { ok: true, status: 'active', httpStatus: 201 }
}
