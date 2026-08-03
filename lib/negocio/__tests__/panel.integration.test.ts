import 'dotenv/config'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { eq, inArray, like, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  placeClaims,
  placeImpressionsDaily,
  placeOwnerContent,
  placePhotos,
  placeTagImpressionsDaily,
  placeTags,
  placeTapsDaily,
  places,
  tags,
  users,
} from '@/lib/db/schema'
import { getConfidenceThreshold } from '@/lib/db/settings'
import { getPlaceDetail } from '@/lib/lugar/query'
import {
  agregarFoto,
  borrarFotosDeLugar,
  guardarContenido,
  limpiarFotosDeUsuario,
  quitarFoto,
} from '../acciones'
import { desgloseEstadisticas, getPanelLugar, misLugares, visitasDelMes } from '../query'
import { CONTENIDO_VACIO } from '../validacion'
import { semanaVacia } from '../horarios'

/**
 * F3 contra la base. Lo que se verifica acá es lo que no se puede verificar con
 * el helper puro:
 *
 * - el **gate de propiedad** de las tres escrituras (un lugar ajeno es 403),
 * - el **gating por plan server-side** (con `free`, mandar un campo pago rebota
 *   aunque la UI lo muestre bloqueado),
 * - el **cap de fotos** antes de gastar un PUT a R2,
 * - y sobre todo **la query de la pantalla**: que `getPlaceDetail` —lo que el
 *   usuario ve— muestre el contenido del dueño y lo oculte al bajar el plan.
 *
 * Ese último es la lección del H-1 de F2: el helper estaba bien y la pantalla
 * mentía. Un flag que decide qué se le ofrece al usuario se testea sobre la
 * query que dibuja la pantalla, no solo sobre el helper que la alimenta.
 */

const PREFIJO = '__test_panel__'
const EMAIL_DUENO = '__test_panel__dueno@ejemplo.com'
const EMAIL_AJENO = '__test_panel__ajeno@ejemplo.com'
const OBELISCO = { lat: -34.6037, lng: -58.3816 }

let hayDb = true
let duenoId = ''
let ajenoId = ''
let placeId = ''

async function limpiar() {
  // El contenido, las fotos, las tags y los claims caen por cascade de places.
  await db.delete(places).where(like(places.name, `${PREFIJO}%`))
  await db.delete(users).where(like(users.email, `${PREFIJO}%`))
}

/** El payload que manda el editor, con lo que cambie el caso. */
const payload = (cambios: Partial<typeof CONTENIDO_VACIO> = {}) => ({
  ...CONTENIDO_VACIO,
  ...cambios,
})

async function setPlan(plan: 'free' | 'paid') {
  await db.update(places).set({ ownerPlan: plan }).where(eq(places.id, placeId))
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
      { email: EMAIL_DUENO, name: 'Dueño', emailVerified: true },
      { email: EMAIL_AJENO, name: 'Ajeno', emailVerified: true },
    ])
    .returning({ id: users.id, email: users.email })

  duenoId = insertados.find((u) => u.email === EMAIL_DUENO)!.id
  ajenoId = insertados.find((u) => u.email === EMAIL_AJENO)!.id
})

afterAll(async () => {
  if (hayDb) await limpiar()
})

beforeEach(async () => {
  if (!hayDb) return
  await db.delete(places).where(like(places.name, `${PREFIJO}%`))

  // Publicado por confidence alta: así la ficha abre sin depender del override.
  const [place] = await db
    .insert(places)
    .values({
      source: 'overture',
      name: `${PREFIJO} Bar`,
      lat: OBELISCO.lat,
      lng: OBELISCO.lng,
      address: 'Av. Siempreviva 742',
      confidence: 0.9,
      phones: ['11 4000 0000'],
      websites: ['https://overture.example'],
      socials: ['https://instagram.com/vieja'],
    })
    .returning({ id: places.id })

  placeId = place.id

  await db.insert(placeClaims).values({
    placeId,
    userId: duenoId,
    kind: 'claim',
    status: 'approved',
    decidedAt: new Date(),
    decidedBy: 'admin@ejemplo.com',
  })
})

