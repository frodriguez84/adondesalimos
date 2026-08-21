'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'

import { urlDeLugar } from '@/lib/lugar/url'
import { Aviso, inputClass } from '@/components/negocio/campos'
import type { LugarBuscado } from '@/lib/curation/query'
import type { EdicionDeDatos, LugarParaCorregir } from '@/lib/negocio/query'
import type { GoogleEnriquecimiento } from '@/lib/google/types'

/**
 * Tab **Lugares** (CORRECCION_DATOS, decisión 16): buscar un lugar por nombre,
 * corregirle los datos base, ver su bitácora y soltar un campo fijado.
 *
 * Es la única superficie donde un dato base se edita a mano. **Todo lo que se
 * guarda pasa por `PATCH /api/admin/lugares/[placeId]`**, que delega en el dueño
 * único (`lib/negocio/correcciones.ts`): acá no hay ninguna regla de negocio que
 * se pueda desincronizar — ni el bbox, ni la fuente mínima, ni qué invalida el
 * match con Google.
 *
 * Vive en una tab propia y no en «Curaduría» a propósito: esa cola está optimizada
 * para pasar rápido por muchos lugares etiquetando, y esto es una edición rara,
 * cuidadosa y auditada.
 */

// MapLibre son ~200 KB gzip: el selector de pin se carga recién al abrir un lugar,
// igual que en el alta. `ssr: false` porque MapLibre toca `window` al construirse.
const PinPicker = dynamic(() => import('@/components/negocio/pin-picker').then((m) => m.PinPicker), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded-xl border border-border bg-card" />,
})

