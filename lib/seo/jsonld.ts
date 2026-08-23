import { APP_URL } from '@/lib/app-url'
import { urlAbsolutaDeLugar } from '@/lib/lugar/url'
import { DESCRIPCION, MARCA } from '@/lib/seo/textos'

/**
 * JSON-LD de las páginas de `/salir` + **el serializador seguro que usa todo el
 * sitio** (SEO, decisión 14).
 *
 * ⚠️ **`serializarJsonLd` es el dueño único del escape, y eso es lo importante de
 * este archivo.** `JSON.stringify` **no escapa `<`**: un lugar llamado
 * `Bar </script><script>…` cierra el tag y ejecuta script. El vector se descubrió
 * en F1 sobre el JSON-LD de la ficha, y el `name` sigue siendo dato de terceros
 * (Overture, una corrección de admin, el dueño del negocio). Encima el CSP está en
 * `Report-Only` y con `'unsafe-inline'`, así que no frena nada.
 *
 * Por eso F2 **no** escribe un `JSON.stringify` nuevo: `lib/lugar/jsonld.ts`
 * (`jsonLdSerializado`) y las dos páginas de `/salir` pasan por la misma función.
 * Dos escapes serían dos oportunidades de que uno quede sin el `replace`.
 *
 * La otra regla —qué se puede publicar— es la de FICHA: el JSON-LD es contenido
 * **cacheado por terceros**, así que meter un dato de Google acá es persistirlo.
 * Las páginas de zona lo tienen fácil: `BreadcrumbList` e `ItemList` se arman con
 * nombres de zona del canon, nombres de tipo de la taxonomía y nombres de lugar de
 * Overture. Nada de Google entra ni por casualidad, y hay un test que lo fija.
 */

/**
 * Objeto → el string que va adentro de un `<script type="application/ld+json">`.
 *
 * Escapar `<` como `<` es válido en JSON y desactiva el vector entero: sin un
 * `<` literal no se puede abrir ni cerrar ningún tag. **Nadie serializa JSON-LD
 * con `JSON.stringify` a pelo.**
 */
export function serializarJsonLd(valor: unknown): string {
  return JSON.stringify(valor).replace(/</g, '\\u003c')
}

/**
 * Un escalón del breadcrumb, **el mismo tipo que consume el componente visible**
 * (`components/shared/breadcrumb.tsx`). Es a propósito: las dos mitades salen de
 * la misma lista o dejan de coincidir.
 *
 * `path` es relativo (acá se vuelve absoluto) y **puede ser `null`**: el escalón
 * actual no se linkea a sí mismo, y en la ficha el escalón de Tipo puede no tener
 * página propia —un bar de un barrio donde los bares no llegan al piso—. En los
 * dos casos se muestra como texto y el JSON-LD omite `item`, que es válido.
 */
export type Miga = { name: string; path: string | null }

/**
 * `BreadcrumbList` — la jerarquía `Inicio › <Zona> › <Tipo>` (decisión 13).
 *
 * Se emite con las **mismas** migas que se ven en pantalla: un breadcrumb
 * estructurado que no coincide con el visible es justo lo que Google marca como
 * structured data engañoso. Por eso el componente y esta función reciben la misma
 * lista.
 */
export function breadcrumbJsonLd(migas: Miga[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: migas.map((m, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: m.name,
      ...(m.path ? { item: `${APP_URL}${m.path}` } : {}),
    })),
  }
}

/**
 * `ItemList` con los lugares que la página lista, en **el orden en que se ven**
 * (que es el de `ORDEN_ORGANICO`: la posición es información, no decoración).
 *
 * Solo `name` y `url` — los dos datos propios. Nada de rating, precio, horarios
 * ni imagen: ver el encabezado del archivo.
 */
export function itemListJsonLd(
  lugares: { id: string; name: string }[],
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: lugares.map((l, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: l.name,
      url: urlAbsolutaDeLugar(l.id),
    })),
  }
}

// ---------------------------------------------------------------------------
// La entidad del sitio (GEO, decisión 6)
// ---------------------------------------------------------------------------

/**
 * `WebSite` + `WebApplication` de la home — **qué es `adondesalimos.com.ar`**.
 *
 * Es el agujero más barato de tapar y el más caro de no tener: hasta GEO las tres
 * superficies con JSON-LD hablaban **de lugares** (`LocalBusiness`, `ItemList`,
 * `BreadcrumbList`) y no había una sola entidad que dijera qué es el sitio. Un
 * asistente lee esto **antes que el `<h1>`** — que además rota entre cuatro
 * ocasiones en cada render y por decisión de producto no se toca (decisión 8).
 *
 * Van las dos y no una: `WebSite` es la publicación (lo que un buscador entiende
 * como "el sitio") y `WebApplication` es lo que la app **hace**, que es donde
 * cuelgan `applicationCategory` y `areaServed`. Se emiten en un `@graph` con
 * `@id`, así el `isPartOf` las ata en vez de dejar dos entidades sueltas
 * compitiendo por ser el sitio.
 *
 * ⚠️ **Cero datos de Google y cero `aggregateRating`** — misma regla de ToS que la
 * ficha (FICHA decisión 16 = SEO decisión 14): el JSON-LD es contenido cacheado
 * por terceros, así que un dato de Google acá es un dato persistido. Y un rating
 * agregado, encima, sería inventado: no tenemos reseñas propias. Hay un test que
 * falla si alguna de esas claves aparece.
 *
 * El nombre y la bajada salen de `lib/seo/textos.ts`, que es su dueño único: si
 * salieran de literales de acá serían la cuarta copia de la misma frase.
 */
export function sitioJsonLd(): Record<string, unknown> {
  const sitio = `${APP_URL}/#sitio`

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': sitio,
        name: MARCA,
        url: `${APP_URL}/`,
        description: DESCRIPCION,
        inLanguage: 'es-AR',
      },
      {
        '@type': 'WebApplication',
        '@id': `${APP_URL}/#app`,
        name: MARCA,
        url: `${APP_URL}/`,
        description: DESCRIPCION,
        inLanguage: 'es-AR',
        isPartOf: { '@id': sitio },
        applicationCategory: 'LifestyleApplication',
        operatingSystem: 'Web',
        // El alcance real, y es la mitad del posicionamiento: las apps de
        // votación que un asistente nombra hoy son de base internacional, y lo
        // que no cruzan es justamente el catálogo local (decisión 12).
        areaServed: {
          '@type': 'Place',
          name: 'Área Metropolitana de Buenos Aires, Argentina',
        },
      },
    ],
  }
}
