'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'

import { BotonGuardar } from '@/components/favoritos/boton-guardar'
import { BrandHeader } from '@/components/shared/brand-header'
import { PlaceCard } from '@/components/shared/place-card'
import type { ListaConLugares, LugarDeLista } from '@/lib/favoritos/query'
import { ubicacionDeCard } from '@/lib/search/card'

/**
 * `/mis-lugares` del lado del cliente (FAVORITOS F2).
 *
 * Tres cosas y nada más: **ver** lo guardado, **sacar** un lugar de una lista, y
 * —premium— **crear, renombrar y borrar** listas. Sin orden manual, sin notas,
 * sin carpetas (§ Qué NO es esta feature).
 *
 * Después de cada acción, `router.refresh()`: el server component vuelve a leer y
 * la pantalla queda con lo que dice la base, no con lo que el cliente cree. Es más
 * barato que mantener un espejo del estado acá y no puede mentir.
 */

export function MisLugares({
  listas,
  puedeCrear,
  esPremium,
}: {
  listas: ListaConLugares[]
  puedeCrear: boolean
  esPremium: boolean
}) {
  const router = useRouter()
  const [creando, setCreando] = React.useState(false)

  const total = listas.reduce((n, l) => n + l.lugares.length, 0)

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 px-4 py-8">
      {/* El renglón del título ya lo ocupa el CTA: la marca y el volver van arriba. */}
      <div className="flex items-center justify-between gap-3">
        <BrandHeader />
        <Link
          href="/"
          className="shrink-0 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          ← Volver
        </Link>
      </div>

      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Mis lugares</h1>
        {puedeCrear && !creando && (
          <button
            type="button"
            onClick={() => setCreando(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="size-4" />
            Nueva lista
          </button>
        )}
      </header>

      {creando && (
        <FormularioLista
          titulo="¿Cómo se va a llamar?"
          textoAccion="Crear"
          onEnviar={async (name) => {
            const res = await fetch('/api/listas', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name }),
            })
            const json = await res.json()
            if (!res.ok || json?.error) return json?.error?.message ?? 'No pudimos crear la lista.'
            setCreando(false)
            router.refresh()
            return null
          }}
          onCancelar={() => setCreando(false)}
        />
      )}

      {total === 0 && listas.length <= 1 ? (
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
          <h2 className="text-base font-semibold text-foreground">Todavía no guardaste nada</h2>
          <p className="text-sm text-muted-foreground">
            Cuando encuentres un lugar que te pinta, tocá el marcador de la card o de la ficha y
            queda acá para cuando lo necesites.
          </p>
          <Link
            href="/"
            className="rounded-xl bg-primary py-3 text-center font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Buscar lugares
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {listas.map((lista) => (
            <Lista key={lista.id} lista={lista} />
          ))}
        </div>
      )}

      {!esPremium && (
        <p className="rounded-xl border border-dashed border-border px-4 py-3 text-xs text-muted-foreground">
          Con premium podés armar varias listas —“birras”, “con los viejos”, “para una cita”— y
          elegir en cuál guardar cada lugar. Por ahora tenés una sola.
        </p>
      )}
    </main>
  )
}