export function LugaresClient() {
  const [lugar, setLugar] = useState<LugarParaCorregir | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Recargar el mismo id no remonta el editor (su estado nace del prop), así que
  // el form seguiría mostrando lo tipeado en vez de lo persistido. Mismo truco que
  // la curaduría por nombre: el contador va en la `key`.
  const [revision, setRevision] = useState(0)

  async function abrir(placeId: string, esRecarga = false) {
    setCargando(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/lugares?placeId=${encodeURIComponent(placeId)}`)
      const json = await res.json()
      if (!res.ok || !json.data?.lugar) {
        setError(json?.error?.message ?? 'No encontramos ese lugar.')
        return
      }
      setLugar(json.data.lugar)
      setRevision((r) => (esRecarga ? r + 1 : 0))
    } catch {
      setError('No pudimos conectarnos. Probá de nuevo.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Buscador onElegir={(id) => void abrir(id)} />

      {cargando && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {error && <Aviso tipo="error">{error}</Aviso>}

      {lugar && (
        <Editor
          key={`${lugar.id}-${revision}`}
          lugar={lugar}
          onGuardado={(actualizado) => {
            setLugar(actualizado)
            setRevision((r) => r + 1)
          }}
          onCerrar={() => setLugar(null)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Buscador
// ---------------------------------------------------------------------------

function Buscador({ onElegir }: { onElegir: (placeId: string) => void }) {
  const [termino, setTermino] = useState('')
  const [resultados, setResultados] = useState<LugarBuscado[] | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function buscar(e: React.FormEvent) {
    e.preventDefault()
    const q = termino.trim()
    if (q.length < 2) {
      setResultados(null)
      setError(null)
      return
    }
    setBuscando(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/lugares?q=${encodeURIComponent(q)}`)
      const json = await res.json()
      if (!res.ok) {
        setError(json?.error?.message ?? 'No pudimos buscar.')
        return
      }
      setResultados(json.data.lugares ?? [])
    } catch {
      setError('No pudimos conectarnos. Probá de nuevo.')
    } finally {
      setBuscando(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <form onSubmit={buscar} className="flex gap-2">
        <input
          type="search"
          value={termino}
          onChange={(e) => setTermino(e.target.value)}
          placeholder="Buscá el lugar por nombre"
          aria-label="Buscá el lugar por nombre"
          className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
        <button
          type="submit"
          disabled={buscando}
          className="shrink-0 rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50"
        >
          {buscando ? 'Buscando…' : 'Buscar'}
        </button>
      </form>

      {error && <Aviso tipo="error">{error}</Aviso>}

      {resultados !== null &&
        (resultados.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No encontramos ningún lugar con ese nombre.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {resultados.map((l) => (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() => onElegir(l.id)}
                  className="flex w-full flex-col gap-0.5 rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors hover:border-primary/50"
                >
                  <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                    {l.name}
                    {!l.publicado && <Etiqueta>No publicado</Etiqueta>}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {[l.address, l.zonaNombre].filter(Boolean).join(' · ') || 'Sin dirección'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

type EditorProps = {
  lugar: LugarParaCorregir
  onGuardado: (lugar: LugarParaCorregir) => void
  onCerrar: () => void
}

function Editor({ lugar, onGuardado, onCerrar }: EditorProps) {
  const [name, setName] = useState(lugar.name)
  const [address, setAddress] = useState(lugar.address ?? '')
  const [locality, setLocality] = useState(lugar.locality ?? '')
  const [coords, setCoords] = useState({ lat: lugar.lat, lng: lugar.lng })
  const [fuente, setFuente] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const movioPin = coords.lat !== lugar.lat || coords.lng !== lugar.lng

  /** Solo lo que el admin efectivamente cambió viaja en el body. */
  function cambios(): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    if (name !== lugar.name) out.name = name
    if (address !== (lugar.address ?? '')) out.address = address
    if (locality !== (lugar.locality ?? '')) out.locality = locality
    if (movioPin) {
      out.lat = coords.lat
      out.lng = coords.lng
    }
    return out
  }

  const hayCambios = Object.keys(cambios()).length > 0

  async function guardar() {
    setError(null)
    setOk(null)
    setGuardando(true)
    try {
      const res = await fetch(`/api/admin/lugares/${lugar.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fuente, ...cambios() }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json?.error?.message ?? 'No pudimos guardar la corrección.')
        return
      }
      setOk('Listo, quedó corregido.')
      setFuente('')
      onGuardado(json.data.lugar)
    } catch {
      setError('No pudimos conectarnos. Probá de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  /** El pin son dos columnas: se sueltan las dos, una después de la otra. */
  async function soltarPin() {
    if (lugar.lockedFields.includes('lat')) await soltar('lat')
    if (lugar.lockedFields.includes('lng')) await soltar('lng')
  }

  async function soltar(campo: string) {
    setError(null)
    setOk(null)
    try {
      const res = await fetch(`/api/admin/lugares/${lugar.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'soltar', campo }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json?.error?.message ?? 'No pudimos soltar el campo.')
        return
      }
      setOk('Vuelve a actualizarse con Overture.')
      onGuardado(json.data.lugar)
    } catch {
      setError('No pudimos conectarnos. Probá de nuevo.')
    }
  }

  return (
    <article className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">Datos base</h2>
          <p className="text-xs text-muted-foreground">
            {[lugar.zona, lugar.publicado ? 'Publicado' : 'No publicado'].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Link
            href={urlDeLugar(lugar.id)}
            target="_blank"
            className="text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-primary"
          >
            Ver ficha
          </Link>
          <button
            type="button"
            onClick={onCerrar}
            className="text-xs text-muted-foreground transition-colors hover:text-primary"
          >
            Cerrar
          </button>
        </div>
      </header>

      <p className="rounded-xl border border-border bg-secondary/40 px-4 py-3 text-sm text-foreground">
        Esto lo ve todo el mundo: el pin también mueve al lugar en la búsqueda.
      </p>

      {lugar.pendiente && (
        <div className="rounded-xl border border-primary/40 bg-primary/5 p-3 text-xs text-foreground">
          Este lugar tiene un cambio propuesto en revisión. Resolvelo en la Cola de aprobación.
        </div>
      )}

      <CampoTexto
        label="Nombre"
        valor={name}
        onChange={setName}
        fijado={lugar.lockedFields.includes('name')}
        onSoltar={() => void soltar('name')}
      />
      <CampoTexto
        label="Dirección"
        valor={address}
        onChange={setAddress}
        fijado={lugar.lockedFields.includes('address')}
        onSoltar={() => void soltar('address')}
      />
      <CampoTexto
        label="Localidad"
        valor={locality}
        onChange={setLocality}
        fijado={lugar.lockedFields.includes('locality')}
        onSoltar={() => void soltar('locality')}
      />

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Pin</span>
          {(lugar.lockedFields.includes('lat') || lugar.lockedFields.includes('lng')) && (
            <>
              <Etiqueta>Corregido a mano</Etiqueta>
              <button
                type="button"
                // Secuencial: dos `soltar` en paralelo volverían con el mismo
                // estado viejo y el segundo pisaría al primero.
                onClick={() => void soltarPin()}
                className="text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-primary"
              >
                Soltar
              </button>
            </>
          )}
        </div>
        <PinPicker valor={coords} onChange={setCoords} />
        <p className="text-xs text-muted-foreground">
          {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
        </p>
      </div>

      <GoogleDice placeId={lugar.id} habilitado={lugar.tieneMatchGoogle} />

      <div className="flex flex-col gap-1.5">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">
          ¿De dónde lo sacaste? (queda registrado)
        </label>
        <input
          value={fuente}
          onChange={(e) => setFuente(e.target.value)}
          placeholder="ccmatienzo.com.ar"
          className={inputClass}
        />
      </div>

      {movioPin && (
        <p className="text-xs text-foreground">
          Moviste el pin. El lugar va a cambiar de zona y de orden en «Cerca de mí».
        </p>
      )}

      {error && <Aviso tipo="error">{error}</Aviso>}
      {ok && <Aviso tipo="ok">{ok}</Aviso>}

      <button
        type="button"
        disabled={guardando || !hayCambios || fuente.trim().length < 3}
        onClick={() => void guardar()}
        className="rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {guardando ? 'Guardando…' : 'Guardar la corrección'}
      </button>

      <Bitacora ediciones={lugar.bitacora} />
    </article>
  )
}

function CampoTexto({
  label,
  valor,
  onChange,
  fijado,
  onSoltar,
}: {
  label: string
  valor: string
  onChange: (v: string) => void
  fijado: boolean
  onSoltar: () => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</label>
        {fijado && (
          <>
            <Etiqueta>Corregido a mano</Etiqueta>
            <button
              type="button"
              onClick={onSoltar}
              className="text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-primary"
            >
              Soltar
            </button>
          </>
        )}
      </div>
      <input value={valor} onChange={(e) => onChange(e.target.value)} className={inputClass} />
      {fijado && (
        <p className="text-xs text-muted-foreground">Al soltarlo vuelve a actualizarse con Overture.</p>
      )}
    </div>
  )
}

/**
 * «Google dice: …» (decisión 18). Consume `GET /api/lugar/[id]/google`, **el
 * endpoint que ya existe**: no hay un segundo llamador a Google, y el tope de
 * `google.details_monthly_cap` y el conteo de uso siguen aplicando igual.
 *
 * Es una **pista, no la fuente** (decisión 19), y la señal es asimétrica: el match
 * se resolvió a ±300 m de nuestro propio pin, así que *que coincida no prueba
 * nada*; solo *que difiera* es señal. Por eso **no hay ningún botón que copie este
 * texto a la dirección**: eso sería persistir contenido de Google, que es la línea
 * que trazó FICHA. El valor corregido tiene que venir de una fuente propia.
 */
function GoogleDice({ placeId, habilitado }: { placeId: string; habilitado: boolean }) {
  const [estado, setEstado] = useState<'inicial' | 'cargando' | 'listo' | 'sin-datos'>('inicial')
  const [direccion, setDireccion] = useState<string | null>(null)

  async function pedir() {
    setEstado('cargando')
    try {
      const res = await fetch(`/api/lugar/${placeId}/google`)
      if (res.status !== 200) {
        setEstado('sin-datos')
        return
      }
      // El endpoint devuelve el DTO pelado (no el sobre `{data, error}`).
      const datos = (await res.json()) as GoogleEnriquecimiento
      setDireccion(datos.formattedAddress ?? null)
      setEstado(datos.formattedAddress ? 'listo' : 'sin-datos')
    } catch {
      setEstado('sin-datos')
    }
  }

  if (!habilitado) return null

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border p-3">
      {estado === 'inicial' && (
        <button
          type="button"
          onClick={() => void pedir()}
          className="self-start text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-primary"
        >
          Ver qué dirección tiene Google
        </button>
      )}
      {estado === 'cargando' && <p className="text-xs text-muted-foreground">Consultando…</p>}
      {estado === 'sin-datos' && (
        <p className="text-xs text-muted-foreground">Google no nos dio una dirección para este lugar.</p>
      )}
      {estado === 'listo' && (
        <>
          <p className="text-sm text-foreground">Google dice: {direccion}</p>
          <p className="text-xs text-muted-foreground">
            Es una pista, no la fuente. Verificalo y escribilo vos.
          </p>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Bitácora
// ---------------------------------------------------------------------------

const ETIQUETA_CAMPO: Record<string, string> = {
  name: 'Nombre',
  address: 'Dirección',
  locality: 'Localidad',
  lat: 'Latitud',
  lng: 'Longitud',
}

function Bitacora({ ediciones }: { ediciones: EdicionDeDatos[] }) {
  if (ediciones.length === 0) return null

  return (
    <section className="flex flex-col gap-2 border-t border-border pt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Bitácora ({ediciones.length})
      </h3>
      {ediciones.map((e) => (
        <article key={e.id} className="flex flex-col gap-1 rounded-lg border border-border p-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <Etiqueta>{e.origen === 'admin' ? 'Admin' : 'Dueño'}</Etiqueta>
            <Etiqueta>{ESTADO[e.status]}</Etiqueta>
            <span className="text-muted-foreground">
              {new Date(e.createdAt).toLocaleString('es-AR')}
            </span>
          </div>
          <ul className="flex flex-col gap-0.5">
            {Object.entries(e.campos).map(([campo, cambio]) => (
              <li key={campo} className="text-foreground">
                <span className="text-muted-foreground">{ETIQUETA_CAMPO[campo] ?? campo}: </span>
                {cambio.soltado ? (
                  <>soltado (sigue en «{String(cambio.antes ?? '—')}»)</>
                ) : (
                  <>
                    {String(cambio.antes ?? '—')} → {String(cambio.despues ?? '—')}
                  </>
                )}
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground">
            Fuente: {e.fuente}
            {e.solicitante && ` · ${e.solicitante}`}
            {e.decidedBy && ` · ${e.decidedBy}`}
          </p>
          {e.adminNotes && <p className="text-muted-foreground">Motivo: {e.adminNotes}</p>}
        </article>
      ))}
    </section>
  )
}

const ESTADO: Record<string, string> = {
  pending: 'En revisión',
  approved: 'Aplicada',
  rejected: 'Rechazada',
}

function Etiqueta({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground">
      {children}
    </span>
  )
}
