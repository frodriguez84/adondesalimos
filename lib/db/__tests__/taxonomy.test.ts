import { describe, expect, it } from 'vitest'
import {
  ACTIVIDAD,
  AMBIENTE,
  COCINA_HIJOS,
  COCINA_PADRES,
  MOMENTO,
  PRECIO,
  TAGS_RETIRADOS,
  TAXONOMIA,
  TIPO,
  TOTAL_TAGS,
} from '../taxonomy'

describe('taxonomía canónica', () => {
  it('suma 105 filas: 96 tags + 9 padres de Cocina', () => {
    expect(TOTAL_TAGS).toBe(105)
    expect(COCINA_PADRES).toHaveLength(9)
    expect(TIPO.length + COCINA_HIJOS.length + ACTIVIDAD.length + AMBIENTE.length + PRECIO.length + MOMENTO.length).toBe(96)
  })

  it('respeta los conteos por faceta del spec', () => {
    expect(TIPO).toHaveLength(10)
    expect(COCINA_HIJOS).toHaveLength(37)
    expect(ACTIVIDAD).toHaveLength(19)
    expect(AMBIENTE).toHaveLength(17)
    expect(PRECIO).toHaveLength(4)
    expect(MOMENTO).toHaveLength(9)
  })

  it('no tiene slugs duplicados (son unique en la DB y contrato de URL)', () => {
    const slugs = TAXONOMIA.flatMap((f) => f.tags.map((t) => t.slug))
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('usa slugs válidos para URL', () => {
    const slugs = TAXONOMIA.flatMap((f) => f.tags.map((t) => t.slug))
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  it('todo hijo de Cocina apunta a un padre existente', () => {
    const padres = new Set(COCINA_PADRES.map((p) => p.slug))
    for (const hijo of COCINA_HIJOS) expect(padres).toContain(hijo.parent)
  })

  it('solo Cocina usa parent, y sus padres van antes que los hijos', () => {
    for (const { facet, tags } of TAXONOMIA) {
      if (facet === 'cocina') continue
      expect(tags.every((t) => !t.parent)).toBe(true)
    }
    const cocina = TAXONOMIA.find((f) => f.facet === 'cocina')!.tags
    const primerHijo = cocina.findIndex((t) => t.parent)
    expect(cocina.slice(0, primerHijo).every((t) => !t.parent)).toBe(true)
  })

  it('excluye heladería y panadería, y mantiene pastelería (chip Merienda)', () => {
    const slugs = TAXONOMIA.flatMap((f) => f.tags.map((t) => t.slug))
    expect(slugs).not.toContain('heladeria')
    expect(slugs).not.toContain('panaderia')
    expect(slugs).toContain('pasteleria')
  })

  it('todo tag retirado existe en la taxonomía y trae motivo', () => {
    // Un slug mal escrito en TAGS_RETIRADOS es un retiro que nunca se aplica y que
    // nadie nota: el tag sigue elegible para el sheet, las cards y el sugeridor.
    // `npm run db:retiros` también corta, pero esto no necesita base.
    const slugs = new Set(TAXONOMIA.flatMap((f) => f.tags.map((t) => t.slug)))
    for (const r of TAGS_RETIRADOS) {
      expect(slugs, `tag retirado "${r.slug}"`).toContain(r.slug)
      expect(r.motivo.length, `motivo de "${r.slug}"`).toBeGreaterThan(20)
    }
    expect(new Set(TAGS_RETIRADOS.map((r) => r.slug)).size).toBe(TAGS_RETIRADOS.length)
  })

  it('agrupa Actividad y Ambiente, que ordenan la UI', () => {
    expect(ACTIVIDAD.every((t) => t.group)).toBe(true)
    expect(AMBIENTE.every((t) => t.group)).toBe(true)
    expect(new Set(ACTIVIDAD.map((t) => t.group))).toEqual(
      new Set(['Escenario', 'Baile', 'Juegos', 'Participar', 'Mirar']),
    )
    expect(new Set(AMBIENTE.map((t) => t.group))).toEqual(new Set(['Vibra', 'Servicios']))
  })
})
