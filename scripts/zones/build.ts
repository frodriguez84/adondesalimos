import 'dotenv/config'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { area, booleanPointInPolygon, difference, featureCollection, intersect, union } from '@turf/turf'
import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from 'geojson'
import { ZONAS, TOTAL_ZONAS, sortDe } from '@/lib/zones/canon'
import {
  BARRIOS_POR_ZONA,
  CENTROIDES_ESPERADOS,
  PALERMO,
  PARTICIONES,
  PARTIDO_POR_ZONA,
  RECORTES,
  REMANENTES,
  SIN_ZONA_ESPERADO,
  type Recorte,
} from './composicion'

/**
 * Genera los 46 GeoJSON de `data/zones/` a partir de las dos fuentes oficiales.
 *
 * Corre una sola vez y su salida se versiona (decisión 13): los archivos son el
 * artefacto, esto es cómo se reconstruyen. Las fuentes NO se versionan (15 MB);
 * cómo bajarlas está en `data/zones/README.md`.
 *
 *   CABA      → barrios de BA Data (CC BY 2.5 AR)
 *   Conurbano → ign:municipio del IGN vía WFS (Ley 27.275)
 */

const RAIZ = process.cwd()
const SOURCES = join(RAIZ, 'data', 'sources')
const SALIDA = join(RAIZ, 'data', 'zones')

type Poly = Feature<Polygon | MultiPolygon>

function leer(archivo: string): FeatureCollection {
  const path = join(SOURCES, archivo)
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as FeatureCollection
  } catch {
    throw new Error(
      `No encuentro ${path}. Bajá las fuentes con los comandos de data/zones/README.md.`,
    )
  }
}

/** Busca un feature por el valor exacto de una propiedad. Falla ruidosamente. */
function buscar(fc: FeatureCollection, prop: string, valor: string, contexto: string): Poly {
  const f = fc.features.find((x) => x.properties?.[prop] === valor)
  if (!f) throw new Error(`${contexto}: no existe ${prop}="${valor}" en la fuente`)
  return f as Poly
}

function unir(polys: Poly[], contexto: string): Poly {
  if (polys.length === 0) throw new Error(`${contexto}: nada que unir`)
  if (polys.length === 1) return polys[0]
  const u = union(featureCollection(polys))
  if (!u) throw new Error(`${contexto}: la unión dio vacío`)
  return u as Poly
}

/** Cierra el anillo dibujado a mano y lo convierte en Feature. */
function aPoligono(ring: Position[]): Poly {
  const cerrado = [...ring, ring[0]]
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [cerrado] } }
}

function recortar({ base, ring }: Recorte, bases: Map<string, Poly>, contexto: string): Poly {
  const oficial = bases.get(base)
  if (!oficial) throw new Error(`${contexto}: base desconocida "${base}"`)
  const cortado = intersect(featureCollection([aPoligono(ring), oficial]))
  if (!cortado) {
    throw new Error(
      `${contexto}: el recorte contra "${base}" dio vacío — el anillo dibujado no toca el polígono oficial`,
    )
  }
  return cortado as Poly
}

