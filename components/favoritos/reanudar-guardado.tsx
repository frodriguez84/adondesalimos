'use client'

import * as React from 'react'
import { usePathname, useRouter } from 'next/navigation'

import { leerPendiente, limpiarPendiente } from '@/lib/favoritos/pendiente'

/**
 * Retoma el guardado que quedó pendiente del otro lado del login
 * (PULIDO_BETA, PBETA-R3-03). No pinta nada: vive en el layout raíz porque el
 * `callbackUrl` puede devolver al usuario a cualquier pantalla con cards (la
 * home, la ficha, el chat, lo guardado) y el arreglo no puede depender de que
 * la card del lugar siga montada — con scroll infinito, muchas veces no lo está.
 *
 * No lee la sesión: el 401 es la señal de "todavía no se logueó" y en ese caso
 * el pendiente **no se consume**, así sobrevive hasta el aterrizaje con cookie.
 */
export function ReanudarGuardado() {
  const router = useRouter()
  const pathname = usePathname()
  const enVuelo = React.useRef(false)

  React.useEffect(() => {
    // El muro en sí (login/registro) se saltea: ahí nunca hay sesión todavía y
    // el request sería ruido garantizado.
    if (pathname === '/login' || pathname === '/registro') return
    const placeId = leerPendiente()
    if (!placeId || enVuelo.current) return

    enVuelo.current = true
    fetch('/api/favoritos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placeId }),
    })
      .then((res) => {
        if (res.status === 401) return
        limpiarPendiente()
        // El marcador de la card lo pinta el server: hay que volver a pedirlo.
        if (res.ok) router.refresh()
      })
      .catch(() => {})
      .finally(() => {
        enVuelo.current = false
      })
  }, [pathname, router])

  return null
}
