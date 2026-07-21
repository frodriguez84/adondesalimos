import { describe, expect, it } from 'vitest'
import { altaSchema, AMBA_BBOX, claimPayloadSchema, decisionSchema } from '../validacion'

/**
 * La validación del payload es el boundary: el formulario del cliente usa estos
 * mismos schemas, pero el que manda es el endpoint (regla global de seguridad).
 */

const solicitante = {
  applicantName: 'Fernando Rodríguez',
  applicantPhone: '11 5555 5555',
  applicantRole: 'Dueño',
}

const altaValida = {
  kind: 'new' as const,
  name: 'Bar de prueba',
  lat: -34.6037,
  lng: -58.3816,
  ...solicitante,
}

describe('claimPayloadSchema', () => {
  it('acepta un reclamo con placeId uuid', () => {
    const r = claimPayloadSchema.safeParse({
      kind: 'claim',
      placeId: '11111111-2222-4333-8444-555555555555',
      ...solicitante,
    })
    expect(r.success).toBe(true)
  })

  it('rechaza un reclamo sin placeId válido', () => {
    const r = claimPayloadSchema.safeParse({ kind: 'claim', placeId: 'no-es-uuid', ...solicitante })
    expect(r.success).toBe(false)
  })

  it('rechaza cualquier payload sin los datos del solicitante', () => {
    // Sin ellos el admin no tiene con qué verificar el vínculo (decisión 22).
    const r = claimPayloadSchema.safeParse({ ...altaValida, applicantName: '' })
    expect(r.success).toBe(false)
  })

  it('discrimina por kind: un kind desconocido no pasa', () => {
    const r = claimPayloadSchema.safeParse({ ...altaValida, kind: 'otro' })
    expect(r.success).toBe(false)
  })
})

describe('altaSchema', () => {
  it('acepta un pin dentro de AMBA', () => {
    expect(altaSchema.safeParse(altaValida).success).toBe(true)
  })

  it('rechaza un pin fuera del bbox de AMBA', () => {
    // Sin geocoder, lat/lng vienen del cliente: un payload armado a mano no
    // puede meter un lugar en otro continente.
    expect(altaSchema.safeParse({ ...altaValida, lat: 40.7, lng: -74 }).success).toBe(false)
    expect(
      altaSchema.safeParse({ ...altaValida, lng: AMBA_BBOX.xmin - 0.1 }).success,
    ).toBe(false)
    expect(
      altaSchema.safeParse({ ...altaValida, lat: AMBA_BBOX.ymax + 0.1 }).success,
    ).toBe(false)
  })

  it('recorta los espacios del nombre y exige que quede algo', () => {
    const ok = altaSchema.safeParse({ ...altaValida, name: '  Bar  ' })
    expect(ok.success && ok.data.name).toBe('Bar')
    expect(altaSchema.safeParse({ ...altaValida, name: '   ' }).success).toBe(false)
  })
})

describe('decisionSchema', () => {
  it('aprobar no lleva motivo', () => {
    expect(decisionSchema.safeParse({ accion: 'approve' }).success).toBe(true)
  })

  it('rechazar sin motivo no pasa: el motivo viaja en el mail', () => {
    expect(decisionSchema.safeParse({ accion: 'reject' }).success).toBe(false)
    expect(decisionSchema.safeParse({ accion: 'reject', motivo: '  ' }).success).toBe(false)
    expect(
      decisionSchema.safeParse({ accion: 'reject', motivo: 'No pudimos verificarlo' }).success,
    ).toBe(true)
  })
})