describe.runIf(process.env.DATABASE_URL)('panel del dueño — propiedad', () => {
  it('el dueño ve su lugar en la lista', async () => {
    const lista = await misLugares(duenoId)
    expect(lista.map((l) => l.id)).toContain(placeId)
  })

  it('un usuario sin claims no ve nada', async () => {
    expect(await misLugares(ajenoId)).toEqual([])
  })

  it('el editor de un lugar ajeno devuelve null (⇒ 404, no existe para él)', async () => {
    expect(await getPanelLugar(placeId, ajenoId)).toBeNull()
  })

  it('un placeId que no es UUID no llega a la base', async () => {
    expect(await getPanelLugar('no-es-uuid', duenoId)).toBeNull()
  })

  it('las tres escrituras rechazan a quien no es dueño', async () => {
    const guardado = await guardarContenido(ajenoId, placeId, payload({ phone: '11 1' }))
    expect(guardado.ok).toBe(false)
    expect(guardado.ok === false && guardado.code).toBe('NO_AUTORIZADO')

    const subida = await agregarFoto(ajenoId, placeId, {
      bytes: new Uint8Array([1, 2, 3]),
      tipo: 'image/jpeg',
    })
    expect(subida.ok === false && subida.code).toBe('NO_AUTORIZADO')

    const borrado = await quitarFoto(ajenoId, placeId, '00000000-0000-0000-0000-000000000000')
    expect(borrado.ok === false && borrado.code).toBe('NO_AUTORIZADO')
  })
})

describe.runIf(process.env.DATABASE_URL)('gating por plan — server-side (decisión 17)', () => {
  it('con free, mandar un campo pago rebota con 403 aunque la UI lo bloquee', async () => {
    for (const campo of ['description', 'menuUrl', 'news'] as const) {
      const valor = campo === 'menuUrl' ? 'https://carta.example' : 'algo'
      const r = await guardarContenido(duenoId, placeId, payload({ [campo]: valor }))
      expect(r.ok, `${campo} debería rebotar en free`).toBe(false)
      expect(r.ok === false && r.code).toBe('CAMPO_PAGO')
    }
  })

  it('con free, los campos pagos VACÍOS no molestan (el form manda el estado entero)', async () => {
    const r = await guardarContenido(duenoId, placeId, payload({ phone: '11 5555 5555' }))
    expect(r.ok).toBe(true)
  })

  it('con paid se guardan', async () => {
    await setPlan('paid')
    const r = await guardarContenido(
      duenoId,
      placeId,
      payload({ description: 'Un bodegón.', menuUrl: 'https://carta.example', news: 'Happy hour' }),
    )
    expect(r.ok).toBe(true)

    const [fila] = await db
      .select({ description: placeOwnerContent.description })
      .from(placeOwnerContent)
      .where(eq(placeOwnerContent.placeId, placeId))
    expect(fila.description).toBe('Un bodegón.')
  })
})

