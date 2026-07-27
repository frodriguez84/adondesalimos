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

---

## Home + identidad — paleta real y estado vacío con onda {#home_identidad}

**Spec:** [`docs/specs/done/HOME_IDENTIDAD.md`](../specs/done/HOME_IDENTIDAD.md) · ✅ Implementado (2026-07-23)
**QA:** [`docs/qa/AnalisisQA.md`](../qa/AnalisisQA.md) § *QA /qa-spec — HOME_IDENTIDAD* — APROBADO, 11 criterios PASS (3 checkers independientes + QA en vivo con Playwright)

**Qué hace:** reemplaza la paleta placeholder de dev (ámbar/negro heredado de StressPlan) por la
identidad real de `docs/product/IDENTIDAD.md` y le da onda al home, para que un link compartido
(votación/ficha) no parezca un proyecto a medio hacer. Ejecuta juntos, como una sola pasada
visual, los dos ítems de BACKLOG "identidad visual" y "home: pulido del estado vacío".

**Alcance implementado:**

- **Swap de paleta por tokens** (`app/globals.css`): acción primaria naranja `#FF8A00` (reemplaza
  ámbar `#F59E0B`, mismo contraste ⇒ casi drop-in), fondo azulado `#0D0D1F`, neutros con tinte
  azul (`#1A1A2E`/`#2A2A3E`), y tokens de categoría en `@theme`
  (`--color-rosa/violeta/turquesa/amarillo`). El grueso de la app cambia solo por variables.
- **Los tres focos fuera de los tokens** (+ un cuarto hallado en QA): `lib/email/index.ts` (hex a
  mano, CTA **color plano** no gradiente — Outlook los ignora), pins del mapa a rosa `#FF2D75`
  (`map-view.tsx`, `pin-picker.tsx`), **logo de Google intacto** (`ficha-google.tsx`), y la
  **estrella del rating** de `text-amber-500` (ámbar viejo) → `text-amarillo` (`#FFD400`).
- **Wordmark** (`components/shared/wordmark.tsx`): pin SVG con gradiente de marca + centro calado +
  texto ("salimos?" en naranja sólido). Reemplaza el `h1` de texto del header. Monocromo por
  diseño (a 28 px el gradiente sobre texto fino colapsa; el gradiente se reserva al hero grande).
- **Estado vacío = mini-landing** (`app/page.tsx` + `components/shared/rotating-headline.tsx`):
  hero con headline rotativo rioplatense ("¿Qué sale?"/"¿Qué pinta?"/"¿Qué hacemos?") + frase de
  valor; se colapsa apenas hay búsqueda. Rotación resuelta client-side tras montar (SSR índice 0)
  para evitar hydration mismatch (lección AUTH F4).
- **Favicon / app-icon:** del logomark aislado con transparencia real
  (`docs/product/assets/logo_2.png`, RGBA) → `app/icon.png` (recortado al pin) + `app/favicon.ico`.
  Cierra el 404 de `favicon.ico`.

**Archivos clave:** `app/globals.css` · `app/page.tsx` · `app/icon.png` · `app/favicon.ico` ·
`components/shared/wordmark.tsx` · `components/shared/rotating-headline.tsx` · `lib/email/index.ts` ·
`components/search/map-view.tsx` · `components/negocio/pin-picker.tsx` · `components/lugar/ficha-google.tsx`.

**Fuera de scope (anotado en BACKLOG):** header de marca global (el wordmark en el resto de las
páginas) + hero/OG con el logomark; y el filtro fantasma de tags con 0 lugares (BÚSQUEDA).

---

## Monetización (MercadoPago) {#monetizacion}

**Spec:** [`docs/specs/done/MONETIZACION.md`](../specs/done/MONETIZACION.md) · ✅ Implementado (2026-07-25)
**QA:** [`docs/qa/AnalisisQA.md`](../qa/AnalisisQA.md) § *MONETIZACION F1/F2/F3/F4* — las 4 fases APROBADO (MONE-01..18 + tests de integración/unit)

