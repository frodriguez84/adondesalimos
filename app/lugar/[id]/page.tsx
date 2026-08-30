import type { Metadata, ResolvingMetadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { after } from 'next/server'
import { BookOpen, Clock, Globe, Info, MapPin, Navigation, Phone, Store } from 'lucide-react'

import { auth } from '@/lib/auth'
import { estadoDeFavoritos } from '@/lib/favoritos/query'
import { BotonGuardar } from '@/components/favoritos/boton-guardar'
import { FichaActions } from '@/components/lugar/ficha-actions'
import { FichaGoogle } from '@/components/lugar/ficha-google'
import { TapLink } from '@/components/lugar/tap-link'
import { buttonVariants } from '@/components/ui/button'
import { BrandHeader } from '@/components/shared/brand-header'
import { ubicacionDeCard } from '@/lib/search/card'
import { registrarDetailView } from '@/lib/search/impressions'
import { cn } from '@/lib/utils'
import {
  clasificarRed,
  comoLlegarUrl,
  precioDeTags,
  queEncontras,
  type FichaTag,
  type RedPlataforma,
} from '@/lib/lugar/ficha'
import { jsonLdSerializado } from '@/lib/lugar/jsonld'
import { migasDeFicha } from '@/lib/lugar/migas'
import { getPlaceDetail } from '@/lib/lugar/query'
import { Breadcrumb } from '@/components/shared/breadcrumb'
import { breadcrumbJsonLd, serializarJsonLd, type Miga } from '@/lib/seo/jsonld'
import { existePaginaZonaTipo } from '@/lib/seo/paginas'
import { MARCA } from '@/lib/seo/textos'

/**
 * Ficha del lugar (FICHA, fase 1). Server component: los datos propios
 * —Overture + ZONAS— se leen acá y la pantalla se ve entera **sin depender de
 * Google**. El enriquecimiento en vivo (horarios, rating, foto) se monta desde
 * el cliente en F2, en el hueco que colapsa limpio si no llega.
 *
 * Ruta dinámica y sin caché de datos de Google por diseño (decisión 17); acá no
 * hay datos de Google todavía, pero la ruta ya nace dinámica para F2.
 */

const RED_LABEL: Record<RedPlataforma, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  twitter: 'X',
  tiktok: 'TikTok',
  otro: 'Enlace',
}

/** Tipo + Cocina para el encabezado (los que dicen "qué es" el lugar). */
function tipoYCocina(tags: FichaTag[]): string[] {
  return tags.filter((t) => t.facet === 'tipo' || t.facet === 'cocina').map((t) => t.name)
}

/**
 * ⚠️ Una página que declara `openGraph` **pisa el del padre entero**, imagen
 * incluida: sin esto, la imagen de `app/og/route.tsx` no llega hasta acá y el link
 * vuelve a verse pelado, que es justo lo que arregla `PBETA-R2-02`. La imagen se
 * hereda del padre en vez de escribir la ruta a mano, así sigue habiendo **un
 * solo** archivo que la define.
 */
export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const { id } = await params
  const place = await getPlaceDetail(id)
  if (!place) return { title: `Lugar no encontrado — ${MARCA}` }

  // Solo datos PROPIOS en el OG (decisión 16): el preview se cachea en terceros
  // —WhatsApp, buscadores— y meter horarios o rating de Google ahí sería
  // persistir un dato que el ToS prohíbe guardar.
  const ubicacion = ubicacionDeCard(place)
  const descripcion = [tipoYCocina(place.tags).join(' · '), ubicacion]
    .filter(Boolean)
    .join(' — ')

  return {
    title: `${place.name} — ${MARCA}`,
    description: descripcion || undefined,
    openGraph: {
      title: place.name,
      description: descripcion || undefined,
      images: (await parent).openGraph?.images,
    },
  }
}

