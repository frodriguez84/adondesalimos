'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import { ArrowLeft, History, ListChecks, Loader2, Plus, Send, Sparkles, Trash2, X } from 'lucide-react'

import { BotonGuardar } from '@/components/favoritos/boton-guardar'
import { cobroApagado } from '@/lib/billing/apagado'
import { PlaceCard } from '@/components/shared/place-card'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import type { ListaDestino } from '@/lib/favoritos/query'
import { MAX_OPCIONES, MIN_OPCIONES, SHORTLIST_STORAGE_KEY } from '@/lib/votaciones/constantes'
import { cn } from '@/lib/utils'

/**
 * Cliente del chat IA (CHAT_IA F2). Consume el endpoint SSE que dejó F1
 * (`POST /api/chat`) — no toca el motor, el cupo ni el grounding: solo pinta.
 *
 * Eventos del stream (contrato F1): `{text}` (deltas), `{estado:'buscando'}`
 * (mientras corre una tool), `{lugares:[...]}` (cards validadas), `{restantes}`
 * (cupo tras el turno) y `[DONE]`. El id de la conversación viaja en el header
 * `X-Conversation-Id` para retomar el hilo.
 *
 * Gating (decisión 20): el server decide en cada request; acá se refleja el estado
 * inicial y las respuestas 401/403/503. Optimista al mandar, pero si el server
 * rechaza o la IA falla se **revierte** el mensaje en la UI (el backend ya revirtió
 * el cupo — "su mensaje no figura y el cupo no bajó").
 *
 * Markdown SIN HTML crudo (decisión 23): `react-markdown` sin `rehype-raw`. Los
 * marcadores `[[lugar:id]]` de grounding se sacan del texto visible (la prosa ya
 * nombra el lugar) y los lugares se muestran como cards que linkean a la ficha.
 *
 * Modo shortlist (F3, decisión 21): al entrar por `/chat?modo=shortlist` (botón de
 * `/votacion/nueva`), el primer mensaje crea la conversación en ese modo (la
 * directiva 2-5 del prompt la aplica F1/F2) y cada respuesta con 2-5 lugares ofrece
 * "Usar esta shortlist" → guarda los lugares en `sessionStorage` y vuelve a
 * `/votacion/nueva`, que los precarga. Los ids se revalidan al crear (VOTACION d.12).
 */

type Lugar = {
  id: string
  nombre: string
  zona: string | null
  tags: string[]
  direccion: string | null
}

type Mensaje = {
  role: 'user' | 'assistant'
  content: string
  lugares: Lugar[]
}

type Conversacion = {
  id: string
  titulo: string | null
  modo: string
  updatedAt: string
}

type Props = {
  plan: 'premium' | 'trial'
  restantesIniciales: number
  cupoTotal: number
  /** 'shortlist' cuando se entra desde el botón de VOTACION (decisión 21). */
  modo: 'chat' | 'shortlist'
}

/** Saca los marcadores `[[lugar:id]]` del texto visible (completos y el parcial del final del stream). */
function limpiarMarcadores(texto: string): string {
  return texto
    .replace(/\s?\[\[lugar:[^\]]+\]\]/g, '')
    .replace(/\s?\[\[lugar:[^\]]*$/g, '')
}

/**
 * Las 4 de arranque. Además de dar un empujón, **enseñan a preguntar**: mucha
 * gente no sabe cómo hablarle a la IA, y lo que se pone acá es lo que después
 * escribe.
 *
 * La de plan es deliberada: el chat es la única superficie donde un combo ("cenar
 * y después bailar") se puede pedir, porque son **dos búsquedas** y un chip solo
 * sabe aplicar tags a la URL. Está acá para medir si la gente lo usa antes de
 * decidir qué superficie merece — no hay nada en el prompt que sepa de "planes":
 * el modelo encadena dos `buscar_lugares` por su cuenta.
 *
 * **Regla al tocar esta lista (PBETA-R5-01):** la app elige el tema y gasta el
 * único mensaje gratis, así que cada sugerencia tiene que caer sobre tags
 * **densos**. Las viejas colgaban de tags de ambiente que casi no están curados
 * —`romantico` 71 lugares en todo AMBA, `wifi-trabajar` 218— y el modelo terminaba
 * contestando que el catálogo no cubre el barrio, que es mentira y es la peor
 * primera impresión posible. Antes de cambiar una, contá los lugares del tag y de
 * la zona en la base.
 */