describe.runIf(process.env.DATABASE_URL)('la ficha consume el contenido del dueño', () => {
  it('el teléfono del dueño le gana al de Overture, y borrarlo devuelve el de Overture', async () => {
    const antes = await getPlaceDetail(placeId)
    expect(antes!.phone).toBe('11 4000 0000')

    await guardarContenido(duenoId, placeId, payload({ phone: '11 5555 5555' }))
    expect((await getPlaceDetail(placeId))!.phone).toBe('11 5555 5555')

    // Vaciar el campo no deja un hueco: vuelve el dato de Overture.
    await guardarContenido(duenoId, placeId, payload({ phone: '' }))
    expect((await getPlaceDetail(placeId))!.phone).toBe('11 4000 0000')
  })

  it('las redes del dueño reemplazan a las de Overture', async () => {
    await guardarContenido(duenoId, placeId, payload({ socials: ['https://instagram.com/nueva'] }))
    expect((await getPlaceDetail(placeId))!.socials).toEqual(['https://instagram.com/nueva'])
  })

  it('los huecos pagos se ven con paid y se OCULTAN al volver a free, sin borrarse', async () => {
    await setPlan('paid')
    await guardarContenido(
      duenoId,
      placeId,
      payload({ description: 'Un bodegón.', menuUrl: 'https://carta.example', news: 'Happy hour' }),
    )

    const conPlan = await getPlaceDetail(placeId)
    expect(conPlan!.description).toBe('Un bodegón.')
    expect(conPlan!.menuUrl).toBe('https://carta.example')
    expect(conPlan!.news).toBe('Happy hour')

    await setPlan('free')
    const sinPlan = await getPlaceDetail(placeId)
    expect(sinPlan!.description).toBeNull()
    expect(sinPlan!.menuUrl).toBeNull()
    expect(sinPlan!.news).toBeNull()

    // Lo guardado sigue intacto: dejar de pagar oculta, no borra (decisión 18).
    const [fila] = await db
      .select({ description: placeOwnerContent.description, news: placeOwnerContent.news })
      .from(placeOwnerContent)
      .where(eq(placeOwnerContent.placeId, placeId))
    expect(fila.description).toBe('Un bodegón.')
    expect(fila.news).toBe('Happy hour')
  })

  it('los tags del dueño se guardan con source=owner y reemplazan el set del lugar', async () => {
    const [tagBar] = await db.select({ id: tags.id }).from(tags).where(eq(tags.slug, 'bar')).limit(1)
    if (!tagBar) return // taxonomía sin sembrar

    // Una tag de import previa: el dueño la va a reemplazar.
    await db.insert(placeTags).values({ placeId, tagId: tagBar.id, source: 'import' })

    const r = await guardarContenido(duenoId, placeId, payload({ tags: ['bar', 'karaoke'] }))
    expect(r.ok && r.data.tagsGuardados).toBe(2)

    const filas = await db
      .select({ source: placeTags.source })
      .from(placeTags)
      .where(eq(placeTags.placeId, placeId))
    expect(filas).toHaveLength(2)
    expect(filas.every((f) => f.source === 'owner')).toBe(true)

    // Y la ficha —la pantalla— los muestra.
    const ficha = await getPlaceDetail(placeId)
    expect(ficha!.tags.map((t) => t.slug).sort()).toEqual(['bar', 'karaoke'])
  })

  /**
   * INT2-40. El editor muestra las de curaduría tildadas sin decir de dónde
   * vienen: guardar el teléfono no puede costar el trabajo pago de la casa (3.967
   * filas que no están en git ni en el seed). Destildarla sí la borra — es su
   * lugar.
   */
  it('una tag de curaduría sobrevive como admin si el dueño la deja tildada, y se va si la destilda', async () => {
    const elegidas = await db
      .select({ id: tags.id, slug: tags.slug })
      .from(tags)
      .where(inArray(tags.slug, ['bar', 'karaoke']))
    if (elegidas.length < 2) return // taxonomía sin sembrar

    const curada = elegidas.find((t) => t.slug === 'bar')!
    await db.insert(placeTags).values({ placeId, tagId: curada.id, source: 'admin' })

    // El dueño guarda con las dos tildadas (lo que le precargó el editor).
    await guardarContenido(duenoId, placeId, payload({ tags: ['bar', 'karaoke'] }))

    const filas = await db
      .select({ slug: tags.slug, source: placeTags.source })
      .from(placeTags)
      .innerJoin(tags, eq(tags.id, placeTags.tagId))
      .where(eq(placeTags.placeId, placeId))
    expect(filas.find((f) => f.slug === 'bar')!.source).toBe('admin')
    expect(filas.find((f) => f.slug === 'karaoke')!.source).toBe('owner')

    // Ahora la destilda: eso sí es una decisión suya sobre su lugar.
    await guardarContenido(duenoId, placeId, payload({ tags: ['karaoke'] }))

    const despues = await db
      .select({ tagId: placeTags.tagId })
      .from(placeTags)
      .where(eq(placeTags.placeId, placeId))
    expect(despues.map((f) => f.tagId)).not.toContain(curada.id)
  })

  it('un slug inventado se descarta sin romper el guardado', async () => {
    const r = await guardarContenido(duenoId, placeId, payload({ tags: ['no-existe-este-tag'] }))
    expect(r.ok && r.data.tagsGuardados).toBe(0)
  })
})

