'use client'

import * as React from 'react'
import maplibregl from 'maplibre-gl'
import { X } from 'lucide-react'

import 'maplibre-gl/dist/maplibre-gl.css'

import { PlaceCard } from '@/components/shared/place-card'
import { tagsDestacados, ubicacionDeCard } from '@/lib/search/card'
import { MAP_PIN_LIMIT, serializeApiParams, type SearchParams } from '@/lib/search/params'
import type { SearchedPlace } from '@/lib/search/query'

/**
 * Vista mapa (decisión 21): MapLibre GL JS + tiles de OpenFreeMap.
 *
 * OpenFreeMap es gratis, sin API key y permite uso comercial; los pins salen de
 * lat/lng propios (Overture), así que el mapa no cuesta nada por uso. **No se
 * dibujan los polígonos de zona**: el mapa responde "qué hay acá", no "dónde
 * está la zona".
 *
 * Se carga con `next/dynamic` desde el shell (ver `search-shell.tsx`): MapLibre
 * son ~200 KB gzip que no tienen por qué viajar en el primer render de la home,
 * que es una lista.
 */

/** Estilo público de OpenFreeMap. Sin key, atribución OSM incluida. */
const ESTILO = 'https://tiles.openfreemap.org/styles/bright'

/** Centro de arranque si todavía no hay pins: el Obelisco. */
const CENTRO_AMBA: [number, number] = [-58.3816, -34.6037]

type Props = {
  params: SearchParams
  coords: { lat: number; lng: number } | null
}

