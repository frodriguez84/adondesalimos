'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { ChevronDown, Lock, Plus, Trash2 } from 'lucide-react'

import {
  Aviso,
  btnClass,
  Campo,
  erroresDeZod,
  inputClass,
  type Errores,
} from '@/components/negocio/campos'
import { cobroApagado } from '@/lib/billing/apagado'
import { puedeEditarContacto } from '@/lib/negocio/contenido'
import { contenidoSchema, MAX_RANGOS_POR_DIA, MAX_SOCIALS } from '@/lib/negocio/validacion'
import {
  DIAS,
  NOMBRE_DIA,
  type Dia,
  type HorariosSemana,
  type RangoHorario,
} from '@/lib/negocio/horarios'
import type { FacetaDelPanel, PanelLugar } from '@/lib/negocio/query'
import { FotosEditor } from './fotos-editor'

/**
 * Editor del panel (AUTH F3). Un solo formulario para contacto + tags + campos
 * pagos, y las fotos aparte porque se suben de a una y se ven al instante.
 *
 * Valida con **el mismo schema que el endpoint** (`lib/negocio/validacion.ts`) y
 * el servidor vuelve a validar todo, incluido el gating por plan: los campos
 * pagos se muestran bloqueados en `free`, pero el que manda es el `PATCH`
 * (decisión 17 — el cliente no es un boundary de seguridad).
 */

type Estado = {
  phone: string
  website: string
  socials: string[]
  horarios: HorariosSemana
  description: string
  menuUrl: string
  news: string
}

/** Rango por defecto al agregar uno: una franja de tarde/noche razonable. */
const RANGO_NUEVO: RangoHorario = { abre: '18:00', cierra: '23:00' }

/** El botón de guardar vive fuera del `<form>` (ver la barra fija): lo ata esto. */
const FORM_ID = 'editor-negocio'

/** Cuánto queda el «Listo» antes de devolverle el pie de la pantalla al dueño. */
const MS_AVISO_OK = 4000

/** A dónde escribe el dueño cuando algo del contacto está mal (TITULARIDAD). */
const CONTACTO = 'contacto@adondesalimos.com.ar'

/** Las redes que hoy salen en la ficha: las del dueño si cargó, si no las de la base. */
function redesVisibles(lugar: PanelLugar): string[] {
  return lugar.contenido.socials.length > 0 ? lugar.contenido.socials : lugar.base.socials
}

/**
 * El «hoy se muestra» es el dato de la base: solo informa **mientras el dueño no
 * tenga el suyo**, porque el COALESCE de `contenido.ts` le da prioridad al del
 * dueño. Con el contacto apagado (TITULARIDAD F1) el input ya muestra lo que sale
 * en la ficha, así que repetir ahí la base contradecía lo que se ve (TIT-QA-16).
 */
function hoySeMuestra(propio: string, base: string | null): string | undefined {
  return !propio && base ? `Hoy se muestra: ${base}` : undefined
}

