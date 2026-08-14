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
  `query.ts` (`getVotacionPublica` con expiración lazy · `getResultados` · el panel del creador,
  que desde el pulido de UI del 2026-08-01 son **dos** lecturas: `votacionesActivas` +
  `historialDeVotaciones` paginado y premium, donde antes había una sola `misVotaciones` sin
  `LIMIT`) · `estado.ts` (helpers puros: `estaActiva`/`estaExpirada`/`estadoVisible`) ·
  `planes.ts` (`esPremium`) · `token.ts` · `validacion.ts` · `constantes.ts`.
- **API**: `POST /api/votaciones` (crear) · `POST /api/votaciones/[token]/voto` (votar, setea
  cookie `voter_id`) · `GET /api/votaciones/[token]` (resultados en vivo) · `PATCH` (cerrar/
  cancelar) · `GET /api/votaciones/historial` (el "Ver más" del panel; sesión + premium
  server-side). Envelope `{ data, error }` + `STATUS_POR_CODIGO`, patrón de `claims`.
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

## Curaduría asistida de Ambiente/Momento/Actividad {#curaduria}

**Spec:** [`docs/specs/done/CURADURIA.md`](../specs/done/CURADURIA.md) · ✅ Implementado (2026-07-27)
**QA:** [`docs/qa/AnalisisQA.md`](../qa/AnalisisQA.md) § *QA /qa-spec — CURADURIA (F1 + F2)* + § *QA de fase — CURADURIA F3* — APROBADO (F1/F2: 12 criterios con 2 checkers + verificación en vivo con Playwright + piloto aprobado por Fer · F3: auto-apply verificado en DB + cobertura medida · typecheck/468 tests verdes · build pendiente por server levantado)

**Qué hace:** spec #9 (#5 de la cola post-spec-8). Batch offline con LLM que **sugiere** tags de
Ambiente/Momento/Actividad **con evidencia citada** (cita + URL), leyendo la web pública del
lugar — cero Google, fijado por test. Prende los chips de Ocasión que dependían de las facetas
ralas (Ambiente 0,9% · Momento 0,6% antes del spec).

**Alcance implementado (3 fases):**

- **F1 — Batch** (`scripts/curar.ts`, `lib/curation/*`): migración `place_tag_suggestions`
  (evidencia + URL + estado `pending`/`accepted`/`rejected`, unique `(place_id,tag_id)`),
  settings `curation.zone_quota`/`ai.curation_model`. Selección por zona (publicados · Tipo
  relevante a chips · **sin reclamo aprobado** · orden contacto→confidence · cuota 40). Fetch
  educado del sitio propio; sugeridor LLM por tool-use forzado con validación de slug en el
  borde. Reporte de tokens/US$ por corrida.
- **F2 — Cola en `/admin`** (`lib/curation/query.ts`/`acciones.ts`, tab "Curaduría"): flujo
  one-at-a-time por zona, evidencia inline, aceptar/corregir (`source='admin'`)/rechazar,
  Precio opcional, teclado-first (Enter/R). Gate `sesionAdmin`. Aceptar escribe `place_tags`
  que sobrevive al re-import (CATALOGO decisión 17).
- **F3 — Corrida completa autónoma** (decisión 13): `guardarSugerencias` **auto-aplica** las
  sugerencias nuevas **con evidencia** a `place_tags` (`admin` + `accepted`); las **sin
  evidencia** quedan `pending` para la cola. Las 46 zonas corridas con **Sonnet 5** por tandas:
  **~1.840 lugares, 1.149 tags auto-aplicados, 2.811 pending, US$17,62**. Cobertura: **5/9 chips
  objetivo prendidos** (de 1/9 antes; `cumpleanos` 0→42 zonas es el gran salto), **46/46 zonas**
  con ≥1 chip. Los 4 en 0 = dato base no curable (Precio, Cocina, Actividad rara — decisión 12).

**Reglas que dejó (ver `CLAUDE.md` § lógica de negocio y el spec):**
- **Solo `place_tags`, nunca las columnas base de `places`** (el re-import las pisa).
- **Auto-apply aditivo, protegido por `.returning()`**: solo se auto-aplican las filas que el
  `onConflictDoNothing` realmente insertó — una sugerencia ya `accepted`/`rejected` por Fer no
  se re-aplica jamás. Divergencia declarada de `guardarCuraduria`: se reusa su escritura a
  `place_tags`, no su `delete` previo (que en una corrida aditiva borraría tandas anteriores).
- **Modelo en `app_settings.ai.curation_model`** (runtime, swap sin deploy): quedó en
  `claude-sonnet-5` tras la corrida; el seed sigue en Haiku (fallback).

---

## Favoritos — guardar lugares y listas {#favoritos}

**Spec:** [`docs/specs/done/FAVORITOS.md`](../specs/done/FAVORITOS.md) · ✅ Implementado (2026-07-31, dos fases)
**QA:** [`docs/qa/AnalisisQA.md`](../qa/AnalisisQA.md) § *FAVORITOS F1* y § *QA /qa-spec — FAVORITOS F2*
— APROBADO. 19 IDs en vivo en F1 + 18 en F2 (los cuatro ⏭️ de F1 reusados), 523/523 tests.

**Qué hace:** le da memoria a la app. Un tap desde la card, la ficha o el chat guarda un lugar;
lo guardado vive en `/mis-lugares`. Es la primera feature de **retención** (una razón para volver
cuando no estás decidiendo una salida) y el primer beneficio premium **sin costo marginal**: la
diferencia free/premium es la **cantidad de listas** (una fila más, no tokens).

**Alcance implementado:**

- **Schema** (migración aditiva `drizzle/0011_easy_wolfsbane.sql`): `place_lists` (índice único
  parcial `(user_id) where is_default` + único `(user_id, lower(name))`) · `place_list_items`
  (único `(list_id, place_id)`; `place_id` **sin** cascade, igual que `poll_options`) · columna
  `place_impressions_daily.saves`.
- **Dueño único del cupo** (`lib/favoritos/planes.ts`): `MAX_LISTAS_FREE = 1` en código (es la
  *definición* del plan free), `favoritos.max_listas_premium` / `max_items_por_lista` en
  `app_settings` con default en código (10 / 200), `maxListasDelUsuario`, `listasOcupadas`,
  `puedeCrearLista`, `listasVisibles`. **Nadie más decide cuántas listas puede tener alguien.**
- **Acciones** (`lib/favoritos/acciones.ts`): `guardarLugar` · `sacarLugar` · `crearLista` ·
  `renombrarLista` · `borrarLista`. Todos los gates viven acá; los routes son adaptadores.
  Las que cuentan-y-después-insertan corren en transacción con la fila del **usuario**
  `FOR UPDATE` (la que ancla el límite).
- **Lecturas** (`lib/favoritos/query.ts`): `guardadosDeLaPagina` (estado de la página en una
  query, para `/api/search`) · `estadoDeFavoritos` (guardados **+** listas en una resolución,
  para home y ficha) · `listasDelUsuario` (las listas con sus lugares y el flag `publicado`).
- **Endpoints**: `GET|POST|DELETE /api/favoritos` · `POST /api/listas` ·
  `PATCH|DELETE /api/listas/[id]`. Rate limit propio (`checkFavoritosRateLimit`, 60/min) y
  sesión inline **antes** del payload.
- **UI**: `BotonGuardar` (`components/favoritos/`) con estado optimista y sheet de destino;
  slot `accion` en `PlaceCard` (fuera del `<Link>`); `/mis-lugares` (server + client, patrón de
  `/mis-votaciones`); link en el `AccountMenu`; botón también en las cards del chat IA.
- **Métrica** (`lib/search/impressions.ts`): `registrarGuardado` suma `saves` en `after()`,
  agregado puro y **solo el guardado nuevo**. Sacar **no** descuenta: es histórico de eventos.

**Lo que hay que saber para el próximo spec:**

- **Ocultar ≠ borrar, en los dos ejes.** Bajar a `free` recorta lo que se **lee**
  (`listasVisibles`), nunca borra: las listas de más quedan invisibles y vuelven intactas con el
  plan. Una lista escondida tampoco recibe escrituras ni se puede renombrar/borrar (404).
