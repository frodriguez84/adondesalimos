import type { MetadataRoute } from 'next'

/**
 * `robots.txt` (FICHA, decisión 16). Bloquea `/api/` para que los crawlers no
 * disparen el enriquecimiento pago de Google al indexar: el endpoint de la ficha
 * ya se pide solo desde el cliente, y esto es la segunda barrera. El resto del
 * sitio —home, fichas, legales— se indexa normal: es bueno para el SEO y las
 * fichas no gastan en el render del server.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/api/',
    },
  }
}
