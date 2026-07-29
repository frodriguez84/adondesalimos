import type Anthropic from '@anthropic-ai/sdk'
import { inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tags } from '@/lib/db/schema'
import { getAnthropic } from '@/lib/ai/client'
import { FACETAS_SUGERIBLES } from './facetas'
import type { EvidenciaSitio } from './fetch-sitio'
import type { PlaceParaCurar } from './seleccion'

/**
 * El módulo que le pide al LLM tags de Ambiente/Momento/Actividad **con evidencia**
 * (CURADURIA, decisiones 5 y 6). Server-only por dependencia de `lib/ai/client`.
 *
 * Salida estructurada por tool-use forzado (mismo patrón que `buscar_lugares` del
 * chat): el modelo **debe** llamar `sugerir_tags`, así no hay que parsear prosa. La
 * validación de cada slug contra el vocabulario real vive acá, en el borde — el
 * modelo no elige qué taxonomía existe.
 *
 * Candado de costos y alcance (decisión "Qué NO es"): este prompt **no** recibe
 * nada de Google. Solo nombre, categoría de Overture, tags actuales y el texto de
 * la web pública del lugar.
 */

/** El vocabulario que el modelo puede sugerir: id para mapear, resto para el prompt. */
export type TagSugerible = {
  id: number
  slug: string
  name: string
  facet: string
  groupLabel: string | null
}

/** Una sugerencia ya validada contra el vocabulario. */
export type SugerenciaLLM = {
  tagId: number
  slug: string
  /** Cita textual de la fuente, o null si el modelo infirió sin fuente citable. */
  evidence: string | null
  sourceUrl: string | null
}

export type ResultadoSugerencia = {
  sugerencias: SugerenciaLLM[]
  /** Tokens de entrada **no** cacheados. El total de input suma los dos de abajo. */
  tokensIn: number
  tokensOut: number
  /** Prefijo servido desde el caché (se cobra ~0,1×). */
  cacheReadTokens: number
  /** Prefijo escrito al caché: la primera llamada de la corrida (se cobra 1,25×). */
  cacheCreationTokens: number
}

/** Máximo de tokens de la respuesta: son unas pocas sugerencias, no un ensayo. */
const MAX_TOKENS = 1024

/** Carga el vocabulario sugerible (las 3 facetas ralas) una vez por corrida. */
export async function cargarVocabulario(): Promise<TagSugerible[]> {
  return db
    .select({
      id: tags.id,
      slug: tags.slug,
      name: tags.name,
      facet: tags.facet,
      groupLabel: tags.groupLabel,
    })
    .from(tags)
    .where(inArray(tags.facet, [...FACETAS_SUGERIBLES]))
}

const SUGERIR_TAGS_TOOL: Anthropic.Tool = {
  name: 'sugerir_tags',
  description:
    'Registra las etiquetas (tags) que corresponden al lugar según la evidencia. Cada tag debe salir de la lista provista; nunca inventes slugs. Incluí la cita textual y la URL de dónde sacaste cada una.',
  input_schema: {
    type: 'object',
    properties: {
      sugerencias: {
        type: 'array',
        description:
          'Tags que aplican al lugar. Vacío si la evidencia no alcanza para sugerir ninguna con confianza.',
        items: {
          type: 'object',
          properties: {
            slug: {
              type: 'string',
              description: 'Slug exacto de la lista de tags disponibles.',
            },
            evidence: {
              type: 'string',
              description:
                'Cita textual de la fuente que respalda el tag (ej. "2x1 de 18 a 20"). Dejalo vacío SOLO si lo inferís del nombre/categoría sin una frase citable.',
            },
            source_url: {
              type: 'string',
              description: 'URL de la fuente de la cita. Vacío si no hay fuente citable.',
            },
          },
          required: ['slug'],
        },
      },
    },
    required: ['sugerencias'],
  },
}

/**
 * Exportada para poder **medirla**: el system se cachea (ver `sugerirTags`) y el
 * caching falla en silencio si el prefijo no llega al mínimo del modelo. Sin
 * acceso a la función no hay forma de verificar ese umbral.
 */
export function systemPrompt(vocab: TagSugerible[]): string {
  const porFaceta = new Map<string, TagSugerible[]>()
  for (const t of vocab) {
    const actual = porFaceta.get(t.facet) ?? []
    actual.push(t)
    porFaceta.set(t.facet, actual)
  }

  const listado = [...FACETAS_SUGERIBLES]
    .map((facet) => {
      const items = (porFaceta.get(facet) ?? [])
        .map((t) => `  - ${t.slug}${t.groupLabel ? ` (${t.groupLabel})` : ''}: ${t.name}`)
        .join('\n')
      return `${facet.toUpperCase()}:\n${items}`
    })
    .join('\n\n')

  return [
    'Sos un asistente de curaduría de un catálogo de bares, restaurantes y planes de Buenos Aires.',
    'Tu tarea: a partir de la evidencia de un lugar, sugerir qué etiquetas de Ambiente, Momento y Actividad le corresponden.',
    '',
    'Reglas estrictas:',
    '- Usá SOLO slugs de la lista de abajo. Si un slug no está en la lista, no existe: no lo sugieras.',
    '- Para cada tag, citá la frase textual de la evidencia que lo respalda y la URL de donde salió.',
    '- Si no hay una frase citable y solo lo inferís del nombre o la categoría, dejá evidence y source_url vacíos: es una sugerencia "sin evidencia", igual de válida pero se revisa distinto.',
    '- No fuerces sugerencias: si la evidencia no alcanza, devolvé una lista vacía. Es mejor no sugerir que inventar.',
    '- No repitas tags que el lugar ya tiene (te los paso como contexto).',
    '',
    'Tags disponibles:',
    listado,
  ].join('\n')
}

