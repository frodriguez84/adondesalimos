'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

import {
  Aviso,
  btnClass,
  Campo,
  CamposSolicitante,
  erroresDeZod,
  inputClass,
  SOLICITANTE_VACIO,
  type DatosSolicitante,
  type Errores,
} from '@/components/negocio/campos'
import { CENTRO_AMBA } from '@/components/negocio/pin-picker'
import { altaSchema } from '@/lib/claims/validacion'

/**
 * Alta de un lugar que no está en el catálogo (decisión 12). Crea el `places`
 * con `source='owner'` **invisible** y su solicitud pendiente: hasta que el
 * admin apruebe, no lo ve nadie. Rechazarlo lo deja invisible, no lo borra.
 *
 * MapLibre son ~200 KB gzip: el selector de pin se carga recién al abrir el
 * formulario, igual que el mapa de la búsqueda. `ssr: false` porque MapLibre
 * toca `window` al construirse.
 */
const PinPicker = dynamic(() => import('@/components/negocio/pin-picker').then((m) => m.PinPicker), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded-xl border border-border bg-card" />,
})

export function AltaForm({ nombreSugerido }: { nombreSugerido: string }) {
  const [abierto, setAbierto] = useState(false)
  const [name, setName] = useState(nombreSugerido)
  const [address, setAddress] = useState('')
  const [locality, setLocality] = useState('')
  const [phone, setPhone] = useState('')
  const [website, setWebsite] = useState('')
  const [coords, setCoords] = useState(CENTRO_AMBA)
  const [datos, setDatos] = useState<DatosSolicitante>(SOLICITANTE_VACIO)

  const [errores, setErrores] = useState<Errores>({})
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const parsed = altaSchema.safeParse({
      kind: 'new' as const,
      name,
      address: address || undefined,
      locality: locality || undefined,
      phone: phone || undefined,
      website: website || undefined,
      lat: coords.lat,
      lng: coords.lng,
      ...datos,
    })
    if (!parsed.success) {
      const mapa = erroresDeZod(parsed.error)
      // lat/lng no tienen campo propio en la pantalla: el error del pin se
      // muestra como mensaje general, si no quedaría invisible.
      if (mapa.lat || mapa.lng) {
        setError('Movés el pin fuera del área que cubrimos (AMBA). Ubicalo sobre el local.')
      }
      setErrores(mapa)
      return
    }
    setErrores({})
    setEnviando(true)

    try {
      const res = await fetch('/api/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json?.error?.message ?? 'No pudimos guardar tu solicitud.')
        return
      }
      setEnviado(true)
    } catch {
      setError('No pudimos conectarnos. Revisá tu conexión y probá de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  if (enviado) {
    return (
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
        <h2 className="text-base font-semibold text-foreground">Recibimos tu negocio</h2>
        <p className="text-sm text-muted-foreground">
          Lo revisamos a mano antes de publicarlo. Te avisamos por mail cuando esté listo.
        </p>
        <Link href="/" className={`${btnClass} text-center`}>
          Volver al inicio
        </Link>
      </div>
    )
  }

  // PBETA-R6-04: era un botón pintado como los estados vacíos de la app (borde
  // punteado, texto gris centrado), así que se leía como cartel y no como la
  // acción que es — y es el camino de todo dueño que no está en Overture, o sea
  // el alta entera. Ahora usa el lenguaje de una fila accionable: borde sólido
  // sobre `card`, texto a la izquierda, la acción en color y un chevrón.
  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/50"
      >
        <span>
          <span className="block text-sm text-muted-foreground">¿No está en la lista?</span>
          <span className="mt-0.5 block text-sm font-semibold text-primary">
            Registralo vos, te lleva un minuto
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-primary" />
      </button>
    )
  }

  return (
    <form
      method="post"
      onSubmit={enviar}
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6"
    >
      <h2 className="text-base font-semibold text-foreground">Datos del negocio</h2>

      <Campo label="Nombre" error={errores.name}>
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </Campo>

      <Campo label="Dirección" error={errores.address}>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Calle y número"
          className={inputClass}
        />
      </Campo>

      <Campo label="Barrio o localidad" error={errores.locality}>
        <input
          value={locality}
          onChange={(e) => setLocality(e.target.value)}
          placeholder="Palermo, Vicente López…"
          className={inputClass}
        />
      </Campo>

      <Campo label="Ubicación en el mapa">
        <PinPicker valor={coords} onChange={setCoords} />
      </Campo>

      <Campo label="Teléfono del local" error={errores.phone}>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className={inputClass}
        />
      </Campo>

      <Campo label="Sitio web" error={errores.website}>
        <input
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="https://"
          className={inputClass}
        />
      </Campo>

      <hr className="border-border" />
      <h2 className="text-base font-semibold text-foreground">Quién sos</h2>

      <CamposSolicitante
        valores={datos}
        onChange={(cambio) => setDatos((d) => ({ ...d, ...cambio }))}
        errores={errores}
      />

      {error && <Aviso tipo="error">{error}</Aviso>}

      <button type="submit" disabled={enviando} className={btnClass}>
        {enviando ? 'Enviando…' : 'Enviar para revisión'}
      </button>
    </form>
  )
}
