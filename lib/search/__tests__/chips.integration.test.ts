import 'dotenv/config'
import { describe, expect, it } from 'vitest'

import { asc, eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { chipTags, occasionChips, tags, zones } from '@/lib/db/schema'
import { CHIPS, CHIPS_OBJETIVO } from '@/lib/db/chips'
import { getSetting } from '@/lib/db/settings'
import { EMPTY_SEARCH } from '../params'
import { countPlaces, searchPlaces } from '../query'
import { CHIPS_EN_HOME, getOccasionChips, PISO_HOME, PISO_ZONA } from '../chips'
import { FRANJAS, franjaActual, NOMBRE_AHORA, SLUG_AHORA } from '../ahora'
import {
  CHIPS_SCHEDULE_KEY,
  chipsFueraDeVentana,
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

/**
 * Martes 12:00 AR, el mismo instante fijo para todos los tests del conteo por
 * zona: con la ventana horaria de `solo`, un `now` variable haría que un chip se
 * liste o no según a qué hora se corra la suite.
 */
const AHORA = enAR(1, 12)

async function fueraDeVentanaEn(now: Date): Promise<Set<string>> {
  return chipsFueraDeVentana(validarReglas(await getSetting<unknown>(CHIPS_SCHEDULE_KEY)), now)
}

/** Los chips activos con sus tags, igual que los arma `getOccasionChips`. */
async function chipsActivos(): Promise<{ slug: string; tags: string[] }[]> {
  const filas = await db
    .select({ slug: occasionChips.slug, tag: tags.slug })
    .from(occasionChips)
    .leftJoin(chipTags, eq(chipTags.chipId, occasionChips.id))
    .leftJoin(tags, eq(tags.id, chipTags.tagId))
    .where(eq(occasionChips.active, true))

  const porSlug = new Map<string, string[]>()
  for (const f of filas) {
    if (!porSlug.has(f.slug)) porSlug.set(f.slug, [])
    if (f.tag) porSlug.get(f.slug)!.push(f.tag)
  }
  return [...porSlug].map(([slug, suyos]) => ({ slug, tags: suyos }))
}

/** Slugs de zona en orden estable, para que el recorrido no dependa del planner. */
async function zonasActivas(): Promise<string[]> {
  const filas = await db
    .select({ slug: zones.slug })
    .from(zones)
    .where(eq(zones.active, true))
    .orderBy(asc(zones.slug))
  return filas.map((z) => z.slug)
}

type CasoZona = { chip: { slug: string; tags: string[] }; zona: string; count: number }

let casos: Promise<{ cero?: CasoZona; flaca?: CasoZona }> | null = null

/**
 * Encuentra en la base los dos casos que el fix arregla: un chip que **sí** se
 * lista sin zona pero da **0** en alguna zona, y otro que ahí da 1-2.
 *
 * Se buscan en vez de hardcodearse porque la curaduría los mueve — y por eso se
 * exige `count(AMBA) > 0`: `plan-tranqui` da 0 en todas las zonas pero también en
 * AMBA, así que no prueba nada (no es el gate por zona el que lo oculta). Se
 * recorren zonas hasta tener los dos y se corta: con la matriz medida el
 * 2026-08-10 (`salida-con-amigos`, 0 en 16 de las 46 zonas y mediana 1) caen en
 * las primeras. El resultado se memoriza, que lo comparten cuatro tests.
 */
function casosDeZona(): Promise<{ cero?: CasoZona; flaca?: CasoZona }> {
  casos ??= (async () => {
    const fuera = await fueraDeVentanaEn(AHORA)
    const activos = (await chipsActivos()).filter((c) => c.tags.length > 0 && !fuera.has(c.slug))
    const enAmba = await Promise.all(
      activos.map(async (c) => [c, await countPlaces({ ...EMPTY_SEARCH, tags: c.tags })] as const),
    )
    const candidatos = enAmba.filter(([, n]) => n > 0).map(([c]) => c)

    let cero: CasoZona | undefined
    let flaca: CasoZona | undefined
    for (const zona of await zonasActivas()) {
      const cuentas = await Promise.all(
        candidatos.map(async (chip) => ({
          chip,
          zona,
          count: await countPlaces({ ...EMPTY_SEARCH, zones: [zona], tags: chip.tags }),
        })),
      )
      cero ??= cuentas.find((c) => c.count === 0)
      flaca ??= cuentas.find((c) => c.count > 0 && c.count < PISO_ZONA)
      if (cero && flaca) break
    }
    return { cero, flaca }
  })()
  return casos
}

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
    //
    // `now` es fijo (martes 12:00 AR) y no el reloj de la corrida: con la ventana
    // horaria, un chip con `solo` no se lista fuera de hora y el test pasaría o
    // no según a qué hora se corra. Se descuentan los restringidos a esa hora.
    const now = enAR(1, 12)
    const { home, resto } = await getOccasionChips(now)
    const listados = new Set([...home, ...resto].map((c) => c.slug))
    const fuera = chipsFueraDeVentana(
      validarReglas(await getSetting<unknown>(CHIPS_SCHEDULE_KEY)),
      now,
    )

    for (const chip of CHIPS_OBJETIVO) {
      const n = await countPlaces({ ...EMPTY_SEARCH, tags: chip.tags })
      // Si tiene resultados tiene que estar listado, y si no, no. La foto de hoy
      // no se congela: solo se exige que las dos cosas sean coherentes.
      expect(listados.has(chip.slug), `chip objetivo "${chip.slug}" (${n} lugares)`).toBe(
        n > 0 && !fuera.has(chip.slug),
      )
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

        // Un chip que no llega al piso tampoco se adelanta: el forzado respeta
        // `PISO_HOME` igual que un candidato `in_home`.
        const conCuenta = new Map([...home, ...resto].map((c) => [c.slug, c.count]))
        const esperados = chipsPrimero(reglas, now).filter(
          (s) => (conCuenta.get(s) ?? 0) >= PISO_HOME,
        )
        const ocasion = home.filter((c) => c.slug !== SLUG_AHORA).map((c) => c.slug)

        expect(ocasion.slice(0, esperados.length), `día ${dia} ${horaAR}:00 AR`).toEqual(esperados)
      }
    }
  })

  it('ningún chip de la home baja del piso de resultados', async () => {
    // El piso es de la home y solo de la home: "Ver más" sigue pidiendo `> 0`.
    // Verifica la regla, no la foto — el día que un chip flaco crezca, entra solo.
    for (let dia = 0; dia < 7; dia++) {
      for (const horaAR of [3, 12, 18, 23]) {
        const { home } = await getOccasionChips(enAR(dia, horaAR))
        for (const chip of home.filter((c) => c.slug !== SLUG_AHORA)) {
          expect(chip.count, `chip "${chip.slug}" en la home, día ${dia} ${horaAR}:00`).toBeGreaterThanOrEqual(
            PISO_HOME,
          )
        }
      }
    }
  })

  it('un chip con ventana no se ve fuera de ella, ni en la home ni en "Ver más"', async () => {
    // La capacidad inversa de `primero`: con `solo`, After office deja de estar
    // entre los 4 un domingo a las 11. Contra el setting real de la base.
    const reglas = validarReglas(await getSetting<unknown>(CHIPS_SCHEDULE_KEY))

    for (let dia = 0; dia < 7; dia++) {
      for (const horaAR of [1, 11, 18, 23]) {
        const now = enAR(dia, horaAR)
        const { home, resto } = await getOccasionChips(now)
        const listados = [...home, ...resto].map((c) => c.slug)
        const fuera = [...chipsFueraDeVentana(reglas, now)]

        expect(
          listados.filter((s) => fuera.includes(s)),
          `día ${dia} ${horaAR}:00 AR`,
        ).toEqual([])
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

  // ── El conteo contextual: los gates se miden en la zona elegida ────────────
  //
  // El fix del 2026-08-10 (ítem 🔵 del BACKLOG). Mismo criterio que el resto del
  // archivo: se verifican **reglas**, no la foto. Lo único que se congela es que
  // el caso siga existiendo —hay chips que dan 0 o 1-2 en alguna zona— porque un
  // test que no encuentra su caso pasa sin probar nada; si eso deja de ser
  // cierto, el mensaje del `expect` lo dice.

  it('con zona elegida, los dos gates se cuentan en la zona y no en AMBA', async () => {
    const fuera = await fueraDeVentanaEn(AHORA)
    const activos = (await chipsActivos()).filter((c) => c.tags.length > 0 && !fuera.has(c.slug))

    for (const zona of (await zonasActivas()).slice(0, 3)) {
      const { home, resto } = await getOccasionChips(AHORA, [zona])
      const enHome = new Set(home.filter((c) => c.slug !== SLUG_AHORA).map((c) => c.slug))
      const enResto = new Set(resto.map((c) => c.slug))
      const contados = new Map([...home, ...resto].map((c) => [c.slug, c.count]))

      for (const chip of activos) {
        const n = await countPlaces({ ...EMPTY_SEARCH, zones: [zona], tags: chip.tags })
        const rotulo = `chip "${chip.slug}" en "${zona}" (${n} en la zona)`

        // "Ver más" pide `> 0` y la portada `>= PISO_ZONA`, los dos contados en
        // la zona. Y el número que viaja al cliente es el de la zona: si fuera
        // el de AMBA, el chip diría 38 y devolvería 0.
        expect(contados.has(chip.slug), rotulo).toBe(n > 0)
        if (n > 0) expect(contados.get(chip.slug), rotulo).toBe(n)
        expect(enHome.has(chip.slug) || enResto.has(chip.slug), rotulo).toBe(n > 0)
        if (n < PISO_ZONA) expect(enHome.has(chip.slug), rotulo).toBe(false)
      }
    }
  })

  it('un chip que da 0 en la zona no se lista ni en la portada ni en "Ver más"', async () => {
    const { cero } = await casosDeZona()
    expect(
      cero,
      'ya no hay ningún chip que se liste en AMBA y dé 0 en alguna zona: el caso que motivó el fix desapareció del catálogo',
    ).toBeDefined()

    const { home, resto } = await getOccasionChips(AHORA, [cero!.zona])
    const listados = [...home, ...resto].map((c) => c.slug)
    expect(listados, `chip "${cero!.chip.slug}" en "${cero!.zona}"`).not.toContain(cero!.chip.slug)
  })

  it('un chip que da 1-2 en la zona sale de la portada pero sigue en "Ver más"', async () => {
    // El síntoma que reportó Fer no fue una pantalla vacía sino **un** resultado,
    // que no dispara el copy de rescate de la decisión 23. Por eso el gate de la
    // portada con zona es `>= PISO_ZONA` y no `> 0`.
    const { flaca } = await casosDeZona()
    expect(
      flaca,
      `ya no hay ningún chip que dé entre 1 y ${PISO_ZONA - 1} lugares en alguna zona`,
    ).toBeDefined()

    const { home, resto } = await getOccasionChips(AHORA, [flaca!.zona])
    const rotulo = `chip "${flaca!.chip.slug}" en "${flaca!.zona}" (${flaca!.count} en la zona)`
    expect(home.map((c) => c.slug), rotulo).not.toContain(flaca!.chip.slug)
    expect(resto.map((c) => c.slug), rotulo).toContain(flaca!.chip.slug)
  })

  it('un chip pintado se muestra aunque dé 0 en la zona', async () => {
    // Sin la excepción, cambiar de zona se lleva de la fila a un chip con sus
    // tags todavía aplicados: se pierde el toggle para apagarlo. La primera mitad
    // del test es el control —sin tags activos no se lista— y la segunda es la
    // excepción, con los mismos chip y zona.
    const { cero } = await casosDeZona()
    expect(cero, 'sin un chip que dé 0 en alguna zona no hay nada que exentar').toBeDefined()

    const sinPintar = await getOccasionChips(AHORA, [cero!.zona])
    expect([...sinPintar.home, ...sinPintar.resto].map((c) => c.slug)).not.toContain(
      cero!.chip.slug,
    )

    const pintado = await getOccasionChips(AHORA, [cero!.zona], cero!.chip.tags)
    const listados = [...pintado.home, ...pintado.resto]
    const encontrado = listados.find((c) => c.slug === cero!.chip.slug)
    expect(encontrado, `chip "${cero!.chip.slug}" pintado en "${cero!.zona}"`).toBeDefined()
    // Se muestra con lo que de verdad devuelve, no con el conteo de AMBA: el
    // chip está prendido y vacío, y esa es la información honesta.
    expect(encontrado!.count).toBe(0)
  })

  it('sin zona, los tags activos no cambian nada (la excepción es solo del gate por zona)', async () => {
    // El DoD del fix: sin contexto, el comportamiento es idéntico al de antes.
    // La exención del pintado está atada a que haya zona justamente para eso —
    // si no, un chip pintado por debajo de `PISO_HOME` entraría a la portada.
    const { cero } = await casosDeZona()
    const base = await getOccasionChips(AHORA)
    const conTags = await getOccasionChips(AHORA, [], cero?.chip.tags ?? ['bar'])
    expect(conTags).toEqual(base)
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
