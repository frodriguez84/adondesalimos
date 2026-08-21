'use client'

import * as React from 'react'
import maplibregl from 'maplibre-gl'
import { X } from 'lucide-react'

import 'maplibre-gl/dist/maplibre-gl.css'

import { PlaceCard } from '@/components/shared/place-card'
import { AMBA_BBOX } from '@/lib/geo/amba'
import { tagsDestacados, ubicacionDeCard } from '@/lib/search/card'
import {
  MAP_PIN_LIMIT,
  serializeApiParams,
  serializeSearchParams,
  type SearchParams,
} from '@/lib/search/params'
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
  /** Aviso de ubicación (decisiones 11 y 12): va al overlay que el mapa ya tiene. */
  const [avisoUbicacion, setAvisoUbicacion] = React.useState<string | null>(null)

  /**
   * MAPA, decisión 1: **el gesto de cámara del usuario gana hasta que cambie la
   * búsqueda.** Mientras esté marcado, el `fitBounds` automático de los pins se
   * saltea. Sin esto, centrarse con «Dónde estoy» y «Cerca de mí» prendido dura
   * hasta el próximo re-fetch, y la feature se siente rota.
   */
  const camaraDelUsuario = React.useRef(false)

  // Los handlers de click se registran una sola vez, dentro del `load`, así que
  // necesitan leer los lugares actuales sin obligar a remontar el mapa.
  const placesRef = React.useRef<SearchedPlace[]>([])
  placesRef.current = places

  const clave = serializeApiParams({ ...params, cursor: null }, coords)
  /**
   * Lo que cambia el ENCUADRE, que no es lo mismo que lo que cambia el fetch:
   * `clave` incluye las coordenadas y `claveBusqueda` no. Usar `clave` acá haría
   * que centrarse con «Cerca de mí» prendido se auto-pise en el re-fetch
   * siguiente — justo el bug que la decisión 1 viene a evitar.
   */
  const claveBusqueda = serializeSearchParams(params)

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

  // Cambiar de zona, de tags o de texto devuelve el encuadre al automático: uno
  // espera ver la zona nueva, no seguir mirando el barrio viejo (decisión 1).
  React.useEffect(() => {
    camaraDelUsuario.current = false
  }, [claveBusqueda])

  // Los avisos de ubicación son transitorios: sin esto, "estás fuera de AMBA" se
  // quedaría pegado tapando "Cargando el mapa…" el resto de la visita.
  React.useEffect(() => {
    if (!avisoUbicacion) return
    const id = setTimeout(() => setAvisoUbicacion(null), 6_000)
    return () => clearTimeout(id)
  }, [avisoUbicacion])

  // --- Mapa -----------------------------------------------------------------
  React.useEffect(() => {
    if (!contenedor.current || mapa.current) return

    const m = new maplibregl.Map({
      container: contenedor.current,
      style: ESTILO,
      center: CENTRO_AMBA,
      zoom: 11,
      // La atribución va SIEMPRE desplegada, no en el botón "i": es la condición
      // de uso de OSM y de OpenFreeMap, no un detalle de UI (ver /legales/atribucion).
      attributionControl: { compact: false },
      // Decisión 7: el control de ubicación se rotula en castellano. Se pisa por
      // `locale` y no editando el DOM después de `addControl` porque MapLibre
      // arma el botón de forma asíncrona (espera a `navigator.permissions`) y lo
      // vuelve a rotular cada vez que cambia de estado: pisar el atributo una
      // sola vez no alcanzaría.
      locale: {
        'GeolocateControl.FindMyLocation': 'Dónde estoy',
        'GeolocateControl.LocationNotAvailable': 'No podemos ubicarte',
      },
    })
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

    // FB-04, decisión 4: el control nativo de MapLibre, no uno propio. Regala el
    // punto azul, el círculo de precisión y —lo que importa— **pide el permiso
    // recién al tocarlo**, así la decisión 17 de BUSQUEDA sigue intacta.
    const ubicacion = new maplibregl.GeolocateControl({
      // Un toque = un centrado (decisión 6). El seguimiento continuo gasta
      // batería y pelea con el arrastre del mapa.
      trackUserLocation: false,
      showUserLocation: true,
      showAccuracyCircle: true,
      // El mismo tope que el `fitBounds` de los pins, para que un toque no te
      // deje en zoom de calle.
      fitBoundsOptions: { maxZoom: 15 },
    })
    m.addControl(ubicacion, 'top-right')

    /**
     * Qué marca la cámara como "del usuario" (decisión 2). La lista está escrita
     * a propósito, porque es el tipo de detalle que después nadie sabe si le
     * falta un evento o le sobra:
     *
     *  - `dragstart` / `zoomstart` / `rotatestart` **solo con `originalEvent`**:
     *    esos eventos disparan igual en los movimientos programáticos, y sin el
     *    filtro el propio `fitBounds` se auto-marcaría y el mapa no volvería a
     *    encuadrar los pins nunca más.
     *  - el `easeTo` de abrir un cluster (más abajo) y el `geolocate` del
     *    control: son consecuencia de un toque, pero MapLibre mueve la cámara sin
     *    `originalEvent`, así que se marcan a mano.
     */
    const marcarCamara = (e: { originalEvent?: unknown }) => {
      if (e.originalEvent) camaraDelUsuario.current = true
    }
    m.on('dragstart', marcarCamara)
    m.on('zoomstart', marcarCamara)
    m.on('rotatestart', marcarCamara)

    ubicacion.on('geolocate', (e: { coords?: GeolocationCoordinates }) => {
      camaraDelUsuario.current = true

      // Decisión 11: fuera de AMBA se avisa, pero el mapa **igual** te lleva ahí
      // —pediste verte, no buscar—. Sin el aviso, el que abre de vacaciones ve un
      // mapa vacío y cree que la app se rompió.
      const c = e.coords
      if (!c) return
      const fuera =
        c.longitude < AMBA_BBOX.xmin ||
        c.longitude > AMBA_BBOX.xmax ||
        c.latitude < AMBA_BBOX.ymin ||
        c.latitude > AMBA_BBOX.ymax
      setAvisoUbicacion(fuera ? 'Por ahora andamos solo por Buenos Aires y alrededores.' : null)
    })
    ubicacion.on('error', () => {
      setAvisoUbicacion('No pudimos ubicarte. Fijate que le hayas dado permiso al navegador.')
    })

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
          'circle-color': '#FF2D75',
          'circle-opacity': 0.85,
          'circle-radius': ['step', ['get', 'point_count'], 16, 10, 22, 50, 30],
        },
      })
      m.addLayer({
        id: 'clusters-count',
        type: 'symbol',
        source: 'lugares',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-size': 12,
          // OpenFreeMap sirve fuentes Noto, no el default de MapLibre
          // ("Open Sans Regular,Arial Unicode MS Regular"), que da 404 en su
          // endpoint de glyphs y obliga al fallback de render local. Fijar el
          // fontstack a uno que sí existe elimina el 404 y dibuja el número con
          // la glyph real.
          'text-font': ['Noto Sans Bold'],
        },
        // Texto oscuro sobre rosa (IDENTIDAD): blanco da 3.57:1 y falla AA; el
        // oscuro #0D0D1F da 5.38:1. La regla es "sobre rosa el texto va oscuro".
        paint: { 'text-color': '#0D0D1F' },
      })
      m.addLayer({
        id: 'pins',
        type: 'circle',
        source: 'lugares',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': '#FF2D75',
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
        // Decisión 2: abrir un cluster es consecuencia de un toque, pero el
        // `easeTo` es programático y no trae `originalEvent`, así que se marca
        // acá; si no, el próximo re-fetch se lleva puesto el zoom que el usuario
        // acaba de abrir.
        camaraDelUsuario.current = true
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
    // Decisión 1: la única guarda. Los pins se dibujan igual (el `setData` de
    // arriba corre siempre); lo único que se respeta es hacia dónde está mirando.
    if (camaraDelUsuario.current) return
    const bounds = new maplibregl.LngLatBounds()
    for (const p of places) bounds.extend([p.lng, p.lat])
    m.fitBounds(bounds, { padding: 48, maxZoom: 15, duration: 0 })
  }, [places, listo])

  return (
    // PBETA-R1-06 (decisión 9): sin alto fijo. El contenedor ya es un flex item
    // del `<main>` de la home, así que `flex-1` llena exactamente lo que queda —
    // en cualquier viewport y sin números mágicos, a diferencia del `70vh`, que
    // en un teléfono corto se seguía cortando. El piso es para que en landscape
    // no colapse a nada (ahí la página vuelve a scrollear, degradación aceptada).
    <div className="relative flex min-h-80 flex-1 flex-col overflow-hidden rounded-xl border border-border">
      {/* El alto del div del mapa sale de `flex-1`, no de `size-full`: el `h-full`
          necesita que el padre tenga un alto **declarado** y el del contenedor ahora
          sale de `flex-1` (decisión 9), así que colapsaba a 0 px —el canvas quedaba
          desbordado y los controles no recibían el toque—. Tampoco sirve `absolute`:
          el CSS de MapLibre pisa el `position` con su propio `.maplibregl-map`. */}
      <div ref={contenedor} className="flex-1" />

      {(avisoUbicacion || cargando || error || (!cargando && places.length === 0)) && (
        // Decisión 12: un patrón de aviso por pantalla — los errores de ubicación
        // salen por esta misma píldora y no por un toast nuevo. El `px-14` deja
        // libre la esquina de los controles: el aviso de ubicación es largo y en
        // 390 px de ancho se les encimaría.
        <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-14">
          <p className="rounded-full bg-card/95 px-3 py-1.5 text-center text-sm text-muted-foreground shadow">
            {avisoUbicacion
              ? avisoUbicacion
              : cargando
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