describe.runIf(process.env.DATABASE_URL)('horarios propios (decisión 20)', () => {
  const conLunes = () =>
    payload({ openingHours: { ...semanaVacia(), lunes: [{ abre: '20:00', cierra: '02:00' }] } })

  it('se guardan y la ficha los expone SOLO con dueño aprobado', async () => {
    await guardarContenido(duenoId, placeId, conLunes())

    // La pantalla (getPlaceDetail) los muestra mientras hay reclamo aprobado.
    const ficha = await getPlaceDetail(placeId)
    expect(ficha!.horariosDueno).not.toBeNull()
    expect(ficha!.horariosDueno!.lunes).toEqual([{ abre: '20:00', cierra: '02:00' }])

    // El panel los devuelve para prellenar el editor.
    const panel = await getPanelLugar(placeId, duenoId)
    expect(panel!.horarios.lunes).toEqual([{ abre: '20:00', cierra: '02:00' }])
  })

  it('revocar el reclamo los oculta en la ficha sin borrar la fila', async () => {
    await guardarContenido(duenoId, placeId, conLunes())
    await db
      .update(placeClaims)
      .set({ status: 'rejected', adminNotes: 'revocado' })
      .where(eq(placeClaims.placeId, placeId))

    // La ficha vuelve a los de Google (dueño → null), como el resto del contenido.
    expect((await getPlaceDetail(placeId))!.horariosDueno).toBeNull()

    // Pero el dato sigue guardado: volver a reclamar lo recupera.
    const [fila] = await db
      .select({ openingHours: placeOwnerContent.openingHours })
      .from(placeOwnerContent)
      .where(eq(placeOwnerContent.placeId, placeId))
    expect(fila.openingHours).toEqual({ ...semanaVacia(), lunes: [{ abre: '20:00', cierra: '02:00' }] })
  })

  it('una semana entera vacía se guarda como null ⇒ la ficha usa Google', async () => {
    // Primero cargar algo, después vaciar: el "borrar" tiene que dejar null.
    await guardarContenido(duenoId, placeId, conLunes())
    await guardarContenido(duenoId, placeId, payload({ openingHours: semanaVacia() }))

    expect((await getPlaceDetail(placeId))!.horariosDueno).toBeNull()

    const [fila] = await db
      .select({ openingHours: placeOwnerContent.openingHours })
      .from(placeOwnerContent)
      .where(eq(placeOwnerContent.placeId, placeId))
    expect(fila.openingHours).toBeNull()
  })
})

describe.runIf(process.env.DATABASE_URL)('cap de fotos (decisiones 5 y 17)', () => {
  /** Filas plantadas a mano: el cap se verifica ANTES de tocar R2. */
  async function plantarFotos(cuantas: number) {
    await db.insert(placePhotos).values(
      Array.from({ length: cuantas }, (_, i) => ({
        placeId,
        url: `https://no-es-nuestro-bucket.example/f${i}.jpg`,
        sort: i,
      })),
    )
  }

  it('la 4ª foto con plan free se rechaza sin subir nada a R2', async () => {
    await plantarFotos(3)
    const r = await agregarFoto(duenoId, placeId, {
      bytes: new Uint8Array([1, 2, 3]),
      tipo: 'image/jpeg',
    })
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.code).toBe('CAP_FOTOS')
  })

  it('con plan pago 3 fotos no llegan al tope', async () => {
    await setPlan('paid')
    await plantarFotos(3)
    const panel = await getPanelLugar(placeId, duenoId)
    expect(panel!.capFotos).toBe(15)
    expect(panel!.fotos).toHaveLength(3)
  })

  it('borrar una foto de otro lugar no se puede aunque se sepa el id', async () => {
    await plantarFotos(1)
    const [foto] = await db
      .select({ id: placePhotos.id })
      .from(placePhotos)
      .where(eq(placePhotos.placeId, placeId))

    const [otro] = await db
      .insert(places)
      .values({ source: 'overture', name: `${PREFIJO} Otro`, ...OBELISCO, confidence: 0.9 })
      .returning({ id: places.id })
    await db.insert(placeClaims).values({
      placeId: otro.id,
      userId: duenoId,
      kind: 'claim',
      status: 'approved',
    })

    // Es dueño de los dos, pero el id de la foto no es del lugar de la ruta.
    const r = await quitarFoto(duenoId, otro.id, foto.id)
    expect(r.ok === false && r.code).toBe('FOTO_NOT_FOUND')

    const quedan = await db
      .select({ id: placePhotos.id })
      .from(placePhotos)
      .where(eq(placePhotos.placeId, placeId))
    expect(quedan).toHaveLength(1)
  })
})

