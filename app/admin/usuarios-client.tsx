'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'

import { Aviso, inputClass } from '@/components/negocio/campos'
import type { LugarDelUsuario, MovimientoCortesia, UsuarioAdmin } from '@/lib/billing/admin'

/**
 * Tab Usuarios de `/admin` (ADMIN_USUARIOS, `FB-01`): las cuentas, y por cuenta el
 * **premium de cortesía** — el del usuario (B2C) y el de sus lugares reclamados
 * (B2B). Es lo que saca de `psql` la única forma que había de darle premium a
 * alguien.
 *
 * Todo lo que escribe postea a `POST /api/admin/usuarios/[userId]/plan`, que valida
 * y delega en `otorgarCortesia`/`revocarCortesia` — el flag lo sigue escribiendo su
 * dueño único. Acá no hay ni una regla de negocio.
 *
 * Después de cada acción se **relee del server** (la lista y `router.refresh()`):
 * no se toca el estado local a mano, así la pantalla no puede mentir sobre un plan
 * (mismo criterio que `ColaClient` y `PreciosClient`).
 *
 * Las confirmaciones son asimétricas a propósito (decisión 10): dar confirma en una
 * línea, sacar **nombra qué se oculta** y aclara que no se borra nada.
 */

type Props = { usuariosIniciales: UsuarioAdmin[]; total: number }

const fecha = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })

