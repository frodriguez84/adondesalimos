import { DIAS, esHoraValida, minutosDe, partesEnAR } from '@/lib/negocio/horarios'

/**
 * Rotación de los chips de Ocasión por día y hora (CHIPS_ROTACION).
 *
 * **Dueño único de "qué chip va primero" (decisión 5).** Puro: no toca la base ni
 * React — `lib/search/chips.ts` lee el setting y le pasa el resultado. Se testea
 * con una tabla de (día, hora) → orden esperado, igual que `horarios.ts`.
 *
 * El día y la hora en AR **no se recalculan acá**: salen de `partesEnAR`
 * (`lib/negocio/horarios.ts`), que ya es el dueño de ese cómputo (decisión 4), y
 * el formato `hh:mm` se valida con el `esHoraValida` de ese mismo módulo.
 *
 * **La home no puede romperse por un UPDATE mal tipeado** (decisión 6): el
 * setting es `jsonb` editado a mano con SQL, así que todo lo que entra se valida
 * regla por regla y lo inválido se descarta solo, sin invalidar a las buenas.
 */

/** La clave de `app_settings` con las reglas (decisión 1). */
export const CHIPS_SCHEDULE_KEY = 'chips.schedule'

/**
 * Una regla. `dias` usa la convención del proyecto **0 = lunes** (`DIAS`), no la
 * de JS; `primero` son slugs de `occasion_chips`.
 */
export type ReglaRotacion = {
  dias: number[]
  desde: string
  hasta: string
  primero: string[]
}

/**
 * La semilla (decisión 9). **Primera aproximación explícita**: son tres reglas de
 * sentido común, a afinar con datos de uso reales (`place_tag_impressions_daily`)
 * — eso es lo que el BACKLOG pedía y lo que las convierte en curaduría con
 * evidencia. El `onConflictDoNothing` del seed no pisa un valor editado a mano.
 *
 * «Merienda del finde» es la única que se *ve* hoy: `merienda` tiene
 * `in_home = false` y vive detrás de "Ver más", mientras que `after-office` y
 * `salir-a-bailar` ya están entre los 4 de la home a toda hora (decisión 11). Va
 * solo sábado y domingo para no pisarse con After office entre semana —gana la
 * primera regla que matchea—.
 */
export const DEFAULT_CHIPS_SCHEDULE: ReglaRotacion[] = [
  { dias: [0, 1, 2, 3, 4], desde: '17:00', hasta: '21:00', primero: ['after-office'] },
  { dias: [4, 5], desde: '22:00', hasta: '05:00', primero: ['salir-a-bailar'] },
  { dias: [5, 6], desde: '16:00', hasta: '19:00', primero: ['merienda'] },
]

/** Se avisa una vez por proceso, no por request (decisión 6). */
let yaAviso = false

function avisar(motivo: string): void {
  if (yaAviso) return
  yaAviso = true
  console.warn(`[chips.schedule] setting inválido, se ignora lo que no valida: ${motivo}`)
}

/** Solo para los tests: vuelve a habilitar el aviso de arriba. */
export function resetAvisoRotacion(): void {
  yaAviso = false
}

function esReglaValida(raw: unknown): raw is ReglaRotacion {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false
  const r = raw as Record<string, unknown>
  if (!Array.isArray(r.dias) || r.dias.length === 0) return false
  if (!r.dias.every((d) => Number.isInteger(d) && (d as number) >= 0 && (d as number) < DIAS.length))
    return false
  if (typeof r.desde !== 'string' || !esHoraValida(r.desde)) return false
  if (typeof r.hasta !== 'string' || !esHoraValida(r.hasta)) return false
  if (!Array.isArray(r.primero) || r.primero.length === 0) return false
  if (!r.primero.every((s) => typeof s === 'string' && s.length > 0)) return false
  return true
}

/**
 * Lo que vino del `jsonb` → reglas usables. **Regla por regla**: una mal escrita
 * entre dos buenas se descarta sola. Un valor ausente (`null`) no es un error —
 * es el caso normal y no loguea nada (DoD: sin `chips.schedule` la home se
 * comporta exactamente como hoy).
 *
 * Los slugs no se validan contra la base a propósito: este módulo es puro, y un
 * slug que no existe se ignora solo al cruzarlo con los chips vivos (decisión 7).
 */
export function validarReglas(raw: unknown): ReglaRotacion[] {
  if (raw === null || raw === undefined) return []
  if (!Array.isArray(raw)) {
    avisar('el valor no es un array de reglas')
    return []
  }
  const validas = raw.filter(esReglaValida)
  if (validas.length !== raw.length) {
    avisar(`${raw.length - validas.length} de ${raw.length} reglas mal formadas`)
  }
  return validas.map((r) => ({
    dias: [...r.dias],
    desde: r.desde,
    hasta: r.hasta,
    // Un slug repetido en la misma regla no puede duplicar un chip en la home.
    primero: [...new Set(r.primero)],
  }))
}

/**
 * ¿La regla cubre este instante? Un rango cuyo `hasta` es **menor o igual** que
 * el `desde` cruza la medianoche y pertenece al día en que empieza (decisión 3):
 * "viernes 22:00–05:00" es *la noche del viernes*, así que a las 01:00 del sábado
 * hay que mirar también las reglas del viernes. Misma semántica —y mismo motivo—
 * que `estaAbierto` en `horarios.ts`.
 *
 * Caso borde de esa regla: `desde === hasta` cubre las 24 h del día listado.
 */
function matchea(r: ReglaRotacion, dia: number, minutos: number): boolean {
  const desde = minutosDe(r.desde)
  const hasta = minutosDe(r.hasta)

  if (desde < hasta) return r.dias.includes(dia) && minutos >= desde && minutos < hasta

  // Cruza la medianoche. Tramo de esta misma noche: de `desde` a las 24 h…
  if (r.dias.includes(dia) && minutos >= desde) return true
  // …y la madrugada de hoy, que pertenece a la regla que arrancó **ayer**.
  return r.dias.includes((dia + DIAS.length - 1) % DIAS.length) && minutos < hasta
}

/**
 * Los slugs que van adelante en `now` (hora de AR). **Gana la primera regla que
 * matchea** (decisión 2): el orden del array es la prioridad, y una regla más
 * específica se pone arriba. Sin reglas aplicables devuelve `[]` y la home queda
 * con su orden por `sort`.
 */
export function chipsPrimero(reglas: ReglaRotacion[], now: Date): string[] {
  const { dia, minutos } = partesEnAR(now)
  const regla = reglas.find((r) => matchea(r, dia, minutos))
  return regla ? regla.primero : []
}
