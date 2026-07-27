import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { placeTagSuggestions, placeTags } from '@/lib/db/schema'
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
 * Del criterio de `guardarCuraduria` se reutiliza la **escritura** a `place_tags`
 * (admin + `onConflictDoNothing`, para que una fila `import` gane si ya está). NO
 * se reutiliza su `delete` previo de admin: ese borrado sirve al "corregir/
 * destildar" de la cola (reemplazo total), pero acá la corrida es **aditiva** —
 * borrar pisaría tags auto-aplicados en tandas anteriores de la misma zona.
 */
export type ResultadoGuardado = {
  /** Filas nuevas en `place_tag_suggestions` (para el reporte del batch). */
  nuevas: number
  /** Tags auto-aplicados a `place_tags` como `admin` + `accepted` (decisión 13). */
  autoAplicadas: number
}

export async function guardarSugerencias(
  placeId: string,
  sugerencias: SugerenciaLLM[],
  model: string,
): Promise<ResultadoGuardado> {
  if (sugerencias.length === 0) return { nuevas: 0, autoAplicadas: 0 }

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
    if (nuevas === 0) return { nuevas: 0, autoAplicadas: 0 }

    // Solo las recién insertadas con evidencia se auto-aplican (decisión 13).
    const idsNuevos = new Set(insertadas.map((f) => f.tagId))
    const idsConEvidencia = sugerencias
      .filter((s) => s.evidence !== null && idsNuevos.has(s.tagId))
      .map((s) => s.tagId)

    if (idsConEvidencia.length === 0) return { nuevas, autoAplicadas: 0 }

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

    return { nuevas, autoAplicadas: idsConEvidencia.length }
  })
}
