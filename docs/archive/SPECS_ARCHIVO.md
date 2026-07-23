# Specs implementados — resumen operativo

Qué quedó construido, dónde vive y contra qué se verificó. Es el índice para entrar rápido
a un feature cerrado sin releer el spec entero. El spec completo sigue en `docs/specs/done/`.

---

## Catálogo + import de Overture {#catalogo}

**Spec:** [`docs/specs/done/CATALOGO.md`](../specs/done/CATALOGO.md) · ✅ Implementado (2026-07-20)
**QA:** [`docs/qa/AnalisisQA.md`](../qa/AnalisisQA.md) § *QA /qa-spec — CATALOGO* — APROBADO, 13 criterios PASS

**Qué hace:** crea el catálogo sobre el que se apoyan Zonas, Búsqueda, Ficha y el reclamo de
dueño. Modelo de datos propio persistido desde Overture Maps, taxonomía de 6 facetas como
datos semilla, y la regla de publicación con umbral editable en caliente.

**Alcance implementado:**

- **Schema** (`lib/db/schema.ts`): `places` · `tags` · `place_tags` · `app_settings` + enums
  `facet`, `place_source`, `place_tag_source`. Una sola tabla `places` para Overture y
  dueños. `google_place_id` y `publish_override` nacen vacías para los specs 4 y 5.
  Migración `drizzle/0000_complex_mister_sinister.sql`.
- **Taxonomía** (`lib/db/taxonomy.ts`): **105 filas** = 96 tags + 9 padres de Cocina. Los
  `slug` son **contrato** — Búsqueda y Ficha filtran por ellos y viven en URLs compartibles.
- **Seed** (`scripts/seed.ts`, `npm run db:seed`): idempotente por `slug`. Nunca pisa
  `active` (curaduría) ni los settings ya modificados.
- **Import** (`scripts/import-overture.ts`, `npm run import:overture`): DuckDB contra el
  parquet S3 de la release `2026-06-17.0`, bbox AMBA. Construido sobre `taxonomy`, **nunca**
  sobre `categories`. Idempotente por `overture_id`. Resultado: **26.057 lugares**.
- **Selección de categorías** (`scripts/overture/categories.ts`): allowlist + denylist
  explícita (`ice_cream_shop`, `bakery`, `dessert_shop`) por el principio *salida vs compra*.
  Mapeo categoría→tags en `scripts/overture/tag-map.ts`.
- **Regla de visibilidad** (`lib/db/visibility.ts`, reexportada desde `lib/db`): fuente
  **única** — `isPlacePublished()` en memoria y `publishedWhere()` como condición SQL.
  Búsqueda y Ficha la consumen tal cual; no reimplementar la regla en cada query.
- **`/legales`** (`app/legales/page.tsx`): atribución de las 9 fuentes de Overture con sus 3
  licencias + Google. Linkeada desde el footer de la home.

**Lo que hay que saber para el próximo spec:**

- Se importa **todo** sin cortar por confidence: **7.064** lugares quedan bajo el umbral,
  persistidos e invisibles. Bajar el umbral los revive sin volver a S3.
- El umbral se lee de `app_settings` en **runtime**: un `UPDATE` cambia el catálogo
  publicado sin redeploy (0.5 → 18.993 publicados; 0.7 → 13.035).
- **`operating_status` viene NULL en el 100% de los datos de AMBA** y se persiste como
  `'open'`. El filtro existe y se aplica siempre, pero hoy no descarta a nadie — Búsqueda
  **no debe asumir** que ya filtra lugares cerrados. Ver hallazgo H-2 del QA.
- **Nada de Google se persiste** salvo `google_place_id` (hoy vacía). No hay columnas para
  nombre, horarios, rating ni fotos: es prohibición del ToS, no un olvido.

---

## Zonas de AMBA {#zonas}

**Spec:** [`docs/specs/done/ZONAS.md`](../specs/done/ZONAS.md) · ✅ Implementado (2026-07-20)
**QA:** [`docs/qa/AnalisisQA.md`](../qa/AnalisisQA.md) § *QA /qa-spec — ZONAS* — APROBADO, 15 criterios PASS

**Qué hace:** convierte "primero elegís zona" —el gesto default de la búsqueda— en datos. Las
46 zonas de salida de AMBA como polígonos versionados, y la asignación lugar→zona
**precomputada**, para que el runtime no haga geometría.

**Alcance implementado:**