describe.runIf(process.env.DATABASE_URL)('teaser de estadísticas (decisión 24)', () => {
  it('suma las aperturas del mes corriente y deja afuera las del mes pasado', async () => {
    await db.insert(placeImpressionsDaily).values([
      { placeId, date: sql`date_trunc('month', current_date)::date` as unknown as string, detailViews: 5 },
      {
        placeId,
        date: sql`(date_trunc('month', current_date) - interval '1 day')::date` as unknown as string,
        detailViews: 99,
      },
    ])

    const mapa = await visitasDelMes([placeId])
    expect(mapa.get(placeId)).toBe(5)

    const [lugar] = await misLugares(duenoId)
    expect(lugar.visitasDelMes).toBe(5)
  })

  it('sin aperturas, cero (no undefined)', async () => {
    const [lugar] = await misLugares(duenoId)
    expect(lugar.visitasDelMes).toBe(0)
  })
})

describe.runIf(process.env.DATABASE_URL)('desglose pago — gate server-side (decisión 24)', () => {
  const ESTE_MES = sql`date_trunc('month', current_date)::date` as unknown as string
  const MES_PASADO = sql`(date_trunc('month', current_date) - interval '1 month')::date` as unknown as string

  it('con free no hay desglose: null (el dueño se queda con el teaser)', async () => {
    // Aunque haya datos, el gate por plan devuelve null.
    await db.insert(placeImpressionsDaily).values({ placeId, date: ESTE_MES, detailViews: 3 })
    expect(await desgloseEstadisticas(placeId)).toBeNull()
  })

  it('con paid arma vistas/impresiones vs mes anterior, taps, filtros y destaque', async () => {
    await setPlan('paid')

    await db.insert(placeImpressionsDaily).values([
      { placeId, date: ESTE_MES, impressions: 40, detailViews: 10, featuredImpressions: 6 },
      { placeId, date: MES_PASADO, impressions: 20, detailViews: 4 },
    ])
    await db.insert(placeTapsDaily).values([
      { placeId, date: ESTE_MES, kind: 'telefono', count: 7 },
      { placeId, date: ESTE_MES, kind: 'como_llegar', count: 3 },
    ])

    const [tagBar] = await db.select({ id: tags.id }).from(tags).where(eq(tags.slug, 'bar')).limit(1)
    if (tagBar) {
      await db.insert(placeTagImpressionsDaily).values({
        placeId,
        date: ESTE_MES,
        tagId: tagBar.id,
        count: 15,
      })
    }

    const d = await desgloseEstadisticas(placeId)
    expect(d).not.toBeNull()

    // Vistas e impresiones: mes corriente y el anterior, cada uno por separado.
    expect(d!.vistas).toEqual({ esteMes: 10, mesAnterior: 4 })
    expect(d!.impresiones).toEqual({ esteMes: 40, mesAnterior: 20 })

    // Los 5 taps, en orden canónico, con 0 en los que no hubo.
    expect(d!.taps.map((t) => t.kind)).toEqual(['telefono', 'como_llegar', 'website', 'redes', 'menu'])
    const porKind = new Map(d!.taps.map((t) => [t.kind, t.count]))
    expect(porKind.get('telefono')).toBe(7)
    expect(porKind.get('como_llegar')).toBe(3)
    expect(porKind.get('menu')).toBe(0)

    // Transparencia del destaque: X de Y (decisión 20).
    expect(d!.destaque).toEqual({ destacada: 6, apariciones: 40 })

    if (tagBar) {
      expect(d!.topFiltros[0]).toMatchObject({ slug: 'bar', count: 15 })
    }
  })

  it('volver a free apaga el desglose sin borrar los agregados (ocultar ≠ borrar)', async () => {
    await setPlan('paid')
    await db.insert(placeTapsDaily).values({ placeId, date: ESTE_MES, kind: 'telefono', count: 2 })
    expect(await desgloseEstadisticas(placeId)).not.toBeNull()

    await setPlan('free')
    expect(await desgloseEstadisticas(placeId)).toBeNull()

    // El agregado sigue en la base: re-suscribir lo trae de vuelta tal cual.
    const [fila] = await db
      .select({ count: placeTapsDaily.count })
      .from(placeTapsDaily)
      .where(eq(placeTapsDaily.placeId, placeId))
    expect(fila.count).toBe(2)
  })
})

