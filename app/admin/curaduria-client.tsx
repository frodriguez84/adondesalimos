'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'

import type { FacetaEditable, LugarEnCola, SugerenciaEnCola, ZonaConCola } from '@/lib/curation/query'

/**
 * La cola de curaduría (CURADURIA, F2, decisión 9). Flujo por zona: elegís zona →
 * lugares con sugerencias pendientes, uno por vez, con la evidencia al lado de cada
 * tag. Aceptar todo / corregir (tildar-destildar) / rechazar, y al siguiente.
 *
 * **Teclado-first** (la velocidad de tildado ES el producto): `Enter` guarda,
 * `R` rechaza. El gate de admin lo hace `page.tsx` (server); esto es presentación
 * sobre datos ya resueltos + los POST al endpoint, que vuelve a verificar admin.
 */

const PRECIOS = [
  { slug: 'precio-1', label: '$' },
  { slug: 'precio-2', label: '$$' },
  { slug: 'precio-3', label: '$$$' },
  { slug: 'precio-4', label: '$$$$' },
] as const

export function CuraduriaClient({ zonasIniciales }: { zonasIniciales: ZonaConCola[] }) {
  const [zonas, setZonas] = useState<ZonaConCola[]>(zonasIniciales)
  const [zonaActiva, setZonaActiva] = useState<string | null>(null)
  const [lugar, setLugar] = useState<LugarEnCola | null>(null)
  const [cargando, setCargando] = useState(false)
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [zonaVacia, setZonaVacia] = useState(false)

  async function traerProximo(zona: string) {
    setCargando(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/curaduria?zona=${encodeURIComponent(zona)}`)
      const json = await res.json()
      if (!res.ok) {
        setError(json?.error?.message ?? 'No pudimos cargar la cola.')
        return
      }
      setZonas(json.data.zonas ?? [])
      setLugar(json.data.lugar ?? null)
      setZonaVacia(json.data.lugar === null)
    } catch {
      setError('No pudimos conectarnos. Probá de nuevo.')
    } finally {
      setCargando(false)
    }
  }

  function abrirZona(zona: string) {
    setZonaActiva(zona)
    setZonaVacia(false)
    setLugar(null)
    void traerProximo(zona)
  }

  function volverAZonas() {
    setZonaActiva(null)
    setLugar(null)
    setZonaVacia(false)
  }

  if (!zonaActiva) {
    return <SelectorZonas zonas={zonas} onElegir={abrirZona} />
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={volverAZonas}
        className="w-fit text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-primary"
      >
        ← Elegir otra zona
      </button>

      {error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {cargando ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Cargando…
        </p>
      ) : lugar ? (
        <RevisorLugar
          key={lugar.id}
          lugar={lugar}
          trabajando={trabajando}
          setTrabajando={setTrabajando}
          setError={setError}
          onResuelto={() => traerProximo(zonaActiva)}
        />
      ) : zonaVacia ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No quedan lugares pendientes en esta zona. 🎉
        </p>
      ) : null}
    </div>
  )
}

function SelectorZonas({
  zonas,
  onElegir,
}: {
  zonas: ZonaConCola[]
  onElegir: (slug: string) => void
}) {
  if (zonas.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        No hay sugerencias pendientes. Corré el batch (<code>npm run curar &lt;zona&gt;</code>) para
        llenar la cola.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Zonas con cola ({zonas.length})
      </h2>
      <ul className="flex flex-col gap-2">
        {zonas.map((z) => (
          <li key={z.slug}>
            <button
              type="button"
              onClick={() => onElegir(z.slug)}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary"
            >
              <span className="text-sm font-medium text-foreground">{z.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {z.lugaresPendientes} lugares · {z.sugerenciasPendientes} sugerencias
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function RevisorLugar({
  lugar,
  trabajando,
  setTrabajando,
  setError,
  onResuelto,
}: {
  lugar: LugarEnCola
  trabajando: boolean
  setTrabajando: (v: boolean) => void
  setError: (v: string | null) => void
  onResuelto: () => void
}) {
  const [elegidos, setElegidos] = useState<Set<string>>(
    () =>
      new Set(
        lugar.facetas.flatMap((f) =>
          f.tags.filter((t) => t.sugerido || t.yaAsignado).map((t) => t.slug),
        ),
      ),
  )
  const [precio, setPrecio] = useState<string | null>(null)

  function alternar(slug: string) {
    setElegidos((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })
  }

  const resolver = useCallback(
    async (body: { accion: 'guardar'; tags: string[]; precio: string | null } | { accion: 'rechazar' }) => {
      setTrabajando(true)
      setError(null)
      try {
        const res = await fetch(`/api/admin/curaduria/${lugar.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const json = await res.json()
        if (!res.ok) {
          setError(json?.error?.message ?? 'No pudimos guardar.')
          return
        }
        onResuelto()
      } catch {
        setError('No pudimos conectarnos. Probá de nuevo.')
      } finally {
        setTrabajando(false)
      }
    },
    [lugar.id, onResuelto, setError, setTrabajando],
  )

  // Teclado-first: Enter guarda, R rechaza (fuera de inputs de texto).
  const elegidosRef = useRef(elegidos)
  elegidosRef.current = elegidos
  const precioRef = useRef(precio)
  precioRef.current = precio
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      if (trabajando) return
      if (e.key === 'Enter') {
        e.preventDefault()
        void resolver({ accion: 'guardar', tags: [...elegidosRef.current], precio: precioRef.current })
      } else if (e.key.toLowerCase() === 'r') {
        e.preventDefault()
        void resolver({ accion: 'rechazar' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [resolver, trabajando])

  return (
    <article className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-base font-semibold text-foreground">{lugar.name}</p>
          {lugar.address && <p className="text-xs text-muted-foreground">{lugar.address}</p>}
        </div>
        <Link
          href={`/lugar/${lugar.id}`}
          target="_blank"
          className="shrink-0 text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-primary"
        >
          Ver ficha
        </Link>
      </header>

      {/* Evidencia: qué sugirió el modelo y por qué. */}
      <Evidencia sugerencias={lugar.sugerencias} />

      {/* Facetas editables: pre-tildadas con lo sugerido + lo que ya tiene. */}
      <div className="flex flex-col gap-4">
        {lugar.facetas.map((faceta) => (
          <Faceta key={faceta.facet} faceta={faceta} elegidos={elegidos} alternar={alternar} />
        ))}
      </div>

      {/* Precio: campo manual opcional, default "no sé" (decisión "Qué NO es"). */}
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Precio (opcional)
        </h3>
        <div className="flex flex-wrap gap-1.5">
          <Chip activo={precio === null} onClick={() => setPrecio(null)}>
            No sé
          </Chip>
          {PRECIOS.map((p) => (
            <Chip key={p.slug} activo={precio === p.slug} onClick={() => setPrecio(p.slug)}>
              {p.label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={trabajando}
          onClick={() => resolver({ accion: 'guardar', tags: [...elegidos], precio })}
          className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {trabajando ? 'Guardando…' : 'Guardar y seguir'}{' '}
          <kbd className="ml-1 rounded bg-primary-foreground/20 px-1 text-[10px]">Enter</kbd>
        </button>
        <button
          type="button"
          disabled={trabajando}
          onClick={() => resolver({ accion: 'rechazar' })}
          className="rounded-lg bg-destructive/10 px-4 py-2.5 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-50"
        >
          Rechazar <kbd className="ml-1 rounded bg-destructive/20 px-1 text-[10px]">R</kbd>
        </button>
      </div>
    </article>
  )
}

function Evidencia({ sugerencias }: { sugerencias: SugerenciaEnCola[] }) {
  if (sugerencias.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Sin sugerencias pendientes con evidencia para este lugar.
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-background/50 p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Sugerencias del modelo
      </h3>
      <ul className="flex flex-col gap-2">
        {sugerencias.map((s) => (
          <li key={s.tagSlug} className="text-sm">
            <span className="font-medium text-foreground">{s.tagName}</span>{' '}
            {s.evidence ? (
              <span className="text-muted-foreground">
                — “{s.evidence}”{' '}
                {s.sourceUrl && (
                  <a
                    href={s.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline underline-offset-2"
                  >
                    fuente
                  </a>
                )}
              </span>
            ) : (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                sin evidencia
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Faceta({
  faceta,
  elegidos,
  alternar,
}: {
  faceta: FacetaEditable
  elegidos: Set<string>
  alternar: (slug: string) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {faceta.label}
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {faceta.tags.map((t) => (
          <button
            key={t.slug}
            type="button"
            aria-pressed={elegidos.has(t.slug)}
            onClick={() => alternar(t.slug)}
            title={t.sugerido ? 'Sugerido por el modelo' : t.yaAsignado ? 'Ya lo tiene' : undefined}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              elegidos.has(t.slug)
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:border-muted-foreground/50'
            }`}
          >
            {t.sugerido && <span aria-hidden>✨ </span>}
            {t.name}
          </button>
        ))}
      </div>
    </div>
  )
}

function Chip({
  activo,
  onClick,
  children,
}: {
  activo: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
        activo
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border text-muted-foreground hover:border-muted-foreground/50'
      }`}
    >
      {children}
    </button>
  )
}
