import Link from 'next/link'

import type { Miga } from '@/lib/seo/jsonld'
import { cn } from '@/lib/utils'

/**
 * Breadcrumb visible `Inicio › <Zona> › <Tipo>` (SEO, decisión 13).
 *
 * Lo usan la ficha y las dos páginas de `/salir`, y **recibe la misma lista de
 * migas que `breadcrumbJsonLd`**: si el visible y el estructurado se arman por
 * separado terminan diciendo cosas distintas, que es structured data engañoso.
 *
 * Un escalón con `path: null` se muestra como texto —el actual no se linkea a sí
 * mismo, y en la ficha el Tipo puede no tener página propia—. `flex-wrap` porque
 * en 390 px «Inicio › Villa Devoto y Villa del Parque › Patios gastronómicos»
 * no entra en un renglón y una miga no puede empujar la pantalla.
 */
export function Breadcrumb({ migas, className }: { migas: Miga[]; className?: string }) {
  if (migas.length === 0) return null

  return (
    <nav aria-label="Ruta de navegación" className={cn('text-xs', className)}>
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-muted-foreground">
        {migas.map((miga, i) => {
          const ultima = i === migas.length - 1
          return (
            <li key={`${miga.name}-${i}`} className="flex items-center gap-x-1.5">
              {i > 0 && (
                <span aria-hidden className="text-muted-foreground/60">
                  ›
                </span>
              )}
              {miga.path && !ultima ? (
                <Link href={miga.path} className="underline underline-offset-4 hover:text-primary">
                  {miga.name}
                </Link>
              ) : (
                <span aria-current={ultima ? 'page' : undefined} className="text-foreground">
                  {miga.name}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
