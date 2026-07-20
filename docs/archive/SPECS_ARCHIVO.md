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
