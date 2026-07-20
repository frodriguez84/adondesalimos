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
