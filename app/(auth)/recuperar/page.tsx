'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { authClient } from '@/lib/auth/client'

const schema = z.object({
  email: z.string().email('Email inválido'),
})

type FormData = z.infer<typeof schema>

export default function RecuperarPage() {
  const [sent, setSent] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    setServerError(null)
    const result = await authClient.requestPasswordReset({
      email: data.email,
      redirectTo: '/restablecer',
    })
    if (result.error) {
      setServerError('Ocurrió un error. Intentá de nuevo.')
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-8 text-center">
        <div className="text-4xl">📬</div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Revisá tu mail</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Si existe una cuenta con ese email, vas a recibir un link para restablecer tu contraseña.
            Revisá también la carpeta de spam.
          </p>
        </div>
        <Link href="/login" className="text-sm text-primary transition-colors hover:text-primary/80">
          ← Volver al inicio de sesión
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-8">
      <div>
        <h1 className="text-xl font-bold text-foreground">Restablecer contraseña</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ingresá tu email y te mandamos un link para crear una nueva contraseña.
        </p>
      </div>

      {/* method="post" — mismo patrón que login/registro. */}
      <form method="post" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Email</label>
          <input
            type="email"
            {...register('email')}
            placeholder="vos@ejemplo.com"
            className="rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder-muted-foreground/60 transition-colors focus:border-primary/50 focus:outline-none"
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        {serverError && (
          <div className="rounded-xl border border-red-800 bg-red-950/50 px-4 py-3">
            <p className="text-sm text-destructive">{serverError}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {isSubmitting ? 'Enviando...' : 'Enviar link de restablecimiento'}
        </button>
      </form>

      <p className="text-center text-sm">
        <Link href="/login" className="text-muted-foreground transition-colors hover:text-primary">
          ← Volver al inicio de sesión
        </Link>
      </p>
    </div>
  )
}
