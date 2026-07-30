import { partesEnAR } from '@/lib/negocio/horarios'

/**
 * La franja horaria actual → tags de Momento (ABIERTO_AHORA F1, decisiones 3 y 4).
 *
 * **Dueño único de la regla**: nadie más mapea hora → tags. Puro, sin DB ni
 * React: se testea con una tabla de horas, igual que `lib/negocio/horarios.ts`
 * —del que reusa `partesEnAR`, porque el cómputo de día/hora en AR ya tiene
 * dueño y no se reimplementa—.
 *
 * **El copy es el contrato (decisión 2)**: el chip se llama «Para ahora», nunca
 * "Abierto ahora". La promesa es *lo que suele servir a esta hora* (tags curados,
 * costo $0), no *lo que está abierto* — para eso hacen falta horarios propios de
 * dueño, que es la F2 y está gateada. Si el rótulo se afloja, la feature pasa a
 * mentir.
 *
 * **Por qué la madrugada lleva dos tags y el domingo no suma `abre-domingos`**:
 * el motor hace OR dentro de faceta (decisión 13 de BUSQUEDA) y los tres son de
 * Momento. En la madrugada la unión es la semántica deseada —"de madrugada" es
 * `trasnoche` **o** `hasta-tarde` (176 lugares contra 44)—, pero sumar
 * `abre-domingos` a la franja **ensancharía** el resultado en vez de achicarlo
 * (decisiones 7 y 8). Exigir "franja **y** abre domingos" necesita partir la
 * faceta: es v2.
 */

/** Slug del chip en la home. No es fila de `occasion_chips`: sus tags dependen de la hora. */
export const SLUG_AHORA = 'para-ahora'

/** Rótulo único del chip, en toda franja (decisión 2). */
export const NOMBRE_AHORA = 'Para ahora'

export type Franja = {
  /** Identifica la franja para tests y debugging. **No** es rótulo de UI. */
  slug: 'madrugada' | 'desayuno' | 'almuerzo' | 'merienda' | 'cena'
  /** Minuto de arranque en hora de AR, inclusive. */
  desde: number
  /** Tags de Momento que aplica. Van a la URL tal cual al tocar el chip. */
  tags: string[]
}

const H = (h: number, m = 0) => h * 60 + m

/**
 * Las franjas de la decisión 3, **ordenadas por `desde` y arrancando en 00:00**.
 * Cubrir las 24 h sin huecos ni solapamientos no es algo que haya que verificar
 * rango por rango: cada franja llega hasta la siguiente por construcción, y la
 * primera empieza en el minuto 0.
 */
export const FRANJAS: readonly Franja[] = [
  { slug: 'madrugada', desde: H(0), tags: ['trasnoche', 'hasta-tarde'] }, // 00:00–05:59
  { slug: 'desayuno', desde: H(6), tags: ['desayuno'] }, //                 06:00–10:59
  { slug: 'almuerzo', desde: H(11), tags: ['almuerzo'] }, //                11:00–15:29
  { slug: 'merienda', desde: H(15, 30), tags: ['merienda'] }, //            15:30–19:59
  { slug: 'cena', desde: H(20), tags: ['cena'] }, //                        20:00–23:59
]

/**
 * En qué franja cae `now`, en hora de Buenos Aires (TZ fija, decisión 3: el chip
 * no depende del reloj de quien mira). Puro respecto de `now`.
 */
export function franjaActual(now: Date): Franja {
  const { minutos } = partesEnAR(now)
  let actual = FRANJAS[0]
  for (const f of FRANJAS) {
    if (minutos < f.desde) break
    actual = f
  }
  return actual
}
