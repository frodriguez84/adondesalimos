'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'

import { marcarPantalla } from '@/lib/navegacion/volver'

/**
 * Anota por qué pantalla entró la pestaña (NAVEGACION, decisión 6): es lo que
 * decide si el «Volver» de la ficha hace back o sube a la home. No pinta nada, y
 * vive en el layout raíz porque el recorrido puede empezar en cualquier pantalla
 * y el layout es lo único que no se desmonta entre navegaciones.
 *
 * Mira el **pathname**, no la URL: filtrar cambia la query y no es una pantalla
 * nueva (decisión 1). La regla en sí vive en `lib/navegacion/volver.ts`, su dueño
 * único; acá solo se la alimenta.
 */
export function MarcadorNavegacion() {
  const pathname = usePathname()

  React.useEffect(() => {
    marcarPantalla(pathname)
  }, [pathname])

  return null
}
