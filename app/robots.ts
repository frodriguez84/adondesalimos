import type { MetadataRoute } from 'next'

import {
  CRAWLERS_ENTRENAMIENTO,
  CRAWLERS_FETCH_USUARIO,
  CRAWLERS_INDICE,
  RUTAS_EXCLUIDAS,
} from '@/lib/seo/robots'

/**
 * `robots.txt` (FICHA, decisión 16 · GEO, decisiones 1 y 2). **Este archivo emite;
 * la política vive en `lib/seo/robots.ts`**, que es donde está escrito el porqué de
 * cada grupo y por qué las exclusiones se repiten en todos.
 *
 * `/api/` se bloquea para que los crawlers no disparen el enriquecimiento pago de
 * Google al indexar: el endpoint de la ficha ya se pide solo desde el cliente, y
 * esto es la segunda barrera. `/admin` se suma con AUTH F2: para un crawler es un
 * 404 igual (gate por `ADMIN_EMAIL`), pero no hay motivo para que lo visite.
 *
 * GEO suma los crawlers de IA **nombrados y agrupados por categoría**. Los cuatro
 * bloques dicen lo mismo hoy a propósito: la decisión es abrir, y separarlos es lo
 * que permite cerrar uno solo el día que haga falta.
 *
 * ⚠️ **Cada grupo repite `RUTAS_EXCLUIDAS`**: en `robots.txt` un agente que
 * encuentra su nombre ignora el bloque `*` completo. Nombrar sin repetir las
 * exclusiones sería *abrir* `/api/` justo para los que se acaban de nombrar.
 *
 * El `noindex` temporal de la beta (DEPLOY, decisión 9) vivió acá entre el
 * 2026-08-07 y el cierre del QA en producción, y se sacó apenas terminó: eran
 * una constante y su `if`, exactamente para que sacarlo fuera trivial.
 */
export default function robots(): MetadataRoute.Robots {
  const abierto = (userAgent: string | string[]) => ({
    userAgent,
    allow: '/',
    disallow: RUTAS_EXCLUIDAS,
  })

  return {
    rules: [
      abierto('*'),
      // (a) Entrenamiento: moldean el modelo del año que viene, no la cita de hoy.
      abierto(CRAWLERS_ENTRENAMIENTO),
      // (b) Índice de respuesta: de acá salen las respuestas con link.
      abierto(CRAWLERS_INDICE),
      // (c) Fetch por usuario: alguien preguntó y el asistente viene a leer.
      abierto(CRAWLERS_FETCH_USUARIO),
    ],
  }
}