async function main() {
  console.log('Build de las 46 zonas de AMBA')
  mkdirSync(SALIDA, { recursive: true })

  const caba = leer('caba-barrios.geojson')
  const pba = leer('ign-municipios-pba.geojson')
  console.log(`Fuentes: ${caba.features.length} barrios de CABA · ${pba.features.length} partidos de PBA`)

  // Bases contra las que se recorta: barrios de CABA + partidos usados.
  const bases = new Map<string, Poly>()
  for (const f of caba.features) bases.set(String(f.properties?.nombre), f as Poly)
  for (const f of pba.features) bases.set(String(f.properties?.nam), f as Poly)

  const zonas = new Map<string, Poly>()

  // --- 1. CABA: merge de barrios -------------------------------------------
  for (const [slug, barrios] of Object.entries(BARRIOS_POR_ZONA)) {
    const polys = barrios.map((b) => buscar(caba, 'nombre', b, `zona ${slug}`))
    zonas.set(slug, unir(polys, `zona ${slug}`))
  }

  // --- 2. Conurbano: partido entero ----------------------------------------
  for (const [slug, partido] of Object.entries(PARTIDO_POR_ZONA)) {
    zonas.set(slug, buscar(pba, 'nam', partido, `zona ${slug}`))
  }

  // --- 3. Recortes a mano (Palermo + conurbano) ----------------------------
  for (const [slug, r] of Object.entries(PALERMO)) {
    zonas.set(slug, recortar(r, bases, `zona ${slug}`))
  }
  for (const [slug, recortes] of Object.entries(RECORTES)) {
    const partes = recortes.map((r) => recortar(r, bases, `zona ${slug}`))
    zonas.set(slug, unir(partes, `zona ${slug}`))
  }

  // --- 4. Remanentes: la base menos lo ya recortado de ella ----------------
  // Van al final a propósito: dependen de que los recortes ya estén resueltos.
  for (const [slug, { base, menos }] of Object.entries(REMANENTES)) {
    let resto = bases.get(base)
    if (!resto) throw new Error(`zona ${slug}: base desconocida "${base}"`)
    for (const otro of menos) {
      const quitar = zonas.get(otro)
      if (!quitar) throw new Error(`zona ${slug}: el remanente necesita "${otro}", que aún no existe`)
      const d = difference(featureCollection([resto, quitar]))
      if (!d) throw new Error(`zona ${slug}: al restar "${otro}" no quedó nada`)
      resto = d as Poly
    }
    zonas.set(slug, resto)
  }

  // --- 5. Validación -------------------------------------------------------
  const faltan = ZONAS.filter((z) => !zonas.has(z.slug)).map((z) => z.slug)
  if (faltan.length > 0) throw new Error(`Faltan ${faltan.length} zonas: ${faltan.join(', ')}`)
  if (zonas.size !== TOTAL_ZONAS) {
    throw new Error(`Se generaron ${zonas.size} zonas y el canon tiene ${TOTAL_ZONAS}`)
  }

  // El oráculo: cada localidad conocida tiene que caer en su zona.
  const errores: string[] = []
  for (const c of CENTROIDES_ESPERADOS) {
    const poly = zonas.get(c.zona)!
    if (!booleanPointInPolygon([c.lng, c.lat], poly)) {
      const cayoEn = [...zonas.entries()]
        .filter(([, p]) => booleanPointInPolygon([c.lng, c.lat], p))
        .map(([s]) => s)
      errores.push(`  ${c.nombre}: esperaba ${c.zona}, cayó en [${cayoEn.join(', ') || 'ninguna'}]`)
    }
  }
  for (const c of SIN_ZONA_ESPERADO) {
    const cayoEn = [...zonas.entries()]
      .filter(([, p]) => booleanPointInPolygon([c.lng, c.lat], p))
      .map(([s]) => s)
    if (cayoEn.length > 0) {
      errores.push(`  ${c.nombre}: no debía caer en ninguna zona, cayó en [${cayoEn.join(', ')}]`)
    }
  }
  if (errores.length > 0) {
    throw new Error(`El oráculo de centroides falló:\n${errores.join('\n')}`)
  }

  // --- 6. Escritura --------------------------------------------------------
  // Cada zona que particiona un polígono oficial se lleva el área de esa base:
  // es lo que después deja verificar la partición sin tener las fuentes.
  const particionDe = new Map<string, { base: string; areaBaseM2: number }>()
  for (const [base, miembros] of Object.entries(PARTICIONES)) {
    const oficial = bases.get(base)
    if (!oficial) throw new Error(`Partición: base desconocida "${base}"`)
    for (const slug of miembros) particionDe.set(slug, { base, areaBaseM2: area(oficial) })
  }

  let bytes = 0
  for (const z of ZONAS) {
    const geom = zonas.get(z.slug)!
    const feature: Feature = {
      type: 'Feature',
      properties: {
        slug: z.slug,
        name: z.name,
        region: z.region,
        sort: sortDe(z.slug),
        ...(particionDe.has(z.slug) ? { particion: particionDe.get(z.slug) } : {}),
      },
      geometry: geom.geometry,
    }
    const json = JSON.stringify(feature)
    writeFileSync(join(SALIDA, `${z.slug}.geojson`), json)
    bytes += json.length
  }

  // --- 7. Reporte ----------------------------------------------------------
  console.log('\n─── Reporte del build ─────────────────────')
  console.log(`Zonas generadas: ${zonas.size} / ${TOTAL_ZONAS}`)
  console.log(`Oráculo de centroides: ${CENTROIDES_ESPERADOS.length} OK · ${SIN_ZONA_ESPERADO.length} sin zona OK`)
  console.log(`Tamaño total en disco: ${(bytes / 1024 / 1024).toFixed(2)} MB`)
  console.log('\nÁrea por zona (km²):')
  for (const r of ['caba', 'norte', 'oeste', 'sur'] as const) {
    const dela = ZONAS.filter((z) => z.region === r)
    const total = dela.reduce((s, z) => s + area(zonas.get(z.slug)!) / 1e6, 0)
    console.log(`  ${r.padEnd(6)} ${dela.length} zonas · ${total.toFixed(0)} km²`)
  }
  console.log('───────────────────────────────────────────')
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
