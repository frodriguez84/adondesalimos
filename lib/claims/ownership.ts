import { and, eq, inArray } from 'drizzle-orm'
import { db, type DbOrTx } from '@/lib/db'
import { placeClaims, placeTags, places, tags } from '@/lib/db/schema'
import { tagsForCategory } from '@/lib/overture/tag-map'

/**
 * Quién es dueño de qué — fuente única de "este lugar está reclamado".
 *
 * Un lugar tiene dueño ⇔ existe un `place_claims` suyo en `approved`
 * (decisión 8: no hay columna `role`, la propiedad se **deriva**). La ficha lo
 * usa para esconder el botón "¿Sos el dueño?" (decisión 21) y el import lo usa
 * para no pisar las tags del dueño (decisión 14).
 */

export async function tieneDuenoAprobado(placeId: string, tx: DbOrTx = db): Promise<boolean> {
  const [fila] = await tx
    .select({ id: placeClaims.id })
    .from(placeClaims)
    .where(and(eq(placeClaims.placeId, placeId), eq(placeClaims.status, 'approved')))
    .limit(1)
  return fila !== undefined
}

/** Los que están reclamados, de un lote. Una query para el batch entero. */
export async function placesConDuenoAprobado(
  placeIds: string[],
  tx: DbOrTx = db,
): Promise<Set<string>> {
  if (placeIds.length === 0) return new Set()

  const filas = await tx
    .selectDistinct({ placeId: placeClaims.placeId })
    .from(placeClaims)
    .where(and(inArray(placeClaims.placeId, placeIds), eq(placeClaims.status, 'approved')))

  return new Set(filas.map((f) => f.placeId))
}

/**
 * **El gate del panel** (F3): ¿este usuario es dueño de este lugar? Mismo
 * criterio que `tieneDuenoAprobado`, con el usuario adentro.
 *
 * Lo usan `/mi-negocio/[placeId]` y los dos endpoints del panel. Nadie escribe
 * "existe un claim aprobado de este usuario" por su cuenta: el día que la
 * propiedad deje de ser una sola fila aprobada, se cambia acá y nada más.
 */
export async function esDuenoDe(
  userId: string,
  placeId: string,
  tx: DbOrTx = db,
): Promise<boolean> {
  const [fila] = await tx
    .select({ id: placeClaims.id })
    .from(placeClaims)
    .where(
      and(
        eq(placeClaims.placeId, placeId),
        eq(placeClaims.userId, userId),
        eq(placeClaims.status, 'approved'),
      ),
    )
    .limit(1)
  return fila !== undefined
}

/** Los lugares de un usuario, para la lista de `/mi-negocio`. Misma regla. */
export async function placeIdsDelUsuario(userId: string, tx: DbOrTx = db): Promise<string[]> {
  const filas = await tx
    .selectDistinct({ placeId: placeClaims.placeId })
    .from(placeClaims)
    .where(and(eq(placeClaims.userId, userId), eq(placeClaims.status, 'approved')))
  return filas.map((f) => f.placeId)
}

/**
 * Reemplaza las tags `source='import'` de un lote **salteando los lugares con
 * dueño aprobado** (decisión 14).
 *
 * Sin esto, una tag que el dueño borró reaparece en el import siguiente: el
 * dueño aprobado es mejor fuente que Overture para SU lugar. La regla vive acá y
 * no en el script porque es de negocio, y porque así se puede testear sin S3.
 *
 * Devuelve cuántos lugares del lote quedaron protegidos, para el reporte.
 */
export async function reemplazarTagsDeImport(
  placeIds: string[],
  nuevas: { placeId: string; tagId: number }[],
  tx: DbOrTx = db,
): Promise<{ protegidos: number }> {
  const protegidos = await placesConDuenoAprobado(placeIds, tx)
  const editables = placeIds.filter((id) => !protegidos.has(id))

  if (editables.length > 0) {
    // Solo las de import: las que puso un dueño o un admin ya sobrevivían.
    await tx
      .delete(placeTags)
      .where(and(inArray(placeTags.placeId, editables), eq(placeTags.source, 'import')))
  }

  const insertables = nuevas.filter((n) => !protegidos.has(n.placeId))
  if (insertables.length > 0) {
    // Si un admin ya había asignado la misma tag, su fila gana (no se pisa el source).
    await tx
      .insert(placeTags)
      .values(insertables.map((n) => ({ ...n, source: 'import' as const })))
      .onConflictDoNothing()
  }

  return { protegidos: protegidos.size }
}

/**
 * **La contracara de la decisión 14**: al revocar un reclamo, las tags que puso
 * el dueño se van y vuelven las que Overture da por la categoría del lugar
 * (decisión 12.3 del QA integral #2, `INT2-33`).
 *
 * El porqué: **las tags deciden en qué búsquedas aparece un lugar**, y un
 * reclamo se revoca justamente cuando alguien no era quien decía ser — no puede
 * seguir sesgando el catálogo. Es la misma regla que ya rige el contenido y los
 * horarios ("revocar devuelve la ficha a Overture"), aplicada a las tags.
 *
 * Por qué **re-derivar** y no solo borrar: el editor del dueño borra las de
 * `import` a propósito (decisión 14), así que un lugar sin curaduría cuyo dueño
 * guardó alguna vez quedaría sin ninguna tag. La categoría de Overture está
 * persistida (`places.overture_category`), así que la reconstrucción es un
 * lookup local — no necesita re-import ni salir a S3.
 *
 * Lo que **no** toca: las de `source='admin'` (curaduría). El `insert` va con
 * `onConflictDoNothing`, así que una tag curada que también mapea desde Overture
 * conserva su `source`.
 *
 * Un slug del mapeo que no exista en `tags` se saltea en silencio: el import
 * tira error porque ahí es un bug de datos, pero acá no se puede fallar una
 * revocación por un hueco de la taxonomía.
 */
export async function revertirTagsAOverture(placeId: string, tx: DbOrTx = db): Promise<void> {
  const borradas = await tx
    .delete(placeTags)
    .where(and(eq(placeTags.placeId, placeId), eq(placeTags.source, 'owner')))
    .returning({ tagId: placeTags.tagId })

  // Sin tags del dueño no hay nada que reponer: las de import ya están.
  if (borradas.length === 0) return

  const [place] = await tx
    .select({ category: places.overtureCategory })
    .from(places)
    .where(eq(places.id, placeId))
    .limit(1)

  const slugs = tagsForCategory(place?.category)
  if (slugs.length === 0) return

  const filas = await tx.select({ id: tags.id }).from(tags).where(inArray(tags.slug, slugs))
  if (filas.length === 0) return

  await tx
    .insert(placeTags)
    .values(filas.map((t) => ({ placeId, tagId: t.id, source: 'import' as const })))
    .onConflictDoNothing()
}
