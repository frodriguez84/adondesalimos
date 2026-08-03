import 'dotenv/config'
import { and, eq, like, lt, sql } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'

import { db } from '@/lib/db'
import { getConfidenceThreshold } from '@/lib/db/settings'
import { placeClaims, placePhotos, places, users } from '@/lib/db/schema'
import { publishedWhere } from '@/lib/db/visibility'
import { getPlaceForEnrichment } from '../matching'
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

/**
 * `INT2-33`: las fotos del dueño se apagan al revocar el reclamo, igual que el
 * contenido y los horarios. **Y la fila sigue viva** — ocultar ≠ borrar, en los
 * dos ejes: ni `place_photos` ni el objeto en R2 se tocan.
 *
 * El test cubre **los dos lugares que deciden sobre fotos**, que se tocan juntos
 * o no se toca ninguno: la ficha (`getPlaceDetail`) y el chequeo
 * `tieneFotoDueno` del enriquecimiento (`getPlaceForEnrichment`). Gatear solo el
 * primero deja la ficha **sin ninguna foto** —ni la del ex-dueño ni la de
 * Google—, que es peor que el bug original. Pasó de verdad al implementarlo.
 */
const PREFIJO = '__test_ficha_fotos__'

describe.runIf(process.env.DATABASE_URL)('getPlaceDetail — fotos del dueño', () => {
  afterAll(async () => {
    // Las fotos y el claim caen por cascade de places.
    await db.delete(places).where(like(places.name, `${PREFIJO}%`))
    await db.delete(users).where(like(users.email, `${PREFIJO}%`))
  })

  it('con reclamo aprobado se ven; revocado no, y las filas siguen ahí', async () => {
    const [user] = await db
      .insert(users)
      .values({ email: `${PREFIJO}@ejemplo.com`, name: 'Dueño', emailVerified: true })
      .returning({ id: users.id })

    const [place] = await db
      .insert(places)
      .values({
        source: 'overture',
        name: `${PREFIJO} con fotos`,
        lat: -34.6037,
        lng: -58.3816,
        // Publicado por confidence: el gate de visibilidad no es lo que se prueba acá.
        confidence: 0.99,
      })
      .returning({ id: places.id })

    await db.insert(placePhotos).values([
      { placeId: place.id, url: 'https://ejemplo.test/1.jpg', sort: 0 },
      { placeId: place.id, url: 'https://ejemplo.test/2.jpg', sort: 1 },
    ])

    const [claim] = await db
      .insert(placeClaims)
      .values({
        placeId: place.id,
        userId: user.id,
        kind: 'claim',
        status: 'approved',
        decidedAt: new Date(),
        decidedBy: 'admin@ejemplo.com',
      })
      .returning({ id: placeClaims.id })

    const conDueno = await getPlaceDetail(place.id)
    expect(conDueno!.ownerPhotos).toHaveLength(2)
    // Con dueño aprobado la ficha usa las suyas, así que no se le pide foto a Google.
    expect((await getPlaceForEnrichment(place.id))!.tieneFotoDueno).toBe(true)

    await db.update(placeClaims).set({ status: 'rejected' }).where(eq(placeClaims.id, claim.id))

    const revocada = await getPlaceDetail(place.id)
    expect(revocada!.reclamado).toBe(false)
    expect(revocada!.ownerPhotos).toEqual([])
    // Y ahora sí puede pedirla: si esto quedara en `true`, la ficha se quedaría
    // sin ninguna foto.
    expect((await getPlaceForEnrichment(place.id))!.tieneFotoDueno).toBe(false)

    // El assert que importa: se dejaron de mostrar, no se borraron.
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(placePhotos)
      .where(eq(placePhotos.placeId, place.id))
    expect(n).toBe(2)
  })
})
