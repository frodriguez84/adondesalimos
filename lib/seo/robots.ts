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

// ---------------------------------------------------------------------------
// Los crawlers de IA (GEO, decisiones 1, 2 y 5)
// ---------------------------------------------------------------------------

/**
 * **La postura está tomada: se abre el sitio a los crawlers de IA y se declara
 * por nombre** (GEO, decisión 1, Fer 2026-08-22).
 *
 * Se declara en vez de dejar el `Allow: /` heredado porque **un default no es una
 * decisión**: el `robots.txt` de antes no distinguía «lo pensamos y dijimos que
 * sí» de «nadie lo miró», y la sesión que escribió este spec existió justamente
 * porque nadie podía saber cuál de las dos era.
 *
 * El fundamento, en corto: el catálogo base es de **Overture** —licencia abierta,
 * el que lo quiera se baja el dump y no necesita scrapearnos—; la canibalización
 * solo aplica a consultas donde hoy tenemos **cero** tráfico; y la consulta que sí
 * podemos ganar —cómo decide un grupo a dónde salir— **no se puede contestar sin
 * mandarnos gente**.
 *
 * ⚠️ **La palanca de reversa en Google no es este archivo** (decisión 4): es el
 * opt-out de Search Console (desde el 17/06/2026), que saca el sitio de AI
 * Overviews y AI Mode **sin tocar ranking ni snippets**. `Google-Extended` solo
 * gobierna el entrenamiento de Gemini/Vertex y `nosnippet` rompería el snippet del
 * buscador, que es el canal. Está documentado y **no se activa**.
 *
 * Los tres grupos van separados aunque hoy tengan la misma política, porque **la
 * diferencia entre ellos es el negocio entero** y el día que uno se cierre hay que
 * poder cerrarlo solo.
 */

/**
 * **(a) Entrenamiento.** No devuelven una cita hoy: moldean lo que el modelo del
 * año que viene sabe. Bloquearlos no cuesta citas, pero tampoco las gana.
 */
export const CRAWLERS_ENTRENAMIENTO = [
  'GPTBot',
  'ClaudeBot',
  'Google-Extended',
  'Applebot-Extended',
  'Meta-ExternalAgent',
  'CCBot',
]

/**
 * **(b) Índice de respuesta.** Arman el índice del que salen las respuestas **con
 * link**. Bloquearlos es desaparecer de las respuestas.
 */
export const CRAWLERS_INDICE = ['OAI-SearchBot', 'Claude-SearchBot', 'PerplexityBot']

/**
 * **(c) Fetch por usuario.** Entran cuando **una persona concreta** preguntó algo
 * y el asistente va a buscar la página en ese momento. Es el que más se parece a
 * una visita: bloquearlo es negarle la página a alguien que la pidió.
 */
export const CRAWLERS_FETCH_USUARIO = ['ChatGPT-User', 'Claude-User', 'Perplexity-User']

/**
 * Lo que ningún crawler recorre — **igual para todos, y eso es lo importante**.
 *
 * Un grupo con `User-agent` propio **ignora el bloque `*` entero**: si esta lista
 * no se repite en cada grupo nombrado, nombrar a `GPTBot` le **abre** `/api/` y
 * `/admin` sin que nadie lo haya decidido. Por eso es una constante y no tres
 * literales.
 *
 * `/api/` está bloqueado desde FICHA (decisión 16): que un crawler no dispare el
 * enriquecimiento pago de Google al indexar. `/admin` se sumó con AUTH F2.
 */
export const RUTAS_EXCLUIDAS = ['/api/', '/admin']
