import { eq, sql } from 'drizzle-orm'
import { db, type DbOrTx } from '@/lib/db'
import { placeZones, zones } from '@/lib/db/schema'
import { asignarLugar, prepararZonas, type AsignacionLugar } from './asignar'

/**
 * Asignar zonas a **un** lugar y persistirlas (AUTH F2: el alta de un negocio
 * guarda el pin y necesita su zona en el mismo gesto).
 *
 * Reusa `asignarLugar` tal cual — la regla de qué zona le toca a un punto vive
 * en un solo lado (`lib/zones/asignar.ts`). Acá va solo el I/O: leer las zonas
 * activas, reemplazar las filas del lugar y devolver lo asignado.
 *
 * Costo: prepara los 46 polígonos en cada llamada. Es deliberado — un alta es un
 * evento raro (unidades por día), y cachear geometría entre requests traería el
 * problema de invalidarla cuando `zones:load` cambia un polígono. El barrido
 * masivo sigue siendo `zones:assign`, que prepara una vez para 26.000 lugares.
 */
export async function asignarZonasDeLugar(
  placeId: string,
  lng: number,
  lat: number,
  tx: DbOrTx = db,
): Promise<AsignacionLugar> {
  const zonaRows = await tx
    .select({
      id: zones.id,
      slug: zones.slug,
      polygon: zones.polygon,
      polygonSearch: zones.polygonSearch,
    })
    .from(zones)
    .where(sql`${zones.active}`)

  const asignacion = asignarLugar(lng, lat, prepararZonas(zonaRows))

  // Reemplazo, no merge: si el lugar ya tenía filas (re-asignación), las viejas
  // no pueden sobrevivir a un cambio de pin.
  await tx.delete(placeZones).where(eq(placeZones.placeId, placeId))

  // Cero zonas es un estado válido (ZONAS, decisión 17): el lugar cae fuera de
  // todo polígono y la card lo muestra sin zona.
  if (asignacion.zonaIds.length > 0) {
    await tx.insert(placeZones).values(
      asignacion.zonaIds.map((zoneId) => ({
        placeId,
        zoneId,
        isPrimary: zoneId === asignacion.primariaId,
      })),
    )
  }

  return asignacion
}
