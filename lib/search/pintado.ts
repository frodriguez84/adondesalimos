/**
 * Qué chip de Ocasión **se ve prendido** y qué tags escribe **un toque** sobre él.
 *
 * Dueño único de esa regla (`CLAUDE.md` § Una regla, un dueño). Vivía dentro de
 * `components/search/occasion-chips.tsx`, que ahora es solo presentación: son
 * funciones puras de `(chips, tags)` y adentro del componente no se podían
 * testear — el precio se pagó con FB-02, que salió en dos vueltas, y con el bug
 * del 2026-08-09 que se llevó por delante a un chip que nadie tocó.
 *
 * Nada de acá toca la base ni el DOM: `lib/search/chips.ts` es server-only (arma
 * la lista y los conteos), esto es puro. Corre en los **dos** lados: en el
 * cliente para dibujar el `aria-pressed`, y en el server desde `chips.ts`, que
 * consulta `chipsPintados` para **exentar al chip pintado del gate por zona**
 * (fix del 2026-08-10). Si no lo exentara, cambiar de zona se llevaría de la fila
 * a un chip con sus tags todavía aplicados y el usuario perdería el toggle para
 * apagarlo. Esa excepción se apoya en este módulo justamente para no reimplementar
 * acá ni allá qué cuenta como "pintado".
 *
 * ## El pintado: subconjunto maximal (FB-02, decidido con Fer el 2026-08-08)
 *
 * Un chip se pinta si sus tags ⊆ los activos **y ningún otro chip prendido lo
 * contiene estrictamente**. Con "todos sus tags puestos" a secas, tocar «Primera
 * cita» (`bar, cafe, restaurante, tranqui, romantico`) prendía también «Cenar
 * afuera» (`restaurante`) y «Un café» (`cafe`), porque los contiene: se reportó
 * como "se prenden de a varios". Con maximal, toco uno y se prende uno; toco dos
 * incomparables («Cenar afuera» + «Un café») y se prenden los dos. La igualdad
 * estricta no servía: dejaría los dos primeros apagados.
 *
 * ## El toque: tres ramas, porque siempre hace lo que el chip muestra
 *
 * 1. **Se ve prendido ⇒ se apaga**, sacando sus tags —pero solo los que no estén
 *    sosteniendo a otro chip pintado (ver abajo).
 * 2. **Se ve apagado pero está tapado** (sus tags ya están todos puestos, dentro
 *    de los de otro chip): "agregarlos" no cambiaría nada (botón muerto) y
 *    "sacarlos" apagaba el que se tocó y prendía otro. Se **promueve**: se van
 *    los tags de los chips que lo contienen y quedan los suyos.
 * 3. **Apagado de verdad ⇒ se suman sus tags** a lo que ya había.
 *
 * ## Por qué apagar no saca todos los tags del chip (bug del 2026-08-09)
 *
 * Repro de Fer: «Tomar algo» + «Primera cita» prendidos, apagar «Tomar algo» ⇒ se
 * apagaba **«Primera cita»** y se prendían solos **«Cenar afuera»** y **«Un
 * café»**. Sacar todos los tags se llevaba `bar`, que también era de «Primera
 * cita»: sin él quedaba incompleta y se apagaba, y al apagarse dejaba de **tapar**
 * a los otros dos, cuyos tags seguían puestos. Tres cambios de un toque que pedía
 * apagar uno, y `bar` está en 7 de los 17 chips.
 *
 * La regla es `sacar = chip.tags − ⋃ tags(otros pintados)`: se va lo que era solo
 * suyo. Es la misma cortesía que la promoción ya hacía en el otro sentido.
 *
 * ## El límite que queda (lo destapó el barrido de las 289, no un usuario)
 *
 * Al **prender** no hay elección: sumar los tags del chip es lo que lo prende, y
 * la unión con lo que ya había puede **completar a un tercer chip**. Con los tags
 * reales, «Cumpleaños» + «Tomar algo» completa a «Salida con amigos»
 * (`bar, cerveceria, grupos-grandes`), que se prende sin que nadie lo toque — y
 * como contiene a «Tomar algo», el que se tocó queda tapado y se sigue viendo
 * apagado. Son 12 de 289 combinaciones, 1 con el tocado tapado.
 *
 * **No se puede arreglar acá**: mientras los tags sean el estado (decisión 18) y
 * el pintado se derive de ellos, ese chip está genuinamente entero y esconderlo
 * pediría romper uno de los dos que el usuario sí quiere.
 *
 * **Es decisión tomada, no deuda** (Fer, 2026-08-10): se evaluaron las cuatro
 * salidas y ninguna paga. Lo que las cierra a las dos más tentadoras es que
 * **estar tapado es la mecánica normal del pintado maximal, no la anomalía**: con
 * un solo chip tocado, **7 de los 17** estados limpios ya dejan alguno tapado
 * (`primera-cita` tapa a `cenar-afuera` y `un-cafe`, `after-office` a
 * `tomar-algo`, y así). Entonces (1) dibujar al tapado en un tercer estado
 * pintaría el camino feliz — volvería el "se prenden de a varios" de FB-02 —, y
 * distinguir "tapado normal" de "tapé al que acabás de tocar" exige saber qué
 * chip tocó el usuario; y (2) los tags no se pueden recurar para evitarlo, porque
 * `tomar-algo` está contenido en `salida-con-amigos` y en `after-office` **por
 * construcción**, y la curaduría los edita sin deploy. Queda solo llevar en la
 * URL qué chips tocó el usuario (`?c=`), que toca las decisiones 12 y 18, el back
 * y el link compartido para un parámetro que no cambia ni un resultado.
 *
 * Se reabre —y se va directo a `?c=`— si un usuario real lo reporta o si la
 * curaduría deja los dos chips de un caso juntos entre los 4 de la home. El
 * análisis entero, con los 12 casos y las cuatro opciones, está en el BACKLOG
 * § *Feedback posterior*.
 *
 * Lo que **no** hace, a propósito: no rescata a un chip que quedó *tapado*. Sigue
 * aplicado (sus tags están puestos) y se ve apagado; tocarlo lo promueve. Y un tag
 * que sobrevive sin representar ya a ningún chip queda **visible y removible uno
 * por uno en `ChipsActivos`** — los tags son el estado (decisión 18 de BUSQUEDA),
 * los chips son un atajo para escribirlos.
 */

