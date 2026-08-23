# Spec: SEO — el único canal de adquisición

**Estado:** **Parcial** — escrito 2026-08-21 · **F1 ✅ 2026-08-21** (cimientos + sitemap + eje de
`noindex` + JSON-LD): typecheck limpio, **861 tests**, `next build` verde con el server parado, y
`/sitemap.xml` prerenderizado **estático** con **1.126 URLs** (3 estáticas + 1.123 fichas), cruce
contra `publishedWhere` con **diff = 0**. · **F2 ✅ 2026-08-21** (las 301 páginas de zona):
QA **APROBADO** — **301 URLs recorridas con 0 no-200**, sitemap en **1.427** (3 + 46 + 255 + 1.123),
typecheck limpio, **888 tests**, `next build` en frío verde en **41 s** con las 301 saliendo `●` (SSG)
y `security-review` con **0 HIGH / 0 MEDIUM**. De paso se cerraron en vivo los tres de F1 que habían
quedado en código (`SEO-06`, `SEO-07`, `SEO-08`) y el preview de WhatsApp de `/votacion/[token]`
quedó intacto. · **F3** — **paso 14 ✅ 2026-08-23**: la propiedad `adondesalimos.com.ar` dada de alta en
Google Search Console (tipo **Dominio**, verificada por TXT en Cloudflare) y el sitemap
enviado y aceptado, con **1.431 URLs** servidas en 200/`application/xml`. **Falta el paso 15**
(la lectura), que vence **a los 60 días de F2** ⇒ desde el **2026-10-20**. No tiene código
**Prioridad:** **Alta** — el 2026-08-21 Fer decidió **no hacer difusión activa** (BACKLOG § Cola
post-v2, ítem 10). Con esa decisión el SEO deja de ser infraestructura y pasa a ser **la única
forma en que un usuario nuevo puede llegar a la app**. Los 9 ítems del backlog gateados por
tráfico dependen de que esto funcione.
**Gate:** Ninguno para F1 y F2. F3 (medición) arranca 30 días después de F2.
**Bloquea:** los 9 ítems de la tabla «esperan tráfico» del ítem 10 del BACKLOG. Ninguno se
desbloquea por código; se desbloquean por gente, y la gente entra por acá.
**Depende de:** `DEPLOY` (la app tiene que estar en línea y sin `noindex` — ✅ 2026-08-07) ·
`BUSQUEDA` (el motor y el contrato de la URL) · `ORDEN_ORGANICO` (el orden con el que se listan
los lugares) · `CATALOGO` (`lib/db/visibility.ts`) · `FICHA` (la disciplina de ToS de Google)

---

## Problema

**La app está en línea, indexable desde el 2026-08-07, y nadie llega.** Medido entre el
2026-08-07 y el 2026-08-19 (ítem 9 del BACKLOG): **69 aperturas de ficha en 13 días**, curva
descendente (38 → 25 → 6 por semana), **3 usuarios** —uno es Fer—, **1 votación creada**. La
única difusión que hubo fueron los hermanos de Fer.

Con la decisión de no hacer difusión activa, quedan tres agujeros concretos, y **ninguno es
"falta un sitemap"**:

1. **No existe `app/sitemap.ts`.** Hay 18.994 fichas indexables y ningún mapa que se las ofrezca
   a Google. En [`DEPLOY.md`](../active/DEPLOY.md) el sitemap está declarado «v2, fuera de scope»
   (§ *v2*), decisión tomada cuando la app **no estaba en línea**. El contexto cambió.
2. **Lo que la gente busca es «bares en Palermo», y esa URL no existe.** La búsqueda vive en
   `/?z=…&t=…` con `searchParams`: **una sola URL** para 46 zonas × 6 facetas. No hay una sola
   página en el sitio cuyo `<title>` diga «Bares en Palermo Soho». No hay dónde rankear.
3. **Nunca se definió qué NO se indexa.** Hoy hay **cero** rutas con `noindex` en toda la app
   (verificado con grep sobre `app/`). Eso incluye **`/votacion/[token]`**, que es un token
   privado que se comparte por WhatsApp — el eje "qué se le ofrece a un crawler" no existe como
   decisión, existe como default.

Y el catálogo agrega un problema propio, medido sobre los 18.994 publicados de dev:

| Sustancia de la ficha | Lugares |
|---|---|
| ≤ 1 tag (solo Tipo) — *thin content* puro | **8.468** |
| 2 tags (típico: Tipo + Cocina) | 9.402 |
| 3 tags | 189 |
| ≥ 4 tags | 935 |
| Con contenido de dueño (`place_owner_content`) | **2** |
| Con al menos un tag de curaduría (`source='admin'`) | 1.202 |

