import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { area, featureCollection, intersect } from '@turf/turf'
import type { Feature, MultiPolygon, Polygon } from 'geojson'
import { describe, expect, it } from 'vitest'
import { TOTAL_ZONAS, ZONAS, ZONAS_POR_REGION } from '../canon'

/**
 * Verifica los 46 archivos de `data/zones/` sin tocar la base ni las fuentes
 * (que no se versionan: 15 MB). Lo que hace falta para comprobar las particiones
 * lo estampa el build en `properties.particion`.
 */

const DIR = join(process.cwd(), 'data', 'zones')

function zona(slug: string): Feature<Polygon | MultiPolygon> {
  return JSON.parse(readFileSync(join(DIR, `${slug}.geojson`), 'utf-8'))
}

describe('canon de zonas', () => {
  it('tiene las 46 zonas con los conteos por región del spec', () => {
    expect(ZONAS).toHaveLength(TOTAL_ZONAS)
    for (const [region, esperado] of Object.entries(ZONAS_POR_REGION)) {
      expect(ZONAS.filter((z) => z.region === region)).toHaveLength(esperado)
    }
  })

  it('no repite slugs — son contrato y viven en URLs', () => {
    expect(new Set(ZONAS.map((z) => z.slug)).size).toBe(TOTAL_ZONAS)
  })
})

describe('archivos de data/zones', () => {
  it('existe un archivo por zona del canon y declara su propio slug', () => {
    for (const z of ZONAS) {
      const path = join(DIR, `${z.slug}.geojson`)
      expect(existsSync(path), `falta ${z.slug}.geojson`).toBe(true)
      const f = zona(z.slug)
      expect(f.properties?.slug).toBe(z.slug)
      expect(f.properties?.region).toBe(z.region)
      expect(['Polygon', 'MultiPolygon']).toContain(f.geometry.type)
      expect(area(f)).toBeGreaterThan(0)
    }
  })

  it('CABA suma la superficie real de la ciudad (~203 km²)', () => {
    const total = ZONAS.filter((z) => z.region === 'caba').reduce((s, z) => s + area(zona(z.slug)), 0)
    // Si un merge se comiera o duplicara un barrio, este número se movería.
    expect(total / 1e6).toBeGreaterThan(200)
    expect(total / 1e6).toBeLessThan(207)
  })
})

describe('particiones exactas', () => {
  // Agrupa las zonas por la base que particionan, según lo que estampó el build.
  const grupos = new Map<string, { slugs: string[]; areaBase: number }>()
  for (const z of ZONAS) {
    const p = zona(z.slug).properties?.particion as { base: string; areaBaseM2: number } | undefined
    if (!p) continue
    const g = grupos.get(p.base) ?? { slugs: [], areaBase: p.areaBaseM2 }
    g.slugs.push(z.slug)
    grupos.set(p.base, g)
  }

  it('encuentra las particiones esperadas', () => {
    expect([...grupos.keys()].sort()).toEqual(['Lomas de Zamora', 'Palermo', 'San Isidro'])
    expect(grupos.get('Palermo')!.slugs).toHaveLength(4)
  })

  for (const [base, { slugs, areaBase }] of grupos) {
    it(`${base}: las ${slugs.length} zonas suman el área de la base (sin huecos)`, () => {
      const suma = slugs.reduce((s, slug) => s + area(zona(slug)), 0)
      // 0.1% de tolerancia: es aritmética de punto flotante sobre miles de
      // vértices, no margen para un hueco real (que sería de km²).
      expect(Math.abs(suma - areaBase) / areaBase).toBeLessThan(0.001)
    })

    it(`${base}: las zonas no se solapan entre sí`, () => {
      for (let i = 0; i < slugs.length; i++) {
        for (let j = i + 1; j < slugs.length; j++) {
          const cruce = intersect(featureCollection([zona(slugs[i]), zona(slugs[j])]))
          const solape = cruce ? area(cruce) : 0
          // Comparten borde, así que la intersección puede no ser null; lo que
          // no puede es tener superficie.
          expect(solape, `${slugs[i]} ∩ ${slugs[j]}`).toBeLessThan(1)
        }
      }
    })
  }
})