- **Schema** (`lib/db/schema.ts`): `zones` (con `polygon` y `polygon_search`) · `zone_aliases` ·
  `place_zones` + enum `region` (`caba · norte · oeste · sur`). Migración
  `drizzle/0001_great_bloodstorm.sql`. No toca `places`.
- **Canon** (`lib/zones/canon.ts`): las **46 zonas** (21 CABA · 9 Norte · 7 Oeste · 9 Sur) +
  4 alias semilla. Los `slug` son **contrato** — Búsqueda filtra por ellos y viven en URLs.
- **Polígonos** (`data/zones/`, 46 GeoJSON, 1,14 MB): CABA de BA Data (**CC BY 2.5 AR**),
  conurbano del IGN vía WFS (**Ley 27.275**). **Nunca OSM** (ODbL). Composición y licencias
  documentadas en `data/zones/README.md`.
- **Build** (`scripts/zones/build.ts`, `npm run zones:build`): tres técnicas — *merge* de
  polígonos oficiales, *recorte* de un anillo dibujado a mano, y **remanente** (la base menos
  lo ya recortado). El remanente hace que las particiones sean exactas **por construcción**.
  Falla si un centroide conocido cae en la zona equivocada.
- **Carga** (`scripts/zones/load.ts`, `npm run zones:load`): idempotente por `slug`, nunca
  pisa `active`. Materializa `polygon_search` con `turf.buffer` de **400 m**.
- **Asignación** (`lib/zones/asignar.ts` + `scripts/zones/assign.ts`, `npm run zones:assign`):
  point-in-polygon con turf, con descarte previo por bounding box. Regenera `place_zones`
  entero en transacción. **El núcleo vive en `lib/` porque el spec 5 lo reusa** para asignar
  un lugar de dueño al crearlo.

**Lo que hay que saber para el próximo spec:**

- **23.857 lugares (91,6%) tienen zona; 2.200 (8,4%) no.** Cero filas en `place_zones` es un
  estado **válido** (decisión 17), no un bug: Búsqueda debe tolerarlo. Esos lugares no
  aparecen filtrando por zona, sí por texto y GPS.
- **El hueco no está donde el spec creía.** No son bordes del bbox: son partidos densos que el
  canon de 46 no enumera (José C. Paz, Laferrere, Gral. Rodríguez, González Catán, Hurlingham,
  Ezeiza). Decisión pendiente en `BACKLOG.md`.
- **La primaria es única y puede no existir.** 390 lugares tienen zona de búsqueda pero no
  primaria: están dentro del buffer de 400 m sin caer en ningún polígono exacto. La card debe
  manejar "sin zona primaria".
- **`place_zones` se regenera entero**, así que cualquier dato que se le cuelgue se pierde en
  el próximo `zones:assign`. No agregar columnas con estado propio ahí.
- **`places.locality` no es confiable fila por fila** (3 lugares de La Matanza vienen
  etiquetados "Ciudad de Buenos Aires"). Sirve como señal agregada, no como verdad puntual.

---

## Búsqueda + filtros {#busqueda}

**Spec:** [`docs/specs/done/BUSQUEDA.md`](../specs/done/BUSQUEDA.md) · ✅ Implementado (2026-07-20)
**QA:** [`docs/qa/AnalisisQA.md`](../qa/AnalisisQA.md) § *QA /qa-spec — BUSQUEDA* — APROBADO, 12 criterios PASS (BUSQ-QA-09 cerrado con QA en vivo por Playwright)

**Qué hace:** es la app para el consumidor. Home = Search (`/`): selector de zona + campo de
texto + chips de Ocasión + filtros + resultados en lista o mapa, todo público y sin login.
Motor de búsqueda en Postgres sobre el catálogo publicado, con la URL como estado compartible.

**Alcance implementado (3 fases, todas cerradas):**

- **F1 — Motor + lista.** Migración `drizzle/0002_last_christian_walker.sql`: `occasion_chips` ·
  `chip_tags` · `place_impressions_daily` + extensiones `unaccent`/`pg_trgm` + índice GIN trgm.
  `lib/search/params.ts` (URL ↔ estado, coords **fuera** de la URL) · `lib/search/query.ts`
  (el motor: `EXISTS` por faceta, `zone_id IN` vía `place_zones` o Haversine si GPS,
  `word_similarity` con `immutable_unaccent` para pegarle al índice, cursor keyset con `id`
  como desempate). `/` como server component que lee searchParams. Rate limit por IP en memoria
  del proceso (`lib/middleware/`).
