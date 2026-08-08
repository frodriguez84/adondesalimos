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
 *
 * **FB-02 — pintar y togglear NO usan el mismo criterio, a propósito.** Con
 * "todos sus tags puestos" a secas, tocar «Primera cita» (`bar, cafe,
 * restaurante, tranqui, romantico`) prendía también «Cenar afuera` (`restaurante`)
 * y «Un café» (`cafe`), porque los contiene: se reportó como "se prenden de a
 * varios". La regla decidida (Fer, 2026-08-08) es **subconjunto maximal**: un chip
 * se pinta si sus tags ⊆ los activos **y ningún otro chip prendido lo contiene
 * estrictamente**. Así toco uno y se prende uno; toco dos incomparables
 * («Cenar afuera» + «Un café», o «Primera cita» + «Tomar algo») y se prenden los
 * dos. La igualdad estricta no servía: dejaría los dos primeros apagados.
 *
 * **El toque siempre hace lo que el chip muestra**, y por eso tiene tres casos y no
 * dos. Un chip que se ve prendido se apaga sacando sus tags; uno que se ve apagado
 * tiene que **prenderse**. Ojo con el tercer caso, que es el que se reportó
 * (Fer, 2026-08-08): un chip **tapado** se ve apagado pero sus tags ya están todos
 * puestos, así que "agregarlos" no cambiaría nada (botón muerto) y "sacarlos"
 * —lo que se hizo primero— apaga el chip que se tocó y prende otro: tocar «Un café»
 * sobre «Primera cita» dejaba prendido «Cenar afuera», que nadie tocó. Un chip
 * tapado se **promueve**: se van los tags de los chips que lo contienen y quedan los
 * suyos, así el toque prende exactamente lo que se tocó.
 *
 * Esto no rompe la decisión 18 (los tags siguen siendo el estado y siguen visibles y
 * removibles uno por uno en `ChipsActivos`): cambia solo qué tags escribe un toque.
 *
 * Lo que la promoción **no** hace, a propósito: no trata de salvar a un tercer chip
 * prendido que compartía tags con el que se fue. Con «Primera cita» + «Tomar algo»
 * prendidos, promover «Cenar afuera» se lleva `bar` (era del que tapaba) y «Tomar
 * algo» se apaga dejando `cerveceria` suelto — visible y removible en `ChipsActivos`.
 * Salvarlo pide un caso especial que puede volver a dejar el chip tapado (y el botón
 * muerto); la regla simple se explica en una línea y siempre hace algo visible.
 */

type Props = {
  chips: OccasionChips
  params: SearchParams
  onNavegar: (cambio: Partial<SearchParams>, modo: 'push' | 'replace') => void
}

export function OccasionChipsRow({ chips, params, onNavegar }: Props) {
  const [verMas, setVerMas] = React.useState(false)

  const activos = new Set(params.tags)
  /** Todos sus tags están puestos. Con alguno suelto no lo está. */
  const estaAplicado = (tags: string[]) => tags.length > 0 && tags.every((t) => activos.has(t))
  const contieneEstricto = (mayor: string[], menor: string[]) =>
    mayor.length > menor.length && menor.every((t) => mayor.includes(t))

  // Criterio del PINTADO: subconjunto maximal. Se mira contra **todos** los chips
  // (home + resto), no solo los visibles: que el que tapa esté detrás de "Ver más"
  // no lo hace menos prendido.
  const prendidos = [...chips.home, ...chips.resto].filter((c) => estaAplicado(c.tags))
  const pintados = new Set(
    prendidos
      .filter((c) => !prendidos.some((otro) => contieneEstricto(otro.tags, c.tags)))
      .map((c) => c.slug),
  )

  const alternar = (chip: { slug: string; tags: string[] }) => {
    // Se ve prendido ⇒ apagarlo.
    if (pintados.has(chip.slug)) {
      onNavegar({ tags: params.tags.filter((t) => !chip.tags.includes(t)) }, 'push')
      return
    }
    // Se ve apagado pero está tapado ⇒ promoverlo: se van los tags de los chips que
    // lo contienen (menos los suyos, que se quedan) y prende él solo.
    if (estaAplicado(chip.tags)) {
      const sobran = new Set(
        prendidos
          .filter((otro) => contieneEstricto(otro.tags, chip.tags))
          .flatMap((otro) => otro.tags),
      )
      for (const t of chip.tags) sobran.delete(t)
      onNavegar({ tags: params.tags.filter((t) => !sobran.has(t)) }, 'push')
      return
    }
    // Apagado de verdad ⇒ sumar sus tags a lo que ya había.
    onNavegar({ tags: [...new Set([...params.tags, ...chip.tags])] }, 'push')
  }

  if (chips.home.length === 0 && chips.resto.length === 0) return null

  const visibles = verMas ? [...chips.home, ...chips.resto] : chips.home

  return (
    <div className="flex flex-wrap gap-2">
      {visibles.map((chip) => {
        const aplicado = pintados.has(chip.slug)
        return (
          <button
            key={chip.slug}
            type="button"
            onClick={() => alternar(chip)}
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
