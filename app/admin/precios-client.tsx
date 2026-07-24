'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { Aviso, inputClass } from '@/components/negocio/campos'
import type { CambioPrecio, PrecioActual } from '@/lib/billing/settings'

/**
 * Editor de precios de `/admin` (MONETIZACION, decisión 26). Postea a
 * `PATCH /api/admin/settings`, que valida la clave y el monto y registra el
 * cambio en `app_settings_history`. Al terminar, `router.refresh()` vuelve a leer
 * del server — la lista no mantiene estado propio que pueda mentir (mismo criterio
 * que `ColaClient`).
 *
 * El cambio rige el checkout siguiente sin deploy; las suscripciones vivas
 * conservan su `amount_ars` congelado (decisión 25). El historial de abajo es la
 * respuesta a "¿qué precio regía en tal mes?".
 */

type Props = { precios: PrecioActual[]; historial: CambioPrecio[] }

const FMT = new Intl.NumberFormat('es-AR')

export function PreciosClient({ precios, historial }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        {precios.map((p) => (
          <FilaPrecio key={p.key} precio={p} />
        ))}
      </div>

      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Historial de cambios
        </h3>
        {historial.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            Todavía no se editó ningún precio.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-xs">
            {historial.map((h, i) => (
              <li
                key={`${h.key}-${h.changedAt.toISOString()}-${i}`}
                className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 rounded-lg border border-border bg-card px-3 py-2"
              >
                <span className="text-foreground">
                  {etiquetaClave(h.key)} → <strong>${FMT.format(h.value)}</strong>
                </span>
                <span className="text-muted-foreground">
                  {new Date(h.changedAt).toLocaleString('es-AR')} · {h.changedBy}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function FilaPrecio({ precio }: { precio: PrecioActual }) {
  const router = useRouter()
  const [valor, setValor] = useState(String(precio.value))
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  const parsed = Number(valor)
  const valido = Number.isInteger(parsed) && parsed > 0
  const cambiado = parsed !== precio.value

  async function guardar() {
    if (!valido || !cambiado) return
    setError(null)
    setOk(false)
    setTrabajando(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: precio.key, value: parsed }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json?.error?.message ?? 'No pudimos guardar el precio.')
        return
      }
      setOk(true)
      router.refresh()
    } catch {
      setError('No pudimos conectarnos. Probá de nuevo.')
    } finally {
      setTrabajando(false)
    }
  }

  return (
    <article className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-foreground">{precio.label}</span>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">$</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={valor}
            onChange={(e) => {
              setValor(e.target.value)
              setOk(false)
            }}
            className={inputClass}
          />
          <span className="shrink-0 text-xs text-muted-foreground">ARS/mes</span>
          <button
            type="button"
            disabled={trabajando || !valido || !cambiado}
            onClick={guardar}
            className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {trabajando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </label>
      {!valido && <p className="text-xs text-destructive">Tiene que ser un entero mayor a 0.</p>}
      {error && <Aviso tipo="error">{error}</Aviso>}
      {ok && <p className="text-xs text-primary">Guardado. Rige desde el próximo checkout.</p>}
    </article>
  )
}

function etiquetaClave(key: string): string {
  if (key.endsWith('b2b_ars')) return 'B2B (por lugar)'
  if (key.endsWith('b2c_ars')) return 'Premium B2C'
  return key
}
