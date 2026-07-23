'use client'

import * as React from 'react'
import { ChevronDown, Image as ImageIcon, Star } from 'lucide-react'

import type { GoogleEnriquecimiento, GoogleFoto } from '@/lib/google/types'
import { fotoPrincipal } from '@/lib/lugar/ficha'
import {
  estaAbierto,
  lineasSemana,
  tieneAlgunHorario,
  type HorariosSemana,
} from '@/lib/negocio/horarios'

/**
 * Bloque de Google en vivo de la ficha (FICHA, F2 + F3, decisión 16). Cliente porque
 * se pide **después** del render del server, con un `fetch` a `/api/lugar/[id]/google`:
 * así los crawlers no gastan en llamadas pagas. Importa **solo el tipo** del DTO
 * (nunca `places.ts`), así la API key jamás entra al bundle del browser.
 *
 * F3 lo convierte en un **shell de un solo fetch**: envuelve el slot de foto (arriba),
 * el encabezado server-rendered (`children`) y el bloque de horarios/rating (abajo).
 * La foto y los datos salen de la **misma** respuesta ⇒ una sola llamada Place Details
 * por apertura (montar dos componentes que hicieran fetch = doble costo Enterprise).
 *
 * Tres estados (decisión 20): esqueleto mientras carga; los datos si llegan; el
 * mensaje honesto si Google falla, tarda o está sin cuota (el endpoint responde 204
 * en todos esos casos). Nunca un spinner de pantalla ni un error.
 */

type Estado = 'cargando' | 'ok' | 'vacio'

/** Rating con coma decimal, como se escribe en español (4,3 y no 4.3). */
function formatearRating(rating: number): string {
  return rating.toFixed(1).replace('.', ',')
}

export function FichaGoogle({
  placeId,
  tienePrecioPropio,
  fotoDueno,
  horariosDueno,
  nombre,
  children,
}: {
  placeId: string
  /** Si la ficha ya muestra el precio del tag propio, no se repite el de Google. */
  tienePrecioPropio: boolean
  /** Foto de dueño (prioridad máxima, decisión 3), o `null`. Sale del server. */
  fotoDueno: string | null
  /**
   * Horarios propios del dueño (AUTH F4, decisión 20), o `null`. Cuando hay, se
   * muestran **en lugar** de los de Google; Google solo aporta el rating.
   */
  horariosDueno: HorariosSemana | null
  /** Nombre del lugar, para el `alt` de la foto. */
  nombre: string
  /** El encabezado server-rendered, entre la foto y el bloque de datos. */
  children: React.ReactNode
}) {
  const [estado, setEstado] = React.useState<Estado>('cargando')
  const [data, setData] = React.useState<GoogleEnriquecimiento | null>(null)

  React.useEffect(() => {
    let cancelado = false
    fetch(`/api/lugar/${placeId}/google`)
      .then((r) => (r.status === 200 ? (r.json() as Promise<GoogleEnriquecimiento>) : null))
      .then((d) => {
        if (cancelado) return
        if (d) {
          setData(d)
          setEstado('ok')
        } else {
          setEstado('vacio')
        }
      })
      .catch(() => {
        if (!cancelado) setEstado('vacio')
      })
    return () => {
      cancelado = true
    }
  }, [placeId])

  // Prioridad de la foto (decisión 3): dueño → Google → placeholder. El helper puro
  // ya la tiene testeada; acá solo se le pasa la de Google en vivo cuando llegó.
  const foto = fotoPrincipal({
    ownerPhotos: fotoDueno ? [fotoDueno] : [],
    googlePhotoUrl: data?.foto?.uri ?? null,
  })
  // Sin foto de dueño y todavía cargando: esqueleto, no placeholder (que la de Google
  // podría llegar). Con foto de dueño el slot ya está resuelto en el server.
  const skeletonFoto = !fotoDueno && estado === 'cargando'

  return (
    <>
      {/* Slot de foto: dueño → Google → placeholder. Nunca una imagen rota. */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-secondary">
        {foto ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- foto de dueño (URL propia) o uri efímera de Google (no se optimiza ni cachea, ToS) */}
            <img src={foto.url} alt={nombre} className="aspect-[4/3] w-full object-cover" />
            {foto.fuente === 'google' && data?.foto && (
              <FotoCredito foto={data.foto} googleMapsUri={data?.googleMapsUri ?? null} />
            )}
          </>
        ) : skeletonFoto ? (
          <div
            className="aspect-[4/3] w-full animate-pulse bg-secondary"
            aria-busy="true"
            aria-label="Cargando foto"
          />
        ) : (
          <div className="flex aspect-[4/3] w-full items-center justify-center text-muted-foreground">
            <ImageIcon className="size-10" />
          </div>
        )}
      </div>

      {/* Encabezado server-rendered (nombre, tipo/cocina, zona · precio). */}
      {children}

      {/* Bloque de datos en vivo (horarios, rating, precio de fallback). */}
      <BloqueDatos
        estado={estado}
        data={data}
        tienePrecioPropio={tienePrecioPropio}
        horariosDueno={horariosDueno}
      />
    </>
  )
}

