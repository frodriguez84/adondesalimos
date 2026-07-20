'use client'

import * as React from 'react'

import { serializeApiParams, tieneBusqueda, type SearchParams } from '@/lib/search/params'

/**
 * Conteo en vivo para el botón "Ver N lugares" de los sheets (decisión 20).
 *
 * Debounce corto: el usuario toca varios chips seguidos y no tiene sentido
 * contar por cada toque. `AbortController` descarta las respuestas viejas — sin
 * eso, una consulta lenta puede llegar después de una rápida y pisar el número
 * con un valor que ya no corresponde a lo seleccionado.
 *
 * `null` = todavía no sabemos (el botón muestra "Ver lugares" sin número, no un
 * "0" transitorio que asusta).
 */

const DEBOUNCE_MS = 250

export function useCount(
  params: SearchParams,
  coords: { lat: number; lng: number } | null,
  activo: boolean,
): number | null {
  const [count, setCount] = React.useState<number | null>(null)
  // El cursor no cambia cuántos hay: incluirlo dispararía recuentos de gusto.
  const clave = serializeApiParams({ ...params, cursor: null }, coords)

  React.useEffect(() => {
    if (!activo) return
    if (!tieneBusqueda({ ...params, coords })) {
      setCount(0)
      return
    }

    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/count?${clave}`, { signal: ctrl.signal })
        const json = await res.json()
        if (json.data) setCount(json.data.count)
      } catch {
        // Abortada o red caída: el botón se queda con el número anterior. No es
        // un error que valga interrumpirle la sesión al usuario.
      }
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
    // `clave` resume params + coords; `params` entero cambiaría de identidad en
    // cada render y volvería a contar sin que haya cambiado nada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, activo])

  return count
}
