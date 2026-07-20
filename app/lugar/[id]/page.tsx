import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { after } from 'next/server'
import { Clock, Globe, MapPin, Navigation, Phone } from 'lucide-react'

import { FichaActions } from '@/components/lugar/ficha-actions'
import { FichaGoogle } from '@/components/lugar/ficha-google'
import { buttonVariants } from '@/components/ui/button'
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
import { getPlaceDetail } from '@/lib/lugar/query'

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const place = await getPlaceDetail(id)
  if (!place) return { title: 'Lugar no encontrado — ¿A dónde salimos?' }

  // Solo datos PROPIOS en el OG (decisión 16): el preview se cachea en terceros
  // —WhatsApp, buscadores— y meter horarios o rating de Google ahí sería
  // persistir un dato que el ToS prohíbe guardar.
  const ubicacion = ubicacionDeCard(place)
  const descripcion = [tipoYCocina(place.tags).join(' · '), ubicacion]
    .filter(Boolean)
    .join(' — ')

  return {
    title: `${place.name} — ¿A dónde salimos?`,
    description: descripcion || undefined,
    openGraph: {
      title: place.name,
      description: descripcion || undefined,
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

  const encabezado = tipoYCocina(place.tags)
  const precio = precioDeTags(place.tags)
  const ubicacion = ubicacionDeCard(place)
  const encontras = queEncontras(place.tags)
  const comoLlegar = comoLlegarUrl(place)
  const telefono = place.phones[0] ?? null
  const web = place.websites[0] ?? null

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-5 px-4 pb-28 pt-4">
      <FichaActions nombre={place.name} />

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

        {(telefono || web) && (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
            {telefono && (
              <a href={`tel:${telefono}`} className="text-foreground underline underline-offset-4">
                {telefono}
              </a>
            )}
            {telefono && web && <span aria-hidden>·</span>}
            {web && (
              <a
                href={web}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground underline underline-offset-4"
              >
                {web.replace(/^https?:\/\//, '').replace(/\/$/, '')}
              </a>
            )}
          </p>
        )}

        {place.socials.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {place.socials.map((url) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-border px-2.5 py-0.5 text-xs text-foreground transition-colors hover:border-muted-foreground/50"
              >
                {RED_LABEL[clasificarRed(url)]}
              </a>
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

      {/* Horarios y rating de Google: hueco de F2. En F1 no se renderiza. */}

      <footer className="mt-auto pt-2 text-xs text-muted-foreground">
        <Link href="/legales" className="inline-flex items-center gap-1 underline underline-offset-4">
          <Clock className="size-3" />
          Fuentes y atribución
        </Link>
      </footer>

      {/* Barra fija: acciones que deciden la salida. Cómo llegar es costo cero. */}
      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-md items-center gap-2 px-4 py-3">
          <a
            href={comoLlegar}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: 'default' }), 'flex-1')}
          >
            <Navigation className="size-4" />
            Cómo llegar
          </a>
          {telefono && (
            <a
              href={`tel:${telefono}`}
              aria-label="Llamar"
              className={cn(buttonVariants({ variant: 'secondary', size: 'icon' }))}
            >
              <Phone className="size-4" />
            </a>
          )}
          {web && (
            <a
              href={web}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Sitio web"
              className={cn(buttonVariants({ variant: 'secondary', size: 'icon' }))}
            >
              <Globe className="size-4" />
            </a>
          )}
        </div>
      </nav>
    </main>
  )
}
