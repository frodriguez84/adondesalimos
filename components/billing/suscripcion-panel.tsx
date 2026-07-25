'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckoutModal } from '@/components/billing/checkout-modal'
import type { EstadoSuscripcion } from '@/lib/billing/estado'
import type { TipoSuscripcion } from '@/lib/billing/types'

/**
 * Tab de Suscripción (MONETIZACION F2), reusable entre `/cuenta` (B2C) y
 * `/mi-negocio/[placeId]` (B2B). Muestra el estado (free/activo, período, aviso
 * `past_due`, cancelación en curso) y ofrece suscribirse (abre el Brick) o cancelar
 * (diferida, decisión 15). El estado ya viene reconciliado del server (lazy check).
 */

interface Props {
  tipo: TipoSuscripcion
  /** Requerido para B2B. */
  placeId?: string
  estado: EstadoSuscripcion
  /** Precio vigente en ARS (lo muestra y valida el checkout, decisión 27). */
  precioArs: number
}

const pesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

const fecha = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })

const TITULO: Record<TipoSuscripcion, string> = {
  b2c: 'Premium',
  b2b: 'Plan del lugar',
}

export function SuscripcionPanel({ tipo, placeId, estado, precioArs }: Props) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [cancelando, setCancelando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const finPeriodo = estado.currentPeriodEnd ? new Date(estado.currentPeriodEnd) : null

  async function cancelar() {
    setError(null)
    setCancelando(true)
    try {
      const res = await fetch('/api/billing/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tipo === 'b2b' ? { placeId } : {}),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        setError(json.error?.message ?? 'No se pudo cancelar. Probá de nuevo.')
        return
      }
      router.refresh()
    } catch {
      setError('Error de conexión. Probá de nuevo.')
    } finally {
      setCancelando(false)
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Suscripción
        </h2>
        <span
          className={
            estado.activo
              ? 'rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary'
              : 'rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground'
          }
        >
          {estado.activo ? TITULO[tipo] : 'Free'}
        </span>
      </div>

      {estado.status === 'past_due' && estado.activo && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          Hubo un problema con el último cobro. Seguís con acceso mientras Mercado Pago
          reintenta; revisá tu tarjeta para no perderlo.
        </p>
      )}

      {estado.activo ? (
        <div className="flex flex-col gap-3">
          {estado.cancelAtPeriodEnd ? (
            <p className="text-sm text-muted-foreground">
              Cancelada. Mantenés el acceso hasta el{' '}
              {finPeriodo ? <strong className="text-foreground">{fecha.format(finPeriodo)}</strong> : 'fin del período'}
              . Después vuelve a free.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {pesos.format(precioArs)} por mes.
                {finPeriodo && (
                  <>
                    {' '}Próxima renovación:{' '}
                    <strong className="text-foreground">{fecha.format(finPeriodo)}</strong>.
                  </>
                )}
              </p>
              <button
                type="button"
                onClick={cancelar}
                disabled={cancelando}
                className="self-start rounded-xl bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50"
              >
                {cancelando ? 'Cancelando…' : 'Cancelar suscripción'}
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            {tipo === 'b2b'
              ? 'Activá el plan del lugar para desbloquear descripción, carta, novedades, hasta 15 fotos y el destaque en las búsquedas.'
              : 'Pasate a Premium para votaciones ilimitadas, historial y que la IA te arme la shortlist.'}
          </p>
          <button
            type="button"
            onClick={() => setAbierto(true)}
            className="self-start rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Suscribirme por {pesos.format(precioArs)}/mes
          </button>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <CheckoutModal
        open={abierto}
        onClose={() => setAbierto(false)}
        tipo={tipo}
        placeId={placeId}
        amountArs={precioArs}
      />
    </section>
  )
}
