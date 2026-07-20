import Link from 'next/link'

import { PlaceCard } from '@/components/shared/place-card'
import { tagsDestacados, ubicacionDeCard } from '@/lib/search/card'
import {
  parseSearchParams,
  serializeSearchParams,
  tieneBusqueda,
  type RawParams,
} from '@/lib/search/params'
import { searchPlaces } from '@/lib/search/query'

/**
 * Home = Search (decisión 1). Server component: lee `searchParams` y consulta,
 * así una URL armada a mano ya devuelve resultados y toda búsqueda es un deep
 * link compartible (decisión 12).
 *
 * F1 renderiza la lista y los estados. Los selectores (zona, filtros,
 * sugerencias) son F2; los chips de Ocasión y el mapa, F3. Por eso todavía no
 * hay `SearchInput` ni `FilterChip` acá: sin el sheet que los respalda serían
 * controles que no hacen nada.
 */

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<RawParams>
}) {
  const params = parseSearchParams(await searchParams)
  const hayBusqueda = tieneBusqueda(params)

  // Decisión 2: primera visita = cero resultados hasta elegir zona. Sin esto la
  // home listaría los 18.993 publicados de AMBA, que es la pantalla que el
  // producto explícitamente no quiere.
  const resultado = hayBusqueda ? await searchPlaces(params) : null

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">¿A dónde salimos?</h1>
        <p className="text-sm text-muted-foreground">Decidilo rápido, sin dar mil vueltas.</p>
      </header>

      {!resultado ? (
        <Vacio
          titulo="Elegí zona para arrancar"
          detalle="Decinos por dónde andás y te tiramos la posta."
        />
      ) : resultado.places.length === 0 ? (
        // Decisión 23: nunca una pantalla muerta. Los chips activos a mano para
        // sacar llegan en F2, cuando existan como UI.
        <Vacio
          titulo="No encontramos nada con eso"
          detalle="Probá aflojando algún filtro o ampliando la zona."
        />
      ) : (
        <section className="flex flex-col gap-3">
          {resultado.places.map((place) => (
            <PlaceCard
              key={place.id}
              id={place.id}
              name={place.name}
              tags={tagsDestacados(place.tags)}
              location={ubicacionDeCard(place)}
              distanceKm={place.distanceKm}
            />
          ))}

          {resultado.nextCursor && (
            // F2 lo reemplaza por infinite scroll. Mientras tanto el cursor se
            // ejerce igual, y sin JS.
            <Link
              href={`/?${serializeSearchParams({ ...params, cursor: resultado.nextCursor })}`}
              className="rounded-lg border border-border py-3 text-center text-sm text-muted-foreground hover:text-foreground"
            >
              Ver más
            </Link>
          )}
        </section>
      )}

      <footer className="mt-auto pt-4 text-xs text-muted-foreground">
        Datos de{' '}
        <Link href="/legales" className="underline underline-offset-4">
          Overture Maps y Google
        </Link>
      </footer>
    </main>
  )
}

function Vacio({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-6 text-center">
      <p className="text-sm font-medium text-foreground">{titulo}</p>
      <p className="mt-1 text-sm text-muted-foreground">{detalle}</p>
    </div>
  )
}