- **El destino nunca sale del payload**: sale de `listasVisibles(userId)`. Lista ajena,
  inexistente o escondida se contestan igual — para ese usuario no existe.
- **La default es lazy y ocupa cupo aunque no exista**: nace en el primer guardado y no se
  renombra ni se borra (es el contenedor que garantiza que free tenga dónde guardar).
- **Un lugar despublicado no desaparece de una lista** (decisión 11): se muestra atenuado y sin
  link (la ficha daría 404). La lista **nunca** se filtra por visibilidad.
- **`saves` no se puede reconstruir**: sacar un favorito borra la fila de `place_list_items`, por
  eso el contador se empezó a acumular ahora aunque el panel del dueño lo muestre recién en v2.

## Sugerir lugar en una votación {#sugerir_en_votacion}

**Spec:** [`docs/specs/done/SUGERIR_EN_VOTACION.md`](../specs/done/SUGERIR_EN_VOTACION.md) · ✅ Implementado (2026-07-31, sin fases)
**QA:** [`docs/qa/AnalisisQA.md`](../qa/AnalisisQA.md) § *QA /qa-spec — SUGERIR_EN_VOTACION* —
APROBADO. 13 criterios de DoD con checkers independientes + los 15 casos del spec en vivo,
542/542 tests (19 nuevos).

**Qué hace:** cierra el loop viral. Hasta acá el link de una votación circulaba para **votar**;
ahora circula para **participar**: cualquiera que lo recibe puede **sumar un lugar del catálogo**
a la cancha, sin cuenta, y el que aportó vuelve a compartir el link ("puse el mío, voten").
**Revierte la decisión 2 de VOTACION** (ver la nota en su tabla). Su decisión 3 (2-5 del creador)
sigue viva: lo que cambia es el **techo total**.

**Alcance implementado:**

- **Schema** (migración aditiva `drizzle/0012_overjoyed_marvex.sql`): enum `poll_option_origin`
  (`creator`|`voter`) · `poll_options.origin` (default `'creator'` ⇒ **sin backfill**),
  `.suggested_by` (el `voter_token`, nunca expuesto), `.created_at`, índice
  `(poll_id, suggested_by)` · `polls.allow_suggestions` (default `true`).
- **Dos constantes, no una** (`lib/votaciones/constantes.ts`): `MAX_OPCIONES = 5` es lo que pone
  el **creador** al armar (decisión 3 de VOTACION, intacta, y la usan el alta y el chat);
  `MAX_OPCIONES_TOTAL = 8` es hasta dónde puede **crecer** con lo que suma el grupo. Más
  `MAX_SUGERENCIAS_POR_VOTANTE = 2`.
- **Acciones** (`lib/votaciones/acciones.ts`): `sugerirOpcion` · `quitarOpcion` ·
  `cambiarSugerencias`. **Todos** los gates viven acá (abierta · `allow_suggestions` · techo ·
  tope por dispositivo · lugar publicado · duplicado). El techo y el tope se cuentan **dentro de
  la transacción con la fila de `polls` tomada `FOR UPDATE`** — la que ancla el límite.
- **Lecturas** (`lib/votaciones/query.ts`): `OpcionPublica` suma `origin` (y **nunca**
  `suggested_by`); `sugerenciasDelDispositivo` (los `optionId` propios, cruzando la cookie en el
  server); `esCreadorDeVotacion`. `ResultadosEnVivo` pasó a traer **la cancha entera**.
- **Endpoints**: `POST /api/votaciones/[token]/opciones` (sin sesión, cookie `voter_id` creada si
  falta) · `DELETE .../opciones/[optionId]` (dos autorizados: el creador con sesión, o el que
  sugirió por cookie si nadie la votó) · `PATCH /api/votaciones/[token]` con
  `accion: 'suggestions'`. Rate limit propio (`checkSugerenciaRateLimit`, 20/min, bucket aparte).
- **UI**: botón "Sumar un lugar" → `BottomSheet` con el buscador que reusa `/api/search` tal cual;
  badge "Lo sumó alguien del grupo" / "Lo sumaste vos"; quitar con aviso de cuántos votos se
  pierden; tras sumar se **ofrece** votarlo ("¿La votás?"), nunca se auto-vota; checkbox en el
  alta y interruptor en `/mis-votaciones`.

**Lo que hay que saber para el próximo spec:**

- **Nunca texto libre.** El único input es un `placeId` validado contra `lib/db/visibility.ts` en
  el server — el mismo candado que la shortlist del creador. Si aparece un campo "nombre del
  lugar", es un bug de diseño, no una mejora.
- **`suggested_by` no sale del server**, igual que `poll_votes.voter_token`. Lo que viaja es
  `origin` (que la sumó el grupo) y, para uno mismo, los `optionId` propios.
- **Un cierre perezoso dentro de una transacción no sobrevive**: el `ROLLBACK` del error de
  negocio se lo lleva puesto. El pre-chequeo de estado va **antes** de abrir la transacción
  (patrón de `votar()`); el `FOR UPDATE` de adentro solo revalida.
- **Quitar es solo con la votación abierta**, y solo sobre lo sugerido: una opción original no la
  saca nadie, y sobre una cerrada nadie toca la cancha (cambiaría un resultado ya compartido).
- **Apagar `allow_suggestions` cierra la puerta, no deshace**: lo ya sumado sigue y el creador lo
  puede seguir moderando.
- **El polling trae la cancha entera** porque la cancha crece mientras la pantalla está abierta.
  Cualquier feature que agregue opciones en vivo hereda esto gratis.

---

## Rotación de los chips de Ocasión por día y hora {#chips_rotacion}

**Spec:** [`docs/specs/done/CHIPS_ROTACION.md`](../specs/done/CHIPS_ROTACION.md) · ✅ Implementado (2026-07-31, sin fases)
**QA:** [`docs/qa/AnalisisQA.md`](../qa/AnalisisQA.md) § *QA /qa-spec — CHIPS_ROTACION* — APROBADO.
10 criterios de DoD con checkers independientes + los 11 casos del spec (los 8 verificables sin
mover el reloj, en vivo con Playwright + `psql`), 600/600 tests (58 nuevos).

**Qué hace:** el orden de los chips de Ocasión de la home deja de ser una foto fija (`sort`) y
pasa a depender del **día y la hora en AR**, con reglas que se editan con un `UPDATE` y sin
deploy. Un martes a las 18 «After office» va adelante; un sábado a la 1 «Salir a bailar». Y si
alguien escribe mal el setting, la home **degrada al orden de siempre** en vez de romperse.

**Alcance implementado:**

- **`lib/search/rotacion.ts` (nuevo, dueño único)** — `CHIPS_SCHEDULE_KEY` (`chips.schedule`), el
  tipo `ReglaRotacion` (`{dias, desde, hasta, primero}`, **0 = lunes**), `validarReglas`,
  `chipsPrimero(reglas, now)` y `DEFAULT_CHIPS_SCHEDULE`. **Puro y sin base**: reusa `partesEnAR`,
  `esHoraValida`, `minutosDe` y `DIAS` de `lib/negocio/horarios.ts`.
- **`lib/search/chips.ts`** — lee el setting **en paralelo** con los conteos y aplica el orden
  justo antes del corte `home`/`resto`. El pool de candidatos pasó de `vivos.filter(inHome)` a
  `[forzados vivos] + [in_home vivos]`.
- **`scripts/seed.ts`** — la clave con las 3 reglas semilla, con `onConflictDoNothing` (no pisa
  reglas afinadas a mano: ese es el mecanismo).
- **Sin migración, sin endpoint, sin UI de admin** y cero cambios en el componente cliente, el
  motor, `params.ts` y `lib/db/chips.ts`. Esto reordena, nada más.

**Lo que hay que saber para el próximo spec:**

- **`in_home` ya no significa "candidato a la home", significa "candidato por defecto"**
  (decisión 11). Una regla puede traer adelante cualquier chip **vivo**, tenga `in_home` o no —
  es lo único que hacía la feature perceptible: los dos chips de las reglas semilla ya estaban en
  la home a toda hora, así que reordenar dentro del pool `in_home` no habría movido un pixel.
- **El setting se lee en cada request, nunca se cachea en módulo** — igual que el umbral de
  confidence. Un `UPDATE` cambia la home en la recarga siguiente, sin reiniciar.
