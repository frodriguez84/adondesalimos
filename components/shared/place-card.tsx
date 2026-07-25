import * as React from 'react'
import Link from 'next/link'
import { MapPin } from 'lucide-react'

import { cn } from '@/lib/utils'

export interface PlaceCardProps extends React.ComponentProps<'div'> {
  id: string
  name: string
  tags?: string[]
  /**
   * Zona primaria, o localidad como respaldo. **Nullable a propósito**: 1.890
   * lugares publicados no tienen zona primaria (ZONAS, decisión 17). Lo resuelve
   * `ubicacionDeCard`.
   */
  location?: string | null
  /** Distancia en km. Solo en modo "cerca de mí". */
  distanceKm?: number | null
  /**
   * Destaque B2B (MONETIZACION, decisión 21): la misma card con un badge visible
   * y borde propio. No es una segunda card — solo prende el rótulo "Destacado".
   */
  destacado?: boolean
}

/**
 * Card de lugar para el listado. Sin foto y **sin rating**: ninguno de los dos es
 * persistible desde Google (decisión 7 de BUSQUEDA + ToS). El prop `rating` del
 * scaffold se removió por eso — no había fuente legal que lo llenara. El slot de
 * foto lo llena el spec 5, cuando existan fotos de dueño.
 *
 * Solo presentación: sin lógica de datos. Tocar la card lleva a la ficha (spec 4).
 */
function PlaceCard({
  id,
  name,
  tags = [],
  location,
  distanceKm,
  destacado = false,
  className,
  ...props
}: PlaceCardProps) {
  return (
    <div
      data-slot="place-card"
      className={cn(
        'rounded-xl border border-border bg-card text-card-foreground transition-colors hover:border-muted-foreground/50',
        // Borde propio del destaque: se distingue del orgánico sin ser otra card.
        destacado && 'border-primary/60 hover:border-primary',
        className,
      )}
      {...props}
    >
      <Link href={`/lugar/${id}`} className="flex flex-col gap-2 p-4 outline-none">
        {destacado && (
          <span className="inline-flex w-fit items-center rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
            Destacado
          </span>
        )}

        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold leading-snug">{name}</h3>
          {typeof distanceKm === 'number' && (
            <span className="shrink-0 text-sm text-muted-foreground">
              {distanceKm < 1
                ? `${Math.round(distanceKm * 1000)} m`
                : `${distanceKm.toFixed(1)} km`}
            </span>
          )}
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {location && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="size-3.5" />
            {location}
          </div>
        )}
      </Link>
    </div>
  )
}

export { PlaceCard }
