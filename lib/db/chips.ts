/**
 * Semilla de los chips de Ocasión (decisión 18 de BUSQUEDA).
 *
 * Mismo rol que `taxonomy.ts` para los tags: esto es **qué chips existen**; el
 * estado de la DB (cuáles están activos, cuáles tienen resultados hoy) se lee
 * con `lib/search/chips.ts`. La curaduría edita la tabla sin deploy — que es
 * exactamente lo que la decisión 18 buscaba.
 *
 * ## Por qué hay dos tandas
 *
 * La decisión 26 pedía recurar los chips contra datos reales antes de sembrar.
 * Medido el 2026-07-20 sobre los 18.993 publicados: **8 de los 9 chips objetivo
 * devuelven cero**, incluidos 3 de los 4 de la home. No es que estén mal
 * elegidos los tags: un chip de *ocasión* necesita las facetas Ambiente (0,9% de
 * cobertura), Momento (0,6%) y Precio (0%), que el import de Overture no llena.
 *
 * Así que se siembran las dos tandas:
 *
 *  - **OBJETIVO** — los 9 de la tabla del spec, tal cual. Hoy 8 dan 0 y la
 *    decisión 25 los oculta. Quedan escritos igual: cuando la curaduría o los
 *    dueños llenen Ambiente/Momento/Precio, se prenden **solos**, sin deploy.
 *  - **V1** — chips construidos solo con material que hoy tiene datos. Son los
 *    que hacen que la home tenga chips el día 1.
 *
 * ## La restricción estructural que limita lo que un chip puede ser
 *
 * `lib/overture/tag-map.ts` deriva los tags de la categoría de Overture, así
 * que **todo tag que no es de Tipo viene pegado a su Tipo por construcción**.
 * Medido: `aire-libre` solo convive con `cerveceria`, `wifi-trabajar` solo con
 * `cafe`, `desayuno` solo con `restaurante`, `merienda` solo con `cafe`. Las
 * únicas excepciones son `catas-degustaciones` (bar, cervecería, wine-bar) y
 * `tematico` (bar, restaurante).
 *
 * Con la semántica AND-entre-facetas de la decisión 13, eso significa que un
 * chip solo puede ser: una **unión dentro de una faceta**, o un Tipo cruzado con
 * **su propio** tag socio. Cruzar Tipo con cualquier otra Actividad/Ambiente da
 * cero: `cafe + aire-libre` = 0, `bar + aire-libre` = 0. Por eso los chips V1
 * son deliberadamente gruesos — es lo único que los datos de hoy sostienen.
 */

export type ChipSeed = {
  slug: string
  name: string
  /**
   * Candidato a la home. La home muestra los **primeros 4 que tengan
   * resultados** (ver `lib/search/chips.ts`): así la decisión 6 ("4 fijos") y la
   * 25 ("un chip que da 0 no se muestra") conviven sin que la home quede con un
   * hueco. Hay más de 4 marcados a propósito — los objetivo tienen `sort` menor,
   * así que el día que revivan desplazan solos a los V1 al "ver más".
   */
  inHome: boolean
  /** Slugs de `lib/db/taxonomy.ts`. OR dentro de faceta, AND entre facetas. */
  tags: string[]
}

/**
 * Los 9 de la tabla del spec. Nacieron con 8 en cero —intención registrada, no
 * curaduría vigente— y la corrida de CURADURIA F3 los despertó. Medidos sobre
 * los 18.993 publicados de AMBA (2026-08-02, ya sin `precio-2`): `salir-a-bailar`
 * 586 · `cumpleanos` 246 · `primera-cita` 187 · `merienda` 176 · `after-office`
 * 171 · `cena-familiar` 107 · `salida-con-amigos` 38 · `salida-con-chongo` 1 ·
 * `plan-tranqui` 0. En una zona concreta son uno o dos órdenes menos, que es
 * como se usan de verdad (la home pide zona primero).
 *
 * De `salir-a-bailar` conviene saber por qué anda: sus 575 `dj` + 11
 * `salsa-bachata` cubren *exactamente* los 586 `boliche`, así que la faceta
 * Actividad no filtra nada. En los hechos es un chip de un solo Tipo.
 *
 * **Regla general (INT2-01):** un chip que incluya un tag de la faceta Precio
 * está apagado de hecho. Precio tiene 1 lugar en todo el catálogo y no hay
 * fuente que la llene — OSM se midió y da cero para Precio, y la curaduría IA
 * tampoco lo asigna. No agregar `precio-*` a un chip hasta que eso cambie.
 */
