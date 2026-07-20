# QA — A Dónde Salimos

Registro trazable de verificaciones. Cada sección es una tanda de QA con IDs estables:
re-verificar un spec **reusa los mismos IDs** (para cazar regresiones) y numera solo los
criterios nuevos. **No condensar ni borrar secciones históricas.**

---

## QA /qa-spec — CATALOGO (2026-07-20)

**Veredicto:** APROBADO
**Verificación técnica:** typecheck ✅ · tests ✅ 35/35 · build ✅
**Método:** checkers independientes (Explore read-only, haiku, maker≠checker) contra el DoD
de `docs/specs/active/CATALOGO.md`, más verificación en vivo contra el Postgres local
(26.057 lugares importados) y render HTTP real de `/legales`.

| ID | Criterio | Resultado | Evidencia / Gap |
|----|----------|-----------|-----------------|
| CAT-QA-01 | Migración genera y aplica limpio: `places`, `tags`, `place_tags`, `app_settings` + enum `facet` | ✅ PASS | `lib/db/schema.ts` · `drizzle/0000_complex_mister_sinister.sql`. Aplicada contra Docker: 4 tablas + 3 enums (`facet`, `place_source`, `place_tag_source`). Índices: unique en `overture_id`, btree en `confidence` |
| CAT-QA-02 | Sin columnas de nombre/horarios/rating/fotos de Google (prohibición del ToS) | ✅ PASS | Verificado por checker: solo existe `google_place_id`. No hay `rating`, `hours`, `photos` ni `google_name` |
| CAT-QA-03 | `db:seed` carga 105 filas de tags + los 2 settings | ✅ PASS | `SELECT count(*) FROM tags` = **105**. Settings: `catalog.confidence_threshold`=0.5, `pricing.band_limits`=[15000,30000,60000] |
| CAT-QA-04 | Seed idempotente: 2 runs no duplican ni pisan `active` | ✅ PASS | `UPDATE tags SET active=false WHERE slug='trivia'` → re-seed → sigue en `false` y el total sigue en 105. `active` deliberadamente ausente del `onConflictDoUpdate` (`scripts/seed.ts`) |
| CAT-QA-05 | Spot-check de taxonomía: `pasteleria` existe, `heladeria`/`panaderia` no, `asiatica` con 6 hijos | ✅ PASS | Query directa: pasteleria=1 · heladeria+panaderia=0 · hijos de asiatica=6 · 37 filas con `parent_id` |
| CAT-QA-06 | Import contra release `2026-06-17.0` y bbox AMBA, construido sobre `taxonomy` (no `categories`) | ✅ PASS | `scripts/import-overture.ts`: `RELEASE='2026-06-17.0'`, bbox lon -59.1/-58.1 · lat -35.05/-34.28, `taxonomy.primary AS category`. El bbox devuelve **282.865 POIs**, idéntico a la medición del spec |
| CAT-QA-07 | Include/exclude aplicado: cero `ice_cream_shop`/`bakery`/`dessert_shop` | ✅ PASS | **26.057** lugares importados; `count(*) WHERE overture_category IN (...)` = **0**. Allowlist + denylist explícita en `scripts/overture/categories.ts`, la denylist gana (test) |
| CAT-QA-08 | Import SIN cortar por confidence (existen filas < 0.5) | ✅ PASS | **7.064** filas con `confidence < 0.5` persistidas e invisibles (27%). El corte vive solo en la query |
| CAT-QA-09 | Re-correr el import no duplica y preserva `google_place_id`, `publish_override` y tags `source != 'import'` | ✅ PASS | Con datos plantados: 2º run → places 26.057 → **26.057** (0 nuevas, 26.057 actualizadas); `google_place_id` de prueba intacto, `publish_override` intacto, tag de `source='admin'` sobrevivió. El upsert no toca esas columnas y el borrado de tags filtra por `source='import'` |
| CAT-QA-10 | Helper de visibilidad ÚNICO exportado desde `lib/db`, con los 4 casos testeados | ✅ PASS | `lib/db/visibility.ts` (`isPlacePublished` + `publishedWhere`), reexportado en `lib/db/index.ts`. Sin duplicación de la regla en el repo. 4 casos en `lib/db/__tests__/visibility.test.ts`: bajo umbral · override · cerrado (invisible aun con override) · owner sin override |
| CAT-QA-11 | El umbral se lee de `app_settings` en runtime (UPDATE cambia el conteo sin rebuild) | ✅ PASS | `getConfidenceThreshold()` sin caché de módulo (`lib/db/settings.ts`). Test de integración `publicacion.integration.test.ts` hace el UPDATE y verifica el cambio. En vivo: umbral 0.5 → **18.993** publicados; 0.7 → **13.035**; volver a 0.5 restaura |
| CAT-QA-12 | `/legales` renderiza 9 fuentes + 3 licencias + Google | ✅ PASS | Render HTTP real en `localhost:5178/legales`: Meta, Microsoft, PinMeTo, Krick, RenderSEO, DAC, BrightQuery (CDLA-Permissive 2.0) · Foursquare (Apache 2.0 + link al NOTICE.txt) · AllThePlaces (CC0 1.0) · atribución a Google Maps Platform. Linkeado desde el footer de la home |
| CAT-QA-13 | Gate técnico verde | ✅ PASS | `npx tsc --noEmit` limpio · `npm test` 35/35 · `npm run build` OK (rutas `/`, `/legales`) |

### Calidad de datos (CAT-04 del QA manual del spec)

Spot-check contra la realidad sobre lugares conocidos: nombre, dirección, teléfono y redes
correctos. Cobertura de contacto tras el import: **82,4% con teléfono** · **96,3% con redes**
· 11.546 con web (la medición del spec estimaba 86% / 98% — consistente).

### Hallazgos (no bloqueantes)

**H-1 — Las listas de Overture no cruzan el driver como array (bug encontrado y corregido).**
Las columnas `VARCHAR[]` (`phones`, `websites`, `socials`, `emails`) **no llegan como array
de JS** desde `@duckdb/node-api`. La primera versión del import usaba `Array.isArray` sobre
el valor crudo, así que los 26.057 lugares se guardaron con **todo el contacto en null, sin
un solo error**. Se corrigió serializando a JSON en la query (`CAST(to_json(x) AS VARCHAR)`)
y parseando en `scripts/overture/normalize.ts`, con tests de regresión. Lección registrada.

**H-2 — `operating_status` viene NULL en el 100% de los datos de AMBA.**
Los 26.057 registros del bbox traen `operating_status` nulo en origen; el import los
persiste como `'open'` (el default del schema). Consecuencia: el filtro de
`operating_status`, aunque está implementado y unit-testeado, **hoy no descarta ningún
lugar** — su valor es para lugares de dueño (spec 5) y para cuando Overture empiece a
poblar el campo. No es un gap del DoD (el spec pide que el filtro exista y se aplique
siempre, y así es), pero Búsqueda **no debe asumir** que este campo ya filtra lugares
cerrados. Anotado en `docs/product/BACKLOG.md`.
