import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { placeTagSuggestions, placeTags } from '@/lib/db/schema'
import { citaVerificable } from './evidencia'
import type { EvidenciaSitio } from './fetch-sitio'
import type { SugerenciaLLM } from './sugeridor'

/**
 * Persiste las sugerencias de un lugar (CURADURIA, decisiones 7, 8 y 13).
 *
 * `onConflictDoNothing` sobre `unique(place_id, tag_id)` es **el candado**: si ya
 * existe una fila para ese par —esté `pending`, `accepted` o `rejected`— no se
 * toca. Así una corrida nueva solo **agrega** sugerencias, nunca pisa una que Fer
 * ya revisó (DoD "una corrida nueva no pisa filas accepted/rejected"). El
 * `.returning()` devuelve **solo las filas recién insertadas** — esa es la
 * protección del auto-apply de abajo.
 *
 * **Auto-apply (decisión 13, corrida masiva autónoma):** de las sugerencias
 * *nuevas*, las que traen evidencia citable se escriben a `place_tags`
 * (`source='admin'`) y se marcan `accepted`; las **sin evidencia** siguen el
 * camino de siempre (`pending`, la cola manual las revisa). Solo se auto-aplican
 * las recién insertadas: una fila que ya existía (aceptada/rechazada por Fer) no
 * está en `.returning()`, así que jamás se re-aplica.
 *
 * **Dos candados que agregó `SEC-07`** al auto-apply, porque el texto que respalda
 * una cita lo escribe el dueño del sitio y antes nadie lo cotejaba:
 *   1. **La cita tiene que estar en la evidencia** (`citaVerificable`, dueño único
 *      de esa regla). Antes bastaba con que `evidence` fuera un string no vacío:
 *      el modelo podía inventarla entera y se auto-aplicaba igual.
 *   2. **Tope de `MAX_AUTO_APLICADAS_POR_LUGAR` por lugar y por corrida.** Un
 *      dominio no es un lugar —en la corrida de julio `lacontinental.com` produjo
 *      67 tags sobre 11 lugares— así que el tope acota cuánto puede mover una sola
 *      página, incluso con todas las citas verificadas.
 *
 * Lo que cae por cualquiera de los dos **no se descarta**: queda `pending` y lo
 * revisa la cola manual. El reporte del batch los cuenta aparte (`frenadas` /
 * `diferidas`) — un tope que recorta en silencio se lee como "entró todo".
 *
 * Del criterio de `guardarCuraduria` se reutiliza la **escritura** a `place_tags`
 * (admin + `onConflictDoNothing`, para que una fila `import` gane si ya está). NO
 * se reutiliza su `delete` previo de admin: ese borrado sirve al "corregir/
 * destildar" de la cola (reemplazo total), pero acá la corrida es **aditiva** —
 * borrar pisaría tags auto-aplicados en tandas anteriores de la misma zona.
 */
/**
 * Cuántos tags puede auto-aplicarse un lugar en una corrida (`SEC-07`). Lo que
 * pase de acá queda `pending` para la cola manual. Cuatro es holgado para el uso
 * real —la corrida de julio promedió ~4,1 tags auto-aplicados por lugar sobre los
 * 296 que tuvieron alguno (1.219/296)— y a la vez impide que una sola página
 * reescriba la banda de orden de un lugar de punta a punta.
 */
export const MAX_AUTO_APLICADAS_POR_LUGAR = 4

export type ResultadoGuardado = {
  /** Filas nuevas en `place_tag_suggestions` (para el reporte del batch). */
  nuevas: number
  /** Tags auto-aplicados a `place_tags` como `admin` + `accepted` (decisión 13). */
  autoAplicadas: number
  /** Traían cita pero NO estaba en la evidencia: quedaron `pending` (`SEC-07`). */
  frenadas: number
  /** Verificadas pero pasadas del tope por lugar: quedaron `pending` (`SEC-07`). */
  diferidas: number
}

const NADA: ResultadoGuardado = { nuevas: 0, autoAplicadas: 0, frenadas: 0, diferidas: 0 }

export async function guardarSugerencias(
  placeId: string,
  sugerencias: SugerenciaLLM[],
  model: string,
  /**
   * La evidencia con la que se generaron estas sugerencias (`SEC-07`). Es
   * obligatoria: sin el texto no hay contra qué cotejar la cita, y en ese caso
   * **nada** se auto-aplica. Pasar `[]` es válido y significa exactamente eso.
   */
  evidencia: EvidenciaSitio[],
): Promise<ResultadoGuardado> {
  if (sugerencias.length === 0) return NADA

  return db.transaction(async (tx) => {
    const insertadas = await tx
      .insert(placeTagSuggestions)
      .values(
        sugerencias.map((s) => ({
          placeId,
          tagId: s.tagId,
          evidence: s.evidence,
          sourceUrl: s.sourceUrl,
          modelUsed: model,
        })),
      )
      .onConflictDoNothing({
        target: [placeTagSuggestions.placeId, placeTagSuggestions.tagId],
      })
      .returning({ tagId: placeTagSuggestions.tagId })

    const nuevas = insertadas.length
    if (nuevas === 0) return NADA

    // Solo las recién insertadas con evidencia se auto-aplican (decisión 13), y
    // solo si la cita está de verdad en el texto scrapeado (`SEC-07`).
    const idsNuevos = new Set(insertadas.map((f) => f.tagId))
    const conCita = sugerencias.filter((s) => s.evidence !== null && idsNuevos.has(s.tagId))
    const verificadas = conCita.filter((s) => citaVerificable(s.evidence, evidencia))
    const frenadas = conCita.length - verificadas.length

    // El tope corta por el orden en que las devolvió el modelo: las primeras
    // entran, el resto espera a la cola. Determinista y sin criterio propio —
    // elegir "las mejores" sería inventar un ranking que nadie pidió.
    const idsConEvidencia = verificadas.slice(0, MAX_AUTO_APLICADAS_POR_LUGAR).map((s) => s.tagId)
    const diferidas = verificadas.length - idsConEvidencia.length

    if (idsConEvidencia.length === 0) return { nuevas, autoAplicadas: 0, frenadas, diferidas }

    // A `place_tags` como admin. `onConflictDoNothing`: si ya existía como import,
    // su fila gana y el tag queda igual presente (mismo criterio que la cola).
    await tx
      .insert(placeTags)
      .values(idsConEvidencia.map((tagId) => ({ placeId, tagId, source: 'admin' as const })))
      .onConflictDoNothing()

    // Marcar `accepted` esas sugerencias (recién quedaron `pending` por el default).
    await tx
      .update(placeTagSuggestions)
      .set({ status: 'accepted', reviewedAt: sql`now()` })
      .where(
        and(
          eq(placeTagSuggestions.placeId, placeId),
          eq(placeTagSuggestions.status, 'pending'),
          inArray(placeTagSuggestions.tagId, idsConEvidencia),
        ),
      )

    return { nuevas, autoAplicadas: idsConEvidencia.length, frenadas, diferidas }
  })
}
