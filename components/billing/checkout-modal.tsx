'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import type { TipoSuscripcion } from '@/lib/billing/types'

/**
 * CheckoutModal de MercadoPago (MONETIZACION F2). Port del `CheckoutModal` de
 * StressPlan sobre el `BottomSheet` del proyecto (no hay Dialog centrado; el
 * feedback va inline, no hay toast). Carga el SDK v2 dinámicamente, monta el Card
 * Payment Brick (tokeniza la tarjeta en el sitio con la clave pública) y manda el
 * token a `/api/billing/checkout`. El monto lo fija el server desde DB; acá se
 * muestra y se manda como `amount` para la validación de la decisión 27.
 */

type EstadoCheckout = 'form' | 'submitting' | 'success' | 'error'

interface Props {
  open: boolean
  onClose: () => void
  tipo: TipoSuscripcion
  /** Requerido para B2B (el lugar que se suscribe). */
  placeId?: string
  /** Monto vigente en ARS que muestra el Brick (viene del server / DB). */
  amountArs: number
  onSuccess?: () => void
}

// Tipado mínimo del SDK de MP cargado por script.
interface MpBrickController {
  unmount: () => void
}
interface MpBricksBuilder {
  create: (
    brick: 'cardPayment',
    containerId: string,
    settings: Record<string, unknown>,
  ) => Promise<MpBrickController>
}
interface MpInstance {
  bricks: () => MpBricksBuilder
}
type MpConstructor = new (publicKey: string, options?: { locale?: string }) => MpInstance
declare global {
  interface Window {
    MercadoPago?: MpConstructor
  }
}

const SDK_SRC = 'https://sdk.mercadopago.com/js/v2'

function loadMpSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.MercadoPago) return resolve()
    const existing = document.querySelector(`script[src="${SDK_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('No se pudo cargar el SDK de MP')))
      return
    }
    const script = document.createElement('script')
    script.src = SDK_SRC
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('No se pudo cargar el SDK de MP'))
    document.body.appendChild(script)
  })
}

const pesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

export function CheckoutModal({ open, onClose, tipo, placeId, amountArs, onSuccess }: Props) {
  const router = useRouter()
  const [state, setState] = useState<EstadoCheckout>('form')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const controllerRef = useRef<MpBrickController | null>(null)
  const containerId = `cardPaymentBrick_${tipo}`

  useEffect(() => {
    if (!open) return

    let cancelled = false
    setState('form')
    setErrorMsg(null)

    async function mountBrick() {
      const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY
      if (!publicKey) {
        if (!cancelled) {
          setErrorMsg('Configuración de pago incompleta.')
          setState('error')
        }
        return
      }
      try {
        await loadMpSdk()
        if (cancelled || !window.MercadoPago) return
        const mp = new window.MercadoPago(publicKey, { locale: 'es-AR' })
        const builder = mp.bricks()
        controllerRef.current = await builder.create('cardPayment', containerId, {
          initialization: { amount: amountArs },
          callbacks: {
            onReady: () => {},
            // MP exige que onSubmit devuelva una Promise (resuelve = OK, rechaza = error).
            // El email del pagador sale del propio Brick (puede diferir del de la cuenta).
            onSubmit: (formData: { token?: string; payer?: { email?: string } }) =>
              submitCheckout(formData?.token, formData?.payer?.email),
            onError: () => {
              if (!cancelled) {
                setErrorMsg('Hubo un problema con el formulario de pago.')
                setState('error')
              }
            },
          },
        })
      } catch {
        if (!cancelled) {
          setErrorMsg('No se pudo iniciar el pago. Probá de nuevo.')
          setState('error')
        }
      }
    }

    async function submitCheckout(token?: string, payerEmail?: string): Promise<void> {
      if (!token) {
        const msg = 'No se pudo validar la tarjeta.'
        setErrorMsg(msg)
        setState('error')
        throw new Error(msg)
      }
      setState('submitting')

      // Fallo de conexión: la request no llegó. Mensaje propio y se corta acá.
      let res: Response
      try {
        res = await fetch('/api/billing/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tipo,
            ...(tipo === 'b2b' ? { placeId } : {}),
            card_token_id: token,
            payer_email: payerEmail,
            amount: amountArs,
          }),
        })
      } catch {
        const msg = 'Error de conexión. Revisá tu internet y probá de nuevo.'
        setErrorMsg(msg)
        setState('error')
        throw new Error(msg)
      }

      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.error) {
        // El server ya mandó el mensaje en español (precio cambió, ya suscripto,
        // tarjeta rechazada). MP exige que onSubmit rechace para marcar el error.
        const msg = json.error?.message ?? 'No se pudo completar el pago.'
        setErrorMsg(msg)
        setState('error')
        throw new Error(msg)
      }

      setState('success')
      onSuccess?.()
      router.refresh()
    }

    mountBrick()

    return () => {
      cancelled = true
      controllerRef.current?.unmount()
      controllerRef.current = null
    }
  }, [open, tipo, placeId, amountArs, containerId, router, onSuccess])

  function handleClose() {
    // No cerrar mientras se procesa el pago.
    if (state === 'submitting') return
    onClose()
  }

  function retry() {
    setErrorMsg(null)
    setState('form')
  }

  return (
    <BottomSheet open={open} onClose={handleClose}>
      <div className="flex flex-col gap-4 p-5">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            {tipo === 'b2b' ? 'Suscribí este lugar' : 'Pasate a Premium'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {state === 'submitting'
              ? 'Procesando el pago, no cierres esta ventana…'
              : state === 'success'
                ? '¡Listo! Tu plan ya está activo.'
                : `${pesos.format(amountArs)} por mes. Podés cancelar cuando quieras.`}
          </p>
        </div>

        {state === 'error' && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMsg ?? 'Ocurrió un error.'}
            <button
              onClick={retry}
              className="mt-2 block text-xs font-medium underline hover:opacity-80"
            >
              Probar de nuevo
            </button>
          </div>
        )}

        {state === 'success' && (
          <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-6 text-center">
            <p className="text-sm font-medium text-foreground">Suscripción activada</p>
            <button
              onClick={onClose}
              className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
            >
              Listo
            </button>
          </div>
        )}

        {/* El Brick se monta acá. Se mantiene en el DOM salvo en success para reintentar. */}
        <div className={state === 'success' ? 'hidden' : ''}>
          <div id={containerId} />
          {state === 'submitting' && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Verificando con tu banco… esto puede tardar unos segundos.
            </p>
          )}
        </div>
      </div>
    </BottomSheet>
  )
}
