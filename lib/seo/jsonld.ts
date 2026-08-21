import { APP_URL } from '@/lib/app-url'
import { urlAbsolutaDeLugar } from '@/lib/lugar/url'

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
