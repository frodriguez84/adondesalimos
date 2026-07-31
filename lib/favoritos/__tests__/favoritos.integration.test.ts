import 'dotenv/config'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { and, eq, like, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { placeImpressionsDaily, placeListItems, placeLists, places, users } from '@/lib/db/schema'
import { getConfidenceThreshold } from '@/lib/db/settings'
import { guardarLugar, sacarLugar, NOMBRE_LISTA_DEFAULT } from '../acciones'
import {
  getMaxListasPremium,
  listasVisibles,
  maxListasDelUsuario,
  MAX_LISTAS_FREE,
} from '../planes'
import { guardadosDeLaPagina } from '../query'
import { registrarGuardado } from '@/lib/search/impressions'

/**
 * Favoritos F1 contra la base. Lo que ningún helper puro puede probar:
 *
 * - la default nace **lazy**, en el primer guardado, y **una sola** (decisión 2),
 * - guardar es **idempotente** (decisión 8 del DoD; índice único),
 * - **nunca** se escribe en la lista de otro usuario (DoD § seguridad),
 * - **bajar de plan oculta, no borra**, y volver a premium devuelve todo intacto
 *   (decisión 4) — el invariante más caro de romper,
 * - el estado por página **no cuenta** lo guardado en listas escondidas,
 * - sacar **no descuenta** `saves` (decisión 12).
 */

const PREFIJO = '__test_fav__'
const EMAIL = '__test_fav__duenio@ejemplo.com'
const EMAIL_AJENO = '__test_fav__ajeno@ejemplo.com'

let hayDb = true
let userId = ''
let ajenoId = ''
let lugares: string[] = []

async function limpiar() {
  await db.delete(users).where(like(users.email, `${PREFIJO}%`))
  await db.delete(places).where(like(places.name, `${PREFIJO}%`))
}

/** Vuelve al plan free sin tocar nada más (el gate sale de `users.plan`). */
async function setPlan(id: string, plan: 'free' | 'premium') {
  await db.update(users).set({ plan }).where(eq(users.id, id))
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
      { email: EMAIL, name: 'Dueño', emailVerified: true },
      { email: EMAIL_AJENO, name: 'Ajeno', emailVerified: true },
    ])
    .returning({ id: users.id, email: users.email })
  userId = insertados.find((u) => u.email === EMAIL)!.id
  ajenoId = insertados.find((u) => u.email === EMAIL_AJENO)!.id
})

afterAll(async () => {
  if (hayDb) await limpiar()
})

beforeEach(async () => {
  if (!hayDb) return
  await db.delete(placeLists).where(eq(placeLists.userId, userId))
  await db.delete(placeLists).where(eq(placeLists.userId, ajenoId))
  await db.delete(places).where(like(places.name, `${PREFIJO}%`))
  await setPlan(userId, 'free')

  const insertados = await db
    .insert(places)
    .values(
      [0, 1, 2].map((i) => ({
        name: `${PREFIJO}lugar ${i}`,
        source: 'overture' as const,
        confidence: 0.9,
        lat: -34.6037,
        lng: -58.3816,
      })),
    )
    .returning({ id: places.id })
  lugares = insertados.map((p) => p.id)
})

