import { createHash } from 'node:crypto'
import { and, eq, sql } from 'drizzle-orm'
import { db, type DbOrTx } from '@/lib/db'
import { emailApiUsage, emailRecipientDaily } from '@/lib/db/schema'
import { getSetting } from '@/lib/db/settings'

/**
 * Cupo de mails transaccionales (`SEC-05`). **Dueño único** de la pregunta
 * "¿podemos mandar este mail?" — nadie más la responde, igual que `lib/ai/cupo.ts`
 * con el chat y `lib/google/settings.ts` con los topes de Google.
 *
 * Dos candados, y son distintos a propósito:
 *
 *  1. **Tope global del mes** (`email.monthly_cap` + `email_api_usage`): el kill
 *     switch. Protege la cuota del plan de Resend, que es **una sola y compartida**
 *     entre los cuatro mails — por eso se compara contra la SUMA del mes, no contra
 *     el contador de un SKU. Bajarlo a 0 apaga los mails sin deploy.
 *  2. **Tope por destinatario y por día** (`email.daily_per_recipient` +
 *     `email_recipient_daily`): protege el buzón de una persona. Cierra el vector de
 *     `POST /api/auth/send-verification-email`, que **no requiere sesión**: con un
 *     sign-up más N reenvíos se le mandaban N+1 mails a la misma dirección.
 *
 * El tope por destinatario es **por SKU**. Que un reenvío de verificación se coma el
 * presupuesto de un reset de contraseña sería peor que el abuso que evita: el que
 * pide un reset porque no puede entrar es justo el que no tiene otro camino. Y el
 * abuso que importa es repetir *el mismo* mail, que es lo que queda acotado.
 *
 * **Se incrementa ANTES de mandar** (mismo criterio que Google y la IA): si el envío
 * falla igual se cuenta. Contar de más gasta un lugar del cupo; contar de menos
 * gasta la cuota real sin registro.
 */

/** El mes y el día los pone Postgres, no el proceso (mismo criterio que `cupo.ts`). */
const MES = sql`to_char(current_date, 'YYYY-MM')`
const DIA = sql`current_date`

/** Un SKU por tipo de mail: sirve para ver en qué se va la cuota del plan. */
export type EmailSku = 'verification' | 'reset_password' | 'claim_approved' | 'claim_rejected'

/** Tope de mails del mes contando todos los SKU. 0 = kill switch. */
export const EMAIL_MONTHLY_CAP_KEY = 'email.monthly_cap'
/** Tope de mails del mismo tipo al mismo destinatario, por día. */
export const EMAIL_DAILY_PER_RECIPIENT_KEY = 'email.daily_per_recipient'

/**
 * Valores iniciales del seed. Solo fallbacks: la verdad vive en `app_settings`.
 *
 * El tope global nace en **2.500**, por debajo de los ~3.000/mes que `DEPLOY.md`
 * anota para el plan de Resend — la idea es que el gate avise antes de que el
 * proveedor empiece a rechazar, no después. ⚠️ Ese 3.000 sigue **sin verificar en
 * la consola de Resend**; cuando se confirme, este número se ajusta con un UPDATE.
 */
export const DEFAULT_EMAIL_MONTHLY_CAP = 2500
export const DEFAULT_EMAIL_DAILY_PER_RECIPIENT = 3

