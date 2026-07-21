'use client'

import * as React from 'react'
import maplibregl from 'maplibre-gl'

import 'maplibre-gl/dist/maplibre-gl.css'

/**
 * Selector de ubicación del alta (decisión 12): **el pin lo pone el dueño en el
 * mapa**, sin geocoder pago. Mismo stack que la vista mapa de la búsqueda
 * (MapLibre + tiles de OpenFreeMap, gratis y sin key), así el alta no agrega
 * ningún costo por uso.
 *
 * El marker se arrastra y el mapa acepta click: las dos formas de corregirlo.
 * La zona **no** se elige acá — se calcula en el servidor con la geometría de
 * ZONAS cuando se guarda (turf), que es la fuente única de esa asignación.
 */

const ESTILO = 'https://tiles.openfreemap.org/styles/bright'

/** Arranque: el Obelisco, igual que la vista mapa. */
export const CENTRO_AMBA: { lat: number; lng: number } = { lat: -34.6037, lng: -58.3816 }

type Props = {
  valor: { lat: number; lng: number }
  onChange: (coords: { lat: number; lng: number }) => void
}

export function PinPicker({ valor, onChange }: Props) {
  const contenedor = React.useRef<HTMLDivElement>(null)
  const mapa = React.useRef<maplibregl.Map | null>(null)
  const marker = React.useRef<maplibregl.Marker | null>(null)

  // El handler del mapa se registra una sola vez; leer el callback por ref evita
  // remontar el mapa en cada render del formulario.
  const onChangeRef = React.useRef(onChange)
  onChangeRef.current = onChange

  React.useEffect(() => {
    if (!contenedor.current || mapa.current) return

    const m = new maplibregl.Map({
      container: contenedor.current,
      style: ESTILO,
      center: [valor.lng, valor.lat],
      zoom: 13,
      // Atribución siempre visible: condición de uso de OSM/OpenFreeMap.
      attributionControl: { compact: false },
    })
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

    const mk = new maplibregl.Marker({ draggable: true, color: '#e11d48' })
      .setLngLat([valor.lng, valor.lat])
      .addTo(m)

    mk.on('dragend', () => {
      const { lat, lng } = mk.getLngLat()
      onChangeRef.current({ lat, lng })
    })

    m.on('click', (e) => {
      mk.setLngLat(e.lngLat)
      onChangeRef.current({ lat: e.lngLat.lat, lng: e.lngLat.lng })
    })

    mapa.current = m
    marker.current = mk

    return () => {
      m.remove()
      mapa.current = null
      marker.current = null
    }
    // Solo al montar: `valor` entra como posición inicial y después lo maneja el
    // marker. Volver a correr esto con cada arrastre remontaría el mapa entero.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex flex-col gap-2">
      <div className="h-64 overflow-hidden rounded-xl border border-border">
        <div ref={contenedor} className="size-full" />
      </div>
      <p className="text-xs text-muted-foreground">
        Arrastrá el pin o tocá el mapa hasta la puerta del local. De acá sale su ubicación exacta.
      </p>
    </div>
  )
}
