import type { MetadataRoute } from 'next'

import { APP_URL } from '@/lib/app-url'
import { urlAbsolutaDeLugar } from '@/lib/lugar/url'
import { fichasParaSitemap, paginasDeZonaTipo, urlDeZona, urlDeZonaTipo } from '@/lib/seo/paginas'
import { ZONAS } from '@/lib/zones/canon'

/**
 * `sitemap.xml` (SEO, decisiones 7 y 8).
 *
 * Le ofrecemos a Google **una lista corta y buena**, no las 18.994 fichas: las que
 * llegan al umbral de tags salen de `fichasParaSitemap()`, y el resto **sigue
 * crawlable, linkeable y compartible** — ninguna ficha lleva `noindex` (decisión 7).
 * Ofrecerle a un dominio sin autoridad 19.000 páginas casi vacías se come el
 * presupuesto de rastreo de las que sí valen.
 *
 * ISR y no dinámica: al que más le pega a esta ruta es el crawler, y en Vercel
 * Hobby cada request dinámica es una invocación de función.
 */
export const revalidate = 86400

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [fichas, combos] = await Promise.all([fichasParaSitemap(), paginasDeZonaTipo()])

  return [
    { url: `${APP_URL}/`, changeFrequency: 'daily', priority: 1 },
    // La letra chica (LEGALES, F0): el índice y sus cuatro documentos. Van al
    // sitemap porque son páginas públicas y estáticas, y porque `/legales/baja`
    // tiene que ser encontrable — la Resolución 424/2020 la pide accesible.
    { url: `${APP_URL}/legales`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${APP_URL}/legales/terminos`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${APP_URL}/legales/privacidad`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${APP_URL}/legales/atribucion`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${APP_URL}/legales/baja`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${APP_URL}/registrar-negocio`, changeFrequency: 'monthly', priority: 0.5 },

    // Las 46 zonas van todas y sin piso (decisión 4): la más flaca tiene 181
    // lugares publicados. Salen del canon, que es el mismo origen del
    // `generateStaticParams` de `/salir/[zona]` — no hay una segunda lista de barrios.
    ...ZONAS.map((z) => ({
      url: `${APP_URL}${urlDeZona(z.slug)}`,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),

    // ⚠️ Los ~255 combos salen de **`paginasDeZonaTipo()`, la misma llamada** que
    // alimenta el `generateStaticParams` de `/salir/[zona]/[tipo]` (decisión 5).
    // Esa es toda la garantía de que el sitemap no le prometa a Google una URL que
    // da 404: si esta lista se armara acá por su cuenta, divergirían en silencio y
    // el síntoma tardaría semanas en aparecer en Search Console.
    ...combos.map((c) => ({
      url: `${APP_URL}${urlDeZonaTipo(c.zona, c.tipo)}`,
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    })),

    ...fichas.map((f) => ({
      url: urlAbsolutaDeLugar(f.id),
      lastModified: f.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ]
}