/** Lo único que el pintado necesita de un chip. `OccasionChipView` lo cumple. */
export type ChipPintable = { slug: string; tags: string[] }

/** Todos sus tags están puestos. Con alguno suelto no lo está. */
function estaAplicado(tags: readonly string[], activos: ReadonlySet<string>): boolean {
  return tags.length > 0 && tags.every((t) => activos.has(t))
}

function contieneEstricto(mayor: readonly string[], menor: readonly string[]): boolean {
  return mayor.length > menor.length && menor.every((t) => mayor.includes(t))
}

/**
 * Los chips que se dibujan prendidos. Se mira contra **todos** los chips (home +
 * "ver más"), no solo los visibles: que el que tapa esté detrás de "Ver más" no lo
 * hace menos prendido.
 */
export function chipsPintados(
  chips: readonly ChipPintable[],
  tagsActivos: readonly string[],
): Set<string> {
  const activos = new Set(tagsActivos)
  const prendidos = chips.filter((c) => estaAplicado(c.tags, activos))
  return new Set(
    prendidos
      .filter((c) => !prendidos.some((otro) => contieneEstricto(otro.tags, c.tags)))
      .map((c) => c.slug),
  )
}

/** Los tags que quedan en la URL después de tocar `chip`. */
export function tagsAlTocar(
  chips: readonly ChipPintable[],
  tagsActivos: readonly string[],
  chip: ChipPintable,
): string[] {
  const activos = new Set(tagsActivos)
  const prendidos = chips.filter((c) => estaAplicado(c.tags, activos))
  const pintados = chipsPintados(chips, tagsActivos)

  // Se ve prendido ⇒ apagarlo, sacando solo lo que era **solo suyo**: un tag que
  // otro chip pintado también está usando no es suyo para llevarse.
  if (pintados.has(chip.slug)) {
    const deOtrosPintados = new Set(
      chips.filter((c) => c.slug !== chip.slug && pintados.has(c.slug)).flatMap((c) => c.tags),
    )
    const sacar = new Set(chip.tags.filter((t) => !deOtrosPintados.has(t)))
    return tagsActivos.filter((t) => !sacar.has(t))
  }

  // Se ve apagado pero está tapado ⇒ promoverlo: se van los tags de los chips que
  // lo contienen (menos los suyos, que se quedan) y prende él solo.
  if (estaAplicado(chip.tags, activos)) {
    const sobran = new Set(
      prendidos.filter((otro) => contieneEstricto(otro.tags, chip.tags)).flatMap((otro) => otro.tags),
    )
    for (const t of chip.tags) sobran.delete(t)
    return tagsActivos.filter((t) => !sobran.has(t))
  }

  // Apagado de verdad ⇒ sumar sus tags a lo que ya había.
  return [...new Set([...tagsActivos, ...chip.tags])]
}
