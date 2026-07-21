import Link from 'next/link'
import { after } from 'next/server'
import { headers } from 'next/headers'

import { auth } from '@/lib/auth'
import { AccountMenu } from '@/components/shared/account-menu'
import { SearchShell } from '@/components/search/search-shell'
import { getFacetCatalog, getZoneCatalog } from '@/lib/search/catalog'
import { getOccasionChips } from '@/lib/search/chips'
import { registrarImpresiones } from '@/lib/search/impressions'
import { parseSearchParams, tieneBusqueda, type RawParams } from '@/lib/search/params'
import { searchPlaces } from '@/lib/search/query'

/**
 * Home = Search (decisión 1). Server component: lee `searchParams` y consulta,
 * así una URL armada a mano ya devuelve resultados y toda búsqueda es un deep
 * link compartible (decisión 12).
 *
 * F2 movió la interacción a `SearchShell`, que arma los params y los escribe en
 * la URL. Esto sigue siendo el único lugar que toca la base en el primer render:
 * el cliente no consulta salvo para paginar, contar, mapear y el modo GPS —los
 * casos donde el server no puede (ver `ResultsList` y `MapView`).
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
  const [facetas, zonas, chips, resultado, session] = await Promise.all([
    getFacetCatalog(),
    getZoneCatalog(),
    getOccasionChips(),
    tieneBusqueda(params) ? searchPlaces(params) : null,
    auth.api.getSession({ headers: await headers() }).catch(() => null),
  ])

  // Decisión 22. Va en `after` para que el contador no meta latencia en la
  // pantalla: la respuesta sale y la escritura ocurre después. Solo los lugares
  // de esta página — los que el usuario efectivamente vio.
  if (resultado && resultado.places.length > 0) {
    after(() => registrarImpresiones(resultado.places.map((p) => p.id)))
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 px-4 py-8">
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">¿A dónde salimos?</h1>
          <p className="text-sm text-muted-foreground">Decidilo rápido, sin dar mil vueltas.</p>
        </div>
        <AccountMenu user={session?.user ? { name: session.user.name ?? null, email: session.user.email } : null} />
      </header>

      <SearchShell
        params={params}
        facetas={facetas}
        zonas={zonas}
        chips={chips}
        resultado={resultado}
      />

      <footer className="mt-auto pt-4 text-xs text-muted-foreground">
        Datos de{' '}
        <Link href="/legales" className="underline underline-offset-4">
          Overture Maps y Google
        </Link>
      </footer>
    </main>
  )
}
