import { cardsPorIds, type LugarCard } from './tools'

/**
 * Candado (b) del grounding (CHAT_IA, decisiones 2 y 11): el server valida cada
 * lugar citado en la respuesta contra el conjunto de IDs que las tools devolvieron
 * en la conversación (`seen_place_ids`). Un ID no visto se descarta y se loguea —
 * la IA no puede inventar ni aunque un prompt injection se lo pida.
 *
 * El protocolo de cita son marcadores `[[lugar:<id>]]` en el texto (decisión 11).
 */

/** `[[lugar:<id>]]` — captura el id. */
const MARCADOR = /\[\[lugar:([^\]]+)\]\]/g

export type ResultadoGrounding = {
  /** El texto con los marcadores inválidos eliminados; los válidos quedan. */
  textoLimpio: string
  /** IDs citados que sí están en el set, en orden de aparición y sin repetir. */
  idsValidos: string[]
  /** IDs citados que NO están en el set (alucinación o injection): incidentes. */
  violaciones: string[]
}

/**
 * Valida los marcadores del texto contra el set de grounding. **Pura y sin DB**:
 * es lo que se testea derecho. Un marcador válido se conserva; uno inválido se
 * elimina del texto y se registra como violación. Sin marcadores, la respuesta va
 * igual (la IA puede estar preguntando/refinando).
 */
export function validarGrounding(texto: string, seenIds: Iterable<string>): ResultadoGrounding {
  const seen = seenIds instanceof Set ? seenIds : new Set(seenIds)
  const idsValidos: string[] = []
  const violaciones: string[] = []

  const textoLimpio = texto.replace(MARCADOR, (marcadorEntero, idCrudo: string) => {
    const id = idCrudo.trim()
    if (seen.has(id)) {
      if (!idsValidos.includes(id)) idsValidos.push(id)
      return marcadorEntero // se conserva el marcador válido
    }
    if (!violaciones.includes(id)) violaciones.push(id)
    return '' // se elimina el marcador inválido
  })

  return { textoLimpio, idsValidos, violaciones }
}

/**
 * Valida + enriquece: valida los marcadores y trae las cards de los IDs válidos
 * (candado b + decisión 11). Las cards salen en el evento SSE final; el texto
 * limpio es lo que se persiste en `chat_messages.content`.
 */
export async function enriquecerCitas(
  texto: string,
  seenIds: Iterable<string>,
): Promise<{ textoLimpio: string; lugares: LugarCard[]; violaciones: string[] }> {
  const { textoLimpio, idsValidos, violaciones } = validarGrounding(texto, seenIds)
  const lugares = idsValidos.length > 0 ? await cardsPorIds(idsValidos) : []
  return { textoLimpio, lugares, violaciones }
}
