import 'dotenv/config'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { appSettings, emailApiUsage, emailRecipientDaily } from '@/lib/db/schema'
import { getConfidenceThreshold } from '@/lib/db/settings'
import {
  CupoEmailError,
  EMAIL_DAILY_PER_RECIPIENT_KEY,
  EMAIL_MONTHLY_CAP_KEY,
  hashDestinatario,
  reservarEnvio,
} from '../cupo'

/**
 * `SEC-05` (c): Resend era el único proveedor externo sin contador ni tope, y a la
 * vez el único cuyo agotamiento **cierra el alta** en vez de degradar una pantalla.
 * Estos tests fijan los dos candados contra el Postgres local. No sale ningún mail:
 * se testea `reservarEnvio`, que es lo que corre antes de llamar a Resend.
 */

const EMAIL = '__test_cupo_mail__@qa.local'
const OTRO = '__test_cupo_mail_otro__@qa.local'
const MES = sql`to_char(current_date, 'YYYY-MM')`
const DIA = sql`current_date`

let hayDb = true
const settingsOriginales = new Map<string, unknown>()
/**
 * Conteo por SKU de `email_api_usage` del mes al arrancar. Se restaura al terminar:
 * es el contador **real** del mes y alimenta el tope, así que dejarlo inflado por una
 * corrida de tests le come cupo a los mails de verdad. (El test de cupo del chat
 * tiene la misma cicatriz anotada en `LECCIONES_APRENDIDAS`.)
 */
const usoOriginal = new Map<string, number>()

async function setSetting(key: string, value: unknown) {
  await db
    .insert(appSettings)
    .values({ key, value })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: sql`excluded.value` } })
}

async function snapshotSetting(key: string) {
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, key))
  settingsOriginales.set(key, row?.value ?? null)
}

/** Borra solo las filas de estos destinatarios: el contador del mes es el real. */
async function limpiarDestinatarios() {
  for (const email of [EMAIL, OTRO]) {
    await db
      .delete(emailRecipientDaily)
      .where(eq(emailRecipientDaily.recipientHash, hashDestinatario(email)))
  }
}

async function contadorDelDia(email: string, sku: string): Promise<number> {
  const [row] = await db
    .select({ count: emailRecipientDaily.count })
    .from(emailRecipientDaily)
    .where(
      and(
        sql`${emailRecipientDaily.day} = ${DIA}`,
        eq(emailRecipientDaily.recipientHash, hashDestinatario(email)),
        eq(emailRecipientDaily.sku, sku),
      ),
    )
  return row?.count ?? 0
}

async function totalDelMes(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`coalesce(sum(${emailApiUsage.count}), 0)::int` })
    .from(emailApiUsage)
    .where(sql`${emailApiUsage.month} = ${MES}`)
  return row?.n ?? 0
}

beforeAll(async () => {
  try {
    await getConfidenceThreshold()
  } catch {
    hayDb = false
    return
  }
  for (const k of [EMAIL_MONTHLY_CAP_KEY, EMAIL_DAILY_PER_RECIPIENT_KEY]) await snapshotSetting(k)

  const filas = await db
    .select({ sku: emailApiUsage.sku, count: emailApiUsage.count })
    .from(emailApiUsage)
    .where(sql`${emailApiUsage.month} = ${MES}`)
  for (const f of filas) usoOriginal.set(f.sku, f.count)
})

afterAll(async () => {
  if (!hayDb) return
  for (const [k, v] of settingsOriginales) {
    if (v !== null) await setSetting(k, v)
  }
  await limpiarDestinatarios()

  // El contador del mes vuelve a como estaba: los SKU que existían, a su valor; los
  // que nacieron en esta corrida, afuera.
  const filas = await db
    .select({ sku: emailApiUsage.sku })
    .from(emailApiUsage)
    .where(sql`${emailApiUsage.month} = ${MES}`)
  for (const { sku } of filas) {
    const previo = usoOriginal.get(sku)
    const donde = and(sql`${emailApiUsage.month} = ${MES}`, eq(emailApiUsage.sku, sku))
    if (previo === undefined) await db.delete(emailApiUsage).where(donde)
    else await db.update(emailApiUsage).set({ count: previo }).where(donde)
  }
})