**Nombre + dirección + un tag no rankea.** Ofrecerle a Google 19.000 páginas casi vacías desde un
dominio sin autoridad no es neutro: la mayoría queda en «Descubierta — no indexada» y consume el
presupuesto de rastreo que necesitan las páginas que sí valen.

## Objetivo

Que exista, para las búsquedas que la gente realmente hace, **una página nuestra que pueda
rankear**; y que Google reciba del sitio una lista corta y buena en vez de un volcado de 19.000
URLs.

En concreto, tres cosas medibles:

1. **~301 páginas nuevas** con intención de búsqueda propia (`/salir/<zona>` × 46 y
   `/salir/<zona>/<tipo>` × 255), cada una con contenido real servido desde el server.
2. **Un `sitemap.xml`** con ~1.430 URLs —las 301 de zona + las ~1.123 fichas con sustancia— y no
   con 19.000.
3. **Un eje explícito de "qué no se indexa"**, que hoy no existe: pantallas de resultados,
   pantallas de sesión y `/votacion/[token]`.

## Qué NO es esta feature

- **No es el slug de la ficha.** `/lugar/[uuid]` no se toca (decisión 9). Sí se paga su
  prerrequisito, que es deuda real hoy.
- **No es contenido editorial.** No se escriben descripciones de barrios ni "los 10 mejores bares
  de Palermo" a mano ni con IA. Todo el texto de las páginas nuevas sale de datos que ya están en
  la base (decisión 6). Un párrafo inventado por lugar es exactamente lo que Google llama
  *doorway page*.
- **No es difusión.** Redes, comunidades y el empujón al loop viral quedan descartados por
  decisión de Fer del 2026-08-21. Este spec no los reabre.
- **No es un eje por Cocina, Ambiente, Momento ni Precio.** Medido: solo 43 combos zona × cocina
  llegan a 10 lugares, contra 255 de zona × tipo (decisión 3).
- **No es `noindex` sobre las fichas flacas.** Se difiere con gate (decisión 8).
- **No es Google Business Profile, ni backlinks, ni prensa.** Son canales, no código.
- **No toca ninguno de los 9 ítems gateados por tráfico** (BACKLOG, ítem 10).

---

## Decisiones cerradas

