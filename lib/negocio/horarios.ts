/**
 * Horarios propios del dueño (AUTH F4, decisión 20). Puro y sin DB ni React: es
 * la parte que tiene que estar bien —un rango que cruza la medianoche mal
 * calculado dice "cerrado" a las 01:30 en una app de salidas— así que se testea
 * con una tabla de horas sin montar la pantalla.
 *
 * **Modelo**: por día, una lista de rangos `hh:mm`. Un rango cuyo cierre es menor
 * o igual que la apertura **cruza la medianoche** y pertenece al día en que abre
 * (`20:00–02:00` es "de la noche del lunes"): por eso "¿abierto ahora?" a la 01:30
 * tiene que mirar también los rangos del día anterior.
 *
 * La zona horaria es fija `America/Argentina/Buenos_Aires` (decisión 20): el
 * estado abierto/cerrado no depende del reloj de quien mira la ficha.
 */

/** Los 7 días, empezando el lunes (convención local). Índice = día de la semana. */
export const DIAS = [
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
  'domingo',
] as const
export type Dia = (typeof DIAS)[number]

/** Rótulo con acentos y mayúscula para la ficha y el editor. */
export const NOMBRE_DIA: Record<Dia, string> = {
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sábado',
  domingo: 'Domingo',
}

/** Un tramo de apertura. `abre`/`cierra` son `hh:mm` en 24 h. */
export type RangoHorario = { abre: string; cierra: string }

/** La semana entera: cada día tiene 0 o más rangos. */
export type HorariosSemana = Record<Dia, RangoHorario[]>

const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/

/** `hh:mm` bien formado (00:00–23:59). El cliente no es boundary de seguridad. */
export function esHoraValida(v: string): boolean {
  return HORA_RE.test(v)
}

/** `hh:mm` → minutos desde medianoche (0–1439). Asume la hora ya validada. */
export function minutosDe(hhmm: string): number {
  const [h, m] = hhmm.split(':')
  return Number(h) * 60 + Number(m)
}

/** Una semana vacía (todos los días cerrados): la forma que espera el editor. */
export function semanaVacia(): HorariosSemana {
  return { lunes: [], martes: [], miercoles: [], jueves: [], viernes: [], sabado: [], domingo: [] }
}

/**
 * Coerce lo que vino del jsonb a una `HorariosSemana` completa (los 7 días
 * presentes), descartando basura. Defensivo: la columna es `jsonb` y una fila
 * vieja o manipulada no puede dejar `datos.horarios[dia]` en `undefined`.
 */
export function normalizarSemana(raw: unknown): HorariosSemana {
  const base = semanaVacia()
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    for (const dia of DIAS) {
      const v = obj[dia]
      if (Array.isArray(v)) {
        base[dia] = v.filter(
          (r): r is RangoHorario =>
            !!r &&
            typeof r === 'object' &&
            typeof (r as RangoHorario).abre === 'string' &&
            typeof (r as RangoHorario).cierra === 'string',
        )
      }
    }
  }
  return base
}

/** ¿El lugar tiene al menos un rango cargado? Decide si la ficha usa dueño o Google. */
export function tieneAlgunHorario(h: HorariosSemana | null | undefined): boolean {
  if (!h) return false
  return DIAS.some((d) => (h[d]?.length ?? 0) > 0)
}

/**
 * Dos rangos del mismo día se pisan. Cada rango se proyecta a una recta de 48 h
 * (uno que cruza la medianoche llega hasta `cierra + 24 h`), así el solapamiento
 * se detecta igual crucen o no. Se usa en la validación ("sin solapamientos
 * absurdos").
 */
export function haySolapamiento(rangos: RangoHorario[]): boolean {
  const ivs = rangos.map((r) => {
    const a = minutosDe(r.abre)
    let c = minutosDe(r.cierra)
    if (c <= a) c += 24 * 60
    return [a, c] as const
  })
  for (let i = 0; i < ivs.length; i++) {
    for (let j = i + 1; j < ivs.length; j++) {
      if (ivs[i][0] < ivs[j][1] && ivs[j][0] < ivs[i][1]) return true
    }
  }
  return false
}

// ---------------------------------------------------------------------------
// Abierto / cerrado en TZ AR
// ---------------------------------------------------------------------------

/** Un solo formateador, reusado: extraer día y hora locales de AR de un `Date`. */
const FMT_AR = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Argentina/Buenos_Aires',
  weekday: 'long',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const DIA_EN: Record<string, number> = {
  Monday: 0,
  Tuesday: 1,
  Wednesday: 2,
  Thursday: 3,
  Friday: 4,
  Saturday: 5,
  Sunday: 6,
}

/**
 * Día de la semana (0 = lunes) y minutos desde medianoche **en hora de Buenos
 * Aires**, para un instante dado. Puro respecto de `now`: los tests le pasan un
 * `Date` fijo y no dependen del reloj de la máquina.
 */
export function partesEnAR(now: Date): { dia: number; minutos: number } {
  const parts = FMT_AR.formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  const dia = DIA_EN[get('weekday')] ?? 0
  // `hour12: false` puede dar '24' a la medianoche en algunas versiones de ICU.
  const hora = Number(get('hour')) % 24
  const min = Number(get('minute'))
  return { dia, minutos: hora * 60 + min }
}

/**
 * ¿Está abierto en `now` (hora de AR)? Recorre los rangos de **hoy** y —para
 * cubrir el cruce de medianoche— la cola de los rangos de **ayer** que siguen
 * abiertos de madrugada. Un rango con `abre === cierra` es inválido (lo corta la
 * validación) y acá no aporta apertura.
 */
export function estaAbierto(h: HorariosSemana, now: Date): boolean {
  const { dia, minutos } = partesEnAR(now)

  for (const r of h[DIAS[dia]] ?? []) {
    const a = minutosDe(r.abre)
    const c = minutosDe(r.cierra)
    if (a < c) {
      if (minutos >= a && minutos < c) return true
    } else if (a > c) {
      // Cruza la medianoche: el tramo de esta misma noche va de `abre` a las 24 h.
      if (minutos >= a) return true
    }
  }

  // La madrugada de hoy puede pertenecer a un rango que abrió AYER (20:00–02:00).
  for (const r of h[DIAS[(dia + 6) % 7]] ?? []) {
    const a = minutosDe(r.abre)
    const c = minutosDe(r.cierra)
    if (a > c && minutos < c) return true
  }

  return false
}

/**
 * Una línea por día para el acordeón de la ficha ("Lunes: 20:00–02:00", "Martes:
 * Cerrado"). Determinista: no depende de la hora, así se puede renderizar en el
 * server sin desincronizar la hidratación.
 */
export function lineasSemana(h: HorariosSemana): string[] {
  return DIAS.map((dia) => {
    const rangos = h[dia] ?? []
    if (rangos.length === 0) return `${NOMBRE_DIA[dia]}: Cerrado`
    const txt = rangos.map((r) => `${r.abre}–${r.cierra}`).join(', ')
    return `${NOMBRE_DIA[dia]}: ${txt}`
  })
}
