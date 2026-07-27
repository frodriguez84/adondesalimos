import { db } from '@/lib/db'
import { placeTagSuggestions } from '@/lib/db/schema'
import type { SugerenciaLLM } from './sugeridor'

/**
 * Persiste las sugerencias de un lugar (CURADURIA, decisiones 7 y 8).
 *
 * `onConflictDoNothing` sobre `unique(place_id, tag_id)` es **el candado**: si ya
 * existe una fila para ese par —esté `pending`, `accepted` o `rejected`— no se
 * toca. Así una corrida nueva solo **agrega** sugerencias, nunca pisa una que Fer
 * ya revisó (DoD "una corrida nueva no pisa filas accepted/rejected").
 *
 * Devuelve cuántas filas nuevas entraron, para el reporte del batch.
 */
export async function guardarSugerencias(
  placeId: string,
  sugerencias: SugerenciaLLM[],
  model: string,
): Promise<number> {
  if (sugerencias.length === 0) return 0

  const insertadas = await db
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
    .returning({ id: placeTagSuggestions.id })

  return insertadas.length
}