- **F2 — Selectores.** `lib/search/catalog.ts` (taxonomía con **conteo de publicados por tag**
  + 46 zonas con alias). Bottom sheet de zona (autocompletar + regiones + GPS) y sheet de
  filtros que editan un **borrador**; contador "Ver N lugares" en vivo vía `GET /api/search/count`
  (`countPlaces` reusa `construirWhere` de `searchPlaces`). Sugerencias del campo de texto sin
  roundtrip. **Decisión 27**: un tag con 0 publicados no se lista, y la faceta que queda vacía
  tampoco — así "Abierto ahora" y toda la faceta Precio desaparecen sin caso especial.
- **F3 — Chips + mapa + impresiones.** `lib/db/chips.ts` (17 chips: 9 objetivo + 8 V1,
  decisión 30) sembrados idempotentemente. Vista mapa `components/search/map-view.tsx`
  (MapLibre GL + tiles de OpenFreeMap, `next/dynamic ssr:false`) con clustering nativo, tope de
  **200 pins** (`GET /api/search/pins`, `searchPins`, mismo `where` y `clavesDeOrden` que la
  lista, test que compara pins vs lista elemento por elemento). Impresiones en `after()`
  (`lib/search/impressions.ts`, upsert que **suma**; los pins no cuentan). `/legales` con la
  línea de OSM/OpenFreeMap.

**Lo que hay que saber para el próximo spec (Ficha):**

- **Card y mini-card navegan a `/lugar/[id]`** — ahí termina Búsqueda y empieza Ficha. La card
  perdió el prop `rating` (no hay fuente legal); `location` es nullable (los ~390 sin primaria).
- **Los tags derivados vienen pegados a su Tipo por construcción del import** (`tag-map.ts`):
  cruzar Tipo con una Actividad/Ambiente/Momento que no sea su socio da casi siempre 0. No es
  bug del motor — la semántica AND funciona, los datos no la acompañan. Por eso los chips V1 son
  gruesos y 8 de los 9 objetivo nacen apagados (se prenden solos con curaduría, sin deploy).
- **La faceta Precio está vacía (0 filas en `place_tags`)** y Ambiente/Momento son ralas
  (0,9% / 0,6%): es la carga de curaduría más grande pendiente. Todo en `BACKLOG.md`.
- **Impresiones son agregado puro por día** (`place_id, date, impressions`), sin datos por
  usuario ni cookies: habilita el teaser B2B, y Monetización (spec 7) le cuelga el desglose.
- **`GET /api/search`, `/count` y `/pins`** comparten rate limit (60 req/IP/60 s) y la misma
  función de query — no reimplementar el `where` ni el orden en otro lado.

---

## Ficha del lugar + Google en vivo {#ficha}

**Spec:** [`docs/specs/done/FICHA.md`](../specs/done/FICHA.md) · ✅ Implementado (2026-07-20)
**QA:** [`docs/qa/AnalisisQA.md`](../qa/AnalisisQA.md) § *QA de fase — FICHA F1/F2/F3* — las 3 fases PASA. F3 con QA en vivo por Playwright (FICHA-10/11). F2 dejó un miss de matching documentado (FICHA-03, riesgo aceptado por Fer)

**Qué hace:** `/lugar/[id]` — la pantalla donde el usuario decide si va. Datos propios
(Overture + ZONAS) que se ven **enteros sin Google**, más enriquecimiento **en vivo** de
Google (horarios, rating, foto) con **cero persistencia** salvo el `place_id`. Es el primer y
único punto donde la app toca la API paga de Google, y donde se materializa la disciplina de
costos: catálogo propio gratis, Google solo acá, topes por SKU editables sin deploy.

**Alcance implementado (3 fases, todas cerradas):**

- **F1 — Ficha propia.** Migración `drizzle/0003_adorable_nightshade.sql` (modelo **completo**
  del spec de una vez, DDL aditivo): enum `google_match_status` + `google_matched_at` en
  `places`, tablas `place_photos` (vacía) y `google_api_usage` (contador por SKU),
  `detail_views` en `place_impressions_daily`, 3 claves de `app_settings` (topes + retry).
  `lib/lugar/query.ts` (`getPlaceDetail`, dedupe `React.cache`, gate por `isPlacePublished`) ·
  `lib/lugar/ficha.ts` (helpers puros: `precioDeTags`, `queEncontras`, `comoLlegarUrl` deep
  link, `fotoPrincipal` prioridad dueño→Google→placeholder, `clasificarRed`) ·
  `app/lugar/[id]/page.tsx` (server component, OG con **solo datos propios**, `detail_views`
  en `after()`).
