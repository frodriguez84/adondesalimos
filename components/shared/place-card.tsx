import * as React from 'react'
import { MapPin, Star } from 'lucide-react'

import { cn } from '@/lib/utils'

export interface PlaceCardProps extends React.ComponentProps<'div'> {
  name: string
  tags?: string[]
  zone: string
  rating?: number
}

/**
 * Card de lugar para el listado. Sin foto (decisión de producto).
 * Solo presentación: props tipadas simples, sin lógica de datos.
 */
function PlaceCard({ name, tags = [], zone, rating, className, ...props }: PlaceCardProps) {
  return (
    <div
      data-slot="place-card"
      className={cn(
        'flex flex-col gap-2 rounded-xl border border-border bg-card p-4 text-card-foreground',
        className,
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold leading-snug">{name}</h3>
        {typeof rating === 'number' && (
          <span className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground">
            <Star className="size-3.5 fill-primary text-primary" />
            {rating.toFixed(1)}
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

      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <MapPin className="size-3.5" />
        {zone}
      </div>
    </div>
  )
}

export { PlaceCard }
