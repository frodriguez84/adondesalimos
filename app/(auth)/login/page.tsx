'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { signIn } from '@/lib/auth/client'
import { authErrorMessage } from '@/lib/auth/errorMessages'
import { PasswordInput } from '@/components/ui/password-input'
import { ReenviarVerificacion } from '@/components/auth/reenviar-verificacion'
import { destinoInterno } from '@/lib/navegacion/destino'

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Ingresá tu contraseña'),
})

type FormData = z.infer<typeof schema>

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const searchParams = useSearchParams()
  // SEC-04: el `callbackUrl` viene del query y termina en `location.assign()`, así
  // que se normaliza a ruta interna antes de tocarlo. `lib/navegacion/destino.ts`
  // es el dueño de esa regla; acá no se decide nada.
  const callbackUrl = destinoInterno(searchParams.get('callbackUrl'))
  const resetOk = searchParams.get('reset') === 'ok'
  // PBETA-R3-01: el que llega acá desde "Guardar" no pidió iniciar sesión, así
  // que la pantalla tiene que decirle por qué está parado en un formulario.
  const vinoAGuardar = searchParams.get('motivo') === 'guardar'
  // PBETA-R3-07: el que no tiene cuenta se va a `/registro`, y hasta acá el link
  // iba pelado — el registro perdía a dónde volver y por qué el usuario llegó.
  const registro = vinoAGuardar
    ? `/registro?callbackUrl=${encodeURIComponent(callbackUrl)}&motivo=guardar`
    : `/registro?callbackUrl=${encodeURIComponent(callbackUrl)}`
  const [serverError, setServerError] = useState<string | null>(null)
  // SEC-05: el email de esta cuenta está sin verificar. Guardamos la dirección para
  // ofrecerle el reenvío acá mismo — es el otro lugar por donde llega el que quedó
  // trabado, y hasta ahora el copy prometía un reenvío que podía no haber salido.
  const [sinVerificar, setSinVerificar] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    setServerError(null)
    setSinVerificar(null)
    let result
    try {
      result = await signIn.email({ email: data.email, password: data.password })
    } catch {
      setServerError('No pudimos conectarnos. Revisá tu conexión y probá de nuevo.')
      return
    }
    if (result.error) {
      if (result.error.code?.toUpperCase() === 'EMAIL_NOT_VERIFIED') {
        setSinVerificar(data.email)
      }
      setServerError(authErrorMessage(result.error, 'El email o la contraseña no coinciden.'))
      return
    }
    // Navegación completa para que la cookie de sesión viaje en el próximo request.
    window.location.assign(callbackUrl)
  }

  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-8">
      <div>
        <h1 className="text-xl font-bold text-foreground">
          {vinoAGuardar ? 'Entrá para guardarlo' : 'Iniciá sesión'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {vinoAGuardar
            ? 'Lo guardamos en tus lugares apenas entres. Si no tenés cuenta, hacela acá abajo.'
            : 'Accedé a tu cuenta'}
        </p>
      </div>

      {resetOk && (
        <div className="rounded-xl border border-green-800 bg-green-950/50 px-4 py-3">
          <p className="text-sm text-green-400">Contraseña actualizada. Ya podés iniciar sesión.</p>
        </div>
      )}

      {/* method="post" evita que un submit pre-hidratación serialice las credenciales en la URL. */}
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

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Contraseña</label>
            <Link href="/recuperar" className="text-xs text-muted-foreground transition-colors hover:text-primary">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <PasswordInput
            {...register('password')}
            placeholder="••••••••"
            className="rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder-muted-foreground/60 transition-colors focus:border-primary/50 focus:outline-none"
          />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>

        {serverError && (
          <div className="rounded-xl border border-red-800 bg-red-950/50 px-4 py-3">
            <p className="text-sm text-destructive">{serverError}</p>
            {sinVerificar && (
              <div className="mt-2">
                <ReenviarVerificacion email={sinVerificar} callbackURL={callbackUrl} />
              </div>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {isSubmitting ? 'Iniciando sesión...' : 'Iniciar sesión'}
        </button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        ¿No tenés cuenta?{' '}
        <Link href={registro} className="text-primary transition-colors hover:text-primary/80">
          Registrate
        </Link>
      </p>
    </div>
  )
}
