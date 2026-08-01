import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '@/lib/db'
import { places, premiumInterest, users } from '@/lib/db/schema'
import type { Resultado } from '@/lib/claims/acciones'
import { esDuenoDe } from '@/lib/claims/ownership'

/**
 * "Avisame cuando abra" — la señal que se mide mientras el cobro está apagado
 * (DEPLOY, decisión 6). Es lo que dispara prender el cobro y pagar Vercel Pro
 * (decisión 18), así que el contador tiene que ser honesto: un usuario, una fila.
 *
 * El dedupe **no** se hace acá con un SELECT previo: lo garantizan los dos
 * índices únicos parciales de `premium_interest` y el `onConflictDoNothing`. Un
 * doble click (o dos pestañas) no puede dejar dos filas.
 *
 * `place_id` sigue el criterio de `subscriptions`: `null` = B2C, con valor = B2B.
 */

/** Sin `placeId` es la señal B2C; con `placeId`, la del plan de ese lugar. */
export const registrarInteresSchema = z.object({
  placeId: z.uuid().optional(),
})

export type RegistrarInteresPayload = z.infer<typeof registrarInteresSchema>

export type InteresRegistrado = {
  /** `false` si ya lo había pedido antes: el panel muestra lo mismo igual. */
  nuevo: boolean
}

/**
 * Registra el interés. Para B2B exige ser **dueño aprobado** del lugar
 * (`esDuenoDe`, el mismo gate que el panel): sin eso, cualquiera con sesión podría
 * inflar el interés de un lugar ajeno, que es justo el número que decide un gasto.
 */
export async function registrarInteres(
  userId: string,
  payload: RegistrarInteresPayload,
): Promise<Resultado<InteresRegistrado>> {
  const placeId = payload.placeId ?? null

  if (placeId && !(await esDuenoDe(userId, placeId))) {
    return { ok: false, code: 'NO_ES_DUENO', message: 'Ese lugar no es tuyo.' }
  }

  const insertadas = await db
    .insert(premiumInterest)
    .values({ userId, placeId })
    .onConflictDoNothing()
    .returning({ id: premiumInterest.id })

  return { ok: true, data: { nuevo: insertadas.length > 0 } }
}

/** ¿Este usuario ya dejó la señal? Lo resuelven las pages para nacer confirmadas. */
export async function tieneInteres(userId: string, placeId?: string): Promise<boolean> {
  const [fila] = await db
    .select({ id: premiumInterest.id })
    .from(premiumInterest)
    .where(
      and(
        eq(premiumInterest.userId, userId),
        placeId ? eq(premiumInterest.placeId, placeId) : isNull(premiumInterest.placeId),
      ),
    )
    .limit(1)
  return fila !== undefined
}

export type InteresadoAdmin = {
  id: string
  email: string | null
  /** Nombre del lugar (B2B) o `null` (B2C premium). */
  lugar: string | null
  createdAt: Date
}

/**
 * Los interesados para `/admin` → Suscripciones (decisión 6). **Con los mails**:
 * la lista no es decoración, es a quién le escribe Fer a mano el día que se abra
 * el cobro. Sin ella el contador es un número sin acción.
 */
export async function getInteresadosAdmin(limite = 200): Promise<InteresadoAdmin[]> {
  return db
    .select({
      id: premiumInterest.id,
      email: users.email,
      lugar: places.name,
      createdAt: premiumInterest.createdAt,
    })
    .from(premiumInterest)
    .leftJoin(users, eq(users.id, premiumInterest.userId))
    .leftJoin(places, eq(places.id, premiumInterest.placeId))
    .orderBy(desc(premiumInterest.createdAt))
    .limit(limite)
}

/** El conteo, sin el techo del `limite` de la lista. */
export async function contarInteresados(): Promise<number> {
  const [fila] = await db.select({ total: sql<number>`count(*)::int` }).from(premiumInterest)
  return fila?.total ?? 0
}
