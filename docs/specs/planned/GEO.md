# Spec: GEO — que un asistente sepa que existimos, y tenga qué citar

**Estado:** 🔵 Planned — en diseño (escrito 2026-08-22)
**Prioridad:** **Media-alta** — es la extensión natural del único canal de adquisición
(`SEO`), pero **no lo reemplaza ni lo bloquea**: las 301 landings y el sitemap ya están en
línea y son lo que rinde primero. Esto suma una superficie que hoy no existe.
**Gate:** Ninguno. La decisión de fondo —**abrir el sitio a los crawlers de IA**— la tomó Fer
el 2026-08-22 (decisión 1). No espera tráfico ni medición.
**Bloquea:** nada. Aporta un instrumento a `SEO` F3 (decisión 10).
**Depende de:** `SEO` F1 y F2 (✅ 2026-08-21) — de ahí salen `lib/app-url.ts`,
`lib/seo/jsonld.ts` (el serializador seguro) y `lib/seo/robots.ts` · `HOME_ENTRADAS` (el
renglón de la votación en el estado vacío) · `VOTACION` (el loop que esta feature promociona)

---

## Problema

**La app está abierta a los crawlers de IA por default, no por decisión — y no tiene nada
para que citen.**

Medido en producción el 2026-08-21/22:

- `robots.txt` de prod dice `User-Agent: * / Allow: /`, con `/api/` y `/admin` bloqueados.
  **Ningún crawler de IA está nombrado**: ni permitido ni bloqueado. Es una decisión no
  tomada que hoy se ejecuta como «sí a todo».
- `/llms.txt` da **404**.
- El JSON-LD vivo cubre **lugares** y nada más: `LocalBusiness` + `PostalAddress` +
  `GeoCoordinates` + `BreadcrumbList` en la ficha, `ItemList` + `BreadcrumbList` en las 301
  landings. **No existe una sola entidad que diga qué es el sitio**: ni `WebSite`, ni
  `Organization`, ni `WebApplication` (`grep` sobre `lib/seo/jsonld.ts` y las tres
  superficies que lo emiten).
- El `<h1>` de la home **se sortea al azar en cada render**
  (`components/shared/rotating-headline.tsx`): «¿Birra con amigos?», «¿Cena tranqui?»,
  «¿Salir a bailar?», «¿Sala de escape?». Es una buena decisión de producto del 2026-08-21 y
  este spec **no la toca** — pero significa que el encabezado principal del sitio nunca dice
  qué hace la app, y cambia entre visitas del crawler.
- **El único activo que un modelo no puede replicar está detrás de un login.** La votación
  grupal aparece en **un renglón** del estado vacío de la home («¿Van varios? Armá una
  votación y que elija el grupo», `app/page.tsx:180`) y su destino, `/votacion/nueva`,
  **redirige a login sin sesión** (`app/votacion/nueva/page.tsx:34`). Para un crawler eso es
  un redirect, no contenido. **No hay ninguna página indexable que explique el loop.**

Y el problema de fondo, que es de producto y no de configuración:

**El catálogo no es el activo.** Las 18.994 fichas son nombre, dirección, coordenadas y tipo
—**datos de Overture, licencia abierta**—. Un modelo que los quiera no necesita scrapearnos:
se baja el dump. Lo propio son tres cosas (los ~3.967 tags de curaduría `source='admin'`, el
orden de `ORDEN_ORGANICO` y las 46 zonas de AMBA con sus 135 alias) y **ninguna es lo que
hace que alguien vuelva**. Lo que hace volver es el loop de decisión grupal, que un asistente
no puede resolver: no tiene a los seis amigos.

⇒ La consulta «bares en Palermo» **ya la contesta un LLM hoy, con o sin nuestro permiso, y
ahí no hay tráfico que perder porque no lo tenemos** (69 aperturas de ficha en 13 días, curva
descendente, 3 usuarios). La consulta «cómo nos ponemos de acuerdo entre seis para salir» es
la que sí podemos ganar — y **no tenemos página que la responda**.

## Objetivo

Que un asistente que reciba una consulta de decisión grupal en Buenos Aires **sepa que la app
existe, entienda qué hace y tenga una URL concreta que devolver**. Tres cosas medibles:

1. **La postura frente a los crawlers de IA queda escrita y ejecutable** en
   `lib/seo/robots.ts`, con los agentes nombrados por categoría. Deja de ser un default.
