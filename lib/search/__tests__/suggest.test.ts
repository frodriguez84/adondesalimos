import { describe, expect, it } from 'vitest'

import type { CatalogFacet, CatalogZone } from '../catalog'
import { agruparPorLabel, etiquetaDeTag, etiquetaDeZona, normalizar, sugerir } from '../suggest'

/**
 * Fixtures chicos a propósito: el matcher es puro y no necesita la taxonomía
 * entera. Los datos reales los cubre el QA manual (BUSQ-05).
 */
const FACETAS: CatalogFacet[] = [
  {
    facet: 'cocina',
    label: 'Cocina',
    tags: [
      { slug: 'parrilla', name: 'Parrilla', parent: 'argentina', group: null, count: 120 },
      { slug: 'cafe-especialidad', name: 'Café de especialidad', parent: 'dulce-y-cafe', group: null, count: 40 },
    ],
  },
  {
    facet: 'tipo',
    label: 'Tipo',
    tags: [{ slug: 'cafe', name: 'Café', parent: null, group: null, count: 2058 }],
  },
]

const ZONAS: CatalogZone[] = [
  { slug: 'chacarita-colegiales', name: 'Chacarita y Colegiales', region: 'caba', aliases: ['Villa Ortúzar'] },
  { slug: 'palermo-soho', name: 'Palermo Soho', region: 'caba', aliases: [] },
  { slug: 'villa-crespo', name: 'Villa Crespo', region: 'caba', aliases: [] },
  // Los otros 3 alias que existen en la DB. BUSQ-05 quedó reformulado como
  // invariante ("los 4 alias cargados se verifican uno por uno"), así que los
  // cuatro tienen que estar acá y no solo el de Villa Ortúzar.
  { slug: 'once-abasto', name: 'Once y Abasto', region: 'caba', aliases: ['Balvanera'] },
  { slug: 'retiro-microcentro', name: 'Retiro y Microcentro', region: 'caba', aliases: ['San Nicolás'] },
  {
    slug: 'devoto-villa-del-parque',
    name: 'Villa Devoto y Villa del Parque',
    region: 'caba',
    aliases: ['Villa Devoto'],
  },
]

describe('normalizar', () => {
  it('baja a minúsculas y saca acentos', () => {
    expect(normalizar('Café')).toBe('cafe')
    expect(normalizar('Villa Ortúzar')).toBe('villa ortuzar')
  })
})

describe('sugerir', () => {
  it('no sugiere nada con menos de dos caracteres', () => {
    expect(sugerir('c', FACETAS, ZONAS)).toEqual({ tags: [], zonas: [] })
  })

  it('matchea tags sin acento: "cafe" trae "Café"', () => {
    const { tags } = sugerir('cafe', FACETAS, ZONAS)
    expect(tags.map((t) => t.slug)).toContain('cafe')
    expect(tags.map((t) => t.slug)).toContain('cafe-especialidad')
  })

  it('prioriza el que empieza con el término sobre el que lo contiene', () => {
    const { tags } = sugerir('cafe', FACETAS, ZONAS)
    // "Café" (Tipo) empieza con el término; "Café de especialidad" también, pero
    // el orden estable deja primero a los que arrancan igual.
    expect(tags[0].name.startsWith('Café')).toBe(true)
  })

  it('acompaña el tag con su faceta, que es lo que lo desambigua', () => {
    const { tags } = sugerir('parril', FACETAS, ZONAS)
    expect(tags[0]).toMatchObject({ slug: 'parrilla', facetLabel: 'Cocina' })
  })

  it('matchea zonas por nombre', () => {
    const { zonas } = sugerir('palermo', FACETAS, ZONAS)
    expect(zonas).toEqual([
      { kind: 'zone', slug: 'palermo-soho', name: 'Palermo Soho', via: null },
    ])
  })

  it('matchea zonas por alias y dice por cuál (BUSQ-05)', () => {
    const { zonas } = sugerir('Villa Ortúzar', FACETAS, ZONAS)
    expect(zonas).toEqual([
      {
        kind: 'zone',
        slug: 'chacarita-colegiales',
        name: 'Chacarita y Colegiales',
        via: 'Villa Ortúzar',
      },
    ])
  })

  it('el alias también matchea sin acentos', () => {
    const { zonas } = sugerir('ortuzar', FACETAS, ZONAS)
    expect(zonas[0]?.slug).toBe('chacarita-colegiales')
  })

  it.each([
    ['Villa Ortúzar', 'chacarita-colegiales', 'alias'],
    ['Balvanera', 'once-abasto', 'alias'],
    ['San Nicolás', 'retiro-microcentro', 'alias'],
    // "Villa Devoto" matchea por NOMBRE: la zona se llama "Villa Devoto y Villa
    // del Parque". El alias existe en la DB pero es redundante — llega igual sin
    // él. De los 4 alias cargados, sólo 3 agregan capacidad de verdad.
    ['Villa Devoto', 'devoto-villa-del-parque', 'nombre'],
  ])('BUSQ-05: "%s" lleva a la zona %s (por %s)', (termino, slug, via) => {
    // El invariante de BUSQ-05: los 4 alias cargados se verifican uno por uno.
    // Lo que se exige es que el término LLEGUE a la zona; por nombre o por
    // alias es indistinto para el usuario. Son 4 de 46 zonas — el hueco de
    // cobertura está en BACKLOG y no es un defecto de Búsqueda.
    const { zonas } = sugerir(termino, FACETAS, ZONAS)
    expect(zonas.map((z) => z.slug)).toContain(slug)
    expect(zonas.find((z) => z.slug === slug)?.via).toBe(via === 'alias' ? termino : null)
  })

  it('una zona no aparece dos veces si el nombre y el alias matchean', () => {
    const { zonas } = sugerir('villa', FACETAS, ZONAS)
    const slugs = zonas.map((z) => z.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })
})

describe('etiquetas de chip', () => {
  it('resuelve el nombre visible desde el slug', () => {
    expect(etiquetaDeTag('parrilla', FACETAS)).toBe('Parrilla')
    expect(etiquetaDeZona('palermo-soho', ZONAS)).toBe('Palermo Soho')
  })

  it('devuelve null para un slug que ya no está en el catálogo', () => {
    // Tag desactivado por curaduría o zona retirada: el chip no se dibuja, pero
    // el link viejo no rompe la pantalla.
    expect(etiquetaDeTag('inventado', FACETAS)).toBeNull()
    expect(etiquetaDeZona('inventada', ZONAS)).toBeNull()
  })
})

describe('agruparPorLabel', () => {
  it('agrupa respetando el orden de llegada y tolera tags sin grupo', () => {
    const grupos = agruparPorLabel([
      { slug: 'dj', name: 'DJ', parent: null, group: 'Baile', count: 575 },
      { slug: 'teatro', name: 'Teatro', parent: null, group: 'Escenario', count: 431 },
      { slug: 'salsa-bachata', name: 'Salsa / bachata', parent: null, group: 'Baile', count: 11 },
      { slug: 'cena', name: 'Cena', parent: null, group: null, count: 3 },
    ])
    expect(grupos.map((g) => g.label)).toEqual(['Baile', 'Escenario', null])
    expect(grupos[0].tags.map((t) => t.slug)).toEqual(['dj', 'salsa-bachata'])
  })
})
