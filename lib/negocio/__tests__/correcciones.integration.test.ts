import 'dotenv/config'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { and, desc, eq, like, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { placeClaims, placeDataEdits, placeZones, places, users, zones } from '@/lib/db/schema'
import { getConfidenceThreshold } from '@/lib/db/settings'
import { asignarZonasDeLugar } from '@/lib/zones/persistir'
import {
  corregirDatos,
  decidirCorreccion,
  proponerCorreccion,
  soltarCampo,
} from '../correcciones'

/**
 * Las reglas de CORRECCION_DATOS contra la base (decisiones 6, 8, 9, 12, 13, 17).
 *
 * Lo que se verifica acá es lo que la UI no puede garantizar: que la marca sea por
 * campo y se **una**, que mover el pin re-asigne zonas e invalide el match con
 * Google en la misma transacción, y que la fuente y el `name` del dueño se
 * rechacen **en la función**, no solo en el formulario.
 */

const PREFIJO = '__test_corr__'
const EMAIL_DUENO = '__test_corr__dueno@ejemplo.com'
const EMAIL_AJENO = '__test_corr__ajeno@ejemplo.com'
const ADMIN = 'admin@ejemplo.com'
const FUENTE = 'ccmatienzo.com.ar'

/** Pringles 1249 (villa-crespo) y el Obelisco (retiro-microcentro): zonas distintas. */
const PIN_VIEJO = { lat: -34.5973293, lng: -58.426251 }
const PIN_NUEVO = { lat: -34.6037, lng: -58.3816 }

let hayDb = true
let hayZonas = false
let dueno = ''
let ajeno = ''
let placeId = ''

async function limpiar() {
  // Las ediciones y los claims caen por cascade de places y de users.
  await db.delete(places).where(like(places.name, `${PREFIJO}%`))
  await db.delete(users).where(like(users.email, `${PREFIJO}%`))
}

async function leerPlace() {
  const [fila] = await db.select().from(places).where(eq(places.id, placeId))
  return fila
}

async function zonasDe(id: string): Promise<{ zoneId: number; isPrimary: boolean }[]> {
  const filas = await db
    .select({ zoneId: placeZones.zoneId, isPrimary: placeZones.isPrimary })
    .from(placeZones)
    .where(eq(placeZones.placeId, id))
  return filas.sort((a, b) => a.zoneId - b.zoneId)
}

async function ultimaEdicion() {
  const [fila] = await db
    .select()
    .from(placeDataEdits)
    .where(eq(placeDataEdits.placeId, placeId))
    .orderBy(desc(placeDataEdits.createdAt))
    .limit(1)
  return fila
}

/** Deja el lugar en el estado del caso Matienzo: pin viejo, matcheado, sin marcas. */
async function resetearPlace(extra: Partial<typeof places.$inferInsert> = {}) {
  await db
    .update(places)
    .set({
      name: `${PREFIJO} Matienzo`,
      address: 'Pringles 1249',
      locality: 'Buenos Aires',
      lat: PIN_VIEJO.lat,
      lng: PIN_VIEJO.lng,
      lockedFields: [],
      googlePlaceId: 'ChIJ__test__',
      googleMatchStatus: 'matched',
      googleMatchedAt: new Date(),
      ...extra,
    })
    .where(eq(places.id, placeId))
  await db.delete(placeDataEdits).where(eq(placeDataEdits.placeId, placeId))
  if (hayZonas) await asignarZonasDeLugar(placeId, PIN_VIEJO.lng, PIN_VIEJO.lat)
}

beforeAll(async () => {
  try {
    await getConfidenceThreshold()
  } catch {
    hayDb = false
    return
  }
  await limpiar()

  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(zones)
  hayZonas = n > 0

  const creados = await db
    .insert(users)
    .values([
      { email: EMAIL_DUENO, name: 'Dueño', emailVerified: true },
      { email: EMAIL_AJENO, name: 'Ajeno', emailVerified: true },
    ])
    .returning({ id: users.id, email: users.email })

  dueno = creados.find((u) => u.email === EMAIL_DUENO)!.id
  ajeno = creados.find((u) => u.email === EMAIL_AJENO)!.id

  const [place] = await db
    .insert(places)
    .values({
      source: 'overture',
      overtureId: `${PREFIJO}ovt`,
      name: `${PREFIJO} Matienzo`,
      address: 'Pringles 1249',
      locality: 'Buenos Aires',
      lat: PIN_VIEJO.lat,
      lng: PIN_VIEJO.lng,
      confidence: 0.77,
    })
    .returning({ id: places.id })
  placeId = place.id

  await db.insert(placeClaims).values({
    placeId,
    userId: dueno,
    kind: 'claim',
    status: 'approved',
    decidedAt: new Date(),
    decidedBy: ADMIN,
  })
})

beforeEach(async () => {
  if (!hayDb) return
  await resetearPlace()
})

afterAll(async () => {
  if (!hayDb) return
  await limpiar()
})

describe.runIf(process.env.DATABASE_URL)('corregirDatos — el admin edita directo', () => {
  it('escribe el campo, lo fija y deja bitácora con el antes (decisiones 6 y 7)', async () => {
    if (!hayDb) return

    const res = await corregirDatos(
      placeId,
      { fuente: FUENTE, address: 'Av. Juan B. Justo 2959' },
      ADMIN,
    )
    expect(res.ok).toBe(true)

    const place = await leerPlace()
    expect(place.address).toBe('Av. Juan B. Justo 2959')
    expect(place.lockedFields).toEqual(['address'])

    const edicion = await ultimaEdicion()
    expect(edicion.origen).toBe('admin')
    expect(edicion.status).toBe('approved')
    expect(edicion.decidedBy).toBe(ADMIN)
    expect(edicion.fuente).toBe(FUENTE)
    expect(edicion.campos.address).toEqual({
      antes: 'Pringles 1249',
      despues: 'Av. Juan B. Justo 2959',
    })
  })

  it('la marca se UNE: corregir el nombre no desprotege la dirección (decisión 6)', async () => {
    if (!hayDb) return

    await corregirDatos(placeId, { fuente: FUENTE, address: 'Av. Juan B. Justo 2959' }, ADMIN)
    await corregirDatos(placeId, { fuente: FUENTE, name: `${PREFIJO} Matienzo nuevo` }, ADMIN)

    const place = await leerPlace()
    expect([...place.lockedFields].sort()).toEqual(['address', 'name'])
    expect(place.address).toBe('Av. Juan B. Justo 2959')
  })

  it('rechaza una fuente de menos de 3 caracteres EN LA FUNCIÓN (decisión 13)', async () => {
    if (!hayDb) return

    const res = await corregirDatos(placeId, { fuente: 'x', address: 'Av. Juan B. Justo 2959' }, ADMIN)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.code).toBe('INVALID')

    // Y no escribió nada.
    expect((await leerPlace()).address).toBe('Pringles 1249')
    expect(await ultimaEdicion()).toBeUndefined()
  })

  it('rechaza un pin fuera del bbox de AMBA', async () => {
    if (!hayDb) return

    const res = await corregirDatos(
      placeId,
      { fuente: FUENTE, lat: -31.4201, lng: -64.1888 }, // Córdoba
      ADMIN,
    )
    expect(res.ok).toBe(false)
    expect((await leerPlace()).lat).toBeCloseTo(PIN_VIEJO.lat, 6)
  })

  it('rechaza media coordenada: el pin va con lat y lng juntas', async () => {
    if (!hayDb) return
    const res = await corregirDatos(placeId, { fuente: FUENTE, lat: PIN_NUEVO.lat }, ADMIN)
    expect(res.ok).toBe(false)
  })
})

