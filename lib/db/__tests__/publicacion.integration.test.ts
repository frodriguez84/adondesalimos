import 'dotenv/config'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { and, eq, like, sql } from 'drizzle-orm'
import { db } from '../index'
import { getConfidenceThreshold } from '../settings'
import { appSettings, places } from '../schema'
import { CONFIDENCE_THRESHOLD_KEY, publishedWhere } from '../visibility'

/**
 * Integración contra el Postgres local: verifica que el umbral se lee de
 * `app_settings` en RUNTIME — un UPDATE cambia el conteo de publicados sin
 * rebuild. Es la mitad de la regla que un test en memoria no puede probar.
 *
 * Los datos de prueba viven bajo un prefijo propio y se limpian al final.
 */

const PREFIJO = '__test_umbral__'
let hayDb = true
let umbralOriginal = 0.5

async function contarPublicados(umbral: number): Promise<number> {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(places)
    .where(and(like(places.name, `${PREFIJO}%`), publishedWhere(umbral)))
  return n
}

async function setUmbral(valor: number) {
  await db
    .update(appSettings)
    .set({ value: valor })
    .where(eq(appSettings.key, CONFIDENCE_THRESHOLD_KEY))
}

beforeAll(async () => {
  try {
    umbralOriginal = await getConfidenceThreshold()
  } catch {
    hayDb = false
    return
  }

  await db.delete(places).where(like(places.name, `${PREFIJO}%`))
  await db.insert(places).values([
    { source: 'overture', name: `${PREFIJO} alta`, lat: -34.6, lng: -58.4, confidence: 0.8 },
    { source: 'overture', name: `${PREFIJO} baja`, lat: -34.6, lng: -58.4, confidence: 0.3 },
    {
      source: 'overture',
      name: `${PREFIJO} baja con override`,
      lat: -34.6,
      lng: -58.4,
      confidence: 0.3,
      publishOverride: true,
    },
    {
      source: 'overture',
      name: `${PREFIJO} cerrada con override`,
      lat: -34.6,
      lng: -58.4,
      confidence: 0.9,
      publishOverride: true,
      operatingStatus: 'closed',
    },
    { source: 'owner', name: `${PREFIJO} dueño sin override`, lat: -34.6, lng: -58.4 },
  ])
})

afterAll(async () => {
  if (!hayDb) return
  await db.delete(places).where(like(places.name, `${PREFIJO}%`))
  await setUmbral(umbralOriginal)
})

describe.runIf(process.env.DATABASE_URL)('publicación contra la base', () => {
  it('lee el umbral de app_settings', async () => {
    if (!hayDb) return
    await setUmbral(0.5)
    expect(await getConfidenceThreshold()).toBe(0.5)
  })

  it('con umbral 0.5 publica la de confidence alta y la que tiene override', async () => {
    if (!hayDb) return
    await setUmbral(0.5)
    const umbral = await getConfidenceThreshold()
    // alta (0.8) + baja con override. La cerrada NO, aunque tenga override.
    // El lugar de dueño (confidence null) tampoco: no tiene override.
    expect(await contarPublicados(umbral)).toBe(2)
  })

  it('subir el umbral con un UPDATE baja el conteo sin rebuild, y volver lo restaura', async () => {
    if (!hayDb) return
    await setUmbral(0.5)
    const antes = await contarPublicados(await getConfidenceThreshold())

    await setUmbral(0.9)
    const despues = await contarPublicados(await getConfidenceThreshold())
    // La de 0.8 se cae; la que tiene override sobrevive al cambio de umbral.
    expect(despues).toBe(antes - 1)

    await setUmbral(0.5)
    expect(await contarPublicados(await getConfidenceThreshold())).toBe(antes)
  })

  it('bajar el umbral revive lugares que estaban invisibles (no se borran)', async () => {
    if (!hayDb) return
    await setUmbral(0.2)
    // Ahora entran alta, baja, baja con override. Sigue afuera la cerrada y la de dueño.
    expect(await contarPublicados(await getConfidenceThreshold())).toBe(3)
  })
})
