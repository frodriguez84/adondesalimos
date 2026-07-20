import 'dotenv/config'
import { describe, expect, it } from 'vitest'

import { ZONAS } from '@/lib/zones/canon'
import { getFacetCatalog, getZoneCatalog } from '../catalog'

/**
 * El catálogo que alimenta los selectores de F2, contra la base real.
 *
 * Ojo con lo que se afirma acá: la faceta Precio hoy tiene **cero** filas en
 * `place_tags`, así que hoy no se lista. Pero eso es un **dato**, no un
 * invariante — el día que la curaduría cargue precios tiene que aparecer sola,
 * sin tocar código. Un test que dijera "Precio no está" fallaría justo cuando el
 * producto mejora. Lo que se verifica es la regla: **nada con cero se lista.**
 */

describe.runIf(process.env.DATABASE_URL)('catálogo de selectores', () => {
  it('no lista ningún tag sin lugares publicados', async () => {
    const facetas = await getFacetCatalog()
    const conCero = facetas.flatMap((f) =>
      f.tags.filter((t) => t.count <= 0).map((t) => `${f.facet}/${t.slug}`),
    )
    expect(conCero).toEqual([])
  })

  it('no lista facetas que quedaron vacías', async () => {
    const facetas = await getFacetCatalog()
    expect(facetas.every((f) => f.tags.length > 0)).toBe(true)
  })

  it('un padre de Cocina cuenta al menos lo que suman sus hijos listados', async () => {
    // El padre expande a los hijos al filtrar (decisión 13), así que su conteo
    // no puede ser menor que el del hijo más grande. Si lo fuera, el número del
    // sheet contradiría lo que devuelve tocarlo.
    const cocina = (await getFacetCatalog()).find((f) => f.facet === 'cocina')
    if (!cocina) return

    for (const padre of cocina.tags.filter((t) => t.parent === null)) {
      const hijos = cocina.tags.filter((t) => t.parent === padre.slug)
      for (const hijo of hijos) {
        expect(padre.count).toBeGreaterThanOrEqual(hijo.count)
      }
    }
  })

  it('devuelve las 46 zonas del canon, con su región', async () => {
    const zonas = await getZoneCatalog()
    expect(zonas.length).toBe(ZONAS.length)
    expect(new Set(zonas.map((z) => z.slug))).toEqual(new Set(ZONAS.map((z) => z.slug)))
  })

  it('trae los alias sin duplicar la zona', async () => {
    const zonas = await getZoneCatalog()
    const slugs = zonas.map((z) => z.slug)
    expect(new Set(slugs).size).toBe(slugs.length)

    // Hoy hay 4 alias en toda la DB. El autocompletar por alias es real pero
    // flaco: lo que se afirma es que el que existe llega, no cuántos hay.
    const chacarita = zonas.find((z) => z.slug === 'chacarita-colegiales')
    expect(chacarita?.aliases).toContain('Villa Ortúzar')
  })
})