beforeEach(async () => {
  if (!hayDb) return
  await limpiarDestinatarios()
  await setSetting(EMAIL_DAILY_PER_RECIPIENT_KEY, 3)
  // Tope global holgado sobre lo que ya haya contado el mes real, para que los
  // tests del candado por destinatario no choquen contra el candado global.
  await setSetting(EMAIL_MONTHLY_CAP_KEY, (await totalDelMes()) + 1000)
})

describe.runIf(process.env.DATABASE_URL)('cupo de mails (SEC-05)', () => {
  it('deja pasar hasta el tope diario del destinatario y después corta', async () => {
    if (!hayDb) return

    for (let i = 0; i < 3; i++) await reservarEnvio(EMAIL, 'verification')
    expect(await contadorDelDia(EMAIL, 'verification')).toBe(3)

    // El 4º reenvío al mismo buzón: es el vector de `send-verification-email`, que
    // no pide sesión.
    await expect(reservarEnvio(EMAIL, 'verification')).rejects.toMatchObject({
      code: 'DEMASIADOS_MAILS',
    })
    // El rechazo no incrementa: cortar no puede costar un lugar del cupo.
    expect(await contadorDelDia(EMAIL, 'verification')).toBe(3)
  })

  it('el tope es por tipo de mail: agotar la verificación no bloquea el reset', async () => {
    if (!hayDb) return

    for (let i = 0; i < 3; i++) await reservarEnvio(EMAIL, 'verification')
    await expect(reservarEnvio(EMAIL, 'verification')).rejects.toBeInstanceOf(CupoEmailError)

    // El que no puede entrar y pide un reset es justo el que no tiene otro camino.
    await expect(reservarEnvio(EMAIL, 'reset_password')).resolves.toBeUndefined()
    expect(await contadorDelDia(EMAIL, 'reset_password')).toBe(1)
  })

  it('el tope es por destinatario: uno agotado no afecta a otro', async () => {
    if (!hayDb) return

    for (let i = 0; i < 3; i++) await reservarEnvio(EMAIL, 'verification')
    await expect(reservarEnvio(OTRO, 'verification')).resolves.toBeUndefined()
  })

  it('el tope global en 0 es el kill switch: no sale ningún mail', async () => {
    if (!hayDb) return
    await setSetting(EMAIL_MONTHLY_CAP_KEY, 0)

    await expect(reservarEnvio(EMAIL, 'verification')).rejects.toMatchObject({
      code: 'EMAIL_PAUSADO',
    })
    expect(await contadorDelDia(EMAIL, 'verification')).toBe(0)
  })

  it('el tope global se mide sobre la SUMA de los SKU, no sobre uno solo', async () => {
    if (!hayDb) return
    // Un solo lugar libre en todo el mes: lo gasta el primer mail, del tipo que sea.
    await setSetting(EMAIL_MONTHLY_CAP_KEY, (await totalDelMes()) + 1)

    await reservarEnvio(EMAIL, 'verification')
    // Otro SKU y otro destinatario: la cuota del plan de Resend es una sola.
    await expect(reservarEnvio(OTRO, 'reset_password')).rejects.toMatchObject({
      code: 'EMAIL_PAUSADO',
    })
  })

  it('concurrencia: N reenvíos simultáneos no evaden el tope (FOR UPDATE)', async () => {
    if (!hayDb) return

    const intentos = 8
    const resultados = await Promise.allSettled(
      Array.from({ length: intentos }, () => reservarEnvio(EMAIL, 'verification')),
    )
    const ok = resultados.filter((r) => r.status === 'fulfilled').length

    // Es el caso real: un atacante no manda los reenvíos de a uno y esperando.
    expect(ok).toBe(3)
    expect(await contadorDelDia(EMAIL, 'verification')).toBe(3)
  })

  it('no guarda la dirección en claro, solo su hash', async () => {
    if (!hayDb) return
    await reservarEnvio(EMAIL, 'verification')

    const filas = await db
      .select({ hash: emailRecipientDaily.recipientHash })
      .from(emailRecipientDaily)
      .where(eq(emailRecipientDaily.recipientHash, hashDestinatario(EMAIL)))
    expect(filas).toHaveLength(1)
    expect(filas[0].hash).not.toContain('@')
    expect(filas[0].hash).toHaveLength(64)
  })

  it('el hash normaliza mayúsculas y espacios: es el mismo buzón', () => {
    expect(hashDestinatario('  Fer@Ejemplo.COM ')).toBe(hashDestinatario('fer@ejemplo.com'))
  })
})