2. **La app existe como entidad estructurada**: `WebSite` + `WebApplication` en la home, con
   `name`, `description`, `areaServed` y `url`, emitidos por el dueño único de JSON-LD.
3. **Existe una página pública, estática e indexable que explica el loop de decisión grupal**
   — la única consulta donde citar la app no puede canibalizar tráfico, porque la respuesta
   correcta *es* mandar a la app.

## Qué NO es esta feature

- **No es `llms.txt`.** Se evaluó y se descarta con números (decisión 3). No se crea el
  archivo.
- **No es bloquear a nadie.** Ni crawlers de entrenamiento, ni de índice, ni scrapers
  incumplidores (decisiones 1 y 5).
- **No reabre nada de `SEO`.** El sitemap, el umbral de `seo.sitemap_min_tags`, las 301
  landings, el piso de 10 y el slug diferido de la ficha quedan exactamente como están.
- **No toca el `<h1>` rotativo de la home** (decisión 8). Es producto, no SEO.
- **No es contenido de catálogo generado por IA.** La decisión 6 de `SEO` sigue en pie: cero
  prosa inventada sobre lugares. La página nueva es prosa **sobre el producto propio**, que
  es otra cosa (decisión 7).
- **No es difusión activa.** Redes, comunidades y prensa siguen descartadas por la decisión
  de Fer del 2026-08-21 (BACKLOG ítem 10). Un asistente que nos cita es orgánico, no difusión.
- **No es una API pública ni un feed para terceros.** Que un crawler lea el HTML es una cosa;
  publicar un endpoint de datos es otra, y no se abre acá.

---

## Decisiones cerradas

