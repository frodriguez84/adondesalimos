import { describe, expect, it } from 'vitest'
import { crearVotacionSchema, gestionVotacionSchema, votarSchema } from '../validacion'

/**
 * El límite de 2-5 lugares (decisión 3) se enforça acá, server-side, sobre
 * lugares **distintos**: repetir uno no cuenta doble ni cuela un 6º.
 */

// UUID v4 válido (versión 4, variante 8) — el nil UUID lo rechaza z.uuid().
const uuid = (n: number) => `0000000${n}-0000-4000-8000-000000000000`

describe('crearVotacionSchema — límites de la shortlist', () => {
  it('2 lugares distintos: válido', () => {
    const r = crearVotacionSchema.safeParse({ placeIds: [uuid(1), uuid(2)] })
    expect(r.success).toBe(true)
  })

  it('5 lugares distintos: válido', () => {
    const r = crearVotacionSchema.safeParse({ placeIds: [1, 2, 3, 4, 5].map(uuid) })
    expect(r.success).toBe(true)
  })

  it('1 lugar: rechazado', () => {
    expect(crearVotacionSchema.safeParse({ placeIds: [uuid(1)] }).success).toBe(false)
  })

  it('6 lugares distintos: rechazado', () => {
    expect(crearVotacionSchema.safeParse({ placeIds: [1, 2, 3, 4, 5, 6].map(uuid) }).success).toBe(
      false,
    )
  })

  it('duplicados se deduplican antes de contar: 3 con 1 repetido = 2 distintos, válido', () => {
    const r = crearVotacionSchema.safeParse({ placeIds: [uuid(1), uuid(1), uuid(2)] })
    expect(r.success).toBe(true)
    expect(r.success && r.data.placeIds).toEqual([uuid(1), uuid(2)])
  })

  it('duplicados que dejan menos de 2 distintos: rechazado', () => {
    expect(crearVotacionSchema.safeParse({ placeIds: [uuid(1), uuid(1)] }).success).toBe(false)
  })

  it('un id que no es UUID: rechazado', () => {
    expect(crearVotacionSchema.safeParse({ placeIds: ['no-es-uuid', uuid(2)] }).success).toBe(false)
  })

  it('el título es opcional y se recorta', () => {
    const r = crearVotacionSchema.safeParse({ placeIds: [uuid(1), uuid(2)], title: '  Viernes  ' })
    expect(r.success && r.data.title).toBe('Viernes')
  })
})

describe('votarSchema', () => {
  it('exige una opción con forma de UUID', () => {
    expect(votarSchema.safeParse({ optionId: uuid(1) }).success).toBe(true)
    expect(votarSchema.safeParse({ optionId: 'x' }).success).toBe(false)
  })
})

describe('gestionVotacionSchema — cerrar / cancelar', () => {
  it('cerrar exige el ganador elegido', () => {
    expect(gestionVotacionSchema.safeParse({ accion: 'close', winnerPlaceId: uuid(1) }).success).toBe(
      true,
    )
    expect(gestionVotacionSchema.safeParse({ accion: 'close' }).success).toBe(false)
  })

  it('cancelar no lleva nada', () => {
    expect(gestionVotacionSchema.safeParse({ accion: 'cancel' }).success).toBe(true)
  })

  it('una acción desconocida se rechaza', () => {
    expect(gestionVotacionSchema.safeParse({ accion: 'borrar' }).success).toBe(false)
  })
})
