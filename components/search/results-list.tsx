'use client'

import * as React from 'react'
import Link from 'next/link'

import { BotonGuardar } from '@/components/favoritos/boton-guardar'
import { PlaceCard } from '@/components/shared/place-card'
import type { ListaDestino } from '@/lib/favoritos/query'
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

/**
 * Debajo de esto la búsqueda se siente flaca y aparece el renglón de cobertura
 * (DEPLOY, decisión 21). El número no está medido —es la propuesta del spec— y
 * es puerta de ida y vuelta: se mueve cuando haya uso real.
 */
const RESULTADOS_FLACOS = 5

type Props = {
  initialPlaces: SearchedPlace[]
  initialCursor: string | null
  /**
   * El bloque de hasta 3 destacados (MONETIZACION, decisión 21). Solo primera
   * página. En modo normal lo siembra el server; en GPS llega en la respuesta de
   * la API (el server no tiene las coordenadas).
   */
  initialDestacados: SearchedPlace[]
  /**
   * Ids ya guardados de la primera página (FAVORITOS, decisión 9). Las páginas
   * siguientes traen los suyos en la respuesta de `/api/search` y se acumulan
   * acá: una query por página, nunca una por card.
   */
  initialGuardados: string[]
  /**
   * Listas visibles del usuario (FAVORITOS F2, decisión 8). No cambian entre
   * páginas, así que viajan una vez desde el server y no vuelven en `/api/search`.
   */
  listas: ListaDestino[]
  autenticado: boolean
  params: SearchParams
  coords: { lat: number; lng: number } | null
  /** Estado de 0 resultados: lo dibuja el shell, que tiene los chips a mano. */
  vacio: React.ReactNode
}

export function ResultsList({
  initialPlaces,
  initialCursor,
  initialDestacados,
  initialGuardados,
  listas,
  autenticado,
  params,
  coords,
  vacio,
}: Props) {
  const usaGps = params.gps && coords !== null
  const clave = serializeApiParams({ ...params, cursor: null }, coords)

  const [places, setPlaces] = React.useState(usaGps ? [] : initialPlaces)
  const [destacados, setDestacados] = React.useState(usaGps ? [] : initialDestacados)
  const [cursor, setCursor] = React.useState(usaGps ? null : initialCursor)
  const [cargando, setCargando] = React.useState(usaGps)
  const [agotado, setAgotado] = React.useState(!usaGps && initialCursor === null)
  // Acumulativo entre páginas: el scroll agrega ids, no los reemplaza.
  const [guardados, setGuardados] = React.useState<Set<string>>(
    () => new Set(usaGps ? [] : initialGuardados),
  )

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
          setDestacados(json.data.featured ?? [])
          setCursor(json.data.nextCursor)
          setAgotado(json.data.nextCursor === null)
          setGuardados(new Set<string>(json.data.guardados ?? []))
        })
        .catch(() => {})
        .finally(() => vigente && setCargando(false))
      return () => {
        vigente = false
      }
    }

    setPlaces(initialPlaces)
    setDestacados(initialDestacados)
    setCursor(initialCursor)
    setAgotado(initialCursor === null)
    setGuardados(new Set(initialGuardados))
    setCargando(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, initialPlaces, initialCursor, initialDestacados, initialGuardados])

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
        // Los guardados de la página nueva se suman a los que ya había: las cards
        // anteriores siguen en pantalla y su estado no puede resetearse.
        if (json.data.guardados?.length) {
          setGuardados((prev) => new Set([...prev, ...(json.data.guardados as string[])]))
        }
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

  // Dedupe (decisión 21): un destacado que también cae en el orgánico no se
  // dibuja dos veces. Se saca del orgánico en todas las páginas cargadas —más
  // estricto que el mínimo del spec (que solo exige la primera), pero evita el
  // duplicado que el spec tolera como "raro e inocuo".
  const idsDestacados = new Set(destacados.map((d) => d.id))
  const organicos = places.filter((p) => !idsDestacados.has(p.id))
  const flaco = organicos.length + destacados.length < RESULTADOS_FLACOS

  if (organicos.length === 0 && destacados.length === 0) {
    return cargando ? <Esqueleto /> : <>{vacio}</>
  }

  return (
    <section className="flex flex-col gap-3">
      {destacados.map((place) => (
        <PlaceCard
          key={`destacado-${place.id}`}
          id={place.id}
          name={place.name}
          tags={tagsDestacados(place.tags)}
          location={ubicacionDeCard(place)}
          distanceKm={place.distanceKm}
          destacado
          accion={
            <BotonGuardar
              placeId={place.id}
              guardadoInicial={guardados.has(place.id)}
              autenticado={autenticado}
              listas={listas}
            />
          }
        />
      ))}

      {organicos.map((place) => (
        <PlaceCard
          key={place.id}
          id={place.id}
          name={place.name}
          tags={tagsDestacados(place.tags)}
          location={ubicacionDeCard(place)}
          distanceKm={place.distanceKm}
          accion={
            <BotonGuardar
              placeId={place.id}
              guardadoInicial={guardados.has(place.id)}
              autenticado={autenticado}
              listas={listas}
            />
          }
        />
      ))}

      <div ref={sentinela} aria-hidden className="h-px" />

      {cargando && <p className="py-3 text-center text-sm text-muted-foreground">Buscando…</p>}
      {agotado && (
        <div className="py-3 text-center text-sm text-muted-foreground">
          <p>Eso es todo lo que tenemos por acá.</p>
          {/* Aviso de beta (DEPLOY, decisión 21). Solo con la lista agotada: si
              todavía queda scroll por delante no hay frustración que atender, y
              el renglón sería ruido. */}
          {flaco && (
            <p className="mt-1 text-xs">
              Puede haber más: los filtros finos todavía no cubren todo el catálogo.{' '}
              <Link href="/legales" className="underline underline-offset-4">
                Estamos en beta
              </Link>
              .
            </p>
          )}
        </div>
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