| # | Decisión |
|---|----------|
| 1 | **El eje de páginas SEO vive en `/salir/…`, no en el apex.** `/salir/<zona>` y `/salir/<zona>/<tipo>`. Confirmado por Fer el 2026-08-21. El motivo es de contrato, no de estética: con las zonas en el apex (`/palermo-soho`, `/pilar`, `/merlo`) **cada ruta nueva de la app habría que cotejarla contra 46 slugs, para siempre** — y los slugs de zona ya son contrato (`lib/zones/canon.ts`: *"viven en URLs compartibles… cambiar uno rompe links"*). El peso SEO está en el `<title>`, el `<h1>` y el contenido, no en tener un segmento menos. Y «salir» es la palabra del producto. |
| 2 | **El eje es zona × Tipo, y nada más.** Medido sobre los 18.994 publicados: **395** combos zona × tipo tienen ≥1 lugar, **255** tienen ≥10 y 194 tienen ≥20. Contra eso, zona × cocina-padre da **220 combos pero solo 43 con ≥10**. Un eje que en el 80% de sus celdas devuelve 4 lugares no es una landing, es una página vacía con `<title>` bonito. Cocina se reabre cuando el catálogo la sostenga (gate en la decisión 15). |
| 3 | **El piso de una página de zona × tipo es 10 lugares publicados.** ⇒ 255 páginas. Con ≥20 serían 194: las 61 de diferencia tienen entre 10 y 19 lugares reales, y una página con 12 bares de verdad es una buena página. **Es un número, no una puerta de ida**: subirlo o bajarlo es un rebuild. Vive en `lib/seo/paginas.ts` como `PISO_PAGINA_ZONA`, junto a la query que lo aplica — no disperso. ⚠️ **No confundirlo con el piso de los chips** (`PISO_HOME` = 20 / `PISO_ZONA` = 3, `lib/search/chips.ts`): miden cosas distintas y por eso son constantes distintas. Escrito acá porque la próxima sesión va a querer unificarlos. |
| 4 | **Las 46 páginas de zona (`/salir/<zona>`) van todas**, sin piso: la zona más flaca tiene **181** lugares publicados (mín. medido; máx. 1.707). No hace falta un gate para algo que ninguna zona puede incumplir. |
| 5 | **Estáticas con ISR diaria y `dynamicParams = false`.** `generateStaticParams` arma las 301 en el build; `export const revalidate = 86400`. Dos motivos: **(a)** el que más va a pegarle a estas páginas es el crawler, y en Vercel Hobby cada request dinámica es una invocación de función — una landing SEO que gasta cuota cada vez que Google la visita es un autogol; **(b)** `dynamicParams = false` hace que la lista de páginas que existen y la lista del sitemap salgan de **la misma llamada**, así que no pueden divergir. Un combo que no llega al piso da **404**, no un redirect ni una página vacía (un soft-404 es peor que un 404). ⚠️ **El build pasa a necesitar la base**: si `DATABASE_URL` no resuelve, el build falla en vez de deployar 301 páginas rotas. Es el comportamiento correcto y hay que saberlo. |
| 6 | **Todo el texto de las páginas nuevas sale de datos, y se nota.** El `<h1>` es «Bares en Palermo Soho» y la bajada dice el conteo real y de dónde sale el orden («Hay 142 bares publicados en Palermo Soho. Primero los que tenemos mejor cargados»). **Cero prosa de color, cero texto generado por LLM.** No es purismo: 255 páginas de plantilla con un párrafo inventado cada una es la definición literal de *doorway page* en la guía de Google. Lo que las salva de serlo es que el cuerpo son los lugares de verdad, con nombre, dirección y tags — que es contenido distinto en cada una. |
| 7 | **Al sitemap van solo las fichas con sustancia; ninguna ficha lleva `noindex`.** Confirmado por Fer el 2026-08-21. Umbral: **≥ 3 tags vivos** ⇒ **1.123 fichas** hoy (la medición inicial dio 1.124 contando también tags retirados; `fichasParaSitemap` filtra `tags.active` para contar lo mismo que `paginasDeZonaTipo`). Las otras 17.871 **siguen crawlables, linkeables y compartibles** — un link mandado por WhatsApp tiene que seguir funcionando y siendo indexable si alguien lo pega en algún lado. La diferencia entre "no se lo ofrezco" y "le digo que lo ignore" es toda la decisión: lo primero es **puerta de ida y vuelta**, lo segundo tarda meses de re-crawl en revertirse. |
| 8 | **El umbral del sitemap vive en `app_settings` (`seo.sitemap_min_tags`, default 3), no hardcodeado.** Mismo criterio que `catalog.confidence_threshold`: cuando la curaduría de cobertura avance (ítem 3 del BACKLOG), el sitemap crece **sin deploy**, con un `UPDATE`. Es la conexión concreta entre curaduría y SEO: **cada lugar curado es una página que pasa a ofrecerse.** |
| 9 | **El slug de la ficha se difiere, y se paga su prerrequisito.** Confirmado por Fer el 2026-08-21. `/lugar/[uuid]` no se toca. Motivo: de las cuatro decisiones de arquitectura es la de **menor rendimiento por unidad de riesgo** —la keyword en la URL vale poco— y la **única puerta de ida** (hay links vivos compartidos). Además su beneficio depende de que las fichas rankeen, que es justo lo que la decisión 7 dice que hoy no pasa. **Lo que sí entra: `lib/lugar/url.ts` como dueño único** — hoy `/lugar/${id}` está escrito a mano en **7 archivos** (`place-card`, 4 pantallas de `/admin`, `mi-negocio`, `reclamar`) más `lib/email/index.ts`. Eso convierte el trabajo futuro de 8 archivos en 1. Gate para reabrirlo en la decisión 15. |
| 10 | **Ninguna pantalla de resultados de búsqueda se indexa.** Una sola regla, dos superficies: `/` cuando `tieneBusqueda(params)` es true, y `/registrar-negocio?q=…`. Emiten `robots: { index: false, follow: true }` — **`follow` sí**, para que los links internos se sigan recorriendo. Motivo doble: son la versión no-canónica de las páginas de zona (canibalización directa: `/?z=palermo-soho&t=bar` y `/salir/palermo-soho/bar` muestran lo mismo), y el buscador de `/registrar-negocio` corre sobre el catálogo **completo, incluidos los no publicados** (`buscarCatalogoCompleto`), que es exactamente lo que `publishedWhere` decide no mostrar. La home **pelada** (`/`) sí se indexa. |
| 11 | **`/votacion/[token]` lleva `noindex, nofollow`.** Es el hallazgo del spec: un token privado, compartido por WhatsApp, hoy perfectamente indexable. `nofollow` además —y no solo `noindex`— porque la página linkea las opciones de la votación y no hay motivo para que un crawler recorra el interior de un plan privado. Se suman al mismo eje, por higiene y porque son gratis: `/chat`, `/cuenta`, `/mis-lugares`, `/mis-votaciones`, `/mi-negocio/*`, `/reclamar/*`. (`/admin` y `/api/` ya están en `robots.txt`; el `noindex` es la segunda barrera, igual que en FICHA decisión 16.) |
| 12 | **La home gana un bloque «Explorá por barrio» con los 46 links, solo en el estado vacío.** Sin él, Google no tiene por dónde descubrir el eje nuevo salvo el sitemap, y el sitemap es una sugerencia: **los links internos son lo que transmite autoridad**. No es un injerto de SEO en la UI: la decisión 2 de BUSQUEDA ya dice que la primera visita no muestra resultados **hasta elegir zona** — una lista de barrios navegable *es* esa pantalla, hecha con `<a>` en vez de con un sheet. Va debajo del hero de `HOME_IDENTIDAD`, compacto, y **solo cuando `!tieneBusqueda(params)`** (con búsqueda activa la pantalla es otra cosa). |
| 13 | **Cada página nueva linkea a sus hermanas, y la ficha linkea hacia arriba.** `/salir/<zona>` → sus tipos con conteo + las zonas de su región. `/salir/<zona>/<tipo>` → los otros tipos de la misma zona + la misma tipo en zonas vecinas + las 20 fichas. La ficha → breadcrumb `Inicio › <Zona> › <Tipo>`. Esto cierra el circuito: **el crawler entra por una landing y sale hacia las fichas mejor ordenadas**, porque el listado usa `searchPlaces` tal cual, y `ORDEN_ORGANICO` ya pone adelante lo curado y no-cadena. La arquitectura de links prioriza las fichas buenas sin que nadie lo programe aparte. |
| 14 | **JSON-LD sí, pero solo con datos propios — y esto es la disciplina de ToS de FICHA, no una preferencia.** La ficha emite `LocalBusiness` con `name`, `address`, `geo` y `url`. **Prohibido** meter `aggregateRating`, `openingHours`, `priceRange` o `image` que vengan de Google: el `JSON-LD` es contenido publicado y cacheado por terceros, o sea **persistir un dato que el ToS prohíbe guardar** — el mismo razonamiento de la decisión 16 de FICHA sobre el `og:`. Los horarios **del dueño** (`place_owner_content`) sí pueden ir: son nuestros. Las páginas de zona emiten `BreadcrumbList` + `ItemList`. |
| 15 | **Nada se declara ganado sin Search Console.** F3 no tiene código: es dar de alta la propiedad, mandar el sitemap y **volver a los 60 días** con números. De ahí salen los tres gates que este spec deja abiertos a propósito: **(a)** reabrir el slug de la ficha (decisión 9) si las fichas muestran impresiones por nombre propio; **(b)** reabrir el `noindex` sobre las flacas (decisión 7) si Google indexa masa flaca y las buenas no aparecen; **(c)** abrir el eje Cocina (decisión 2) si zona × tipo rankea y el catálogo llegó a ~150 combos zona × cocina con ≥10. **El SEO sin medición es fe**, y este spec es el único canal de adquisición: no puede quedar sin instrumento. |
| 16 | **`lib/app-url.ts` nace como dueño único de la URL base.** Hoy `process.env.BETTER_AUTH_URL ?? 'http://localhost:5178'` está copiado **4 veces** (`app/layout.tsx`, `lib/email/index.ts`, `lib/billing/mercadopago.ts`, y una variante en `lib/auth/client.ts`), y el comentario de `layout.tsx` ya lo anota como deuda: *"el día que se unifique en un helper, son cuatro lugares"*. El sitemap **necesita URLs absolutas**, así que sería la quinta copia. Se unifica acá porque este spec es el que la obliga, no de prepo (`CLAUDE.md` § *Una regla, un dueño*: la segunda implementación es el cleanup de máxima prioridad). |

