'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'
import type { OccasionChips } from '@/lib/search/chips'
import type { SearchParams } from '@/lib/search/params'

/**
 * Los chips de Ocasión de la home (decisión 6): 4 a la vista y el resto detrás
 * de "ver más".
 *
 * Tocar un chip **aplica sus tags a la vista** (decisión 18) — no es un modo
 * opaco: los tags entran como chips removibles en `ChipsActivos`, así el usuario
 * ve qué activó y aprende el sistema. Por eso navega igual que cualquier otro
 * gesto de filtro, con `push`: es una tanda deliberada, y el back la deshace
 * entera (decisión 29).
 *
 * Un chip aplicado se marca como activo y volver a tocarlo lo saca. Sin eso,
 * tocar dos veces dejaría los tags puestos sin forma obvia de volver.
 */

type Props = {
  chips: OccasionChips
  params: SearchParams
  onNavegar: (cambio: Partial<SearchParams>, modo: 'push' | 'replace') => void
}

export function OccasionChipsRow({ chips, params, onNavegar }: Props) {
  const [verMas, setVerMas] = React.useState(false)

  const activos = new Set(params.tags)
  // Un chip está aplicado cuando TODOS sus tags están puestos. Con alguno suelto
  // no lo está: el usuario armó otra cosa que se le parece.
  const estaAplicado = (tags: string[]) => tags.length > 0 && tags.every((t) => activos.has(t))

  const alternar = (tags: string[]) => {
    if (estaAplicado(tags)) {
      onNavegar({ tags: params.tags.filter((t) => !tags.includes(t)) }, 'push')
      return
    }
    onNavegar({ tags: [...new Set([...params.tags, ...tags])] }, 'push')
  }

  if (chips.home.length === 0 && chips.resto.length === 0) return null

  const visibles = verMas ? [...chips.home, ...chips.resto] : chips.home

  return (
    <div className="flex flex-wrap gap-2">
      {visibles.map((chip) => {
        const aplicado = estaAplicado(chip.tags)
        return (
          <button
            key={chip.slug}
            type="button"
            onClick={() => alternar(chip.tags)}
            aria-pressed={aplicado}
            className={cn(
              'inline-flex h-9 items-center rounded-full border px-4 text-sm transition-colors',
              aplicado
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-foreground hover:bg-secondary',
            )}
          >
            {chip.name}
          </button>
        )
      })}

      {chips.resto.length > 0 && (
        <button
          type="button"
          onClick={() => setVerMas((v) => !v)}
          className="inline-flex h-9 items-center rounded-full px-3 text-sm text-muted-foreground underline underline-offset-4"
        >
          {verMas ? 'Ver menos' : 'Ver más'}
        </button>
      )}
    </div>
  )
}
