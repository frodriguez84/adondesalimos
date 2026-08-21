import type { Metadata, ResolvingMetadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Breadcrumb } from '@/components/shared/breadcrumb'
import { EnlacesSeo, type EnlaceSeo } from '@/components/seo/enlaces'
import { ListaLugares } from '@/components/seo/lista-lugares'
import { EMPTY_SEARCH, serializeSearchParams } from '@/lib/search/params'
import { countPlaces, searchPlaces } from '@/lib/search/query'
import { contarLugares, resumirBusqueda } from '@/lib/search/resumen'
import { breadcrumbJsonLd, itemListJsonLd, serializarJsonLd, type Miga } from '@/lib/seo/jsonld'
import { paginasDeZonaTipo, urlDeZona, urlDeZonaTipo } from '@/lib/seo/paginas'
import {
  bajadaDeZonaTipo,
  descripcionDeZonaTipo,
  h1DeZonaTipo,
  numero,
  pluralDeTipo,
  titleDeZonaTipo,
} from '@/lib/seo/textos'
import { REGION_LABELS, ZONAS } from '@/lib/zones/canon'

/**
 * La landing que rinde: `/salir/palermo-soho/bar` (SEO, F2 punto 8).
 *
 * Es la página que responde a lo que la gente busca de verdad —«bares en
 * Palermo»—, y la razón entera del spec: hasta acá esa URL no existía y no había
 * dónde rankear.
 *
 * ⚠️ **Un combo por debajo del piso da 404, no una página vacía ni un redirect**
 * (decisión 5). Un soft-404 —una página que responde 200 diciendo "no hay nada"—
 * es peor que un 404 para Google: la indexa y la usa para juzgar el sitio.
 *
 * Ver el encabezado de `../page.tsx` por qué es estática y qué la rompería.
 */
export const revalidate = 86400
export const dynamicParams = false

/**
 * Los ~255 combos, de `paginasDeZonaTipo()` **sin argumento** — la misma llamada
 * que hace `app/sitemap.ts` (decisión 5). Es lo que garantiza que el sitemap no
 * prometa una URL que da 404: si divergieran, nadie se enteraría hasta verlo en
 * Search Console.
 */
export async function generateStaticParams() {
  const paginas = await paginasDeZonaTipo()
  return paginas.map((p) => ({ zona: p.zona, tipo: p.tipo }))
}

type Params = { params: Promise<{ zona: string; tipo: string }> }

/** Región de cada zona, para "lo mismo en los barrios de al lado". */
const REGION_DE = new Map(ZONAS.map((z) => [z.slug, z.region]))

/** ⚠️ `openGraph` acá pisa el del padre entero: la imagen se hereda, no se escribe. */
export async function generateMetadata(
  { params }: Params,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const { zona, tipo } = await params
  const canon = ZONAS.find((z) => z.slug === zona)
  if (!canon) return {}

  const total = await countPlaces({ ...EMPTY_SEARCH, zones: [zona], tags: [tipo] })
  const descripcion = descripcionDeZonaTipo(total, tipo, canon.name)

  return {
    title: titleDeZonaTipo(tipo, canon.name),
    description: descripcion,
    alternates: { canonical: urlDeZonaTipo(zona, tipo) },
    openGraph: {
      title: h1DeZonaTipo(tipo, canon.name),
      description: descripcion,
      images: (await parent).openGraph?.images,
    },
  }
}