- **F2 — Google en vivo.** `lib/google/places.ts` (**único** módulo que habla con Google,
  server-only + guard de runtime): field masks exactos (`TEXT_SEARCH_FIELD_MASK = places.id`
  $0 · `PLACE_DETAILS_FIELD_MASK` Enterprise sin Atmosphere), `resolvePlaceId` (matching a
  ciegas con `locationRestriction` ±300 m, decisión 8), `fetchPlaceDetails` (no-store, timeout
  2,5 s). `lib/google/usage.ts` (contadores por SKU) + `lib/google/settings.ts` (topes de
  runtime). `lib/lugar/enrichment.ts` (`resolverEnriquecimiento` **puro e inyectable**: estados
  de match, reintento, tope — ningún camino sin datos gasta) + `lib/lugar/matching.ts` (capa de
  datos, revalida visibilidad). `GET /api/lugar/[id]/google` (adaptador fino, rate limit,
  204 sin datos). `app/robots.ts` bloquea `/api/`. Cliente `components/lugar/ficha-google.tsx`.
- **F3 — Foto y atribución.** `parseFotoCandidata` (una sola foto, decisión 14) + `fetchFotoUri`
  (media endpoint con `skipHttpRedirect=true` ⇒ `photoUri` efímero, la key nunca sale al
  browser, decisión 15) en `places.ts`; `fetchPlaceDetails` devuelve `DetailsResult` (DTO +
  candidata) de **una sola** request paga. `enrichment.ts` agrega el paso de foto: **cuota
  `photos` contada antes del media call**, y **foto de dueño presente ⇒ cero request a Google**
  (`getPlaceForEnrichment` chequea `place_photos` en el server, autoritativo). `ficha-google.tsx`
  reescrito como **shell de un solo fetch**: envuelve foto (arriba) + header (`children`,
  server-rendered) + bloque de datos (abajo) ⇒ un único Place Details por apertura. Crédito al
  autor sobre la foto + link al original + **logo oficial de Google** (SVG inline) sobre los
  datos en vivo.

**Disciplina de costos (la línea entre $0 y la factura):**

- **Matching gratis:** Text Search *IDs-Only* (`places.id`); Details *Enterprise* nunca
  *Atmosphere*; **una** foto por ficha. Hay tests que fallan si el field mask trae un campo de
  más — no relajarlos.
- **Cero persistencia/caché** de datos de Google salvo `place_id` (ToS): `cache:'no-store'`,
  ruta dinámica, sin `revalidate`. El `photo name` no se guarda **ni se expone al cliente**
  (`FotoCandidata` es server-only).
- **El gasto se dispara desde el cliente**, no en el render (los crawlers no pagan); `robots.txt`
  bloquea `/api/`. **Un solo fetch** por apertura (el shell), nunca dos Place Details.
- **Topes por SKU** en `app_settings` contados en `google_api_usage`: superado el tope, la
  ficha **degrada** al modo sin Google. Bajar un tope a 0 apaga el SKU sin deploy.

**Lo que hay que saber para el próximo spec (Auth/reclamo, spec 5):**

- **`place_photos` ya existe y la ficha ya prioriza sus fotos** sobre Google (FICHA-10, con
  test + QA en vivo): el spec 5 solo tiene que **llenarla**; el camino dueño→Google no se toca.
- **`detail_views` cuenta aperturas** (agregado por día, sin datos por usuario): el panel del
  dueño y Monetización (spec 7) le cuelgan el desglose.
- **Los huecos de descripción/carta/novedad** están previstos en el layout; el botón "¿Sos el
  dueño?" quedó fuera de v1 a propósito (sin flujo detrás sería promesa vacía).
- **Riesgo abierto (FICHA-03):** el matching a ciegas puede pegarle a un local vecino de la
  misma marca dentro de los 300 m. Riesgo aceptado; medir la tasa con un spot-check de ~10
  fichas antes de tocar el radio. Ver BACKLOG y LECCIONES.

---

## Auth + roles + reclamo de negocio {#auth}

