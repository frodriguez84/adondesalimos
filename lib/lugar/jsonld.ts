import { DIAS, type HorariosSemana } from '@/lib/negocio/horarios'
import { urlAbsolutaDeLugar } from '@/lib/lugar/url'
import { serializarJsonLd } from '@/lib/seo/jsonld'
import type { FichaTag } from '@/lib/lugar/ficha'

/**
 * JSON-LD `LocalBusiness` de la ficha (SEO, decisión 14).
 *
 * ⚠️ **Esto es la disciplina de ToS de FICHA, no una preferencia de diseño.** El
 * JSON-LD es contenido **publicado y cacheado por terceros** —buscadores, previews—,
 * así que meter acá un dato de Google es exactamente persistirlo, que es lo que el
 * ToS prohíbe. Es el mismo razonamiento de la decisión 16 de FICHA sobre el `og:`.
 *
 * **Prohibido**, y hay un test que falla si aparecen: `aggregateRating`, `review`,
 * `openingHours`/`openingHoursSpecification` que venga de Google, `priceRange` de
 * Google, `image` de Google, `telephone` de Google.
 *
 * Lo que sí puede ir es lo **propio**: nombre, dirección, coordenadas y URL —todo
 * de Overture o corregido a mano— y los horarios **del dueño**
 * (`place_owner_content`), que son nuestros porque los cargó él.
 *
 * Función pura y separada de la page a propósito: así el test de regresión de ToS
 * puede correr sin montar React (mismo criterio que los tests del field mask).
 */

/**
 * Tipo del catálogo → `@type` de schema.org. **Vive solo acá**, junto al armador
 * que lo usa. Los slugs son los de la faceta Tipo (`lib/db/taxonomy.ts`); los que
 * no tienen un equivalente razonable en schema.org caen al fallback, que es
 * válido y honesto.
 */
const SCHEMA_POR_TIPO: Record<string, string> = {
  restaurante: 'Restaurant',
  bar: 'BarOrPub',
  cerveceria: 'BarOrPub',
  cafe: 'CafeOrCoffeeShop',
  'wine-bar': 'BarOrPub',
  boliche: 'NightClub',
  'patio-gastronomico': 'Restaurant',
  'teatro-espacio-cultural': 'PerformingArtsTheater',
  'club-de-juegos': 'EntertainmentBusiness',
  'centro-entretenimiento': 'EntertainmentBusiness',
}

/** Fallback: siempre válido, nunca miente sobre qué es el lugar. */
export const SCHEMA_FALLBACK = 'LocalBusiness'

/** El `@type` que corresponde al tag de Tipo del lugar. */
export function tipoSchema(tags: FichaTag[]): string {
  const tipo = tags.find((t) => t.facet === 'tipo')
  return (tipo && SCHEMA_POR_TIPO[tipo.slug]) || SCHEMA_FALLBACK
}

/** Los días de la semana propios → los de schema.org, en el mismo orden. */
const DIA_SCHEMA: Record<(typeof DIAS)[number], string> = {
  lunes: 'Monday',
  martes: 'Tuesday',
  miercoles: 'Wednesday',
  jueves: 'Thursday',
  viernes: 'Friday',
  sabado: 'Saturday',
  domingo: 'Sunday',
}

/** Lo mínimo del lugar que el JSON-LD necesita. Todo dato propio. */
export type LugarParaJsonLd = {
  id: string
  name: string
  lat: number
  lng: number
  address: string | null
  locality: string | null
  tags: FichaTag[]
  /** Horarios **del dueño**, o `null`. Los de Google NO entran acá jamás. */
  horariosDueno: HorariosSemana | null
}

/**
 * Arma el objeto del `<script type="application/ld+json">`. Devuelve un objeto
 * plano (la page lo serializa): así el test lo inspecciona por clave.
 */
export function jsonLdDeLugar(place: LugarParaJsonLd): Record<string, unknown> {
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': tipoSchema(place.tags),
    name: place.name,
    url: urlAbsolutaDeLugar(place.id),
    geo: {
      '@type': 'GeoCoordinates',
      latitude: place.lat,
      longitude: place.lng,
    },
  }

  // `address` solo si hay algo real que poner: una `PostalAddress` con el país
  // como único campo no aporta nada y ensucia el structured data.
  if (place.address || place.locality) {
    ld.address = {
      '@type': 'PostalAddress',
      ...(place.address ? { streetAddress: place.address } : {}),
      ...(place.locality ? { addressLocality: place.locality } : {}),
      addressCountry: 'AR',
    }
  }

  // Horarios del DUEÑO, los únicos que pueden publicarse (decisión 14). Si el
  // lugar no tiene reclamo aprobado, la query ya devuelve `null` acá.
  const horarios = horariosSchema(place.horariosDueno)
  if (horarios.length > 0) ld.openingHoursSpecification = horarios

  return ld
}

/**
 * El JSON-LD de la ficha ya serializado y **seguro de inyectar** en un `<script>`.
 *
 * ⚠️ El escape de `<` —sin el cual un lugar llamado `Bar </script><script>…`
 * ejecuta script— **ya no vive acá**: lo mudó F2 a `serializarJsonLd`
 * (`lib/seo/jsonld.ts`) cuando las páginas de `/salir` pasaron a emitir su propio
 * JSON-LD. Dos escapes serían dos oportunidades de que uno quede sin el `replace`,
 * y el que quedara viejo no fallaría: publicaría el XSS en silencio. **La page usa
 * esto, nunca `JSON.stringify` a pelo.**
 */
export function jsonLdSerializado(place: LugarParaJsonLd): string {
  return serializarJsonLd(jsonLdDeLugar(place))
}

/** `HorariosSemana` propia → `OpeningHoursSpecification[]`. Vacío si no hay nada. */
function horariosSchema(semana: HorariosSemana | null): Record<string, unknown>[] {
  if (!semana) return []
  const spec: Record<string, unknown>[] = []
  for (const dia of DIAS) {
    for (const rango of semana[dia] ?? []) {
      spec.push({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: `https://schema.org/${DIA_SCHEMA[dia]}`,
        opens: rango.abre,
        closes: rango.cierra,
      })
    }
  }
  return spec
}
