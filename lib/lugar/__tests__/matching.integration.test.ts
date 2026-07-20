import 'dotenv/config'
import { and, eq, lt } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { db } from '@/lib/db'
import { getConfidenceThreshold } from '@/lib/db/settings'
import { places } from '@/lib/db/schema'
import { publishedWhere } from '@/lib/db/visibility'
import { getPlaceForEnrichment } from '../matching'

/**
 * `getPlaceForEnrichment` revalida la visibilidad antes de autorizar cualquier
 * gasto en Google (FICHA, decisión 23): un lugar oculto o inexistente devuelve
 * `null` ⇒ el endpoint responde 404 sin tocar la API paga. Mismo gate que la
 * ficha, verificado acá para el camino del enriquecimiento.
 */
describe.runIf(process.env.DATABASE_URL)('getPlaceForEnrichment — visibilidad', () => {
  it('un id que no es UUID devuelve null sin tocar la base', async () => {
    expect(await getPlaceForEnrichment('no-es-uuid')).toBeNull()
  })

  it('un UUID inexistente devuelve null', async () => {
    expect(await getPlaceForEnrichment('00000000-0000-0000-0000-000000000000')).toBeNull()
  })

  it('un lugar publicado trae los datos del resolver y el estado del match', async () => {
    const umbral = await getConfidenceThreshold()
    const [pub] = await db
      .select({ id: places.id })
      .from(places)
      .where(publishedWhere(umbral))
      .limit(1)

    if (!pub) return // catálogo vacío
    const place = await getPlaceForEnrichment(pub.id)
    expect(place).not.toBeNull()
    expect(place!.id).toBe(pub.id)
    expect(place!.name.length).toBeGreaterThan(0)
    // Nace pending hasta que alguien abra la ficha (el resolver lo mueve).
    expect(['pending', 'matched', 'manual', 'not_found', 'blocked']).toContain(
      place!.googleMatchStatus,
    )
  })

  it('un lugar bajo umbral y sin override devuelve null (no se gasta en oculto)', async () => {
    const umbral = await getConfidenceThreshold()
    const [oculto] = await db
      .select({ id: places.id })
      .from(places)
      .where(
        and(
          eq(places.operatingStatus, 'open'),
          eq(places.publishOverride, false),
          lt(places.confidence, umbral),
        ),
      )
      .limit(1)

    if (!oculto) return
    expect(await getPlaceForEnrichment(oculto.id)).toBeNull()
  })
})