| # | Decisión |
|---|----------|
| 1 | **Se abre el sitio a los crawlers de IA, y se declara por nombre.** Confirmado por Fer el 2026-08-22. El fundamento no es «total ya están entrando»: es que **el catálogo base es de Overture y no hay nada exclusivo que regalar**, que la canibalización solo aplica a consultas donde hoy tenemos **cero** tráfico, y que la consulta que sí podemos ganar —la decisión grupal— **no se puede resolver sin mandarnos gente**. Se declara en vez de dejar el `Allow: /` porque un default no es una decisión: el `robots.txt` de hoy no distingue «lo pensamos y dijimos que sí» de «nadie lo miró», y esta sesión existió justamente porque nadie podía saber cuál de las dos era. |
| 2 | **Los agentes se nombran agrupados por categoría, con un comentario que dice qué hace cada grupo.** Son tres y la diferencia es el negocio entero: **(a) entrenamiento** —`GPTBot`, `ClaudeBot`, `Google-Extended`, `Applebot-Extended`, `Meta-ExternalAgent`, `CCBot`— no devuelven una cita hoy, moldean lo que el modelo del año que viene sabe; **(b) índice de respuesta** —`OAI-SearchBot`, `Claude-SearchBot`, `PerplexityBot`— arman el índice del que salen las respuestas con link; **(c) fetch por usuario** —`ChatGPT-User`, `Claude-User`, `Perplexity-User`— entran cuando **una persona concreta** preguntó algo y el asistente va a buscar la página en ese momento. Bloquear (b) o (c) es desaparecer de las respuestas; bloquear (a) no cuesta citas pero tampoco las gana. **Se permiten los tres**, y la lista vive comentada para que la próxima sesión no tenga que re-derivar la taxonomía. |
| 3 | **`llms.txt` NO se implementa, y queda escrito para que no se vuelva a proponer.** Medido en agosto 2026: **el 97% de los `llms.txt` publicados recibe cero requests**; sobre 500 M de visitas de bots de IA en 90 días, **408** fueron a ese archivo; **ningún** proveedor mayor (OpenAI, Google, Anthropic, Meta, Mistral) se comprometió a leerlo en producción, y GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot y Google-Extended crawlean el HTML directo; los estudios de correlación **no encuentran lift en citas**. Es trabajo que se siente productivo y no mueve nada. **Gate para reabrir, verificable y no por fecha: que OpenAI, Anthropic o Google lo documenten oficialmente en su doc de crawlers.** Hasta entonces, un `/llms.txt` en este repo es deuda, no feature. |
| 4 | **La palanca de reversa en Google es el toggle de Search Console, no `robots.txt`.** Desde el **17/06/2026** Search Console tiene un opt-out que saca el sitio de **AI Overviews, AI Mode y Discover AI —links incluidos— sin afectar ranking ni snippets**. `Google-Extended` no sirve para eso (solo gobierna el entrenamiento de Gemini/Vertex) y `nosnippet`/`max-snippet:0` sí funciona pero **también rompe el snippet normal del buscador**, que es el canal. ⚠️ **Esto es lo que convierte la decisión 1 en puerta de ida y vuelta**: en el canal que más importa, abrir se revierte con un toggle, no con un deploy ni meses de re-crawl. Único costo documentado de usarlo: se pierde el lugar en los *Top Stories* que aparecen dentro de AI Overviews — irrelevante acá, no somos un medio. **Se anota en el spec y no se activa.** |
| 5 | **No se bloquea a los scrapers incumplidores, y el control de costo —si hace falta— no va por `robots.txt`.** `Bytespider`, `CCBot` y `Diffbot` tienen historial mixto de cumplimiento: una línea de `Disallow` para quien no lee el archivo es teatro. Y el costo es real pero es otro problema: las 301 landings son **estáticas con ISR** y un crawler no gasta invocación, pero **la ficha no declara `generateStaticParams` ni `revalidate`** ⇒ cada visita a `/lugar/[id]` es una invocación de función en Vercel Hobby, y hay 18.994. Si un día eso aprieta, la herramienta es el WAF/rate-limit de la plataforma o volver estáticas las fichas del sitemap — **no una regla que el infractor ignora**. Se mide (decisión 10) antes de tocar nada. |
| 6 | **La app se declara como entidad en la home, con `WebSite` + `WebApplication`.** Es el agujero más barato de tapar y el más caro de no tener: hoy las tres superficies con JSON-LD hablan **de lugares**, y no hay nada que diga qué es `adondesalimos.com.ar`. Van `name`, `url`, `description`, `inLanguage: 'es-AR'`, `areaServed` (AMBA) y `applicationCategory`. **Cero datos de Google** —misma regla de ToS que la decisión 14 de `SEO`— y **cero `aggregateRating`**, que además sería inventado. ⚠️ Se emite con `serializarJsonLd` de `lib/seo/jsonld.ts`: **es el dueño único del escape de `<`** y un `JSON.stringify` nuevo adentro de un `dangerouslySetInnerHTML` es un bug de seguridad, no de estilo. |
| 7 | **Nace `/como-funciona`: una página pública, estática, que explica el loop de decisión grupal.** Es el corazón del spec. Contenido: qué hace la app, cómo se arma una votación, cómo vota el grupo y cómo se cierra — más los links a `/salir/<zona>` y a `/votacion/nueva`. **Por qué no viola la decisión 6 de `SEO`** (cero prosa generada): aquélla prohíbe **inventar texto sobre lugares del catálogo**, que es lo que Google llama *doorway page* — 255 páginas de plantilla con un párrafo distinto cada una. Esto es **una** página, escrita por un humano, **sobre el producto propio**, que es exactamente el contenido que un sitio debe tener. La distinción va escrita porque la próxima sesión va a leer «cero prosa» y frenar. |
| 8 | **El `<h1>` rotativo de la home no se toca, y la entidad vive en otro lado.** `RotatingHeadline` sortea entre cuatro ocasiones y cada una le hace de anticipo a un chip — es una decisión de producto del 2026-08-21 con su porqué escrito en el archivo. Congelarla para ganar un encabezado estable sería pagar producto con SEO. La identidad estable ya existe donde importa: el `<title>` y la `description` del layout, y desde acá el JSON-LD de la decisión 6. **Un asistente lee la entidad estructurada antes que el `<h1>`.** |
| 9 | **`/como-funciona` es estática pura y se suma al sitemap.** `export const revalidate = false` (o el default estático): no lee sesión, no lee `searchParams`, no consulta la base. ⚠️ **Un `headers()` o un `auth.api.getSession` acá la convierte en función serverless** — es la misma cicatriz que las 301 de `/salir`, y no avisa: el build la marca `ƒ` en vez de `○`. La URL se agrega a `app/sitemap.ts` junto a `/`, `/legales` y `/registrar-negocio`. **Se llama `/como-funciona` y no `/como-decidir-donde-salir-en-grupo`**: mismo criterio que la decisión 9 de `SEO` sobre el slug de la ficha —la keyword en la URL rinde poco— y una URL canónica y corta es la que la gente puede repetir. |
| 10 | **La medición de GEO se suma a `SEO` F3, y su instrumento tiene un límite que hay que saber de antemano.** Search Console tiene desde junio 2026 un **reporte de rendimiento de IA generativa**: impresiones por página, país, dispositivo y fecha — **sin clics y sin queries**. O sea: sirve para saber si aparecemos, **no** para calcular ROI. El complemento que sí da clics es el **referrer**: visitas con origen `chatgpt.com`, `perplexity.ai`, `claude.ai`, `gemini.google.com` en Vercel Analytics. Las dos lecturas se anotan juntas cuando venza F3 de `SEO`. **Nada de GEO se declara ganado sin eso** — mismo criterio que la decisión 15 de `SEO`: el SEO sin medición es fe. |
| 11 | **El copy de `/como-funciona` usa el vocabulario con el que los asistentes ya contestan la pregunta, y eso se midió.** Línea de base del 2026-08-23 (`docs/qa/AnalisisQA.md` § *GEO-12*): ante «cómo decidimos entre varios a dónde salir en Buenos Aires», **los tres asistentes explican a mano el método que la app automatiza** —cada uno propone sin discutir, se filtra lo inviable, se puntúa, hay regla de desempate previa— y Perplexity remata recomendando *«una encuesta de WhatsApp, Google Forms o mandar los números al grupo»*. ⇒ La página tiene que decir **proponer opciones · que cada uno vote · desempatar · que no decida siempre el mismo**, y no solo «armá una votación». No es keyword stuffing: es literalmente lo que la app hace, y es la diferencia entre que un modelo la lea como **la herramienta** o como un directorio de bares más. |
| 12 | **Existen cinco competidores nombrables y ninguno cruza los dos ejes — el posicionamiento lo dijo el propio motor.** Relevamiento del 2026-08-23, que no teníamos: ante «app para ponerse de acuerdo con amigos», Perplexity nombra **ForkYes, Daccord, GetTogether, Food with Friends y Woki**. Las cuatro primeras son **de votación pero genéricas y de base internacional**; Woki es **local pero de reservas, no decide en grupo**. Y Perplexity le advierte solo al usuario que verifique *«que tenga restaurantes de su zona: algunas apps de votación tienen base internacional y pueden mostrar menos opciones en Buenos Aires»*. **La intersección votación grupal × catálogo local de AMBA está vacía y es exactamente la app.** ⚠️ Corolario que ordena las fases: **ChatGPT y Claude no nombraron a nadie —responden de memoria— y Perplexity, que busca en vivo, nombró cinco.** Ser citado no depende del training set sino de **tener página indexada que responda** ⇒ si hubiera que cortar el spec por la mitad, **F2 rinde más que F1**. |

