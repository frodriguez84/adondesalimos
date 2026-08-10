import { GPS_RADIUS_KM } from './params'

/**
 * Qué dice el renglón que va arriba del listado (PBETA-R1-03 y PBETA-R1-04).
 *
 * Existe por dos hallazgos que son el mismo renglón:
 *
 *  - **R1-04**: el conteo vivía solo en el botón del sheet y desaparecía al
 *    entrar al listado. Acá vuelve, en la pantalla donde importa.
 *  - **R1-03**: con "Palermo Soho" puesto aparecen cards de "Palermo Hollywood",
 *    porque el filtro de zona usa el polígono expandido 400 m (ZONAS, decisión
 *    5 — arbitrada y **no se toca**: lo que faltaba era decirlo en pantalla).
 *
 * Módulo puro y dueño único del copy del conteo: la misma regla de plural y de
 * formato la usa el botón "Ver N lugares" de los dos sheets (`BotonAplicar`).
 * Sin esto son dos implementaciones de "cómo se dice un número de lugares".
 */

/** "1.095 lugares" · "1 lugar". Formato es-AR, que es el del producto. */
export function contarLugares(n: number): string {
  return `${n.toLocaleString('es-AR')} ${n === 1 ? 'lugar' : 'lugares'}`
}

export type ResumenBusqueda = {
  /** Línea principal: cuántos hay y de dónde. */
  titulo: string
  /**
   * Renglón chico que explica el buffer de 400 m. **Null cuando no aplica**: sin
   * zona elegida y en GPS no hay borde de zona del que hablar, y un aviso que no
   * viene al caso es ruido en la pantalla más vista.
   */
  aclaracion: string | null
}

/**
 * @param total  Resultados de la búsqueda entera (no de la página).
 * @param zonas  Nombres de las zonas elegidas, ya resueltos del catálogo.
 * @param gps    "Cerca de mí" activo: reemplaza a las zonas (decisión 3).
 */
export function resumirBusqueda({
  total,
  zonas,
  gps,
}: {
  total: number
  zonas: string[]
  gps: boolean
}): ResumenBusqueda {
  const cuantos = contarLugares(total)

  if (gps) {
    return { titulo: `${cuantos} a menos de ${GPS_RADIUS_KM} km`, aclaracion: null }
  }

  if (zonas.length === 0) {
    return { titulo: cuantos, aclaracion: null }
  }

  // Con varias zonas no se enumeran: "en Chacarita y Colegiales, Villa Crespo y
  // Palermo Soho" ocupa tres renglones en un celular y el chip de arriba ya dice
  // cuáles son.
  const donde = zonas.length === 1 ? zonas[0] : `${zonas.length} zonas`

  return {
    titulo: `${cuantos} en ${donde}`,
    aclaracion: 'Incluye lo que está a la vuelta, hasta 400 m del borde.',
  }
}
