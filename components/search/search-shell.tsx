'use client'

import * as React from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { ChevronDown, List, Map as MapIcon, MapPin, SlidersHorizontal, X } from 'lucide-react'

import { SearchInput } from '@/components/ui/search-input'
import { cn } from '@/lib/utils'
import type { ListaDestino } from '@/lib/favoritos/query'
import type { CatalogFacet, CatalogZone } from '@/lib/search/catalog'
import type { OccasionChips } from '@/lib/search/chips'
import {
  serializeSearchParams,
  tieneBusqueda,
  type SearchParams,
} from '@/lib/search/params'
import { etiquetaDeTag, etiquetaDeZona, sugerir } from '@/lib/search/suggest'
import type { SearchedPlace, SearchResult } from '@/lib/search/query'
import { FiltersSheet } from './filters-sheet'
import { OccasionChipsRow } from './occasion-chips'
import { ResultsList } from './results-list'
import { ZoneSheet } from './zone-sheet'

/**
 * MapLibre son ~200 KB gzip y la home es una lista: el mapa se carga recién al
 * tocar "Mapa". `ssr: false` porque MapLibre toca `window` al construirse.
 */
const MapView = dynamic(() => import('./map-view').then((m) => m.MapView), {
  ssr: false,
  loading: () => <div className="h-[70vh] animate-pulse rounded-xl border border-border bg-card" />,
})

/**
 * La home interactiva (F2). Arma `SearchParams` desde la UI y los escribe en la
 * URL, que sigue siendo el estado (decisión 12): este componente **no** consulta
 * la base — eso lo hace el server component de `/` al re-renderizar.
 *
 * Historial (resuelve la tensión entre la decisión 12 y el DoD): tocar chips
 * dentro de un sheet no navega, y quitar un chip activo o aceptar una sugerencia
 * hace `replace` — gestos incrementales que no merecen una entrada cada uno.
 * **Confirmar un sheet con "Ver N lugares" hace `push`**, porque es un gesto
 * deliberado: el back deshace esa tanda de filtros y no cinco toques sueltos.
 */

type Props = {
  params: SearchParams
  facetas: CatalogFacet[]
  zonas: CatalogZone[]
  chips: OccasionChips
  /** Null cuando no hay búsqueda todavía (primera visita, decisión 2). */
  resultado: SearchResult | null
  /**
   * Bloque de destacados de la primera página (MONETIZACION, decisión 21). Solo
   * afecta la lista: el mapa (`resultado`) y el conteo no lo ven. Vacío en GPS —
   * ahí lo trae la API porque el server no tiene coordenadas.
   */
  destacados: SearchedPlace[]
  /**
   * Ids de esta página que el usuario ya tiene guardados (FAVORITOS, decisión 9).
   * Resueltos server-side en `/`; las páginas del scroll las trae `/api/search`.
   */
  guardados: string[]
  /**
   * Listas visibles del usuario (FAVORITOS F2, decisión 8): con más de una, el tap
   * de guardar abre el sheet de destino. Vacío sin sesión.
   */
  listas: ListaDestino[]
  /** Sin sesión el botón de guardar se muestra igual y lleva a login (dec. 7). */
  autenticado: boolean
}

