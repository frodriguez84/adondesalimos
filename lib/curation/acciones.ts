import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { placeTagSuggestions, placeTags, tags, type Facet } from '@/lib/db/schema'
import { FACETAS_SUGERIBLES } from './facetas'

/**
 * Las dos acciones de la cola (CURADURIA, decisión 8):
 *
 *  - **Guardar (aceptar / corregir)**: escribe `place_tags` con `source='admin'`
 *    con lo tildado de las 3 facetas + Precio opcional. "Corregir" = tildar/
 *    destildar; por eso primero se borran las admin de esas facetas y se reinsertan
 *    solo las elegidas (una tag desmarcada deja de estar). NO se tocan las tags de
 *    `import`/`owner` ni las de otras facetas (Tipo/Cocina): cambio quirúrgico.
 *  - **Rechazar**: no toca `place_tags`; solo marca las sugerencias `rejected`.
 *
 * En los dos casos, las sugerencias `pending` del lugar quedan resueltas
 * (`accepted`/`rejected` + `reviewed_at`), así no reaparecen en la cola ni una
 * corrida nueva las pisa.
 *
 * El gate de admin lo hace el endpoint; acá se asume verificado.
 */

/** Las facetas que esta pantalla administra: las 3 sugeribles + Precio manual. */
const FACETAS_EDITABLES: readonly Facet[] = [...FACETAS_SUGERIBLES, 'precio']

export type ResultadoGuardar = {
  ok: true
  data: { placeId: string; tagsAdmin: number; aceptadas: number; rechazadas: number }
}

/**
 * Guarda la curaduría de un lugar. `tagsElegidos` son slugs de Ambiente/Momento/
 * Actividad; `precio` es un slug `precio-1..4` opcional (default null = "no sé").
 * Los slugs inválidos o de otra faceta se descartan en silencio — el cliente no
 * elige qué taxonomía existe (mismo criterio que el editor del dueño).
 */
export async function guardarCuraduria(
  placeId: string,
  tagsElegidos: string[],
  precio: string | null,
): Promise<ResultadoGuardar> {
  // Vocabulario editable: id + slug + facet de las 4 facetas que esta pantalla toca.
  const vocab = await db
    .select({ id: tags.id, slug: tags.slug, facet: tags.facet })
    .from(tags)
    .where(and(inArray(tags.facet, [...FACETAS_EDITABLES]), eq(tags.active, true)))

  const idPorSlug = new Map(vocab.map((t) => [t.slug, t.id]))
  const facetPorSlug = new Map(vocab.map((t) => [t.slug, t.facet]))

  // Solo slugs válidos de las 3 facetas sugeribles.
  const elegidosValidos = [...new Set(tagsElegidos)].filter(
    (s) => facetPorSlug.get(s) && FACETAS_SUGERIBLES.includes(facetPorSlug.get(s)!),
  )
  // Precio: solo si es un slug de la faceta precio.
  const precioValido = precio && facetPorSlug.get(precio) === 'precio' ? precio : null

  const slugsFinales = [...elegidosValidos, ...(precioValido ? [precioValido] : [])]
  const idsFinales = slugsFinales.map((s) => idPorSlug.get(s)!).filter(Boolean)
  const idsEditables = vocab.map((t) => t.id)

  let aceptadas = 0
  let rechazadas = 0

  await db.transaction(async (tx) => {
    // Fuera las admin de las facetas editables: "corregir" puede haber desmarcado
    // algunas. Import/owner y otras facetas quedan intactas.
    if (idsEditables.length > 0) {
      await tx
        .delete(placeTags)
        .where(
          and(
            eq(placeTags.placeId, placeId),
            eq(placeTags.source, 'admin'),
            inArray(placeTags.tagId, idsEditables),
          ),
        )
    }

    // Las elegidas, como admin. `onConflictDoNothing`: si ya existía como import
    // (ej. una Actividad que vino del mapeo), su fila gana y el tag queda presente.
    if (idsFinales.length > 0) {
      await tx
        .insert(placeTags)
        .values(idsFinales.map((tagId) => ({ placeId, tagId, source: 'admin' as const })))
        .onConflictDoNothing()
    }

    // Resolver las sugerencias pendientes: accepted las que quedaron tildadas,
    // rejected el resto. Un solo UPDATE por rama.
    const idsElegidos = elegidosValidos.map((s) => idPorSlug.get(s)!).filter(Boolean)

    if (idsElegidos.length > 0) {
      const acc = await tx
        .update(placeTagSuggestions)
        .set({ status: 'accepted', reviewedAt: sql`now()` })
        .where(
          and(
            eq(placeTagSuggestions.placeId, placeId),
            eq(placeTagSuggestions.status, 'pending'),
            inArray(placeTagSuggestions.tagId, idsElegidos),
          ),
        )
        .returning({ id: placeTagSuggestions.id })
      aceptadas = acc.length
    }

    const rej = await tx
      .update(placeTagSuggestions)
      .set({ status: 'rejected', reviewedAt: sql`now()` })
      .where(
        and(
          eq(placeTagSuggestions.placeId, placeId),
          eq(placeTagSuggestions.status, 'pending'),
        ),
      )
      .returning({ id: placeTagSuggestions.id })
    rechazadas = rej.length
  })

  return {
    ok: true,
    data: { placeId, tagsAdmin: idsFinales.length, aceptadas, rechazadas },
  }
}

/**
 * Rechaza todas las sugerencias pendientes de un lugar. No toca `place_tags`
 * (decisión 8): la ficha queda como estaba y la sugerencia no reaparece.
 */
export async function rechazarLugar(placeId: string): Promise<{ ok: true; data: { rechazadas: number } }> {
  const rej = await db
    .update(placeTagSuggestions)
    .set({ status: 'rejected', reviewedAt: sql`now()` })
    .where(and(eq(placeTagSuggestions.placeId, placeId), eq(placeTagSuggestions.status, 'pending')))
    .returning({ id: placeTagSuggestions.id })

  return { ok: true, data: { rechazadas: rej.length } }
}
