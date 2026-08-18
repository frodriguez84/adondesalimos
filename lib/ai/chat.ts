import type Anthropic from '@anthropic-ai/sdk'
import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { chatConversations, chatMessages, type ChatModo, type ChatPlan } from '@/lib/db/schema'
import { getAnthropic } from './client'
import { getChatModel } from './settings'
import { buildSystemPrompt } from './prompts'
import { BUSCAR_LUGARES_TOOL, ejecutarBuscarLugares } from './tools'
import { enriquecerCitas } from './grounding'
import { registrarImpresiones, registrarTagsDeBusqueda } from '@/lib/search/impressions'
import { resumenCupo, revertirReserva } from './cupo'
import { logChatCall } from './logging'

/**
 * Orquestación del turno del chat (CHAT_IA, decisiones 11, 16, 18): arma el
 * contexto, corre el loop de tools y streamea SSE. Devuelve un `ReadableStream`
 * con eventos `data:{text}` (deltas), `data:{estado:'buscando'}` (mientras corre
 * una tool), `data:{lugares:[...]}` (cards validadas al final), `data:{restantes}`
 * (cupo restante tras el turno, para el contador en vivo de F2) y `data:[DONE]`.
 *
 * Contexto por turno (decisión 16): system (cacheado) + últimos 12 mensajes
 * user/assistant + el loop de tools del turno actual. Los bloques tool_use/
 * tool_result de turnos viejos **no se re-envían** — el texto del assistant ya
 * nombra los lugares, y el cupo mensual no debe dejar crecer el contexto de más.
 */

/** Ventana de historial (decisión 16). */
const VENTANA = 12
/** Cota anti-loop: nunca más de estas rondas de tools por turno. */
const MAX_RONDAS_TOOL = 5
/** Respuestas de chat, no ensayos (decisión 18). */
const MAX_TOKENS = 1024

export type TurnoArgs = {
  conversationId: string
  userId: string
  esPrem: boolean
  /** El mensaje del usuario que `reservarCupo` insertó (para revertir si falla). */
  reservaMessageId: string
  plan: ChatPlan
}

