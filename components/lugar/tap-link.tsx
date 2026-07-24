'use client'

import * as React from 'react'

import { type TapKind } from '@/lib/lugar/tap-kinds'

/**
 * Un `<a>` de la ficha que, al tocarse, dispara un beacon de tap
 * (MONETIZACION, decisión 22a) antes de seguir su curso normal (abrir `tel:`,
 * el mapa, el sitio…). La navegación NO espera al beacon: `sendBeacon` está
 * pensado justo para esto —mandar un dato mientras la página se va— y si el
 * browser no lo tiene, cae a un `fetch` con `keepalive`.
 *
 * Best-effort de punta a punta: cualquier fallo se traga en silencio. Un tap que
 * no se registra no puede romper el link que lo generó — el usuario tiene que
 * llegar a llamar por teléfono aunque la métrica se pierda.
 */
function registrarTapBeacon(placeId: string, kind: TapKind) {
  try {
    const url = `/api/lugar/${placeId}/tap`
    const body = JSON.stringify({ kind })
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))
      return
    }
    void fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {})
  } catch {
    // Best-effort: la métrica no vale una excepción en la navegación.
  }
}

type TapLinkProps = React.ComponentPropsWithoutRef<'a'> & {
  placeId: string
  kind: TapKind
}

export function TapLink({ placeId, kind, onClick, children, ...props }: TapLinkProps) {
  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    registrarTapBeacon(placeId, kind)
    onClick?.(e)
  }

  return (
    <a onClick={handleClick} {...props}>
      {children}
    </a>
  )
}
