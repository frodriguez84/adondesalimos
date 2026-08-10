import { asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { chipTags, occasionChips, tags } from '@/lib/db/schema'
import { getSetting } from '@/lib/db/settings'
import { franjaActual, NOMBRE_AHORA, SLUG_AHORA } from './ahora'
import { EMPTY_SEARCH } from './params'
import { chipsPintados } from './pintado'
import { countPlaces } from './query'
import {
  CHIPS_SCHEDULE_KEY,
  chipsFueraDeVentana,
  chipsPrimero,
  validarReglas,
} from './rotacion'

/**
 * Los chips de Ocasión que la home puede dibujar (F3 de BUSQUEDA).
 *
 * Server-only, igual que `catalog.ts`: lo llama el server component de `/` y
 * viaja al cliente como props. Tocar un chip no consulta nada — aplica sus tags
 * a la URL, que es el estado (decisión 12).
 *
 * **Un chip que devuelve 0 no se lista** (decisión 25). No es `active` —eso es
 * curaduría manual, apagar un chip a mano— sino un conteo en runtime: un chip se
 * prende **solo** cuando la curaduría o los dueños le llenan los tags, sin
 * deploy. Es el mismo criterio que `getFacetCatalog` aplica a los tags del sheet
 * (decisión 27), por el mismo motivo: ofrecer un atajo que devuelve 0 siempre es
 * mentir.
 *
 * El conteo es **contextual a la zona** (fix del 2026-08-10, enmienda explícita a
 * la decisión 25): sin zona elegida cuenta todo AMBA, con zona cuenta la zona.
 * La decisión 25 —*"el conteo es del catálogo, no del contexto"*— pasa a ser *"es
 * del catálogo mientras no haya contexto; cuando lo hay, es del contexto"*. Se
 * había escrito para que un chip no desapareciera por una búsqueda en curso, y lo
 * que la práctica mostró es que el atajo que miente es peor que el atajo que no
 * está: `salida-con-amigos`, **primero** en la home, daba 0 lugares en 16 de las
 * 46 zonas y 1 en la mediana de las demás. La decisión 23 (*el vacío rescata*)
 * sigue cubriendo el caso de 0, ahora como red y no como plan A.
 *
 * **El contexto son las zonas y nada más**: `q` y los tags ya activos NO entran en
 * el conteo. Cruzar el chip con los tags activos lo convertiría en un
 * refinamiento de la búsqueda en curso, que es otra feature. Y en **modo GPS se
 * cuenta AMBA**: las coordenadas no viajan en la URL —son del dispositivo que
 * mira, no del que compartió el link (`params.ts`)—, así que el server no tiene
 * contexto geográfico que aplicar; mejor el gate del catálogo que uno inventado.
 *
 * Sobre ese `> 0` hay **dos filtros más, y los dos son solo para la home**: el
 * piso (`PISO_HOME` sin zona, `PISO_ZONA` con zona) y la ventana horaria de `solo`
 * (`rotacion.ts`). Un chip que no los pasa sigue existiendo detrás de "Ver más" —
 * salvo el de ventana, que fuera de hora no se ve en ningún lado.
 *
 * **Excepción: un chip pintado se muestra siempre**, exento de los dos gates de
 * zona. Sin eso, tocar «Salida con amigos» en Palermo y cambiar a Retiro se lo
 * llevaría de la fila **con sus tags todavía aplicados**: el usuario pierde el
 * toggle para apagarlo (quedan removibles en `ChipsActivos`, pero el
 * `aria-pressed` desaparecido es una regresión del pintado). Qué está pintado lo
 * decide `lib/search/pintado.ts`, su dueño único — acá se lo **consulta**, no se
 * lo reimplementa.
 */

export type OccasionChipView = {
  slug: string
  name: string
  /** Tags que aplica. Van a la URL tal cual al tocarlo. */
  tags: string[]
  /**
   * Lugares publicados que devuelve hoy **en el contexto de la búsqueda**: todo
   * AMBA si no hay zona elegida, la zona si la hay. Siempre ≥ 1, salvo un chip
   * pintado, que se lista exento del gate (ver arriba) y puede traer 0.
   */
  count: number
}

export type OccasionChips = {
  /**
   * Lo que se ve sin abrir "ver más": el chip «Para ahora» (si su franja tiene
   * lugares) seguido de los 4 de Ocasión (decisión 6). Puede traer menos si no
   * hay 4 con datos.
   */
  home: OccasionChipView[]
  /** Los de "ver más". */
  resto: OccasionChipView[]
}

/** Cuántos chips **de Ocasión** entran en la home sin abrir "ver más" (decisión 6). */
export const CHIPS_EN_HOME = 4

/**
 * Mínimo de lugares en AMBA para ocupar uno de los 4 de la home **cuando no hay
 * zona elegida**. Con zona manda `PISO_ZONA` (abajo). **Es un piso distinto del
 * `> 0`** que habilita "Ver más": un chip con 1 lugar sigue existiendo, pero no
 * se gana la portada.
 *
 * El caso que lo motivó: `salida-con-chongo` daba **1** lugar en todo AMBA y
 * tiene `sort` 1, así que era el **segundo** chip de la home. Como la home pide
 * zona primero, en una zona concreta ese 1 es 0 casi siempre — el usuario tocaba
 * un atajo de la portada para caer en "sin resultados".
 *
 * Por qué 20: cuando se eligió (2026-08-03, 18.993 publicados) no había ningún
 * chip entre 2 y 37, así que 10 y 20 hacían exactamente lo mismo —dejaban afuera
 * a `salida-con-chongo` (1) y no tocaban al que le seguía, `salida-con-amigos`
 * (38)—. Ante dos números equivalentes ganó el más exigente, porque el problema
 * real es la división por zona. Bajarlo es cambiar esta constante.
 *
 * **Esa franja vacía ya no lo está**: al redefinir `salida-con-chongo`
 * (2026-08-10) pasó de 1 a **35**, o sea cae dentro de 2-37 y **pasa** este piso.
 * No volvió a la home igual, y por el motivo que este docstring anticipaba: con
 * 35 en AMBA da **0 en 18 de las 46 zonas** y a lo sumo 6 en la mejor, así que
 * quedaba tan expuesto como `salida-con-amigos`. Se lo dejó en "Ver más" con
 * `inHome: false` (`lib/db/chips.ts`) — una decisión de curaduría, no de este
 * piso.
 *
 * **La limitación que este docstring declaraba abierta —"el piso se cuenta sin
 * zona"— está cerrada** (fix del 2026-08-10): el conteo pasó a ser contextual y
 * el piso por zona es `PISO_ZONA`. Este 20 se queda como está y mide lo que
 * siempre midió: una propiedad del **catálogo**, no del contexto.
 */
export const PISO_HOME = 20

/**
 * Mínimo de lugares **en la zona elegida** para ocupar uno de los 4 de la home.
 * Reemplaza a `PISO_HOME` en cuanto hay zona; el gate de "Ver más" sigue siendo
 * `> 0`, contado también en la zona.
 *
 * **Por qué es otro número y no 20.** Los dos pisos responden preguntas
 * distintas. Sin zona, el conteo mide una propiedad del **catálogo**: *¿este chip
 * tiene espalda para ser un atajo de la portada?* — 20 es el umbral correcto para
 * eso. Con zona mide una propiedad del **contexto**: *¿este atajo devuelve algo
 * acá?* — y ahí 20 es absurdo, porque medido el 2026-08-10 (16 chips × 46 zonas)
 * **ningún chip de ocasión llega a 20 en ninguna zona**: aplicar 20 por zona
 * dejaría la portada con puros chips de Tipo (`cenar-afuera`, `tomar-algo`,
 * `un-cafe`), que es perder justo lo que un chip de ocasión aporta.
 *
 * **Por qué 3 y no `> 0` a secas**: lo que se reportó no fue una pantalla vacía,
 * fue **1 resultado** — que no dispara el copy de rescate de la decisión 23 y
 * deja una lista raquítica sin explicación. Con `> 0`, `salida-con-amigos`
 * (mediana **1** por zona) seguiría primero en la portada devolviendo un solo
 * lugar en media AMBA, que es el síntoma original. **3 es el mínimo que no se lee
 * como "esto está roto"**. Con 3, `after-office` (mediana 5) y `salir-a-bailar`
 * (mediana 10,5) conservan su lugar en la mayoría de las zonas. Subirlo a 5 es
 * cambiar esta constante.
 */
export const PISO_ZONA = 3

/**
 * `now` es un parámetro (y no `new Date()` adentro) para poder testear la franja
 * con un `Date` fijo. La hora se computa acá, en el server —lo llama el server
 * component de `/`— y el chip viaja como prop: el cliente no lee el reloj, así
 * que no hay riesgo de divergencia de hidratación (ABIERTO_AHORA decisión 10).
 *
 * `zones` es el contexto del conteo (vacío = todo AMBA) y `tagsActivos` es lo que
 * el usuario ya tiene puesto, del que sale qué chip está pintado. Los dos salen
 * de los `SearchParams` de la home y son opcionales para que un caller que no los
 * tenga siga viendo el comportamiento sin contexto, que es el de siempre.
 */
export async function getOccasionChips(
  now: Date = new Date(),
  zones: string[] = [],
  tagsActivos: string[] = [],
): Promise<OccasionChips> {
  const filas = await db
    .select({
      slug: occasionChips.slug,
      name: occasionChips.name,
      inHome: occasionChips.inHome,
      tag: tags.slug,
    })
    .from(occasionChips)
    .leftJoin(chipTags, eq(chipTags.chipId, occasionChips.id))
    .leftJoin(tags, eq(tags.id, chipTags.tagId))
    .where(eq(occasionChips.active, true))
    .orderBy(asc(occasionChips.sort))

  const porSlug = new Map<string, Omit<OccasionChipView, 'count'> & { inHome: boolean }>()
  for (const f of filas) {
    const actual = porSlug.get(f.slug)
    if (actual) {
      if (f.tag) actual.tags.push(f.tag)
      continue
    }
    porSlug.set(f.slug, {
      slug: f.slug,
      name: f.name,
      tags: f.tag ? [f.tag] : [],
      inHome: f.inHome,
    })
  }

  // El conteo sale de `countPlaces`, el mismo que usa el botón "Ver N lugares"
  // (F2), y no de una query propia. Se intentó lo contrario —una sola query que
  // contara los 17 chips de una— y fue **20× más lento**: 7,4 s contra 370 ms,
  // porque el "AND entre facetas" escrito de forma genérica obliga a Postgres a
  // correlacionar por lugar. Además de rápido, esto elimina la posibilidad de
  // que el número del chip y lo que devuelve tocarlo diverjan: es literalmente
  // la misma función. Es el mismo razonamiento que llevó a `construirWhere`.
  //
  // El conteo del chip «Para ahora» arranca acá, junto con los demás, para no
  // sumarle un round-trip en serie al render de la home. Mismo motivo para la
  // lectura de las reglas de rotación: se necesita recién al partir home/resto.
  //
  // El contexto (`zones`) entra en los 17 conteos que ya corrían en paralelo: no
  // suma round-trips y las queries quedan más chicas. El chip «Para ahora» no lo
  // lleva: su gate es la franja horaria, no la zona.
  const franja = franjaActual(now)
  const contarAhora = countPlaces({ ...EMPTY_SEARCH, tags: franja.tags })
  const leerReglas = getSetting<unknown>(CHIPS_SCHEDULE_KEY)

  const conConteo = await Promise.all(
    [...porSlug.values()].map(async (c) => ({
      ...c,
      count: await countPlaces({ ...EMPTY_SEARCH, zones, tags: c.tags }),
    })),
  )

  // El setting se lee en cada request a propósito (no se cachea en módulo): un
  // UPDATE tiene que cambiar la home sin reiniciar, igual que el umbral de
  // confidence.
  const reglas = validarReglas(await leerReglas)

  // Ventana horaria: un chip con `solo` en su regla no se ve fuera de ella, ni en
  // la home ni en "Ver más" (un after office un domingo a las 11 no existe). El
  // corte va acá, antes de repartir, para que un chip fuera de ventana tampoco
  // pueda colarse por el `primero` de otra regla.
  const fueraDeVentana = chipsFueraDeVentana(reglas, now)

  // La excepción del pintado, y **solo cuando hay zona**: sin contexto el gate es
  // el de siempre y exentar a alguien cambiaría el comportamiento de la primera
  // visita, que este fix no toca. Qué está pintado lo resuelve `pintado.ts` —
  // acá se lo consulta con la lista completa (home + "Ver más"), igual que hace
  // el cliente, porque un chip que tapa a otro no deja de contar por estar
  // detrás de "Ver más". La ventana horaria NO se exenta: es un gate del reloj,
  // no del contexto, y un after office un domingo a las 11 no existe ni pintado.
  const conZona = zones.length > 0
  const exentos = conZona ? chipsPintados(conConteo, tagsActivos) : new Set<string>()

  // Un chip sin tags no filtra nada: devolvería el catálogo entero, que es la
  // pantalla que la decisión 2 evita. Se descarta con los que dan 0.
  const vivos = conConteo.filter(
    (c) =>
      (c.count > 0 || exentos.has(c.slug)) && c.tags.length > 0 && !fueraDeVentana.has(c.slug),
  )

  // Decisión 6 (4 fijos en la home) + decisión 25 (los que dan 0 no se ven): la
  // home toma los primeros 4 **con datos** entre los marcados `in_home`. Sin
  // esto la home arrancaría con un chip, porque 3 de los 4 objetivo dan 0 hoy
  // (decisión 26). Los objetivo tienen `sort` menor, así que cuando la curaduría
  // los reviva vuelven solos a la home y desplazan a los V1 al "ver más".
  //
  // CHIPS_ROTACION: antes del corte, las reglas de `chips.schedule` adelantan
  // los chips que sirven a esta hora. Una regla puede traer uno con
  // `in_home = false` (decisión 11) —es lo único que hace la feature visible: los
  // 4 de la home ya incluyen los chips "de sentido común" a toda hora—, así que
  // `in_home` es el candidato **por defecto**, no el único posible.
  //
  // El piso se aplica acá, sobre los candidatos, y **también a los forzados por
  // la regla**: mismo criterio: si un chip no tiene espalda para la portada,
  // adelantarlo no se la da. Sigue estando en "Ver más", que solo pide `> 0`.
  //
  // Cuál de los dos pisos manda lo decide el contexto, no la hora: `PISO_ZONA`
  // en cuanto hay zona elegida, `PISO_HOME` si no (ver los docstrings de las dos
  // constantes: miden cosas distintas y por eso no comparten número).
  const piso = conZona ? PISO_ZONA : PISO_HOME
  const paraHome = vivos.filter((c) => c.count >= piso || exentos.has(c.slug))
  const adelante = chipsPrimero(reglas, now)
  const forzados = adelante
    .map((slug) => paraHome.find((c) => c.slug === slug))
    .filter((c) => c !== undefined)
  const yaAdelante = new Set(forzados.map((c) => c.slug))

  // Un chip nombrado en la regla que devuelve 0 no está en `vivos`, así que no
  // entra acá y **no deja hueco**: el siguiente `in_home` ocupa su lugar
  // (decisión 7 + decisión 25 de BUSQUEDA). Lo mismo el que no llega al piso.
  const candidatos = [...forzados, ...paraHome.filter((c) => c.inHome && !yaAdelante.has(c.slug))]
  const home = candidatos.slice(0, CHIPS_EN_HOME)
  const enHome = new Set(home.map((c) => c.slug))

  const limpiar = ({ slug, name, tags, count }: OccasionChipView): OccasionChipView => ({
    slug,
    name,
    tags,
    count,
  })

  // El chip «Para ahora» (ABIERTO_AHORA F1) va **al frente de la home**, con la
  // misma forma que cualquier chip: `OccasionChipsRow` ya renderiza `chip.tags`
  // de forma genérica, así que tocarlo escribe `?t=cena` en la URL como el
  // resto y no hace falta tocar ni el componente ni el motor (decisión 5).
  //
  // No sale de `occasion_chips`: sus tags **dependen de la hora** y `chip_tags`
  // es estática. Y no descuenta de los 4 de la decisión 6 —queda 1 + 4— porque
  // lo contrario sacaría un chip de Ocasión de la home a ciertas horas: una
  // regresión silenciosa de BUSQUEDA a cambio de nada.
  //
  // Se oculta si su franja da 0, por la decisión 25 y con el mismo `countPlaces`
  // que los demás (decisión 9): ofrecer un atajo que devuelve 0 es mentir.
  const countAhora = await contarAhora
  const chipAhora: OccasionChipView[] =
    countAhora > 0
      ? [{ slug: SLUG_AHORA, name: NOMBRE_AHORA, tags: franja.tags, count: countAhora }]
      : []

  return {
    home: [...chipAhora, ...home.map(limpiar)],
    resto: vivos.filter((c) => !enHome.has(c.slug)).map(limpiar),
  }
}