**Spec:** [`docs/specs/done/AUTH.md`](../specs/done/AUTH.md) · ✅ Implementado (2026-07-22)
**QA:** [`docs/qa/AnalisisQA.md`](../qa/AnalisisQA.md) § *QA /qa-spec — AUTH* — APROBADO (un DoD diferido: UI del botón OAuth). QA por fase: § AUTH F2 · F3 · F4

**Qué hace:** convierte el catálogo 100% Overture en uno editable por sus dueños. Auth con
better-auth (registro único, email verificado obligatorio, consumidor anónimo por default),
reclamo/alta de negocio con cola de aprobación manual en `/admin`, panel "Mi negocio" (datos,
tags, fotos a R2, contenido pago gateado por plan, horarios propios) y la ficha consumiendo
todo eso con prioridad dueño → Overture/Google. Es la pata B2B: habilita specs 6 (votación) y 7
(monetización).

**Alcance implementado (4 fases):**

- **F1 — Auth base** (`lib/auth/`, `app/(auth)/`, tablas better-auth): drizzleAdapter,
  email+password con `requireEmailVerification: true` (divergencia explícita con StressPlan),
  mails por Resend, `/cuenta` mínima, entrada de cuenta en el header, rate limit de auth
  (20/h/IP). Sin columna `role`: admin = `ADMIN_EMAIL`, dueño = derivado de reclamo aprobado.
- **F2 — Reclamo + alta + cola** (`lib/claims/`, `app/registrar-negocio`, `app/reclamar/[id]`,
  `app/admin`, `/api/claims`, `/api/admin/claims/[id]`): tabla `place_claims` (reclamo y
  propiedad = misma fila, único aprobado por lugar por índice parcial). "Registrá tu negocio"
  busca el catálogo completo (visibles e invisibles) → reclamo o alta con pin MapLibre + zona
  por turf. Aprobar ⇒ `publish_override=true` + mail; revocar = rechazar un aprobado.
- **F3 — Panel + contenido** (`lib/negocio/`, `lib/storage/r2.ts`, `app/mi-negocio`): tabla
  `place_owner_content` (1-a-1, COALESCE dueño → base vía `resolverContenidoDueno`), tags con
  `source='owner'`, fotos a R2 (único módulo server-only, caps 3 free/15 pago con `FOR UPDATE`),
  `owner_plan` + gating de los 3 campos pagos server-side, huecos en la ficha, teaser de stats.
- **F4 — Horarios propios** (`lib/negocio/horarios.ts`): editor semanal (rangos `hh:mm` que
  cruzan medianoche), la ficha prioriza horarios del dueño sobre Google, cálculo abierto/cerrado
  en TZ `America/Argentina/Buenos_Aires`. **Sin migración** (usó la columna `opening_hours` que
  F3 creó con la tabla). **Field mask de Google intacto** (el ahorro de la decisión 20 es de UI).

**Reglas críticas que hereda el próximo spec:**

- **Lo que edita el dueño NUNCA va a las columnas base de `places`** (el re-import las pisa): va
  a `place_owner_content` y la ficha resuelve `COALESCE(dueño → base)`. El re-import tampoco
  toca las tags de un lugar reclamado.
- **El contenido del dueño se aplica solo mientras haya reclamo aprobado** (`getPlaceDetail`
  condiciona el COALESCE y los horarios a `reclamado`). Revocar/eliminar cuenta devuelve la
  ficha a Overture **sin borrar la fila** — ocultar ≠ borrar, en los dos ejes (contenido y plan).
- **`owner_plan` se aplica server-side desde el día 1** (3 vs 15 fotos, 3 campos pagos): "subir
  un cupo es un regalo; bajarlo es una traición". Hasta el spec 7 se cambia con un `UPDATE`.
- **Cálculo de "abierto ahora" client-side, tras montar** (evita hydration mismatch); el cruce
  de medianoche mira el día anterior; TZ fija por `Intl`, no por el reloj de quien mira.
- **Fotos: la fila de `place_photos` se inserta DESPUÉS del PUT a R2** (nunca URL huérfana).

**Deferrals aceptados (a BACKLOG, no bugs):** UI del botón de Google OAuth (F1, la config lo
soporta) · fotos no se ocultan al revocar (F3, gatearlas tocaría la prioridad de FICHA) ·
filtro "Abierto ahora" en búsqueda (F4 empieza a acumular la masa de horarios que lo destraba).

---

## Votación en grupo {#votacion}