export const CHIPS_OBJETIVO: readonly ChipSeed[] = [
  {
    slug: 'salida-con-amigos',
    name: 'Salida con amigos',
    inHome: true,
    // Sin `precio-2`: la faceta Precio tiene 1 lugar en 18.993 publicados y no
    // hay fuente que la llene (OSM se midió y da cero), así que un chip que la
    // exija está apagado para siempre — este daba 0 y no llegaba nunca a la home
    // pese a ser el `sort` 0 (INT2-01). Sin él quedan 38 lugares en AMBA.
    tags: ['bar', 'cerveceria', 'grupos-grandes'],
  },
  {
    slug: 'salida-con-chongo',
    name: 'Salida con chongo',
    inHome: true,
    tags: ['bar', 'wine-bar', 'romantico', 'hasta-tarde'],
  },
  {
    slug: 'salir-a-bailar',
    name: 'Salir a bailar',
    inHome: true,
    tags: ['boliche', 'dj', 'fiesta-tematica', 'salsa-bachata'],
  },
  {
    slug: 'after-office',
    name: 'After office',
    inHome: true,
    tags: ['bar', 'cerveceria', 'happy-hour'],
  },
  {
    slug: 'primera-cita',
    name: 'Primera cita',
    inHome: false,
    // Sin `precio-2`, mismo motivo que `salida-con-amigos`: con él daba 1 (el
    // único lugar de toda la faceta Precio), sin él da 187.
    tags: ['bar', 'cafe', 'restaurante', 'tranqui', 'romantico'],
  },
  {
    slug: 'cumpleanos',
    name: 'Cumpleaños',
    inHome: false,
    tags: ['bar', 'restaurante', 'patio-gastronomico', 'grupos-grandes', 'reserva-necesaria'],
  },
  {
    // Sin `bodegon`: es Cocina, su propia faceta, así que el motor lo cruza con
    // AND (achica) en vez de sumarlo al Tipo. Con `bodegon` el chip daba 0 sí o
    // sí (hallazgo CURADURIA F3). Queda restaurante + kids-friendly + cena.
    slug: 'cena-familiar',
    name: 'Cena familiar',
    inHome: false,
    tags: ['restaurante', 'kids-friendly', 'cena'],
  },
  {
    slug: 'plan-tranqui',
    name: 'Plan tranqui',
    inHome: false,
    tags: ['cafe', 'bar', 'tranqui', 'juegos-de-mesa'],
  },
  {
    // Sin `pasteleria`: es Cocina (0 lugares) y ANDea igual que `bodegon` arriba.
    // Queda cafe + merienda, que sí conviven (mismo Tipo) y prenden.
    slug: 'merienda',
    name: 'Merienda',
    inHome: false,
    tags: ['cafe', 'merienda'],
  },
]

/**
 * Chips V1 — construidos solo con tags que hoy tienen lugares publicados.
 * El número al lado de cada uno es lo que devolvía en AMBA al sembrarlos
 * (2026-07-20); en una zona concreta son uno o dos órdenes menos, que es como
 * se usan de verdad (la home pide zona primero, decisión 2).
 */
export const CHIPS_V1: readonly ChipSeed[] = [
  // Candidatos a home: los tres con volumen que sobreviven en cualquier zona.
  { slug: 'tomar-algo', name: 'Tomar algo', inHome: true, tags: ['bar', 'cerveceria'] }, // 3.219
  { slug: 'cenar-afuera', name: 'Cenar afuera', inHome: true, tags: ['restaurante'] }, // 11.438
  { slug: 'un-cafe', name: 'Un café', inHome: true, tags: ['cafe'] }, // 2.058
  // Detrás de "ver más".
  { slug: 'musica-en-vivo', name: 'Música en vivo', inHome: false, tags: ['musica-en-vivo'] }, // 882
  {
    slug: 'teatro-y-cultura',
    name: 'Teatro y cultura',
    inHome: false,
    tags: ['teatro', 'stand-up', 'proyecciones-cine'],
  }, // 595
  {
    slug: 'catas-y-vinos',
    name: 'Catas y vinos',
    inHome: false,
    tags: ['catas-degustaciones'],
  }, // 181
  {
    slug: 'jugar',
    name: 'Jugar',
    inHome: false,
    tags: ['arcade', 'bowling', 'karaoke', 'escape-room', 'pool-metegol-dardos'],
  }, // 135
  // `aire-libre` solo convive con `cerveceria`, así que el Tipo acá no achica:
  // está para que el chip siga significando algo si la curaduría lo despega.
  {
    slug: 'al-aire-libre',
    name: 'Al aire libre',
    inHome: false,
    tags: ['cerveceria', 'aire-libre'],
  }, // 99
]

/** Orden de siembra = `sort`. Los objetivo primero: ver `ChipSeed.inHome`. */
export const CHIPS: readonly ChipSeed[] = [...CHIPS_OBJETIVO, ...CHIPS_V1]

export const TOTAL_CHIPS = CHIPS.length
