import type { MetadataRoute } from 'next'

import { APP_URL } from '@/lib/app-url'
import { urlAbsolutaDeLugar } from '@/lib/lugar/url'
import { fichasParaSitemap } from '@/lib/seo/paginas'

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
  const fichas = await fichasParaSitemap()

  return [
    { url: `${APP_URL}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${APP_URL}/legales`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${APP_URL}/registrar-negocio`, changeFrequency: 'monthly', priority: 0.5 },

    // 🕳️ **Hueco de F1: acá van las ~301 páginas de `/salir`** (`urlDeZona` y
    // `urlDeZonaTipo` de `lib/seo/paginas.ts`, alimentadas por `paginasDeZonaTipo()`).
    // Se agregan **junto con** las páginas, en F2, y no antes: un sitemap que
    // promete URLs que dan 404 es peor que uno corto.

    ...fichas.map((f) => ({
      url: urlAbsolutaDeLugar(f.id),
      lastModified: f.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ]
}