describe.skipIf(!process.env.DATABASE_URL)('favoritos — guardar y sacar', () => {
  it('la lista default nace en el primer guardado, no antes (decisión 2)', async () => {
    if (!hayDb) return
    const antes = await db.select().from(placeLists).where(eq(placeLists.userId, userId))
    expect(antes).toHaveLength(0)

    const r = await guardarLugar(userId, { placeId: lugares[0] })
    expect(r.ok).toBe(true)

    const despues = await db.select().from(placeLists).where(eq(placeLists.userId, userId))
    expect(despues).toHaveLength(1)
    expect(despues[0].isDefault).toBe(true)
    expect(despues[0].name).toBe(NOMBRE_LISTA_DEFAULT)
  })

  it('guardar dos veces el mismo lugar no duplica y no rompe (FAV-08)', async () => {
    if (!hayDb) return
    const primera = await guardarLugar(userId, { placeId: lugares[0] })
    const segunda = await guardarLugar(userId, { placeId: lugares[0] })

    expect(primera.ok && primera.data.nuevo).toBe(true)
    // La segunda no es un evento nuevo: por eso `saves` no vuelve a sumar.
    expect(segunda.ok && segunda.data.nuevo).toBe(false)

    const items = await db
      .select()
      .from(placeListItems)
      .where(eq(placeListItems.placeId, lugares[0]))
    expect(items).toHaveLength(1)
  })

  it('dos guardados simultáneos no crean dos listas default', async () => {
    if (!hayDb) return
    // El índice único parcial es la red; el lock `FOR UPDATE` sobre el usuario es
    // lo que evita que una de las dos requests muera con un 500.
    const [a, b] = await Promise.all([
      guardarLugar(userId, { placeId: lugares[0] }),
      guardarLugar(userId, { placeId: lugares[1] }),
    ])
    expect(a.ok).toBe(true)
    expect(b.ok).toBe(true)

    const listas = await db.select().from(placeLists).where(eq(placeLists.userId, userId))
    expect(listas).toHaveLength(1)
  })

  it('no se puede guardar en la lista de otro usuario (FAV-11)', async () => {
    if (!hayDb) return
    await guardarLugar(ajenoId, { placeId: lugares[0] })
    const [listaAjena] = await db.select().from(placeLists).where(eq(placeLists.userId, ajenoId))
    expect(listaAjena).toBeDefined()

    const r = await guardarLugar(userId, { placeId: lugares[1], listId: listaAjena.id })
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.code).toBe('LISTA_NO_ENCONTRADA')

    // Y nada escrito en la lista ajena.
    const items = await db
      .select()
      .from(placeListItems)
      .where(eq(placeListItems.listId, listaAjena.id))
    expect(items.map((i) => i.placeId)).toEqual([lugares[0]])
  })

  it('tampoco se puede sacar de la lista de otro usuario', async () => {
    if (!hayDb) return
    await guardarLugar(ajenoId, { placeId: lugares[0] })
    const [listaAjena] = await db.select().from(placeLists).where(eq(placeLists.userId, ajenoId))

    const r = await sacarLugar(userId, { placeId: lugares[0], listId: listaAjena.id })
    expect(r.ok).toBe(false)

    const items = await db
      .select()
      .from(placeListItems)
      .where(eq(placeListItems.listId, listaAjena.id))
    expect(items).toHaveLength(1)
  })

  it('un lugar inexistente se rechaza (decisión 16: existe, no publicado)', async () => {
    if (!hayDb) return
    const r = await guardarLugar(userId, {
      placeId: '00000000-0000-4000-8000-000000000000',
    })
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.code).toBe('LUGAR_INEXISTENTE')
  })

  it('sacar algo que no estaba guardado es idempotente, no un error', async () => {
    if (!hayDb) return
    const r = await sacarLugar(userId, { placeId: lugares[0] })
    expect(r.ok).toBe(true)
    expect(r.ok && r.data.sacado).toBe(false)
  })

  it('sacar quita el ítem y el estado de la página lo refleja', async () => {
    if (!hayDb) return
    await guardarLugar(userId, { placeId: lugares[0] })
    expect(await guardadosDeLaPagina(userId, lugares)).toEqual([lugares[0]])

    const r = await sacarLugar(userId, { placeId: lugares[0] })
    expect(r.ok && r.data.sacado).toBe(true)
    expect(await guardadosDeLaPagina(userId, lugares)).toEqual([])
  })
})