describe.runIf(process.env.DATABASE_URL)('el panel arma el editor', () => {
  it('trae la base de Overture aparte de lo del dueño, para poder comparar', async () => {
    await guardarContenido(duenoId, placeId, payload({ phone: '11 5555 5555' }))
    const panel = await getPanelLugar(placeId, duenoId)
    expect(panel!.base.phone).toBe('11 4000 0000')
    expect(panel!.contenido.phone).toBe('11 5555 5555')
  })

  it('lista toda la taxonomía activa, no solo los tags con lugares', async () => {
    const panel = await getPanelLugar(placeId, duenoId)
    const todos = panel!.facetas.flatMap((f) => f.tags)
    // La faceta Precio no tiene ni una fila en `place_tags` (medición de BUSQUEDA)
    // y aun así el dueño tiene que poder tildarla.
    expect(panel!.facetas.map((f) => f.facet)).toContain('precio')
    expect(todos.length).toBeGreaterThan(50)
  })

  it('marca como elegidos los tags que el lugar ya tiene', async () => {
    await guardarContenido(duenoId, placeId, payload({ tags: ['bar'] }))
    const panel = await getPanelLugar(placeId, duenoId)
    const bar = panel!.facetas.flatMap((f) => f.tags).find((t) => t.slug === 'bar')
    if (!bar) return // taxonomía sin sembrar
    expect(bar.elegido).toBe(true)
  })
})

describe.runIf(process.env.DATABASE_URL)('el contenido del dueño sobrevive al re-import', () => {
  it('actualizar las columnas base de places no toca place_owner_content', async () => {
    await guardarContenido(duenoId, placeId, payload({ phone: '11 5555 5555' }))

    // Lo que hace el import: pisa las columnas base con lo de Overture.
    await db
      .update(places)
      .set({ phones: ['11 9999 9999'], websites: ['https://otra.example'] })
      .where(eq(places.id, placeId))

    const [fila] = await db
      .select({ phone: placeOwnerContent.phone })
      .from(placeOwnerContent)
      .where(eq(placeOwnerContent.placeId, placeId))
    expect(fila.phone).toBe('11 5555 5555')

    // Y la ficha sigue mostrando el del dueño.
    expect((await getPlaceDetail(placeId))!.phone).toBe('11 5555 5555')
  })
})