/**
 * Datos en vivo: rating, abierto/cerrado, horarios y la atribución con el logo.
 *
 * **Prioridad de horarios dueño → Google** (decisión 20): si el dueño cargó los
 * suyos, se muestran esos y Google queda solo para el rating — como con las fotos.
 * Sin horarios de dueño, es el bloque de Google de F2/F3 tal cual.
 */
function BloqueDatos({
  estado,
  data,
  tienePrecioPropio,
  horariosDueno,
}: {
  estado: Estado
  data: GoogleEnriquecimiento | null
  tienePrecioPropio: boolean
  horariosDueno: HorariosSemana | null
}) {
  // El dueño le gana a Google. Sus horarios se muestran SIEMPRE, sin esperar ni
  // depender del enriquecimiento (que solo aporta el rating en ese caso).
  if (tieneAlgunHorario(horariosDueno)) {
    return (
      <DatosConHorariosDueno
        estado={estado}
        data={data}
        tienePrecioPropio={tienePrecioPropio}
        horarios={horariosDueno as HorariosSemana}
      />
    )
  }

  if (estado === 'cargando') {
    return (
      <section className="flex flex-col gap-2" aria-busy="true" aria-label="Cargando datos de Google">
        <div className="h-4 w-32 animate-pulse rounded bg-secondary" />
        <div className="h-4 w-48 animate-pulse rounded bg-secondary" />
      </section>
    )
  }

  if (estado === 'vacio' || !data) {
    return (
      <section className="text-sm text-muted-foreground">
        No tenemos los horarios en este momento.
      </section>
    )
  }

  const precioGoogle = !tienePrecioPropio ? data.priceLevel : null

  return (
    <section className="flex flex-col gap-2 text-sm">
      <LineaRating rating={data.rating} userRatingCount={data.userRatingCount} precio={precioGoogle} />
      <EstadoAbierto abierto={data.horarios?.abierto ?? null} />
      <SemanaAcordeon semana={data.horarios?.semana ?? []} />
      {/* Atribución (decisión 5): el logo de Google sobre los datos en vivo. */}
      <AtribucionGoogle texto="Horarios y calificación" />
    </section>
  )
}

/**
 * Bloque cuando el dueño cargó sus horarios (decisión 20). El estado abierto/
 * cerrado se calcula en TZ AR, y **después de montar** para no divergir entre el
 * HTML del server y la hidratación (el "ahora" es distinto en cada uno). La semana
 * es determinista y se puede pintar de una. Google, si respondió, solo suma rating.
 */
