'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, MapPin, Plus, Search, X } from 'lucide-react'

import { BottomSheet } from '@/components/ui/bottom-sheet'
import { PlaceCard } from '@/components/shared/place-card'
import { tagsDestacados, ubicacionDeCard } from '@/lib/search/card'
import type { SearchedPlace } from '@/lib/search/query'
import {
  MAX_OPCIONES_TOTAL,
  MAX_SUGERENCIAS_POR_VOTANTE,
} from '@/lib/votaciones/constantes'
import type { EstadoVisible } from '@/lib/votaciones/estado'
import type { OpcionPublica } from '@/lib/votaciones/query'

/**
 * La votación pública, del lado del cliente (F2 + SUGERIR_EN_VOTACION). Vota sin
 * cuenta (la cookie `voter_id` la maneja el endpoint) y muestra el **conteo en
 * vivo** (decisión 13): mientras está abierta poletea los resultados para que el
 * número suba solo — es el motor del loop viral ("vamos 2 a 2, voten").
 *
 * Desde SUGERIR_EN_VOTACION la **cancha también crece en vivo**: cualquiera con el
 * link suma un lugar del catálogo desde el sheet de búsqueda y el resto lo ve
 * aparecer en el próximo tick (por eso el polling trae las opciones enteras).
 *
 * Cerrada/expirada/cancelada ⇒ solo-lectura (decisión 15): sin botón de voto, sin
 * sumar, con el ganador destacado si el creador lo eligió.
 */

const POLL_MS = 4000

type Resultados = {
  estado: EstadoVisible
  totalVotos: number
  winnerPlaceId: string | null
  allowSuggestions: boolean
  opciones: OpcionPublica[]
}

