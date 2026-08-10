import 'dotenv/config'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { chipTags, occasionChips, tags } from '@/lib/db/schema'
import type { ChipSeed } from '@/lib/db/chips'
import { sembrarChips } from '../seed-chips'

/**
 * Que **redefinir un chip y re-correr el seed alcance** — el camino que no existía
 * hasta el 2026-08-10 y que costó tener `salida-con-chongo` devolviendo 1 lugar en
 * vez de 35 en producción durante un día entero.
 *
 * El fixture es un chip propio (`__test-chip-*`), no uno real: la tabla tiene los 17
 * de verdad y el seed de producción no debe verse afectado por un test. Se le pasa a
 * `sembrarChips` su propia lista, así toca ese chip y ninguno más.
 */

const SLUG = '__test-chip-sync__'

/** Tags reales de la taxonomía: el seed valida que existan y si no, corta. */
const TAGS_INICIALES = ['bar', 'cafe']
const TAGS_REDEFINIDOS = ['bar', 'wine-bar', 'romantico']

const chip = (tagsDelChip: string[], extra: Partial<ChipSeed> = {}): ChipSeed => ({
  slug: SLUG,
  name: 'Chip de prueba',
  inHome: false,
  tags: tagsDelChip,
  ...extra,
})

let hayDb = true

async function slugsDelChip(): Promise<string[]> {
  const filas = await db
    .select({ slug: tags.slug })
    .from(chipTags)
    .innerJoin(occasionChips, eq(occasionChips.id, chipTags.chipId))
    .innerJoin(tags, eq(tags.id, chipTags.tagId))
    .where(eq(occasionChips.slug, SLUG))
  return filas.map((f) => f.slug).sort()
}

async function limpiar() {
  const [fila] = await db
    .select({ id: occasionChips.id })
    .from(occasionChips)
    .where(eq(occasionChips.slug, SLUG))
  if (fila) {
    await db.delete(chipTags).where(eq(chipTags.chipId, fila.id))
    await db.delete(occasionChips).where(eq(occasionChips.id, fila.id))
  }
}

beforeAll(async () => {
  try {
    await db.select({ n: sql`1` }).from(occasionChips).limit(1)
  } catch {
    hayDb = false
    return
  }
  await limpiar()
})

afterAll(async () => {
  if (hayDb) await limpiar()
})

describe.runIf(process.env.DATABASE_URL)('sembrarChips — sincronización de chip_tags', () => {
  it('siembra un chip nuevo con sus tags', async () => {
    const r = await sembrarChips([chip(TAGS_INICIALES)])
    expect(await slugsDelChip()).toEqual([...TAGS_INICIALES].sort())
    expect(r.resincronizados).toBe(1) // nació: es un cambio
  })

  it('es idempotente: re-sembrar lo mismo no toca una fila', async () => {
    const r = await sembrarChips([chip(TAGS_INICIALES)])
    expect(await slugsDelChip()).toEqual([...TAGS_INICIALES].sort())
    expect(r.resincronizados).toBe(0)
  })

  /**
   * EL test. Antes del 2026-08-10 esto fallaba: los tags viejos quedaban intactos
   * porque solo se insertaban `if (n === 0)`. Es el bug que llegó a producción.
   */
  it('redefinir los tags de un chip QUE YA EXISTE los reemplaza de verdad', async () => {
    const r = await sembrarChips([chip(TAGS_REDEFINIDOS)])
    expect(await slugsDelChip()).toEqual([...TAGS_REDEFINIDOS].sort())
    expect(r.resincronizados).toBe(1)

    // Y no quedan restos del set anterior: `cafe` estaba y ya no tiene que estar.
    expect(await slugsDelChip()).not.toContain('cafe')
  })

  it('actualiza name / in_home / sort, como ya hacía', async () => {
    await sembrarChips([chip(TAGS_REDEFINIDOS, { name: 'Renombrado', inHome: true })])
    const [fila] = await db
      .select({ name: occasionChips.name, inHome: occasionChips.inHome })
      .from(occasionChips)
      .where(eq(occasionChips.slug, SLUG))
    expect(fila.name).toBe('Renombrado')
    expect(fila.inHome).toBe(true)
  })

  it('NUNCA pisa `active`: es curaduría, no semilla', async () => {
    await db.update(occasionChips).set({ active: false }).where(eq(occasionChips.slug, SLUG))
    await sembrarChips([chip(TAGS_REDEFINIDOS)])
    const [fila] = await db
      .select({ active: occasionChips.active })
      .from(occasionChips)
      .where(eq(occasionChips.slug, SLUG))
    expect(fila.active).toBe(false)
  })

  it('un tag inexistente corta en vez de sembrar un chip que nunca devolvería nada', async () => {
    await expect(sembrarChips([chip(['no-existe-este-tag'])])).rejects.toThrow(
      /tag inexistente/,
    )
  })

  it('no toca los otros chips: la tabla real sigue completa', async () => {
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(occasionChips)
      .where(inArray(occasionChips.slug, ['salida-con-chongo', 'tomar-algo', 'cenar-afuera']))
    expect(n).toBe(3)
  })
})
