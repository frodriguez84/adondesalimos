'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { urlDeLugar } from '@/lib/lugar/url'
import { Aviso, inputClass } from '@/components/negocio/campos'
import type { ClaimEnCola } from '@/lib/claims/query'
import type { CorreccionEnCola } from '@/lib/negocio/query'

/**
 * La cola: pendientes para decidir y aprobados para poder **revocar**
 * (decisión 10 — un dueño aprobado que resultó no serlo vuelve a `rejected` y su
 * lugar pierde el `publish_override`).
 *
 * Los botones postean a `PATCH /api/admin/claims/[id]`, que es idempotente: un
 * doble click no duplica nada ni re-manda el mail. Al terminar, `router.refresh()`
 * vuelve a leer del server — la cola no mantiene estado propio que pueda mentir.
 *
 * Desde CORRECCION_DATOS (decisión 16) comparte pantalla con las **correcciones de
 * datos base propuestas por dueños**: revisar una corrección es el mismo trabajo
 * que revisar un reclamo, con el mismo criterio y la misma persona. Van arriba
 * porque son las que dejan a un lugar mal ubicado para todo el mundo mientras
 * esperan.
 */

type Props = {
  pendientes: ClaimEnCola[]
  aprobados: ClaimEnCola[]
  correcciones: CorreccionEnCola[]
}

