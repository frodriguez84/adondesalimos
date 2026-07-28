import 'dotenv/config'
import type Anthropic from '@anthropic-ai/sdk'
import { getAnthropic } from '@/lib/ai/client'
import { getChatModel } from '@/lib/ai/settings'
import { buildSystemPrompt } from '@/lib/ai/prompts'
import { BUSCAR_LUGARES_TOOL, ejecutarBuscarLugares } from '@/lib/ai/tools'
import type { ChatModo } from '@/lib/db/schema'

/**
 * Termómetro de calidad de búsqueda del chat IA — red de regresión MANUAL.
 *
 * Reusa los módulos reales (system prompt + tool `buscar_lugares` + motor + modelo de
 * runtime, hoy Sonnet 5 vía app_settings) y corre casos single-turn. Por cada caso
 * imprime los tool-inputs que eligió el modelo (+ nº de resultados) y el texto final, y
 * verifica chequeos DUROS sobre los tool-inputs — la clase de bug que se arregla desde el
 * prompt (sobre-filtrado), no desde el motor. La voz se juzga a ojo (es producto).
 *
 * POR QUÉ EXISTE: el bug de la faceta `precio` (empujaba `precio-1/2` sobre una faceta
 * vacía → 0) vivió meses en el prompt sin que nada lo midiera. Esto lo hubiera cazado.
 *
 * CUÁNDO CORRERLO: después de tocar `lib/ai/prompts.ts`, o cuando cambie la densidad del
 * catálogo (curaduría nueva). **Cuesta tokens reales (Sonnet).** No es CI, es a mano.
 *
 * USO:  npm run eval:chat   (o: npx tsx scripts/eval-chat.ts)
 * Sale con código 1 si algún chequeo duro falla (posible regresión).
 */

/** Slugs de la faceta Ambiente (para detectar que no se cuele en una actividad puntual). */
const AMBIENTE = new Set([
  'tranqui', 'movido', 'romantico', 'grupos-grandes', 'aire-libre', 'terraza-rooftop',
  'kids-friendly', 'tematico', 'con-vista', 'speakeasy', 'bar-notable', 'reserva-necesaria',
])

type Llamada = { zonas: string[]; tags: string[]; n: number }
type Chequeo = { nombre: string; ok: (calls: Llamada[]) => boolean }

type Caso = { msg: string; modo?: ChatModo; checks?: Chequeo[] }

const sinPrecio: Chequeo = {
  nombre: 'no filtra por precio (faceta vacía en el catálogo)',
  ok: (calls) => !calls.some((c) => c.tags.some((t) => /^precio-/.test(t))),
}

const CASOS: Caso[] = [
  {
    msg: 'una parrilla barata en Caballito',
    checks: [sinPrecio],
  },
  {
    msg: 'algo barato para comer con amigos en Palermo',
    checks: [sinPrecio],
  },
  {
    msg: 'una sala de escape para ir con hermanos y primos por Caballito',
    checks: [
      {
        nombre: 'escape-room devuelve resultados (no da 0 por sobre-filtrado)',
        ok: (calls) => calls.some((c) => c.tags.includes('escape-room') && c.n > 0),
      },
      {
        nombre: 'no le suma tag de ambiente a la actividad puntual',
        ok: (calls) =>
          !calls.some((c) => c.tags.includes('escape-room') && c.tags.some((t) => AMBIENTE.has(t))),
      },
    ],
  },
  { msg: 'somos como 20, buscamos algo para un cumpleaños en Palermo' },
  { msg: 'che, ¿me tirás algo tranqui para charlar por Villa Crespo?' },
  { msg: 'un lugar para tomar una birra con amigos en Villa Crespo' },
]

const MAX_RONDAS = 5

function slugsDe(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

async function correrCaso(modo: ChatModo, userMsg: string) {
  const anthropic = getAnthropic()
  const model = await getChatModel()
  const system = buildSystemPrompt(modo)
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userMsg }]

  let fullText = ''
  const llamadas: Llamada[] = []

  for (let ronda = 0; ronda < MAX_RONDAS; ronda++) {
    const msg = await anthropic.messages.create({
      model,
      max_tokens: 1024,
      system,
      tools: [BUSCAR_LUGARES_TOOL],
      messages,
    })

    for (const b of msg.content) {
      if (b.type === 'text') fullText += (fullText ? '\n' : '') + b.text
    }
    if (msg.stop_reason !== 'tool_use') break

    messages.push({ role: 'assistant', content: msg.content })
    const toolResults: Anthropic.ToolResultBlockParam[] = []
    for (const b of msg.content) {
      if (b.type !== 'tool_use') continue
      if (b.name === 'buscar_lugares') {
        const input = (b.input ?? {}) as Record<string, unknown>
        const { resultados } = await ejecutarBuscarLugares(b.input)
        llamadas.push({ zonas: slugsDe(input.zonas), tags: slugsDe(input.tags), n: resultados.length })
        toolResults.push({ type: 'tool_result', tool_use_id: b.id, content: JSON.stringify(resultados) })
      }
    }
    messages.push({ role: 'user', content: toolResults })
  }

  return { fullText, llamadas }
}

async function main() {
  const model = await getChatModel()
  console.log(`\n=== EVAL chat — modelo runtime: ${model} ===\n`)

  let fallos = 0
  for (const caso of CASOS) {
    const modo: ChatModo = caso.modo ?? 'chat'
    console.log('━'.repeat(80))
    console.log(`USER (${modo}): ${caso.msg}`)
    const { fullText, llamadas } = await correrCaso(modo, caso.msg)

    llamadas.forEach((c, i) =>
      console.log(`  tool[${i}] → zonas=${JSON.stringify(c.zonas)} tags=${JSON.stringify(c.tags)} ⇒ ${c.n} resultados`),
    )
    if (llamadas.length === 0) console.log('  (sin llamadas a tool)')

    for (const chk of caso.checks ?? []) {
      const paso = chk.ok(llamadas)
      if (!paso) fallos++
      console.log(`  ${paso ? '✅' : '❌'} ${chk.nombre}`)
    }

    console.log('  TEXTO (voz — juzgar a ojo):')
    console.log(fullText.split('\n').map((l) => '    ' + l).join('\n'))
    console.log('')
  }

  console.log('━'.repeat(80))
  if (fallos === 0) {
    console.log('✅ Todos los chequeos duros PASARON.')
    process.exit(0)
  }
  console.log(`❌ ${fallos} chequeo(s) duro(s) FALLARON — posible regresión de sobre-filtrado.`)
  process.exit(1)
}

main()