describe.runIf(process.env.DATABASE_URL)('sin dueño aprobado, el contenido deja de aplicarse', () => {
  it('revocar el reclamo devuelve la ficha a los datos de Overture, sin borrar nada', async () => {
    await guardarContenido(duenoId, placeId, payload({ phone: '11 5555 5555' }))
    expect((await getPlaceDetail(placeId))!.phone).toBe('11 5555 5555')

    // La revocación de F2: el claim aprobado pasa a `rejected`.
    await db
      .update(placeClaims)
      .set({ status: 'rejected', adminNotes: 'revocado' })
      .where(eq(placeClaims.placeId, placeId))

    const ficha = await getPlaceDetail(placeId)
    // Vuelve el de Overture: el teléfono de un ex-dueño no queda publicado.
    expect(ficha!.phone).toBe('11 4000 0000')

    // Pero el dato sigue guardado: si vuelve a reclamar, lo recupera.
    const [fila] = await db
      .select({ phone: placeOwnerContent.phone })
      .from(placeOwnerContent)
      .where(eq(placeOwnerContent.placeId, placeId))
    expect(fila.phone).toBe('11 5555 5555')
  })
})

describe.runIf(process.env.DATABASE_URL)('limpieza al eliminar la cuenta del dueño', () => {
  it('borra las filas de sus fotos (no cuelgan del usuario, no caen por cascade)', async () => {
    await db.insert(placePhotos).values({
      placeId,
      url: 'https://no-es-nuestro-bucket.example/a.jpg',
      sort: 0,
    })

    await limpiarFotosDeUsuario(duenoId)

    const quedan = await db
      .select({ id: placePhotos.id })
      .from(placePhotos)
      .where(eq(placePhotos.placeId, placeId))
    expect(quedan).toHaveLength(0)
  })

  it('un usuario sin lugares no rompe ni borra nada ajeno', async () => {
    await db.insert(placePhotos).values({
      placeId,
      url: 'https://no-es-nuestro-bucket.example/b.jpg',
      sort: 0,
    })

    await limpiarFotosDeUsuario(ajenoId)

    const quedan = await db
      .select({ id: placePhotos.id })
      .from(placePhotos)
      .where(eq(placePhotos.placeId, placeId))
    expect(quedan).toHaveLength(1)
  })
})

describe.runIf(process.env.DATABASE_URL)('borrado destructivo de las fotos de un lugar', () => {
  it('borra las de ese lugar y no toca las de otro', async () => {
    const [otro] = await db
      .insert(places)
      .values({
        source: 'overture',
        name: `${PREFIJO} Otro`,
        lat: OBELISCO.lat,
        lng: OBELISCO.lng,
        confidence: 0.9,
      })
      .returning({ id: places.id })

    // URLs fuera de nuestro bucket: `claveDeUrl` devuelve null y no se llama a
    // R2 (mismo truco que los tests de limpieza al eliminar la cuenta).
    await db.insert(placePhotos).values([
      { placeId, url: 'https://no-es-nuestro-bucket.example/a.jpg', sort: 0 },
      { placeId, url: 'https://no-es-nuestro-bucket.example/b.jpg', sort: 1 },
      { placeId: otro.id, url: 'https://no-es-nuestro-bucket.example/c.jpg', sort: 0 },
    ])

    const { filas, objetos } = await borrarFotosDeLugar(placeId)
    expect(filas).toBe(2)
    // Ninguna URL era del bucket, así que no había objeto que borrar.
    expect(objetos).toBe(0)

    const quedan = await db
      .select({ placeId: placePhotos.placeId })
      .from(placePhotos)
      .where(inArray(placePhotos.placeId, [placeId, otro.id]))
    expect(quedan.map((f) => f.placeId)).toEqual([otro.id])
  })

  it('un lugar sin fotos no rompe: cero filas, cero objetos', async () => {
    expect(await borrarFotosDeLugar(placeId)).toEqual({ filas: 0, objetos: 0 })
  })
})

describe.runIf(process.env.DATABASE_URL)('limpieza en cascada', () => {
  it('borrar el lugar se lleva su contenido de dueño', async () => {
    await guardarContenido(duenoId, placeId, payload({ phone: '11 5555 5555' }))
    await db.delete(places).where(eq(places.id, placeId))

    const filas = await db
      .select({ placeId: placeOwnerContent.placeId })
      .from(placeOwnerContent)
      .where(eq(placeOwnerContent.placeId, placeId))
    expect(filas).toHaveLength(0)
  })
})
