import { PlaceCard } from '@/components/shared/place-card'
import { tagsDestacados, ubicacionDeCard } from '@/lib/search/card'
import type { SearchedPlace } from '@/lib/search/query'

/**
 * El cuerpo de una página de `/salir`: los lugares, con la **misma** card del
 * listado (SEO, § Reuso).
 *
 * ⚠️ **Sin botón de guardar, y no es un olvido.** El slot `accion` de `PlaceCard`
 * lo llena `BotonGuardar`, que necesita saber quién mira — o sea `headers()`, o sea
 * **render dinámico**. Estas páginas son estáticas con ISR diaria (decisión 5)
 * porque el que más les pega es el crawler y en Vercel Hobby cada request dinámica
 * es una invocación de función: meter acá una lectura de sesión convertiría 301
 * landings en 301 funciones y tiraría abajo el motivo entero de la decisión. El
 * usuario que quiera guardar entra a la ficha, que sí es dinámica.
 *
 * Server component puro: lo que ve el crawler es esto, sin JavaScript de por medio.
 */
export function ListaLugares({ lugares }: { lugares: SearchedPlace[] }) {
  if (lugares.length === 0) return null

  return (
    <ul className="flex flex-col gap-3">
      {lugares.map((lugar) => (
        <li key={lugar.id}>
          <PlaceCard
            id={lugar.id}
            name={lugar.name}
            tags={tagsDestacados(lugar.tags)}
            location={ubicacionDeCard(lugar)}
          />
        </li>
      ))}
    </ul>
  )
}
