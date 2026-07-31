'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MapPin, Plus, Search, Sparkles, X } from 'lucide-react'

import { tagsDestacados, ubicacionDeCard } from '@/lib/search/card'
import {
  MAX_OPCIONES,
  MAX_OPCIONES_TOTAL,
  MIN_OPCIONES,
  SHORTLIST_STORAGE_KEY,
} from '@/lib/votaciones/constantes'
import type { SearchedPlace } from '@/lib/search/query'

/**
 * Picker de la votación (VOTACION F1). Reusa el motor de búsqueda vía
 * `/api/search` (decisión 12) —el mismo `publishedWhere`, no una segunda query de
 * catálogo— y arma la shortlist de 2-5 lugares. Al crear, muestra el link
 * compartible.
 *
 * El buscador es por **nombre** (el `q` de la búsqueda): es la forma natural de
 * "agregá este lugar que ya conocés" a la cancha. El filtrado por zona/facetas de
 * la home no se reusa acá a propósito — para el picker alcanza con el nombre.
 */

type PlaceElegido = Pick<SearchedPlace, 'id' | 'name' | 'zone' | 'locality' | 'tags'>

export function NuevaVotacion({ esPremium }: { esPremium: boolean }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState<SearchedPlace[]>([])
  const [buscando, setBuscando] = useState(false)
  const [elegidos, setElegidos] = useState<PlaceElegido[]>([])
  const [titulo, setTitulo] = useState('')
  // Que el grupo pueda sumar lugares (SUGERIR_EN_VOTACION, decisión 10). Prendido
  // por default: apagado por default la feature no existiría en la práctica.
  const [permitirSumar, setPermitirSumar] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [link, setLink] = useState<string | null>(null)

  // Precarga desde el chat IA (CHAT_IA F3, decisión 21): si venimos del botón
  // "Usar esta shortlist", el chat dejó los lugares en `sessionStorage`. Se cargan
  // como elegidos una sola vez y se limpia la clave (un refresh no re-inyecta). Los
  // ids se revalidan `isPlacePublished` al crear (VOTACION d.12) — esto es cosmético.
  useEffect(() => {
    let crudo: string | null = null
    try {
      crudo = sessionStorage.getItem(SHORTLIST_STORAGE_KEY)
      if (crudo) sessionStorage.removeItem(SHORTLIST_STORAGE_KEY)
    } catch {
      return
    }
    if (!crudo) return
    try {
      const datos: unknown = JSON.parse(crudo)
      if (!Array.isArray(datos)) return
      const precarga: PlaceElegido[] = datos
        .filter(
          (p): p is { id: string; name: string } & Record<string, unknown> =>
            !!p && typeof p.id === 'string' && typeof p.name === 'string',
        )
        .slice(0, MAX_OPCIONES)
        .map((p) => ({
          id: p.id,
          name: p.name,
          zone: typeof p.zone === 'string' ? p.zone : null,
          locality: typeof p.locality === 'string' ? p.locality : null,
          tags: Array.isArray(p.tags) ? (p.tags as PlaceElegido['tags']) : [],
        }))
      if (precarga.length > 0) setElegidos(precarga)
    } catch {
      // JSON corrupto: se ignora, el picker arranca vacío.
    }
  }, [])

  // Búsqueda con debounce: el picker no consulta en cada tecla.
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResultados([])
      setBuscando(false)
      return
    }
    setBuscando(true)
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        const json = await res.json()
        setResultados(json?.data?.places ?? [])
      } catch {
        // Abortada o red caída: no se pisa la lista con un error del picker.
      } finally {
        setBuscando(false)
      }
    }, 300)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [query])

  const yaEsta = (id: string) => elegidos.some((p) => p.id === id)
  const lleno = elegidos.length >= MAX_OPCIONES

  function agregar(place: SearchedPlace) {
    if (yaEsta(place.id) || lleno) return
    setElegidos((prev) => [
      ...prev,
      { id: place.id, name: place.name, zone: place.zone, locality: place.locality, tags: place.tags },
    ])
  }

  function quitar(id: string) {
    setElegidos((prev) => prev.filter((p) => p.id !== id))
  }

  async function crear() {
    setError(null)
    if (elegidos.length < MIN_OPCIONES) {
      setError(`Elegí al menos ${MIN_OPCIONES} lugares.`)
      return
    }
    setEnviando(true)
    try {
      const res = await fetch('/api/votaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: titulo.trim() || undefined,
          allowSuggestions: permitirSumar,
          placeIds: elegidos.map((p) => p.id),
        }),
      })
      const json = await res.json()
      if (!res.ok || json?.error) {
        setError(json?.error?.message ?? 'No pudimos crear la votación.')
        return
      }
      setLink(`${window.location.origin}/votacion/${json.data.token}`)
    } catch {
      setError('No pudimos crear la votación. Probá de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  // Pantalla de éxito: el link compartible (decisión / objetivo 1).
  if (link) {
    return <VotacionCreada link={link} />
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Shortlist elegida */}
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-foreground">Tu shortlist</h2>
          <span className="text-xs text-muted-foreground">
            {elegidos.length}/{MAX_OPCIONES}
          </span>
        </div>

        {elegidos.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Buscá lugares abajo y agregá {MIN_OPCIONES} a {MAX_OPCIONES}.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {elegidos.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                  {ubicacionDeCard(p) && (
                    <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                      <MapPin className="size-3" />
                      {ubicacionDeCard(p)}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => quitar(p.id)}
                  aria-label={`Quitar ${p.name}`}
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Título opcional */}
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-foreground">Título (opcional)</span>
        <input
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          maxLength={120}
          placeholder="¿Dónde el viernes?"
          className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary"
        />
      </label>

      {/* Que el grupo sume lugares (SUGERIR_EN_VOTACION, decisión 10). Se puede
          cambiar después desde "Mis votaciones". */}
      <label className="flex items-start gap-3 rounded-xl border border-border bg-card p-3">
        <input
          type="checkbox"
          checked={permitirSumar}
          onChange={(e) => setPermitirSumar(e.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-primary"
        />
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-foreground">
            Que el grupo pueda sumar lugares
          </span>
          <span className="text-xs text-muted-foreground">
            Cualquiera con el link puede agregar hasta llegar a {MAX_OPCIONES_TOTAL} en total. Vos
            podés sacar lo que sumen.
          </span>
        </span>
      </label>

      {/* Premium: "que la IA arme la shortlist" (VOTACION d.18 → encendido en
          CHAT_IA F3, decisión 21). Abre el chat en modo shortlist; al aceptar una
          lista, el chat vuelve acá con los lugares precargados. Free no lo ve. */}
      {esPremium && (
        <button
          type="button"
          onClick={() => router.push('/chat?modo=shortlist')}
          className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-primary/50 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
        >
          <Sparkles className="size-4" />
          Que la IA arme la shortlist
        </button>
      )}

      {/* Buscador embebido */}
      <section className="flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscá un lugar por nombre"
            className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary"
          />
        </div>

        {lleno && (
          <p className="text-xs text-muted-foreground">
            Llegaste al máximo de {MAX_OPCIONES}. Quitá uno para cambiarlo.
          </p>
        )}

        {buscando && <p className="text-sm text-muted-foreground">Buscando…</p>}

        {!buscando && query.trim().length >= 2 && resultados.length === 0 && (
          <p className="text-sm text-muted-foreground">No encontramos lugares con ese nombre.</p>
        )}

        <ul className="flex flex-col gap-2">
          {resultados.map((place) => {
            const elegido = yaEsta(place.id)
            const tags = tagsDestacados(place.tags)
            return (
              <li
                key={place.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{place.name}</p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                    {ubicacionDeCard(place) && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3" />
                        {ubicacionDeCard(place)}
                      </span>
                    )}
                    {tags.length > 0 && <span className="truncate">{tags.join(' · ')}</span>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => agregar(place)}
                  disabled={elegido || lleno}
                  aria-label={`Agregar ${place.name}`}
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border text-primary transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Plus className="size-4" />
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={crear}
        disabled={enviando || elegidos.length < MIN_OPCIONES}
        className="rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {enviando ? 'Creando…' : 'Crear votación y obtener link'}
      </button>
    </div>
  )
}

/** Pantalla de éxito: el link listo para pegar en el grupo. */
function VotacionCreada({ link }: { link: string }) {
  const [copiado, setCopiado] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Sin permiso de clipboard: el input queda seleccionable a mano.
      inputRef.current?.select()
    }
  }

  const token = link.split('/').pop() ?? ''

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-foreground">¡Votación lista!</h2>
        <p className="text-sm text-muted-foreground">
          Compartí este link al grupo. Cualquiera vota sin crear cuenta.{' '}
          <span className="text-foreground">Guardalo</span>: es la forma de volver a la
          votación, también después de cerrarla.
        </p>
      </div>

      <div className="flex gap-2">
        <input
          ref={inputRef}
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-muted-foreground outline-none"
        />
        <button
          type="button"
          onClick={copiar}
          className="shrink-0 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {copiado ? 'Copiado' : 'Copiar'}
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <Link
          href={`/votacion/${token}`}
          className="rounded-xl border border-border py-2.5 text-center text-sm font-medium text-foreground transition-colors hover:bg-secondary"
        >
          Ver la votación
        </Link>
        <Link
          href="/mis-votaciones"
          className="text-center text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          Ir a mis votaciones
        </Link>
      </div>
    </div>
  )
}