export function EditorClient({ lugar }: { lugar: PanelLugar }) {
  const pago = lugar.plan === 'paid'
  /**
   * TITULARIDAD decisión 1: en un lugar de Overture el contacto no se edita sin
   * verificación. Los campos quedan **visibles y apagados** —ocultarlos manda al
   * dueño a buscar dónde estaban y termina en soporte igual, sin haber entendido
   * nada—. Es UI: el `PATCH` los rechaza igual (el cliente no es boundary).
   */
  const contactoEditable = puedeEditarContacto(lugar.source)
  /** Lo que hoy se ve en la ficha: las del dueño si cargó, si no las de la base. */
  const redesQueSeVen = redesVisibles(lugar)

  const [datos, setDatos] = useState<Estado>({
    phone: lugar.contenido.phone,
    website: lugar.contenido.website,
    socials: lugar.contenido.socials,
    horarios: lugar.horarios,
    description: lugar.contenido.description,
    menuUrl: lugar.contenido.menuUrl,
    news: lugar.contenido.news,
  })
  const [elegidos, setElegidos] = useState<Set<string>>(
    () => new Set(lugar.facetas.flatMap((f) => f.tags.filter((t) => t.elegido).map((t) => t.slug))),
  )
  const [errores, setErrores] = useState<Errores>({})
  const [error, setError] = useState<string | null>(null)
  const [guardado, setGuardado] = useState(false)
  const [guardando, setGuardando] = useState(false)
  /** Hay algo sin guardar: es lo que hace aparecer la barra fija. */
  const [sucio, setSucio] = useState(false)

  const set = (cambio: Partial<Estado>) => {
    setDatos((d) => ({ ...d, ...cambio }))
    setGuardado(false)
    setSucio(true)
  }

  function alternarTag(slug: string) {
    setElegidos((prev) => {
      const proximo = new Set(prev)
      if (proximo.has(slug)) proximo.delete(slug)
      else proximo.add(slug)
      return proximo
    })
    setGuardado(false)
    setSucio(true)
  }

  function setSocial(i: number, valor: string) {
    set({ socials: datos.socials.map((s, j) => (j === i ? valor : s)) })
  }

  /** Reemplaza los rangos de un día (agregar / editar / quitar pasan por acá). */
  function setRangos(dia: Dia, rangos: RangoHorario[]) {
    set({ horarios: { ...datos.horarios, [dia]: rangos } })
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setGuardado(false)

    // En free los campos pagos ni se mandan: el endpoint los rechazaría con 403,
    // y el estado local puede tener lo que se cargó cuando el plan estaba activo.
    // Ídem el contacto recortado: vacío el server lo ignora y preserva lo que el
    // dueño hubiera cargado antes del recorte (TITULARIDAD).
    const payload = {
      phone: contactoEditable ? datos.phone : '',
      website: contactoEditable ? datos.website : '',
      socials: contactoEditable ? datos.socials.filter((s) => s.trim().length > 0) : [],
      tags: [...elegidos],
      openingHours: datos.horarios,
      description: pago ? datos.description : '',
      menuUrl: pago ? datos.menuUrl : '',
      news: pago ? datos.news : '',
    }

    const parsed = contenidoSchema.safeParse(payload)
    if (!parsed.success) {
      setErrores(erroresDeZod(parsed.error))
      setError('Revisá los campos marcados.')
      return
    }
    setErrores({})
    setGuardando(true)

    try {
      const res = await fetch(`/api/mi-negocio/${lugar.id}/content`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json?.error?.message ?? 'No pudimos guardar los cambios.')
        return
      }
      setGuardado(true)
      setSucio(false)
      // El aviso vive en la barra fija: si se quedara, taparía el pie de la
      // pantalla hasta la próxima edición.
      window.setTimeout(() => setGuardado(false), MS_AVISO_OK)
    } catch {
      setError('No pudimos conectarnos. Revisá tu conexión y probá de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form id={FORM_ID} onSubmit={guardar} className="flex flex-col gap-6">
        {/* --- Contacto: pisa lo de Overture, sin tocar sus columnas (dec. 13) --- */}
        <Seccion titulo="Datos de contacto">
          {!contactoEditable && (
            <p className="flex items-start gap-1.5 rounded-xl border border-border bg-secondary px-3 py-2 text-xs text-muted-foreground">
              <Lock className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Estos tres los verificamos a mano: son por donde te llaman y te visitan. Si hay algo
                mal, escribinos a{' '}
                <a href={`mailto:${CONTACTO}`} className="text-primary underline underline-offset-2">
                  {CONTACTO}
                </a>{' '}
                y lo cambiamos nosotros.
              </span>
            </p>
          )}

          <Campo
            label="Teléfono"
            error={errores.phone}
            hint={hoySeMuestra(datos.phone, lugar.base.phone)}
          >
            <input
              type="tel"
              value={datos.phone}
              onChange={(e) => set({ phone: e.target.value })}
              placeholder={lugar.base.phone ?? '11 5555 5555'}
              disabled={!contactoEditable}
              className={inputClass}
            />
          </Campo>

          <Campo
            label="Sitio web"
            error={errores.website}
            hint={
              hoySeMuestra(datos.website, lugar.base.website) ??
              (contactoEditable ? 'Con https://' : undefined)
            }
          >
            <input
              type="url"
              value={datos.website}
              onChange={(e) => set({ website: e.target.value })}
              placeholder="https://…"
              disabled={!contactoEditable}
              className={inputClass}
            />
          </Campo>

          <Campo
            label="Redes"
            error={errores.socials}
            hint={
              contactoEditable
                ? 'Instagram, Facebook, lo que uses. Si cargás alguna, reemplazan a las que teníamos.'
                : redesQueSeVen.length === 0
                  ? 'No hay redes cargadas.'
                  : undefined
            }
          >
            <div className="flex flex-col gap-2">
              {(contactoEditable ? datos.socials : redesQueSeVen).map((social, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="url"
                    value={social}
                    onChange={(e) => setSocial(i, e.target.value)}
                    placeholder="https://instagram.com/…"
                    disabled={!contactoEditable}
                    className={inputClass}
                  />
                  {contactoEditable && (
                    <button
                      type="button"
                      aria-label="Quitar red"
                      onClick={() => set({ socials: datos.socials.filter((_, j) => j !== i) })}
                      className="shrink-0 rounded-xl border border-border px-3 text-muted-foreground transition-colors hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              ))}
              {contactoEditable && datos.socials.length < MAX_SOCIALS && (
                <button
                  type="button"
                  onClick={() => set({ socials: [...datos.socials, ''] })}
                  className="inline-flex w-fit items-center gap-1 text-sm text-primary underline underline-offset-4"
                >
                  <Plus className="size-4" />
                  Agregar red
                </button>
              )}
            </div>
          </Campo>
        </Seccion>

        {/* --- Tags: el diferencial de la app lo carga el que conoce el lugar --- */}
        <Seccion
          titulo="Qué se encuentra en tu lugar"
          bajada="Lo que tildes acá es con lo que la gente te va a encontrar buscando."
        >
          {lugar.facetas.map((faceta) => (
            <Faceta
              key={faceta.facet}
              faceta={faceta}
              elegidos={elegidos}
              alternar={alternarTag}
            />
          ))}
        </Seccion>

        {/* --- Horarios propios (free): la ficha los prioriza sobre Google (dec. 20) --- */}
        <Seccion
          titulo="Horarios"
          bajada="Se muestran en tu ficha en lugar de los de Google. Un rango puede cruzar la medianoche (por ejemplo, 20:00 a 02:00)."
        >
          {errores.openingHours && <Aviso tipo="error">{errores.openingHours}</Aviso>}
          {DIAS.map((dia) => (
            <DiaHorario
              key={dia}
              nombre={NOMBRE_DIA[dia]}
              rangos={datos.horarios[dia]}
              onChange={(rangos) => setRangos(dia, rangos)}
            />
          ))}
        </Seccion>

        {/* --- Campos pagos: existen siempre, se editan solo con plan (dec. 18) ---
             PBETA-R5-05: con el cobro apagado no hay nada que "activar acá arriba"
             (ahí vive «Avisame cuando abra»), así que el candado dice la verdad. --- */}
        <Seccion
          titulo="Contenido destacado"
          bajada={
            pago
              ? 'Se muestran en tu ficha mientras el plan esté activo.'
              : 'Del plan pago. Si lo dás de baja no se borra: deja de mostrarse.'
          }
        >
          {!pago && (
            <p className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-secondary px-3 py-2 text-xs text-muted-foreground">
              <Lock className="size-3.5 shrink-0" />
              {cobroApagado()
                ? 'Todavía no abrimos los pagos: estos campos se desbloquean cuando salga el plan del lugar.'
                : 'Activá el plan del lugar acá arriba para editar estos campos.'}
            </p>
          )}

          <Campo label="Descripción" error={errores.description}>
            <textarea
              value={pago ? datos.description : ''}
              onChange={(e) => set({ description: e.target.value })}
              disabled={!pago}
              rows={4}
              placeholder="Contá qué hace especial a tu lugar."
              className={inputClass}
            />
          </Campo>

          <Campo label="Link a la carta" error={errores.menuUrl}>
            <input
              type="url"
              value={pago ? datos.menuUrl : ''}
              onChange={(e) => set({ menuUrl: e.target.value })}
              disabled={!pago}
              placeholder="https://…"
              className={inputClass}
            />
          </Campo>

          <Campo label="Novedad" error={errores.news} hint="Una línea: “Happy hour de 18 a 20”.">
            <input
              value={pago ? datos.news : ''}
              onChange={(e) => set({ news: e.target.value })}
              disabled={!pago}
              placeholder="Happy hour de 18 a 20"
              className={inputClass}
            />
          </Campo>
        </Seccion>

      </form>

      {/* Ubicación aparte: no se guarda, se **propone** (CORRECCION_DATOS, dec. 11). */}
      <Ubicacion lugar={lugar} />

      {/* Fotos aparte: se suben de a una y el resultado se ve al instante. */}
      <FotosEditor
        placeId={lugar.id}
        inicial={lugar.fotos}
        cap={lugar.capFotos}
        plan={lugar.plan}
      />

      {/* PBETA-R6-03 — el único «Guardar cambios» estaba al final del formulario,
          medido a 390×844 en y = 2.536 de una página de 3.174: cambiar el teléfono
          obligaba a scrollear cinco secciones para poder guardar. Y como abajo
          seguían «Dónde estás» y «Fotos», el botón parecía cerrar la pantalla y
          esos dos bloques quedaban «afuera» de lo que se guarda.

          Ahora el botón no está en el medio de nada: aparece pegado al pie **solo
          cuando hay algo sin guardar** (mismo criterio que PBETA-R4-04 — una barra
          fija con un botón que no hace nada es alto ocupado para nada). Vive fuera
          del `<form>`, atado con `form={FORM_ID}`, para que siga pegado también
          mientras se scrollean ubicación y fotos, que son hermanos del formulario.
          El `-mx-4` cancela el padding del `main`. */}
      {(sucio || guardando || guardado) && (
        <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t border-border bg-background px-4 pb-4 pt-3">
          {error && <Aviso tipo="error">{error}</Aviso>}
          {guardado && !sucio ? (
            <Aviso tipo="ok">Listo, guardamos los cambios.</Aviso>
          ) : (
            <button
              type="submit"
              form={FORM_ID}
              disabled={guardando}
              className={`w-full ${btnClass}`}
            >
              {guardando ? 'Guardando…' : 'Guardar cambios'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Un día del editor semanal: su lista de rangos `hh:mm` con agregar/quitar. Los
 * inputs `type="time"` dan el formato 24 h que el schema espera; la validación
 * real (solapamientos, tope, cruce de medianoche) corre en el mismo schema que
 * el endpoint.
 */
function DiaHorario({
  nombre,
  rangos,
  onChange,
}: {
  nombre: string
  rangos: RangoHorario[]
  onChange: (rangos: RangoHorario[]) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{nombre}</h3>
        {rangos.length < MAX_RANGOS_POR_DIA && (
          <button
            type="button"
            onClick={() => onChange([...rangos, { ...RANGO_NUEVO }])}
            className="inline-flex items-center gap-1 text-xs text-primary underline underline-offset-4"
          >
            <Plus className="size-3.5" />
            Agregar franja
          </button>
        )}
      </div>

      {rangos.length === 0 ? (
        <p className="text-xs text-muted-foreground">Cerrado</p>
      ) : (
        rangos.map((rango, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="time"
              aria-label={`${nombre}: abre`}
              value={rango.abre}
              onChange={(e) => onChange(rangos.map((r, j) => (j === i ? { ...r, abre: e.target.value } : r)))}
              className={inputClass}
            />
            <span className="shrink-0 text-sm text-muted-foreground">a</span>
            <input
              type="time"
              aria-label={`${nombre}: cierra`}
              value={rango.cierra}
              onChange={(e) => onChange(rangos.map((r, j) => (j === i ? { ...r, cierra: e.target.value } : r)))}
              className={inputClass}
            />
            <button
              type="button"
              aria-label="Quitar franja"
              onClick={() => onChange(rangos.filter((_, j) => j !== i))}
              className="shrink-0 rounded-xl border border-border px-3 text-muted-foreground transition-colors hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))
      )}
    </div>
  )
}

function Seccion({
  titulo,
  bajada,
  children,
}: {
  titulo: string
  bajada?: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-foreground">{titulo}</h2>
        {bajada && <p className="text-xs text-muted-foreground">{bajada}</p>}
      </div>
      {children}
    </section>
  )
}

/**
 * Una faceta con sus tags. Cocina viene con padres e hijos: los hijos se
 * indentan bajo su padre, igual que en el sheet de filtros de la búsqueda.
 *
 * Plegada por defecto (BACKLOG 2026-08-01): son ~96 tags entre todas y Cocina
 * sola tiene 46 — abiertas de una eran un muro dentro de un formulario que
 * además sigue con Horarios abajo. El contador en el título dice lo que hay
 * elegido sin tener que desplegar. Acordeón nativo, como el de la ficha.
 */
function Faceta({
  faceta,
  elegidos,
  alternar,
}: {
  faceta: FacetaDelPanel
  elegidos: Set<string>
  alternar: (slug: string) => void
}) {
  const padres = faceta.tags.filter((t) => t.parent === null)
  const hijosDe = (slug: string) => faceta.tags.filter((t) => t.parent === slug)
  const cuantos = faceta.tags.filter((t) => elegidos.has(t.slug)).length

  return (
    <details className="group rounded-xl border border-border p-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {faceta.label}
          {cuantos > 0 && (
            <span className="text-primary">{` · ${cuantos} ${cuantos === 1 ? 'elegido' : 'elegidos'}`}</span>
          )}
        </h3>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>

      <div className="mt-3 flex flex-col gap-2">
        <div className="flex flex-wrap gap-1.5">
          {padres.map((padre) => (
            <TagToggle
              key={padre.slug}
              slug={padre.slug}
              name={padre.name}
              elegido={elegidos.has(padre.slug)}
              alternar={alternar}
            />
          ))}
        </div>
        {padres.map((padre) => {
          const hijos = hijosDe(padre.slug)
          if (hijos.length === 0) return null
          return (
            <div key={`${padre.slug}-hijos`} className="flex flex-col gap-1 pl-3">
              <p className="text-[11px] text-muted-foreground">{padre.name}</p>
              <div className="flex flex-wrap gap-1.5">
                {hijos.map((hijo) => (
                  <TagToggle
                    key={hijo.slug}
                    slug={hijo.slug}
                    name={hijo.name}
                    elegido={elegidos.has(hijo.slug)}
                    alternar={alternar}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </details>
  )
}

function TagToggle({
  slug,
  name,
  elegido,
  alternar,
}: {
  slug: string
  name: string
  elegido: boolean
  alternar: (slug: string) => void
}) {
  return (
    <button
      type="button"
      aria-pressed={elegido}
      onClick={() => alternar(slug)}
      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
        elegido
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border text-muted-foreground hover:border-muted-foreground/50'
      }`}
    >
      {name}
    </button>
  )
}

// ---------------------------------------------------------------------------
// «Dónde estás» — CORRECCION_DATOS, decisiones 11, 12 y 14
// ---------------------------------------------------------------------------

// MapLibre son ~200 KB gzip: se carga recién al abrir el formulario de la
// propuesta. `ssr: false` porque MapLibre toca `window` al construirse.
const PinPicker = dynamic(() => import('@/components/negocio/pin-picker').then((m) => m.PinPicker), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded-xl border border-border bg-card" />,
})

/**
 * La ubicación del lugar: **se propone, no se guarda**. El pin mueve al lugar en
 * la búsqueda de todos, así que la decide el admin (decisión 11).
 *
 * **No hay campo de nombre** (decisión 12): el nombre es la clave del buscador y
 * del matching con Google a la vez, y renombrar una ficha ajena es el vector
 * clásico de secuestro de listado. Un rebranding real lo arregla el admin.
 *
 * El estado viaja acá y no por mail (decisión 14): el dueño lo ve donde ya está
 * mirando.
 */
function Ubicacion({ lugar }: { lugar: PanelLugar }) {
  const [abierto, setAbierto] = useState(false)
  const [address, setAddress] = useState(lugar.address ?? '')
  const [locality, setLocality] = useState(lugar.locality ?? '')
  const [coords, setCoords] = useState({ lat: lugar.lat, lng: lugar.lng })
  const [fuente, setFuente] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enviado, setEnviado] = useState(false)

  const pendiente = lugar.correccion.pendiente
  const rechazada = lugar.correccion.ultimaRechazada
  const movioPin = coords.lat !== lugar.lat || coords.lng !== lugar.lng
  const hayCambios =
    movioPin || address !== (lugar.address ?? '') || locality !== (lugar.locality ?? '')

  async function proponer(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      const cambios: Record<string, unknown> = { fuente }
      if (address !== (lugar.address ?? '')) cambios.address = address
      if (locality !== (lugar.locality ?? '')) cambios.locality = locality
      if (movioPin) {
        cambios.lat = coords.lat
        cambios.lng = coords.lng
      }

      const res = await fetch(`/api/mi-negocio/${lugar.id}/ubicacion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cambios),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json?.error?.message ?? 'No pudimos mandar el cambio.')
        return
      }
      setEnviado(true)
      setAbierto(false)
    } catch {
      setError('No pudimos conectarnos. Revisá tu conexión y probá de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Seccion
      titulo="Dónde estás"
      bajada="Lo que ve todo el mundo: tu dirección y tu punto en el mapa. Va aparte: esto se propone y lo revisamos, no entra en «Guardar cambios»."
    >
      <p className="text-sm text-foreground">
        {[lugar.address, lugar.locality].filter(Boolean).join(', ') || 'Sin dirección cargada'}
      </p>

      {(pendiente || enviado) && (
        <p className="rounded-xl border border-primary/40 bg-primary/5 px-4 py-3 text-sm text-foreground">
          {pendiente ? (
            <>
              En revisión:{' '}
              {String(pendiente.campos.address?.despues ?? 'el punto en el mapa')}
            </>
          ) : (
            'En revisión: lo miramos y te lo aplicamos.'
          )}
        </p>
      )}

      {rechazada && !pendiente && !enviado && (
        <p className="text-xs text-muted-foreground">
          No lo tomamos: {rechazada.adminNotes ?? 'no pudimos verificarlo'}
        </p>
      )}

      {!abierto ? (
        <button
          type="button"
          disabled={Boolean(pendiente) || enviado}
          onClick={() => setAbierto(true)}
          className="w-fit rounded-xl bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50"
        >
          Proponer un cambio
        </button>
      ) : (
        <form onSubmit={proponer} className="flex flex-col gap-4">
          <p className="text-xs text-muted-foreground">
            Lo revisamos antes de que se vea. Suele tardar poco.
          </p>

          <Campo label="Dirección">
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Av. Juan B. Justo 2959"
              className={inputClass}
            />
          </Campo>

          <Campo label="Localidad">
            <input
              value={locality}
              onChange={(e) => setLocality(e.target.value)}
              placeholder="Buenos Aires"
              className={inputClass}
            />
          </Campo>

          <PinPicker valor={coords} onChange={setCoords} />

          <Campo label="¿De dónde lo sacaste? (queda registrado)">
            <input
              value={fuente}
              onChange={(e) => setFuente(e.target.value)}
              placeholder="ccmatienzo.com.ar"
              className={inputClass}
            />
          </Campo>

          {error && <Aviso tipo="error">{error}</Aviso>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="flex-1 rounded-xl bg-secondary py-3 font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando || !hayCambios || fuente.trim().length < 3}
              className={`flex-1 ${btnClass}`}
            >
              {enviando ? 'Mandando…' : 'Mandar el cambio'}
            </button>
          </div>
        </form>
      )}
    </Seccion>
  )
}