function Lista({ lista }: { lista: ListaConLugares }) {
  const router = useRouter()
  const [renombrando, setRenombrando] = React.useState(false)
  const [borrando, setBorrando] = React.useState(false)
  const [enviando, setEnviando] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function borrar() {
    setError(null)
    setEnviando(true)
    try {
      const res = await fetch(`/api/listas/${lista.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok || json?.error) {
        setError(json?.error?.message ?? 'No pudimos borrar la lista.')
        return
      }
      setBorrando(false)
      router.refresh()
    } catch {
      setError('No pudimos borrar la lista. Probá de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="min-w-0 truncate text-base font-semibold text-foreground">
          {lista.name}
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {lista.lugares.length}
          </span>
        </h2>

        {/* La default no se renombra ni se borra (decisión 15). El server lo
            valida igual: esconder los botones es cosmética. */}
        {!lista.isDefault && !renombrando && !borrando && (
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              onClick={() => setRenombrando(true)}
              aria-label={`Renombrar ${lista.name}`}
              className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <Pencil className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setBorrando(true)}
              aria-label={`Borrar ${lista.name}`}
              className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        )}
      </div>

      {renombrando && (
        <FormularioLista
          titulo="Nuevo nombre"
          textoAccion="Guardar"
          valorInicial={lista.name}
          onEnviar={async (name) => {
            const res = await fetch(`/api/listas/${lista.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name }),
            })
            const json = await res.json()
            if (!res.ok || json?.error) return json?.error?.message ?? 'No pudimos renombrarla.'
            setRenombrando(false)
            router.refresh()
            return null
          }}
          onCancelar={() => setRenombrando(false)}
        />
      )}

      {/* Borrar una lista se lleva sus lugares: se confirma, como cancelar una votación. */}
      {borrando && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3">
          <p className="text-sm font-medium text-foreground">¿Borrar “{lista.name}”?</p>
          <p className="text-xs text-muted-foreground">
            Se van también los {lista.lugares.length}{' '}
            {lista.lugares.length === 1 ? 'lugar guardado' : 'lugares guardados'} en ella. Los
            lugares siguen estando en la app; lo que se borra es la lista.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={borrar}
              disabled={enviando}
              className="flex-1 rounded-lg bg-destructive py-2 text-sm font-semibold text-white transition-colors hover:bg-destructive/90 disabled:opacity-50"
            >
              {enviando ? 'Borrando…' : 'Sí, borrar'}
            </button>
            <button
              type="button"
              onClick={() => setBorrando(false)}
              disabled={enviando}
              className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-50"
            >
              Volver
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {lista.lugares.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
          Nada guardado en esta lista todavía.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {lista.lugares.map((lugar) => (
            <ItemGuardado key={lugar.placeId} lugar={lugar} listId={lista.id} />
          ))}
        </div>
      )}
    </section>
  )
}

/**
 * Un lugar guardado. Publicado: la card de siempre, con el botón para sacarlo de
 * **esta** lista. Despublicado: sigue apareciendo (decisión 11), atenuado y sin
 * link — la ficha le daría 404 por `publishedWhere`, y un link a un 404 es peor
 * que ninguno.
 */
function ItemGuardado({ lugar, listId }: { lugar: LugarDeLista; listId: string }) {
  const router = useRouter()
  const ubicacion = ubicacionDeCard(lugar)

  const accion = (
    <BotonGuardar
      placeId={lugar.placeId}
      guardadoInicial
      autenticado
      listId={listId}
      onCambio={() => router.refresh()}
    />
  )

  if (!lugar.publicado) {
    return (
      <div className="relative rounded-xl border border-dashed border-border bg-card/60 p-4 pr-12">
        <div className="absolute right-2 top-2 z-10">{accion}</div>
        <p className="text-base font-semibold leading-snug text-muted-foreground">{lugar.name}</p>
        {ubicacion && <p className="text-sm text-muted-foreground">{ubicacion}</p>}
        <p className="mt-1 text-xs text-muted-foreground">Ya no está disponible</p>
      </div>
    )
  }

  return (
    <PlaceCard id={lugar.placeId} name={lugar.name} location={ubicacion} accion={accion} />
  )
}

/** Alta y renombrado comparten forma: un input, aceptar, cancelar, error inline. */
function FormularioLista({
  titulo,
  textoAccion,
  valorInicial = '',
  onEnviar,
  onCancelar,
}: {
  titulo: string
  textoAccion: string
  valorInicial?: string
  /** Devuelve el mensaje de error, o `null` si salió bien. */
  onEnviar: (name: string) => Promise<string | null>
  onCancelar: () => void
}) {
  const [name, setName] = React.useState(valorInicial)
  const [enviando, setEnviando] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (enviando) return
    setError(null)
    setEnviando(true)
    try {
      const problema = await onEnviar(name.trim())
      if (problema) setError(problema)
    } catch {
      setError('No pudimos guardarlo. Probá de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
      <label className="text-sm font-medium text-foreground" htmlFor="nombre-lista">
        {titulo}
      </label>
      <div className="flex gap-2">
        <input
          id="nombre-lista"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          autoFocus
          placeholder="Birras, con los viejos, para una cita…"
          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-muted-foreground/50"
        />
        <button
          type="submit"
          disabled={enviando || name.trim().length === 0}
          aria-label={textoAccion}
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          <Check className="size-4" />
        </button>
        <button
          type="button"
          onClick={onCancelar}
          disabled={enviando}
          aria-label="Cancelar"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-50"
        >
          <X className="size-4" />
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  )
}