---

## Arquitectura — quién es dueño de qué

Cero módulos nuevos. **Todo extiende dueños que ya existen**, que es justamente la regla que
este spec no puede romper (`CLAUDE.md` § *Una regla, un dueño*):

| Regla | Dueño (ya existe) | Qué le agrega GEO |
|---|---|---|
| Qué se le dice a un crawler | `app/robots.ts` + `lib/seo/robots.ts` | Las reglas por agente de la decisión 2 |
| Cómo se serializa JSON-LD | `lib/seo/jsonld.ts` (`serializarJsonLd`) | `sitioJsonLd()` — la entidad de la decisión 6 |
| Qué páginas SEO existen | `lib/seo/paginas.ts` | Nada. `/como-funciona` es estática fija, no un combo |
| La URL base absoluta | `lib/app-url.ts` | Nada. Se consume |
| El copy de las páginas SEO | `lib/seo/textos.ts` (`MARCA`) | El nombre y la descripción de la entidad salen de ahí, no de un literal nuevo |

⚠️ **La descripción de la app está hoy en `app/layout.tsx` como literal** (`const DESCRIPCION
= 'Decidí a dónde salir esta noche sin dar mil vueltas.'`). El JSON-LD de la decisión 6 sería
**la segunda copia** ⇒ se mueve a `lib/seo/textos.ts` junto a `MARCA` antes de crearla, no
después. Es el mismo movimiento que hizo `SEO` F2 con el nombre de la marca.

---

## Fases

### F1 — La declaración y la entidad (barato, reversible, sin pantallas)

1. `app/robots.ts` + `lib/seo/robots.ts`: las reglas por agente de la decisión 2, agrupadas
   y comentadas. `/api/` y `/admin` siguen bloqueados **para todos**.
2. `DESCRIPCION` se muda de `app/layout.tsx` a `lib/seo/textos.ts`.
3. `sitioJsonLd()` en `lib/seo/jsonld.ts` + su emisión en la home (decisión 6), serializado
   con `serializarJsonLd`.
