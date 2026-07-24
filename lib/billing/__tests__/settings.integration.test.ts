import 'dotenv/config'
import { and, eq, sql } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'

import { db } from '@/lib/db'
import { appSettings, appSettingsHistory } from '@/lib/db/schema'
import {
  PRECIO_B2C_ARS_KEY,
  editarPrecio,
  getPrecioB2cArs,
  getHistorialPrecios,
} from '../settings'

/**
 * El precio en DB editable desde `/admin` (MONETIZACION, decisiones 5, 25-26):
 * cambiar el valor rige sin deploy y queda auditado en `app_settings_history` con
 * quién y cuándo. Es la mitad de F1 que separa "gratis" de "se licúa en meses".
 */

const ADMIN_TEST = 'test-billing@qa.local'

describe.runIf(process.env.DATABASE_URL)('precios editables + historial', () => {
  // Se restaura el valor original y se borran las filas de historial del test:
  // el precio es dato de producto y no debe quedar pisado por el QA.
  let original: number | null = null

  afterEach(async () => {
    if (original !== null) {
      await db
        .insert(appSettings)
        .values({ key: PRECIO_B2C_ARS_KEY, value: original })
        .onConflictDoUpdate({ target: appSettings.key, set: { value: sql`excluded.value` } })
      original = null
    }
    await db.delete(appSettingsHistory).where(eq(appSettingsHistory.changedBy, ADMIN_TEST))
  })

  it('editar el precio lo cambia en runtime y registra el cambio', async () => {
    original = await getPrecioB2cArs()
    const nuevo = original + 123

    const res = await editarPrecio(PRECIO_B2C_ARS_KEY, nuevo, ADMIN_TEST)
    expect(res.ok).toBe(true)

    // Rige sin deploy: el getter que lee el checkout ya devuelve el nuevo valor.
    expect(await getPrecioB2cArs()).toBe(nuevo)

    // Quedó en el historial con quién y cuánto.
    const [fila] = await db
      .select({ value: appSettingsHistory.value, changedBy: appSettingsHistory.changedBy })
      .from(appSettingsHistory)
      .where(
        and(
          eq(appSettingsHistory.key, PRECIO_B2C_ARS_KEY),
          eq(appSettingsHistory.changedBy, ADMIN_TEST),
        ),
      )
    expect(Number(fila.value)).toBe(nuevo)
    expect(fila.changedBy).toBe(ADMIN_TEST)

    // Y aparece en el historial que pinta el panel.
    const historial = await getHistorialPrecios()
    expect(historial.some((h) => h.key === PRECIO_B2C_ARS_KEY && h.value === nuevo)).toBe(true)
  })

  it('rechaza una clave fuera de la allowlist sin escribir nada', async () => {
    const res = await editarPrecio('catalog.confidence_threshold', 0.9, ADMIN_TEST)
    expect(res).toMatchObject({ ok: false, code: 'INVALID_KEY' })

    const filas = await db
      .select({ id: appSettingsHistory.id })
      .from(appSettingsHistory)
      .where(eq(appSettingsHistory.changedBy, ADMIN_TEST))
    expect(filas).toHaveLength(0)
  })

  it('rechaza un monto no entero o <= 0', async () => {
    expect(await editarPrecio(PRECIO_B2C_ARS_KEY, 0, ADMIN_TEST)).toMatchObject({
      ok: false,
      code: 'INVALID_VALUE',
    })
    expect(await editarPrecio(PRECIO_B2C_ARS_KEY, 100.5, ADMIN_TEST)).toMatchObject({
      ok: false,
      code: 'INVALID_VALUE',
    })
    expect(await editarPrecio(PRECIO_B2C_ARS_KEY, -50, ADMIN_TEST)).toMatchObject({
      ok: false,
      code: 'INVALID_VALUE',
    })
  })
})
