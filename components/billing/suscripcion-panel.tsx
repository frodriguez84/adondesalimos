'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckoutModal } from '@/components/billing/checkout-modal'
import { cobroApagado } from '@/lib/billing/apagado'
import type { EstadoSuscripcion } from '@/lib/billing/estado'
import type { TipoSuscripcion } from '@/lib/billing/types'

/**
 * Tab de Suscripción (MONETIZACION F2), reusable entre `/cuenta` (B2C) y
 * `/mi-negocio/[placeId]` (B2B). Muestra el estado (free/activo, período, aviso
 * `past_due`, cancelación en curso) y ofrece suscribirse (abre el Brick) o cancelar
 * (diferida, decisión 15). El estado ya viene reconciliado del server (lazy check).
 *
 * **Premium de cortesía** (`activo` sin fila viva: `estado.status === null`, típico del
 * alta a mano con un UPDATE): no hay nada que cancelar ni fecha que mostrar, así que no
 * se pinta el botón —el endpoint devolvería 404— y el copy manda a escribirnos.
 *
 * **Con el cobro apagado** (DEPLOY, decisión 6) el estado free cambia: en vez del
 * pitch + "Suscribirme por $X/mes" —que llevaría al Brick a degradar con
 * "Configuración de pago incompleta", copy de desarrollador— muestra el mensaje de
 * beta y registra el interés. El interruptor es la ausencia de la key de MP
 * (`cobroApagado`), así que en dev no cambia nada.
 */

interface Props {
  tipo: TipoSuscripcion
  /** Requerido para B2B. */
  placeId?: string
  estado: EstadoSuscripcion
  /** Precio vigente en ARS (lo muestra y valida el checkout, decisión 27). */
  precioArs: number
  /** El de la cuenta: es a dónde se avisa cuando abra el cobro. */
  email: string
  /** Resuelto server-side: el confirmado sobrevive al reload. */
  interesRegistrado?: boolean
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

/** Copy de la beta (DEPLOY, § El premium apagado): dice primero que no se puede pagar. */
const PITCH_BETA: Record<TipoSuscripcion, string> = {
  b2c: 'El premium está por salir: votaciones ilimitadas, historial y que la IA te arme la shortlist.',
  b2b: 'El plan del lugar está por salir: descripción, carta, novedades, hasta 15 fotos y el destaque en las búsquedas.',
}

/** Copy del premium de cortesía: activo por un UPDATE a mano, sin fila que cancelar. */
const CORTESIA: Record<TipoSuscripcion, string> = {
  b2c: 'Te activamos el Premium nosotros: no vence ni se cobra.',
  b2b: 'Te activamos el plan del lugar nosotros: no vence ni se cobra.',
}

export function SuscripcionPanel({
  tipo,
  placeId,
  estado,
  precioArs,
  email,
  interesRegistrado = false,
}: Props) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [cancelando, setCancelando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [anotado, setAnotado] = useState(interesRegistrado)
  const [anotando, setAnotando] = useState(false)

  const finPeriodo = estado.currentPeriodEnd ? new Date(estado.currentPeriodEnd) : null
  const apagado = cobroApagado()

  async function avisarme() {
    setError(null)
    setAnotando(true)
    try {
      const res = await fetch('/api/billing/interes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tipo === 'b2b' ? { placeId } : {}),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.error) {
        setError(json.error?.message ?? 'No pudimos anotarte. Probá de nuevo.')
        return
      }
      setAnotado(true)
    } catch {
      setError('Error de conexión. Probá de nuevo.')
    } finally {
      setAnotando(false)
    }
  }

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
          {estado.status === null ? (
            <p className="text-sm text-muted-foreground">
              {CORTESIA[tipo]} Si lo querés dar de baja, escribinos y lo sacamos.
            </p>
          ) : estado.cancelAtPeriodEnd ? (
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
      ) : apagado ? (
        <div className="flex flex-col gap-3">
          {anotado ? (
            <p className="text-sm text-muted-foreground">
              ✓ Listo, anotado. Te escribimos a <strong className="text-foreground">{email}</strong>{' '}
              apenas abramos los pagos.
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold text-foreground">
                  Todavía no abrimos los pagos.
                </p>
                <p className="text-sm text-muted-foreground">
                  {PITCH_BETA[tipo]} Te avisamos apenas se pueda.
                </p>
              </div>
              <button
                type="button"
                onClick={avisarme}
                disabled={anotando}
                className="self-start rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {anotando ? 'Anotando…' : 'Avisame cuando abra'}
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

      {/* Con el cobro apagado el Brick no se monta: nada lo puede abrir. */}
      {!apagado && (
        <CheckoutModal
          open={abierto}
          onClose={() => setAbierto(false)}
          tipo={tipo}
          placeId={placeId}
          amountArs={precioArs}
        />
      )}
    </section>
  )
}
