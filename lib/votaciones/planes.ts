import { eq } from 'drizzle-orm'
import { db, type DbOrTx } from '@/lib/db'
import { users } from '@/lib/db/schema'

/**
 * ¿El usuario es premium? (VOTACION, decisión 17). Espejo B2C de `esDuenoDe`
 * (`lib/claims/ownership.ts`): **fuente única** del gate de plan del usuario.
 *
 * Se consulta **server-side siempre**, nunca viaja en la sesión (por eso no se
 * modeló con `additionalFields` de better-auth) — así "bajar el plan" es inmediato
 * y no espera a que el usuario refresque un token. Mismo principio que
 * `owner_plan`: subir un cupo es un regalo; bajarlo es una traición.
 *
 * Hasta el spec 7 (MercadoPago) `users.plan` solo cambia con un UPDATE a mano.
 */
export async function esPremium(userId: string, tx: DbOrTx = db): Promise<boolean> {
  const [fila] = await tx
    .select({ plan: users.plan })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  return fila?.plan === 'premium'
}
