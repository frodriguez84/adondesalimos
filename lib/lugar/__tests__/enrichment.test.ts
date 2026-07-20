import { describe, expect, it, vi } from 'vitest'
import {
  dentroDeVentanaReintento,
  planDeMatching,
  resolverEnriquecimiento,
  type EnrichmentDeps,
  type PlaceEnrichment,
} from '../enrichment'
import type { GoogleEnriquecimiento } from '@/lib/google/types'

/**
 * El camino del gasto (FICHA, § Camino de la request). Puro e inyectable: se
 * verifica sin red ni DB que **ningún camino sin datos llama a Google** y que el
 * tope de cuota corta ANTES de disparar Place Details. Es la prueba de que $0 no
 * se vuelve factura.
 */

const DETALLE: GoogleEnriquecimiento = {
  horarios: { abierto: true, semana: ['lunes: 9–18'] },
  rating: 4.3,
  userRatingCount: 128,
  priceLevel: '$$',
  googleMapsUri: 'https://maps.google.com/?cid=1',
}

function lugar(over: Partial<PlaceEnrichment> = {}): PlaceEnrichment {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'La Fábrica del Taco',
    address: 'Gorriti 5548',
    locality: 'Villa Crespo',
    lat: -34.6,
    lng: -58.44,
    googlePlaceId: null,
    googleMatchStatus: 'pending',
    googleMatchedAt: null,
    ...over,
  }
}

/** Deps con espías; los defaults simulan "todo sale bien y hay cuota". */
function deps(over: Partial<EnrichmentDeps> = {}): EnrichmentDeps {
  return {
    place: lugar(),
    retryDays: 30,
    detailsCap: 5000,
    ahora: new Date('2026-07-20T12:00:00Z'),
    resolvePlaceId: vi.fn(async () => 'ChIJnuevo'),
    fetchDetails: vi.fn(async () => DETALLE),
    contarUso: vi.fn(async () => 0),
    incrementarUso: vi.fn(async () => {}),
    persistMatch: vi.fn(async () => {}),
    persistNotFound: vi.fn(async () => {}),
    ...over,
  }
}

describe('planDeMatching — estados de match (decisión 10)', () => {
  const base = {
    googlePlaceId: 'ChIJx',
    matchedAt: null,
    retryDays: 30,
    ahora: new Date('2026-07-20T00:00:00Z'),
  }

  it('blocked ⇒ sin-datos (no reintentar nunca)', () => {
    expect(planDeMatching({ ...base, status: 'blocked' })).toBe('sin-datos')
  })

  it('manual con id ⇒ usar-existente; sin id ⇒ sin-datos (el resolver no lo pisa)', () => {
    expect(planDeMatching({ ...base, status: 'manual' })).toBe('usar-existente')
    expect(planDeMatching({ ...base, status: 'manual', googlePlaceId: null })).toBe('sin-datos')
  })

  it('matched con id ⇒ usar-existente', () => {
    expect(planDeMatching({ ...base, status: 'matched' })).toBe('usar-existente')
  })

  it('pending ⇒ resolver', () => {
    expect(planDeMatching({ ...base, status: 'pending', googlePlaceId: null })).toBe('resolver')
  })

  it('not_found dentro de la ventana ⇒ sin-datos; pasada ⇒ resolver', () => {
    const reciente = new Date('2026-07-19T00:00:00Z') // 1 día atrás, ventana 30
    const viejo = new Date('2026-06-01T00:00:00Z') // >30 días
    expect(
      planDeMatching({ ...base, status: 'not_found', googlePlaceId: null, matchedAt: reciente }),
    ).toBe('sin-datos')
    expect(
      planDeMatching({ ...base, status: 'not_found', googlePlaceId: null, matchedAt: viejo }),
    ).toBe('resolver')
  })
})

describe('dentroDeVentanaReintento', () => {
  const ahora = new Date('2026-07-20T00:00:00Z')
  it('sin fecha de intento ⇒ false (se permite reintentar)', () => {
    expect(dentroDeVentanaReintento(null, 30, ahora)).toBe(false)
  })
  it('1 día atrás con ventana 30 ⇒ true (todavía no toca)', () => {
    expect(dentroDeVentanaReintento(new Date('2026-07-19T00:00:00Z'), 30, ahora)).toBe(true)
  })
  it('40 días atrás con ventana 30 ⇒ false (ya toca)', () => {
    expect(dentroDeVentanaReintento(new Date('2026-06-10T00:00:00Z'), 30, ahora)).toBe(false)
  })
})

