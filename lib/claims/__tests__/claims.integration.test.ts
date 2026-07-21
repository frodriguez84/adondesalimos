import 'dotenv/config'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { and, eq, like, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { placeClaims, placeZones, places, users, zones } from '@/lib/db/schema'
import { getConfidenceThreshold } from '@/lib/db/settings'
import { isPlacePublished, publishedWhere } from '@/lib/db/visibility'
import { crearAlta, crearReclamo, decidirClaim } from '../acciones'
import { tieneDuenoAprobado } from '../ownership'
import { buscarCatalogoCompleto, getLugarAReclamar } from '../query'

/**
 * El criterio verificable de F2, contra la base: **un lugar con confidence bajo
 * el umbral aparece publicado tras aprobar el reclamo**.
 *
 * Y las reglas que lo rodean: un dueño por lugar, idempotencia ante doble click,
 * y la revocación (rechazar un aprobado baja el `publish_override`).
 *
 * Los fixtures viven bajo un prefijo propio y se limpian al final.
 */

const PREFIJO = '__test_claims__'
const EMAIL_A = '__test_claims__a@ejemplo.com'
const EMAIL_B = '__test_claims__b@ejemplo.com'
const ADMIN = 'admin@ejemplo.com'
/** Obelisco: cae dentro de las zonas reales si están cargadas. */
const OBELISCO = { lat: -34.6037, lng: -58.3816 }

const solicitante = {
  applicantName: 'Fer',
  applicantPhone: '11 5555 5555',
  applicantRole: 'Dueño',
}

let hayDb = true
let userA = ''
let userB = ''
let placeId = ''

async function limpiar() {
  // Los claims caen por cascade de places y de users.
  await db.delete(places).where(like(places.name, `${PREFIJO}%`))
  await db.delete(users).where(like(users.email, `${PREFIJO}%`))
}

/** Estado del lugar según la regla de CATALOGO, que este spec no toca. */
async function estaPublicado(id: string): Promise<boolean> {
  const [fila] = await db
    .select({
      operatingStatus: places.operatingStatus,
      confidence: places.confidence,
      publishOverride: places.publishOverride,
    })
    .from(places)
    .where(eq(places.id, id))
  return isPlacePublished(fila, await getConfidenceThreshold())
}

beforeAll(async () => {
  try {
    await getConfidenceThreshold()
  } catch {
    hayDb = false
    return
  }
  await limpiar()

  const insertados = await db
    .insert(users)
    .values([
      { email: EMAIL_A, name: 'A', emailVerified: true },
      { email: EMAIL_B, name: 'B', emailVerified: true },
    ])
    .returning({ id: users.id, email: users.email })

  userA = insertados.find((u) => u.email === EMAIL_A)!.id
  userB = insertados.find((u) => u.email === EMAIL_B)!.id
})

afterAll(async () => {
  if (!hayDb) return
  await limpiar()
})

/** Cada caso arranca con el lugar invisible y sin claims. */
beforeEach(async () => {
  if (!hayDb) return
  await db.delete(places).where(like(places.name, `${PREFIJO}%`))
  const [place] = await db
    .insert(places)
    .values({
      source: 'overture',
      name: `${PREFIJO} bajo umbral`,
      lat: OBELISCO.lat,
      lng: OBELISCO.lng,
      // Bajo el umbral por defecto (0.5): hoy no se ve en ningún lado.
      confidence: 0.3,
    })
    .returning({ id: places.id })
  placeId = place.id
})

describe.runIf(process.env.DATABASE_URL)('reclamo y aprobación', () => {
  it('aprobar publica un lugar que estaba bajo el umbral', async () => {
    if (!hayDb) return
    expect(await estaPublicado(placeId)).toBe(false)

    const creado = await crearReclamo(userA, { kind: 'claim', placeId, ...solicitante })
    expect(creado.ok).toBe(true)
    if (!creado.ok) return

    // Pendiente todavía no publica nada: la aprobación es lo que mueve la aguja.
    expect(await estaPublicado(placeId)).toBe(false)

    const decidido = await decidirClaim(creado.data.claimId, { accion: 'approve' }, ADMIN)
    expect(decidido.ok).toBe(true)
    if (!decidido.ok) return
    expect(decidido.data.yaEstaba).toBe(false)

    expect(await estaPublicado(placeId)).toBe(true)
    expect(await tieneDuenoAprobado(placeId)).toBe(true)

    // Y lo ve la query de búsqueda, que es la que importa de verdad.
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(places)
      .where(and(eq(places.id, placeId), publishedWhere(await getConfidenceThreshold())))
    expect(n).toBe(1)
  })

  it('aprobar dos veces es idempotente y no vuelve a avisar', async () => {
    if (!hayDb) return
    const creado = await crearReclamo(userA, { kind: 'claim', placeId, ...solicitante })
    if (!creado.ok) throw new Error('no se creó el claim')

    const primera = await decidirClaim(creado.data.claimId, { accion: 'approve' }, ADMIN)
    const segunda = await decidirClaim(creado.data.claimId, { accion: 'approve' }, ADMIN)

    expect(primera.ok && primera.data.yaEstaba).toBe(false)
    // `yaEstaba` es lo que corta el segundo mail (edge case: doble click).
    expect(segunda.ok && segunda.data.yaEstaba).toBe(true)
    expect(await estaPublicado(placeId)).toBe(true)
  })

  it('un solo dueño por lugar: el segundo reclamo no se puede aprobar', async () => {
    if (!hayDb) return
    const deA = await crearReclamo(userA, { kind: 'claim', placeId, ...solicitante })
    const deB = await crearReclamo(userB, { kind: 'claim', placeId, ...solicitante })
    if (!deA.ok || !deB.ok) throw new Error('los dos pendientes tienen que poder convivir')

    await decidirClaim(deA.data.claimId, { accion: 'approve' }, ADMIN)

    const segunda = await decidirClaim(deB.data.claimId, { accion: 'approve' }, ADMIN)
    expect(segunda.ok).toBe(false)
    expect(!segunda.ok && segunda.code).toBe('OTRO_APROBADO')
  })

  it('reclamar un lugar que ya tiene dueño no entra en la cola', async () => {
    if (!hayDb) return
    const deA = await crearReclamo(userA, { kind: 'claim', placeId, ...solicitante })
    if (!deA.ok) throw new Error('no se creó el claim')
    await decidirClaim(deA.data.claimId, { accion: 'approve' }, ADMIN)

    const deB = await crearReclamo(userB, { kind: 'claim', placeId, ...solicitante })
    expect(deB.ok).toBe(false)
    expect(!deB.ok && deB.code).toBe('YA_RECLAMADO')
  })

  it('el mismo usuario no duplica su solicitud pendiente', async () => {
    if (!hayDb) return
    await crearReclamo(userA, { kind: 'claim', placeId, ...solicitante })
    const repetida = await crearReclamo(userA, { kind: 'claim', placeId, ...solicitante })
    expect(repetida.ok).toBe(false)
    expect(!repetida.ok && repetida.code).toBe('YA_PENDIENTE')
  })

  it('rechazar un pendiente deja el lugar exactamente como estaba', async () => {
    if (!hayDb) return
    const creado = await crearReclamo(userA, { kind: 'claim', placeId, ...solicitante })
    if (!creado.ok) throw new Error('no se creó el claim')

    const decidido = await decidirClaim(
      creado.data.claimId,
      { accion: 'reject', motivo: 'No pudimos verificar el vínculo' },
      ADMIN,
    )
    expect(decidido.ok && decidido.data.revocado).toBe(false)
    expect(await estaPublicado(placeId)).toBe(false)
    expect(await tieneDuenoAprobado(placeId)).toBe(false)

    const [fila] = await db
      .select({ status: placeClaims.status, notas: placeClaims.adminNotes })
      .from(placeClaims)
      .where(eq(placeClaims.id, creado.data.claimId))
    expect(fila.status).toBe('rejected')
    expect(fila.notas).toBe('No pudimos verificar el vínculo')
  })

  it('revocar un aprobado baja el override y el lugar vuelve a esconderse', async () => {
    if (!hayDb) return
    const creado = await crearReclamo(userA, { kind: 'claim', placeId, ...solicitante })
    if (!creado.ok) throw new Error('no se creó el claim')
    await decidirClaim(creado.data.claimId, { accion: 'approve' }, ADMIN)
    expect(await estaPublicado(placeId)).toBe(true)

    const revocado = await decidirClaim(
      creado.data.claimId,
      { accion: 'reject', motivo: 'Resultó no ser el dueño' },
      ADMIN,
    )
    expect(revocado.ok && revocado.data.revocado).toBe(true)
    expect(await estaPublicado(placeId)).toBe(false)
    expect(await tieneDuenoAprobado(placeId)).toBe(false)
  })
})

describe.runIf(process.env.DATABASE_URL)('búsqueda del catálogo completo', () => {
  it('encuentra un lugar invisible y lo marca como no publicado', async () => {
    if (!hayDb) return
    // El caso de negocio del spec: el lugar bajo el umbral no tiene ficha
    // pública, así que su dueño solo puede llegar por esta pantalla.
    const filas = await buscarCatalogoCompleto('bajo umbral')
    const nuestro = filas.find((f) => f.id === placeId)
    expect(nuestro).toBeDefined()
    expect(nuestro!.publicado).toBe(false)
    expect(nuestro!.reclamado).toBe(false)
  })

  it('marca reclamado el lugar que ya tiene dueño', async () => {
    if (!hayDb) return
    // Regresión: el `EXISTS` en SQL crudo devolvía false SIEMPRE porque
    // `${places.id}` se renderizaba sin calificar y colisionaba con
    // `place_claims.id`. Un lugar ya reclamado se seguía ofreciendo para
    // reclamar, y el endpoint lo rechazaba recién al enviar el formulario.
    const creado = await crearReclamo(userA, { kind: 'claim', placeId, ...solicitante })
    if (!creado.ok) throw new Error('no se creó el claim')
    await decidirClaim(creado.data.claimId, { accion: 'approve' }, ADMIN)

    const filas = await buscarCatalogoCompleto('bajo umbral')
    const nuestro = filas.find((f) => f.id === placeId)
    expect(nuestro?.reclamado).toBe(true)
    // Y ahora sí está publicado, por el override de la aprobación.
    expect(nuestro?.publicado).toBe(true)

    // La pantalla de reclamo tiene que decir lo mismo.
    const lugar = await getLugarAReclamar(placeId)
    expect(lugar?.reclamado).toBe(true)
  })

  it('no devuelve nada con menos de dos caracteres', async () => {
    if (!hayDb) return
    expect(await buscarCatalogoCompleto('b')).toEqual([])
    expect(await buscarCatalogoCompleto('  ')).toEqual([])
  })
})

describe.runIf(process.env.DATABASE_URL)('alta de un lugar nuevo', () => {
  it('nace invisible, con zona asignada, y se publica al aprobar', async () => {
    if (!hayDb) return
    const alta = await crearAlta(userA, {
      kind: 'new',
      name: `${PREFIJO} bar nuevo`,
      lat: OBELISCO.lat,
      lng: OBELISCO.lng,
      address: 'Av. 9 de Julio 1000',
      ...solicitante,
    })
    expect(alta.ok).toBe(true)
    if (!alta.ok) return

    const [creado] = await db
      .select({
        source: places.source,
        confidence: places.confidence,
        publishOverride: places.publishOverride,
      })
      .from(places)
      .where(eq(places.id, alta.data.placeId))

    // Decisión 12: `source='owner'`, sin confidence y sin override ⇒ invisible.
    expect(creado.source).toBe('owner')
    expect(creado.confidence).toBeNull()
    expect(creado.publishOverride).toBe(false)
    expect(await estaPublicado(alta.data.placeId)).toBe(false)

    const [claim] = await db
      .select({ kind: placeClaims.kind, status: placeClaims.status })
      .from(placeClaims)
      .where(eq(placeClaims.id, alta.data.claimId))
    expect(claim.kind).toBe('new')
    expect(claim.status).toBe('pending')

    // La zona sale de la geometría de ZONAS al guardar el pin, no de un campo
    // del formulario. Con las 46 zonas cargadas, el Obelisco cae en alguna.
    const [{ zonasActivas }] = await db
      .select({ zonasActivas: sql<number>`count(*)::int` })
      .from(zones)
      .where(eq(zones.active, true))

    const asignadas = await db
      .select({ isPrimary: placeZones.isPrimary })
      .from(placeZones)
      .where(eq(placeZones.placeId, alta.data.placeId))

    if (zonasActivas > 0) {
      expect(asignadas.length).toBeGreaterThan(0)
    }
    // Invariante de ZONAS: a lo sumo una primaria.
    expect(asignadas.filter((z) => z.isPrimary).length).toBeLessThanOrEqual(1)

    await decidirClaim(alta.data.claimId, { accion: 'approve' }, ADMIN)
    expect(await estaPublicado(alta.data.placeId)).toBe(true)
  })

  it('rechazar un alta deja el lugar invisible, no lo borra', async () => {
    if (!hayDb) return
    const alta = await crearAlta(userA, {
      kind: 'new',
      name: `${PREFIJO} bar rechazado`,
      lat: OBELISCO.lat,
      lng: OBELISCO.lng,
      ...solicitante,
    })
    if (!alta.ok) throw new Error('no se creó el alta')

    await decidirClaim(alta.data.claimId, { accion: 'reject', motivo: 'No existe' }, ADMIN)

    const [sigue] = await db
      .select({ id: places.id })
      .from(places)
      .where(eq(places.id, alta.data.placeId))
    expect(sigue).toBeDefined()
    expect(await estaPublicado(alta.data.placeId)).toBe(false)
  })
})
