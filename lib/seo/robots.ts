import type { Metadata } from 'next'

/**
 * Qué le decimos a un crawler sobre una pantalla — **dueño único** (SEO,
 * decisiones 10 y 11).
 *
 * Antes de este archivo la regla *"esta pantalla no se indexa"* estaba escrita
 * **ocho veces**, y ya había driftado: siete páginas la declaraban como una
 * constante local y `/cuenta` la tenía inline. Ocho copias de una regla es la
 * definición de algo que se va a desincronizar — y el modo de falla es mudo: la
 * página que quede sin actualizar se indexa y nadie se entera hasta verla en
 * Google.
 *
 * Son **dos** valores y la diferencia importa, así que no se unifican en uno:
 * lo privado corta el recorrido, lo público-pero-no-canónico lo deja seguir.
 */

/**
 * Pantallas privadas o de sesión: `/chat`, `/cuenta`, `/mis-lugares`,
 * `/mis-votaciones`, `/mi-negocio/*`, `/reclamar/*` y **`/votacion/[token]`**.
 *
 * `nofollow` además de `noindex` —y esto es lo que las separa del otro valor—
 * porque la votación linkea las opciones de un plan privado: no hay motivo para
 * que un crawler recorra el interior. El token viaja por WhatsApp y hasta este
 * spec era perfectamente indexable.
 */
export const ROBOTS_PRIVADO: Metadata['robots'] = { index: false, follow: false }

/**
 * Pantallas de **resultados de búsqueda**: `/` con filtros y `/registrar-negocio?q=`.
 *
 * `follow: true` a propósito: no queremos que estas URLs compitan con las landings
 * de `/salir` (canibalización — muestran lo mismo), pero sí que el crawler siga los
 * links de adentro y llegue a las fichas. Y en `/registrar-negocio` hay un motivo
 * extra: su buscador corre sobre el catálogo **completo, incluidos los no
 * publicados**, que es justo lo que `publishedWhere` decide no mostrar.
 */
export const ROBOTS_RESULTADOS: Metadata['robots'] = { index: false, follow: true }