export function UsuariosClient({ usuariosIniciales, total }: Props) {
  const router = useRouter()
  const [termino, setTermino] = useState('')
  const [usuarios, setUsuarios] = useState(usuariosIniciales)
  const [totalCuentas, setTotalCuentas] = useState(total)
  const [buscado, setBuscado] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async (q: string) => {
    setCargando(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/usuarios?q=${encodeURIComponent(q)}`)
      const json = await res.json()
      if (!res.ok) {
        setError(json?.error?.message ?? 'No pudimos buscar.')
        return
      }
      setUsuarios(json.data.usuarios ?? [])
      setTotalCuentas(json.data.total ?? 0)
    } catch {
      setError('No pudimos conectarnos. Probá de nuevo.')
    } finally {
      setCargando(false)
    }
  }, [])

  async function buscar(e: React.FormEvent) {
    e.preventDefault()
    const q = termino.trim()
    setBuscado(q.length > 0)
    await cargar(q)
  }

  // Tras mover un plan: la lista se vuelve a leer del server con la búsqueda
  // vigente, y el resto de `/admin` se refresca.
  async function alMover() {
    await cargar(termino.trim())
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={buscar} className="flex gap-2">
        <input
          type="search"
          value={termino}
          onChange={(e) => setTermino(e.target.value)}
          placeholder="Buscá por mail o nombre"
          aria-label="Buscá por mail o nombre"
          className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
        <button
          type="submit"
          disabled={cargando}
          className="shrink-0 rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50"
        >
          {cargando ? 'Buscando…' : 'Buscar'}
        </button>
      </form>

      {/* Buscando, el total global no habla de lo listado: se dice cuántas se ven
          Y cuántas hay. Sin buscar, el conteo real va aparte del listado topeado. */}
      <p className="text-sm text-muted-foreground">
        {buscado ? (
          <>
            <strong className="font-semibold text-foreground">{usuarios.length}</strong>{' '}
            {usuarios.length === 1 ? 'resultado' : 'resultados'} de {totalCuentas}{' '}
            {totalCuentas === 1 ? 'cuenta' : 'cuentas'}.
          </>
        ) : (
          <>
            <strong className="font-semibold text-foreground">{totalCuentas}</strong>{' '}
            {totalCuentas === 1 ? 'cuenta' : 'cuentas'}.
            {totalCuentas > usuarios.length ? ` Abajo, las ${usuarios.length} más nuevas.` : ''}
          </>
        )}
      </p>

      {error && <Aviso tipo="error">{error}</Aviso>}

      {usuarios.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {buscado ? 'No hay ninguna cuenta con ese mail.' : 'Todavía no hay nadie registrado.'}
        </p>
      ) : (
        usuarios.map((u) => <FilaUsuario key={u.id} usuario={u} alMover={alMover} />)
      )}
    </div>
  )
}

function FilaUsuario({ usuario, alMover }: { usuario: UsuarioAdmin; alMover: () => Promise<void> }) {
  const premium = usuario.plan === 'premium'

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="break-all text-sm font-semibold text-foreground">{usuario.email}</p>
          <p className="text-xs text-muted-foreground">
            {[usuario.nombre, `alta ${fecha.format(new Date(usuario.createdAt))}`]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5">
          <BadgePlan premium={premium} paga={usuario.paga} />
          {!usuario.emailVerified && <Etiqueta>sin verificar</Etiqueta>}
        </div>
      </div>

      <AccionPlan
        userId={usuario.id}
        placeId={null}
        esPremium={premium}
        paga={usuario.paga}
        alMover={alMover}
      />

      {usuario.lugares.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Sus lugares
          </h4>
          {usuario.lugares.map((l) => (
            <FilaLugar key={l.id} userId={usuario.id} lugar={l} alMover={alMover} />
          ))}
        </div>
      )}

      <Bitacora userId={usuario.id} />
    </article>
  )
}

function FilaLugar({
  userId,
  lugar,
  alMover,
}: {
  userId: string
  lugar: LugarDelUsuario
  alMover: () => Promise<void>
}) {
  const pago = lugar.ownerPlan === 'paid'
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-secondary/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="min-w-0 text-sm text-foreground">{lugar.nombre}</span>
        <BadgePlan premium={pago} paga={lugar.paga} />
      </div>
      <AccionPlan
        userId={userId}
        placeId={lugar.id}
        esPremium={pago}
        paga={lugar.paga}
        alMover={alMover}
      />
    </div>
  )
}

/**
 * Dar o sacar la cortesía de UN eje. Con suscripción paga viva no hay botones: ese
 * eje no se toca desde acá (decisión 3) — para eso está la cancelación, que vive en
 * otro lado. El endpoint lo rechaza igual si se fuerza.
 */
function AccionPlan({
  userId,
  placeId,
  esPremium,
  paga,
  alMover,
}: {
  userId: string
  placeId: string | null
  esPremium: boolean
  paga: boolean
  alMover: () => Promise<void>
}) {
  const [abierto, setAbierto] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const esLugar = placeId !== null
  const accion = esPremium ? 'revocar' : 'otorgar'

  if (paga) {
    return (
      <p className="text-xs text-muted-foreground">
        Tiene una suscripción paga: desde acá no se toca.
      </p>
    )
  }

  async function confirmar() {
    setError(null)
    setTrabajando(true)
    try {
      const res = await fetch(`/api/admin/usuarios/${userId}/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion,
          ...(placeId ? { placeId } : {}),
          motivo: motivo.trim(),
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json?.error?.message ?? 'No pudimos guardarlo.')
        return
      }
      setAbierto(false)
      setMotivo('')
      await alMover()
    } catch {
      setError('No pudimos conectarnos. Probá de nuevo.')
    } finally {
      setTrabajando(false)
    }
  }

  if (!abierto) {
    return (
      <div className="flex flex-col gap-2">
        {error && <Aviso tipo="error">{error}</Aviso>}
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className={
            esPremium
              ? 'self-start rounded-lg bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/20'
              : 'self-start rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90'
          }
        >
          {esPremium
            ? esLugar
              ? 'Sacarle el plan'
              : 'Sacarle el Premium'
            : esLugar
              ? 'Darle el plan del lugar'
              : 'Darle Premium'}
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-background p-3">
      <p className="text-xs text-foreground">{textoConfirmacion(esPremium, esLugar)}</p>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">¿Por qué? (queda registrado)</span>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={2}
          maxLength={280}
          className={inputClass}
        />
      </label>
      {error && <Aviso tipo="error">{error}</Aviso>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setAbierto(false)
            setError(null)
          }}
          className="flex-1 rounded-lg bg-secondary py-2 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={trabajando || motivo.trim().length < 3}
          onClick={confirmar}
          className={
            esPremium
              ? 'flex-1 rounded-lg bg-destructive/10 py-2 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-50'
              : 'flex-1 rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50'
          }
        >
          {trabajando
            ? 'Aplicando…'
            : esPremium
              ? 'Sí, sacáselo'
              : esLugar
                ? 'Sí, dale el plan'
                : 'Sí, dale Premium'}
        </button>
      </div>
    </div>
  )
}