---

## Arquitectura — quién es dueño de qué

Tres módulos nuevos, cada uno con una sola responsabilidad. **Ninguna de estas reglas puede
quedar escrita dos veces** — el sitemap y las páginas tienen que salir de la misma fuente o van
a divergir en silencio (y un sitemap que promete páginas que dan 404 es peor que no tenerlo).

| Módulo | De qué es dueño único | Quién lo consume |
|---|---|---|
| `lib/app-url.ts` | La URL base absoluta de la app | `layout`, `sitemap`, mails, checkout, auth client |
| `lib/lugar/url.ts` | **Cómo se arma la URL de un lugar** (`urlDeLugar(id)`) | `place-card`, 4 pantallas de `/admin`, `mi-negocio`, `reclamar`, `lib/email`, `sitemap` |
| `lib/seo/paginas.ts` | **Qué páginas SEO existen** y cómo se arman sus URLs | `sitemap.ts`, `/salir/[zona]`, `/salir/[zona]/[tipo]` |

`lib/seo/paginas.ts` expone:

- `PISO_PAGINA_ZONA = 10` — decisión 3.
- `UMBRAL_TAGS_SITEMAP_KEY = 'seo.sitemap_min_tags'` (default `3`) — decisión 8, leído de
  `app_settings` en runtime.
