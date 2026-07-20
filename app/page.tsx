import Link from 'next/link'

import { SearchShell } from '@/components/search/search-shell'
import { getFacetCatalog, getZoneCatalog } from '@/lib/search/catalog'
import { parseSearchParams, tieneBusqueda, type RawParams } from '@/lib/search/params'
import { searchPlaces } from '@/lib/search/query'

/**
 * Home = Search (decisión 1). Server component: lee `searchParams` y consulta,
 * así una URL armada a mano ya devuelve resultados y toda búsqueda es un deep
 * link compartible (decisión 12).
 *
 * F2 movió la interacción a `SearchShell`, que arma los params y los escribe en
 * la URL. Esto sigue siendo el único lugar que toca la base en el primer render:
 * el cliente no consulta salvo para paginar, contar y el modo GPS —los tres
 * casos donde el server no puede (ver `ResultsList`).
 *
 * Falta F3: chips de Ocasión, vista mapa y logging de impresiones.
 */

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<RawParams>
}) {
  const params = parseSearchParams(await searchParams)

  // Decisión 2: primera visita = cero resultados hasta elegir zona. Sin esto la
  // home listaría los 18.993 publicados de AMBA, que es la pantalla que el
  // producto explícitamente no quiere.
  //
  // Los catálogos van siempre: los sheets tienen que poder abrirse y ofrecer
  // zonas aunque todavía no haya búsqueda — es justamente la primera visita.
  const [facetas, zonas, resultado] = await Promise.all([
    getFacetCatalog(),
    getZoneCatalog(),
    tieneBusqueda(params) ? searchPlaces(params) : null,
  ])

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">¿A dónde salimos?</h1>
        <p className="text-sm text-muted-foreground">Decidilo rápido, sin dar mil vueltas.</p>
      </header>

      <SearchShell params={params} facetas={facetas} zonas={zonas} resultado={resultado} />

      <footer className="mt-auto pt-4 text-xs text-muted-foreground">
        Datos de{' '}
        <Link href="/legales" className="underline underline-offset-4">
          Overture Maps y Google
        </Link>
      </footer>
    </main>
  )
}