export function SearchShell({
  params,
  facetas,
  zonas,
  chips,
  resultado,
  destacados,
  guardados,
  listas,
  autenticado,
}: Props) {
  const router = useRouter()
  const [zonaAbierta, setZonaAbierta] = React.useState(false)
  const [filtrosAbiertos, setFiltrosAbiertos] = React.useState(false)
  // La vista es estado de UI, no de búsqueda: no va a la URL. Un link compartido
  // abre en lista, que es el default de la decisión 7.
  const [vista, setVista] = React.useState<'lista' | 'mapa'>('lista')
  const [texto, setTexto] = React.useState(params.q ?? '')
  const [enfocado, setEnfocado] = React.useState(false)
  const [coords, setCoords] = React.useState<{ lat: number; lng: number } | null>(null)
  const [gpsError, setGpsError] = React.useState<string | null>(null)

  // La URL manda: si cambia por el back del browser o por un deep link, el campo
  // de texto tiene que seguirla en vez de quedarse con lo último tipeado.
  React.useEffect(() => {
    setTexto(params.q ?? '')
  }, [params.q])

  const navegar = React.useCallback(
    (cambio: Partial<SearchParams>, modo: 'push' | 'replace') => {
      // El cursor no sobrevive a un cambio de filtros: la página 3 de otra
      // búsqueda no significa nada.
      const siguiente = { ...params, ...cambio, cursor: null }
      const qs = serializeSearchParams(siguiente)
      router[modo](qs ? `/?${qs}` : '/', { scroll: false })
    },
    [params, router],
  )

  /**
   * Decisión 17: el permiso se pide acá, al tocar el toggle. Nunca al entrar —
   * ni siquiera si el link trae `gps=1`, porque la intención es de quien
   * compartió, no de quien abre.
   */
  const pedirUbicacion = React.useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError('Tu navegador no comparte ubicación.')
      return
    }
    setGpsError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGpsError('No pudimos acceder a tu ubicación. Elegí una zona a mano.'),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    )
  }, [])

  const sugerencias = React.useMemo(
    () => (enfocado ? sugerir(texto, facetas, zonas) : { tags: [], zonas: [] }),
    [enfocado, texto, facetas, zonas],
  )
  const hayDropdown = sugerencias.tags.length > 0 || sugerencias.zonas.length > 0

  // --- Etiqueta del selector de zona ----------------------------------------
  const gpsActivo = params.gps
  const nombresZona = params.zones.map((s) => etiquetaDeZona(s, zonas)).filter(Boolean) as string[]
  const labelZona = gpsActivo
    ? 'Cerca de mí'
    : nombresZona.length === 0
      ? 'Elegí zona'
      : nombresZona.length === 1
        ? nombresZona[0]
        : `${nombresZona[0]} +${nombresZona.length - 1}`

  // Un link con `gps=1` llega sin coordenadas: son del dispositivo, no del link.
  // No se pide permiso solo (decisión 17) — se muestra el toggle prendido y se
  // invita a tocarlo, que es lo que sí puede disparar el prompt del browser.
  const gpsSinUbicacion = params.gps && coords === null

  return (
    <>
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setZonaAbierta(true)}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-left text-sm"
        >
          <MapPin className="size-4 shrink-0 text-muted-foreground" />
          <span className={cn(nombresZona.length || gpsActivo ? 'text-foreground' : 'text-muted-foreground')}>
            {labelZona}
          </span>
          <ChevronDown className="ml-auto size-4 shrink-0 text-muted-foreground" />
        </button>

        <div className="relative">
          <SearchInput
            placeholder="Buscá lugares o tags"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onFocus={() => setEnfocado(true)}
            // El blur se demora: sin esto, tocar una sugerencia cierra el
            // dropdown antes de que el click llegue a registrarse.
            onBlur={() => setTimeout(() => setEnfocado(false), 150)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              // Enter sin elegir sugerencia: busca por nombre de lugar tal cual
              // (decisión 15). El motor ya tolera typos y acentos.
              e.currentTarget.blur()
              navegar({ q: texto.trim() || null }, 'replace')
            }}
          />

          {hayDropdown && (
            <div className="absolute inset-x-0 top-full z-40 mt-1 overflow-hidden rounded-lg border border-border bg-card shadow-lg">
              <GrupoSugerencias
                titulo="Filtros"
                items={sugerencias.tags.map((s) => ({
                  key: `t-${s.slug}`,
                  label: s.name,
                  detalle: s.facetLabel,
                  onSelect: () => {
                    setTexto('')
                    setEnfocado(false)
                    navegar({ tags: [...params.tags, s.slug], q: null }, 'replace')
                  },
                }))}
              />
              <GrupoSugerencias
                titulo="Zonas"
                items={sugerencias.zonas.map((s) => ({
                  key: `z-${s.slug}`,
                  label: s.name,
                  // "Chacarita y Colegiales · Villa Ortúzar": el alias explica
                  // por qué apareció una zona que no se llama como lo tipeado.
                  detalle: s.via ?? 'Zona',
                  onSelect: () => {
                    setTexto('')
                    setEnfocado(false)
                    navegar({ zones: [...params.zones, s.slug], q: null }, 'replace')
                  },
                }))}
              />
            </div>
          )}
        </div>

        <OccasionChipsRow chips={chips} params={params} onNavegar={navegar} />

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setFiltrosAbiertos(true)}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm text-foreground"
          >
            <SlidersHorizontal className="size-4 text-muted-foreground" />
            Filtros
            {params.tags.length > 0 && (
              <span className="rounded-full bg-primary px-2 text-xs text-primary-foreground">
                {params.tags.length}
              </span>
            )}
          </button>

          {/* Decisión 7: la lista es el default y el mapa un botón al lado. Solo
              tiene sentido cuando hay algo que mapear. */}
          {resultado && (
            <button
              type="button"
              onClick={() => setVista((v) => (v === 'lista' ? 'mapa' : 'lista'))}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm text-foreground"
            >
              {vista === 'lista' ? (
                <>
                  <MapIcon className="size-4 text-muted-foreground" />
                  Mapa
                </>
              ) : (
                <>
                  <List className="size-4 text-muted-foreground" />
                  Lista
                </>
              )}
            </button>
          )}
        </div>

        <ChipsActivos params={params} facetas={facetas} zonas={zonas} onNavegar={navegar} />

        {gpsError && <p className="text-sm text-muted-foreground">{gpsError}</p>}
      </div>

      {gpsSinUbicacion ? (
        <Vacio
          titulo="Necesitamos saber dónde estás"
          detalle="Tocá “Cerca de mí” en el selector de zona para compartir tu ubicación. No la pedimos sin que la toques."
        />
      ) : !resultado ? (
        <Vacio
          titulo="Elegí zona para arrancar"
          detalle="Decinos por dónde andás y te tiramos la posta."
        />
      ) : vista === 'mapa' ? (
        <MapView params={params} coords={coords} />
      ) : (
        <ResultsList
          initialPlaces={resultado.places}
          initialCursor={resultado.nextCursor}
          initialDestacados={destacados}
          initialGuardados={guardados}
          listas={listas}
          autenticado={autenticado}
          params={params}
          coords={coords}
          vacio={
            // Decisión 23: nunca una pantalla muerta. Los chips activos siguen
            // arriba, a mano para sacar.
            <Vacio
              titulo="No encontramos nada con eso"
              detalle={
                tieneBusqueda(params)
                  ? 'Sacá alguno de los chips de arriba o ampliá la zona.'
                  : 'Probá ampliando la zona.'
              }
            />
          }
        />
      )}

      <ZoneSheet
        open={zonaAbierta}
        onClose={() => setZonaAbierta(false)}
        zonas={zonas}
        params={params}
        coords={coords}
        onPedirUbicacion={pedirUbicacion}
        onApply={({ zones, gps }) => {
          setZonaAbierta(false)
          navegar({ zones, gps }, 'push')
        }}
      />

      <FiltersSheet
        open={filtrosAbiertos}
        onClose={() => setFiltrosAbiertos(false)}
        facetas={facetas}
        params={params}
        coords={coords}
        onApply={({ tags }) => {
          setFiltrosAbiertos(false)
          navegar({ tags }, 'push')
        }}
      />
    </>
  )
}