**Qué hace:** el **modelo de negocio entero**. Enciende el premium B2C (`users.plan`) que VOTACION
dejó modelado y el plan B2B **por lugar** (`owner_plan`) que AUTH dejó gateado a mano, con cobro
real por MercadoPago. La suscripción **mueve** los flags; los helpers de gating no se tocan
(decisión 8: el flag sigue siendo la única fuente, se consulta server-side en cada request). Suma
las dos features que venden el B2B (destaque en búsqueda + desglose de estadísticas) y el precio
editable en DB sin deploy.

**Alcance implementado (4 fases):**

- **F1 — Instrumentación + precios** (`drizzle/0008`): migración completa del modelo —
  `subscriptions` (índices únicos parciales: 1 B2C viva por usuario, 1 B2B viva por lugar) ·
  `subscription_payments` (guard `mp_authorized_payment_id` unique) · `place_taps_daily` ·
  `place_tag_impressions_daily` · `featured_impressions` en `place_impressions_daily` ·
  `app_settings_history`. Taps con `<TapLink>` (beacon best-effort) en la ficha → `POST
  /api/lugar/[id]/tap`; tags-por-búsqueda en el `after()` del batch de impresiones; precios en
  `app_settings` (`billing.precio_b2b_ars=15000`/`b2c_ars=7000`, seed idempotente) editables desde
  `/admin` con historial. Todo agregado puro (sin user_id/cookie/IP).
- **F2 — Cobro (MP)** (`lib/billing/*` portado de StressPlan): cliente `fetch` server-only
  (`mercadopago.ts`, **preapproval SIN plan pre-creado**, dec.10), `validateWebhookSignature` tal
  cual, renovación idempotente (guard UNIQUE solo-al-aprobar + `FOR UPDATE`), lazy check + gracia
  3 días. Endpoints `checkout`/`cancel`/`webhook` (firma HMAC → 401, GET defensivo, idempotente);
  Checkout Bricks sobre `BottomSheet`; tabs de suscripción en `/cuenta` (B2C) y
  `/mi-negocio/[placeId]` (B2B); sync de flags en activación/caída/reactivación; hooks de
  revocación (AUTH-13) y `beforeDelete` que cancelan el preapproval (dec.28); `/admin` con
  Suscripciones read-only.