export function ColaClient({ pendientes, aprobados, correcciones }: Props) {
  return (
    <div className="flex flex-col gap-8">
      {correcciones.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Correcciones de datos ({correcciones.length})
          </h2>
          {correcciones.map((c) => (
            <FilaCorreccion key={c.id} correccion={c} />
          ))}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Pendientes ({pendientes.length})
        </h2>
        {pendientes.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No hay solicitudes esperando.
          </p>
        ) : (
          pendientes.map((c) => <Fila key={c.id} claim={c} />)
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Aprobados ({aprobados.length})
        </h2>
        {aprobados.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Todavía no aprobaste ninguno.
          </p>
        ) : (
          aprobados.map((c) => <Fila key={c.id} claim={c} />)
        )}
      </section>
    </div>
  )
}

function Fila({ claim }: { claim: ClaimEnCola }) {
  const router = useRouter()
  const [rechazando, setRechazando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const aprobado = claim.status === 'approved'
  const ubicacion = [claim.place.zone, claim.place.address ?? claim.place.locality]
    .filter(Boolean)
    .join(' · ')

  async function decidir(body: { accion: 'approve' } | { accion: 'reject'; motivo: string }) {
    setError(null)
    setTrabajando(true)
    try {
      const res = await fetch(`/api/admin/claims/${claim.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json?.error?.message ?? 'No pudimos aplicar la decisión.')
        return
      }
      setRechazando(false)
      setMotivo('')
      router.refresh()
    } catch {
      setError('No pudimos conectarnos. Probá de nuevo.')
    } finally {
      setTrabajando(false)
    }
  }

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{claim.place.name}</p>
          {ubicacion && <p className="text-xs text-muted-foreground">{ubicacion}</p>}
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Etiqueta>{claim.kind === 'new' ? 'Alta nueva' : 'Reclamo'}</Etiqueta>
          <Etiqueta>{claim.place.publicado ? 'Publicado' : 'Invisible'}</Etiqueta>
        </div>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <Dato termino="Solicitante" valor={claim.applicantName} />
        <Dato termino="Rol" valor={claim.applicantRole} />
        <Dato termino="Teléfono" valor={claim.applicantPhone} />
        <Dato termino="Cuenta" valor={claim.userEmail} />
        <Dato termino="Comentario" valor={claim.comment} />
        {/* TITULARIDAD decisión 6: es el dato que sostiene la revocación — sin
            verlo, el admin no sabe con qué texto se comprometió esta persona. */}
        <Dato
          termino="Declaración"
          valor={
            claim.declaracionVersion
              ? `Declaró ser dueño o estar autorizado (${claim.declaracionVersion})`
              : 'Sin declaración: es anterior a que la pidiéramos'
          }
        />
        {aprobado && <Dato termino="Aprobado por" valor={claim.decidedBy} />}
      </dl>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={urlDeLugar(claim.place.id)}
          target="_blank"
          className="text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-primary"
        >
          Ver ficha
        </Link>
      </div>

      {error && <Aviso tipo="error">{error}</Aviso>}

      {rechazando ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={2}
            placeholder="Motivo (se lo mandamos por mail)"
            className={inputClass}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setRechazando(false)}
              className="flex-1 rounded-lg bg-secondary py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={trabajando || motivo.trim().length < 3}
              onClick={() => decidir({ accion: 'reject', motivo: motivo.trim() })}
              className="flex-1 rounded-lg bg-destructive/10 py-2 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-50"
            >
              {trabajando ? 'Aplicando…' : aprobado ? 'Revocar' : 'Rechazar'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          {!aprobado && (
            <button
              type="button"
              disabled={trabajando}
              onClick={() => decidir({ accion: 'approve' })}
              className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {trabajando ? 'Aplicando…' : 'Aprobar'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setRechazando(true)}
            className="flex-1 rounded-lg bg-destructive/10 py-2 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/20"
          >
            {aprobado ? 'Revocar' : 'Rechazar'}
          </button>
        </div>
      )}
    </article>
  )
}

function Etiqueta({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground">
      {children}
    </span>
  )
}

function Dato({ termino, valor }: { termino: string; valor: string | null }) {
  if (!valor) return null
  return (
    <>
      <dt className="text-muted-foreground">{termino}</dt>
      <dd className="min-w-0 break-words text-foreground">{valor}</dd>
    </>
  )
}

// ---------------------------------------------------------------------------
// Correcciones de datos base (CORRECCION_DATOS, decisión 16)
// ---------------------------------------------------------------------------

const ETIQUETA_CAMPO: Record<string, string> = {
  name: 'Nombre',
  address: 'Dirección',
  locality: 'Localidad',
  lat: 'Latitud',
  lng: 'Longitud',
}

/**
 * Una propuesta de dueño esperando decisión. Muestra el **antes → después** de
 * cada campo y la fuente que tipeó, que es el único material con el que el admin
 * puede aprobar o rechazar (decisión 13).
 *
 * Aprobar aplica la corrección entera (valores, `locked_fields`, zonas y match de
 * Google) por el mismo camino que la edición de admin: acá solo se postea.
 */
function FilaCorreccion({ correccion }: { correccion: CorreccionEnCola }) {
  const router = useRouter()
  const [rechazando, setRechazando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function decidir(body: { accion: 'approve' } | { accion: 'reject'; motivo: string }) {
    setError(null)
    setTrabajando(true)
    try {
      const res = await fetch(`/api/admin/correcciones/${correccion.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json?.error?.message ?? 'No pudimos aplicar la decisión.')
        return
      }
      setRechazando(false)
      setMotivo('')
      router.refresh()
    } catch {
      setError('No pudimos conectarnos. Probá de nuevo.')
    } finally {
      setTrabajando(false)
    }
  }

  const ubicacion = [correccion.zona, correccion.placeAddress].filter(Boolean).join(' · ')

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{correccion.placeName}</p>
          {ubicacion && <p className="text-xs text-muted-foreground">{ubicacion}</p>}
        </div>
        <Etiqueta>Corrección de datos</Etiqueta>
      </div>

      <ul className="flex flex-col gap-0.5 text-xs">
        {Object.entries(correccion.campos).map(([campo, cambio]) => (
          <li key={campo} className="text-foreground">
            <span className="text-muted-foreground">{ETIQUETA_CAMPO[campo] ?? campo}: </span>
            {String(cambio.antes ?? '—')} → {String(cambio.despues ?? '—')}
          </li>
        ))}
      </ul>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <Dato termino="Fuente" valor={correccion.fuente} />
        <Dato termino="Cuenta" valor={correccion.solicitante} />
      </dl>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={urlDeLugar(correccion.placeId)}
          target="_blank"
          className="text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-primary"
        >
          Ver ficha
        </Link>
      </div>

      {error && <Aviso tipo="error">{error}</Aviso>}

      {rechazando ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={2}
            placeholder="Motivo (lo ve el dueño en su panel)"
            className={inputClass}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setRechazando(false)}
              className="flex-1 rounded-lg bg-secondary py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={trabajando || motivo.trim().length < 3}
              onClick={() => decidir({ accion: 'reject', motivo: motivo.trim() })}
              className="flex-1 rounded-lg bg-destructive/10 py-2 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-50"
            >
              {trabajando ? 'Aplicando…' : 'Rechazar'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={trabajando}
            onClick={() => decidir({ accion: 'approve' })}
            className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {trabajando ? 'Aplicando…' : 'Aprobar'}
          </button>
          <button
            type="button"
            onClick={() => setRechazando(true)}
            className="flex-1 rounded-lg bg-destructive/10 py-2 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/20"
          >
            Rechazar
          </button>
        </div>
      )}
    </article>
  )
}
