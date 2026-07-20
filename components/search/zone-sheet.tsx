'use client'

import * as React from 'react'
import { ChevronDown, MapPin } from 'lucide-react'

import { BottomSheet } from '@/components/ui/bottom-sheet'
import { FilterChip } from '@/components/ui/filter-chip'
import { SearchInput } from '@/components/ui/search-input'
import { cn } from '@/lib/utils'
import { REGION_LABELS, REGION_ORDER } from '@/lib/zones/canon'
import type { CatalogZone } from '@/lib/search/catalog'
import { normalizar } from '@/lib/search/suggest'
import type { SearchParams } from '@/lib/search/params'
import { useCount } from './use-count'

/**
 * Selector de zona (decisiones 2, 3, 4, 9): buscador con autocompletar sobre
 * nombre + alias, las 4 regiones desplegables, zonas como chips
 * multiseleccionables y el toggle "Cerca de mí".
 *
 * Edita un **borrador**: nada se aplica hasta tocar "Ver N lugares". Así el
 * contador puede anticipar el resultado de una selección que todavía no pasó,
 * que es el punto de la decisión 20.
 */

type Props = {
  open: boolean
  onClose: () => void
  zonas: CatalogZone[]
  params: SearchParams
  coords: { lat: number; lng: number } | null
  /** Aplica el borrador y cierra. El shell decide si hace push o replace. */
  onApply: (cambio: { zones: string[]; gps: boolean }) => void
  /** Pide el permiso del browser. Se llama al TOCAR el toggle (decisión 17). */
  onPedirUbicacion: () => void
}

export function ZoneSheet({
  open,
  onClose,
  zonas,
  params,
  coords,
  onApply,
  onPedirUbicacion,
}: Props) {
  const [seleccion, setSeleccion] = React.useState<string[]>(params.zones)
  const [gps, setGps] = React.useState(params.gps)
  const [filtro, setFiltro] = React.useState('')
  const [abiertas, setAbiertas] = React.useState<string[]>(['caba'])

  // Al abrir, el borrador arranca de lo que está aplicado hoy. Sin esto, cerrar
  // sin aplicar y volver a abrir mostraría la selección descartada.
  React.useEffect(() => {
    if (!open) return
    setSeleccion(params.zones)
    setGps(params.gps)
    setFiltro('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const count = useCount({ ...params, zones: seleccion, gps, cursor: null }, coords, open)

  const termino = normalizar(filtro)
  const filtrando = termino.length >= 2

  /** Matchea nombre o alias — los alias son 4 en toda la DB, pero son contrato. */
  const matchea = React.useCallback(
    (zona: CatalogZone) =>
      normalizar(zona.name).includes(termino) ||
      zona.aliases.some((a) => normalizar(a).includes(termino)),
    [termino],
  )

  const toggleZona = (slug: string) =>
    setSeleccion((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    )

  const toggleGps = () => {
    // Decisión 3: el GPS REEMPLAZA al conjunto de zonas. Encenderlo no las borra
    // del borrador —se ven apagadas y vuelven si se apaga el toggle— pero el
    // motor ignora las zonas mientras haya coordenadas.
    const siguiente = !gps
    setGps(siguiente)
    // Decisión 17: el permiso se pide recién acá, al tocar, nunca al entrar.
    if (siguiente && !coords) onPedirUbicacion()
  }

  const visibles = (region: string) =>
    zonas.filter((z) => z.region === region && (!filtrando || matchea(z)))

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-foreground">¿Por dónde andás?</h2>

        <SearchInput
          placeholder="Buscá tu zona o barrio"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          aria-label="Buscar zona"
        />

        <button
          type="button"
          onClick={toggleGps}
          aria-pressed={gps}
          className={cn(
            'flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors',
            gps
              ? 'border-primary bg-primary/10 text-foreground'
              : 'border-border text-muted-foreground hover:text-foreground',
          )}
        >
          <MapPin className="size-4" />
          Cerca de mí
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            {gps ? (coords ? 'a 2 km a la redonda' : 'esperando ubicación…') : null}
          </span>
        </button>

        {/* Las zonas se apagan visualmente con el GPS encendido (decisión 3). */}
        <div className={cn('flex flex-col gap-3', gps && 'pointer-events-none opacity-40')}>
          {REGION_ORDER.map((region) => {
            const deRegion = visibles(region)
            if (deRegion.length === 0) return null
            // Buscando, todo se muestra abierto: esconder el match sería absurdo.
            const desplegada = filtrando || abiertas.includes(region)

            return (
              <section key={region}>
                <button
                  type="button"
                  onClick={() =>
                    setAbiertas((prev) =>
                      prev.includes(region)
                        ? prev.filter((r) => r !== region)
                        : [...prev, region],
                    )
                  }
                  aria-expanded={desplegada}
                  className="flex w-full items-center justify-between py-2 text-sm font-medium text-foreground"
                >
                  {REGION_LABELS[region]}
                  <ChevronDown
                    className={cn('size-4 transition-transform', desplegada && 'rotate-180')}
                  />
                </button>

                {desplegada && (
                  <div className="flex flex-wrap gap-2 pb-2">
                    {deRegion.map((zona) => (
                      <FilterChip
                        key={zona.slug}
                        active={seleccion.includes(zona.slug)}
                        onClick={() => toggleZona(zona.slug)}
                      >
                        {zona.name}
                      </FilterChip>
                    ))}
                  </div>
                )}
              </section>
            )
          })}

          {filtrando && REGION_ORDER.every((r) => visibles(r).length === 0) && (
            <p className="py-2 text-sm text-muted-foreground">
              No tenemos esa zona. Probá con el barrio de al lado.
            </p>
          )}
        </div>

        <BotonAplicar
          count={count}
          disabled={seleccion.length === 0 && !gps}
          onClick={() => onApply({ zones: seleccion, gps })}
        />
      </div>
    </BottomSheet>
  )
}

/**
 * Compartido por los dos sheets. `null` muestra el label sin número: el conteo
 * viaja por red y un "0" mientras carga desanima una búsqueda que sí tiene
 * resultados.
 */
export function BotonAplicar({
  count,
  disabled,
  onClick,
}: {
  count: number | null
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="sticky bottom-0 rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-40"
    >
      {count === null
        ? 'Ver lugares'
        : count === 0
          ? 'Nada con eso'
          : `Ver ${count.toLocaleString('es-AR')} ${count === 1 ? 'lugar' : 'lugares'}`}
    </button>
  )
}