- **Un setting inválido no puede romper la home**: se valida **regla por regla** (una mal escrita
  entre dos buenas se descarta sola), se ignora en silencio y se loguea **una vez por proceso**.
  Ausente (`null`) no es un error y no loguea nada.
- **Las reglas semilla son una primera aproximación declarada, no curaduría.** Afinarlas con
  `place_tag_impressions_daily` es lo que convierte esto en curaduría con evidencia (§ v2).
- **`desde === hasta` cubre las 24 h del día listado**, consecuencia literal de la decisión 3. En
  `horarios.ts` ese mismo caso es un rango inválido: ahí significa "no abre", acá "siempre".

**Ampliación posterior (2026-08-03, fuera del spec — ver `BACKLOG.md`):** la regla ganó un campo
opcional **`solo: [...]`**, la capacidad inversa de `primero`: un chip nombrado ahí **no se ve fuera
de la ventana**, ni en la home ni detrás de "Ver más". Sin eso, `after-office` estaba entre los 4 un
domingo a las 11 pese a su regla L-V 17-21, porque una regla solo sabía *adelantar*. Lo que hay que
saber: **`solo` y `primero` tienen semánticas distintas en el mismo array**. `primero` = gana la
**primera** regla que matchea (es un orden, decisión 2); `solo` = **unión de todas** las reglas
vigentes (es un permiso — si ganara la primera, una regla ajena que cubre esa hora decidiría sobre un
chip que ni nombra). Por eso `primero` pasó a ser opcional —una regla puede solo restringir— y
`chipsPrimero` saltea las reglas sin `primero`. El corte va en `chips.ts` **antes** de repartir
home/resto, así un chip fuera de ventana tampoco entra por el `primero` de otra regla. Función nueva:
`chipsFueraDeVentana(reglas, now)`.

---

## Pulido de UX/UI para la beta + app instalable {#pulido_beta}

**Spec:** [`docs/specs/done/PULIDO_BETA.md`](../specs/done/PULIDO_BETA.md) · ✅ Implementado (2026-08-03)
**QA:** [`docs/qa/AnalisisQA.md`](../qa/AnalisisQA.md) §§ *PULIDO_BETA F1* · *F2 (triaje) + F3 (fix)* ·
*F4 (app instalable) + el alta nueva end-to-end* · *QA /qa-spec — PULIDO_BETA* — **PARCIAL**, 10 de
11 criterios PASS; el único pendiente es **PBETA-07** (el ícono en la pantalla de inicio de iOS, sin
iPhone a mano). Fer decidió cerrar igual, con el pendiente anotado.

**Qué hace:** es la única pasada del proyecto que preguntó *"¿esto se entiende desde un celular si es
la primera vez que lo ves?"*. Se auditaron **los 6 recorridos reales** de punta a punta a 390×844 —no
pantallas sueltas: lo que rompe es la transición y el estado en el que llegás— y de ahí salieron
**43 hallazgos con evidencia**. Además dejó la app **instalable**, que para una app de salir de noche
vale más que cualquier pulido de pantalla.

**Alcance implementado:**

- **F1 — Auditoría** (sin una línea de código): los 6 recorridos en vivo con Playwright contra ngrok,
  390×844 y control a 360 px (cero desbordes). 43 hallazgos con los 6 campos de la decisión 7, **10
  propuestos BLOQUEANTE**.
- **F2 — Triaje**: lo hizo **Fer**, hallazgo por hallazgo (decisión 6 — un hallazgo de UX es
  subjetivo por definición). Confirmó los 10, **ninguno bajó**; los 33 restantes al `BACKLOG` con su
  ID, uno por línea.
- **F3 — Fix**: los 10, cada uno re-verificado **en su recorrido completo**. Dos dejaron regla nueva
  con **dueño único**: `compartirLink` + `BotonCompartir` (`components/shared/boton-compartir.tsx`,
  reusado por ficha, votación nueva y `/mis-votaciones`) y el gate del chat pasando por
  `cobroApagado()`, la misma función de `/cuenta`. Nuevos: `app/not-found.tsx` (404 con la marca) y
  el **guardado pendiente** (`lib/favoritos/pendiente.ts` + `ReanudarGuardado` montado en el layout
  raíz, no en el botón — con scroll infinito la card muchas veces no está montada al volver).
- **F4 — App instalable**: `app/manifest.ts` (`display: standalone`, `theme_color` y
  `background_color` = `#0D0D1F`, el `--background` de la paleta) · `public/icons/` 192, 512 y
  **maskable** · `app/apple-icon.png` 180 · `themeColor` en el `viewport`. Los 4 PNG salen de
  `logo_2.png` recortado al pin con `sharp`; **el original de 1,4 MB no se sirve nunca**. Instalada
  de verdad en el Android de Fer: abre con el splash que dibuja el SO.
- **Post-cierre, mismo día — el nombre de la app en el splash: NO SE PUEDE, y está cerrado.** El
  splash sale solo con el pin. **El manifest no tiene campo de texto** (Chrome lo compone con
  `background_color` + un ícono; el `name` no se pinta), así que la única vía era meterlo en el PNG.
  Se probó en un ícono de **1024** (Chrome lo ignora: elige *el más cercano a la resolución del
  dispositivo*, no el más grande) y en el de **512 `any`** (tampoco). Por descarte el splash usa el
  **`maskable`**, que es **el mismo archivo del ícono del launcher** — no se le puede dar texto a uno
  sin dárselo al otro. **Fer decidió dejarlo sin texto** (el launcher se ve siempre; el splash, un
  segundo) y **se revirtió todo**: el manifest quedó con sus 3 íconos originales, con el porqué
  escrito arriba de `icons` para que no se reintente.
- **El alta nueva de usuario end-to-end**, que F1 y F3 no habían podido cubrir (`requireEmailVerification`
  hace imposible el login sin un inbox real). Fer puso su mail y verificó a mano.

**Decisiones que conviene no re-litigar:**

- **NO va splash screen propia** (decisión 8). En la web el splash **crea** el hueco que en una app
  nativa tapa, y la home es la búsqueda. Con manifest, Android lo dibuja gratis y solo para quien la
  instaló. **iOS recibe ícono y standalone pero no splash** (decisión 10): su startup image es una
  por tamaño de pantalla, cola de mantenimiento permanente por un cuarto de segundo.
- **Ver y arreglar son fases separadas** (decisión 2) y **solo BLOQUEANTE se arregla** (decisión 5).
  Es lo que evita que una pasada de UX se vuelva infinita.
- **El service worker no hace falta para instalar**: se verificó contra la doc de Chrome antes de dar
  el DoD por cumplido. Sigue siendo v2, igual que el uso offline y las push.

**Dos cosas que este spec dejó y valen para el que siga:**

1. **El arreglo del guardado pendiente sobrevive a una cuenta nueva** — se midió: la fila de
   `place_list_items` entra **en el mismo segundo** que la verificación del mail. Pero **no
   sobrevive si el link del mail abre otra pestaña** (`sessionStorage` es por pestaña) ⇒ hallazgo
   **PBETA-R3-07**, al `BACKLOG`. El arreglo obvio (`localStorage`) no sirve: no cubre el webview del
   cliente de mail y rompe la razón de elegir `sessionStorage`.
2. **Better Auth no persiste el token de verificación** (lo firma con el secret): la tabla
   `verification` queda en 0 y **el link no se puede reconstruir desde la base**. Para un QA de alta
   nueva hay que pedirle el link a quien recibe el mail.

**Archivos clave:** `app/manifest.ts` · `app/apple-icon.png` · `public/icons/` · `app/not-found.tsx` ·
`lib/favoritos/pendiente.ts` · `components/favoritos/reanudar-guardado.tsx` ·
`components/shared/boton-compartir.tsx` · `app/layout.tsx` · `components/search/zone-sheet.tsx` ·
`app/chat/chat-client.tsx` · `app/votacion/[token]/` · `app/(auth)/login/page.tsx` ·
`app/(auth)/registro/page.tsx`

---

## CURADURIA_POR_NOMBRE — curar un lugar buscándolo por nombre (Tanda B del feedback) {#curaduria_por_nombre}