**Spec:** [`docs/specs/done/VOTACION.md`](../specs/done/VOTACION.md) · ✅ Implementado (2026-07-22)
**QA:** [`docs/qa/AnalisisQA.md`](../qa/AnalisisQA.md) § *QA /qa-spec — VOTACION* — APROBADO, 15 criterios PASS (VOT-01..15 + NOEXPO)

**Qué hace:** el **loop viral** del producto. Un usuario con cuenta arma una shortlist de 2-5
lugares publicados (reusando la búsqueda) y obtiene un link compartible; cualquiera vota **sin
registrarse** (identidad = cookie por dispositivo, no la IP); resultados en vivo; el creador
cierra y elige el ganador. Free = 1 votación activa; el tramo premium queda modelado y gateado
pero apagado (lo enciende el spec 7).

**Alcance implementado (3 fases):**

- **Schema** (`lib/db/schema.ts`): `polls` · `poll_options` · `poll_votes` + `users.plan`
  (`user_plan` enum `free`/`premium`) + `poll_status` enum. Índices únicos: `polls.token`,
  `poll_votes (poll_id, voter_token)`, `poll_options (poll_id, place_id)`. Migración
  `drizzle/0007_broad_sharon_carter.sql` (aditiva).
- **Dominio** (`lib/votaciones/`): `acciones.ts` (`crearVotacion` con gate "1 activa" +
  `FOR UPDATE` del usuario · `votar` upsert · `cerrarVotacion`/`cancelarVotacion` solo creador) ·
  `query.ts` (`getVotacionPublica` con expiración lazy · `getResultados` · `misVotaciones`
  gateada por plan) · `estado.ts` (helpers puros: `estaActiva`/`estaExpirada`/`estadoVisible`) ·
  `planes.ts` (`esPremium`) · `token.ts` · `validacion.ts` · `constantes.ts`.
- **API**: `POST /api/votaciones` (crear) · `POST /api/votaciones/[token]/voto` (votar, setea
  cookie `voter_id`) · `GET /api/votaciones/[token]` (resultados en vivo) · `PATCH` (cerrar/
  cancelar). Envelope `{ data, error }` + `STATUS_POR_CODIGO`, patrón de `claims`.
- **Rutas** (`app/`): `votacion/nueva` (picker con búsqueda embebida) · `votacion/[token]`
  (pública, server-render sin Google, OG estático, conteo en vivo por polling) ·
  `mis-votaciones` (panel del creador). Entrada "Armar votación"/"Mis votaciones" en el menú.
- **Rate limit** (`lib/middleware/rate-limit.ts`): `checkVotacionesRateLimit` (3/día/IP, cupo
  propio) · `checkVotoRateLimit` (20/min/IP).
- **Tests**: 50 nuevos en `lib/votaciones/__tests__/` (2 puros + 3 de integración contra la base).

**Lo que hay que saber para el próximo spec (7 — MercadoPago):**

- **`users.plan` es el flag premium del usuario** (espejo B2C de `owner_plan`). Se consulta
  server-side con `esPremium`, **nunca viaja en la sesión** (no se usó `additionalFields` de
  better-auth): así bajar el plan es inmediato. El spec 7 lo automatiza con MercadoPago; hoy es
  un `UPDATE` a mano. Puede migrar a `user_subscriptions` si el cobro pide datos de suscripción.
- **El tramo premium está construido y apagado**: gate "1 activa" saltea premium, historial de
  `/mis-votaciones` gateado en la query, botón "IA arma shortlist" visible solo a premium con
  `onClick` no-op. Encenderlo = permitir cambiar `users.plan` (spec 7) + construir la IA (spec 8).
- **La cookie `voter_id` es httpOnly y se crea en el primer voto** (no en el render): un Server
  Component no puede escribir cookies y no hay `middleware.ts`. Divergencia menor de la decisión
  7 ("al abrir el link se setea"), funcionalmente idéntica para el dedupe. Ver LECCIONES.
- **Expiración lazy, sin cron**: "activa" = `status='open' AND expires_at > now()`; al leer una
  vencida se persiste `status='closed'` best-effort. Una expirada no bloquea el gate "1 activa".
- **`poll_options.place_id` y `polls.winner_place_id` NO cascadean** al borrar un place (a
  propósito: un lugar no se borra por debajo de una votación). En tests, borrar el usuario
  primero (cascade de polls) antes que los places.
