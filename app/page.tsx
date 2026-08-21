import type { Metadata } from 'next'
import Link from 'next/link'
import { after } from 'next/server'
import { headers } from 'next/headers'

import { auth } from '@/lib/auth'
import { AccountMenu } from '@/components/shared/account-menu'
import { BrandHeader } from '@/components/shared/brand-header'
import { RotatingHeadline } from '@/components/shared/rotating-headline'
import { SearchShell } from '@/components/search/search-shell'
import { estadoDeFavoritos, type ListaDestino } from '@/lib/favoritos/query'
import { getFacetCatalog, getZoneCatalog } from '@/lib/search/catalog'
import { getOccasionChips } from '@/lib/search/chips'
import {
  registrarDestacados,
  registrarImpresiones,
  registrarTagsDeBusqueda,
} from '@/lib/search/impressions'
import { parseSearchParams, tieneBusqueda, type RawParams } from '@/lib/search/params'
import {
  buscarDestacados,
  countPlaces,
  searchPlaces,
  type SearchedPlace,
} from '@/lib/search/query'
import { ROBOTS_RESULTADOS } from '@/lib/seo/robots'

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

/**
 * Ninguna pantalla de resultados se indexa (SEO, decisión 10). Motivo: `/?z=…&t=…`
 * es la versión no-canónica de `/salir/<zona>/<tipo>` y las dos muestran lo mismo
 * — canibalización directa. **`follow` sí**: los links internos se siguen recorriendo.
 *
 * La home **pelada** sí se indexa: sin búsqueda no declara `robots` y hereda el layout.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<RawParams>
}): Promise<Metadata> {
  const params = parseSearchParams(await searchParams)
  if (!tieneBusqueda(params)) return {}
  return { robots: ROBOTS_RESULTADOS }
}

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

  const [facetas, zonas, chips, resultado, total, destacados, session] = await Promise.all([
    getFacetCatalog(),
    getZoneCatalog(),
    // Los chips se cuentan **en el contexto de la búsqueda**: la zona elegida
    // acota el conteo y `params.tags` dice cuál está pintado (exento del gate,
    // para no llevarse el toggle al cambiar de zona). Es el único caller, y la
    // home ya se re-renderiza en cada navegación —elegir zona *es* una
    // navegación—, así que el recuento no agrega nada.
    getOccasionChips(new Date(), params.zones, params.tags),
    tieneBusqueda(params) ? searchPlaces(params) : null,
    // PBETA-R1-04: el conteo dejó de vivir solo en el botón del sheet y ahora
    // encabeza el listado. Una query más, en el mismo `Promise.all` — el
    // `count(*)` corre en paralelo con la página, no en serie después.
    // En GPS el server no puede contar (no tiene las coordenadas): lo cuenta el
    // cliente con el mismo `useCount` de los sheets.
    tieneBusqueda(params) ? countPlaces(params) : null,
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
  //
  // F2: la misma consulta trae las listas visibles, que el botón necesita para el
  // sheet de destino (decisión 8). Van juntas porque salen de la misma resolución.
  const { guardados, listas } =
    session?.user && idsVistos.length > 0
      ? await estadoDeFavoritos(session.user.id, idsVistos)
      : { guardados: [] as string[], listas: [] as ListaDestino[] }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between gap-3">
        <BrandHeader />
        <AccountMenu user={session?.user ? { name: session.user.name ?? null, email: session.user.email } : null} />
      </header>

      {/* Estado vacío = mini-landing: hero de marca (headline rotativo + frase de
          valor) que se colapsa apenas hay búsqueda. El hint funcional ("elegí
          zona") lo da el propio SearchShell, no se duplica acá.

          HOME_ENTRADAS (decisiones 1 a 3): las dos puertas que la home escondía
          —votación y chat IA— viven **acá adentro**, así con búsqueda activa la
          pantalla de trabajo no cambia ni un píxel. Son texto, no tarjetas, y
          cada una ocupa un renglón entero porque es la forma de llegar a los
          44 px de toque sin inventar un componente (decisión 3). Solo estas dos
          (decisión 2): "Mis lugares" y "Registrá tu negocio" siguen en el menú. */}
      {!tieneBusqueda(params) && (
        <section className="flex flex-col gap-2 pt-2">
          <RotatingHeadline />
          <p className="text-base text-muted-foreground">
            Bares, restos, shows y birras cerca tuyo. Decidí sin dar mil vueltas.
          </p>
          <nav className="mt-1 flex flex-col">
            <Link
              href="/votacion/nueva"
              className="flex min-h-11 items-center justify-between gap-3 rounded-lg py-2 text-sm text-foreground transition-colors hover:text-primary"
            >
              <span>
                <span className="text-muted-foreground">¿Van varios?</span> Armá una votación y que
                elija el grupo
              </span>
              <span aria-hidden className="shrink-0 text-muted-foreground">
                →
              </span>
            </Link>
            <Link
              href="/chat"
              className="flex min-h-11 items-center justify-between gap-3 rounded-lg py-2 text-sm text-foreground transition-colors hover:text-primary"
            >
              <span>
                <span className="text-muted-foreground">¿No sabés qué pinta?</span> Contale a la IA
              </span>
              <span aria-hidden className="shrink-0 text-muted-foreground">
                →
              </span>
            </Link>
          </nav>
        </section>
      )}

      <SearchShell
        params={params}
        facetas={facetas}
        zonas={zonas}
        chips={chips}
        resultado={resultado}
        total={total}
        destacados={destacados}
        guardados={guardados}
        listas={listas}
        autenticado={Boolean(session?.user)}
      />

      {/* El rótulo del aviso de beta (DEPLOY, decisión 21) va acá, y la atribución
          se queda: linkear las fuentes es condición de la licencia, no decoración. */}
      <footer className="mt-auto flex flex-wrap items-center gap-x-2 pt-4 text-xs text-muted-foreground">
        <Link href="/legales" className="font-medium underline underline-offset-4">
          Estamos en beta
        </Link>
        <span aria-hidden>·</span>
        <span>
          Datos de{' '}
          <Link href="/legales" className="underline underline-offset-4">
            Overture Maps y Google
          </Link>
        </span>
      </footer>
    </main>
  )
}
