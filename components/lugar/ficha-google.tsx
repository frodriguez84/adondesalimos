'use client'

import * as React from 'react'
import { ChevronDown, Star } from 'lucide-react'

import type { GoogleEnriquecimiento } from '@/lib/google/types'

/**
 * Bloque de Google en vivo de la ficha (FICHA, F2, decisión 16). Cliente porque se
 * pide **después** del render del server, con un `fetch` a `/api/lugar/[id]/google`:
 * así los crawlers no gastan en llamadas pagas. Importa **solo el tipo** del DTO
 * (nunca `places.ts`), así la API key jamás entra al bundle del browser.
 *
 * Tres estados (decisión 20): esqueleto de dos líneas mientras carga; los datos si
 * llegan; el mensaje honesto si Google falla, tarda o está sin cuota (el endpoint
 * responde 204 en todos esos casos). Nunca un spinner de pantalla ni un error.
 */

type Estado = 'cargando' | 'ok' | 'vacio'

/** Rating con coma decimal, como se escribe en español (4,3 y no 4.3). */
function formatearRating(rating: number): string {
  return rating.toFixed(1).replace('.', ',')
}

export function FichaGoogle({
  placeId,
  tienePrecioPropio,
}: {
  placeId: string
  /** Si la ficha ya muestra el precio del tag propio, no se repite el de Google. */
  tienePrecioPropio: boolean
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
  const abierto = data.horarios?.abierto ?? null
  const semana = data.horarios?.semana ?? []

  return (
    <section className="flex flex-col gap-2 text-sm">
      {/* Rating + precio de fallback, en la misma línea que en el mockup. */}
      {(data.rating !== null || precioGoogle) && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {data.rating !== null && (
            <span className="inline-flex items-center gap-1 font-medium text-foreground">
              <Star className="size-4 fill-current text-amber-500" />
              {formatearRating(data.rating)}
              {data.userRatingCount !== null && (
                <span className="font-normal text-muted-foreground">({data.userRatingCount})</span>
              )}
            </span>
          )}
          {precioGoogle && (
            <>
              {data.rating !== null && <span aria-hidden className="text-muted-foreground">·</span>}
              <span className="text-muted-foreground">{precioGoogle}</span>
            </>
          )}
        </div>
      )}

      {/* Estado abierto/cerrado + acordeón nativo con la semana. */}
      {abierto !== null && (
        <p className="flex items-center gap-2 text-foreground">
          <span
            aria-hidden
            className={abierto ? 'size-2 rounded-full bg-emerald-500' : 'size-2 rounded-full bg-muted-foreground'}
          />
          {abierto ? 'Abierto ahora' : 'Cerrado ahora'}
        </p>
      )}

      {semana.length > 0 && (
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
      )}

      {/* Atribución de F2: texto + link a /legales. El logo de Google llega en F3. */}
      <p className="text-xs text-muted-foreground">
        Horarios y calificación:{' '}
        <a href="/legales" className="underline underline-offset-4">
          Google
        </a>
      </p>
    </section>
  )
}
