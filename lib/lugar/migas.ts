import { type Miga } from '@/lib/seo/jsonld'
import { urlDeZona, urlDeZonaTipo } from '@/lib/seo/paginas'

/**
 * El breadcrumb de la ficha: quién arma la lista de migas y con qué invariante.
 *
 * ⚠️ **Vive en su propio archivo y no en `lib/lugar/ficha.ts` por una razón que el
 * build encontró y ningún test podía**: `ficha.ts` es puro y lo importa
 * `components/lugar/ficha-google.tsx`, que es `'use client'`. Como esto necesita
 * `lib/seo/paginas` —el dueño de las URLs de `/salir`, que además consulta la
 * base—, meterlo ahí le arrastraba `lib/db` (postgres → `fs`/`net`) al bundle del
 * browser y el build fallaba con *Module not found: Can't resolve 'fs'*. Armar la
 * URL a mano acá para evitarlo habría sido una segunda implementación de
 * `/salir/<zona>/<tipo>`, que es peor.
 */

/**
 * Las migas de la ficha: `Inicio › <Zona> › <Tipo> › <Nombre>` (SEO, decisión 13).
 *
 * Vive acá y no inline en la página **porque tiene un invariante que hay que poder
 * testear**, y el invariante lo puso Google:
 *
 * ⚠️ **Ninguna miga que no sea la última puede quedar sin `path`.** En un
 * `BreadcrumbList`, `item` es obligatorio en todos los escalones salvo el último
 * —ahí Google usa la URL de la página—. Un escalón del medio sin `item` invalida
 * **el breadcrumb entero**, no solo esa miga: deja de salir en resultados
 * enriquecidos. Lo reportó Search Console el 2026-08-24 con
 * *«Falta el campo "item" (en "itemListElement")»*, sobre **2.250 de las 18.993
 * fichas publicadas (11,8%)**.
 *
 * El caso era el Tipo: se emitía siempre, pero solo linkea si el combo tiene
 * página (`existePaginaZonaTipo`) — un bar de un barrio donde los bares no llegan
 * al piso de 10 no tiene `/salir/<zona>/<tipo>`, y linkearlo sería mandar al
 * usuario y al crawler a un 404. Con el Nombre cerrando la ruta, ese Tipo sin link
 * quedaba en el **medio**. Dos fuentes, y la primera era el grueso: 1.890 fichas
 * sin zona primaria (sin zona no hay combo posible) y 360 con zona pero bajo el piso.
 *
 * **La solución es no emitirlo**: si el Tipo no linkea, no es un escalón — es texto
 * inerte, y el tipo del lugar ya se ve en los chips del encabezado (14 veces en el
 * HTML de la ficha que disparó el aviso). Se saca de las **dos** mitades, visible y
 * estructurada, porque salen de esta misma lista a propósito: un `BreadcrumbList`
 * que no coincide con el breadcrumb de la pantalla es justo lo que Google marca
 * como structured data engañoso (ver `lib/seo/jsonld.ts`).
 *
 * ⚠️ **El Nombre cierra la ruta y no es adorno**: sin él la última miga sería el
 * Tipo, y `components/shared/breadcrumb.tsx` nunca linkea la última —es la página
 * actual—, así que el link a `/salir/<zona>/<tipo>` que pide la decisión 13 no
 * existiría. Es el único escalón que puede ir sin `path`.
 */
export function migasDeFicha({
  zona,
  tipo,
  tipoConPagina,
  nombre,
}: {
  /** Zona primaria del lugar. `null` en los 1.890 que no tienen ninguna. */
  zona: { name: string; slug: string } | null
  /** Tag de la faceta Tipo. `null` si el lugar no tiene. */
  tipo: { name: string; slug: string } | null
  /** ¿El combo zona × tipo tiene página propia? Lo resuelve `existePaginaZonaTipo`. */
  tipoConPagina: boolean
  nombre: string
}): Miga[] {
  // Sin zona no hay combo, así que no hay a dónde linkear el Tipo aunque el
  // llamador diga que sí: la condición se resuelve acá y no en la página.
  const tipoPath =
    tipo && zona && tipoConPagina ? urlDeZonaTipo(zona.slug, tipo.slug) : null

  return [
    { name: 'Inicio', path: '/' },
    ...(zona ? [{ name: zona.name, path: urlDeZona(zona.slug) }] : []),
    // Solo si linkea — ver el ⚠️ de arriba.
    ...(tipo && tipoPath ? [{ name: tipo.name, path: tipoPath }] : []),
    { name: nombre, path: null },
  ]
}