export function MapView({ params, coords }: Props) {
  const contenedor = React.useRef<HTMLDivElement>(null)
  const mapa = React.useRef<maplibregl.Map | null>(null)

  const [places, setPlaces] = React.useState<SearchedPlace[]>([])
  const [truncated, setTruncated] = React.useState(false)
  const [cargando, setCargando] = React.useState(true)
  const [error, setError] = React.useState(false)
  const [elegido, setElegido] = React.useState<SearchedPlace | null>(null)
  /** El mapa terminó de cargar el estilo: recién ahí acepta fuentes y capas. */
  const [listo, setListo] = React.useState(false)

  // Los handlers de click se registran una sola vez, dentro del `load`, así que
  // necesitan leer los lugares actuales sin obligar a remontar el mapa.
  const placesRef = React.useRef<SearchedPlace[]>([])
  placesRef.current = places

  const clave = serializeApiParams({ ...params, cursor: null }, coords)

  // --- Datos ----------------------------------------------------------------
  React.useEffect(() => {
    let vigente = true
    setCargando(true)
    setError(false)
    fetch(`/api/search/pins?${clave}`)
      .then((r) => r.json())
      .then((json) => {
        if (!vigente) return
        if (!json.data) {
          setError(true)
          return
        }
        setPlaces(json.data.places)
        setTruncated(json.data.truncated)
      })
      .catch(() => vigente && setError(true))
      .finally(() => vigente && setCargando(false))
    return () => {
      vigente = false
    }
  }, [clave])

  // --- Mapa -----------------------------------------------------------------
  React.useEffect(() => {
    if (!contenedor.current || mapa.current) return

    const m = new maplibregl.Map({
      container: contenedor.current,
      style: ESTILO,
      center: CENTRO_AMBA,
      zoom: 11,
      // La atribución va SIEMPRE desplegada, no en el botón "i": es la condición
      // de uso de OSM y de OpenFreeMap, no un detalle de UI (ver /legales).
      attributionControl: { compact: false },
    })
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

    m.on('load', () => {
      m.addSource('lugares', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        // Clustering nativo (decisión 21). Va siempre y no solo pasado cierto
        // número: con el tope de 200 pins, 200 puntos sobre Palermo son
        // igualmente ilegibles sueltos. El cluster se abre al tocarlo.
        cluster: true,
        clusterRadius: 50,
        clusterMaxZoom: 15,
      })

      m.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'lugares',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#e11d48',
          'circle-opacity': 0.85,
          'circle-radius': ['step', ['get', 'point_count'], 16, 10, 22, 50, 30],
        },
      })
      m.addLayer({
        id: 'clusters-count',
        type: 'symbol',
        source: 'lugares',
        filter: ['has', 'point_count'],
        layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 12 },
        paint: { 'text-color': '#ffffff' },
      })
      m.addLayer({
        id: 'pins',
        type: 'circle',
        source: 'lugares',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': '#e11d48',
          'circle-radius': 7,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      })

      m.on('click', 'pins', (e) => {
        const id = e.features?.[0]?.properties?.id
        if (typeof id === 'string') setElegido(placesRef.current.find((p) => p.id === id) ?? null)
      })
      m.on('click', 'clusters', async (e) => {
        const feature = e.features?.[0]
        const clusterId = feature?.properties?.cluster_id
        if (clusterId === undefined) return
        const fuente = m.getSource('lugares') as maplibregl.GeoJSONSource
        const zoom = await fuente.getClusterExpansionZoom(clusterId as number)
        m.easeTo({ center: (feature!.geometry as GeoJSON.Point).coordinates as [number, number], zoom })
      })

      for (const capa of ['pins', 'clusters']) {
        m.on('mouseenter', capa, () => (m.getCanvas().style.cursor = 'pointer'))
        m.on('mouseleave', capa, () => (m.getCanvas().style.cursor = ''))
      }

      setListo(true)
    })

    mapa.current = m
    return () => {
      m.remove()
      mapa.current = null
    }
  }, [])

  // --- Pins → mapa ----------------------------------------------------------
  React.useEffect(() => {
    const m = mapa.current
    if (!m || !listo) return

    const fuente = m.getSource('lugares') as maplibregl.GeoJSONSource | undefined
    if (!fuente) return

    fuente.setData({
      type: 'FeatureCollection',
      features: places.map((p) => ({
        type: 'Feature',
        // Solo el id: la mini-card se arma con el objeto que ya está en memoria,
        // así el estilo del mapa no carga con datos que no dibuja.
        properties: { id: p.id },
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      })),
    })

    setElegido(null)

    if (places.length === 0) return
    const bounds = new maplibregl.LngLatBounds()
    for (const p of places) bounds.extend([p.lng, p.lat])
    m.fitBounds(bounds, { padding: 48, maxZoom: 15, duration: 0 })
  }, [places, listo])

  return (
    <div className="relative h-[70vh] overflow-hidden rounded-xl border border-border">
      <div ref={contenedor} className="size-full" />

      {(cargando || error || (!cargando && places.length === 0)) && (
        <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
          <p className="rounded-full bg-card/95 px-3 py-1.5 text-sm text-muted-foreground shadow">
            {cargando
              ? 'Cargando el mapa…'
              : error
                ? 'No pudimos cargar el mapa.'
                : 'No hay nada para mostrar acá.'}
          </p>
        </div>
      )}

      {truncated && !cargando && (
        <div className="pointer-events-none absolute inset-x-0 bottom-10 flex justify-center px-3">
          <p className="rounded-full bg-card/95 px-3 py-1.5 text-center text-xs text-muted-foreground shadow">
            Te mostramos los primeros {MAP_PIN_LIMIT}. Achicá la zona o sumá filtros para verlos
            todos.
          </p>
        </div>
      )}

      {elegido && (
        <div className="absolute inset-x-3 bottom-10">
          <div className="relative">
            <PlaceCard
              id={elegido.id}
              name={elegido.name}
              tags={tagsDestacados(elegido.tags)}
              location={ubicacionDeCard(elegido)}
              distanceKm={elegido.distanceKm}
              className="shadow-lg"
            />
            <button
              type="button"
              onClick={() => setElegido(null)}
              aria-label="Cerrar"
              className="absolute right-2 top-2 rounded-full bg-card p-1 text-muted-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
