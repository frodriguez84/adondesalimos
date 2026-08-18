'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { authClient, signUp } from '@/lib/auth/client'
import { authErrorMessage } from '@/lib/auth/errorMessages'
import { PasswordInput } from '@/components/ui/password-input'
import { ReenviarVerificacion } from '@/components/auth/reenviar-verificacion'
import { destinoConPendiente, leerPendiente } from '@/lib/favoritos/pendiente'
import { destinoInterno } from '@/lib/navegacion/destino'

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
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  )
}

function RegisterForm() {
  const searchParams = useSearchParams()
  // SEC-04: acá better-auth ya valida el `callbackURL` contra `trustedOrigins`, así
  // que esta pantalla no estaba rota. Pasa por el mismo dueño igual, para que las
  // dos no vuelvan a divergir — y de paso un destino externo deja de romper el alta
  // con un error genérico: ahora simplemente cae en la home.
  const callbackUrl = destinoInterno(searchParams.get('callbackUrl'))
  const vinoAGuardar = searchParams.get('motivo') === 'guardar'
  const [sent, setSent] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  // SEC-05: la cuenta se creó pero el mail NO salió. Es un estado propio porque la
  // pantalla tiene que decir otra cosa: "revisá tu mail" ahí sería mentira, y el
  // usuario quedaría esperando algo que no va a llegar.
  const [cuentaSinMail, setCuentaSinMail] = useState<string | null>(null)
  const [emailAlta, setEmailAlta] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    setServerError(null)
    let result
    // PBETA-R3-07: en un alta nueva la vuelta es por el link del mail, que suele
    // abrir otra pestaña — y ahí el pendiente de `sessionStorage` no existe. Se lo
    // cuelga al `callbackURL` que better-auth pone en ese link, que es lo único de
    // esta cadena que cruza de pestaña. Sin pendiente, el destino no cambia.
    const pendiente = vinoAGuardar ? leerPendiente() : null
    const callbackURL = pendiente ? destinoConPendiente(callbackUrl, pendiente) : callbackUrl
    try {
      result = await signUp.email({
        email: data.email,
        password: data.password,
        name: data.name,
        callbackURL,
      })
    } catch {
      setServerError('No pudimos conectarnos. Revisá tu conexión y probá de nuevo.')
      return
    }
    if (result.error) {
      setServerError(authErrorMessage(result.error, 'No se pudo crear la cuenta. Probá con otro email.'))
      return
    }

    // SEC-05: el mail de verificación lo pide ESTA pantalla, no el sign-up. Por el
    // callback de `emailVerification` el error del envío nunca llegaba al cliente
    // —better-auth lo traga en `runInBackgroundOrAwait`— así que el alta devolvía 200
    // aunque Resend hubiera fallado y acá se mostraba "revisá tu mail". Este endpoint
    // sí propaga: si no salió, se dice que no salió y se ofrece reintentar.
    setEmailAlta(data.email)
    try {
      const { error } = await authClient.sendVerificationEmail({
        email: data.email,
        callbackURL,
      })
      if (error) {
        setCuentaSinMail(
          authErrorMessage(error, 'No pudimos mandarte el mail de verificación.'),
        )
        return
      }
    } catch {
      setCuentaSinMail('No pudimos mandarte el mail de verificación.')
      return
    }

    // Con `requireEmailVerification: true` el registro NO abre sesión: hay que
    // verificar el email primero. Mostramos la confirmación en vez de redirigir.
    setSent(true)
  }

  // La cuenta quedó creada y el mail no salió: se lo decimos, con el botón para
  // volver a pedirlo. Sin esto era un callejón sin salida (SEC-05).
  if (cuentaSinMail) {
    return (
      <div className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-8 text-center">
        <div className="text-4xl">📭</div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Creamos tu cuenta, pero el mail no salió</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {cuentaSinMail} Tu cuenta ya existe: para entrar necesitás verificar el mail, así que
            pedilo de nuevo acá.
          </p>
        </div>
        <div className="flex flex-col items-center gap-3">
          <ReenviarVerificacion email={emailAlta} callbackURL={callbackUrl} />
          <Link href="/login" className="text-sm text-muted-foreground transition-colors hover:text-primary">
            Ir a iniciar sesión
          </Link>
        </div>
      </div>
    )
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
        <div className="flex flex-col items-center gap-3">
          {/* SEC-05: "no me llegó" tiene salida sin salir de la pantalla. */}
          <ReenviarVerificacion email={emailAlta} callbackURL={callbackUrl} />
          <Link href="/login" className="text-sm text-primary transition-colors hover:text-primary/80">
            ← Ir a iniciar sesión
          </Link>
        </div>
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
          <PasswordInput
            {...register('password')}
            placeholder="Mínimo 8 caracteres"
            className="rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder-muted-foreground/60 transition-colors focus:border-primary/50 focus:outline-none"
          />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Confirmá la contraseña</label>
          <PasswordInput
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
