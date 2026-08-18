'use client'

import { useState } from 'react'
import { authClient } from '@/lib/auth/client'
import { authErrorMessage } from '@/lib/auth/errorMessages'

/**
 * Botón para pedir de nuevo el mail de verificación (`SEC-05` b).
 *
 * **Por qué existe:** no había ninguna forma de reenviarlo en toda la app. Quien
 * caía en un envío fallido quedaba con la cuenta creada, sin verificar, sin poder
 * loguear (`requireEmailVerification: true`) y sin poder re-registrarse —el email ya
 * existía—. Era un callejón sin salida que se abría con que Resend tuviera un mal
 * día, sin ningún atacante de por medio.
 *
 * Pega contra `/send-verification-email`, que **no requiere sesión** (así puede
 * usarlo justamente el que no puede entrar) y que sí propaga el error del envío. El
 * abuso que eso habilitaba —N reenvíos al mismo buzón— lo corta el cupo por
 * destinatario de `lib/email/cupo.ts`, y cuando corta se ve acá como copy, no como
 * un 500.
 *
 * El componente **no dice si la cuenta existe ni si ya está verificada**: el
 * endpoint contesta lo mismo en los tres casos (con un piso de tiempo constante,
 * para que no se pueda distinguir por lo que tarda). Enumerar usuarios no es algo
 * que esta pantalla vaya a regalar.
 */
export function ReenviarVerificacion({
  email,
  callbackURL,
}: {
  email: string
  /** A dónde vuelve el usuario después de verificar. Por defecto, la home. */
  callbackURL?: string
}) {
  const [estado, setEstado] = useState<'inicial' | 'enviando' | 'enviado'>('inicial')
  const [error, setError] = useState<string | null>(null)

  async function reenviar() {
    setEstado('enviando')
    setError(null)
    try {
      const { error: err } = await authClient.sendVerificationEmail({ email, callbackURL })
      if (err) {
        setError(
          authErrorMessage(err, 'No pudimos mandarlo ahora. Probá de nuevo en un rato.'),
        )
        setEstado('inicial')
        return
      }
      setEstado('enviado')
    } catch {
      setError('No pudimos conectarnos. Revisá tu conexión y probá de nuevo.')
      setEstado('inicial')
    }
  }

  if (estado === 'enviado') {
    return (
      <p className="text-sm text-green-400">
        Listo, te lo mandamos de nuevo. Revisá también el spam.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={reenviar}
        disabled={estado === 'enviando'}
        className="text-sm text-primary transition-colors hover:text-primary/80 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {estado === 'enviando' ? 'Mandando...' : 'Reenviarme el link'}
      </button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