**Spec:** [`docs/specs/done/CURADURIA_POR_NOMBRE.md`](../specs/done/CURADURIA_POR_NOMBRE.md) ·
**QA:** [AnalisisQA § CURADURIA_POR_NOMBRE](../qa/AnalisisQA.md) · ✅ 2026-08-08

**Qué hace:** agrega el **segundo camino de entrada al editor de curaduría**. Hasta acá la única
puerta era la cola por zona, que sale de `place_tag_suggestions status='pending'` — y tras la
corrida autónoma de CURADURIA F3 esa cola quedó vacía, así que corregirle un tag a un lugar
concreto exigía `psql`. Ahora en `/admin` → Curaduría hay un buscador por nombre: elegís un
resultado y se abre el **mismo** `RevisorLugar`, con el vocabulario completo de las 3 facetas y el
Precio. El mecanismo de guardado no cambió una línea: `guardarCuraduria` siempre fue agnóstico de
la cola. Cierra los dos ítems de la Tanda B del feedback de los primeros usuarios reales.

**Alcance:**

- **`FB-10b` (el piso, primero):** `LugarEnCola` gana `precioSlug`, leído de `place_tags` ∩ faceta
  `precio` **sin filtrar por `source`** (desempate por menor `tags.sort`), y el editor arranca con
  él en vez de `useState(null)`. Vale para los **dos** caminos, porque el bug era del que ya
  existía.
- **`FB-10` (la puerta):** `lib/search/nombre.ts` nuevo (extracción de `normalizado`/`simKey` +
  `coincideNombre`), `buscarLugaresPorNombre` y `lugarParaCurar` en `lib/curation/query.ts`, ramas
  `?q=` y `?placeId=` en el endpoint que ya existía, y el tercer modo del cliente.
- **Sin migración, sin schema nuevo, sin ruta nueva y sin código de guardado nuevo.**

**Decisiones que conviene no re-litigar:**

- **El buscador de admin NO filtra por `publishedWhere` — y eso no rompe la fuente única**
  (decisión 1). Un lugar despublicado es justo uno de los que hay que curar. La divergencia se
  implementa **omitiendo** el predicado, nunca escribiendo su espejo invertido; y para que el admin
  sepa qué toca, cada resultado trae un flag `publicado` calculado con `isPlacePublished`. O sea:
  `lib/db/visibility.ts` se **consulta para etiquetar**, no se reimplementa para filtrar.
- **Tras guardar se queda en el lugar y lo relee del server** (decisión 2), con «Guardado ✓».
  Limpiar el buscador dejaría al admin sin confirmación — que es exactamente el silencio que hizo
  invisible a `FB-10b`. Y releer tiene un beneficio real: lo que se ve es **lo persistido**, así que
  el propio flujo verifica el fix del precio en cada uso.
- **El buscador vive arriba del selector de zonas, no dentro del flujo por zona** (decisión 7): la
  cola es teclado-first y meterle un input en el medio es ruido.

**Dos cosas que este spec dejó y valen para el que siga:**

1. **La `key` de un componente cuyo estado nace de un prop es parte de la lógica, no decoración.**
   `RevisorLugar` se monta con `key={lugar.id}` y su estado es `useState(prop)`. Recargar el
   **mismo** id no remonta ⇒ el editor seguiría mostrando lo tipeado en vez de lo que quedó en la
   base, incluidos los slugs que el server descartó por inválidos. La key en modo por-nombre lleva
   un contador de recarga (`id:revision`). El spec lo anticipó y se implementó así de entrada.
2. **`FB-10b` es el ejemplo de manual de un bug que la pantalla no puede mostrar.** El editor decía
   «No sé» con total naturalidad y el `DELETE` de `guardarCuraduria` se llevaba la fila sin ruido.
   Por eso sus casos de QA se verifican con `SELECT` antes/después, no por captura: un QA visual lo
   habría aprobado. Y por eso el spec exige `npm run backup:db` antes de tocar nada — los ~3.967
   tags `source='admin'` no están en git.

**Deuda señalada, no tocada:** `lib/claims/query.ts:69` tiene una **tercera** copia del match por
nombre, inline. Ahora que existe `lib/search/nombre.ts` puede consumirlo; va al BACKLOG como paso
aparte.

**Archivos clave:** `lib/search/nombre.ts` (nuevo) · `lib/search/query.ts` ·
`lib/curation/query.ts` · `app/api/admin/curaduria/route.ts` · `app/admin/curaduria-client.tsx` ·
`lib/curation/__tests__/por-nombre.integration.test.ts` (nuevo)

---

## ADMIN_USUARIOS — usuarios y premium de cortesía en `/admin` (Tanda C del feedback) {#admin_usuarios}

**Spec:** [`docs/specs/done/ADMIN_USUARIOS.md`](../specs/done/ADMIN_USUARIOS.md) ·
**QA:** [AnalisisQA § QA /qa-spec — ADMIN_USUARIOS](../qa/AnalisisQA.md) · ✅ 2026-08-08

**Qué hace:** saca de `psql` las dos operaciones cotidianas de la beta. **(a)** Una sexta tab
**Usuarios** en `/admin` donde se da y se saca el **premium de cortesía** —el del usuario (B2C) y el
de sus lugares reclamados (B2B)— con motivo obligatorio y bitácora. El producto ya tenía el caso
previsto y su copy escrito (`suscripcion-panel.tsx`: *«Te activamos el Premium nosotros: no vence ni
se cobra»*); lo que no existía era la forma de otorgarlo, y el `UPDATE` a mano había quedado
**prohibido** cuando `lib/billing/subscriptions.ts` se declaró dueño único de los flags. Esta feature
es la mitad que faltaba, no una feature nueva. **(b)** Un botón **«Copiar los N mails»** en
Suscripciones → Interés en el premium, que vuelve accionable la lista que DEPLOY puso ahí para
escribirle a esa gente.

**Alcance:**

