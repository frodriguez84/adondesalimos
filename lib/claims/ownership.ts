import { and, eq, inArray } from 'drizzle-orm'
import { db, type DbOrTx } from '@/lib/db'
import { placeClaims, placeTags } from '@/lib/db/schema'

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
