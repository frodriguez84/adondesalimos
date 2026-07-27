import type { Facet } from '@/lib/db/schema'
import { CHIPS } from '@/lib/db/chips'
import { TIPO } from '@/lib/db/taxonomy'

/**
 * Las 3 facetas que el LLM sugiere (CURADURIA, decisión 6): las tres ralas.
 * Ambiente y Momento están casi vacías; Actividad entra para despegarla del Tipo.
 * Tipo y Cocina no se tocan (vienen del import); Precio es campo manual opcional
 * en la cola, no algo que el LLM proponga (decisión "Qué NO es").
 */
export const FACETAS_SUGERIBLES: readonly Facet[] = ['ambiente', 'momento', 'actividad']

/**
 * Los slugs de **Tipo** que aparecen en algún chip de Ocasión (decisión 3: la
 * selección del batch entra por "Tipo relevante a los chips"). Se deriva del canon
 * —los chips y la taxonomía— en vez de hardcodear una lista: si un chip suma un
 * Tipo nuevo, este set lo sigue solo.
 */
export const TIPO_RELEVANTE_CHIPS: ReadonlySet<string> = (() => {
  const slugsTipo = new Set(TIPO.map((t) => t.slug))
  const relevantes = new Set<string>()
  for (const chip of CHIPS) {
    for (const slug of chip.tags) {
      if (slugsTipo.has(slug)) relevantes.add(slug)
    }
  }
  return relevantes
})()
