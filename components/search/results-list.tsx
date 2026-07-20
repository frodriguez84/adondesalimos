'use client'

import * as React from 'react'

import { PlaceCard } from '@/components/shared/place-card'
import { tagsDestacados, ubicacionDeCard } from '@/lib/search/card'
import { serializeApiParams, type SearchParams } from '@/lib/search/params'
import type { SearchedPlace } from '@/lib/search/query'

/**
 * La lista con infinite scroll (decisión 19), reemplazando el "Ver más" sin JS
 * que dejó F1.
 *
 * Dos orígenes posibles, y por eso el componente no es trivial:
 *
 *  - **Normal**: el server component ya buscó y siembra la primera página. El
 *    scroll pide las siguientes a `/api/search` con el cursor.
 *  - **GPS**: las coordenadas no viajan en la URL (son del dispositivo que mira,
 *    no del que compartió el link), así que el server **no puede** buscar. Acá
 *    la primera página también se pide por API, ya con lat/lng.
 */

type Props = {
  initialPlaces: SearchedPlace[]
  initialCursor: string | null
  params: SearchParams
  coords: { lat: number; lng: number } | null
  /** Estado de 0 resultados: lo dibuja el shell, que tiene los chips a mano. */
  vacio: React.ReactNode
}

export function ResultsList({ initialPlaces, initialCursor, params, coords, vacio }: Props) {
  const usaGps = params.gps && coords !== null
  const clave = serializeApiParams({ ...params, cursor: null }, coords)

  const [places, setPlaces] = React.useState(usaGps ? [] : initialPlaces)
  const [cursor, setCursor] = React.useState(usaGps ? null : initialCursor)
  const [cargando, setCargando] = React.useState(usaGps)
  const [agotado, setAgotado] = React.useState(!usaGps && initialCursor === null)

  const sentinela = React.useRef<HTMLDivElement>(null)

  // La búsqueda cambió: se descarta lo acumulado. En modo normal el server ya
  // trajo la página nueva; en GPS hay que pedirla.
  React.useEffect(() => {
    if (usaGps) {
      let vigente = true
      setCargando(true)
      fetch(`/api/search?${clave}`)
        .then((r) => r.json())
        .then((json) => {
          if (!vigente || !json.data) return
          setPlaces(json.data.places)
          setCursor(json.data.nextCursor)
          setAgotado(json.data.nextCursor === null)
        })
        .catch(() => {})
        .finally(() => vigente && setCargando(false))
      return () => {
        vigente = false
      }
    }

    setPlaces(initialPlaces)
    setCursor(initialCursor)
    setAgotado(initialCursor === null)
    setCargando(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, initialPlaces, initialCursor])

  const cargarMas = React.useCallback(async () => {
    if (cargando || agotado || !cursor) return
    setCargando(true)
    try {
      const qs = serializeApiParams({ ...params, cursor }, coords)
      const res = await fetch(`/api/search?${qs}`)
      const json = await res.json()
      if (json.data) {
        // Por slug de id: si dos páginas se solapan (catálogo editado entre
        // pedidos), la card no se duplica en pantalla.
        setPlaces((prev) => {
          const vistos = new Set(prev.map((p) => p.id))
          return [...prev, ...json.data.places.filter((p: SearchedPlace) => !vistos.has(p.id))]
        })
        setCursor(json.data.nextCursor)
        setAgotado(json.data.nextCursor === null)
      } else {
        setAgotado(true)
      }
    } catch {
      // Red caída: se corta el scroll infinito en vez de reintentar en loop.
      setAgotado(true)
    } finally {
      setCargando(false)
    }
  }, [cargando, agotado, cursor, params, coords])

  React.useEffect(() => {
    const nodo = sentinela.current
    if (!nodo || agotado) return
    // `rootMargin` adelanta la carga: la página siguiente empieza a viajar antes
    // de que el usuario toque el fondo de la lista.
    const obs = new IntersectionObserver(
      (entradas) => entradas[0]?.isIntersecting && cargarMas(),
      { rootMargin: '400px' },
    )
    obs.observe(nodo)
    return () => obs.disconnect()
  }, [cargarMas, agotado])

  if (places.length === 0) {
    return cargando ? <Esqueleto /> : <>{vacio}</>
  }

  return (
    <section className="flex flex-col gap-3">
      {places.map((place) => (
        <PlaceCard
          key={place.id}
          id={place.id}
          name={place.name}
          tags={tagsDestacados(place.tags)}
          location={ubicacionDeCard(place)}
          distanceKm={place.distanceKm}
        />
      ))}

      <div ref={sentinela} aria-hidden className="h-px" />

      {cargando && <p className="py-3 text-center text-sm text-muted-foreground">Buscando…</p>}
      {agotado && (
        <p className="py-3 text-center text-sm text-muted-foreground">
          Eso es todo lo que tenemos por acá.
        </p>
      )}
    </section>
  )
}

function Esqueleto() {
  return (
    <div className="flex flex-col gap-3" aria-busy>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-card" />
      ))}
    </div>
  )
}