async function getNumber(key: string, fallback: number, database?: DbOrTx): Promise<number> {
  const value = await getSetting<number>(key, database)
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/** Tope global del mes vigente. 0 apaga todos los mails (kill switch). */
export function getEmailMonthlyCap(database?: DbOrTx): Promise<number> {
  return getNumber(EMAIL_MONTHLY_CAP_KEY, DEFAULT_EMAIL_MONTHLY_CAP, database)
}

/** Tope diario por destinatario y SKU vigente. */
export function getEmailDailyPerRecipient(database?: DbOrTx): Promise<number> {
  return getNumber(EMAIL_DAILY_PER_RECIPIENT_KEY, DEFAULT_EMAIL_DAILY_PER_RECIPIENT, database)
}

/**
 * SHA-256 del email normalizado. La tabla de cupo cuenta, no identifica: guardar la
 * dirección en claro convertiría un contador escrito por un endpoint anónimo en una
 * lista de direcciones probadas.
 *
 * Para mirar un caso puntual desde psql, el hash se recalcula con el mismo criterio:
 * `select encode(digest(lower(trim('x@y.com')), 'sha256'), 'hex')`.
 */
export function hashDestinatario(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex')
}

export type CupoEmailCode = 'EMAIL_PAUSADO' | 'DEMASIADOS_MAILS'

/** Señaliza por qué no se manda. Quien llama decide qué le muestra al usuario. */
export class CupoEmailError extends Error {
  constructor(readonly code: CupoEmailCode) {
    super(code)
    this.name = 'CupoEmailError'
  }
}

/**
 * Reserva un lugar del cupo para mandar `sku` a `email`. Tira `CupoEmailError` si no
 * hay lugar, y en ese caso **no incrementa nada**.
 *
 * TOCTOU-safe con el patrón de `lib/ai/cupo.ts` (cicatriz AUD-07 de StressPlan): una
 * sola TX, `insert … onConflictDoNothing` para asegurar la fila y `FOR UPDATE` para
 * lockearla. Sin eso, N reenvíos disparados a la vez leen todos el mismo contador y
 * pasan todos — que es exactamente lo que hace un atacante, no de a uno.
 *
 * Orden: tope global (es de sistema y su motivo tiene precedencia) → tope del
 * destinatario → los dos incrementos.
 */
export async function reservarEnvio(email: string, sku: EmailSku): Promise<void> {
  const hash = hashDestinatario(email)

  await db.transaction(async (tx) => {
    // 1. Tope global. Se asegura la fila del SKU y se lockea, así dos envíos
    // concurrentes no leen los dos el mismo total.
    const cap = await getEmailMonthlyCap(tx)
    await tx
      .insert(emailApiUsage)
      .values({ month: MES as unknown as string, sku, count: 0 })
      .onConflictDoNothing()
    await tx
      .select({ count: emailApiUsage.count })
      .from(emailApiUsage)
      .where(and(sql`${emailApiUsage.month} = ${MES}`, eq(emailApiUsage.sku, sku)))
      .for('update')

    // El tope es contra la suma del mes: la cuota de Resend no distingue SKU.
    const [total] = await tx
      .select({ n: sql<number>`coalesce(sum(${emailApiUsage.count}), 0)::int` })
      .from(emailApiUsage)
      .where(sql`${emailApiUsage.month} = ${MES}`)
    if (cap <= 0 || (total?.n ?? 0) >= cap) throw new CupoEmailError('EMAIL_PAUSADO')

    // 2. Tope del destinatario para este SKU, con FOR UPDATE sobre su fila del día.
    const porDia = await getEmailDailyPerRecipient(tx)
    await tx
      .insert(emailRecipientDaily)
      .values({ day: DIA as unknown as string, recipientHash: hash, sku, count: 0 })
      .onConflictDoNothing()
    const [delDia] = await tx
      .select({ count: emailRecipientDaily.count })
      .from(emailRecipientDaily)
      .where(
        and(
          sql`${emailRecipientDaily.day} = ${DIA}`,
          eq(emailRecipientDaily.recipientHash, hash),
          eq(emailRecipientDaily.sku, sku),
        ),
      )
      .for('update')
    if (porDia <= 0 || (delDia?.count ?? 0) >= porDia) {
      throw new CupoEmailError('DEMASIADOS_MAILS')
    }

    // 3. Los dos incrementos, antes de mandar.
    await tx
      .update(emailApiUsage)
      .set({ count: sql`${emailApiUsage.count} + 1` })
      .where(and(sql`${emailApiUsage.month} = ${MES}`, eq(emailApiUsage.sku, sku)))
    await tx
      .update(emailRecipientDaily)
      .set({ count: sql`${emailRecipientDaily.count} + 1` })
      .where(
        and(
          sql`${emailRecipientDaily.day} = ${DIA}`,
          eq(emailRecipientDaily.recipientHash, hash),
          eq(emailRecipientDaily.sku, sku),
        ),
      )
  })
}
