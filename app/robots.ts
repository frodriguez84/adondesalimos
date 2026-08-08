import type { MetadataRoute } from 'next'

/**
 * `robots.txt` (FICHA, decisión 16). Bloquea `/api/` para que los crawlers no
 * disparen el enriquecimiento pago de Google al indexar: el endpoint de la ficha
 * ya se pide solo desde el cliente, y esto es la segunda barrera. El resto del
 * sitio —home, fichas, legales— se indexa normal: es bueno para el SEO y las
 * fichas no gastan en el render del server.
 *
 * `/admin` se suma con AUTH F2: para un crawler es un 404 igual (gate por
 * `ADMIN_EMAIL`), pero no hay motivo para que lo visite.
 *
 * El `noindex` temporal de la beta (DEPLOY, decisión 9) vivió acá entre el
 * 2026-08-07 y el cierre del QA en producción, y se sacó apenas terminó: eran
 * una constante y su `if`, exactamente para que sacarlo fuera trivial.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin'],
    },
  }
}