- **`FB-03` (primero, soltable solo):** `app/admin/copiar-mails.tsx` (cliente mínimo) + 5 líneas en
  `app/admin/suscripciones.tsx`, que sigue siendo server component. Separador `, ` (lo que un
  cliente de correo acepta en *Para*/*CCO*).
- **Bitácora:** tabla **`plan_grants`** append-only (`lib/db/schema.ts`, migración
  `drizzle/0015_plan_grants.sql` — `CREATE TABLE` + `CREATE INDEX`, ningún `ALTER` sobre tabla con
  datos) + enum `plan_grant_action`.
- **La regla:** `otorgarCortesia` / `revocarCortesia` en `lib/billing/subscriptions.ts`, que
  **delegan la escritura del flag en `activarFlagDelPlan`/`bajarFlagDelPlan`** (que no cambiaron su
  lógica). Flag + bitácora en **una** transacción, con el flag leído `for('update')`.
- **Lecturas:** `getUsuariosAdmin(q?, limite)`, `contarUsuarios()` y `getBitacoraCortesia(userId)`
  en `lib/billing/admin.ts` (se extendió el módulo que ya existía). El badge «paga» vs «cortesía»
  sale de **una** query de suscripciones vivas para todo el lote.
- **UI:** `GET /api/admin/usuarios` (ramas `?q=` y `?userId=`) · `POST
  /api/admin/usuarios/[userId]/plan` (zod, adaptador HTTP puro) · `app/admin/usuarios-client.tsx` ·
  sexta entrada en `app/admin/tabs.tsx` · dos lecturas más en el `Promise.all` de `app/admin/page.tsx`.
- **12 tests de integración** (`lib/billing/__tests__/cortesia.integration.test.ts`).
- **Sin cambios en** `components/billing/suscripcion-panel.tsx`, `lib/billing/estado.ts`,
  `vencimiento.ts`, `webhook.ts`, `lib/favoritos/planes.ts`, `lib/claims/ownership.ts` ni
  `lib/billing/interes.ts`.

**Decisiones que conviene no re-litigar:**

- **`plan_grants` es bitácora, NO fuente de verdad del estado** (decisión 7). El plan vigente se lee
  siempre de `users.plan` / `places.owner_plan`; ningún gate consulta la tabla. Si algún día la
  consultara, habría **dos** discriminantes de "esto es cortesía" y el que quedara viejo mentiría.
- **La cortesía es solo para ejes SIN suscripción viva** (decisión 3), y las dos funciones lo
  rechazan con `TIENE_SUSCRIPCION`. No es cosmético: es lo que mantiene cierto el discriminante que
  **ya está en producción** — `estado.status === null` en `lib/billing/estado.ts`, o sea *premium sin
  fila viva*. Efecto lateral bienvenido: es imposible sacarle desde acá el premium a quien lo paga.
- **Sí se puede revocar, y es puerta de ida y vuelta** (decisión 4), porque el copy vigente ya lo
  prometía (*«Si lo querés dar de baja, escribinos y lo sacamos»*) y porque **a los datos no les pasa
  nada**: revocar B2C **oculta** las listas por encima del cupo free y revocar B2B **oculta** el
  contenido pago. Verificado con `SELECT` antes/después, no por pantalla.
- **La lista de usuarios no se copia ni se exporta** (decisión 9) — esa es la diferencia con `FB-03`:
  los de `premium_interest` **pidieron** que les escriban; los usuarios se registraron para usar la
  app. Un "copiar todos los mails" sobre la tabla de usuarios es un exportador de PII de un click.
- **La tab va sexta, sin reordenar las cinco que ya estaban** (decisión 13): otorgar una cortesía es
  la acción más rara de todo `/admin`, y mover una tab le rompe la memoria muscular a la única
  persona que usa esa pantalla.
- **El botón de `FB-03` rotula lo que copia, no el total** (decisión 12): `getInteresadosAdmin()`
  está topeada en 200, así que «copiar todos» mentiría.

**Tres cosas que este spec dejó y valen para el que siga:**

1. **Un grep en el DoD encuentra deuda que el spec nuevo no causó.** El criterio central —*ninguna
   escritura de plan fuera de los dos helpers*— arrancó en **FAIL** por `lib/billing/baja.ts`, que
   escribía `owner_plan` directo desde MONETIZACION F2. La feature cumplía y el criterio igual salía
   rojo, porque la regla tenía **dos copias**. Se unificó en el momento (commit aparte, por ser
   camino de cobro): `bajarFlagDeLugar(tx, placeId, now)` en `subscriptions.ts` —la bajada del eje
   B2B **sin eje completo**, que es justo lo que `cancelarSuscripcionDeLugar` necesita porque baja el
   flag incluso sin fila viva— y la rama B2B de `bajarFlagDelPlan` delegando ahí.
2. **«Las fotos 4-15 se ocultan al bajar de plan» era folclore.** La ficha publica **una sola** foto
   de dueño (`app/lugar/[id]/page.tsx` ⇒ `ownerPhotos[0]`): el plan de fotos gatea la **subida**
   (`CAP_FOTOS` 3/15), no la exhibición. Lo dan por hecho tanto el DoD de este spec como la decisión
   19 de MONETIZACION. El "oculta, no borra" del eje B2B **sí** es real y se verificó sobre los
   **campos pagos** (descripción visible con `paid` → invisible con `free` → vuelve al re-otorgar, con
   la fila intacta).
3. **`ADMU-19` no se puede reproducir, y eso es un hallazgo.** El caso "un interesado sin mail por el
   `leftJoin`" es imposible: `premium_interest.user_id` es `NOT NULL` con FK `ON DELETE CASCADE` y
   `users.email` es `NOT NULL` ⇒ borrada la cuenta, la fila de interés se va con ella. El filtro de
   `null` queda como defensa. Un caso de QA que la base vuelve inalcanzable vale escribirlo igual:
   la próxima sesión no lo persigue.

---

## MAPA — «dónde estoy» y que el mapa entre en la pantalla (Tanda D del feedback) {#mapa}

**Spec:** [`docs/specs/done/MAPA.md`](../specs/done/MAPA.md) ·
**QA:** [AnalisisQA § QA /qa-spec — MAPA](../qa/AnalisisQA.md) · ✅ 2026-08-08

**Qué hace:** cierra los dos reportes que quedaban sobre la misma pantalla y, con eso, **el
feedback de los primeros usuarios queda cubierto entero**. **(a)** `FB-04` — un control para verte
en el mapa, que no existía: las `coords` llegaban al componente pero solo alimentaban la clave del
fetch. **(b)** `PBETA-R1-06` — el mapa ocupaba el 67% del viewport en mobile y había que scrollear
la página, que es justo el gesto que se pelea con el arrastre del mapa. Y un tercero que no reportó
nadie y aparece al implementar el primero: el `fitBounds` sobre los pins corría en cada cambio, así
que un "centrarme" quedaba **pisado por el próximo re-fetch**.

**Alcance:**

- **`GeolocateControl` nativo de MapLibre** (`components/search/map-view.tsx`), no un botón propio:
  regala punto azul, círculo de precisión y —lo que importa— **pide el permiso recién al tocarlo**,
  así la decisión 17 de BUSQUEDA queda intacta sin discutirla de nuevo. `trackUserLocation: false`
  (un toque = un centrado) y `fitBoundsOptions: { maxZoom: 15 }`, el mismo tope que los pins.
- **La guarda de cámara:** un `useRef` marca que la cámara es del usuario y el `fitBounds`
  automático se saltea mientras esté puesto. Lo marcan `dragstart`/`zoomstart`/`rotatestart`
  **filtrados por `originalEvent`** (sin ese filtro el propio `fitBounds` se auto-marcaría), el
  `easeTo` que abre un cluster y el evento `geolocate`. Lo limpia un efecto sobre
  `serializeSearchParams(params)` — **la clave sin coordenadas**, no la del fetch.
- **El mapa entra entero** (`h-[70vh]` → `flex` con piso `min-h-80`): en modo mapa se esconde el
  buscador de texto y los chips de Ocasión pasan a **una fila que scrollea**, con barra propia de la
  marca (`.barra-scroll-marca`, `app/globals.css`). `min-h-screen` → `min-h-dvh` en
  `app/page.tsx`, porque `screen` ignora la barra del navegador en mobile.
- **Fuera de AMBA avisa, no bloquea** (`AMBA_BBOX` de `lib/geo/amba.ts`, importable desde el
  cliente porque no importa nada): el mapa te lleva igual —pediste verte, no buscar—.
- **Sin migración, sin endpoint nuevo y sin un solo cambio en `lib/`.** La URL no gana parámetros:
  la posición del dispositivo nunca viajó en un link.

**Lo que hay que saber para el próximo spec:**

- **El alto del div del mapa sale de `flex-1`, no de `size-full`.** Al sacar el alto fijo, el
  `height: 100%` del hijo dejó de resolver —necesita un alto **declarado** en el padre— y el mapa
  colapsaba a 0 px: canvas desbordado y controles que no reciben el toque. `absolute inset-0`
  tampoco sirve, porque el CSS de MapLibre pisa el `position` con `.maplibregl-map`.
- **Los rótulos de los controles se traducen con `locale` del `Map`**, no editando el DOM después
  de `addControl`: MapLibre arma el botón de forma asíncrona y lo re-rotula en cada cambio de
  estado. Los del `NavigationControl` (zoom) **siguen en inglés** — deuda anterior, al BACKLOG.
- **En Chromium ≥ 121, `scrollbar-width`/`scrollbar-color` anulan los `::-webkit-scrollbar`.**
  Declarar las dos cosas juntas devuelve la barra del sistema apenas teñida, flechitas incluidas.
- **`MAPA-04` y `MAPA-07` quedaron PARCIALES a propósito**: piden "esperar un re-fetch por coords"
  y hoy el shell pide las coordenadas **una sola vez** (`pedirUbicacion` corre solo si `coords` es
  null), así que ese re-fetch no se puede provocar desde la UI. La rama contraria de la guarda —que
  un cambio de búsqueda **sí** re-encuadra— está confirmada dos veces.

## CORRECCION_DATOS — corregir los datos base cuando Overture quedó viejo {#correccion_datos}

**Spec:** [`docs/specs/done/CORRECCION_DATOS.md`](../specs/done/CORRECCION_DATOS.md) ·
**QA:** [AnalisisQA § QA /qa-spec — CORRECCION_DATOS](../qa/AnalisisQA.md) · ✅ 2026-08-09

**Qué hace:** hasta acá **no existía forma de arreglar un dato base mal**, ni para el admin ni
para el dueño con reclamo aprobado — `place_owner_content` cubre contacto y contenido, y no
tiene `address`, `lat`, `lng` ni `name`; y un `UPDATE` a mano lo pisaba el próximo re-import.
El caso: Club Cultural Matienzo se mudó y el catálogo tenía la sede vieja, o sea el **pin
equivocado**, que mueve al lugar en la búsqueda de todos (zona por geometría, orden por
distancia, pin del mapa). Ahora el dato se corrige, la corrección **sobrevive al re-import** y
queda registrado quién la hizo y con qué fuente.

**Alcance:**

- **La marca es por campo, no por lugar** (`places.locked_fields`, `text[]`): el re-import pisa
  cada una de las cinco columnas corregibles (`name`, `address`, `locality`, `lat`, `lng`)
  **salvo** donde un humano dijo lo contrario. Por campo y no por lugar a propósito — un flag
  por lugar convertiría cada corrección en un opt-out permanente del catálogo, y el lugar más
  tocado sería el más desactualizado.
- **Un solo módulo escribe una corrección**: `lib/negocio/correcciones.ts`, que hace **cinco
  cosas en UNA transacción** — valores en `places` · `locked_fields` **unidos, nunca
  reemplazados** · fila de bitácora · re-asignar `place_zones` desde el pin nuevo (reusando
  `asignarZonasDeLugar`, que aceptaba `tx` desde AUTH y nunca se había usado para una edición) ·
  invalidar el match con Google.
- **El import cambia en un solo lugar**: el `set` del `onConflictDoUpdate` se extrajo a
  `scripts/overture/upsert.ts` con un `CASE … = ANY(places.locked_fields)` en las cinco
  columnas, para poder testear la regla contra la base **sin salir a S3**. Al final, el reporte
  lista los campos fijados que Overture ya trae iguales — **se informa, no se libera solo**.
- **Dos superficies con reglas distintas**: el admin edita directo desde una **7ª tab
  «Lugares»** (buscador que reusa `buscarLugaresPorNombre` sin moverlo, editor con el
  `pin-picker` del alta, bitácora y «Soltar» por campo); el dueño **propone** desde
  `/mi-negocio/[placeId]` y su propuesta entra a la **misma cola de aprobación** que los
  reclamos. El pin mueve al lugar en la búsqueda de todos, y correr el pin a una zona de más
  tráfico es el incentivo clásico de spam en un directorio.
- **El `name` es solo de admin** y una sola propuesta pendiente por lugar (índice único
  parcial). La **fuente es obligatoria** en las dos superficies y se valida en la función, no
  solo en la UI: *"quién"* con un solo admin vale poco, *"con qué lo verificó"* vale mucho.
- **`formattedAddress` entró al field mask de Place Details** con costo marginal **US$0**
  verificado contra la doc (la request ya se factura a Enterprise, y sumar un campo Essentials
  no mueve el tier). Lo consume **solo** el editor de admin, vía el endpoint que ya existía. La
  ficha pública no lo renderiza y **no hay botón que lo copie a `places.address`**: eso sería
  persistir contenido de Google.

**Lo que el QA en vivo confirmó y el spec solo había deducido:** el `google_place_id` de
Matienzo **apuntaba a otro negocio**. Antes de corregir, Google contestaba `Pringles 1210` —ni
siquiera nuestro 1249, sino otro número de la misma cuadra—, porque el match se resuelve a
±300 m del pin propio; al corregir el pin, el id cambió y la dirección de Google pasó a ser
`Av. Juan Bautista Justo 2959`. La ficha venía mostrando horarios y rating de un local que no
era.

---

## ORDEN_ORGANICO — que la primera pantalla no abra con Burger King (PBETA-R1-02) {#orden_organico}

**Spec:** [`docs/specs/done/ORDEN_ORGANICO.md`](../specs/done/ORDEN_ORGANICO.md) ·
**QA:** [AnalisisQA § QA /qa-spec — ORDEN_ORGANICO](../qa/AnalisisQA.md) · ✅ 2026-08-10

**Qué hace:** el orden orgánico de la búsqueda ordenaba por `places.confidence`, que **no mide la
calidad del lugar sino la confianza de Overture en el dato** — y una cadena tiene dato impecable.
Medido: una cadena grande tenía **4,2× más probabilidad** de caer en el tramo de `confidence` que
encabeza el listado, así que *Palermo Soho · Cenar afuera* abría con `1 Burger King · 2 Subway · …
· 10 McDonald's`. Ahora el orden es **dueño > banda > confidence > nombre**, y esa misma pantalla
abre con Las Pizarras bistro, L'Adesso y Barú Gastropub. **Es orden, no filtro**: ninguna cadena se
oculta ni se despublica.

**Alcance:**

- **La señal nueva es una banda 0-3, no un score con pesos** (decisión 2): `3` no-cadena y curado ·
  `2` no-cadena · `1` cadena curada · `0` cadena. Se lee de un vistazo, se testea con
  igualdad y se puede explicar ("está 4º porque es cadena"). Vive en `bandaKey`
  (`lib/search/query.ts`), dentro de `clavesDeOrden` y **entre `ownerRank` y `confKey`**.
- **La precedencia es cadena ANTES que curado, y está medida** (decisión 3): la curaduría curó
  **85 McDonald's y 41 Starbucks**, así que con «curado primero» *Un café · Palermo Soho* abriría
  con Starbucks 2º y 3º. Es el caso ORD-03 del QA y existe para eso.
- **«Curado» = tiene al menos un `place_tags` con `source='admin'`** (decisión 4): 1.202 de 18.993
  lugares, y **las 46 zonas tienen ≥ 21**, o sea que alcanza para llenar la primera pantalla en
  todas. Corolario deliberado: **cada corrida de curaduría mejora el orden sola**, sin tocar código.
- **«Cadena» = el nombre normalizado está en `search.cadenas`** (`app_settings`, decisión 5), con
  **igualdad exacta** sobre `immutable_unaccent(lower(name))` — nunca prefijo ni `LIKE`, que se
  comería «La Parrilla» al querer «La Parrilla del Tío». Dueño único:
  **`lib/search/cadenas.ts`**, que lee, valida, cachea por request y expone el fragmento SQL.
  Nadie más lee esa clave.
- **No se computa al vuelo a propósito**: un `COUNT` por nombre en el `ORDER BY` es un agregado
  global, y sobre todo la lista **necesita criterio humano** — Havanna (110 locales) y Café
  Martínez (95) son cadenas para el detector y opciones reales en el conurbano. Sacarlas es un
  `UPDATE`, no un deploy.
- **La banda ordena, NUNCA filtra** (decisión 8): `construirWhere` no se tocó, así que
  `countPlaces`, «Ver N lugares» y el piso de los chips (`PISO_HOME` / `PISO_ZONA`) devuelven los
  mismos números. Verificado con la matriz de `cobertura-chips` corrida antes y después: **`diff`
  vacío**.
- **El cursor no necesitó código nuevo** (decisión 11): `clavesDeOrden` es fuente única y el keyset
  la reusa, así que la banda entró como una clave más (`'b'`). Lo mismo `searchPins`, que hereda el
  orden — los 200 pins siguen siendo los mismos lugares que encabezan la lista.
- **Dónde la banda no manda** (decisión 10): en GPS ordena la distancia (un Burger King a 100 m es
  legítimamente lo más cercano) y con texto manda la similitud; ahí la banda solo desempata, que es
  donde hace falta ("cafe" empata mucho).
- **`scripts/cadenas.ts` (`npm run cadenas:proponer`) propone, no escribe** (decisión 14): imprime
  los nombres con ≥ 8 locales y el `UPDATE` listo para pegar. Se corre después de cada import.
- **Puerta de ida y vuelta** (decisión 16): sin columna nueva y sin dato materializado. Vaciar
  `search.cadenas` apaga la mitad «cadena» del orden en silencio, sin error y sin pantalla rota.
- **Una sola migración, y es un índice**: `0017_orden_organico` agrega el parcial
  `place_tags (place_id) WHERE source='admin'` (3.967 filas de 51 mil). El costo de la página 1 sin
  zona pasó de **116,6 ms sin índice a 41,5 ms con él** (−64 %); con zona, el caso mayoritario,
  2,5 → 5,9 ms.

**Lo que NO hace:** no cura nada (consume la curaduría, no la toca) · no usa señales de Google
(rating y reviews no se pueden persistir) ni de uso (`detail_views` tiene 211 en total: ordenar con
eso sería ruido, y el rich-get-richer sobre un catálogo sin tráfico es un pozo) · no toca los
destacados pagos, que son una query aparte · descartó la «riqueza de perfil» (website/redes) por
**contraproducente**: 88,8 % de las cadenas tienen website contra 44,1 % de los únicos.

**Efecto medido:** 29 de las 46 zonas cambiaron de #1 y ninguna perdió un lugar.

---

## HOME_ENTRADAS — que la home diga que además de buscar se puede votar y preguntarle a la IA (PBETA-R1-05) {#home_entradas}

**Spec:** [`docs/specs/done/HOME_ENTRADAS.md`](../specs/done/HOME_ENTRADAS.md) ·
**QA:** [AnalisisQA § QA /qa-spec — HOME_ENTRADAS](../qa/AnalisisQA.md) · ✅ 2026-08-14

**Qué hace:** la home sin sesión tenía **dos** links —`/login` y `/legales`—, así que se podía usar
la app entera creyendo que era un buscador de bares: nada anunciaba las votaciones ni el chat IA.
Ahora el hero del estado vacío suma dos renglones que son link entero, «¿Van varios? **Armá una
votación** y que elija el grupo» y «¿No sabés qué pinta? **Contale a la IA**». Al leer el código el
hallazgo se achicó y se volvió más preciso: **no faltaba navegación, faltaba anuncio para el
anónimo** — con sesión las 7 rutas ya vivían en el `AccountMenu`.

**Alcance:**

- **Todo lo nuevo vive adentro del bloque `!tieneBusqueda(params)`** (decisión 1), el mismo que ya
  se colapsaba al buscar. Por eso el costo en la pantalla de trabajo es **cero**: con una búsqueda
  activa la home no cambia **ni un nodo**, verificado en vivo (0 elementos y el copy tampoco está en
  el HTML). Descartadas las tarjetas bajo el buscador (empujan la búsqueda abajo del pliegue en
  390 px) y la tab bar (56 px en **todas** las pantallas, y pelea con el mapa a pantalla completa
  que MAPA se acababa de ganar).
- **Cada puerta es un renglón entero y el renglón entero es el link** (decisión 3). No es estética:
  es la forma de llegar a **44 px** de toque sin inventar un componente. Dos links inline en un
  párrafo que se parte a 360 px terminan apilados y con las áreas de toque **solapadas**, que es el
  bug que `R1-08` y `R2-05` vienen a cerrar. Medido con `getBoundingClientRect()`: **56 y 44 px** a
  390 y a 360, con 0 px de solape.
- **Se anuncian dos y solo dos** (decisión 2). *Mis lugares* sin sesión y sin nada guardado lleva a
  una pantalla vacía —es una feature de vuelta, no de primera visita— y *Registrá tu negocio* le
  habla a otro rol: en el hero es ruido para el 99%. Las dos siguen en el menú.
- **`/votacion/nueva` sin sesión dejó de redirigir a `/login`** y muestra una landing con la forma de
  la de `/chat` (decisión 4): anunciar algo y que la puerta sea un formulario de login sin contexto
  es peor que no anunciarlo, y CHAT_IA (decisión 20) ya había justificado el patrón. **El redirect
  era UX, nunca el boundary**: el gate real sigue intacto en `app/api/votaciones/route.ts` (401
  antes de parsear el body) y en `crearVotacion` (el gate «1 activa» dentro de la transacción, con
  `FOR UPDATE`). La revisión de seguridad lo confirmó — cero hallazgos.
- **El menú de cuenta se abre también sin sesión** y el control del header pasa de «Ingresar» a un
  **☰** (decisiones 5 y 6), con *Ingresar* primero y resaltado. No conviven los dos controles: en
  390 px el header ya lleva el wordmark y con sesión el patrón ya era *un solo control a la derecha*.
  **Costo declarado y aceptado:** ingresar deja de estar a un toque — se acepta porque buscar, la
  ficha y votar no piden cuenta, y las dos pantallas que sí la piden traen su propio CTA. Las rutas
  privadas (`/mis-votaciones`, `/mis-lugares`, `/mi-negocio`, `/cuenta`) **no** aparecen en la rama
  anónima.
- **De paso cerró el segundo agujero del hallazgo**, el que el título no nombraba: con sesión las 7
  rutas vivían detrás de una inicial redonda que no se lee como menú.

**Lo que quedó anotado y no se hizo acá:** la landing nueva y la de `/chat` son el **mismo markup
repetido**, no compartido. Es lo que pedía la decisión 4 —«reusar **la forma**»— pero unificarlas en
un `<LandingSinSesion>` obliga a tocar `/chat`, que este spec declara fuera de scope: va al BACKLOG
como paso aparte, según la regla de duplicación de CLAUDE.md. Son 25 líneas de layout, no una regla
de negocio duplicada. Y el control ☰ mide 36×36 a propósito —hereda el `size-9` del avatar con
sesión, para que el header tenga el mismo control en las dos ramas—: subirlo a 44 es `PBETA-R2-05`.

---

## NAVEGACION — que el botón «atrás» del celular deje de deshacer filtro por filtro (NAV-01) {#navegacion}

**Spec:** [`docs/specs/done/NAVEGACION.md`](../specs/done/NAVEGACION.md) ·
**QA:** [AnalisisQA § QA /qa-spec — NAVEGACION](../qa/AnalisisQA.md) · ✅ 2026-08-14

**Qué hace:** el botón físico deshacía **paso por paso** en vez de subir por la jerarquía. La
medición dio vuelta el diagnóstico: el eje que infla el historial **no** son las pantallas —`ficha →
back → otra ficha` no crece nunca, el `push` trunca el forward— sino los **filtros**. El recorrido
`home → zona → chip → chip → destildar chip → ficha` dejaba `history.length` en 6 y **5 backs hasta
la home, 4 de ellos la misma pantalla de búsqueda**. Ahora ese mismo recorrido no mueve el contador:
queda en **2**, y un back devuelve el listado con los filtros puestos. De paso cierra un bug que
nadie estaba buscando: la ficha abierta en frío —el link de WhatsApp, que es el loop viral— tenía
como única salida `about:blank`.

**Alcance:**

- **El eje de filtros pasa a `replace`** (decisión 1): chip de ocasión
  (`components/search/occasion-chips.tsx:73`), confirmar zona (`search-shell.tsx:390`), aplicar el
  sheet de Filtros (`:402`) y «Limpiar búsqueda» (`:140`). Son **estados de la misma pantalla**, no
  pantallas. **Enmienda la decisión 29 de BUSQUEDA**, que hacía `push` al confirmar un sheet: aquella
  resolvía *cuánto* inundaba cada toque suelto, y la medición mostró que incluso una tanda por gesto
  deja 4 de 5 backs en el mismo listado — y que prender y apagar un chip apilaba **dos** entradas
  para una URL **idéntica**.
- **La URL no se toca**: `replace` la escribe igual, así que la decisión 12 de BUSQUEDA (la URL es el
  estado, el deep link se comparte) queda intacta — verificado pegando `/?z=…&t=…` en una pestaña
  nueva. Lo único que cambia es que no queda entrada en el historial.
- **Deshacer un filtro es trabajo de la UI visible** (decisión 3): el chip queda `[pressed]` y se
  toca de nuevo, la píldora «Quitar Bar ×» y «Limpiar búsqueda». El back era la cuarta affordance,
  la invisible y la cara.
- **El «Volver» de la ficha se vuelve híbrido** (decisiones 5 y 8): con historia propia hace `back` y
  vuelve al listado **con los filtros puestos** —que es el contexto que subir siempre perdería—; sin
  ella sube a `/` con **push**, que no atrapa (el back devuelve a la ficha y el siguiente sale de la
  app, el contrato normal del browser).
- **Una regla, un dueño:** `lib/navegacion/volver.ts`. `decidirVolver({ navegoEnLaApp, historyLength })`
  es **pura** y se testea sin browser; el marcador vive en un client component del layout raíz
  (`components/navegacion/marcador-navegacion.tsx`). `grep -rn "router.back()"` devuelve **un solo**
  llamador y pasa por acá.
- **La detección tiene guardia doble y las alternativas están descartadas por medición** (decisión 6):
  `history.state` de Next solo trae `__NA` y `__PRIVATE_NEXTJS_INTERNALS_TREE` (internals privados) y
  `document.referrer` da `""` en entrada fría y no cambia en navegación client-side. El marcador vive
  en `sessionStorage`, que se **clona** al abrir una pestaña desde un link, así que solo puede venir
  mentido: por eso además se exige `history.length > 1`.
- **No se intercepta `popstate`** (decisión 7), y queda escrito para que no se re-abra sin datos
  nuevos: con el eje de filtros en `replace` el stack queda en 2-3 entradas y el back se comporta
  solo. Interceptarlo es el riesgo caro —tocar atrás, no ver nada, tocar de nuevo y irse de la app—,
  que en `standalone` no tiene escape.

**Lo que el QA en vivo destapó y no se veía leyendo código:** con un marcador **booleano** («hubo
alguna navegación en esta pestaña»), el recorrido `ficha en frío → Volver → home → back físico →
Volver` volvía a dejar `about:blank`: la subida del propio botón prendía el flag. El marcador guarda
**la pantalla por la que entró la pestaña** y «hay historia propia» pasa a ser «la actual no es la de
entrada». No cambió la decisión ni la firma pura.

**Lo que quedó abierto:** `NAV-11` — el recorrido con la **PWA instalada** (`display: standalone`).
No se puede emular desde Playwright; el código es el mismo y no depende de la barra del navegador,
pero **lo tiene que probar Fer en el teléfono**.

## INVITACION — la pantalla por donde entran los usuarios nuevos (bloque R2 de PULIDO_BETA) {#invitacion}

**Spec:** [`docs/specs/done/INVITACION.md`](../specs/done/INVITACION.md) ·
**QA:** [AnalisisQA § QA /qa-spec — INVITACION](../qa/AnalisisQA.md) · ✅ 2026-08-14

**Qué hace:** cierra los **8 hallazgos abiertos del recorrido R2** de `PULIDO_BETA` (*«me invitaron
a votar»*) más `PBETA-R4-02`, que vive en `/votacion/nueva` pero cuyo síntoma se paga acá. Ninguno
rompía nada —por eso ninguno era BLOQUEANTE— y juntos hacían otra cosa: **R2 es la única pantalla
de la app que ve un desconocido antes de decidir si la app le interesa**, y se jugaba la primera
impresión con un link sin imagen de preview (la forma exacta que tiene el spam en un grupo de
WhatsApp) y un H1 de 3-4 líneas que repetía los nombres que ya estaban en las cards de abajo.

**Alcance:**

- **`R2-02` — el link deja de verse pelado.** Una `og:image` de marca 1200×630 generada con
  `ImageResponse`, y la home —que **no declaraba ninguna** etiqueta `og:`/`twitter:`— pasa a
  declarar `openGraph` + `twitter:card = summary_large_image` (`app/layout.tsx`).
- **`R2-04` — el H1 sin título propio pasa de la lista de nombres a `¿A dónde vamos?`**: de 3
  líneas a 390 px y 4 a 360, a **una sola**. `tituloDe()` sigue siendo la **única** fuente del H1 y
  del `og:title`. Los nombres no se pierden: siguen en la descripción del preview, que es donde
  sirven. **Cierra de arrastre `R2-13`** (el H1 se desactualizaba al sumar un lugar): ya no se
  compone con la lista, así que no tiene con qué desactualizarse — sin código propio.
- **`R2-05` — los toques a 44.** «Votar» 63×34 → **324×44**, «Inicio» 35×20 → **51×44**, el `+` del
  sheet 32×32 → **44×44** y el link del pie 106×15 → **106×44**. Se escriben las clases a mano y
  **no** se adopta el primitivo `Button` (que ya está en 44 desde `PBETA-R1-08`): el estado «sin
  votar» es un botón con borde y fondo transparente, variante que `Button` no tiene, y agregarle una
  `outline` para un solo uso sería especular.
- **`R2-06` + `R2-07` en una línea, y arriba:** «Cierra en 2 días · Podés cambiar tu voto cuando
  quieras». El plazo tiene **dueño único** en `lib/votaciones/estado.ts` (`cierreEnPalabras`, puro,
  5 tests) y es **relativo y sin huso horario a propósito** — una fecha absoluta habría sumado un
  segundo consumidor a `partesEnAR` para una pregunta que es una resta. Siempre redondea para abajo:
  nunca promete más tiempo del que hay. La frase del voto reversible **se saca del pie**, donde
  aparecía recién después de votar, o sea cuando el miedo ya no existía.
- **`R2-11` — el bloque de voto entra a la card.** Chip de origen + card + barra + botón quedan
  dentro de **un** recuadro. **No se toca `PlaceCard`**: lo comparten 5 pantallas y esto es
  agrupación local: el `li` pasa a ser la card y `PlaceCard` entra sin borde ni fondo propios.
- **`R2-10` —** la bajada del sheet, debajo del título y no al costado.
- **`R2-12` — el desglose por opción se ve recién con el voto puesto; el total, siempre.**
  ⚠️ **Enmienda PARCIAL a la decisión 13 de `VOTACION`** (resultados en vivo para todos), anotada
  inline en su fila. El que empuja el re-compartir *(«vamos 2 a 2, voten»)* **ya votó**, así que
  conserva los resultados en vivo intactos; el único que queda sin desglose es el que llega último
  y, viendo que uno ya ganó, vota eso o no vota. Cerrada, vencida o cancelada ⇒ se ve todo, con o
  sin voto propio (decisión 15, intacta).
- **`R4-02` — el nudge del título**, no un campo obligatorio: «Ponele un título» + «Es lo primero
  que ve el grupo cuando abre el link». El creador es el lado escaso del loop viral y no se le traba
  la pantalla para arreglar la de enfrente. El fallback del H1 se arregló **igual y aparte**: hay
  votaciones ya creadas sin título y ningún nudge las alcanza.

**Las dos cosas que la medición dio vuelta** (decisiones 2 bis y 2 ter, y la lección del cierre):

1. **`app/opengraph-image.tsx` no servía**, aunque es lo idiomático. Para las imágenes **de
   archivo**, Next arma la URL con la de su deploy —en `dev`, `localhost`— e **ignora
   `metadataBase`**, incluso si el mismo segmento declara la imagen a mano. Con eso el preview no se
   puede verificar desde afuera de la máquina, que es **exactamente cómo se verifica esto**. Vive en
   **`app/og/route.tsx` + `force-static`**: como ruta común la URL sale de `metadataBase`
   (`BETTER_AUTH_URL`, la misma de los mails) y es la misma en dev y en producción. El build lo
   confirma: `/og` figura como `○ (Static)`.
2. **Una página que declara `openGraph` pisa el del padre ENTERO, imagen incluida.** Con la imagen
   en la raíz, la votación y la ficha **seguían saliendo sin `og:image`**. Se hereda del `parent` de
   `generateMetadata`, no se escribe la ruta a mano en cada una: sigue habiendo un solo archivo que
   la define. **La ficha entró por esto** aunque no sea de R2.

**Archivos clave:** `app/og/route.tsx` (nuevo) · `app/layout.tsx` · `app/votacion/[token]/page.tsx`
· `app/votacion/[token]/votacion-client.tsx` · `app/votacion/nueva/nueva-client.tsx` ·
`lib/votaciones/estado.ts` (+ tests). **Sin migración y sin tocar `PlaceCard`.**

**Lo que quedó anotado y no entró** (en el QA, para triaje): 5 toques siguen abajo de 44 y **ninguno
es de `R2-05`** —tres son de `SUGERIR_EN_VOTACION`—; y el panel del creador tiene **su propia** regla
de título (`app/mis-votaciones/mis-votaciones-client.tsx:43`), así que la misma votación ahora se
llama distinto en cada pantalla. Puede estar bien (en una *lista* los nombres son lo que distingue),
pero es una segunda implementación de la misma regla y va al `BACKLOG` como territorio de R4.
