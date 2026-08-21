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
  bajadaDeZona,
  descripcionDeZona,
  h1DeZona,
  numero,
  pluralDeTipo,
  titleDeZona,
} from '@/lib/seo/textos'
import { REGION_LABELS, ZONAS } from '@/lib/zones/canon'

/**
 * Hub de una zona: `/salir/palermo-soho` (SEO, F2 punto 7).
 *
 * **Estática con ISR diaria** (decisión 5). Los dos motivos, porque los dos se
 * pierden apenas alguien agregue una lectura de sesión o de cookies acá: (a) al
 * que más le pega a esta ruta es el crawler, y en Vercel Hobby cada request
 * dinámica es una invocación de función —una landing SEO que gasta cuota cada vez
 * que Google la visita es un autogol—; (b) con `dynamicParams = false` la lista de
 * páginas que existen y la del sitemap salen de la misma llamada, así que no pueden
 * divergir.
 *
 * ⚠️ Las 46 van **sin piso** (decisión 4): la zona más flaca tiene 181 lugares
 * publicados, así que no hace falta un gate para algo que ninguna zona puede
 * incumplir. El piso es cosa del combo zona × tipo.
 */
export const revalidate = 86400
export const dynamicParams = false

/** Las 46 del canon, que es la fuente de verdad de qué zonas existen. */
export function generateStaticParams() {
  return ZONAS.map((z) => ({ zona: z.slug }))
}

type Params = { params: Promise<{ zona: string }> }

/**
 * ⚠️ **Declarar `openGraph` acá pisa el del padre entero, imagen incluida** — es
 * el mismo comentario de `app/lugar/[id]/page.tsx`. La imagen se **hereda** del
 * padre en vez de escribir la ruta a mano, así `app/og/route.tsx` sigue siendo el
 * único archivo que la define.
 */
export async function generateMetadata(
  { params }: Params,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const { zona } = await params
  const canon = ZONAS.find((z) => z.slug === zona)
  if (!canon) return {}

  const [total, paginas] = await Promise.all([
    countPlaces({ ...EMPTY_SEARCH, zones: [zona] }),
    paginasDeZonaTipo({ zona }),
  ])

  const descripcion = descripcionDeZona(
    total,
    canon.name,
    paginas.map((p) => p.tipo),
  )

  return {
    title: titleDeZona(canon.name),
    description: descripcion,
    // Relativo: se resuelve contra el `metadataBase` del layout, que sale de
    // `lib/app-url.ts`. Así el canonical apunta al dominio real sin repetirlo.
    alternates: { canonical: urlDeZona(zona) },
    openGraph: {
      title: h1DeZona(canon.name),
      description: descripcion,
      images: (await parent).openGraph?.images,
    },
  }
}

export default async function ZonaPage({ params }: Params) {
  const { zona } = await params
  const canon = ZONAS.find((z) => z.slug === zona)
  if (!canon) notFound()

  const [resultado, total, paginas] = await Promise.all([
    // § Reuso: el cuerpo sale del motor tal cual, así el orden es el de
    // ORDEN_ORGANICO por construcción y no hay una segunda regla que mantener.
    searchPlaces({ ...EMPTY_SEARCH, zones: [zona] }),
    countPlaces({ ...EMPTY_SEARCH, zones: [zona] }),
    paginasDeZonaTipo({ zona }),
  ])

  const migas: Miga[] = [
    { name: 'Inicio', path: '/' },
    { name: canon.name, path: null },
  ]

  // La aclaración del buffer de 400 m sale de `resumirBusqueda`, su dueño único
  // (`PBETA-R1-03`): la página lista lugares de la zona de al lado y decirlo es
  // exactamente lo que faltaba en la búsqueda. El `titulo` no se usa acá —la
  // bajada de la landing es otra— pero la frase no se reescribe.
  const { aclaracion } = resumirBusqueda({ total, zonas: [canon.name], gps: false })

  // Los tipos que tienen página propia en esta zona, con su conteo real.
  const tipos: EnlaceSeo[] = paginas.map((p) => ({
    href: urlDeZonaTipo(p.zona, p.tipo),
    label: pluralDeTipo(p.tipo),
    detalle: numero(p.total),
  }))

  // Las otras zonas de la misma región (decisión 13). Sin conteo: pedirlo serían
  // 8 queries más por página para un dato que el usuario no necesita acá.
  const hermanas: EnlaceSeo[] = ZONAS.filter(
    (z) => z.region === canon.region && z.slug !== zona,
  ).map((z) => ({ href: urlDeZona(z.slug), label: z.name }))

  const busqueda = `/?${serializeSearchParams({ ...EMPTY_SEARCH, zones: [zona] })}`

  return (
    <>
      {/* JSON-LD (decisión 14): solo datos propios —nombres del canon, de la
          taxonomía y de Overture—. Se serializa con `serializarJsonLd`, **nunca**
          con `JSON.stringify` a pelo: no escapa `<` y el nombre de un lugar es
          dato de terceros. */}
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
          {h1DeZona(canon.name)}
        </h1>
        <p className="text-sm text-muted-foreground">{bajadaDeZona(total, canon.name)}</p>
        {/* La misma aclaración que el listado de búsqueda (`PBETA-R1-03`): con una
            zona puesta aparecen cards de la de al lado porque el filtro usa el
            polígono expandido 400 m (ZONAS, decisión 5). Sale de `resumirBusqueda`,
            que es su dueño — no se reescribe la frase acá. */}
        {aclaracion && <p className="text-xs text-muted-foreground/80">{aclaracion}</p>}
      </header>

      <EnlacesSeo titulo="Qué hay para hacer acá" enlaces={tipos} />

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Los primeros {resultado.places.length} de {contarLugares(total)}
        </h2>
        <ListaLugares lugares={resultado.places} />
      </section>

      {/* CTA al buscador con la zona ya puesta. Esa URL emite `noindex, follow`
          (decisión 10): es estado de app, no la versión canónica de esta página. */}
      <Link
        href={busqueda}
        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium text-foreground transition-colors hover:border-muted-foreground/50 hover:text-primary"
      >
        Ver los {contarLugares(total)} y filtrar
      </Link>

      <EnlacesSeo titulo={`Cerca: ${REGION_LABELS[canon.region]}`} enlaces={hermanas} />
    </>
  )
}
