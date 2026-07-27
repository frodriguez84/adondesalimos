import 'dotenv/config'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { and, eq, inArray, like } from 'drizzle-orm'
import { db } from '@/lib/db'
import { placeTagSuggestions, placeTags, tags, places } from '@/lib/db/schema'
import { getConfidenceThreshold } from '@/lib/db/settings'
import { FACETAS_SUGERIBLES } from '../facetas'
import { guardarSugerencias } from '../suggestions'
import type { SugerenciaLLM } from '../sugeridor'

/**
 * Decisión 13 (corrida masiva autónoma): el batch, además de upsertear las
 * sugerencias, **auto-aplica** las que tienen evidencia a `place_tags`
 * (`source='admin'` + `accepted`); las sin evidencia quedan `pending`.
 *
 * Se testea `guardarSugerencias` (lo que usa el script) contra la DB local, sin
 * salir a Anthropic — la evidencia se pasa a mano.
 */

const PREFIJO = '__test_autoapply_cur__'
const MODEL = 'claude-sonnet-5'

let hayDb = true
let placeId = ''
let tagConEvi = 0
let tagSinEvi = 0

async function limpiar() {
  await db.delete(places).where(like(places.name, `${PREFIJO}%`))
}

async function tagsAdminDe(id: string): Promise<number[]> {
  const filas = await db
    .select({ tagId: placeTags.tagId })
    .from(placeTags)
    .where(and(eq(placeTags.placeId, id), eq(placeTags.source, 'admin')))
  return filas.map((f) => f.tagId).sort((a, b) => a - b)
}

async function estadoSug(id: string, tagId: number): Promise<string | null> {
  const [fila] = await db
    .select({ status: placeTagSuggestions.status })
    .from(placeTagSuggestions)
    .where(and(eq(placeTagSuggestions.placeId, id), eq(placeTagSuggestions.tagId, tagId)))
    .limit(1)
  return fila?.status ?? null
}

beforeAll(async () => {
  try {
    await getConfidenceThreshold()
  } catch {
    hayDb = false
    return
  }
  await limpiar()

  // Dos tags reales de las facetas sugeribles (Ambiente/Momento/Actividad).
  const disponibles = await db
    .select({ id: tags.id })
    .from(tags)
    .where(inArray(tags.facet, [...FACETAS_SUGERIBLES]))
    .limit(2)
  if (disponibles.length < 2) {
    hayDb = false
    return
  }
  tagConEvi = disponibles[0].id
  tagSinEvi = disponibles[1].id

  const [creado] = await db
    .insert(places)
    .values({ source: 'overture', name: `${PREFIJO} lugar`, lat: -34.6, lng: -58.4, confidence: 0.8 })
    .returning({ id: places.id })
  placeId = creado.id
})

afterAll(async () => {
  if (!hayDb) return
  await limpiar()
})

describe.runIf(process.env.DATABASE_URL)('auto-apply del batch (decisión 13)', () => {
  it('con evidencia → place_tags admin + accepted; sin evidencia → pending, place_tags intacta', async () => {
    if (!hayDb) return

    const sugerencias: SugerenciaLLM[] = [
      { tagId: tagConEvi, slug: 'con-evi', evidence: '2x1 de 18 a 20', sourceUrl: 'https://x.test' },
      { tagId: tagSinEvi, slug: 'sin-evi', evidence: null, sourceUrl: null },
    ]

    const res = await guardarSugerencias(placeId, sugerencias, MODEL)

    expect(res.nuevas).toBe(2)
    expect(res.autoAplicadas).toBe(1)

    // Con evidencia: escrita a place_tags como admin y la sugerencia accepted.
    expect(await tagsAdminDe(placeId)).toEqual([tagConEvi])
    expect(await estadoSug(placeId, tagConEvi)).toBe('accepted')

    // Sin evidencia: NO tocó place_tags y la sugerencia quedó pending.
    expect(await tagsAdminDe(placeId)).not.toContain(tagSinEvi)
    expect(await estadoSug(placeId, tagSinEvi)).toBe('pending')
  })

  it('re-correr no re-aplica ni pisa lo ya resuelto (idempotente)', async () => {
    if (!hayDb) return

    // Misma corrida otra vez: ambos pares ya existen → nada nuevo, nada se re-aplica.
    const sugerencias: SugerenciaLLM[] = [
      { tagId: tagConEvi, slug: 'con-evi', evidence: '2x1 de 18 a 20', sourceUrl: 'https://x.test' },
      { tagId: tagSinEvi, slug: 'sin-evi', evidence: null, sourceUrl: null },
    ]

    const res = await guardarSugerencias(placeId, sugerencias, MODEL)

    expect(res.nuevas).toBe(0)
    expect(res.autoAplicadas).toBe(0)
    // Estado idéntico al de antes: la aceptada sigue sola como admin, la otra pending.
    expect(await tagsAdminDe(placeId)).toEqual([tagConEvi])
    expect(await estadoSug(placeId, tagSinEvi)).toBe('pending')
  })
})