describe.skipIf(!process.env.DATABASE_URL)('favoritos — plan: ocultar ≠ borrar', () => {
  /** Crea listas extra a mano: crear listas por API es F2. */
  async function sembrarListasExtra(cuantas: number) {
    await guardarLugar(userId, { placeId: lugares[0] }) // nace la default
    const extra = await db
      .insert(placeLists)
      .values(
        Array.from({ length: cuantas }, (_, i) => ({
          userId,
          name: `${PREFIJO}lista ${i}`,
          isDefault: false,
        })),
      )
      .returning({ id: placeLists.id })
    // Un ítem en cada una, para probar que los ítems también sobreviven.
    await db
      .insert(placeListItems)
      .values(extra.map((l) => ({ listId: l.id, placeId: lugares[1] })))
    return extra.map((l) => l.id)
  }

  it('free ve solo la default; premium ve todas — sin borrar una fila (FAV-06/07)', async () => {
    if (!hayDb) return
    await setPlan(userId, 'premium')
    const idsExtra = await sembrarListasExtra(2)

    expect(await listasVisibles(userId)).toHaveLength(3)

    // Baja de plan: se esconden, NO se borran.
    await setPlan(userId, 'free')
    const enFree = await listasVisibles(userId)
    expect(enFree).toHaveLength(MAX_LISTAS_FREE)
    expect(enFree[0].isDefault).toBe(true)

    const enBase = await db.select().from(placeLists).where(eq(placeLists.userId, userId))
    expect(enBase).toHaveLength(3)
    const itemsEscondidos = await db
      .select()
      .from(placeListItems)
      .where(eq(placeListItems.listId, idsExtra[0]))
    expect(itemsEscondidos).toHaveLength(1)

    // Vuelve a premium: reaparecen intactas, con sus ítems.
    await setPlan(userId, 'premium')
    expect(await listasVisibles(userId)).toHaveLength(3)
  })

  it('el cupo sale del dueño único y depende del plan (decisión 5)', async () => {
    if (!hayDb) return
    // El endpoint que crea listas es F2; en F1 el gate ya existe y es server-side:
    // este es el número que ese endpoint va a consultar, y nadie más lo decide.
    expect(await maxListasDelUsuario(userId)).toBe(MAX_LISTAS_FREE)

    await setPlan(userId, 'premium')
    const cupoPremium = await maxListasDelUsuario(userId)
    expect(cupoPremium).toBe(await getMaxListasPremium())
    expect(cupoPremium).toBeGreaterThan(MAX_LISTAS_FREE)
  })

  it('premium con dos listas guarda en la que se le indica', async () => {
    if (!hayDb) return
    await setPlan(userId, 'premium')
    const [idExtra] = await sembrarListasExtra(1)

    const r = await guardarLugar(userId, { placeId: lugares[2], listId: idExtra })
    expect(r.ok).toBe(true)
    expect(r.ok && r.data.listId).toBe(idExtra)

    const enDefault = await db
      .select()
      .from(placeListItems)
      .innerJoin(placeLists, eq(placeLists.id, placeListItems.listId))
      .where(and(eq(placeLists.userId, userId), eq(placeLists.isDefault, true)))
    expect(enDefault.map((f) => f.place_list_items.placeId)).not.toContain(lugares[2])
  })

  it('lo guardado en una lista escondida no cuenta como guardado', async () => {
    if (!hayDb) return
    await setPlan(userId, 'premium')
    await sembrarListasExtra(1)
    // `lugares[1]` está solo en la lista extra.
    expect(await guardadosDeLaPagina(userId, lugares)).toContain(lugares[1])

    await setPlan(userId, 'free')
    const enFree = await guardadosDeLaPagina(userId, lugares)
    expect(enFree).not.toContain(lugares[1])
    // El de la default sigue.
    expect(enFree).toContain(lugares[0])
  })

  it('guardar en una lista escondida por bajar de plan se rechaza', async () => {
    if (!hayDb) return
    await setPlan(userId, 'premium')
    const [idExtra] = await sembrarListasExtra(1)
    await setPlan(userId, 'free')

    const r = await guardarLugar(userId, { placeId: lugares[2], listId: idExtra })
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.code).toBe('LISTA_NO_ENCONTRADA')
  })
})

describe.skipIf(!process.env.DATABASE_URL)('favoritos — métrica agregada', () => {
  async function savesDeHoy(placeId: string): Promise<number> {
    const [fila] = await db
      .select({ saves: placeImpressionsDaily.saves })
      .from(placeImpressionsDaily)
      .where(
        and(
          eq(placeImpressionsDaily.placeId, placeId),
          eq(placeImpressionsDaily.date, sql`current_date` as unknown as string),
        ),
      )
    return fila?.saves ?? 0
  }

  it('sacar no descuenta el contador (FAV-09: histórico de eventos, no stock)', async () => {
    if (!hayDb) return
    await guardarLugar(userId, { placeId: lugares[0] })
    await registrarGuardado(lugares[0])
    expect(await savesDeHoy(lugares[0])).toBe(1)

    await sacarLugar(userId, { placeId: lugares[0] })
    expect(await savesDeHoy(lugares[0])).toBe(1)
  })

  it('la fila del contador no tiene ninguna columna con datos del usuario', async () => {
    if (!hayDb) return
    await registrarGuardado(lugares[0])
    const [fila] = await db
      .select()
      .from(placeImpressionsDaily)
      .where(eq(placeImpressionsDaily.placeId, lugares[0]))
    // Agregado puro (CLAUDE.md § Métricas agregadas): si alguna vez alguien
    // agrega un `user_id` a esta tabla, este test lo frena.
    expect(Object.keys(fila).sort()).toEqual(
      ['date', 'detailViews', 'featuredImpressions', 'impressions', 'placeId', 'saves'].sort(),
    )
  })
})
