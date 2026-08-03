'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { signUp } from '@/lib/auth/client'
import { authErrorMessage } from '@/lib/auth/errorMessages'

const schema = z
  .object({
    name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
    email: z.string().email('Email inválido'),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  })

type FormData = z.infer<typeof schema>

export default function RegisterPage() {
  const [sent, setSent] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    setServerError(null)
    let result
    try {
      result = await signUp.email({ email: data.email, password: data.password, name: data.name })
    } catch {
      setServerError('No pudimos conectarnos. Revisá tu conexión y probá de nuevo.')
      return
    }
    if (result.error) {
      setServerError(authErrorMessage(result.error, 'No se pudo crear la cuenta. Probá con otro email.'))
      return
    }
    // Con `requireEmailVerification: true` el registro NO abre sesión: hay que
    // verificar el email primero. Mostramos la confirmación en vez de redirigir.
    setSent(true)
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-8 text-center">
        <div className="text-4xl">📬</div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Revisá tu mail</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Te mandamos un link para verificar tu email. Confirmalo y ya vas a poder iniciar sesión.
            Revisá también la carpeta de spam.
          </p>
        </div>
        <Link href="/login" className="text-sm text-primary transition-colors hover:text-primary/80">
          ← Ir a iniciar sesión
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-8">
      <div>
        <h1 className="text-xl font-bold text-foreground">Creá tu cuenta</h1>
        {/* PBETA-R3-02: la bajada era la del dueño (R6) y la lee todo el mundo, sobre
            todo el que viene de tocar Guardar. Primero lo que trae acá a la mayoría. */}
        <p className="mt-1 text-sm text-muted-foreground">
          Para guardar lugares, armar votaciones con tu grupo y reclamar tu negocio
        </p>
      </div>

      {/* method="post" evita que un submit pre-hidratación serialice las credenciales en la URL. */}
      <form method="post" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Nombre</label>
          <input
            type="text"
            {...register('name')}
            placeholder="Tu nombre"
            className="rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder-muted-foreground/60 transition-colors focus:border-primary/50 focus:outline-none"
          />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

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

        <div className="flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Contraseña</label>
          <input
            type="password"
            {...register('password')}
            placeholder="Mínimo 8 caracteres"
            className="rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder-muted-foreground/60 transition-colors focus:border-primary/50 focus:outline-none"
          />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Confirmá la contraseña</label>
          <input
            type="password"
            {...register('confirmPassword')}
            placeholder="Repetí la contraseña"
            className="rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder-muted-foreground/60 transition-colors focus:border-primary/50 focus:outline-none"
          />
          {errors.confirmPassword && (
            <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
          )}
        </div>

        {serverError && (
          <div className="rounded-xl border border-red-800 bg-red-950/50 px-4 py-3">
            <p className="text-sm text-destructive">{serverError}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? 'Creando cuenta...' : 'Crear cuenta'}
        </button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tenés cuenta?{' '}
        <Link href="/login" className="text-primary transition-colors hover:text-primary/80">
          Iniciá sesión
        </Link>
      </p>
    </div>
  )
}