function GrupoSugerencias({
  titulo,
  items,
}: {
  titulo: string
  items: { key: string; label: string; detalle: string; onSelect: () => void }[]
}) {
  if (items.length === 0) return null
  return (
    <div className="border-b border-border last:border-0">
      <p className="px-3 pt-2 text-xs font-medium text-muted-foreground">{titulo}</p>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          // `onMouseDown` y no `onClick`: el blur del input dispara primero y
          // desmontaría el botón antes de que el click complete.
          onMouseDown={(e) => {
            e.preventDefault()
            item.onSelect()
          }}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary"
        >
          <span className="text-foreground">{item.label}</span>
          <span className="ml-auto text-xs text-muted-foreground">{item.detalle}</span>
        </button>
      ))}
    </div>
  )
}

/**
 * Los chips de lo que está aplicado, todos removibles (decisión 15: lo que se
 * aplica se ve). Es también el rescate del estado de 0 resultados: el usuario
 * saca de acá lo que sobra sin abrir ningún sheet.
 */
/** Slug legible cuando el catálogo no da label (tag sin lugares, escondido). */
function etiquetaFallback(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase())
}

function ChipsActivos({
  params,
  facetas,
  zonas,
  onNavegar,
}: {
  params: SearchParams
  facetas: CatalogFacet[]
  zonas: CatalogZone[]
  onNavegar: (cambio: Partial<SearchParams>, modo: 'push' | 'replace') => void
}) {
  const chips: { key: string; label: string; quitar: () => void }[] = []

  if (params.gps) {
    chips.push({
      key: 'gps',
      label: 'Cerca de mí',
      quitar: () => onNavegar({ gps: false }, 'replace'),
    })
  } else {
    for (const slug of params.zones) {
      const label = etiquetaDeZona(slug, zonas)
      if (!label) continue
      chips.push({
        key: `z-${slug}`,
        label,
        quitar: () => onNavegar({ zones: params.zones.filter((s) => s !== slug) }, 'replace'),
      })
    }
  }

  for (const slug of params.tags) {
    // Un tag sin lugares queda escondido del catálogo (`etiquetaDeTag` da null),
    // pero el motor lo sigue aplicando (filtro fantasma, BACKLOG): sin chip no hay
    // forma de sacarlo salvo editando la URL a mano. Todo tag en la URL tiene que
    // poder quitarse, con o sin label del catálogo.
    const label = etiquetaDeTag(slug, facetas) ?? etiquetaFallback(slug)
    chips.push({
      key: `t-${slug}`,
      label,
      quitar: () => onNavegar({ tags: params.tags.filter((s) => s !== slug) }, 'replace'),
    })
  }

  if (params.q) {
    chips.push({
      key: 'q',
      label: `“${params.q}”`,
      quitar: () => onNavegar({ q: null }, 'replace'),
    })
  }

  if (chips.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.quitar}
          aria-label={`Quitar ${chip.label}`}
          className="inline-flex h-8 items-center gap-1 rounded-full border border-primary bg-primary/10 px-3 text-sm text-foreground"
        >
          {chip.label}
          <X className="size-3.5 text-muted-foreground" />
        </button>
      ))}
    </div>
  )
}

function Vacio({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-6 text-center">
      <p className="text-sm font-medium text-foreground">{titulo}</p>
      <p className="mt-1 text-sm text-muted-foreground">{detalle}</p>
    </div>
  )
}