export default async function ZonaTipoPage({ params }: Params) {
  const { zona, tipo } = await params
  const canon = ZONAS.find((z) => z.slug === zona)
  if (!canon) notFound()

  const [enLaZona, delTipo] = await Promise.all([
    paginasDeZonaTipo({ zona }),
    paginasDeZonaTipo({ tipo }),
  ])

  // `dynamicParams = false` ya devuelve 404 para un combo que no existe, pero el
  // chequeo va igual: en dev la ruta se renderiza igual, y este es el que hace que
  // SEO-13 se pueda verificar en vivo contra el server de Fer y no solo en el build.
  if (!enLaZona.some((p) => p.tipo === tipo)) notFound()

  const [resultado, total] = await Promise.all([
    searchPlaces({ ...EMPTY_SEARCH, zones: [zona], tags: [tipo] }),
    countPlaces({ ...EMPTY_SEARCH, zones: [zona], tags: [tipo] }),
  ])

  const migas: Miga[] = [
    { name: 'Inicio', path: '/' },
    { name: canon.name, path: urlDeZona(zona) },
    { name: pluralDeTipo(tipo), path: null },
  ]

  // La aclaración del buffer de 400 m sale de `resumirBusqueda`, su dueño único
  // (`PBETA-R1-03`): la página lista lugares de la zona de al lado y decirlo es
  // exactamente lo que faltaba en la búsqueda. El `titulo` no se usa acá —la
  // bajada de la landing es otra— pero la frase no se reescribe.
  const { aclaracion } = resumirBusqueda({ total, zonas: [canon.name], gps: false })

  // Los otros tipos del mismo barrio.
  const otrosTipos: EnlaceSeo[] = enLaZona
    .filter((p) => p.tipo !== tipo)
    .map((p) => ({
      href: urlDeZonaTipo(p.zona, p.tipo),
      label: pluralDeTipo(p.tipo),
      detalle: numero(p.total),
    }))

  // Lo mismo en otros barrios. Se prefieren los de la región —es lo que quiere
  // decir "al lado"— y si no hay ninguno se completa con el resto: la decisión 13
  // pide que la página linkee hermanas, y una landing sin salida es un callejón.
  const otrasZonas = delTipo.filter((p) => p.zona !== zona)
  const mismaRegion = otrasZonas.filter((p) => REGION_DE.get(p.zona) === canon.region)
  const vecinas: EnlaceSeo[] = (mismaRegion.length > 0 ? mismaRegion : otrasZonas.slice(0, 8)).map(
    (p) => ({
      href: urlDeZonaTipo(p.zona, p.tipo),
      label: ZONAS.find((z) => z.slug === p.zona)?.name ?? p.zona,
      detalle: numero(p.total),
    }),
  )

  const busqueda = `/?${serializeSearchParams({ ...EMPTY_SEARCH, zones: [zona], tags: [tipo] })}`
  const donde = mismaRegion.length > 0 ? REGION_LABELS[canon.region] : 'otros barrios'

  return (
    <>
      {/* Solo datos propios, y serializado con `serializarJsonLd` (ver el hub). */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializarJsonLd(breadcrumbJsonLd(migas)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializarJsonLd(itemListJsonLd(resultado.places)) }}
      />

      <Breadcrumb migas={migas} />

      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold leading-tight text-foreground">
          {h1DeZonaTipo(tipo, canon.name)}
        </h1>
        <p className="text-sm text-muted-foreground">{bajadaDeZonaTipo(total, tipo, canon.name)}</p>
        {/* La misma aclaración que el listado de búsqueda (`PBETA-R1-03`): con una
            zona puesta aparecen cards de la de al lado porque el filtro usa el
            polígono expandido 400 m (ZONAS, decisión 5). Sale de `resumirBusqueda`,
            que es su dueño — no se reescribe la frase acá. */}
        {aclaracion && <p className="text-xs text-muted-foreground/80">{aclaracion}</p>}
      </header>

      <ListaLugares lugares={resultado.places} />

      <Link
        href={busqueda}
        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium text-foreground transition-colors hover:border-muted-foreground/50 hover:text-primary"
      >
        Ver {contarLugares(total)} y filtrar
      </Link>

      <EnlacesSeo titulo={`Otra cosa en ${canon.name}`} enlaces={otrosTipos} />
      <EnlacesSeo
        titulo={`${pluralDeTipo(tipo)} en ${donde}`}
        enlaces={vecinas}
      />
    </>
  )
}
