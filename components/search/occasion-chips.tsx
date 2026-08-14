'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'
import type { OccasionChips } from '@/lib/search/chips'
import type { SearchParams } from '@/lib/search/params'
import { chipsPintados, tagsAlTocar } from '@/lib/search/pintado'

/**
 * Los chips de Ocasión de la home (decisión 6): 4 a la vista y el resto detrás
 * de "ver más".
 *
 * Tocar un chip **aplica sus tags a la vista** (decisión 18) — no es un modo
 * opaco: los tags entran como chips removibles en `ChipsActivos`, así el usuario
 * ve qué activó y aprende el sistema. Por eso navega igual que cualquier otro
 * gesto de filtro, con `replace` (NAVEGACION, decisión 1): es un estado más de
 * la misma pantalla y no merece una entrada en el historial. Medido: prender y
 * apagar el mismo chip dejaba **dos** entradas para una URL idéntica.
 *
 * **Qué chip se pinta y qué escribe un toque no vive acá**: es
 * `lib/search/pintado.ts`, su dueño único (subconjunto maximal de FB-02 y las
 * tres ramas del toque, con el porqué de cada una). Son funciones puras de
 * `(chips, tags)` y adentro del componente no se podían testear — que es como se
 * escaparon FB-02 y el bug del 2026-08-09. Este archivo es presentación.
 *
 * **Qué chips llegan acá depende de la zona** (fix del 2026-08-10): el server
 * cuenta cada chip en la zona elegida y no manda los que no llegan al piso, así
 * que la fila puede cambiar entre una navegación y otra. El chip que está pintado
 * viene **siempre**, exento de ese gate, para que el toggle no desaparezca con
 * sus tags puestos — la exención la aplica `lib/search/chips.ts` consultando al
 * mismo `chipsPintados` que se usa acá, así que los dos lados coinciden.
 */

type Props = {
  chips: OccasionChips
  params: SearchParams
  onNavegar: (cambio: Partial<SearchParams>, modo: 'push' | 'replace') => void
  /**
   * Modo mapa (MAPA, decisión 8): una sola fila que scrollea en horizontal en vez
   * de envolver en tres, para que el mapa entre entero en la pantalla. **Solo
   * presentacional**: qué chip se pinta y qué hace un toque —el subconjunto
   * maximal de FB-02— no cambia en nada.
   */
  compacto?: boolean
}

export function OccasionChipsRow({ chips, params, onNavegar, compacto = false }: Props) {
  const [verMas, setVerMas] = React.useState(false)

  // Todos los chips, no solo los visibles: que el que tapa esté detrás de "Ver
  // más" no lo hace menos prendido.
  const todos = [...chips.home, ...chips.resto]
  const pintados = chipsPintados(todos, params.tags)

  if (chips.home.length === 0 && chips.resto.length === 0) return null

  const visibles = verMas ? todos : chips.home

  return (
    <div
      className={cn(
        'flex gap-2',
        compacto ? 'barra-scroll-marca flex-nowrap overflow-x-auto' : 'flex-wrap',
      )}
    >
      {visibles.map((chip) => {
        const aplicado = pintados.has(chip.slug)
        return (
          <button
            key={chip.slug}
            type="button"
            onClick={() => onNavegar({ tags: tagsAlTocar(todos, params.tags, chip) }, 'replace')}
            aria-pressed={aplicado}
            className={cn(
              'inline-flex h-9 items-center rounded-full border px-4 text-sm transition-colors',
              // Sin esto la fila única los aplasta en vez de scrollear.
              compacto && 'shrink-0',
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
          className={cn(
            'inline-flex h-9 items-center rounded-full px-3 text-sm text-muted-foreground underline underline-offset-4',
            compacto && 'shrink-0',
          )}
        >
          {verMas ? 'Ver menos' : 'Ver más'}
        </button>
      )}
    </div>
  )
}