4. Test de regresión del JSON-LD de la entidad: falla si aparece `aggregateRating` o
   cualquier clave con dato de Google — mismo criterio que los tests de la ficha.

### F2 — La página que responde el prompt que podemos ganar

5. `app/como-funciona/page.tsx` — estática, con el copy de la decisión 7 en argentino
   rioplatense, y links a `/salir/<zona>` y `/votacion/nueva`.
6. `generateMetadata` con `<title>`, `description` y `canonical`. ⚠️ **Si declara
   `openGraph`, tiene que heredar la imagen del padre** con `(await parent).openGraph?.images`
   — declararlo pisa el del padre entero (cicatriz `PBETA-R2-02`).
7. La URL entra a `app/sitemap.ts`.
8. Un link a `/como-funciona` desde el estado vacío de la home y desde el footer — sin un
   link interno, la página existe para el sitemap y para nadie más.

### F3 — Medición (sin código, junto con `SEO` F3)

9. Leer el reporte de IA generativa de Search Console y los referrers de asistentes en Vercel
   Analytics; anotar las dos lecturas en el BACKLOG con fecha (decisión 10).
10. Anotar el volumen de hits por user-agent de IA sobre `/lugar/[id]`, para saber si el costo
    de invocaciones de la decisión 5 es real o teórico.

---

## Criterios de done (DoD)

**F1**

- [ ] `GET /robots.txt` en producción nombra explícitamente los agentes de la decisión 2 y
      **ninguno** queda con `Disallow` sobre `/`.
- [ ] `/api/` y `/admin` siguen bloqueados para **todos** los agentes, incluidos los nuevos
      (verificable leyendo el `robots.txt` servido, no el código).
- [ ] `grep -rn "Decidí a dónde salir esta noche" app lib` devuelve **1 sola** ocurrencia, en
      `lib/seo/textos.ts`.
- [ ] La home emite un `<script type="application/ld+json">` con `@type` `WebSite` y
      `WebApplication`, con `name`, `url`, `description`, `inLanguage` y `areaServed`.
- [ ] Ese JSON-LD **no** contiene `aggregateRating`, ni horarios, rating, precio o imagen de
      Google. **Hay un test que falla si alguna de esas claves aparece.**
- [ ] El JSON-LD nuevo se serializa con `serializarJsonLd`:
      `grep -rn "JSON.stringify" app lib components` no muestra ninguna ocurrencia nueva
      dentro de un `dangerouslySetInnerHTML`.
- [ ] **No existe** `app/llms.txt` ni ruta que lo sirva (decisión 3).

**F2**

- [ ] `GET /como-funciona` devuelve 200 y su HTML **del server** —verificado con
      `curl | grep`, no en pantalla— contiene la explicación del loop de votación y los links
      a `/salir/…` y `/votacion/nueva`.
- [ ] La ruta sale **estática** en `next build` (`○`, no `ƒ`), y no importa `headers`,
      `cookies` ni `auth`: `grep -n "headers\|cookies\|getSession" app/como-funciona/page.tsx`
      devuelve **0**.
- [ ] `/sitemap.xml` incluye `/como-funciona` y la URL responde 200.
- [ ] `canonical` de `/como-funciona` apunta a sí misma, absoluta, con la base de
      `lib/app-url.ts`.
- [ ] Si la página declara `openGraph`, el preview conserva la imagen de `app/og/route.tsx`
      (no se perdió al declararlo).
- [ ] Hay al menos un link interno a `/como-funciona` desde una página indexada.
- [ ] Copy en argentino rioplatense; cero texto generado por LLM sobre lugares del catálogo.
- [ ] 390×844 sin desbordes horizontales.
- [ ] `npm run typecheck`, los tests y `next build` en verde, **con el dev server parado**.

**F3**

- [ ] La lectura del reporte de IA generativa y de los referrers de asistentes queda escrita
      en el BACKLOG con fecha y números, junto a la de `SEO` F3.

---

## Edge cases