export default async function LugarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const place = await getPlaceDetail(id)

  // Decisión 23: no existe, no es UUID o no está publicado ⇒ 404. Nada de esto
  // llega a gastar en Google (el enriquecimiento se pide después, desde el
  // cliente, y también revalida la visibilidad).
  if (!place) notFound()

  // Decisión 24. En `after` para no meter latencia: la respuesta sale y el
  // contador se escribe después. Solo aperturas de ficha publicada.
  after(() => registrarDetailView(place.id))

  // FAVORITOS: el botón nace con el estado real (decisión 9), así el mismo lugar
  // se ve igual en la card y en la ficha. Sin sesión no se consulta nada — el
  // botón se muestra igual y el tap lleva a login (decisión 7).
  // Breadcrumb `Inicio › <Zona> › <Tipo>` (SEO, decisión 13): es el link que sube
  // de la ficha a la landing, o sea la otra mitad del circuito que arma la
  // arquitectura de links. `existePaginaZonaTipo` no es un lujo — un bar de un
  // barrio donde los bares no llegan al piso **no tiene** página, y linkearla sería
  // mandar al usuario y al crawler a un 404.
  const tipoTag = place.tags.find((t) => t.facet === 'tipo') ?? null
  const [session, tipoConPagina] = await Promise.all([
    auth.api.getSession({ headers: await headers() }).catch(() => null),
    place.zoneSlug && tipoTag
      ? existePaginaZonaTipo(place.zoneSlug, tipoTag.slug)
      : Promise.resolve(false),
  ])

  // La lista la arma `migasDeFicha` (`lib/lugar/ficha.ts`) y no este archivo,
  // porque tiene un invariante que hay que poder testear: **ninguna miga que no
  // sea la última puede quedar sin `path`**. Google exige `item` en todos los
  // escalones salvo el último, y un escalón del medio sin él invalida el
  // `BreadcrumbList` entero — es lo que Search Console reportó el 2026-08-24 sobre
  // el 11,8% de las fichas. El porqué completo vive en el helper.
  const migas: Miga[] = migasDeFicha({
    zona: place.zoneSlug && place.zone ? { name: place.zone, slug: place.zoneSlug } : null,
    tipo: tipoTag,
    tipoConPagina,
    nombre: place.name,
  })
  // F2: junto al estado vienen las listas visibles, para el sheet de destino
  // (decisión 8) — la misma resolución sirve para las dos cosas.
  const favoritos = session?.user
    ? await estadoDeFavoritos(session.user.id, [place.id])
    : { guardados: [], listas: [] }
  const guardado = favoritos.guardados.length > 0

  const encabezado = tipoYCocina(place.tags)
  const precio = precioDeTags(place.tags)
  const ubicacion = ubicacionDeCard(place)
  const encontras = queEncontras(place.tags)
  const comoLlegar = comoLlegarUrl(place)
  // Ya resueltos por la query: dueño → Overture, y los pagos gateados por plan
  // (AUTH, decisiones 13, 18 y 19). Acá no se decide nada de eso.
  const telefono = place.phone
  const web = place.website

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-5 px-4 pb-28 pt-4">
      {/* JSON-LD (SEO, decisión 14): **solo datos propios**. Lo arma
          `lib/lugar/jsonld.ts`, que es función pura para que el test de regresión
          de ToS pueda fallar si alguien le agrega una clave de Google.
          ⚠️ Se serializa con `jsonLdSerializado`, **no** con `JSON.stringify` a
          pelo: `stringify` no escapa `<` y el `name` es dato de terceros. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdSerializado(place) }}
      />

      {/* El mismo breadcrumb, estructurado: se arma con **la misma lista** de
          migas que el visible (ver `lib/seo/jsonld.ts`). Uno que no coincida con
          el otro es structured data engañoso. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializarJsonLd(breadcrumbJsonLd(migas)) }}
      />

      <BrandHeader />

      <Breadcrumb migas={migas} />

      <FichaActions
        nombre={place.name}
        accion={
          <BotonGuardar
            placeId={place.id}
            guardadoInicial={guardado}
            autenticado={Boolean(session?.user)}
            listas={favoritos.listas}
          />
        }
      />

      {/* Google en vivo (F2/F3): el shell cliente envuelve la foto (arriba), el
          encabezado (acá como children, server-rendered) y el bloque de rating/
          horarios (abajo). Un solo fetch a /api/lugar/[id]/google para los tres
          (decisión 16): la foto y los datos vienen de la misma request paga. La foto
          respeta la prioridad dueño → Google → placeholder (decisión 3); el bloque de
          datos colapsa al mensaje honesto si Google no llega. Si el lugar no tiene
          precio propio, muestra el priceLevel de Google (decisión 21). */}
      <FichaGoogle
        placeId={place.id}
        tienePrecioPropio={precio !== null}
        fotoDueno={place.ownerPhotos[0] ?? null}
        horariosDueno={place.horariosDueno}
        nombre={place.name}
      >
        {/* Encabezado: nombre, tipo/cocina, zona · precio */}
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold leading-tight text-foreground">{place.name}</h1>

          {encabezado.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {encabezado.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground"
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          {(ubicacion || precio) && (
            <p className="text-sm text-muted-foreground">
              {[ubicacion, precio].filter(Boolean).join(' · ')}
            </p>
          )}

          {/* Novedad del dueño (decisión 19): banner corto bajo el header. Solo
              con plan pago — la query ya devuelve null si no lo tiene. */}
          {place.news && (
            <p className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-foreground">
              {place.news}
            </p>
          )}
        </header>
      </FichaGoogle>

      {/* Contacto propio (Overture): dirección, teléfono, sitio, redes */}
      <section className="flex flex-col gap-2 text-sm">
        {(place.address || place.locality) && (
          <p className="flex items-start gap-2 text-foreground">
            <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span>{place.address ?? place.locality}</span>
          </p>
        )}

        {(telefono || web || place.menuUrl) && (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
            {telefono && (
              <TapLink
                placeId={place.id}
                kind="telefono"
                href={`tel:${telefono}`}
                className="text-foreground underline underline-offset-4"
              >
                {telefono}
              </TapLink>
            )}
            {telefono && web && <span aria-hidden>·</span>}
            {web && (
              <TapLink
                placeId={place.id}
                kind="website"
                href={web}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground underline underline-offset-4"
              >
                {web.replace(/^https?:\/\//, '').replace(/\/$/, '')}
              </TapLink>
            )}
            {/* Carta del dueño (decisión 19): acción junto al website. */}
            {place.menuUrl && (
              <>
                {(telefono || web) && <span aria-hidden>·</span>}
                <TapLink
                  placeId={place.id}
                  kind="menu"
                  href={place.menuUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-foreground underline underline-offset-4"
                >
                  <BookOpen className="size-3.5" />
                  Ver la carta
                </TapLink>
              </>
            )}
          </p>
        )}

        {place.socials.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {place.socials.map((url) => (
              <TapLink
                key={url}
                placeId={place.id}
                kind="redes"
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-border px-2.5 py-0.5 text-xs text-foreground transition-colors hover:border-muted-foreground/50"
              >
                {RED_LABEL[clasificarRed(url)]}
              </TapLink>
            ))}
          </div>
        )}
      </section>

      {/* Qué vas a encontrar: el diferencial. Si no hay tags de onda, no se renderiza. */}
      {encontras.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Qué vas a encontrar
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {encontras.map((t) => (
              <span
                key={t}
                className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground"
              >
                {t}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Descripción del dueño (decisión 19): debajo de "Qué vas a encontrar".
          Se renderiza aunque no haya tags de onda — son dos cosas distintas. */}
      {place.description && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Sobre el lugar
          </h2>
          <p className="whitespace-pre-line text-sm text-foreground">{place.description}</p>
        </section>
      )}

      {/* Horarios y rating de Google: hueco de F2. En F1 no se renderiza. */}

      <footer className="mt-auto flex flex-col gap-2 pt-2 text-xs text-muted-foreground">
        {/* Decisión 21: discreto, al pie, y solo si el lugar todavía no tiene
            dueño. Sin sesión, `/reclamar/[id]` manda a login y vuelve al flujo. */}
        {!place.reclamado && (
          <Link
            href={`/reclamar/${place.id}`}
            className="inline-flex items-center gap-1 underline underline-offset-4"
          >
            <Store className="size-3" />
            ¿Sos el dueño? Reclamá esta ficha
          </Link>
        )}
        {/* Rótulo del catálogo (DEPLOY, decisión 21): la ficha es la otra superficie con
            footer, y muchas visitas van a entrar por un link compartido, no por la home. */}
        <Link href="/legales" className="inline-flex items-center gap-1 underline underline-offset-4">
          <Info className="size-3" />
          Cómo armamos el catálogo
        </Link>
        <Link href="/legales/atribucion" className="inline-flex items-center gap-1 underline underline-offset-4">
          <Clock className="size-3" />
          Fuentes y atribución
        </Link>
      </footer>

      {/* Barra fija: acciones que deciden la salida. Cómo llegar es costo cero. */}
      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-md items-center gap-2 px-4 py-3">
          <TapLink
            placeId={place.id}
            kind="como_llegar"
            href={comoLlegar}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: 'default' }), 'flex-1')}
          >
            <Navigation className="size-4" />
            Cómo llegar
          </TapLink>
          {telefono && (
            <TapLink
              placeId={place.id}
              kind="telefono"
              href={`tel:${telefono}`}
              aria-label="Llamar"
              className={cn(buttonVariants({ variant: 'secondary', size: 'icon' }))}
            >
              <Phone className="size-4" />
            </TapLink>
          )}
          {web && (
            <TapLink
              placeId={place.id}
              kind="website"
              href={web}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Sitio web"
              className={cn(buttonVariants({ variant: 'secondary', size: 'icon' }))}
            >
              <Globe className="size-4" />
            </TapLink>
          )}
        </div>
      </nav>
    </main>
  )
}
