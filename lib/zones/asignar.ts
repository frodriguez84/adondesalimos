import { area, bbox, booleanPointInPolygon } from '@turf/turf'
import type { BBox, Feature, MultiPolygon, Polygon } from 'geojson'

/**
 * Asignación lugar→zonas — fuente única.
 *
 * La usa `zones:assign` para regenerar `place_zones` entero y (spec 5) el alta o
 * edición de un lugar de dueño, para asignar uno solo. No reimplementar la regla
 * en cada llamador.
 *
 * Sin PostGIS (decisión 12): el point-in-polygon corre acá con turf y el
 * resultado se persiste. El runtime nunca hace geometría.
 */

export type ZonaCruda = {
  id: number
  slug: string
  polygon: Polygon | MultiPolygon
  polygonSearch: Polygon | MultiPolygon
}

/** Zona con lo precalculado que hace falta para resolver muchos puntos rápido. */
export type ZonaPreparada = {
  id: number
  slug: string
  /** Área en m². Desempata la primaria cuando un punto cae en dos (decisión 18). */
  area: number
  poly: Feature<Polygon | MultiPolygon>
  polySearch: Feature<Polygon | MultiPolygon>
  caja: BBox
  cajaSearch: BBox
}

export type AsignacionLugar = {
  /** La zona que muestra la card. `null` si el punto cae fuera de todas. */
  primariaId: number | null
  /** Todas las zonas en las que el lugar aparece al buscar (incluye la primaria). */
  zonaIds: number[]
}

function aFeature(g: Polygon | MultiPolygon): Feature<Polygon | MultiPolygon> {
  return { type: 'Feature', properties: {}, geometry: g }
}

export function prepararZonas(crudas: ZonaCruda[]): ZonaPreparada[] {
  return crudas.map((z) => {
    const poly = aFeature(z.polygon)
    const polySearch = aFeature(z.polygonSearch)
    return {
      id: z.id,
      slug: z.slug,
      area: area(poly),
      poly,
      polySearch,
      caja: bbox(poly),
      cajaSearch: bbox(polySearch),
    }
  })
}

/**
 * Descarte por bounding box antes del point-in-polygon real. Sin esto, 26.000
 * lugares × 46 polígonos de miles de vértices es inviable; con esto, casi todas
 * las combinaciones mueren en 4 comparaciones.
 */
function enCaja(lng: number, lat: number, c: BBox): boolean {
  return lng >= c[0] && lng <= c[2] && lat >= c[1] && lat <= c[3]
}

export function asignarLugar(lng: number, lat: number, zonas: ZonaPreparada[]): AsignacionLugar {
  const zonaIds: number[] = []
  let primaria: ZonaPreparada | null = null

  for (const z of zonas) {
    // Primaria: polígono exacto. Si un punto cae en dos (no debería: son
    // partición), gana la de menor área — la más específica (decisión 18).
    if (enCaja(lng, lat, z.caja) && booleanPointInPolygon([lng, lat], z.poly)) {
      if (!primaria || z.area < primaria.area) primaria = z
    }
    // Búsqueda: polígono expandido 400 m. Es un superconjunto del exacto, así
    // que la primaria siempre entra por acá también.
    if (enCaja(lng, lat, z.cajaSearch) && booleanPointInPolygon([lng, lat], z.polySearch)) {
      zonaIds.push(z.id)
    }
  }

  // Defensa: si el buffer fuese más chico que el polígono por un error de
  // geometría, la primaria igual tiene que estar en la lista.
  if (primaria && !zonaIds.includes(primaria.id)) zonaIds.push(primaria.id)

  return { primariaId: primaria?.id ?? null, zonaIds }
}
