import 'dotenv/config'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq, like } from 'drizzle-orm'
import { db } from '@/lib/db'
import { placeClaims, placeTags, places, tags, users } from '@/lib/db/schema'
import { getConfidenceThreshold } from '@/lib/db/settings'
import { placesConDuenoAprobado, reemplazarTagsDeImport } from '../ownership'

/**
 * Decisión 14: **el re-import no toca las tags de un lugar con reclamo
 * aprobado**. Sin esto, una tag que el dueño borró reaparece en el import
 * siguiente — el dueño aprobado es mejor fuente que Overture para SU lugar.
 *
 * Se testea la función que usa el script (`reemplazarTagsDeImport`), no el
 * script: así la regla se verifica sin salir a S3.
 */

const PREFIJO = '__test_import_dueno__'
const EMAIL = '__test_import_dueno__@ejemplo.com'

let hayDb = true
let conDueno = ''
let sinDueno = ''
let tagVieja = 0
let tagNueva = 0

async function limpiar() {
  await db.delete(places).where(like(places.name, `${PREFIJO}%`))
  await db.delete(users).where(like(users.email, `${PREFIJO}%`))
}

async function tagsDe(placeId: string): Promise<number[]> {
  const filas = await db
    .select({ tagId: placeTags.tagId })
    .from(placeTags)
    .where(eq(placeTags.placeId, placeId))
  return filas.map((f) => f.tagId).sort((a, b) => a - b)
}

beforeAll(async () => {
  try {
    await getConfidenceThreshold()
  } catch {
    hayDb = false
    return
  }
  await limpiar()

  const disponibles = await db.select({ id: tags.id }).from(tags).limit(2)
  if (disponibles.length < 2) {
    hayDb = false
    return
  }
  tagVieja = disponibles[0].id
  tagNueva = disponibles[1].id

  const [user] = await db
    .insert(users)
    .values({ email: EMAIL, name: 'Dueño', emailVerified: true })
    .returning({ id: users.id })

  const creados = await db
    .insert(places)
    .values([
      { source: 'overture', name: `${PREFIJO} con dueño`, lat: -34.6, lng: -58.4, confidence: 0.8 },
      { source: 'overture', name: `${PREFIJO} sin dueño`, lat: -34.6, lng: -58.4, confidence: 0.8 },
    ])
    .returning({ id: places.id, name: places.name })

  conDueno = creados.find((p) => p.name.endsWith('con dueño'))!.id
  sinDueno = creados.find((p) => p.name.endsWith('sin dueño'))!.id

  // Los dos arrancan con la misma tag de import.
  await db.insert(placeTags).values([
    { placeId: conDueno, tagId: tagVieja, source: 'import' },
    { placeId: sinDueno, tagId: tagVieja, source: 'import' },
  ])

  // Uno de los dos tiene dueño aprobado.
  await db.insert(placeClaims).values({
    placeId: conDueno,
    userId: user.id,
    kind: 'claim',
    status: 'approved',
    decidedAt: new Date(),
    decidedBy: 'admin@ejemplo.com',
  })
})

afterAll(async () => {
  if (!hayDb) return
  await limpiar()
})

describe.runIf(process.env.DATABASE_URL)('el re-import y el dueño', () => {
  it('reconoce qué lugares del lote tienen dueño aprobado', async () => {
    if (!hayDb) return
    const protegidos = await placesConDuenoAprobado([conDueno, sinDueno])
    expect(protegidos.has(conDueno)).toBe(true)
    expect(protegidos.has(sinDueno)).toBe(false)
  })

  it('reemplaza las tags del lugar sin dueño y no toca las del reclamado', async () => {
    if (!hayDb) return

    // Lo que haría un import nuevo: la categoría ahora mapea a otra tag.
    const { protegidos } = await reemplazarTagsDeImport(
      [conDueno, sinDueno],
      [
        { placeId: conDueno, tagId: tagNueva },
        { placeId: sinDueno, tagId: tagNueva },
      ],
    )

    expect(protegidos).toBe(1)
    // El reclamado conserva exactamente lo que tenía: ni pierde la vieja ni
    // gana la nueva. Es lo que hace que borrar una tag como dueño sea permanente.
    expect(await tagsDe(conDueno)).toEqual([tagVieja])
    // El otro sí sigue a Overture.
    expect(await tagsDe(sinDueno)).toEqual([tagNueva])
  })

  // CURADURIA (DoD): lo que acepta la cola queda con `source='admin'` y tiene que
  // sobrevivir a un re-import igual que lo del dueño — sin reclamo aprobado de por
  // medio. El re-import solo borra `source='import'`, así que la tag curada persiste.
  it('preserva una tag source=admin (curaduría) aunque el lugar no tenga dueño', async () => {
    if (!hayDb) return

    const [curado] = await db
      .insert(places)
      .values({ source: 'overture', name: `${PREFIJO} curado admin`, lat: -34.6, lng: -58.4, confidence: 0.8 })
      .returning({ id: places.id })

    // Estado inicial: una tag de import + una tag curada (admin), como tras aceptar
    // una sugerencia en la cola.
    await db.insert(placeTags).values([
      { placeId: curado.id, tagId: tagVieja, source: 'import' },
      { placeId: curado.id, tagId: tagNueva, source: 'admin' },
    ])

    // Re-import: la categoría ahora mapea a `tagVieja` de nuevo (da igual cuál).
    await reemplazarTagsDeImport([curado.id], [{ placeId: curado.id, tagId: tagVieja }])

    // La curada (admin) sigue; la de import se reemplazó pero volvió a entrar.
    expect(await tagsDe(curado.id)).toEqual([tagVieja, tagNueva].sort((a, b) => a - b))
  })
})
