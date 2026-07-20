'use client'

import * as React from 'react'
import { ChevronDown } from 'lucide-react'

import { BottomSheet } from '@/components/ui/bottom-sheet'
import { FilterChip } from '@/components/ui/filter-chip'
import { cn } from '@/lib/utils'
import type { CatalogFacet, CatalogTag } from '@/lib/search/catalog'
import { agruparPorLabel } from '@/lib/search/suggest'
import type { SearchParams } from '@/lib/search/params'
import { BotonAplicar } from './zone-sheet'
import { useCount } from './use-count'

/**
 * Sheet de filtros (decisiones 8, 20, 24): las facetas en acordeón, "Limpiar
 * todo" y "Ver N lugares".
 *
 * Lo que se lista lo decide `getFacetCatalog`, no este componente: **un tag con
 * cero lugares publicados no llega hasta acá, y una faceta que queda vacía
 * tampoco**. Con el catálogo de hoy eso borra Precio entera (0 filas en
 * `place_tags`) y deja Ambiente y Momento flacos. Es el dato real, no un bug.
 *
 * "Abierto ahora" tampoco aparece, por la misma razón sin proponérselo: no tiene
 * lugares asignados porque la app no persiste horarios (§ Qué NO es esta feature).
 *
 * Igual que el sheet de zona, edita un borrador y aplica al confirmar.
 */

type Props = {
  open: boolean
  onClose: () => void
  facetas: CatalogFacet[]
  params: SearchParams
  coords: { lat: number; lng: number } | null
  onApply: (cambio: { tags: string[] }) => void
}

export function FiltersSheet({ open, onClose, facetas, params, coords, onApply }: Props) {
  const [seleccion, setSeleccion] = React.useState<string[]>(params.tags)
  const [abierta, setAbierta] = React.useState<string | null>(facetas[0]?.facet ?? null)

  React.useEffect(() => {
    if (!open) return
    setSeleccion(params.tags)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const count = useCount({ ...params, tags: seleccion, cursor: null }, coords, open)

  const toggle = (slug: string) =>
    setSeleccion((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    )

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Filtros</h2>
          <button
            type="button"
            onClick={() => setSeleccion([])}
            disabled={seleccion.length === 0}
            className="text-sm text-muted-foreground underline underline-offset-4 disabled:opacity-40"
          >
            Limpiar todo
          </button>
        </div>

        {facetas.map((faceta) => {
          const desplegada = abierta === faceta.facet
          const activos = faceta.tags.filter((t) => seleccion.includes(t.slug)).length

          return (
            <section key={faceta.facet} className="border-b border-border last:border-0">
              <button
                type="button"
                onClick={() => setAbierta(desplegada ? null : faceta.facet)}
                aria-expanded={desplegada}
                className="flex w-full items-center gap-2 py-3 text-sm font-medium text-foreground"
              >
                {faceta.label}
                {activos > 0 && (
                  <span className="rounded-full bg-primary px-2 text-xs text-primary-foreground">
                    {activos}
                  </span>
                )}
                <ChevronDown
                  className={cn(
                    'ml-auto size-4 transition-transform',
                    desplegada && 'rotate-180',
                  )}
                />
              </button>

              {desplegada && (
                <div className="flex flex-col gap-3 pb-3">
                  {faceta.facet === 'cocina' ? (
                    <Cocina tags={faceta.tags} seleccion={seleccion} onToggle={toggle} />
                  ) : (
                    agruparPorLabel(faceta.tags).map((grupo) => (
                      <div key={grupo.label ?? 'sin-grupo'} className="flex flex-col gap-2">
                        {grupo.label && (
                          <span className="text-xs text-muted-foreground">{grupo.label}</span>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {grupo.tags.map((tag) => (
                            <FilterChip
                              key={tag.slug}
                              active={seleccion.includes(tag.slug)}
                              onClick={() => toggle(tag.slug)}
                            >
                              {tag.name}
                            </FilterChip>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </section>
          )
        })}

        <BotonAplicar count={count} onClick={() => onApply({ tags: seleccion })} />
      </div>
    </BottomSheet>
  )
}

/**
 * Cocina es la única faceta jerárquica: 9 padres con sus hijos. Tocar el padre
 * lo selecciona a él, y el motor ya expande a los hijos (decisión 13) — no hace
 * falta marcar los 37 slugs en la URL para decir "Asiática".
 */
function Cocina({
  tags,
  seleccion,
  onToggle,
}: {
  tags: CatalogTag[]
  seleccion: string[]
  onToggle: (slug: string) => void
}) {
  const padres = tags.filter((t) => t.parent === null)
  const hijosDe = (slug: string) => tags.filter((t) => t.parent === slug)

  return (
    <div className="flex flex-col gap-3">
      {padres.map((padre) => {
        const hijos = hijosDe(padre.slug)
        const padreActivo = seleccion.includes(padre.slug)

        return (
          <div key={padre.slug} className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <FilterChip active={padreActivo} onClick={() => onToggle(padre.slug)}>
                {padre.name}
              </FilterChip>
              {/* Con el padre activo los hijos ya están incluidos: se apagan para
                  no sugerir que hace falta marcarlos también. */}
              {hijos.map((hijo) => (
                <FilterChip
                  key={hijo.slug}
                  active={seleccion.includes(hijo.slug)}
                  disabled={padreActivo}
                  className={cn(padreActivo && 'opacity-40')}
                  onClick={() => onToggle(hijo.slug)}
                >
                  {hijo.name}
                </FilterChip>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