describe('resolverEnriquecimiento — ningún camino sin datos gasta', () => {
  it('blocked ⇒ 204 sin resolver ni pedir Details', async () => {
    const d = deps({ place: lugar({ googleMatchStatus: 'blocked' }) })
    const res = await resolverEnriquecimiento(d)
    expect(res.status).toBe(204)
    expect(d.resolvePlaceId).not.toHaveBeenCalled()
    expect(d.fetchDetails).not.toHaveBeenCalled()
    expect(d.incrementarUso).not.toHaveBeenCalled()
  })

  it('not_found reciente ⇒ 204 sin resolver', async () => {
    const d = deps({
      place: lugar({ googleMatchStatus: 'not_found', googleMatchedAt: new Date('2026-07-19T12:00:00Z') }),
    })
    const res = await resolverEnriquecimiento(d)
    expect(res.status).toBe(204)
    expect(d.resolvePlaceId).not.toHaveBeenCalled()
  })

  it('manual ⇒ usa el id fijado y NUNCA llama al resolver', async () => {
    const d = deps({ place: lugar({ googleMatchStatus: 'manual', googlePlaceId: 'ChIJmanual' }) })
    const res = await resolverEnriquecimiento(d)
    expect(res.status).toBe(200)
    expect(d.resolvePlaceId).not.toHaveBeenCalled()
    expect(d.fetchDetails).toHaveBeenCalledWith('ChIJmanual')
  })

  it('pending ⇒ resuelve, persiste matched y pide Details', async () => {
    const d = deps()
    const res = await resolverEnriquecimiento(d)
    expect(res.status).toBe(200)
    expect(d.resolvePlaceId).toHaveBeenCalledOnce()
    expect(d.persistMatch).toHaveBeenCalledWith(d.place.id, 'ChIJnuevo')
    expect(d.fetchDetails).toHaveBeenCalledWith('ChIJnuevo')
  })

  it('pending sin match en Google ⇒ persiste not_found y 204 sin pedir Details', async () => {
    const d = deps({ resolvePlaceId: vi.fn(async () => null) })
    const res = await resolverEnriquecimiento(d)
    expect(res.status).toBe(204)
    expect(d.persistNotFound).toHaveBeenCalledWith(d.place.id)
    expect(d.fetchDetails).not.toHaveBeenCalled()
    expect(d.incrementarUso).not.toHaveBeenCalled()
  })

  it('tope de cuota superado ⇒ 204 SIN llamar a Details ni incrementar', async () => {
    const d = deps({
      place: lugar({ googleMatchStatus: 'matched', googlePlaceId: 'ChIJx' }),
      detailsCap: 100,
      contarUso: vi.fn(async () => 100),
    })
    const res = await resolverEnriquecimiento(d)
    expect(res.status).toBe(204)
    expect(d.fetchDetails).not.toHaveBeenCalled()
    expect(d.incrementarUso).not.toHaveBeenCalled()
  })

  it('tope en 0 apaga el enriquecimiento sin tocar Google (decisión 19)', async () => {
    const d = deps({
      place: lugar({ googleMatchStatus: 'matched', googlePlaceId: 'ChIJx' }),
      detailsCap: 0,
      contarUso: vi.fn(async () => 0),
    })
    const res = await resolverEnriquecimiento(d)
    expect(res.status).toBe(204)
    expect(d.fetchDetails).not.toHaveBeenCalled()
  })

  it('con cuota ⇒ incrementa ANTES de llamar a Details (contar de más, no de menos)', async () => {
    const orden: string[] = []
    const d = deps({
      place: lugar({ googleMatchStatus: 'matched', googlePlaceId: 'ChIJx' }),
      incrementarUso: vi.fn(async () => {
        orden.push('incrementar')
      }),
      fetchDetails: vi.fn(async () => {
        orden.push('fetch')
        return DETALLE
      }),
    })
    const res = await resolverEnriquecimiento(d)
    expect(res).toEqual({ status: 200, data: DETALLE })
    expect(orden).toEqual(['incrementar', 'fetch'])
  })

  it('Details que falla/tarda (null) ⇒ 204 aunque ya se haya contado', async () => {
    const d = deps({
      place: lugar({ googleMatchStatus: 'matched', googlePlaceId: 'ChIJx' }),
      fetchDetails: vi.fn(async () => null),
    })
    const res = await resolverEnriquecimiento(d)
    expect(res.status).toBe(204)
    expect(d.incrementarUso).toHaveBeenCalledOnce()
  })
})