- `paginasDeZonaTipo()` → `{ zona, tipo, total }[]` — **la única query** que decide qué combos
  existen. La llaman `generateStaticParams` **y** el sitemap.
- `fichasParaSitemap()` → `{ id, updatedAt }[]` — las fichas por encima del umbral.
- `urlDeZona(z)`, `urlDeZonaTipo(z, t)` — los paths, escritos una vez.

⚠️ **Todas las queries de este módulo pasan por `publishedWhere` / `getConfidenceThreshold`**
(`lib/db/visibility.ts`). No se reimplementa la regla de publicado: el sitemap es justo el lugar
donde ofrecerle a Google un lugar despublicado sería un error caro y silencioso.

### Reuso — lo que NO se escribe de nuevo

- El listado de una página de zona sale de **`searchPlaces({ ...EMPTY_SEARCH, zones: [z], tags: [t] })`**
  tal cual, y el conteo de **`countPlaces`** (`lib/search/query.ts`). Cero SQL nuevo para el
  cuerpo de la página, y el orden es el de `ORDEN_ORGANICO` por construcción.
- Las cards son **`components/shared/place-card.tsx`**, el mismo componente del listado.
- Los nombres y las regiones de las zonas salen de **`lib/zones/canon.ts`**; los de los tipos, de
  **`lib/db/taxonomy.ts`** (`TIPO`). No se escribe una segunda lista de barrios.
- El CTA de cada página lleva a la búsqueda con los filtros ya puestos, armado con
  **`serializeSearchParams`** (`lib/search/params.ts`).

---

## Fases

### F1 — Cimientos: los dueños únicos, el sitemap y qué NO se indexa

Todo reversible, sin migraciones, sin cambios de URL. Es lo que hace que F2 sea barata.

1. `lib/app-url.ts` + reemplazo de las 4 copias (decisión 16).
2. `lib/lugar/url.ts` + reemplazo de los 8 usos de `/lugar/${id}` (decisión 9).
3. `lib/seo/paginas.ts` con las cinco piezas de arriba. Setting `seo.sitemap_min_tags` en el seed.
4. `app/sitemap.ts` — `/`, `/legales`, `/registrar-negocio`, las 301 de zona (aunque las páginas
   lleguen en F2: se agregan **junto con** las páginas, no antes — un sitemap que promete 404 es
   peor que uno corto), y las fichas de `fichasParaSitemap()` con `lastModified = updated_at`.
   ⇒ **En F1 el sitemap sale con ~1.130 URLs; F2 le suma las 301.**
5. El eje de `noindex`: decisiones 10 y 11.
6. JSON-LD `LocalBusiness` en la ficha, solo con datos propios (decisión 14).

### F2 — Las páginas de zona (lo que rinde)

7. `app/salir/[zona]/page.tsx` — hub de la zona: `<h1>` «Salir en \<Zona\>», conteo real, los
   tipos disponibles con su conteo linkeados, las primeras 20 fichas de la zona, links a las
   zonas de la misma región.
8. `app/salir/[zona]/[tipo]/page.tsx` — `<h1>` «\<Tipo en plural\> en \<Zona\>», bajada con el
   conteo, 20 fichas, los otros tipos de la zona, la misma tipo en las zonas vecinas, CTA a la
   búsqueda filtrada.
9. `generateStaticParams` + `revalidate = 86400` + `dynamicParams = false` en las dos rutas
   (decisión 5), alimentados por `paginasDeZonaTipo()`.
10. `generateMetadata` en las dos: `<title>`, `description`, `canonical` y `openGraph` heredando
    la imagen del padre. ⚠️ **Ojo el comentario de `app/lugar/[id]/page.tsx:49-55`**: declarar
    `openGraph` en una página **pisa el del padre entero**, imagen incluida.
11. `BreadcrumbList` + `ItemList` en JSON-LD (decisión 14); breadcrumb visible en la ficha
    (decisión 13).
12. El bloque «Explorá por barrio» en el estado vacío de la home (decisión 12).
13. El sitemap suma las 301.

### F3 — Medición (sin código)