const SUGERENCIAS = [
  'Armame un plan: cenar y después bailar en Palermo',
  'Una birra por Villa Crespo',
  'Un café de especialidad por Belgrano',
  'Algo con música en vivo por San Telmo',
]

export function ChatClient({ plan, restantesIniciales, cupoTotal, modo }: Props) {
  const router = useRouter()
  const [mensajes, setMensajes] = React.useState<Mensaje[]>([])
  const [conversationId, setConversationId] = React.useState<string | null>(null)
  const [conversaciones, setConversaciones] = React.useState<Conversacion[]>([])
  const [input, setInput] = React.useState('')
  const [streaming, setStreaming] = React.useState(false)
  const [buscando, setBuscando] = React.useState(false)
  const [restantes, setRestantes] = React.useState(restantesIniciales)
  const [error, setError] = React.useState<string | null>(null)
  const [gateCode, setGateCode] = React.useState<'CHAT_PAUSADO' | null>(null)
  const [historialAbierto, setHistorialAbierto] = React.useState(false)
  const [cargandoConv, setCargandoConv] = React.useState(false)
  // Modo del hilo abierto (persiste en DB). Al retomar una conversación shortlist,
  // el botón "Usar esta shortlist" debe seguir apareciendo aunque la URL no lleve
  // `?modo=shortlist`. Nulo = hilo nuevo → manda el modo de la URL.
  const [convModo, setConvModo] = React.useState<'chat' | 'shortlist' | null>(null)
  const modoEfectivo = convModo ?? modo

  const scrollRef = React.useRef<HTMLDivElement>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  // Lista de conversaciones al montar (decisión 19).
  React.useEffect(() => {
    fetch('/api/chat/conversaciones')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.data) setConversaciones(j.data)
      })
      .catch(() => {})
  }, [])

  // FAVORITOS F2: guardar desde el chat es el gesto más natural de todos —la
  // persona acaba de pedir recomendaciones—, pero acá las cards llegan por
  // streaming y el estado no puede resolverse server-side como en la home
  // (decisión 9). Se pide **por lote**: una query por tanda de cards nuevas,
  // nunca una por card. Los ids ya consultados no se vuelven a pedir.
  const [guardados, setGuardados] = React.useState<Set<string>>(new Set())
  const [listas, setListas] = React.useState<ListaDestino[]>([])
  const consultados = React.useRef<Set<string>>(new Set())

  React.useEffect(() => {
    const nuevos = [
      ...new Set(mensajes.flatMap((m) => m.lugares.map((l) => l.id))),
    ].filter((id) => !consultados.current.has(id))
    if (nuevos.length === 0) return
    nuevos.forEach((id) => consultados.current.add(id))

    fetch(`/api/favoritos?ids=${nuevos.join(',')}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j?.data) return
        setGuardados((prev) => new Set([...prev, ...(j.data.guardados as string[])]))
        setListas(j.data.listas as ListaDestino[])
      })
      .catch(() => {})
  }, [mensajes])

  // Autoscroll al fondo cuando llega texto o cambia el estado.
  React.useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [mensajes, buscando, streaming])

  const sinCupo = restantes <= 0
  // Banner de bloqueo: el tope global (503) tiene precedencia; después el cupo del
  // usuario según el plan (decisión 20).
  const gate =
    gateCode === 'CHAT_PAUSADO'
      ? {
          titulo: 'El chat está descansando un rato',
          detalle: 'Se pausó por un ratito. Volvé más tarde y seguimos.',
          cta: null,
        }
      : sinCupo && plan === 'trial'
        ? cobroApagado()
          ? {
              // PBETA-R5-04: con los pagos cerrados no se ofrece un pago. El botón que
              // anota el interés vive en /cuenta (dueño único de esa acción).
              // FB-07: el copy de cara al usuario es el mismo del panel de /cuenta
              // («Avisame cuando abra»); dos copias de un copy driftean igual que
              // dos copias de una regla.
              titulo: 'Usaste tus mensajes de prueba',
              detalle: 'Todavía no abrimos los pagos. Te avisamos apenas se pueda.',
              cta: { href: '/cuenta', label: 'Avisame cuando abra' },
            }
          : {
              titulo: 'Usaste tus mensajes de prueba',
              detalle: 'Hacete premium para seguir chateando con la IA todo el mes.',
              cta: { href: '/cuenta', label: 'Hacerme premium' },
            }
        : sinCupo && plan === 'premium'
          ? {
              titulo: 'Llegaste al tope del mes',
              detalle: 'Se renueva el 1º del mes que viene. Ahí volvés a tener tus mensajes.',
              cta: null,
            }
          : null

  const inputBloqueado = streaming || gate !== null || cargandoConv

  /** Parsea el stream SSE y va actualizando el último mensaje (el placeholder del assistant). */
  async function leerStream(res: Response) {
    const reader = res.body?.getReader()
    if (!reader) throw new Error('sin body')
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const partes = buffer.split('\n\n')
      buffer = partes.pop() ?? ''
      for (const parte of partes) {
        const linea = parte.trim()
        if (!linea.startsWith('data:')) continue
        const payload = linea.slice(5).trim()
        if (payload === '[DONE]') return

        let ev: {
          text?: string
          estado?: string
          lugares?: Lugar[]
          restantes?: number
          error?: string
        }
        try {
          ev = JSON.parse(payload)
        } catch {
          continue
        }

        if (ev.error) throw new Error(ev.error)
        if (typeof ev.restantes === 'number') setRestantes(ev.restantes)
        if (ev.estado === 'buscando') setBuscando(true)
        if (ev.text) {
          const delta = ev.text
          setBuscando(false)
          setMensajes((prev) => {
            const copia = [...prev]
            const ultimo = copia[copia.length - 1]
            if (ultimo?.role === 'assistant') {
              copia[copia.length - 1] = { ...ultimo, content: ultimo.content + delta }
            }
            return copia
          })
        }
        if (ev.lugares) {
          const lugares = ev.lugares
          setBuscando(false)
          setMensajes((prev) => {
            const copia = [...prev]
            const ultimo = copia[copia.length - 1]
            if (ultimo?.role === 'assistant') {
              copia[copia.length - 1] = { ...ultimo, lugares }
            }
            return copia
          })
        }
      }
    }
  }

  async function enviar(texto: string) {
    const mensaje = texto.trim()
    if (!mensaje || inputBloqueado) return

    setError(null)
    setInput('')
    // Optimista: se agregan el mensaje del usuario y el placeholder del assistant.
    setMensajes((prev) => [
      ...prev,
      { role: 'user', content: mensaje, lugares: [] },
      { role: 'assistant', content: '', lugares: [] },
    ])
    setStreaming(true)

    // Rollback: saca el par optimista (user + assistant) que acabamos de agregar.
    const revertir = () => setMensajes((prev) => prev.slice(0, -2))

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: mensaje,
          conversationId: conversationId ?? undefined,
          // El modo solo se fija al crear la conversación (el endpoint lo ignora
          // si ya viene un id): mandarlo únicamente en el primer mensaje del hilo.
          modo: conversationId ? undefined : modo,
        }),
      })

      if (!res.ok) {
        const j = await res.json().catch(() => null)
        const code = j?.error?.code
        const msg = j?.error?.message ?? 'No pudimos procesar el mensaje.'
        revertir()
        if (code === 'CHAT_PAUSADO') setGateCode('CHAT_PAUSADO')
        else if (code === 'TRIAL_AGOTADO' || code === 'CUPO_AGOTADO') setRestantes(0)
        else setError(msg)
        setStreaming(false)
        return
      }

      // Retener el id de la conversación para el resto del hilo (header de F1). Si es
      // nueva, sumarla a la lista del historial con el título del primer mensaje.
      const nuevaConvId = res.headers.get('X-Conversation-Id')
      const esNueva = !conversationId
      if (nuevaConvId) {
        setConversationId(nuevaConvId)
        if (esNueva) {
          setConversaciones((prev) => [
            {
              id: nuevaConvId,
              titulo: mensaje.slice(0, 60),
              modo,
              updatedAt: new Date().toISOString(),
            },
            ...prev,
          ])
        }
      }

      await leerStream(res)
    } catch (e) {
      // Error de red o evento `{error}` (la IA falló): el backend ya revirtió el
      // mensaje y el cupo. Se saca el par optimista y se avisa.
      console.error('[chat] envío falló:', e)
      revertir()
      setError('No pudimos procesar el mensaje. Probá de nuevo, no te gastó ningún mensaje.')
    } finally {
      setStreaming(false)
      setBuscando(false)
    }
  }

  async function abrirConversacion(id: string) {
    setHistorialAbierto(false)
    if (id === conversationId) return
    setCargandoConv(true)
    setError(null)
    try {
      const res = await fetch(`/api/chat/conversaciones/${id}`)
      const j = await res.json().catch(() => null)
      if (!res.ok || !j?.data) {
        setError('No pudimos abrir esa conversación.')
        return
      }
      setMensajes(j.data.mensajes)
      setConversationId(id)
      setConvModo(j.data.modo === 'shortlist' ? 'shortlist' : 'chat')
    } finally {
      setCargandoConv(false)
    }
  }

  async function borrarConversacion(id: string) {
    const res = await fetch(`/api/chat/conversaciones/${id}`, { method: 'DELETE' })
    if (!res.ok) return
    setConversaciones((prev) => prev.filter((c) => c.id !== id))
    // Si era la abierta, se limpia el hilo (el cupo usado NO cambia — decisión 14).
    if (id === conversationId) {
      setConversationId(null)
      setMensajes([])
    }
  }

  function nuevaConversacion() {
    setConversationId(null)
    setConvModo(null)
    setMensajes([])
    setError(null)
    setHistorialAbierto(false)
    textareaRef.current?.focus()
  }

  // F3 (decisión 21): guarda los lugares propuestos y vuelve a `/votacion/nueva`,
  // que los precarga como opciones. Se traspasa solo lo que la card necesita para
  // mostrarse; los ids se revalidan `isPlacePublished` al crear (doble red).
  function usarShortlist(lugares: Lugar[]) {
    const shortlist = lugares.slice(0, MAX_OPCIONES).map((l) => ({
      id: l.id,
      name: l.nombre,
      zone: l.zona,
      locality: null,
      tags: [],
    }))
    try {
      sessionStorage.setItem(SHORTLIST_STORAGE_KEY, JSON.stringify(shortlist))
    } catch {
      // sessionStorage no disponible: navegamos igual, el picker arranca vacío.
    }
    router.push('/votacion/nueva')
  }

  return (
    <main className="mx-auto flex h-dvh w-full max-w-md flex-col px-4">
      {/* Header */}
      <header className="flex items-center gap-2 border-b border-border py-3">
        <Link
          href="/"
          aria-label="Volver"
          className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex items-center gap-1.5">
          <Sparkles className="size-4 text-primary" />
          <h1 className="text-base font-semibold text-foreground">Chat IA</h1>
        </div>
        <span
          className="ml-auto rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground"
          title={`Te quedan ${restantes} de ${cupoTotal} mensajes`}
        >
          {restantes === 1 ? 'Te queda 1 mensaje' : `Te quedan ${restantes} mensajes`}
        </span>
        <button
          type="button"
          onClick={nuevaConversacion}
          aria-label="Nueva conversación"
          className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Plus className="size-5" />
        </button>
        <button
          type="button"
          onClick={() => setHistorialAbierto(true)}
          aria-label="Historial de conversaciones"
          className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <History className="size-5" />
        </button>
      </header>

      {/* Hilo */}
      <div ref={scrollRef} className="flex flex-1 flex-col gap-4 overflow-y-auto py-4">
        {mensajes.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <div className="flex flex-col items-center gap-2">
              <span className="text-3xl">✨</span>
              <p className="text-sm font-medium text-foreground">
                {modo === 'shortlist' ? 'Armemos la shortlist para votar' : 'Contame qué pinta hacer'}
              </p>
              <p className="text-sm text-muted-foreground">
                {modo === 'shortlist'
                  ? 'Contame para el grupo y te armo 2 a 5 lugares para llevar a la votación.'
                  : 'Describilo con tus palabras y te tiro lugares reales.'}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {SUGERENCIAS.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={inputBloqueado}
                  onClick={() => enviar(s)}
                  className="rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground transition-colors hover:border-muted-foreground/50 disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          mensajes.map((m, i) => (
            <Burbuja
              key={i}
              mensaje={m}
              modo={modoEfectivo}
              onUsarShortlist={usarShortlist}
              guardados={guardados}
              listas={listas}
            />
          ))
        )}

        {buscando && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Buscando lugares…
          </div>
        )}
      </div>

      {/* Gate / error / input */}
      <div className="border-t border-border py-3">
        {gate && (
          <div className="mb-3 rounded-xl border border-primary/40 bg-primary/5 p-4 text-center">
            <p className="text-sm font-medium text-foreground">{gate.titulo}</p>
            <p className="mt-1 text-sm text-muted-foreground">{gate.detalle}</p>
            {gate.cta && (
              <Link
                href={gate.cta.href}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Sparkles className="size-4" />
                {gate.cta.label}
              </Link>
            )}
          </div>
        )}

        {error && (
          <p className="mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            enviar(input)
          }}
          className="flex items-end gap-2"
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              // Enter manda; Shift+Enter hace salto de línea (patrón chat).
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                enviar(input)
              }
            }}
            disabled={inputBloqueado}
            rows={1}
            maxLength={1000}
            placeholder={gate ? 'Sin mensajes disponibles' : 'Escribí qué buscás…'}
            className="max-h-32 min-h-10 flex-1 resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={inputBloqueado || input.trim().length === 0}
            aria-label="Enviar"
            className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {streaming ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" />}
          </button>
        </form>
      </div>

      {/* Historial */}
      <BottomSheet open={historialAbierto} onClose={() => setHistorialAbierto(false)}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Tus conversaciones</h2>
          <button
            type="button"
            onClick={() => setHistorialAbierto(false)}
            aria-label="Cerrar"
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary"
          >
            <X className="size-4" />
          </button>
        </div>
        {conversaciones.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Todavía no tenés conversaciones.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {conversaciones.map((c) => (
              <li key={c.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => abrirConversacion(c.id)}
                  className={cn(
                    'flex-1 truncate rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-secondary',
                    c.id === conversationId ? 'bg-secondary text-foreground' : 'text-foreground',
                  )}
                >
                  {c.titulo || 'Conversación'}
                </button>
                <button
                  type="button"
                  onClick={() => borrarConversacion(c.id)}
                  aria-label={`Borrar ${c.titulo || 'conversación'}`}
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </BottomSheet>
    </main>
  )
}

/** Una burbuja del hilo: usuario a la derecha, assistant a la izquierda con markdown + cards. */
function Burbuja({
  mensaje,
  modo,
  onUsarShortlist,
  guardados,
  listas,
}: {
  mensaje: Mensaje
  modo: 'chat' | 'shortlist'
  onUsarShortlist: (lugares: Lugar[]) => void
  guardados: Set<string>
  listas: ListaDestino[]
}) {
  if (mensaje.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
          {mensaje.content}
        </div>
      </div>
    )
  }

  const texto = limpiarMarcadores(mensaje.content).trim()
  // En modo shortlist, una respuesta con 2-5 lugares es una shortlist usable: se
  // ofrece llevarla a la votación (decisión 21). Fuera de ese rango (1 lugar, o
  // más de 5) no arma una votación válida → sin botón, la persona sigue refinando.
  const shortlistUsable =
    modo === 'shortlist' &&
    mensaje.lugares.length >= MIN_OPCIONES &&
    mensaje.lugares.length <= MAX_OPCIONES

  return (
    <div className="flex flex-col gap-2">
      {texto.length > 0 && (
        <div className="prose-chat max-w-[90%] rounded-2xl rounded-bl-sm bg-secondary px-4 py-2.5 text-sm text-secondary-foreground">
          <ReactMarkdown>{texto}</ReactMarkdown>
        </div>
      )}
      {mensaje.lugares.length > 0 && (
        <div className="flex flex-col gap-2">
          {mensaje.lugares.map((l) => (
            <PlaceCard
              key={l.id}
              id={l.id}
              name={l.nombre}
              tags={l.tags}
              location={l.zona ?? l.direccion}
              accion={
                // `/chat` solo renderiza este cliente con sesión (el gate está en
                // la página), así que acá `autenticado` es siempre true.
                <BotonGuardar
                  placeId={l.id}
                  guardadoInicial={guardados.has(l.id)}
                  autenticado
                  listas={listas}
                />
              }
            />
          ))}
        </div>
      )}
      {shortlistUsable && (
        <button
          type="button"
          onClick={() => onUsarShortlist(mensaje.lugares)}
          className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <ListChecks className="size-4" />
          Usar esta shortlist
        </button>
      )}
    </div>
  )
}
