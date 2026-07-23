'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'

import { PlaceCard } from '@/components/shared/place-card'
import type { EstadoVisible } from '@/lib/votaciones/estado'
import type { OpcionPublica } from '@/lib/votaciones/query'

/**
 * La votación pública, del lado del cliente (F2). Vota sin cuenta (la cookie
 * `voter_id` la maneja el endpoint) y muestra el **conteo en vivo** (decisión 13):
 * mientras está abierta poletea los resultados para que el número suba solo — es
 * el motor del loop viral ("vamos 2 a 2, voten").
 *
 * Cerrada/expirada/cancelada ⇒ solo-lectura (decisión 15): sin botón de voto, con
 * el ganador destacado si el creador lo eligió.
 */

type Conteo = { optionId: string; votos: number }

const POLL_MS = 4000

export function VotacionPublicaCliente({
  token,
  estadoInicial,
  winnerPlaceId,
  totalInicial,
  opciones,
  votedOptionIdInicial,
}: {
  token: string
  estadoInicial: EstadoVisible
  winnerPlaceId: string | null
  totalInicial: number
  opciones: OpcionPublica[]
  votedOptionIdInicial: string | null
}) {
  const [estado, setEstado] = useState<EstadoVisible>(estadoInicial)
  const [ganador, setGanador] = useState<string | null>(winnerPlaceId)
  const [conteos, setConteos] = useState<Conteo[]>(
    opciones.map((o) => ({ optionId: o.optionId, votos: o.votos })),
  )
  const [total, setTotal] = useState(totalInicial)
  const [votado, setVotado] = useState<string | null>(votedOptionIdInicial)
  const [votando, setVotando] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const abierta = estado === 'open'

  const votosDe = (optionId: string) => conteos.find((c) => c.optionId === optionId)?.votos ?? 0

  const aplicarResultados = useCallback(
    (r: {
      estado: EstadoVisible
      totalVotos: number
      winnerPlaceId: string | null
      opciones: Conteo[]
    }) => {
      setEstado(r.estado)
      setGanador(r.winnerPlaceId)
      setTotal(r.totalVotos)
      setConteos(r.opciones)
    },
    [],
  )

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
      if (json.data.resultados) aplicarResultados(json.data.resultados)
    } catch {
      setError('No pudimos registrar tu voto. Probá de nuevo.')
    } finally {
      setVotando(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {!abierta && <BannerCerrada estado={estado} ganador={ganador} opciones={opciones} />}

      <ul className="flex flex-col gap-4">
        {opciones.map((o) => {
          const votos = votosDe(o.optionId)
          const pct = total > 0 ? Math.round((votos / total) * 100) : 0
          const esVotado = votado === o.optionId
          const esGanador = !abierta && ganador === o.placeId
          return (
            <li
              key={o.optionId}
              className={`flex flex-col gap-2 rounded-2xl border p-1 ${
                esGanador ? 'border-primary' : 'border-transparent'
              }`}
            >
              <PlaceCard id={o.placeId} name={o.name} tags={o.tags} location={o.location} />

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
            </li>
          )
        })}
      </ul>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <p className="text-center text-xs text-muted-foreground">
        {total} {total === 1 ? 'voto' : 'votos'} en total
        {abierta && votado && ' · Podés cambiar tu voto mientras esté abierta'}
      </p>
    </div>
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