export function VotacionPublicaCliente({
  token,
  estadoInicial,
  winnerPlaceId,
  totalInicial,
  opciones: opcionesIniciales,
  votedOptionIdInicial,
  allowSuggestionsInicial,
  misSugerenciasInicial,
  esCreador,
}: {
  token: string
  estadoInicial: EstadoVisible
  winnerPlaceId: string | null
  totalInicial: number
  opciones: OpcionPublica[]
  votedOptionIdInicial: string | null
  allowSuggestionsInicial: boolean
  /** Los `optionId` que sumó **este** dispositivo. Nunca viaja quién sumó qué. */
  misSugerenciasInicial: string[]
  esCreador: boolean
}) {
  const [estado, setEstado] = useState<EstadoVisible>(estadoInicial)
  const [ganador, setGanador] = useState<string | null>(winnerPlaceId)
  const [opciones, setOpciones] = useState<OpcionPublica[]>(opcionesIniciales)
  const [total, setTotal] = useState(totalInicial)
  const [votado, setVotado] = useState<string | null>(votedOptionIdInicial)
  const [votando, setVotando] = useState<string | null>(null)
  const [votoPerdido, setVotoPerdido] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [permiteSumar, setPermiteSumar] = useState(allowSuggestionsInicial)
  const [misSugerencias, setMisSugerencias] = useState<string[]>(misSugerenciasInicial)
  const [sheetAbierto, setSheetAbierto] = useState(false)
  const [recienSumada, setRecienSumada] = useState<string | null>(null)
  const [quitando, setQuitando] = useState<string | null>(null)
  const [aConfirmar, setAConfirmar] = useState<string | null>(null)

  const abierta = estado === 'open'

  const aplicarResultados = useCallback((r: Resultados) => {
    setEstado(r.estado)
    setGanador(r.winnerPlaceId)
    setTotal(r.totalVotos)
    setOpciones(r.opciones)
    setPermiteSumar(r.allowSuggestions)
  }, [])

  /**
   * Si sacaron la opción que este dispositivo había votado, su voto se fue con
   * ella (cascade, decisión 8). Se lo decimos y puede votar de nuevo: **no se le
   * reasigna en silencio**.
   */
  useEffect(() => {
    if (votado && !opciones.some((o) => o.optionId === votado)) {
      setVotado(null)
      setVotoPerdido(true)
    }
  }, [opciones, votado])

  // Polling en vivo solo mientras está abierta.
  useEffect(() => {
    if (!abierta) return
    let vivo = true
    const tick = async () => {
      try {
        const res = await fetch(`/api/votaciones/${token}`, { cache: 'no-store' })
        const json = await res.json()
        if (vivo && json?.data) aplicarResultados(json.data)
      } catch {
        // Un tick que falla no rompe nada: el próximo reintenta.
      }
    }
    const id = setInterval(tick, POLL_MS)
    return () => {
      vivo = false
      clearInterval(id)
    }
  }, [abierta, token, aplicarResultados])

  async function votar(optionId: string) {
    if (!abierta || votando) return
    setError(null)
    setVotando(optionId)
    try {
      const res = await fetch(`/api/votaciones/${token}/voto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionId }),
      })
      const json = await res.json()
      if (!res.ok || json?.error) {
        setError(json?.error?.message ?? 'No pudimos registrar tu voto.')
        // Si cerró mientras tanto, reflejarlo (deja de mostrar el botón).
        if (json?.error?.code === 'VOTACION_CERRADA') setEstado('closed')
        return
      }
      setVotado(json.data.votedOptionId)
      setVotoPerdido(false)
      setRecienSumada(null)
      if (json.data.resultados) aplicarResultados(json.data.resultados)
    } catch {
      setError('No pudimos registrar tu voto. Probá de nuevo.')
    } finally {
      setVotando(null)
    }
  }

  /**
   * Suma un lugar del catálogo. **No lo vota** (decisión 9): auto-votar cambiaría
   * en silencio un voto anterior. Se le ofrece votarlo abajo de la opción nueva.
   */
  async function sumar(place: SearchedPlace): Promise<string | null> {
    setError(null)
    const res = await fetch(`/api/votaciones/${token}/opciones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placeId: place.id }),
    })
    const json = await res.json()
    if (!res.ok || json?.error) {
      if (json?.error?.code === 'VOTACION_CERRADA') setEstado('closed')
      if (json?.error?.code === 'SUGERENCIAS_CERRADAS') setPermiteSumar(false)
      throw new Error(json?.error?.message ?? 'No pudimos sumar el lugar.')
    }
    if (json.data.resultados) aplicarResultados(json.data.resultados)
    setMisSugerencias((prev) => [...prev, json.data.optionId])
    setRecienSumada(json.data.optionId)
    return json.data.optionId
  }

  async function quitar(optionId: string) {
    if (quitando) return
    setError(null)
    setQuitando(optionId)
    try {
      const res = await fetch(`/api/votaciones/${token}/opciones/${optionId}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (!res.ok || json?.error) {
        setError(json?.error?.message ?? 'No pudimos sacar el lugar.')
        return
      }
      if (json.data.resultados) aplicarResultados(json.data.resultados)
      setMisSugerencias((prev) => prev.filter((id) => id !== optionId))
      if (recienSumada === optionId) setRecienSumada(null)
      // Si el voto de este dispositivo estaba en la opción que se fue, quedó
      // vacío: se lo decimos en vez de reasignarlo en silencio (decisión 8).
      if (votado === optionId) setVotado(null)
      setAConfirmar(null)
    } catch {
      setError('No pudimos sacar el lugar. Probá de nuevo.')
    } finally {
      setQuitando(null)
    }
  }

  const llena = opciones.length >= MAX_OPCIONES_TOTAL
  const sinCupoPropio = misSugerencias.length >= MAX_SUGERENCIAS_POR_VOTANTE
  const puedeSumar = abierta && permiteSumar && !llena && !sinCupoPropio

  const motivoSinSumar = !abierta
    ? null
    : !permiteSumar
      ? null
      : llena
        ? `La votación llegó a ${MAX_OPCIONES_TOTAL} lugares, que es el máximo.`
        : sinCupoPropio
          ? `Ya sumaste ${MAX_SUGERENCIAS_POR_VOTANTE} lugares. Dejale lugar al resto.`
          : null

  return (
    <div className="flex flex-col gap-5">
      {!abierta && <BannerCerrada estado={estado} ganador={ganador} opciones={opciones} />}

      <ul className="flex flex-col gap-4">
        {opciones.map((o) => {
          const votos = o.votos
          const pct = total > 0 ? Math.round((votos / total) * 100) : 0
          const esVotado = votado === o.optionId
          const esGanador = !abierta && ganador === o.placeId
          const sugerida = o.origin === 'voter'
          const esMia = misSugerencias.includes(o.optionId)
          // Quién puede sacarla (decisión 8). El gate de verdad está en el server:
          // esto solo evita ofrecer un botón que va a fallar.
          const puedoQuitar = abierta && sugerida && (esCreador || (esMia && votos === 0))
          return (
            <li
              key={o.optionId}
              className={`flex flex-col gap-2 rounded-2xl border p-1 ${
                esGanador ? 'border-primary' : 'border-transparent'
              }`}
            >
              {sugerida && (
                <div className="flex items-center justify-between gap-2 px-2 pt-1">
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                    {esMia ? 'Lo sumaste vos' : 'Lo sumó alguien del grupo'}
                  </span>
                  {puedoQuitar && (
                    <button
                      type="button"
                      onClick={() => (votos > 0 ? setAConfirmar(o.optionId) : quitar(o.optionId))}
                      disabled={quitando !== null}
                      aria-label={`Sacar ${o.name}`}
                      className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              )}

              <PlaceCard id={o.placeId} name={o.name} tags={o.tags} location={o.location} />

              {/* Confirmación de quitar con votos: se los lleva puestos (cascade). */}
              {aConfirmar === o.optionId && (
                <div className="flex flex-col gap-2 rounded-xl border border-border bg-background p-3">
                  <p className="text-sm text-foreground">
                    Si lo sacás se pierden {votos} {votos === 1 ? 'voto' : 'votos'}. Esto no se
                    puede deshacer.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => quitar(o.optionId)}
                      disabled={quitando !== null}
                      className="flex-1 rounded-lg bg-destructive py-2 text-sm font-semibold text-white transition-colors hover:bg-destructive/90 disabled:opacity-50"
                    >
                      {quitando === o.optionId ? 'Sacando…' : 'Sí, sacarlo'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAConfirmar(null)}
                      disabled={quitando !== null}
                      className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-50"
                    >
                      Volver
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 px-2 pb-1">
                {/* Barra de conteo en vivo */}
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {votos} {votos === 1 ? 'voto' : 'votos'}
                      {esGanador && <span className="ml-1 font-semibold text-primary">· Ganó</span>}
                    </span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div
                      className={`h-full rounded-full transition-all ${
                        esGanador ? 'bg-primary' : 'bg-primary/60'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {abierta && (
                  <button
                    type="button"
                    onClick={() => votar(o.optionId)}
                    disabled={votando !== null}
                    className={`flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
                      esVotado
                        ? 'bg-primary text-primary-foreground'
                        : 'border border-border text-foreground hover:bg-secondary'
                    }`}
                  >
                    {esVotado && <Check className="size-4" />}
                    {esVotado ? 'Tu voto' : 'Votar'}
                  </button>
                )}
              </div>

              {/* Tras sumar, se le OFRECE votarlo — nunca se vota solo (decisión 9). */}
              {abierta && recienSumada === o.optionId && votado !== o.optionId && (
                <p className="px-2 pb-1 text-xs text-muted-foreground">
                  Sumaste este lugar.{' '}
                  <button
                    type="button"
                    onClick={() => votar(o.optionId)}
                    disabled={votando !== null}
                    className="font-medium text-primary underline underline-offset-2 disabled:opacity-50"
                  >
                    ¿La votás?
                  </button>
                </p>
              )}
            </li>
          )
        })}
      </ul>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Sumar un lugar (decisión 1: cualquiera con el link, sin cuenta) */}
      {abierta && permiteSumar && (
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => setSheetAbierto(true)}
            disabled={!puedeSumar}
            className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-primary/50 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:border-border disabled:text-muted-foreground disabled:hover:bg-transparent"
          >
            <Plus className="size-4" />
            Sumar un lugar
          </button>
          {motivoSinSumar && (
            <p className="text-center text-xs text-muted-foreground">{motivoSinSumar}</p>
          )}
        </div>
      )}

      {abierta && votoPerdido && (
        <p className="rounded-xl border border-border bg-secondary/50 px-4 py-3 text-sm text-foreground">
          Sacaron el lugar que habías votado, así que tu voto quedó libre. Elegí otro.
        </p>
      )}

      <p className="text-center text-xs text-muted-foreground">
        {total} {total === 1 ? 'voto' : 'votos'} en total
        {abierta && votado && ' · Podés cambiar tu voto mientras esté abierta'}
      </p>

      <SheetSumar
        open={sheetAbierto}
        onClose={() => setSheetAbierto(false)}
        yaEstan={opciones.map((o) => o.placeId)}
        onSumar={sumar}
      />
    </div>
  )
}