14. ~~Alta de `adondesalimos.com.ar` en Google Search Console, envío del sitemap.~~
    **✅ 2026-08-23.** Propiedad de tipo **Dominio** (no de prefijo): cubre `www`, sin `www`,
    `http`/`https` y los subdominios —`fotos.adondesalimos.com.ar` incluido— en una sola, a
    cambio de verificar por DNS. El TXT se agregó en **Cloudflare**, que es donde vive la zona
    (`DEPLOY` decisión 1), **sin tocar** `send.*` ni `resend._domainkey.*`.
    ⚠️ **En una propiedad de Dominio el sitemap se envía con la URL absoluta**
    (`https://adondesalimos.com.ar/sitemap.xml`): con el nombre pelado Search Console responde
    *«Dirección de sitemap no válida»*, porque sin prefijo fijo no sabe qué host es. Costó un
    rebote; queda escrito para el próximo que dé de alta una propiedad acá.
15. **A los 60 días de F2**: páginas indexadas vs enviadas, impresiones y clics por tipo de
    página (zona vs ficha), y las queries reales. De ahí salen los tres gates de la decisión 15.

---

## Criterios de done (DoD)

**F1 — cimientos**

- [ ] `lib/app-url.ts` existe y es el **único** lugar con el fallback de la URL base:
      `grep -rn "BETTER_AUTH_URL ?? " lib app` devuelve **1 sola** ocurrencia (la de `lib/app-url.ts`).
- [ ] `lib/lugar/url.ts` exporta `urlDeLugar(id)` y `grep -rn "\`/lugar/\${" app lib components`
      devuelve **0** ocurrencias fuera de `lib/lugar/url.ts`.
- [ ] `lib/seo/paginas.ts` existe; sus queries usan `publishedWhere` o `publishedSql`
      (`grep` lo confirma) y **ninguna** reimplementa `operating_status`/`confidence` a mano.
- [ ] El umbral del sitemap se lee de `app_settings['seo.sitemap_min_tags']` y está en el seed
      con valor `3`. Un `UPDATE` a `5` cambia la cantidad de fichas del sitemap sin redeploy.
- [ ] `GET /sitemap.xml` responde 200, es XML válido, todas sus URLs son **absolutas** y arrancan
      con el valor de `lib/app-url.ts`.
- [ ] El sitemap **no** contiene: `/api/`, `/admin`, `/votacion/`, `/cuenta`, `/mis-lugares`,
      `/mis-votaciones`, `/mi-negocio`, `/reclamar`, `/chat`, ni ninguna URL con `?`.
- [ ] Toda ficha listada en el sitemap está publicada según `isPlacePublished` — verificado con un
      `SELECT` que cruce los ids del sitemap contra `publishedWhere` y devuelva **0 filas** de
      diferencia.
- [ ] `/` sin parámetros **no** emite `noindex`; `/?z=palermo-soho` **sí** emite
      `noindex, follow`. Idem `/registrar-negocio` pelada vs `?q=`.
- [ ] `/votacion/<token>` emite `noindex, nofollow`, y también lo emiten `/chat`, `/cuenta`,
      `/mis-lugares`, `/mis-votaciones`, `/mi-negocio/<id>` y `/reclamar/<id>`.
- [ ] La ficha emite un `<script type="application/ld+json">` con `@type` `LocalBusiness` (o el
      subtipo del Tipo), y **sin** `aggregateRating`, `openingHours` de Google, `priceRange` ni
      `image` de Google. **Hay un test que falla si alguna de esas claves aparece** — mismo
      criterio que los tests del field mask de FICHA.

**F2 — páginas de zona**

- [ ] Existen `/salir/<zona>` para las **46** zonas de `lib/zones/canon.ts` y devuelven 200.
- [ ] Existen `/salir/<zona>/<tipo>` exactamente para los combos con **≥ `PISO_PAGINA_ZONA`**
      lugares publicados; un combo por debajo del piso devuelve **404**.
- [ ] `paginasDeZonaTipo()` es la **única** fuente de esa lista: `generateStaticParams` y
      `app/sitemap.ts` la llaman a ella, no arman la lista por su cuenta (verificable por `grep`).
- [ ] `/salir/palermo-soho/bar` trae en el HTML del **server** (no del cliente) el `<h1>` con la
      keyword, el conteo real y ≥10 nombres de lugares — verificado con `curl | grep`, no en
      pantalla: es lo que ve el crawler.
- [ ] El listado de esas páginas sale de `searchPlaces`/`countPlaces` — cero SQL nuevo para el
      cuerpo (verificable por `grep`: `lib/seo/paginas.ts` no consulta `place_tags` para listar).
- [ ] Las páginas son estáticas: `revalidate = 86400` y `dynamicParams = false` declarados en las
      dos rutas, y el `build` las emite como estáticas (aparecen con `●` / `○` en la salida de
      `next build`, no como `ƒ`).
- [ ] Cada `/salir/<zona>/<tipo>` linkea a ≥3 páginas hermanas y a la búsqueda filtrada; cada
      `/salir/<zona>` linkea a todos sus tipos con página propia.
