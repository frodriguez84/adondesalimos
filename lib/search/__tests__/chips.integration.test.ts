import 'dotenv/config'
import { describe, expect, it } from 'vitest'

import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { chipTags, occasionChips, tags } from '@/lib/db/schema'
import { CHIPS, CHIPS_OBJETIVO } from '@/lib/db/chips'
import { EMPTY_SEARCH } from '../params'
import { countPlaces, searchPlaces } from '../query'
import { CHIPS_EN_HOME, getOccasionChips } from '../chips'

/**
 * Los chips de Ocasión contra la base real.
 *
 * Lo que se verifica son **reglas**, no la foto de hoy. Que 8 de los 9 chips
 * objetivo devuelvan cero es un dato de este momento del catálogo (decisión 26),
 * no algo que deba seguir siendo cierto: un test que dijera "After office no
 * aparece" fallaría justo el día que la curaduría lo arregla, que es el día que
 * el producto mejora. Es la misma lectura que `catalog.integration.test.ts`.
 */

describe.runIf(process.env.DATABASE_URL)('chips de Ocasión', () => {
  it('tocar un chip listado devuelve lugares de verdad', async () => {
    // Lo que la decisión 25 promete: un chip que se ve no lleva a una pantalla
    // vacía. El conteo sale de `countPlaces` y la lista de `searchPlaces`, que
    // comparten `construirWhere` — esto verifica que esa promesa sobreviva al
    // recorrido completo, incluidos orden y paginación.
    const { home, resto } = await getOccasionChips()

    for (const chip of [...home, ...resto]) {
      const resultado = await searchPlaces({ ...EMPTY_SEARCH, tags: chip.tags })
      expect(resultado.places.length, `chip "${chip.slug}"`).toBeGreaterThan(0)
    }
  })

  it('no lista ningún chip que devuelva cero (decisión 25)', async () => {
    const { home, resto } = await getOccasionChips()
    const conCero = [...home, ...resto].filter((c) => c.count <= 0).map((c) => c.slug)
    expect(conCero).toEqual([])
  })

  it('la home no muestra más de 4 chips', async () => {
    const { home } = await getOccasionChips()
    expect(home.length).toBeLessThanOrEqual(CHIPS_EN_HOME)
  })

  it('la home y el "ver más" no repiten chips', async () => {
    const { home, resto } = await getOccasionChips()
    const slugs = [...home, ...resto].map((c) => c.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('todo chip listado trae al menos un tag', async () => {
    // Un chip sin tags no filtraría nada y devolvería el catálogo entero.
    const { home, resto } = await getOccasionChips()
    expect([...home, ...resto].every((c) => c.tags.length > 0)).toBe(true)
  })

  it('los 9 chips objetivo del spec están sembrados aunque hoy no se listen', async () => {
    // La decisión 26: la curaduría objetivo queda escrita en la base, apagada
    // por conteo y no por `active`, para que se prenda sola sin deploy.
    const { home, resto } = await getOccasionChips()
    const listados = new Set([...home, ...resto].map((c) => c.slug))

    for (const chip of CHIPS_OBJETIVO) {
      const n = await countPlaces({ ...EMPTY_SEARCH, tags: chip.tags })
      // Si tiene resultados tiene que estar listado, y si no, no. La foto de hoy
      // no se congela: solo se exige que las dos cosas sean coherentes.
      expect(listados.has(chip.slug), `chip objetivo "${chip.slug}" (${n} lugares)`).toBe(n > 0)
    }
  })

  it('los 17 chips de la semilla están en la tabla con sus tags', async () => {
    // El DoD pide los chips "sembrados en DB con sus tags". Los otros tests
    // miran lo que `getOccasionChips` devuelve, que oculta los que dan 0: esto
    // va directo a la tabla, que es donde el DoD dice que tienen que estar.
    const filas = await db
      .select({ slug: occasionChips.slug, tag: tags.slug })
      .from(occasionChips)
      .leftJoin(chipTags, eq(chipTags.chipId, occasionChips.id))
      .leftJoin(tags, eq(tags.id, chipTags.tagId))

    const tagsPorChip = new Map<string, Set<string>>()
    for (const f of filas) {
      if (!tagsPorChip.has(f.slug)) tagsPorChip.set(f.slug, new Set())
      if (f.tag) tagsPorChip.get(f.slug)!.add(f.tag)
    }

    for (const chip of CHIPS) {
      const enDb = tagsPorChip.get(chip.slug)
      expect(enDb, `chip "${chip.slug}" no está sembrado`).toBeDefined()
      expect([...enDb!].sort(), `tags del chip "${chip.slug}"`).toEqual([...chip.tags].sort())
    }
  })

  it('todos los tags de la semilla existen en la taxonomía', async () => {
    // Un typo en `chips.ts` produce un chip que jamás podría devolver nada. El
    // seed corta al sembrarlo; esto lo caza sin necesidad de correr el seed.
    const filas = await db.select({ slug: tags.slug }).from(tags)
    const existentes = new Set(filas.map((t) => t.slug))

    const inexistentes = CHIPS.flatMap((chip) =>
      chip.tags.filter((s) => !existentes.has(s)).map((s) => `${chip.slug} → ${s}`),
    )
    expect(inexistentes).toEqual([])
  })
})