/**
 * Sacar nombra qué se oculta y que no se borra nada (decisión 10). Dar, una línea.
 *
 * ⚠️ El copy B2B **diverge del que escribió el spec**, con OK de Fer: el spec decía «las
 * fotos de la 4 a la 15 se ocultan», y el QA en vivo mostró que eso no pasa — la ficha
 * publica **una sola** foto de dueño (`app/lugar/[id]/page.tsx` ⇒ `ownerPhotos[0]`), así
 * que `CAP_FOTOS` gatea la **subida**, no la exhibición. Prometerle al admin un
 * ocultamiento que no ocurre es peor que un texto menos redondo. Lo que sí se oculta —los
 * 3 campos pagos— se nombra igual. Ver BACKLOG § *Salidos de ADMIN_USUARIOS*.
 */
function textoConfirmacion(esPremium: boolean, esLugar: boolean): string {
  if (!esPremium) {
    return esLugar
      ? 'Le vas a activar el plan pago del lugar. No vence y no se cobra.'
      : 'Le vas a activar el Premium. No vence y no se le cobra.'
  }
  return esLugar
    ? 'El lugar vuelve a free: la descripción, la carta y las novedades se ocultan (no se borran) y el cupo de fotos baja a 3 — las que ya subió quedan.'
    : 'Vuelve a free. Las listas que tenga de más se ocultan, no se borran: si se lo devolvés, vuelve todo.'
}

/**
 * La bitácora del usuario (decisión 7): se pide al desplegarla, no de entrada —
 * mover un plan a mano es la acción más rara de todo `/admin`. Es **solo para
 * mostrar**: ningún gate lee `plan_grants`.
 */
function Bitacora({ userId }: { userId: string }) {
  const [movimientos, setMovimientos] = useState<MovimientoCortesia[] | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function ver() {
    if (movimientos !== null) {
      setMovimientos(null)
      return
    }
    setCargando(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/usuarios?userId=${encodeURIComponent(userId)}`)
      const json = await res.json()
      if (!res.ok) {
        setError(json?.error?.message ?? 'No pudimos leer los movimientos.')
        return
      }
      setMovimientos(json.data.bitacora ?? [])
    } catch {
      setError('No pudimos conectarnos. Probá de nuevo.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={ver}
        className="self-start text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-primary"
      >
        {cargando ? 'Cargando…' : movimientos === null ? 'Ver movimientos' : 'Ocultar movimientos'}
      </button>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {movimientos !== null &&
        (movimientos.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nunca le tocaron el plan a mano.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-xs">
            {movimientos.map((m) => (
              <li key={m.id} className="text-muted-foreground">
                <span className="text-foreground">
                  {m.accion === 'grant' ? 'Le dieron' : 'Le sacaron'}{' '}
                  {m.lugar ? `el plan de ${m.lugar}` : 'Premium'}
                </span>{' '}
                · {fecha.format(new Date(m.createdAt))} · {m.grantedBy} · “{m.motivo}”
              </li>
            ))}
          </ul>
        ))}
    </div>
  )
}

/** «cortesía» = premium sin fila viva · «paga» = con fila viva · free = sin badge. */
function BadgePlan({ premium, paga }: { premium: boolean; paga: boolean }) {
  if (!premium) return null
  return <Etiqueta>{paga ? 'paga' : 'cortesía'}</Etiqueta>
}

function Etiqueta({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground">
      {children}
    </span>
  )
}