- [ ] La ficha muestra un breadcrumb visible `Inicio › <Zona> › <Tipo>` con links reales.
- [ ] La home **sin búsqueda** muestra el bloque «Explorá por barrio» con los 46 links; la home
      **con búsqueda** no lo muestra.
- [ ] `canonical` de `/salir/<zona>/<tipo>` apunta a sí misma, y `/?z=…&t=…` no compite (emite
      `noindex`).
- [ ] El sitemap incluye las 301 páginas y **cada una responde 200** (verificado recorriendo el
      sitemap, no de a muestras).
- [ ] Copy en argentino rioplatense en todo lo visible; cero prosa generada (decisión 6).
- [ ] `npm run typecheck`, los tests y `next build` en verde, **con el dev server parado**.

**F3 — medición**

- [x] La propiedad está dada de alta en Search Console y el sitemap enviado, con la fecha anotada. **✅ 2026-08-23** — sitemap aceptado («Se ha enviado el sitemap correctamente»), 1.431 URLs.
- [ ] A los 60 días: la lectura queda escrita en el BACKLOG con los tres gates de la decisión 15
      resueltos (se abren o se cierran con número, no con impresión).

---

## Edge cases

| Caso | Qué pasa |
|---|---|
| Un lugar cae en **2 zonas** por el buffer de 400 m (decisión 5 de ZONAS) | Aparece en las dos páginas. Es correcto y no es contenido duplicado: las páginas son distintas, comparten algunos ítems. Por eso `suma(combos) = 26.005 > 18.994`. |
| Un combo cruza el piso hacia arriba entre builds | No aparece hasta el próximo build/revalidación. Aceptable: el catálogo se mueve solo con un re-import manual de Overture. |
| Un combo cae por debajo del piso | Su página sigue viva hasta el próximo build y muestra menos de 10 lugares. No se rompe nada. |
| `DATABASE_URL` no resuelve en el build | **El build falla.** Es lo correcto (decisión 5): mejor no deployar que deployar 301 páginas vacías. Neon Free suspende por inactividad pero despierta al conectar. |
| Una ficha del sitemap se despublica | Sale del sitemap en la próxima revalidación. Mientras tanto la ficha ya da 404 (decisión 23 de FICHA), así que Google la desindexa sola. |
| Zona sin ningún tipo por encima del piso | No puede pasar: la zona más flaca tiene 181 publicados. Igual, la página de zona no depende de eso (decisión 4). |
| El re-import de Overture cambia el nombre de un lugar | No afecta ninguna URL: el slug se difirió (decisión 9). Es parte del motivo de diferirlo. |

---

## QA manual (IDs propuestos)

