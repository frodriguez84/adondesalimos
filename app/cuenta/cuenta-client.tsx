'use client'

import { useState } from 'react'
import Link from 'next/link'
import { authClient } from '@/lib/auth/client'
import { SuscripcionPanel } from '@/components/billing/suscripcion-panel'
import { BrandHeader } from '@/components/shared/brand-header'
import { PasswordInput } from '@/components/ui/password-input'
import type { CuposDelPlan } from '@/lib/billing/beneficios'
import type { EstadoSuscripcion } from '@/lib/billing/estado'

type Props = {
  user: { name: string; email: string }
  suscripcion: EstadoSuscripcion
  precioB2cArs: number
  /** Ya dejó la señal del premium (DEPLOY, decisión 6). */
  interesRegistrado?: boolean
  /** Cupos de runtime para el copy de beneficios; los resuelve la page. */
  cupos?: CuposDelPlan
}

export function CuentaClient({
  user,
  suscripcion,
  precioB2cArs,
  interesRegistrado,
  cupos,
}: Props) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-8 px-4 py-8">
      <BrandHeader />

      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Mi cuenta</h1>
        <Link href="/" className="text-sm text-muted-foreground transition-colors hover:text-primary">
          ← Volver
        </Link>
      </header>

      <PerfilSection name={user.name} email={user.email} />
      <SuscripcionPanel
        tipo="b2c"
        estado={suscripcion}
        precioArs={precioB2cArs}
        email={user.email}
        interesRegistrado={interesRegistrado}
        cupos={cupos}
      />
      <PasswordSection />
      <DangerZone />
    </main>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      {children}
    </section>
  )
}

const inputClass =
  'rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder-muted-foreground/60 transition-colors focus:border-primary/50 focus:outline-none disabled:opacity-60'
const btnClass =
  'rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50'

function Feedback({ error, ok }: { error: string | null; ok: string | null }) {
  if (error) {
    return (
      <div className="rounded-xl border border-red-800 bg-red-950/50 px-4 py-3">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }
  if (ok) {
    return (
      <div className="rounded-xl border border-green-800 bg-green-950/50 px-4 py-3">
        <p className="text-sm text-green-400">{ok}</p>
      </div>
    )
  }
  return null
}

function PerfilSection({ name: initialName, email }: { name: string; email: string }) {
  const [name, setName] = useState(initialName)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setOk(null)
    if (name.trim().length < 2) {
      setError('El nombre debe tener al menos 2 caracteres.')
      return
    }
    setSaving(true)
    const result = await authClient.updateUser({ name: name.trim() })
    setSaving(false)
    if (result.error) {
      setError('No se pudo guardar. Probá de nuevo.')
      return
    }
    setOk('Datos actualizados.')
  }

  return (
    <Card title="Datos">
      <form onSubmit={guardar} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Nombre</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Email</label>
          <input value={email} disabled className={inputClass} />
        </div>
        <Feedback error={error} ok={ok} />
        <button type="submit" disabled={saving} className={btnClass}>
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </form>
    </Card>
  )
}

function PasswordSection() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  async function cambiar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setOk(null)
    if (next.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.')
      return
    }
    setSaving(true)
    const result = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
      revokeOtherSessions: true,
    })
    setSaving(false)
    if (result.error) {
      setError('No se pudo cambiar. Revisá tu contraseña actual.')
      return
    }
    setCurrent('')
    setNext('')
    setOk('Contraseña actualizada.')
  }

  return (
    <Card title="Contraseña">
      <form method="post" onSubmit={cambiar} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Contraseña actual</label>
          <PasswordInput
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            placeholder="••••••••"
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Nueva contraseña</label>
          <PasswordInput
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder="Mínimo 8 caracteres"
            className={inputClass}
          />
        </div>
        <Feedback error={error} ok={ok} />
        <button type="submit" disabled={saving} className={btnClass}>
          {saving ? 'Cambiando...' : 'Cambiar contraseña'}
        </button>
      </form>
    </Card>
  )
}

function DangerZone() {
  const [confirming, setConfirming] = useState(false)
  const [password, setPassword] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function eliminar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setDeleting(true)
    const result = await authClient.deleteUser({ password })
    if (result.error) {
      setDeleting(false)
      setError('No se pudo eliminar. Revisá tu contraseña.')
      return
    }
    // Navegación completa: la sesión ya no existe.
    window.location.assign('/')
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-destructive/40 bg-card p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-destructive">Eliminar cuenta</h2>
      <p className="text-sm text-muted-foreground">
        Se borra tu cuenta de forma permanente. Esta acción no se puede deshacer.
      </p>
      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded-xl bg-destructive/10 py-3 font-semibold text-destructive transition-colors hover:bg-destructive/20"
        >
          Eliminar mi cuenta
        </button>
      ) : (
        <form method="post" onSubmit={eliminar} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">
              Confirmá con tu contraseña
            </label>
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={inputClass}
            />
          </div>
          {error && (
            <div className="rounded-xl border border-red-800 bg-red-950/50 px-4 py-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="flex-1 rounded-xl bg-secondary py-3 font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={deleting}
              className="flex-1 rounded-xl bg-destructive/10 py-3 font-semibold text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-50"
            >
              {deleting ? 'Eliminando...' : 'Sí, eliminar'}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