| Caso | Qué pasa |
|---|---|
| Un crawler de IA recorre las 18.994 fichas | Cada visita es una invocación de función en Hobby (la ficha no es estática). No se bloquea: se mide (decisión 5). Si aprieta, la herramienta es el WAF o volver estáticas las fichas del sitemap |
| Un asistente cita la app pero sin link | Es el peor caso y no se puede evitar por configuración. Es exactamente por eso que la apuesta es la página de la decisión 7: una consulta cuya respuesta útil **es** ir a la app |
| Un scraper que ignora `robots.txt` | Ya pasa hoy y seguiría pasando con cualquier regla. Fuera del alcance de este spec (decisión 5) |
| Fer cambia de opinión sobre Google | Toggle de Search Console, sin deploy y sin costo en ranking (decisión 4). Para el resto, es editar `lib/seo/robots.ts` |
| El modelo aprendió el catálogo y después despublicamos un lugar | Ya pasa con Overture, que es la fuente. No es un riesgo que este spec cree |
| `/como-funciona` queda desactualizada respecto del producto | Es una página escrita a mano: se actualiza a mano. Por eso es **una** y no 255 |

---

## QA manual (IDs propuestos)

| ID | Caso | Criterio |
|----|------|----------|
| GEO-01 | `curl https://adondesalimos.com.ar/robots.txt` | Los agentes de la decisión 2 nombrados, ninguno con `Disallow: /` |
| GEO-02 | Mismo archivo, bloque de exclusiones | `/api/` y `/admin` bloqueados para todos los agentes, los nuevos incluidos |
| GEO-03 | `curl /llms.txt` | **404** — y es el resultado esperado (decisión 3) |
| GEO-04 | `curl /` y extraer el JSON-LD | `WebSite` + `WebApplication` presentes, con `name`, `url`, `description`, `inLanguage`, `areaServed` |
| GEO-05 | Test automático de la entidad | Falla si se agrega `aggregateRating` o una clave con dato de Google |
| GEO-06 | `grep` de la descripción de la app en el repo | 1 sola ocurrencia, en `lib/seo/textos.ts` |
| GEO-07 | `curl /como-funciona \| grep` | 200 y el loop de votación explicado **en el HTML del server** |
| GEO-08 | Salida de `next build` | `/como-funciona` sale `○` (estática), no `ƒ` |
| GEO-09 | `/sitemap.xml` | Incluye `/como-funciona`; la URL responde 200 |
| GEO-10 | Preview del link de `/como-funciona` en WhatsApp | Trae la imagen de `app/og/route.tsx` |
| GEO-11 | Validador de structured data de Google sobre `/` y `/como-funciona` | Cero errores; las entidades se reconocen |
| GEO-12 | Preguntarle a ChatGPT, Claude, Perplexity y Gemini los 3 prompts de la línea de base | **✅ TOMADA 2026-08-23, antes de escribir una línea de código**: **0 menciones en 9 cruces** (Gemini no medido, se cayó la página). El detalle, los 5 competidores y las tres lecturas están en `docs/qa/AnalisisQA.md` § *GEO-12*. Se repite con F1+F2 en producción |
| GEO-13 | 390×844 en `/como-funciona` | Sin desbordes horizontales |

---

## Relación con otros specs

- **`SEO`** — este spec **no lo reabre**: sitemap, umbral, 301 landings, piso y slug diferido
  quedan igual. Le **suma un instrumento a F3** (decisión 10) y una URL al sitemap. Si `SEO`
  F3 se lee antes de que GEO esté implementado, la lectura de IA queda pendiente y se anota
  como tal.
- **`VOTACION` / `HOME_ENTRADAS`** — `/como-funciona` es la primera superficie **pública e
  indexable** que explica el loop. Hoy el único rastro es un renglón en el estado vacío de la
  home y un destino que redirige a login.
- **`FICHA`** — la disciplina de ToS de Google aplica igual al JSON-LD de la entidad
  (decisión 6): es contenido publicado y cacheado por terceros.
- **`LEGALES`** — nada nuevo. Que un modelo lea el sitio no cambia la política de privacidad:
  no se le expone ningún dato personal que no esté ya público en la ficha.
- **Ítem 3 del BACKLOG (curaduría de cobertura)** — la conexión sigue siendo la de `SEO`
  decisión 8: cada lugar curado cruza el umbral y pasa a ofrecerse. GEO no la cambia.

## v2 (fuera de scope)

- `llms.txt`, con el gate de la decisión 3.
- Activar el opt-out de AI Overviews (decisión 4): existe, está documentado y **no se usa**.
- Bloqueos por agente o rate-limit de crawlers (decisión 5), hasta que la medición diga que
  el costo es real.
- Una API pública o un feed de datos para terceros.
- Páginas de contenido editorial más allá de `/como-funciona` («guías de barrios», etc.): es
  el mismo riesgo de *doorway page* que la decisión 6 de `SEO` mantiene cerrado.