| ID | Caso | Criterio |
|----|------|----------|
| SEO-01 | `GET /sitemap.xml` | 200, XML válido, todas las URLs absolutas con el dominio de `lib/app-url.ts` |
| SEO-02 | Contar URLs del sitemap por tipo | ~1.123 fichas + ~301 zona + 3 estáticas; ninguna con `?` |
| SEO-03 | Cruzar los ids de ficha del sitemap contra `publishedWhere` con un `SELECT` | diff = 0 |
| SEO-04 | `UPDATE app_settings SET value='5' WHERE key='seo.sitemap_min_tags'` y recargar | La cantidad de fichas baja a ~576, **sin redeploy** |
| SEO-05 | `grep` de `BETTER_AUTH_URL ??` y de `` `/lugar/${ `` en el repo | 1 y 0 ocurrencias respectivamente, fuera de sus dueños |
| SEO-06 | `curl /` vs `curl "/?z=palermo-soho"` | La primera sin `noindex`; la segunda con `noindex, follow` |
| SEO-07 | `curl /votacion/<token>` | `noindex, nofollow` en el HTML, y la votación **sigue funcionando** (votar, ver resultado) |
| SEO-08 | `curl` sobre `/chat`, `/cuenta`, `/mis-lugares`, `/mis-votaciones`, `/mi-negocio/<id>`, `/reclamar/<id>` | Los seis con `noindex` |
| SEO-09 | JSON-LD de una ficha con match de Google resuelto | `LocalBusiness` presente; **cero** claves de rating/horarios/precio/imagen de Google |
| SEO-10 | Test automático del JSON-LD de la ficha | Falla si se agrega una clave prohibida (regresión de ToS) |
| SEO-11 | `/salir/palermo-soho` | 200, `<h1>` con la zona, tipos con conteo, 20 fichas, links a la región |
| SEO-12 | `/salir/palermo-soho/bar` con `curl \| grep` | `<h1>` «Bares en Palermo Soho», conteo real, ≥10 nombres **en el HTML del server** |
| SEO-13 | Un combo bajo el piso, ej. `/salir/florencio-varela/wine-bar` | **404** (no una página vacía ni un redirect) |
| SEO-14 | Recorrer las 301 URLs del sitemap con `curl -o /dev/null -w "%{http_code}"` | 301 × 200. Cero 404 |
| SEO-15 | Salida de `next build` | Las rutas de `/salir` figuran como estáticas, no como `ƒ (Dynamic)` |
| SEO-16 | Home sin búsqueda vs con búsqueda | El bloque «Explorá por barrio» aparece solo en la primera, con 46 links |
| SEO-17 | Breadcrumb de la ficha | Visible, con links que resuelven a `/salir/<zona>` y `/salir/<zona>/<tipo>` |
| SEO-18 | `canonical` de `/salir/palermo-soho/bar` | Apunta a sí misma, absoluta |
| SEO-19 | Preview del link de `/salir/palermo-soho/bar` en WhatsApp | Trae la imagen de `app/og/route.tsx` (no se perdió al declarar `openGraph`) |
| SEO-20 | 390×844, las dos páginas nuevas | Sin desbordes horizontales; el bloque de links hermanas no empuja la pantalla |
| SEO-21 | Tiempo del `next build` antes vs después | Anotado. Si las 301 páginas lo vuelven inviable en Hobby, es dato para revisar la decisión 5 |

Al correr el QA de F2 salieron nueve criterios más, de arquitectura y no de pantalla —**`SEO-22` a
`SEO-30`**: fuente única de la lista de combos, cero SQL nuevo, `publishedWhere` en todas las
queries, el piso de links hermanos, el JSON-LD sin datos de Google, el **escape único de `<`**, que
las rutas sean estáticas de verdad, cero prosa generada y los tres pisos sin contaminarse. Viven en
`docs/qa/AnalisisQA.md` § *QA /qa-spec — SEO F2*; acá se nombran para que el próximo que lea esta
tabla no crea que el QA fueron 21 casos.

---

## Relación con otros specs

- **`DEPLOY`** — este spec **reabre** su § *v2*: «Sitemap» y «Slug SEO en la URL de la ficha»
  estaban fuera de scope. El sitemap entra; el slug se difiere con gate (decisión 9). Hay que
  anotarlo allá al cerrar, o el próximo que lea `DEPLOY.md:444` va a creer que sigue en pie.
- **Ítem 3 del BACKLOG (curaduría de cobertura)** — la decisión 8 los conecta de verdad: el
  umbral en `app_settings` hace que **cada lugar curado sea una página que pasa a ofrecerse a
  Google**. La curaduría deja de ser solo cobertura de filtros.
- **`ORDEN_ORGANICO`** — es lo que hace que las páginas de zona linkeen las fichas buenas
  primero, sin escribir una regla nueva (decisión 13).
- **`FICHA`** — la decisión 14 es su decisión 16 aplicada al JSON-LD. Mismo ToS, misma trampa.
- **`BUSQUEDA`** — la decisión 10 declara que su URL de estado (`/?z=…&t=…`) **no es** la URL
  canónica de cara a Google. Las dos conviven: una es estado de app, la otra es landing.
- **`GEO`** ([`planned/GEO.md`](../planned/GEO.md), 2026-08-22) — la postura frente a los
  crawlers de IA (**abrir y declararlo**) y la superficie que hoy no existe: entidad
  estructurada + `/como-funciona`. **No reabre nada de acá** —sitemap, umbral, 301 landings,
  piso y slug diferido quedan igual—, pero **le suma un instrumento a F3**: desde junio 2026
  Search Console tiene un **reporte de rendimiento de IA generativa** (impresiones por página,
  país, dispositivo y fecha, **sin clics y sin queries**). ⚠️ Al leer F3, mirarlo junto al
  reporte normal, y complementarlo con los **referrers** de `chatgpt.com`, `perplexity.ai`,
  `claude.ai` y `gemini.google.com` en Vercel Analytics — que es lo único que da clics.
- **`TITULARIDAD` / `AUTH`** — una ficha reclamada gana contenido de dueño ⇒ cruza el umbral del
  sitemap sola. Hoy son 2 lugares.

## v2 (fuera de scope)

- El slug de la ficha (decisión 9, con gate).
- El eje Cocina (decisión 2, con gate).
- `noindex` sobre las fichas flacas (decisión 7, con gate).
- Páginas por Ambiente/Momento («terrazas en Palermo»): dependen de una cobertura que hoy es del
  5-6%.
- `hreflang`, versiones AMP, y cualquier cosa multi-idioma: la app es de AMBA, en español.
- Google Business Profile, backlinks, prensa: son canales, no código.