- **F3 — Destaque** (`lib/search/query.ts` `buscarDestacados` + `registrarDestacados`): candidatos
  = `owner_plan='paid'` ∩ el `where` completo de la búsqueda (reusa `construirWhere` → "solo si
  matchea" gratis); rotación menor-mostrado-primero por `featured_impressions` ascendente con
  desempate `md5(place_id‖fecha)`; bloque de hasta 3 con badge "Destacado" arriba de la primera
  página (lista, no mapa), dedupe contra el orgánico; el contador sube en el mismo `after()`.
- **F4 — Desglose** (`lib/negocio/query.ts` `desgloseEstadisticas` + `components/negocio/desglose-panel.tsx`):
  sección de estadísticas paga en el panel, **gateada server-side por `owner_plan='paid'`** (con
  `free` la query devuelve `null` y el dueño se queda con el teaser pelado de AUTH, sin
  enriquecerlo). Muestra vistas de ficha e impresiones **vs mes anterior** (mismo criterio de mes
  calendario que `visitasDelMes`), taps por tipo (los 5 kinds, 0 incluido), top de filtros que lo
  encontraron (nombres de tags) y la transparencia del destaque "destacada en X de las Y búsquedas"
  (`featured_impressions / impressions`, dec.20). Sin migración: reusa las tablas de F1.

**Decisiones espina (línea entre gratis y pago):** suscripción **por lugar** (`subscriptions.place_id`
nullable: `null`=B2C, con valor=B2B) · preapproval **sin plan en MP** (el precio de DB es la única
fuente, dec.10) · un solo módulo habla con MP (`lib/billing/mercadopago.ts`, secrets solo ahí) ·
webhook solo firmado + GET defensivo + reconciliación lazy (los webhooks de MP no son confiables,
BUG-020) · cancelación diferida simulada (cancela ya en MP, acceso hasta fin de período) · precio
congelado en `subscriptions.amount_ars` al contratar.

**Archivos clave:** `lib/billing/*` (`mercadopago.ts` · `renovacion.ts` · `vencimiento.ts` ·
`mp-errors.ts` · `settings.ts` · `estado.ts` · `subscriptions.ts`) · `app/api/billing/{checkout,cancel}` ·
`app/api/webhooks/mercadopago` · `app/api/lugar/[id]/tap` · `app/api/admin/settings` ·
`lib/search/{query,impressions}.ts` (destaque + contadores) · `lib/negocio/query.ts`
(`desgloseEstadisticas`) · `components/billing/*` · `components/negocio/desglose-panel.tsx` ·
`components/lugar/tap-link.tsx` · `drizzle/0008_short_talisman.sql`.

**Lo que hay que saber para el próximo spec (8 — Chat IA):**

- **`users.plan` se mueve solo** ahora (lo mueve la suscripción B2C). El cupo de mensajes y el
  modelo `cupo_del_plan` vs `otorgados_este_mes` son del spec 8; acá solo quedó el flag automatizado.
- **La instrumentación agregada (impresiones · vistas · taps · tags · featured) es el histórico que
  vende el B2B** y no se reconstruye. Cualquier feature nueva que quiera métricas por lugar suma una
  columna/tabla `*_daily` con el mismo invariante (sin dato por usuario), no un evento por request.
- **"Ocultar ≠ borrar" en los dos ejes**: bajar de plan mueve el flag y nada más — el contenido
  pago, el destaque y el desglose se apagan sin borrar dato; re-suscribir reactiva todo tal cual.
- **Fuera de v1 (en BACKLOG):** descuento multi-local B2B · subir el precio a suscriptores vivos
  (MP no tiene camino confirmado, `MP_INFLATION_PRICING` sin resolver en StressPlan) · trials/plan
  anual · comprobantes AFIP · panel de sync manual de MP.

---

## Chat IA — "armá tu salida" {#chat_ia}

**Spec:** [`docs/specs/done/CHAT_IA.md`](../specs/done/CHAT_IA.md) · ✅ Implementado (2026-07-26)
**QA:** [`docs/qa/AnalisisQA.md`](../qa/AnalisisQA.md) § *QA /qa-spec — CHAT_IA (spec completo, 3 fases)* — APROBADO, 10 criterios PASS (+ QA de fase F1/F2/F3)

**Qué hace:** el chat conversacional premium (`/chat`) que traduce lenguaje natural a **lugares reales del catálogo publicado** — la feature estrella del plan de ARS 7.000. Multi-turno, con cupo mensual, tope global de gasto que degrada, y modelo intercambiable sin deploy. Enciende además el botón "Que la IA arme la shortlist" que VOTACION dejó modelado (decisión 18).

**Alcance implementado (3 fases):**

- **F1 — Motor, cupo y endpoint** (`lib/ai/*`): `client.ts` (singleton `@anthropic-ai/sdk`, único que lee `ANTHROPIC_API_KEY`) · `settings.ts` (claves `ai.*` runtime) · `prompts.ts` (system con taxonomía + zonas + guía; `buildSystemPrompt(modo)`) · `tools.ts` (`buscar_lugares` delega en `searchPlaces` — candado a del grounding) · `grounding.ts` (valida `[[lugar:id]]` contra `seen_place_ids` — candado b) · `cupo.ts` (reserva TOCTOU-safe con `FOR UPDATE`, tope global `ai_api_usage`, revert si la IA falla) · `chat.ts` (loop de tools + streaming SSE). `POST /api/chat` con rate limit `chat`. Migración `drizzle/0009_talented_pete_wisdom.sql` (4 tablas + `users.chat_trial_used` + seeds `ai.*`).
- **F2 — UI `/chat`** (`app/chat/`): `page.tsx` (gate por sesión inline, sin login = CTA) + `chat-client.tsx` (SSE reader, cards con link a ficha, historial retomar/borrar, estados de gating, markdown sin HTML crudo). Endpoint extra `GET /api/chat/conversaciones/[id]` para retomar el hilo con cards re-enriquecidas. Entrada "Chat IA" en el menú de cuenta.
- **F3 — Modo shortlist en VOTACION** (cableado, sin motor nuevo): `/chat?modo=shortlist` (el `page.tsx` lee el query y lo pasa al cliente; el cliente manda `modo` solo al crear la conversación) · botón **"Usar esta shortlist"** en respuestas con 2-5 lugares → guarda la shortlist en `sessionStorage` (`SHORTLIST_STORAGE_KEY`) y vuelve a `/votacion/nueva`, que la **precarga** como opciones · el botón de `/votacion/nueva` deja de ser no-op (abre el chat en modo shortlist), sigue gateado a premium. El traspaso es cosmético: los ids se revalidan `isPlacePublished` al crear (doble red, VOTACION d.12).

**Decisiones espina (la línea entre gratis y pago):** grounding con **doble candado** (tool-use nativo + validación server de cada cita — la IA no puede alucinar ni inducida) · **modelo en `app_settings`** (`ai.chat_model`, hoy `claude-sonnet-5` — el A/B del 2026-07-26 mostró que Haiku narra el retry de la tool; swap por UPDATE sin deploy) · cupo mensual con reset + grants (`chat_quota_grants`) · tope global por SKU que **degrada** (503, no factura; bajar a 0 = kill switch) · consumo contado aparte de `chat_messages` (borrar conversación no devuelve cupo) · prompt caching · sin sesgo pago (`owner_plan` no participa).

**Archivos clave:** `lib/ai/{client,settings,prompts,tools,grounding,cupo,chat,logging}.ts` · `app/chat/{page,chat-client}.tsx` · `app/api/chat/route.ts` · `app/api/chat/conversaciones/[id]/route.ts` · `app/votacion/nueva/nueva-client.tsx` (precarga + botón) · `lib/votaciones/constantes.ts` (`SHORTLIST_STORAGE_KEY`) · `drizzle/0009_talented_pete_wisdom.sql`.

**Lo que hay que saber para el próximo spec:**

- **El chat es una fuente más de shortlist, no un bypass**: la votación sigue validando `isPlacePublished` al crear. Cualquier flujo que precargue lugares debe apoyarse en esa doble red, no confiar en el traspaso del cliente.
- **El modelo se cambia con un UPDATE** (`ai.chat_model`), no con deploy — mismo patrón que umbral/precios/topes Google. El seed sigue en Haiku (fallback); **manda el runtime**.
- **Fuera de v1 (en BACKLOG):** wizard guiado · sesión de tuning de prompt/voz (Chat IA F1) · memoria entre conversaciones · recomendaciones del chat como métrica propia (sin mezclar con impresiones B2B).

## Costos en /admin — observabilidad + sugeridor de precio {#costos_admin}

**Spec:** [`docs/specs/done/COSTOS_ADMIN.md`](../specs/done/COSTOS_ADMIN.md) · ✅ Implementado (2026-07-26)
**QA:** [`docs/qa/AnalisisQA.md`](../qa/AnalisisQA.md) § *QA /qa-spec — COSTOS_ADMIN* + § *QA manual — COSTOS_ADMIN en vivo* — APROBADO (6 criterios de código PASS con 3 checkers independientes · 7/8 en vivo con Playwright + UPDATEs revertibles · typecheck/tests 460/460/build verdes)

**Qué hace:** sección "Costos" read-only en `/admin` (mini-spec, #3 de la cola post-spec-8):
gasto del chat IA en USD del mes por modelo (Σ tokens de `chat_messages` × precios — nunca
desde `ai_api_usage`, que cuenta requests), Google Places por SKU vs cap con alerta
(amarillo ≥80% / rojo ≥100% / "apagado" si cap=0), comparación vs mes anterior, y cupo del
chat vs `ai.chat_monthly_cap`. Absorbe el sugeridor de precio premium del BACKLOG: cotización
del dólar oficial (dolarapi.com, cache ~1 h, degradable sin romper la page) + regla de piso
`precio_ARS ≥ dólar × 3` — banner con precio sugerido (millar hacia arriba) solo-sugerencia.

**Alcance implementado:**

- **`lib/ai/logging.ts`**: `PRECIOS_POR_MODELO` + `calcularCostoUsd` extraídos como exports
  puros (antes inline); `logChatCall` los reusa con salida idéntica.
- **`lib/admin/costos.ts`** (nuevo, server-only): helpers puros (`costoGoogleUsd` con tier
  gratis 1.000, `estadoAlerta`, `pisoArs`, `precioSugerido`, `evaluarPiso`) + agregados
  `getCostosChat` / `getUsoGoogle` / `getCupoChat` / `getSugerenciaPrecio`. Precios Google:
  details $20/1.000, photos $7/1.000 (fuente: FICHA dec. 11/14).
- **`app/admin/costos.tsx`** (nuevo): `CostosAdmin` + `SugeridorPrecio`, server components
  read-only estilo `suscripciones.tsx`; `Intl.NumberFormat` es-AR, copy rioplatense.
- **`app/admin/page.tsx`**: 4 agregados sumados al `Promise.all` + 2 secciones; gate
  `sesionAdmin → notFound()` intacto.
- **Tests**: 19 nuevos (aritmética pura: costo por modelo, fallback, tokens null/0, tier
  gratis, umbrales, piso, redondeo). Candados de costo intactos (verificado por git diff).
- **Hallazgo del primer render**: el test de integración del cupo borra la fila del mes real
  de `ai_api_usage` (kill switch reseteado en dev) → ítem en BACKLOG.

## Pulido UX/UI + reestructura de /admin {#pulido}

**Spec:** [`docs/specs/done/PULIDO.md`](../specs/done/PULIDO.md) · ✅ Implementado (2026-07-27)
**QA:** [`docs/qa/AnalisisQA.md`](../qa/AnalisisQA.md) § *QA /qa-spec — PULIDO* + § *QA manual — PULIDO en vivo* — APROBADO (6 criterios de código PASS con checkers independientes · 7/7 en vivo con Playwright + UPDATEs revertidos · typecheck/460 tests/build verdes)

**Qué hace:** mini-spec #4 de la cola post-spec-8, dos frentes sobre hallazgos del QA integral
(2026-07-26): pulido de UX (4 tracks del backlog) + reestructura de `/admin` en tabs.

**Alcance implementado:**

- **Filtro fantasma** (`components/search/search-shell.tsx`): `ChipsActivos` dibuja un chip
  removible para todo tag en la URL aunque el catálogo no le dé label (fallback al slug
  legible en vez de saltearlo).
- **Header de marca**: `components/shared/brand-header.tsx` (nuevo) suma el `Wordmark` en
  ficha, `/cuenta`, `/mi-negocio` (lista y editor) y `/votacion/[token]`, sin romper los
  headers propios de cada página.
- **Resize de fotos del dueño** (`app/mi-negocio/[placeId]/fotos-editor.tsx`): redimensiona
  a webp ≤1600px de lado mayor en el browser antes del POST (verificado en vivo: 267 KB →
  17,5 KB). El límite de 5 MB y la validación server-side no cambiaron.
- **INT-05** (`lib/ai/chat.ts`): el chat suma impresiones (`registrarImpresiones`) de los
  lugares efectivamente citados/mostrados al final de cada turno — mismo agregado puro que
  búsqueda/ficha.
- **INT-14** (`lib/negocio/acciones.ts` + `app/api/mi-negocio/[placeId]/content/route.ts`):
  `verificarDueno` exportado y llamado ANTES de validar la forma del payload — un no-dueño
  siempre recibe 403, sin importar si mandó datos bien formados.
- **`/admin` en tabs** (`app/admin/tabs.tsx`, nuevo): tabs client-side sobre una sola ruta,
  orden Cola de aprobación → Precios → Suscripciones → Costos (Sugeridor de precio agrupado
  en Costos). El gate `sesionAdmin` y el `Promise.all` de datos siguen solos en
  `app/admin/page.tsx`; los patrones existentes de cada sección (client + `router.refresh()`
  vs server read-only) no cambiaron internamente.
- **Nota de método**: el click sintético de Playwright no disparaba el submit del form del
  chat (sin error visible); se resolvió con `element.click()` vía `page.evaluate`. Anotado
  para la próxima sesión de QA en `/chat`.
