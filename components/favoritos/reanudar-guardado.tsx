'use client'

import * as React from 'react'
import { usePathname, useRouter } from 'next/navigation'

import { useAviso } from '@/components/ui/aviso'
import {
  PARAM_PENDIENTE,
  dejarPendiente,
  leerPendiente,
  limpiarPendiente,
} from '@/lib/favoritos/pendiente'

/**
 * Retoma el guardado que quedó pendiente del otro lado del login
 * (PULIDO_BETA, PBETA-R3-03). No pinta nada: vive en el layout raíz porque el
 * `callbackUrl` puede devolver al usuario a cualquier pantalla con cards (la
 * home, la ficha, el chat, lo guardado) y el arreglo no puede depender de que
 * la card del lugar siga montada — con scroll infinito, muchas veces no lo está.
 *
 * No lee la sesión: el 401 es la señal de "todavía no se logueó" y en ese caso
 * el pendiente **no se consume**, así sobrevive hasta el aterrizaje con cookie.
 *
 * **Dos fuentes, y no se tratan igual** (`PBETA-R3-07`):
 * - `sessionStorage`: lo dejó esta misma pestaña, o sea que hubo un toque real en
 *   "Guardar" hace un rato. Se guarda solo.
 * - `?guardar=<id>` en la URL: llega del link del mail de verificación, y una URL
 *   la puede armar cualquiera. **Se pide un toque** antes de escribir nada. Ese
 *   toque es lo que hace que un link ajeno no pueda guardarle un lugar a nadie,
 *   que era el motivo original de no usar la URL.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function ReanudarGuardado() {
  const router = useRouter()
  const pathname = usePathname()
  const mostrarAviso = useAviso()
  const enVuelo = React.useRef(false)

  /**
   * El POST en sí. `pedido` = vino de un toque en el aviso (el de la URL): solo en
   * ese caso se cuentan los finales feos. El pendiente de `sessionStorage` se
   * retoma en silencio como siempre — el usuario no está esperando ese request y
   * un cartel de error en el aterrizaje sería ruido sin acción posible.
   */
  const guardar = React.useCallback(
    (placeId: string, pedido: boolean) => {
      if (enVuelo.current) return
      enVuelo.current = true
      fetch('/api/favoritos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeId }),
      })
        .then((res) => {
          if (res.status === 401) {
            // Sin sesión no se consume: así el pendiente sobrevive al login.
            if (pedido) {
              dejarPendiente(placeId)
              mostrarAviso({
                texto: 'Entrá y lo guardamos',
                accion: { texto: 'Entrar', href: '/login?motivo=guardar' },
                persistente: true,
              })
            }
            return
          }
          limpiarPendiente()
          if (!res.ok) {
            if (pedido) mostrarAviso({ texto: 'No pudimos guardarlo. Probá de nuevo.' })
            return
          }
          // Este sí se avisa siempre: el que vuelve del login pagó el peaje de
          // crear una cuenta y merece ver que la app cumplió, y de paso se entera
          // de dónde vive lo guardado (PBETA-R3-04).
          mostrarAviso({
            texto: 'Guardado en Mis lugares',
            accion: { texto: 'Ver', href: '/mis-lugares' },
          })
          // El marcador de la card lo pinta el server: hay que volver a pedirlo.
          router.refresh()
        })
        .catch(() => {})
        .finally(() => {
          enVuelo.current = false
        })
    },
    [mostrarAviso, router],
  )

  React.useEffect(() => {
    // El muro en sí (login/registro) se saltea: ahí nunca hay sesión todavía y
    // el request sería ruido garantizado.
    if (pathname === '/login' || pathname === '/registro') return

    // 1) El que volvió por el link del mail. Se lee de `window` y no con
    //    `useSearchParams` para no arrastrar a todas las páginas al Suspense que
    //    ese hook exige desde el layout raíz.
    const params = new URLSearchParams(window.location.search)
    const desdeUrl = params.get(PARAM_PENDIENTE)
    if (desdeUrl) {
      // Se saca de la URL pase lo que pase: que un refresh no vuelva a proponerlo
      // y que el link que el usuario comparta no lleve el lugar colgado.
      params.delete(PARAM_PENDIENTE)
      const query = params.toString()
      router.replace(`${pathname}${query ? `?${query}` : ''}`)
      if (UUID.test(desdeUrl)) {
        mostrarAviso({
          texto: 'Te faltaba guardar un lugar',
          accion: { texto: 'Guardar', alTocar: () => guardar(desdeUrl, true) },
          persistente: true,
        })
      }
      return
    }

    // 2) El de siempre: lo dejó esta pestaña al tocar "Guardar" (PBETA-R3-03).
    const placeId = leerPendiente()
    if (!placeId) return
    guardar(placeId, false)
  }, [guardar, mostrarAviso, pathname, router])

  return null
}
