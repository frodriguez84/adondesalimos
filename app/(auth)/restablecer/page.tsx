'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { authClient } from '@/lib/auth/client'
import { PasswordInput } from '@/components/ui/password-input'

const schema = z
  .object({
    password: z.string().min(8, 'Mínimo 8 caracteres'),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Las contraseñas no coinciden',
    path: ['confirm'],
  })

type FormData = z.infer<typeof schema>

export default function RestablecerPage() {
  return (
    <Suspense>
      <RestablecerForm />
    </Suspense>
  )
}

function RestablecerForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  if (!token) {
    return (
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-8 text-center">
        <h1 className="text-xl font-bold text-foreground">Link inválido</h1>
        <p className="text-sm text-muted-foreground">Este link no es válido o ya expiró. Solicitá uno nuevo.</p>
        <Link href="/recuperar" className="text-sm text-primary transition-colors hover:text-primary/80">
          Solicitar nuevo link →
        </Link>
      </div>
    )
  }

  async function onSubmit(data: FormData) {
    setServerError(null)
    const result = await authClient.resetPassword({ newPassword: data.password, token })
    if (result.error) {
      setServerError('El link expiró o no es válido. Solicitá uno nuevo.')
      return
    }
    router.push('/login?reset=ok')
  }

  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-8">
      <div>
        <h1 className="text-xl font-bold text-foreground">Nueva contraseña</h1>
        <p className="mt-1 text-sm text-muted-foreground">Elegí una contraseña de al menos 8 caracteres.</p>
      </div>

      {/* method="post" — sin él, un submit pre-hidratación filtra la contraseña nueva en la URL. */}
      <form method="post" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Nueva contraseña</label>
          <PasswordInput
            {...register('password')}
            placeholder="••••••••"
            className="rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder-muted-foreground/60 transition-colors focus:border-primary/50 focus:outline-none"
          />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Confirmá la contraseña</label>
          <PasswordInput
            {...register('confirm')}
            placeholder="••••••••"
            className="rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder-muted-foreground/60 transition-colors focus:border-primary/50 focus:outline-none"
          />
          {errors.confirm && <p className="text-xs text-destructive">{errors.confirm.message}</p>}
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
          {isSubmitting ? 'Guardando...' : 'Guardar nueva contraseña'}
        </button>
      </form>
    </div>
  )
}