describe.runIf(process.env.DATABASE_URL)('mover el pin — zonas y Google (decisiones 8 y 9)', () => {
  it('re-asigna las zonas en la misma transacción y zones:assign no cambia nada', async () => {
    if (!hayDb || !hayZonas) return

    const antes = await zonasDe(placeId)

    const res = await corregirDatos(
      placeId,
      { fuente: FUENTE, address: 'Av. Corrientes 1', lat: PIN_NUEVO.lat, lng: PIN_NUEVO.lng },
      ADMIN,
    )
    expect(res.ok).toBe(true)

    const despues = await zonasDe(placeId)
    expect(despues).not.toEqual(antes)
    expect(despues.filter((z) => z.isPrimary)).toHaveLength(1)

    // Lo que haría `npm run zones:assign` después: recalcula lo mismo desde el
    // pin corregido, así que no cambia ni una fila.
    await asignarZonasDeLugar(placeId, PIN_NUEVO.lng, PIN_NUEVO.lat)
    expect(await zonasDe(placeId)).toEqual(despues)
  })

  it('invalida el match con Google (matched ⇒ pending, sin id)', async () => {
    if (!hayDb) return

    await corregirDatos(placeId, { fuente: FUENTE, lat: PIN_NUEVO.lat, lng: PIN_NUEVO.lng }, ADMIN)

    const place = await leerPlace()
    expect(place.googlePlaceId).toBeNull()
    expect(place.googleMatchStatus).toBe('pending')
    expect(place.googleMatchedAt).toBeNull()
  })

  it('cambiar el nombre también lo invalida (entra en el textQuery del matching)', async () => {
    if (!hayDb) return

    await corregirDatos(placeId, { fuente: FUENTE, name: `${PREFIJO} Otro nombre` }, ADMIN)
    expect((await leerPlace()).googlePlaceId).toBeNull()
  })

  it('con status `manual` NO lo toca: lo fijó un humano', async () => {
    if (!hayDb) return

    await resetearPlace({ googleMatchStatus: 'manual' })
    await corregirDatos(placeId, { fuente: FUENTE, lat: PIN_NUEVO.lat, lng: PIN_NUEVO.lng }, ADMIN)

    const place = await leerPlace()
    expect(place.googlePlaceId).toBe('ChIJ__test__')
    expect(place.googleMatchStatus).toBe('manual')
  })

  it('con status `blocked` tampoco: ese valor dice "no reintentar nunca"', async () => {
    if (!hayDb) return

    await resetearPlace({ googleMatchStatus: 'blocked' })
    await corregirDatos(placeId, { fuente: FUENTE, lat: PIN_NUEVO.lat, lng: PIN_NUEVO.lng }, ADMIN)
    expect((await leerPlace()).googleMatchStatus).toBe('blocked')
  })

  it('cambiar SOLO la dirección no invalida el match: el pin no se movió', async () => {
    if (!hayDb) return

    await corregirDatos(placeId, { fuente: FUENTE, address: 'Av. Juan B. Justo 2959' }, ADMIN)

    const place = await leerPlace()
    expect(place.googlePlaceId).toBe('ChIJ__test__')
    expect(place.googleMatchStatus).toBe('matched')
  })
})