function DatosConHorariosDueno({
  estado,
  data,
  tienePrecioPropio,
  horarios,
}: {
  estado: Estado
  data: GoogleEnriquecimiento | null
  tienePrecioPropio: boolean
  horarios: HorariosSemana
}) {
  const [ahora, setAhora] = React.useState<Date | null>(null)
  React.useEffect(() => {
    setAhora(new Date())
  }, [])

  const abierto = ahora ? estaAbierto(horarios, ahora) : null
  const semana = lineasSemana(horarios)

  const rating = estado === 'ok' && data ? data.rating : null
  const userRatingCount = estado === 'ok' && data ? data.userRatingCount : null
  const precioGoogle = estado === 'ok' && data && !tienePrecioPropio ? data.priceLevel : null

  return (
    <section className="flex flex-col gap-2 text-sm">
      <LineaRating rating={rating} userRatingCount={userRatingCount} precio={precioGoogle} />
      <EstadoAbierto abierto={abierto} />
      <SemanaAcordeon semana={semana} />
      {/* Los horarios son del local; Google, si aportó rating o precio, se atribuye. */}
      {(rating !== null || precioGoogle) && <AtribucionGoogle texto="Calificación" />}
    </section>
  )
}

/** Rating + precio de fallback, en la misma línea que en el mockup. */
function LineaRating({
  rating,
  userRatingCount,
  precio,
}: {
  rating: number | null
  userRatingCount: number | null
  precio: string | null
}) {
  if (rating === null && !precio) return null
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {rating !== null && (
        <span className="inline-flex items-center gap-1 font-medium text-foreground">
          <Star className="size-4 fill-current text-amarillo" />
          {formatearRating(rating)}
          {userRatingCount !== null && (
            <span className="font-normal text-muted-foreground">({userRatingCount})</span>
          )}
        </span>
      )}
      {precio && (
        <>
          {rating !== null && <span aria-hidden className="text-muted-foreground">·</span>}
          <span className="text-muted-foreground">{precio}</span>
        </>
      )}
    </div>
  )
}

/** Punto + "Abierto/Cerrado ahora". `null` (no se sabe todavía) ⇒ no se pinta. */
function EstadoAbierto({ abierto }: { abierto: boolean | null }) {
  if (abierto === null) return null
  return (
    <p className="flex items-center gap-2 text-foreground">
      <span
        aria-hidden
        className={abierto ? 'size-2 rounded-full bg-emerald-500' : 'size-2 rounded-full bg-muted-foreground'}
      />
      {abierto ? 'Abierto ahora' : 'Cerrado ahora'}
    </p>
  )
}

/** Acordeón nativo con la semana (una línea por día). */
function SemanaAcordeon({ semana }: { semana: string[] }) {
  if (semana.length === 0) return null
  return (
    <details className="group">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-1 text-muted-foreground underline-offset-4 hover:underline">
        Ver horarios de la semana
        <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
      </summary>
      <ul className="mt-2 flex flex-col gap-1 text-muted-foreground">
        {semana.map((linea) => (
          <li key={linea}>{linea}</li>
        ))}
      </ul>
    </details>
  )
}

/** Atribución obligatoria a Google (decisión 5): su logo + link a /legales. */
function AtribucionGoogle({ texto }: { texto: string }) {
  return (
    <a
      href="/legales"
      className="inline-flex w-fit items-center gap-1.5 text-xs text-muted-foreground underline-offset-4 hover:underline"
    >
      {texto}
      <GoogleLogo className="h-4 w-auto" />
    </a>
  )
}

/** Crédito obligatorio sobre la foto (decisión 5): autor + acceso al original. */
function FotoCredito({ foto, googleMapsUri }: { foto: GoogleFoto; googleMapsUri: string | null }) {
  return (
    <figcaption className="absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-x-1 gap-y-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-6 text-[11px] text-white/90">
      <span>foto:</span>
      {foto.autorNombre &&
        (foto.autorUri ? (
          <a
            href={foto.autorUri}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            {foto.autorNombre}
          </a>
        ) : (
          <span>{foto.autorNombre}</span>
        ))}
      {foto.autorNombre && <span aria-hidden>·</span>}
      {googleMapsUri ? (
        <a
          href={googleMapsUri}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2"
        >
          Google
        </a>
      ) : (
        <span>Google</span>
      )}
    </figcaption>
  )
}

/**
 * Logo oficial de Google (decisión 5: su logo, no "Powered by Google"). Se muestra
 * junto a los datos en vivo como atribución obligatoria. SVG inline —lucide no trae
 * marcas— con los colores de la marca.
 */
function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" role="img" aria-label="Google">
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
    </svg>
  )
}
