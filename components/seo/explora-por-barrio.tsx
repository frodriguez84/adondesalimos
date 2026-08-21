import Link from 'next/link'
import { ChevronDown } from 'lucide-react'

import { urlDeZona } from '@/lib/seo/paginas'
import { REGION_LABELS, REGION_ORDER, ZONAS, ZONAS_POR_REGION } from '@/lib/zones/canon'

/**
 * «Explorá por barrio»: los 46 links a `/salir/<zona>` (SEO, decisión 12).
 *
 * **Es la puerta de entrada del crawler al eje nuevo, y no hay otra.** El sheet de
 * zona del buscador (`components/search/zone-sheet.tsx`) es `'use client'` y todo
 * adentro son `<button onClick>`: **cero `<a href>`**. Verificado sobre el HTML
 * servido de la home — links a una URL de zona antes de esto: 0. O sea que sin este
 * bloque las 301 páginas quedan **huérfanas** y lo único que las anuncia es el
 * sitemap, que es una *sugerencia*. Los links internos son el voto.
 *
 * No es un injerto de SEO en la UI: la decisión 2 de BUSQUEDA ya dice que la primera
 * visita no muestra resultados **hasta elegir zona**, y una lista de barrios
 * navegable *es* esa pantalla — hecha con `<a>` en vez de con un sheet. Las dos cosas
 * conviven porque hacen cosas distintas: el sheet **filtra** (escribe `?z=…` y se
 * queda en la home), esto **navega** a una página que existe.
 *
 * ⚠️ **Plegado con `<details>` nativo, no con estado de React** (pedido de Fer,
 * 2026-08-21: desplegado medía 668 px y comía tres cuartos de pantalla en 390 px).
 * Nativo importa: los 46 `<a>` están en el HTML servido igual, plegados o no, así que
 * el crawler los sigue sin ejecutar nada — y el componente sigue sin ser `'use
 * client'`, que es lo que mantiene a la home fuera del bundle. **Reemplazarlo por un
 * `useState` rompería las dos mitades a la vez.**
 *
 * Solo en el estado vacío de la home: con búsqueda activa la pantalla es otra cosa.
 * Lee el canon, no la base — no le agrega ni una query a la pantalla más vista.
 */
export function ExploraPorBarrio() {
  return (
    <section className="flex flex-col gap-1">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Explorá por barrio
      </h2>

      {REGION_ORDER.map((region) => (
        <details key={region} className="group border-b border-border/60 last:border-b-0">
          {/* `list-none` + el marker de webkit ocultos: el triangulito del browser no
              se puede estilar y desentona. El chevron lo ponemos nosotros. */}
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm text-foreground transition-colors hover:text-primary [&::-webkit-details-marker]:hidden">
            <span>
              {REGION_LABELS[region]}{' '}
              <span className="text-xs text-muted-foreground">{ZONAS_POR_REGION[region]}</span>
            </span>
            <ChevronDown
              aria-hidden
              className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
            />
          </summary>

          <ul className="flex flex-wrap gap-x-3 gap-y-2 pb-3 pt-1">
            {ZONAS.filter((z) => z.region === region).map((z) => (
              <li key={z.slug}>
                <Link
                  href={urlDeZona(z.slug)}
                  className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
                >
                  {z.name}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </section>
  )
}
