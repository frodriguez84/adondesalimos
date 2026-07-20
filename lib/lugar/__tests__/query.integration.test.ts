import 'dotenv/config'
import { and, eq, lt, sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { db } from '@/lib/db'
import { getConfidenceThreshold } from '@/lib/db/settings'
import { places } from '@/lib/db/schema'
import { publishedWhere } from '@/lib/db/visibility'
import { getPlaceDetail } from '../query'

/**
 * El gate de visibilidad de la ficha (FICHA, decisión 23) contra la base real:
 * un lugar publicado abre, uno oculto o inexistente devuelve `null` (⇒ 404 en el
 * route). La regla la aplica el helper de CATALOGO — acá se verifica el cableado.
 */
describe.runIf(process.env.DATABASE_URL)('getPlaceDetail — visibilidad', () => {
  it('un id que no es UUID devuelve null sin tocar la base', async () => {
    expect(await getPlaceDetail('no-es-uuid')).toBeNull()
  })

  it('un UUID inexistente devuelve null', async () => {
    expect(await getPlaceDetail('00000000-0000-0000-0000-000000000000')).toBeNull()
  })

  it('un lugar publicado abre con sus datos propios', async () => {
    const umbral = await getConfidenceThreshold()
    const [pub] = await db
      .select({ id: places.id })
      .from(places)
      .where(publishedWhere(umbral))
      .limit(1)

    if (!pub) return // catálogo vacío: nada que verificar
    const ficha = await getPlaceDetail(pub.id)
    expect(ficha).not.toBeNull()
    expect(ficha!.id).toBe(pub.id)
    expect(ficha!.name.length).toBeGreaterThan(0)
  })

  it('un lugar bajo umbral y sin override devuelve null (no publicado ⇒ 404)', async () => {
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

    if (!oculto) return // no hay ninguno bajo umbral: nada que verificar
    expect(await getPlaceDetail(oculto.id)).toBeNull()
  })
})
