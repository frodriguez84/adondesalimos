import 'dotenv/config'
import { describe, expect, it } from 'vitest'

import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { chipTags, occasionChips, tags } from '@/lib/db/schema'
import { CHIPS, CHIPS_OBJETIVO } from '@/lib/db/chips'
import { getSetting } from '@/lib/db/settings'
import { EMPTY_SEARCH } from '../params'
import { countPlaces, searchPlaces } from '../query'
import { CHIPS_EN_HOME, getOccasionChips } from '../chips'
import { FRANJAS, franjaActual, NOMBRE_AHORA, SLUG_AHORA } from '../ahora'
import {
  CHIPS_SCHEDULE_KEY,
  chipsPrimero,
  DEFAULT_CHIPS_SCHEDULE,
  validarReglas,
} from '../rotacion'

/** `hh:00` de AR del día de semana `dia` (2024-01-01 = lunes) → `Date` en UTC. */
function enAR(dia: number, hh: number): Date {
  const utc = hh + 3
  return new Date(Date.UTC(2024, 0, 1 + dia + (utc >= 24 ? 1 : 0), utc % 24, 0))
}

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

  it('la home no muestra más de 4 chips de Ocasión (más el de franja)', async () => {
    // `CHIPS_EN_HOME` cuenta chips de Ocasión. El chip «Para ahora» se antepone
    // sin descontar de esos 4 (ABIERTO_AHORA decisión 5), así que la home puede
    // llegar a 5 botones: 1 + 4.
    const { home } = await getOccasionChips()
    expect(home.filter((c) => c.slug !== SLUG_AHORA).length).toBeLessThanOrEqual(CHIPS_EN_HOME)
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

  it('el chip «Para ahora» va primero, con el rótulo y los tags de la franja', async () => {
    // 21:00 del lunes en AR (00:00Z del martes) ⇒ franja `cena` (decisión 3). El
    // chip se antepone a los de Ocasión y viaja con la forma de cualquier chip,
    // así que `OccasionChipsRow` lo pinta sin cambios (decisión 5).
    const now = new Date('2024-01-02T00:00:00Z')
    const { home } = await getOccasionChips(now)

    expect(home[0].slug).toBe(SLUG_AHORA)
    expect(home[0].name).toBe(NOMBRE_AHORA)
    expect(home[0].tags).toEqual(franjaActual(now).tags)
    expect(home[0].count).toBeGreaterThan(0)
    // Decisión 2: el rótulo no promete "abierto" en ninguna franja.
    expect(home[0].name.toLowerCase()).not.toContain('abierto')
  })

  it('el chip de franja aparece si y solo si su franja tiene lugares (decisión 9)', async () => {
    // Misma lectura que los chips objetivo: no se congela la foto de hoy, se
    // exige coherencia. Cubre AHORA-09 sin tocar datos — el día que una franja
    // se quede sin lugares publicados, el chip tiene que dejar de dibujarse.
    for (const franja of FRANJAS) {
      // El minuto de arranque de la franja, en AR: `desde` son minutos de AR y
      // AR = UTC−3, así que la hora UTC equivalente es `desde` + 3 h.
      const now = new Date(
        Date.UTC(2024, 0, 1, 3 + Math.floor(franja.desde / 60), franja.desde % 60),
      )
      const { home } = await getOccasionChips(now)
      const n = await countPlaces({ ...EMPTY_SEARCH, tags: franja.tags })

      const dibujado = home.some((c) => c.slug === SLUG_AHORA)
      expect(dibujado, `franja "${franja.slug}" (${n} lugares)`).toBe(n > 0)
      if (dibujado) expect(home[0].tags, `franja "${franja.slug}"`).toEqual(franja.tags)
    }
  })

  it('los tags de las franjas existen y están activos en la taxonomía', async () => {
    // Una franja que apunte a un tag retirado (como `abierto-ahora`, decisión 10)
    // o mal tipeado daría un chip que jamás devuelve nada.
    const filas = await db.select({ slug: tags.slug }).from(tags).where(eq(tags.active, true))
    const activos = new Set(filas.map((t) => t.slug))

    const rotos = FRANJAS.flatMap((f) =>
      f.tags.filter((s) => !activos.has(s)).map((s) => `${f.slug} → ${s}`),
    )
    expect(rotos).toEqual([])
  })

  it('los chips que la regla adelanta van al frente de la home (CHIPS_ROTACION)', async () => {
    // Contra el setting **real** de la base, no contra la semilla: es lo que la
    // home va a usar. Un slug que la regla nombra pero que hoy da 0 no está en
    // `vivos` y no puede exigirse — la decisión 7 dice justamente eso.
    const reglas = validarReglas(await getSetting<unknown>(CHIPS_SCHEDULE_KEY))

    // Un instante por día de la semana, a una hora donde alguna regla suele
    // matchear. 2024-01-01 fue lunes; AR = UTC−3.
    for (let dia = 0; dia < 7; dia++) {
      for (const horaAR of [1, 12, 18, 23]) {
        const now = enAR(dia, horaAR)
        const { home, resto } = await getOccasionChips(now)

        const vivos = new Set([...home, ...resto].map((c) => c.slug))
        const esperados = chipsPrimero(reglas, now).filter((s) => vivos.has(s))
        const ocasion = home.filter((c) => c.slug !== SLUG_AHORA).map((c) => c.slug)

        expect(ocasion.slice(0, esperados.length), `día ${dia} ${horaAR}:00 AR`).toEqual(esperados)
      }
    }
  })

  it('la rotación no deja huecos en la home a ninguna hora (decisión 7)', async () => {
    // Un chip nombrado en la regla que devuelve 0 no puede achicar la home: el
    // siguiente `in_home` ocupa su lugar. Verificable sin tocar datos — la
    // cantidad de chips de Ocasión tiene que ser la misma a cualquier hora.
    const cantidades = new Set<number>()
    for (let dia = 0; dia < 7; dia++) {
      for (const horaAR of [3, 10, 17, 22]) {
        const { home } = await getOccasionChips(enAR(dia, horaAR))
        cantidades.add(home.filter((c) => c.slug !== SLUG_AHORA).length)
      }
    }
    expect([...cantidades]).toHaveLength(1)
  })

  it('los slugs de las reglas semilla existen en `occasion_chips`', async () => {
    // Mismo criterio que el test de tags de la semilla: un typo en
    // `DEFAULT_CHIPS_SCHEDULE` daría una regla que no adelanta nada y nadie se
    // enteraría (se ignora en silencio por diseño, decisión 7).
    const filas = await db.select({ slug: occasionChips.slug }).from(occasionChips)
    const existentes = new Set(filas.map((c) => c.slug))

    const inexistentes = DEFAULT_CHIPS_SCHEDULE.flatMap((r) =>
      r.primero.filter((s) => !existentes.has(s)),
    )
    expect(inexistentes).toEqual([])
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
