import type { MetadataRoute } from 'next'

/**
 * ⚠️ **TEMPORAL — DEPLOY, decisión 9.** Mientras dure el QA en producción el sitio
 * sale cerrado a los crawlers: reindexar una beta con un bug es caro de despintar
 * y unos días de demora en SEO no se notan. **Se saca apenas el QA en prod cierre**:
 * borrar la constante y el `if`, y queda el `robots.txt` de siempre.
 *
 * No hay inbound links todavía, así que `Disallow: /` alcanza — el matiz de que
 * un `Disallow` no impide indexar una URL enlazada desde afuera no aplica acá.
 */
const BETA_NOINDEX: boolean = true

/**
 * `robots.txt` (FICHA, decisión 16). Bloquea `/api/` para que los crawlers no
 * disparen el enriquecimiento pago de Google al indexar: el endpoint de la ficha
 * ya se pide solo desde el cliente, y esto es la segunda barrera. El resto del
 * sitio —home, fichas, legales— se indexa normal: es bueno para el SEO y las
 * fichas no gastan en el render del server.
 *
 * `/admin` se suma con AUTH F2: para un crawler es un 404 igual (gate por
 * `ADMIN_EMAIL`), pero no hay motivo para que lo visite.
 */
export default function robots(): MetadataRoute.Robots {
  if (BETA_NOINDEX) {
    return { rules: { userAgent: '*', disallow: '/' } }
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin'],
    },
  }
}