describe.runIf(process.env.DATABASE_URL)('soltarCampo — decisión 10', () => {
  it('saca el campo de la lista, deja bitácora y NO cambia el valor', async () => {
    if (!hayDb) return

    await corregirDatos(placeId, { fuente: FUENTE, address: 'Av. Juan B. Justo 2959' }, ADMIN)
    const res = await soltarCampo(placeId, 'address', ADMIN)
    expect(res.ok).toBe(true)

    const place = await leerPlace()
    expect(place.lockedFields).toEqual([])
    expect(place.address).toBe('Av. Juan B. Justo 2959')

    const edicion = await ultimaEdicion()
    expect(edicion.campos.address?.soltado).toBe(true)
  })

  it('un campo que no estaba fijado da NO_FIJADO', async () => {
    if (!hayDb) return
    const res = await soltarCampo(placeId, 'lat', ADMIN)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.code).toBe('NO_FIJADO')
  })
})

describe.runIf(process.env.DATABASE_URL)('proponerCorreccion — el dueño propone', () => {
  it('crea la propuesta pendiente y NO toca places (decisión 11)', async () => {
    if (!hayDb) return

    const res = await proponerCorreccion(dueno, placeId, {
      fuente: FUENTE,
      address: 'Av. Juan B. Justo 2959',
    })
    expect(res.ok).toBe(true)

    const place = await leerPlace()
    expect(place.address).toBe('Pringles 1249')
    expect(place.lockedFields).toEqual([])

    const edicion = await ultimaEdicion()
    expect(edicion.status).toBe('pending')
    expect(edicion.origen).toBe('owner')
    expect(edicion.requestedBy).toBe(dueno)
  })

  it('la segunda propuesta con una pendiente da YA_PENDIENTE, sin fila nueva (decisión 17)', async () => {
    if (!hayDb) return

    await proponerCorreccion(dueno, placeId, { fuente: FUENTE, address: 'Av. Juan B. Justo 2959' })
    const res = await proponerCorreccion(dueno, placeId, { fuente: FUENTE, address: 'Otra 123' })

    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.code).toBe('YA_PENDIENTE')

    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(placeDataEdits)
      .where(eq(placeDataEdits.placeId, placeId))
    expect(n).toBe(1)
  })

  it('el dueño NO puede proponer el name: el schema lo rechaza (decisión 12)', async () => {
    if (!hayDb) return

    const res = await proponerCorreccion(dueno, placeId, {
      fuente: FUENTE,
      name: 'Nombre secuestrado',
      address: 'Av. Juan B. Justo 2959',
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.code).toBe('INVALID')

    expect((await leerPlace()).name).toBe(`${PREFIJO} Matienzo`)
    expect(await ultimaEdicion()).toBeUndefined()
  })

  it('quien no es dueño aprobado no puede proponer nada', async () => {
    if (!hayDb) return

    const res = await proponerCorreccion(ajeno, placeId, {
      fuente: FUENTE,
      address: 'Av. Juan B. Justo 2959',
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.code).toBe('NO_AUTORIZADO')
    expect(await ultimaEdicion()).toBeUndefined()
  })
})

describe.runIf(process.env.DATABASE_URL)('decidirCorreccion — el admin resuelve la cola', () => {
  it('aprobar aplica los valores, fija los campos y cierra la misma fila', async () => {
    if (!hayDb) return

    const propuesta = await proponerCorreccion(dueno, placeId, {
      fuente: FUENTE,
      address: 'Av. Juan B. Justo 2959',
      lat: PIN_NUEVO.lat,
      lng: PIN_NUEVO.lng,
    })
    if (!propuesta.ok) throw new Error('la propuesta no se creó')

    const res = await decidirCorreccion(propuesta.data.edicionId, { accion: 'approve' }, ADMIN)
    expect(res.ok).toBe(true)

    const place = await leerPlace()
    expect(place.address).toBe('Av. Juan B. Justo 2959')
    expect(place.lat).toBeCloseTo(PIN_NUEVO.lat, 6)
    expect([...place.lockedFields].sort()).toEqual(['address', 'lat', 'lng'])
    // El pin se movió: el match de Google se invalida igual que en el camino admin.
    expect(place.googlePlaceId).toBeNull()

    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(placeDataEdits)
      .where(and(eq(placeDataEdits.placeId, placeId), eq(placeDataEdits.status, 'approved')))
    expect(n).toBe(1)
  })

  it('rechazar deja places intacto y guarda el motivo', async () => {
    if (!hayDb) return

    const propuesta = await proponerCorreccion(dueno, placeId, {
      fuente: FUENTE,
      address: 'Av. Juan B. Justo 2959',
    })
    if (!propuesta.ok) throw new Error('la propuesta no se creó')

    const res = await decidirCorreccion(
      propuesta.data.edicionId,
      { accion: 'reject', motivo: 'No pudimos verificarlo.' },
      ADMIN,
    )
    expect(res.ok).toBe(true)

    expect((await leerPlace()).address).toBe('Pringles 1249')
    const edicion = await ultimaEdicion()
    expect(edicion.status).toBe('rejected')
    expect(edicion.adminNotes).toBe('No pudimos verificarlo.')
  })

  it('decidir dos veces la misma propuesta no la re-aplica', async () => {
    if (!hayDb) return

    const propuesta = await proponerCorreccion(dueno, placeId, {
      fuente: FUENTE,
      address: 'Av. Juan B. Justo 2959',
    })
    if (!propuesta.ok) throw new Error('la propuesta no se creó')

    await decidirCorreccion(propuesta.data.edicionId, { accion: 'approve' }, ADMIN)
    const otra = await decidirCorreccion(propuesta.data.edicionId, { accion: 'approve' }, ADMIN)

    expect(otra.ok).toBe(false)
    if (!otra.ok) expect(otra.code).toBe('YA_DECIDIDA')
  })
})
