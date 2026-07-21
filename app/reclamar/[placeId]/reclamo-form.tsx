'use client'

import { useState } from 'react'
import Link from 'next/link'

import {
  Aviso,
  btnClass,
  CamposSolicitante,
  erroresDeZod,
  SOLICITANTE_VACIO,
  type DatosSolicitante,
  type Errores,
} from '@/components/negocio/campos'
import { reclamoSchema } from '@/lib/claims/validacion'

/**
 * Formulario de reclamo. Valida con el mismo schema que el endpoint y postea a
 * `/api/claims`; el servidor vuelve a validar todo (regla global: el cliente no
 * es un boundary de seguridad).
 */
export function ReclamoForm({ placeId }: { placeId: string }) {
  const [datos, setDatos] = useState<DatosSolicitante>(SOLICITANTE_VACIO)
  const [errores, setErrores] = useState<Errores>({})
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const payload = { kind: 'claim' as const, placeId, ...datos }
    const parsed = reclamoSchema.safeParse(payload)
    if (!parsed.success) {
      setErrores(erroresDeZod(parsed.error))
      return
    }
    setErrores({})
    setEnviando(true)

    try {
      const res = await fetch('/api/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json?.error?.message ?? 'No pudimos guardar tu solicitud.')
        return
      }
      setEnviado(true)
    } catch {
      setError('No pudimos conectarnos. Revisá tu conexión y probá de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  if (enviado) {
    return (
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
        <h2 className="text-base font-semibold text-foreground">Recibimos tu solicitud</h2>
        <p className="text-sm text-muted-foreground">
          La revisamos a mano, una por una. Te avisamos por mail cuando esté resuelta.
        </p>
        <Link href="/" className={`${btnClass} text-center`}>
          Volver al inicio
        </Link>
      </div>
    )
  }

  return (
    <form
      method="post"
      onSubmit={enviar}
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6"
    >
      <p className="text-sm text-muted-foreground">
        Contanos quién sos. Verificamos cada solicitud a mano antes de darte el control de la ficha.
      </p>

      <CamposSolicitante
        valores={datos}
        onChange={(cambio) => setDatos((d) => ({ ...d, ...cambio }))}
        errores={errores}
      />

      {error && <Aviso tipo="error">{error}</Aviso>}

      <button type="submit" disabled={enviando} className={btnClass}>
        {enviando ? 'Enviando…' : 'Enviar solicitud'}
      </button>
    </form>
  )
}