function userPrompt(place: PlaceParaCurar, evidencia: EvidenciaSitio[]): string {
  const partes: string[] = [
    `Lugar: ${place.name}`,
    place.overtureCategory ? `Categoría (Overture): ${place.overtureCategory}` : '',
    place.tagsExistentes.length > 0
      ? `Tags que ya tiene: ${place.tagsExistentes.map((t) => `${t.slug} (${t.facet})`).join(', ')}`
      : 'Tags que ya tiene: ninguno relevante',
    '',
  ]

  if (evidencia.length === 0) {
    partes.push(
      'No se pudo leer la web del lugar (sin sitio, o bloqueada). Sugerí solo lo que puedas inferir con seguridad del nombre y la categoría, marcándolo sin evidencia.',
    )
  } else {
    partes.push('Evidencia de la web pública del lugar:')
    for (const e of evidencia) {
      partes.push(`\n[Fuente: ${e.url}]\n${e.texto}`)
    }
  }

  return partes.filter((p) => p !== '').join('\n')
}

function limpiarTexto(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  const limpio = valor.trim()
  return limpio.length > 0 ? limpio : null
}

/**
 * Le pide al modelo las sugerencias para un lugar. Valida los slugs contra el
 * vocabulario (los inventados se descartan) y deduplica. Devuelve también los
 * tokens, para el reporte de costo de la corrida.
 */
export async function sugerirTags(
  place: PlaceParaCurar,
  evidencia: EvidenciaSitio[],
  vocab: TagSugerible[],
  model: string,
): Promise<ResultadoSugerencia> {
  const idPorSlug = new Map(vocab.map((t) => [t.slug, t.id]))
  const anthropic = getAnthropic()

  const msg = await anthropic.messages.create({
    model,
    max_tokens: MAX_TOKENS,
    // El system es IDÉNTICO en las ~1.840 llamadas de una corrida (el vocabulario
    // no cambia), así que se cachea: un write y el resto reads a 0,1× (mismo
    // criterio que `lib/ai/prompts.ts`). Sin esto la corrida de CURADURIA F3
    // reprocesó el prefijo a precio pleno 1.840 veces — ~US$6 de los US$17,62.
    // El orden de render es `tools` → `system`, así que este único breakpoint
    // cachea la tool también: no hace falta un segundo `cache_control`.
    //
    // ⚠️ MEDIDO (2026-07-29, `count_tokens`): el system son **1.260 tokens** con
    // Sonnet 5 contra un mínimo cacheable de 1.024 — 23% de margen, poco. Por
    // debajo del mínimo el caching **falla en silencio** (`cache_creation_input_
    // tokens: 0`, sin error). Dos formas de romperlo sin darse cuenta:
    //   1. Achicar el vocabulario o las reglas del prompt.
    //   2. Bajar `ai.curation_model` a Haiku 4.5 — su mínimo es 4.096 y el mismo
    //      texto le da 958 tokens (tokenizer distinto): NUNCA cachearía.
    // Si tocás alguna de las dos, volvé a medir antes de asumir el ahorro.
    system: [{ type: 'text', text: systemPrompt(vocab), cache_control: { type: 'ephemeral' } }],
    tools: [SUGERIR_TAGS_TOOL],
    tool_choice: { type: 'tool', name: 'sugerir_tags' },
    messages: [{ role: 'user', content: userPrompt(place, evidencia) }],
  })

  const bloque = msg.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'sugerir_tags',
  )

  const sugerencias: SugerenciaLLM[] = []
  const vistos = new Set<string>()
  const crudas = (bloque?.input as { sugerencias?: unknown })?.sugerencias
  if (Array.isArray(crudas)) {
    for (const cruda of crudas) {
      if (typeof cruda !== 'object' || cruda === null) continue
      const obj = cruda as Record<string, unknown>
      const slug = typeof obj.slug === 'string' ? obj.slug.trim() : ''
      const tagId = idPorSlug.get(slug)
      // Slug inventado o fuera del vocabulario: se descarta en el borde.
      if (tagId === undefined || vistos.has(slug)) continue
      vistos.add(slug)
      sugerencias.push({
        tagId,
        slug,
        evidence: limpiarTexto(obj.evidence),
        sourceUrl: limpiarTexto(obj.source_url),
      })
    }
  }

  return {
    sugerencias,
    tokensIn: msg.usage.input_tokens,
    tokensOut: msg.usage.output_tokens,
    cacheReadTokens: msg.usage.cache_read_input_tokens ?? 0,
    cacheCreationTokens: msg.usage.cache_creation_input_tokens ?? 0,
  }
}
