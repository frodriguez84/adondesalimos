import type Anthropic from '@anthropic-ai/sdk'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { placeTags, placeZones, places, tags, zones } from '@/lib/db/schema'
import { searchPlaces } from '@/lib/search/query'
import type { SearchParams } from '@/lib/search/params'

/**
 * La herramienta `buscar_lugares` (CHAT_IA, decisiones 2 y 9): el único camino de
 * la IA al catálogo. **Reusa el motor real**, no lo reimplementa — ejecuta
 * `searchPlaces` con los `SearchParams` que arma la IA, así visibilidad
 * (`publishedWhere`), OR-dentro-de-faceta / AND-entre-facetas, expansión de padres
 * de Cocina y orden orgánico vienen gratis y quedan consistentes con la búsqueda.
 *
 * Es el candado (a) del grounding: la IA nunca "sabe" lugares, los busca. El
 * candado (b) —validar cada cita contra los IDs devueltos— vive en `grounding.ts`.
 */

/** Lo que necesita la card del chat. Sin nada de Google (no persistible). */
export type LugarCard = {
  id: string
  nombre: string
  zona: string | null
  tags: string[]
  direccion: string | null
}

export const MAX_LIMITE = 10
const LIMITE_DEFAULT = 6

/** Definición de la tool para el SDK. `cache_control` para cachear con el system. */
export const BUSCAR_LUGARES_TOOL: Anthropic.Tool = {
  name: 'buscar_lugares',
  description:
    'Busca lugares reales del catálogo publicado (bares, restaurantes, cafés, planes) por zona y tags. Devuelve una lista de lugares con id, nombre, zona, tags y dirección. Es la ÚNICA forma de obtener lugares reales para recomendar: nunca inventes lugares, usá esta herramienta.',
  input_schema: {
    type: 'object',
    properties: {
      zonas: {
        type: 'array',
        items: { type: 'string' },
        description: 'Slugs de zonas donde buscar (del vocabulario del sistema). Vacío = sin filtro de zona.',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Slugs de tags de cualquier faceta (tipo, cocina, actividad, ambiente, precio, momento). Vacío = sin filtro de tags.',
      },
      texto: {
        type: 'string',
        description: 'Solo si la persona nombra un lugar puntual por su nombre.',
      },
      limite: {
        type: 'integer',
        description: `Cuántos lugares traer (1 a ${MAX_LIMITE}). Por defecto ${LIMITE_DEFAULT}.`,
      },
    },
    required: [],
  },
}

/** Los slugs del canon son [a-z0-9-]: se limpia lo demás en el borde (anti-basura). */
function limpiarSlugs(valor: unknown): string[] {
  if (!Array.isArray(valor)) return []
  const slugs = valor
    .filter((s): s is string => typeof s === 'string')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /^[a-z0-9-]{1,60}$/.test(s))
  return [...new Set(slugs)]
}

function limpiarLimite(valor: unknown): number {
  const n = typeof valor === 'number' ? Math.floor(valor) : LIMITE_DEFAULT
  if (!Number.isFinite(n)) return LIMITE_DEFAULT
  return Math.max(1, Math.min(MAX_LIMITE, n))
}

/**
 * Ejecuta la tool: arma `SearchParams`, corre el motor y devuelve los lugares
 * (cards) + sus IDs para acumular en el set de grounding. Sin GPS (el chat no
 * tiene coordenadas del dispositivo): zona y tags alcanzan.
 *
 * También devuelve los `tags` **ya normalizados** (los mismos que fueron al motor):
 * el chat los necesita para "qué filtros te encontraron" (INT2-29) y el canon se
 * limpia en un solo lugar — nadie re-parsea el input crudo de la tool.
 */
export async function ejecutarBuscarLugares(
  input: unknown,
): Promise<{ resultados: LugarCard[]; ids: string[]; tags: string[] }> {
  const obj = (input ?? {}) as Record<string, unknown>
  const texto = typeof obj.texto === 'string' ? obj.texto.trim() : ''

  const params: SearchParams = {
    zones: limpiarSlugs(obj.zonas),
    tags: limpiarSlugs(obj.tags),
    // Un texto de un solo caracter no discrimina y hace trabajar al trigrama de
    // gusto: mismo criterio que `parseSearchParams`.
    q: texto.length >= 2 ? texto.slice(0, 100) : null,
    gps: false,
    coords: null,
    cursor: null,
  }

  const limite = limpiarLimite(obj.limite)
  const { places: encontrados } = await searchPlaces(params)
  const cards = encontrados.slice(0, limite).map(
    (p): LugarCard => ({
      id: p.id,
      nombre: p.name,
      zona: p.zone,
      tags: p.tags.map((t) => t.name),
      direccion: p.address,
    }),
  )

  return { resultados: cards, ids: cards.map((c) => c.id), tags: params.tags }
}

/**
 * Trae las cards de un conjunto de IDs, en el orden pedido (para enriquecer las
 * citas del grounding). **No filtra por visibilidad**: un lugar del set que se
 * despublicó a mitad de charla se congela (edge case del spec) — ya estuvo en un
 * resultado de tool, la card mostrada queda; su ficha podría no abrir. Enriquecer
 * es distinto de buscar: por eso este fetch directo por id, no el motor.
 */
export async function cardsPorIds(ids: string[]): Promise<LugarCard[]> {
  if (ids.length === 0) return []

  const [filasLugar, filasZona, filasTag] = await Promise.all([
    db
      .select({ id: places.id, name: places.name, address: places.address })
      .from(places)
      .where(inArray(places.id, ids)),
    db
      .select({ placeId: placeZones.placeId, name: zones.name })
      .from(placeZones)
      .innerJoin(zones, eq(zones.id, placeZones.zoneId))
      .where(and(inArray(placeZones.placeId, ids), eq(placeZones.isPrimary, true))),
    db
      .select({ placeId: placeTags.placeId, name: tags.name, sort: tags.sort })
      .from(placeTags)
      .innerJoin(tags, eq(tags.id, placeTags.tagId))
      .where(and(inArray(placeTags.placeId, ids), eq(tags.active, true)))
      .orderBy(tags.sort),
  ])

  const zonaPorId = new Map(filasZona.map((f) => [f.placeId, f.name]))
  const tagsPorId = new Map<string, string[]>()
  for (const f of filasTag) {
    const actual = tagsPorId.get(f.placeId) ?? []
    actual.push(f.name)
    tagsPorId.set(f.placeId, actual)
  }
  const lugarPorId = new Map(filasLugar.map((f) => [f.id, f]))

  // En el orden de `ids` (orden de cita); se saltean los que ya no existen en DB.
  return ids
    .map((id) => {
      const lugar = lugarPorId.get(id)
      if (!lugar) return null
      return {
        id,
        nombre: lugar.name,
        zona: zonaPorId.get(id) ?? null,
        tags: tagsPorId.get(id) ?? [],
        direccion: lugar.address,
      } satisfies LugarCard
    })
    .filter((c): c is LugarCard => c !== null)
}