/**
 * El buscador para sumar, en un sheet (decisión 5). Reusa `/api/search` tal cual
 * —el mismo motor, el mismo `publishedWhere`, sin endpoint nuevo— con el mismo
 * debounce + `AbortController` del picker de `/votacion/nueva`. Consecuencia
 * asumida y explícita: estas búsquedas cuentan impresiones como cualquier otra.
 */
function SheetSumar({
  open,
  onClose,
  yaEstan,
  onSumar,
}: {
  open: boolean
  onClose: () => void
  yaEstan: string[]
  onSumar: (place: SearchedPlace) => Promise<string | null>
}) {
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState<SearchedPlace[]>([])
  const [buscando, setBuscando] = useState(false)
  const [sumando, setSumando] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setQuery('')
      setResultados([])
      setError(null)
    }
  }, [open])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResultados([])
      setBuscando(false)
      return
    }
    setBuscando(true)
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        const json = await res.json()
        setResultados(json?.data?.places ?? [])
      } catch {
        // Abortada o red caída: no se pisa la lista con un error del buscador.
      } finally {
        setBuscando(false)
      }
    }, 300)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [query])

  async function sumar(place: SearchedPlace) {
    if (sumando) return
    setError(null)
    setSumando(place.id)
    try {
      await onSumar(place)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos sumar el lugar.')
    } finally {
      setSumando(null)
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-foreground">Sumá un lugar</h2>
          <span className="text-xs text-muted-foreground">Buscalo por nombre</span>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscá un lugar por nombre"
            className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary"
          />
        </div>

        {buscando && <p className="text-sm text-muted-foreground">Buscando…</p>}

        {!buscando && query.trim().length >= 2 && resultados.length === 0 && (
          <p className="text-sm text-muted-foreground">No encontramos lugares con ese nombre.</p>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <ul className="flex flex-col gap-2 pb-2">
          {resultados.map((place) => {
            const yaEsta = yaEstan.includes(place.id)
            const tags = tagsDestacados(place.tags)
            return (
              <li
                key={place.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{place.name}</p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                    {ubicacionDeCard(place) && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3" />
                        {ubicacionDeCard(place)}
                      </span>
                    )}
                    {tags.length > 0 && <span className="truncate">{tags.join(' · ')}</span>}
                  </div>
                </div>
                {yaEsta ? (
                  <span className="shrink-0 text-xs text-muted-foreground">Ya está</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => sumar(place)}
                    disabled={sumando !== null}
                    aria-label={`Sumar ${place.name}`}
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border text-primary transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Plus className="size-4" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </BottomSheet>
  )
}

/** Banner de solo-lectura para cerrada / expirada / cancelada (decisión 15). */
function BannerCerrada({
  estado,
  ganador,
  opciones,
}: {
  estado: EstadoVisible
  ganador: string | null
  opciones: OpcionPublica[]
}) {
  if (estado === 'cancelled') {
    return (
      <div className="rounded-xl border border-border bg-secondary/50 px-4 py-3 text-sm text-muted-foreground">
        Esta votación fue cancelada.
      </div>
    )
  }

  const nombreGanador = ganador ? opciones.find((o) => o.placeId === ganador)?.name : null

  return (
    <div className="rounded-xl border border-border bg-secondary/50 px-4 py-3 text-sm text-foreground">
      {nombreGanador ? (
        <>
          Esta votación cerró. Ganó <span className="font-semibold">{nombreGanador}</span>.
        </>
      ) : (
        'Esta votación ya cerró. No se puede votar.'
      )}
    </div>
  )
}
