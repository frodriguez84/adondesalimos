'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import type { EstadoVisible } from '@/lib/votaciones/estado'
import type { VotacionDelPanel } from '@/lib/votaciones/query'

/**
 * El panel del creador, del lado del cliente (F3). Lista cada votación con su
 * conteo y, para las **activas**, las dos acciones del creador: **cerrar**
 * (eligiendo el ganador, default = el más votado, decisión 14) y **cancelar**
 * (libera el cupo "1 activa" al instante, decisión 24).
 */

const ETIQUETA: Record<EstadoVisible, string> = {
  open: 'Activa',
  closed: 'Cerrada',
  expired: 'Expirada',
  cancelled: 'Cancelada',
}

export function MisVotaciones({
  votaciones,
  esPremium,
}: {
  votaciones: VotacionDelPanel[]
  esPremium: boolean
}) {
  return (
    <ul className="flex flex-col gap-4">
      {votaciones.map((v) => (
        <VotacionItem key={v.id} votacion={v} esPremium={esPremium} />
      ))}
    </ul>
  )
}

function VotacionItem({
  votacion,
  esPremium,
}: {
  votacion: VotacionDelPanel
  esPremium: boolean
}) {
  const router = useRouter()
  const [cerrando, setCerrando] = useState(false)
  const [cancelando, setCancelando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  const activa = votacion.estado === 'open'
  // Default del ganador: el más votado; empate ⇒ el de menor position (el orden
  // en que llegan ya es por position). Determinista (edge case).
  const masVotado = [...votacion.opciones].sort((a, b) => b.votos - a.votos)[0]
  const [ganador, setGanador] = useState<string>(masVotado?.placeId ?? '')

  const titulo = votacion.title || votacion.opciones.map((o) => o.name).join(' · ')
  const link = typeof window !== 'undefined' ? `${window.location.origin}/votacion/${votacion.token}` : ''

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      /* sin clipboard: el link igual se ve abajo */
    }
  }

  async function gestionar(body: Record<string, unknown>) {
    setError(null)
    setEnviando(true)
    try {
      const res = await fetch(`/api/votaciones/${votacion.token}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok || json?.error) {
        setError(json?.error?.message ?? 'No pudimos actualizar la votación.')
        return
      }
      router.refresh()
    } catch {
      setError('No pudimos actualizar la votación. Probá de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  const nombreGanador = votacion.winnerPlaceId
    ? votacion.opciones.find((o) => o.placeId === votacion.winnerPlaceId)?.name
    : null

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate font-medium text-foreground">{titulo}</p>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs ${
            activa
              ? 'bg-primary/15 text-primary'
              : 'border border-border text-muted-foreground'
          }`}
        >
          {ETIQUETA[votacion.estado]}
        </span>
      </div>

      {/* Conteo por opción */}
      <ul className="flex flex-col gap-1.5">
        {votacion.opciones.map((o) => {
          const pct = votacion.totalVotos > 0 ? Math.round((o.votos / votacion.totalVotos) * 100) : 0
          const esGanador = votacion.winnerPlaceId === o.placeId
          return (
            <li key={o.placeId} className="text-sm">
              <div className="mb-0.5 flex items-center justify-between gap-2">
                <span className="truncate text-foreground">
                  {o.name}
                  {esGanador && <span className="ml-1 text-xs font-semibold text-primary">· Ganó</span>}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {o.votos} · {pct}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className={`h-full rounded-full ${esGanador ? 'bg-primary' : 'bg-primary/60'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          )
        })}
      </ul>

      <p className="text-xs text-muted-foreground">
        {votacion.totalVotos} {votacion.totalVotos === 1 ? 'voto' : 'votos'}
        {nombreGanador && !activa && ` · Ganó ${nombreGanador}`}
      </p>

      {/* Link para compartir */}
      <div className="flex gap-2">
        <Link
          href={`/votacion/${votacion.token}`}
          className="flex-1 rounded-lg border border-border py-2 text-center text-sm font-medium text-foreground transition-colors hover:bg-secondary"
        >
          Ver
        </Link>
        <button
          type="button"
          onClick={copiar}
          className="flex-1 rounded-lg border border-border py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
        >
          {copiado ? 'Copiado' : 'Copiar link'}
        </button>
      </div>

      {/* Acciones del creador — solo si está activa y no hay otro flujo abierto */}
      {activa && !cerrando && !cancelando && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setCerrando(true)}
            className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={() => setCancelando(true)}
            className="flex-1 rounded-lg border border-border py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary"
          >
            Cancelar votación
          </button>
        </div>
      )}

      {/* Confirmación de cancelación: es destructivo y no se deshace. */}
      {activa && cancelando && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-3">
          <p className="text-sm font-medium text-foreground">¿Cancelar esta votación?</p>
          <p className="text-xs text-muted-foreground">
            Deja de recibir votos y el link queda en solo-lectura. Esto no se puede deshacer.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => gestionar({ accion: 'cancel' })}
              disabled={enviando}
              className="flex-1 rounded-lg bg-destructive py-2 text-sm font-semibold text-white transition-colors hover:bg-destructive/90 disabled:opacity-50"
            >
              {enviando ? 'Cancelando…' : 'Sí, cancelar'}
            </button>
            <button
              type="button"
              onClick={() => setCancelando(false)}
              disabled={enviando}
              className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-50"
            >
              Volver
            </button>
          </div>
        </div>
      )}

      {/* Flujo de cierre: elegir el ganador */}
      {activa && cerrando && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-3">
          <p className="text-sm font-medium text-foreground">¿Quién ganó?</p>

          {/* Free: al cerrar, la votación sale del panel (decisión 19: solo la
              activa). Se avisa acá, que es el momento en que se pierde de la UI. */}
          {!esPremium && (
            <p className="rounded-lg bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
              Al cerrarla, sale de tu panel: la seguís viendo solo por su link.{' '}
              <button
                type="button"
                onClick={copiar}
                className="font-medium text-primary underline underline-offset-2"
              >
                {copiado ? 'Link copiado' : 'Copiá el link'}
              </button>{' '}
              para volver a consultarla.
            </p>
          )}

          <div className="flex flex-col gap-1">
            {votacion.opciones.map((o) => (
              <label key={o.placeId} className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="radio"
                  name={`ganador-${votacion.id}`}
                  value={o.placeId}
                  checked={ganador === o.placeId}
                  onChange={() => setGanador(o.placeId)}
                />
                {o.name}
                <span className="text-xs text-muted-foreground">
                  ({o.votos} {o.votos === 1 ? 'voto' : 'votos'})
                </span>
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => gestionar({ accion: 'close', winnerPlaceId: ganador })}
              disabled={enviando || !ganador}
              className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {enviando ? 'Cerrando…' : 'Confirmar cierre'}
            </button>
            <button
              type="button"
              onClick={() => setCerrando(false)}
              disabled={enviando}
              className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary"
            >
              Volver
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </li>
  )
}
