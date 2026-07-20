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
