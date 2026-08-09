import 'dotenv/config'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq, like } from 'drizzle-orm'
import { db } from '@/lib/db'
import { places } from '@/lib/db/schema'
import { getConfidenceThreshold } from '@/lib/db/settings'
import { SET_UPSERT_PLACES, camposFijadosQueCoinciden } from '../upsert'

/**
 * **La prueba de fuego de CORRECCION_DATOS** (DoD): un re-import con datos de
 * Overture distintos sobre un lugar con `locked_fields = {address,lat,lng}` deja
 * los tres intactos y **sí** actualiza todo lo demás.
 *
 * Se testea el `set` que usa el script, no el script: así la regla se verifica
 * contra la base **sin salir a S3** — mismo criterio que `import-dueno`.
 */

const PREFIJO = '__test_upsert_corr__'
const OVERTURE_ID = '__test_upsert_corr__ovt-1'

/** Lo que hace el script: el mismo insert, el mismo `set`. */
async function reimportar(fila: {
  name: string
  lat: number
  lng: number
  address: string | null
  locality: string | null
  phones: string[] | null
  overtureCategory: string | null
  confidence: number
}) {
  await db
    .insert(places)
    .values({ source: 'overture', overtureId: OVERTURE_ID, ...fila })
    .onConflictDoUpdate({ target: places.overtureId, set: SET_UPSERT_PLACES })
}

async function leer() {
  const [fila] = await db.select().from(places).where(eq(places.overtureId, OVERTURE_ID))
  return fila
}

let hayDb = true

async function limpiar() {
  await db.delete(places).where(like(places.name, `${PREFIJO}%`))
  await db.delete(places).where(eq(places.overtureId, OVERTURE_ID))
}

beforeAll(async () => {
  try {
    await getConfidenceThreshold()
  } catch {
    hayDb = false
    return
  }
  await limpiar()
})

afterAll(async () => {
  if (!hayDb) return
  await limpiar()
})

describe.runIf(process.env.DATABASE_URL)('el re-import y los campos corregidos a mano', () => {
  it('no pisa los campos fijados y sí actualiza el resto (decisión 4)', async () => {
    if (!hayDb) return

    // Estado inicial: el lugar ya corregido a mano.
    await db.insert(places).values({
      source: 'overture',
      overtureId: OVERTURE_ID,
      name: `${PREFIJO} Matienzo`,
      address: 'Av. Juan B. Justo 2959',
      locality: 'Buenos Aires',
      lat: -34.5921,
      lng: -58.4372,
      phones: ['11 0000 0000'],
      overtureCategory: 'bar',
      confidence: 0.5,
      lockedFields: ['address', 'lat', 'lng'],
    })

    // Lo que trae Overture: todo distinto, incluida la dirección vieja.
    await reimportar({
      name: `${PREFIJO} Matienzo`,
      address: 'Pringles 1249',
      locality: 'Villa Crespo',
      lat: -34.5973293,
      lng: -58.426251,
      phones: ['11 9999 9999'],
      overtureCategory: 'nightclub',
      confidence: 0.91,
    })

    const fila = await leer()

    // Los tres fijados, intactos.
    expect(fila.address).toBe('Av. Juan B. Justo 2959')
    expect(fila.lat).toBeCloseTo(-34.5921, 6)
    expect(fila.lng).toBeCloseTo(-58.4372, 6)

    // Todo lo demás, actualizado por Overture.
    expect(fila.phones).toEqual(['11 9999 9999'])
    expect(fila.confidence).toBeCloseTo(0.91, 5)
    expect(fila.overtureCategory).toBe('nightclub')
    // `locality` NO estaba fijado: sigue a Overture aunque sea de la misma familia.
    expect(fila.locality).toBe('Villa Crespo')
    // La marca sobrevive al import: el candado no se abre solo.
    expect([...fila.lockedFields].sort()).toEqual(['address', 'lat', 'lng'])
  })

  it('sin ningún campo fijado, Overture pisa todo como siempre', async () => {
    if (!hayDb) return

    await db
      .update(places)
      .set({ lockedFields: [] })
      .where(eq(places.overtureId, OVERTURE_ID))

    await reimportar({
      name: `${PREFIJO} Matienzo`,
      address: 'Pringles 1249',
      locality: 'Villa Crespo',
      lat: -34.5973293,
      lng: -58.426251,
      phones: ['11 9999 9999'],
      overtureCategory: 'nightclub',
      confidence: 0.91,
    })

    const fila = await leer()
    expect(fila.address).toBe('Pringles 1249')
    expect(fila.lat).toBeCloseTo(-34.5973293, 6)
  })
})

describe('camposFijadosQueCoinciden — el reporte de la decisión 10', () => {
  const fijada = {
    overtureId: 'ovt-1',
    name: 'Matienzo',
    address: 'Av. Juan B. Justo 2959',
    locality: 'Buenos Aires',
    lat: -34.5921,
    lng: -58.4372,
    lockedFields: ['address', 'lat', 'lng'],
  }

  it('lista solo los fijados que Overture ya trae iguales', () => {
    const coinciden = camposFijadosQueCoinciden(fijada, {
      name: 'Otro nombre',
      address: 'Av. Juan B. Justo 2959',
      locality: 'Villa Crespo',
      lat: -34.5973293,
      lng: -58.426251,
    })
    // `address` coincide; `lat`/`lng` no. `name` y `locality` no están fijados.
    expect(coinciden).toEqual(['address'])
  })

  it('no reporta nada si Overture sigue trayendo el dato viejo', () => {
    const coinciden = camposFijadosQueCoinciden(fijada, {
      name: 'Matienzo',
      address: 'Pringles 1249',
      locality: 'Buenos Aires',
      lat: -34.5973293,
      lng: -58.426251,
    })
    expect(coinciden).toEqual([])
  })
})