function sse(obj: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(obj)}\n\n`)
}
const DONE = new TextEncoder().encode('data: [DONE]\n\n')

/** Los últimos 12 mensajes de la conversación como mensajes del SDK (texto plano). */
async function cargarHistorial(conversationId: string): Promise<Anthropic.MessageParam[]> {
  const filas = await db
    .select({ role: chatMessages.role, content: chatMessages.content })
    .from(chatMessages)
    .where(eq(chatMessages.conversationId, conversationId))
    .orderBy(desc(chatMessages.createdAt))
    .limit(VENTANA)

  return filas
    .reverse()
    .map((f) => ({ role: f.role as 'user' | 'assistant', content: f.content }))
}

/**
 * Corre el turno y devuelve el stream SSE. Si Anthropic falla **antes de contestar**,
 * revierte la reserva (mensaje + cupo, decisión 13) y emite un evento de error — el
 * usuario ve un error amable y su mensaje no consumió cupo.
 *
 * ⚠️ **Que la llamada haya salido o no cambia todo** (`SEC-06`). Antes había un
 * `try`/`catch` único que revertía la reserva ante *cualquier* excepción, sin
 * distinguir "Anthropic no respondió" (devolver el cupo es correcto) de "Anthropic
 * respondió, cobró, y falló algo posterior" (devolverlo es regalar la llamada). Y el
 * segundo caso no necesita atacante: si el cliente corta el SSE —cerrar la pestaña
 * alcanza— el `enqueue` siguiente tira `TypeError: Controller is already closed`,
 * caía al catch y le devolvía el mensaje de trial con los tokens ya facturados.
 * Leyendo el stream hasta las cards y cortando antes del `[DONE]` eso era chat
 * gratis ilimitado del lado del usuario, y quemar el tope global —`ai_api_usage`
 * **no** se revierte, a propósito— dejaba a todos con el 503 hasta el 1º.
 *
 * De ahí las tres piezas de abajo: `llamadaEmitida` marca el punto sin retorno,
 * `emitir` no revive un stream ya cerrado (era la excepción que disparaba el revert,
 * y también la que dejaba una unhandled rejection al fallar el evento de error), y
 * `cancel` aborta la llamada a Anthropic cuando el cliente se fue — antes seguía
 * generando tokens enteros para nadie.
 */
export function streamChatTurn(args: TurnoArgs): ReadableStream<Uint8Array> {
  const { conversationId, userId, esPrem, reservaMessageId, plan } = args

  /** Corta la generación cuando el cliente se va (`cancel`, más abajo). */
  const abort = new AbortController()
  /** El cliente cortó o el stream ya se cerró: no hay a dónde escribir. */
  let cerrado = false
  /**
   * `true` desde el momento en que Anthropic devolvió un mensaje completo: la
   * llamada se hizo y se facturó. A partir de acá **no se revierte el cupo**, falle
   * lo que falle después — el gasto ya ocurrió y devolverlo es regalarlo.
   *
   * Se marca en el primer `finalMessage()` y no en el primer delta: un stream que
   * se corta en la mitad de la primera ronda sí revierte, porque `cancel` ya abortó
   * la llamada y lo facturado es una fracción. Ese resto es deliberado y acotado.
   */
  let llamadaEmitida = false

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const anthropic = getAnthropic()

      /**
       * Único camino de escritura al SSE. Si el cliente ya cortó, no hace nada en vez
       * de tirar: escribirle a un controller cerrado era lo que hacía pasar una
       * desconexión por "falló el turno".
       */
      const emitir = (chunk: Uint8Array): void => {
        if (cerrado) return
        try {
          controller.enqueue(chunk)
        } catch {
          cerrado = true
        }
      }

      let fullText = ''
      let inputTokens = 0
      let outputTokens = 0
      let cacheReadTokens = 0
      let cacheCreationTokens = 0
      const idsNuevos = new Set<string>()
      // Una entrada por llamada a `buscar_lugares` de ESTE turno (todas las rondas):
      // qué ids devolvió y con qué tags se pidió. Sirve para atribuir los tags a los
      // lugares que efectivamente salieron de esa llamada (ver más abajo).
      const llamadas: { ids: string[]; tags: string[] }[] = []

      try {
        const [conv] = await db
          .select({ modo: chatConversations.modo, seen: chatConversations.seenPlaceIds })
          .from(chatConversations)
          .where(eq(chatConversations.id, conversationId))
          .limit(1)
        const modo: ChatModo = conv?.modo ?? 'chat'
        const seenPrevios = conv?.seen ?? []

        const model = await getChatModel()
        const system = buildSystemPrompt(modo)
        const messages = await cargarHistorial(conversationId)

        // Loop de tools del turno actual (decisión 2: tool-use nativo).
        for (let ronda = 0; ronda < MAX_RONDAS_TOOL; ronda++) {
          const stream = anthropic.messages.stream({
            model,
            max_tokens: MAX_TOKENS,
            system,
            tools: [BUSCAR_LUGARES_TOOL],
            messages,
          }, { signal: abort.signal })

          // El texto de esta ronda se pega al de la anterior sin separador
          // ("…para después.Uh, sin resultados…"): el modelo escribe, corre una tool
          // y sigue escribiendo, y los fragmentos se concatenan. Un salto de párrafo
          // antes del primer texto de una ronda posterior los separa.
          let primerTextoDeRonda = true
          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              let texto = event.delta.text
              if (primerTextoDeRonda && ronda > 0 && fullText.length > 0 && !fullText.endsWith('\n')) {
                texto = '\n\n' + texto
              }
              primerTextoDeRonda = false
              fullText += texto
              emitir(sse({ text: texto }))
            }
          }

          const msg = await stream.finalMessage()
          // Punto sin retorno (`SEC-06`): la llamada volvió completa, así que ya se
          // facturó. De acá en adelante, falle lo que falle, el cupo no se devuelve.
          llamadaEmitida = true
          inputTokens += msg.usage.input_tokens
          outputTokens += msg.usage.output_tokens
          // Los dos van aparte de `input_tokens` (que es el remanente NO cacheado)
          // y se cobran: read 0,1× y write 1,25×. Se acumulan para persistirlos —
          // el tablero de `/admin` lee de la base, no de este log.
          cacheReadTokens += msg.usage.cache_read_input_tokens ?? 0
          cacheCreationTokens += msg.usage.cache_creation_input_tokens ?? 0

          if (msg.stop_reason !== 'tool_use') break

          // Hay tools que ejecutar: se emite el estado y se corren.
          messages.push({ role: 'assistant', content: msg.content })
          emitir(sse({ estado: 'buscando' }))

          const toolResults: Anthropic.ToolResultBlockParam[] = []
          for (const bloque of msg.content) {
            if (bloque.type !== 'tool_use') continue
            if (bloque.name === 'buscar_lugares') {
              const { resultados, ids, tags } = await ejecutarBuscarLugares(bloque.input)
              // Evidencia para debug de calidad (sobre-filtrado): qué tags/zonas pidió el
              // modelo y cuántos resultados dio. Sin PII (solo slugs del canon).
              console.info(
                JSON.stringify({
                  type: 'chat_tool_call',
                  conversationId,
                  input: bloque.input,
                  resultados: resultados.length,
                }),
              )
              for (const id of ids) idsNuevos.add(id)
              llamadas.push({ ids, tags })
              toolResults.push({
                type: 'tool_result',
                tool_use_id: bloque.id,
                content: JSON.stringify(resultados),
              })
            } else {
              // Tool desconocida: se responde con error para que el modelo siga.
              toolResults.push({
                type: 'tool_result',
                tool_use_id: bloque.id,
                content: 'Herramienta desconocida.',
                is_error: true,
              })
            }
          }
          messages.push({ role: 'user', content: toolResults })
        }

        // Grounding (candado b) + enriquecido a cards. El set es la unión de lo ya
        // visto en la conversación + lo devuelto este turno (decisión 17).
        const setGrounding = new Set<string>([...seenPrevios, ...idsNuevos])
        const { textoLimpio, lugares, violaciones } = await enriquecerCitas(fullText, setGrounding)

        for (const idMalo of violaciones) {
          console.warn(
            JSON.stringify({
              type: 'grounding_violation',
              conversationId,
              placeId: idMalo,
            }),
          )
        }

        if (lugares.length > 0) {
          emitir(sse({ lugares }))
          // INT-05 (PULIDO): un lugar mostrado como card en el chat es tan
          // "impresión" como uno mostrado en la búsqueda — mismo agregado puro,
          // solo los efectivamente citados/mostrados (no todo lo que devolvió
          // una tool y el modelo descartó).
          void registrarImpresiones(lugares.map((l) => l.id))

          // INT2-29: "qué filtros te encontraron" también cuenta desde el chat —
          // misma tabla y misma semántica que la búsqueda, sin distinguir origen.
          //
          // La atribución es **por llamada a la tool**, no por turno: el set de
          // grounding es `seenPrevios ∪ idsNuevos`, así que un lugar citado puede
          // venir de una búsqueda de dos turnos atrás (con otros tags) y en un mismo
          // turno puede haber varias llamadas con tags distintos. Aparear "los tags
          // del turno" con "los lugares citados" escribiría datos mal. Por eso, por
          // cada llamada se registran solo sus ids que además fueron citados; un
          // lugar citado que no salió de ninguna llamada de este turno no se
          // atribuye a ningún tag.
          const citados = new Set(lugares.map((l) => l.id))
          for (const llamada of llamadas) {
            void registrarTagsDeBusqueda(
              llamada.ids.filter((id) => citados.has(id)),
              llamada.tags,
            )
          }
        }

        // Persistir el mensaje del assistant (texto ya validado) y actualizar la
        // conversación: seen_place_ids = unión, updated_at fresco.
        if (textoLimpio.trim().length > 0) {
          await db.insert(chatMessages).values({
            conversationId,
            role: 'assistant',
            content: textoLimpio,
            modelUsed: model,
            tokensIn: inputTokens,
            tokensOut: outputTokens,
            cacheReadTokens,
            cacheCreationTokens,
          })
        }
        await db
          .update(chatConversations)
          .set({ seenPlaceIds: [...setGrounding], updatedAt: sql`now()` })
          .where(eq(chatConversations.id, conversationId))

        logChatCall({ model, plan, inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens })

        // Cupo restante tras consumir este turno (F2): el cliente pinta el
        // contador en vivo sin re-fetch. `resumenCupo` lee `used` ya incrementado
        // por la reserva, así que refleja lo que queda después de este mensaje.
        try {
          const { restantes } = await resumenCupo(userId, esPrem)
          emitir(sse({ restantes }))
        } catch (e) {
          console.error('[chat] resumenCupo falló:', e)
        }

        emitir(DONE)
      } catch (err) {
        // El revert es condicional (`SEC-06`): solo si la llamada nunca llegó a
        // volver. Ahí el error es de la API o nuestro, no se gastó nada, y el cupo
        // vuelve como manda la decisión 13. Si ya había vuelto, la plata está
        // gastada: el mensaje del usuario se queda y el cupo también.
        //
        // Esto además cierra el colateral de antes: el mensaje del assistant se
        // inserta más arriba, dentro del `try`, y el revert borra el del usuario —
        // revertir después de haber contestado dejaba la conversación con una
        // respuesta sin pregunta. Ahora, en ese tramo, no se revierte.
        console.error(
          `[chat] turno falló (llamadaEmitida=${llamadaEmitida}, cliente cortó=${cerrado}):`,
          err,
        )
        if (!llamadaEmitida) {
          await revertirReserva({ userId, esPrem, messageId: reservaMessageId }).catch((e) =>
            console.error('[chat] revert falló:', e),
          )
        }
        emitir(sse({ error: 'No pudimos procesar el mensaje. Probá de nuevo.' }))
      } finally {
        // Si el cliente ya cortó, el controller está cerrado y `close()` tira.
        if (!cerrado) {
          cerrado = true
          try {
            controller.close()
          } catch {
            // Se cerró entre medio: nada que hacer, el turno ya terminó.
          }
        }
      }
    },
    /**
     * El cliente se fue (cerró la pestaña, cortó el fetch). Antes esto no existía y
     * la llamada a Anthropic seguía generando la respuesta entera para nadie
     * (`SEC-06`): se aborta, y `emitir` deja de intentar escribir.
     */
    cancel(reason) {
      cerrado = true
      abort.abort(reason)
    },
  }) as unknown as ReadableStream<Uint8Array>
}
