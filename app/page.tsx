import Link from 'next/link'
import { after } from 'next/server'
import { headers } from 'next/headers'

import { auth } from '@/lib/auth'
import { AccountMenu } from '@/components/shared/account-menu'
import { Wordmark } from '@/components/shared/wordmark'
import { RotatingHeadline } from '@/components/shared/rotating-headline'
import { SearchShell } from '@/components/search/search-shell'
import { guardadosDeLaPagina } from '@/lib/favoritos/query'
import { getFacetCatalog, getZoneCatalog } from '@/lib/search/catalog'
import { getOccasionChips } from '@/lib/search/chips'
import {
  registrarDestacados,
  registrarImpresiones,
  registrarTagsDeBusqueda,
} from '@/lib/search/impressions'
import { parseSearchParams, tieneBusqueda, type RawParams } from '@/lib/search/params'
import { buscarDestacados, searchPlaces, type SearchedPlace } from '@/lib/search/query'

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
  // El bloque de destacados va solo en la primera página (decisión 21): un deep
  // link con `cursor` es una página interior y no lo lleva.
  const mostrarDestacados = tieneBusqueda(params) && !params.cursor

  const [facetas, zonas, chips, resultado, destacados, session] = await Promise.all([
    getFacetCatalog(),
    getZoneCatalog(),
    getOccasionChips(),
    tieneBusqueda(params) ? searchPlaces(params) : null,
    mostrarDestacados ? buscarDestacados(params) : Promise.resolve<SearchedPlace[]>([]),
    auth.api.getSession({ headers: await headers() }).catch(() => null),
  ])

  // Decisión 22 + 20. Va en `after` para que el contador no meta latencia en la
  // pantalla: la respuesta sale y la escritura ocurre después.
  //
  // Impresiones = lo que el usuario efectivamente vio = orgánico servido ∪
  // destacados. Un destacado que no cae en el orgánico igual apareció; contarlo
  // como impresión mantiene el invariante `featured_impressions ≤ impressions`
  // del que sale la transparencia del panel F4 ("destacada en X de las Y
  // búsquedas donde apareció", decisión 20).
  const idsVistos = [
    ...new Set([...(resultado?.places.map((p) => p.id) ?? []), ...destacados.map((d) => d.id)]),
  ]
  if (idsVistos.length > 0) {
    after(() => registrarImpresiones(idsVistos))
    // Decisión 22b: "qué filtros te encontraron". +1 por tag activo (incluidos
    // los expandidos por chips) para cada lugar servido, en el mismo after().
    after(() => registrarTagsDeBusqueda(idsVistos, params.tags))
  }
  // Decisión 20: cada destacado servido suma +1 a `featured_impressions` (la
  // rotación y la transparencia salen del mismo contador).
  if (destacados.length > 0) {
    after(() => registrarDestacados(destacados.map((d) => d.id)))
  }

  // FAVORITOS, decisión 9: el estado "guardado" de la página en una query, no una
  // por card. Se resuelve **acá y no en el motor** (pre-vuelo P1): no es un dato
  // del lugar sino de quien mira, y `lib/search/query.ts` no se toca. Las páginas
  // siguientes del scroll las resuelve `/api/search`.
  const guardados =
    session?.user && idsVistos.length > 0
      ? await guardadosDeLaPagina(session.user.id, idsVistos)
      : []

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between gap-3">
        <Wordmark />
        <AccountMenu user={session?.user ? { name: session.user.name ?? null, email: session.user.email } : null} />
      </header>

      {/* Estado vacío = mini-landing: hero de marca (headline rotativo + frase de
          valor) que se colapsa apenas hay búsqueda. El hint funcional ("elegí
          zona") lo da el propio SearchShell, no se duplica acá. */}
      {!tieneBusqueda(params) && (
        <section className="flex flex-col gap-2 pt-2">
          <RotatingHeadline />
          <p className="text-base text-muted-foreground">
            Bares, restos, shows y birras cerca tuyo. Decidí sin dar mil vueltas.
          </p>
        </section>
      )}

      <SearchShell
        params={params}
        facetas={facetas}
        zonas={zonas}
        chips={chips}
        resultado={resultado}
        destacados={destacados}
        guardados={guardados}
        autenticado={Boolean(session?.user)}
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
