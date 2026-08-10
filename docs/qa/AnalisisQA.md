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

---

## QA /qa-spec — ZONAS (2026-07-20)

**Veredicto:** APROBADO — 15/15 criterios PASS tras corregir el spec (ver *Re-verificación*)
**Verificación técnica:** typecheck ✅ · tests 53/53 ✅ · build ✅
**Método:** 4 checkers independientes (Explore read-only, haiku, maker≠checker) contra el DoD
de `docs/specs/active/ZONAS.md`. Los criterios de base de datos se verificaron con consultas
directas al Postgres, no por lectura de código.

### Criterios de done

| ID | Criterio | Resultado | Evidencia / Gap |
|----|----------|-----------|-----------------|
| ZONAS-QA-01 | Migración crea `zones`, `zone_aliases`, `place_zones` + enum `region` sobre la base de CATALOGO | ✅ PASS | `lib/db/schema.ts:50` (enum), `:143-167` (zones), `:173-186` (aliases, unique zone+alias), `:196-216` (pk compuesta, índice por zone_id, índice parcial is_primary). Migración `drizzle/0001_great_bloodstorm.sql`, aplicada |
| ZONAS-QA-02 | `data/zones/` con los 46 GeoJSON (21·9·7·9) + README con fuente, composición y licencia del conurbano; NUNCA OSM | ✅ PASS | 46 archivos, slugs 1:1 con `lib/zones/canon.ts`. `data/zones/README.md:12-36` documenta BA Data (CC BY 2.5 AR) e IGN (Ley 27.275). OSM descartada explícitamente en `:24-26`. Cero referencias a OSM en el árbol |
| ZONAS-QA-03 | Los 4 de Palermo particionan el barrio oficial: unión ≈ Palermo, sin huecos ni solapes (test con turf) | ✅ PASS | `lib/zones/__tests__/poligonos.test.ts:70-88`. Suma de áreas vs área de la base con 0,1% de tolerancia + intersección por pares < 1 m². Los 4 suman 15,92 km² = Palermo oficial. Test corriendo, no skipeado |
| ZONAS-QA-04 | `zones:load` carga las 46 + aliases seed; re-correrlo no duplica | ✅ PASS | `scripts/zones/load.ts:76-96` upsert por slug (`active` deliberadamente ausente); `:110` alias con `onConflictDoNothing` sobre el índice único; `:131-133` falla si el total ≠ 46. Buffer 400 m en `:23` y `:73` |
| ZONAS-QA-05 | `zones:assign` deja ≤1 primaria por lugar (test) y búsqueda ⊇ primaria; re-correrlo da lo mismo | ✅ PASS | `scripts/zones/assign.ts:71-76` regenera en transacción. Test en `lib/zones/__tests__/asignacion.integration.test.ts:81-92`. Base: **0** lugares con 2+ primarias y **0** primarias huérfanas |
| ZONAS-QA-06 | Test del caso borde: punto a <400 m del límite Villa Crespo / Palermo Soho → 1 primaria y 2 zonas de búsqueda | ✅ PASS | `asignacion.integration.test.ts:106-120`. Av. Córdoba y Thames: primaria única `palermo-soho`, aparece también en `villa-crespo`. Usa el `polygon_search` real de la base, no el polígono exacto |
| ZONAS-QA-07 | Lugares sin zona: reporte generado y revisado, con el detalle de en qué localidades están | ✅ PASS | El reporte lista las localidades de los 2.200 sin zona (8,4%), que es lo que permitió detectar H-1. Criterio reformulado: la predicción original del spec ("bordes del bbox — Escobar/Pilar/Varela") era falsa — esos tres partidos tienen **0** sin zona |
| ZONAS-QA-08 | `npx tsc --noEmit` · `npm test` · `npm run build` verdes | ✅ PASS | typecheck limpio · 53/53 tests · build OK (rutas `/`, `/legales`) |

### QA manual del spec

| ID | Caso | Resultado | Números reales |
|----|------|-----------|----------------|
| ZONAS-QA-09 (ZON-01) | Carga completa por región | ✅ PASS | caba 21 · norte 9 · oeste 7 · sur 9 |
| ZONAS-QA-10 (ZON-02) | Borde real cerca de Av. Córdoba y Dorrego | ✅ PASS | Lugares reales con 1 sola primaria y 2+ zonas en `place_zones` |
| ZONAS-QA-11 (ZON-03) | Invariante de primaria única | ✅ PASS | 0 filas |
| ZONAS-QA-12 (ZON-04) | Alias | ✅ PASS | `Villa Ortúzar` → `chacarita-colegiales`; `Balvanera` → `once-abasto` |
| ZONAS-QA-13 (ZON-05) | Las 4 zonas de Palermo tienen mucha mayor **densidad** de publicados por km² que la región Sur | ✅ PASS | Palermo **108,9 lugares/km²** (1.734 en 15,92 km²) vs Sur **3,1** (2.598 en 837,98 km²) = **35,1×**. Criterio reformulado: en conteo absoluto Sur gana (2.598 vs 1.734), y esa era la métrica equivocada. Ver H-2 |
| ZONAS-QA-14 (ZON-06) | Los sin zona son minoría y **ninguno** cae en el centro de CABA | ✅ PASS | 2.200 (8,4%). **0 de los 2.200 cae dentro del polígono oficial de CABA** — verificado punto por punto contra los 48 barrios, no por bbox ni por `locality`. Ver H-5 |
| ZONAS-QA-15 (ZON-07) | Idempotencia de `load` + `assign` | ✅ PASS | Segunda corrida: mismos 46 · 4 alias · 35.589 filas · 2.200 sin zona |

### Hallazgos

**H-1 — El canon de 46 zonas deja 2.200 lugares (8,4%) sin zona, y no donde el spec creía.**
El spec anticipaba "minoría en los bordes del bbox — Escobar/Pilar/Varela profundos". Los tres
partidos nombrados tienen **0** lugares sin zona. Los que quedan afuera están en partidos
densos y céntricos que el canon simplemente no enumera: José C. Paz (153), Gregorio de
Laferrere (147), General Rodríguez (131), González Catán (113), Hurlingham (101), Ezeiza (84),
Isidro Casanova (84), Longchamps (83), más Guernica, Grand Bourg, San Vicente y Marcos Paz.
No es un defecto de implementación —la asignación hace exactamente lo que el spec pide— sino
un hueco del canon. Anotado en `docs/product/BACKLOG.md`.

**H-2 — ZON-05 es falso como está escrito, pero su razonamiento de fondo se sostiene.**
El spec usa el conteo absoluto ("Palermo suma más lugares que toda la región Sur") como el
dato que justificó la granularidad asimétrica. El conteo absoluto da lo contrario: 1.734 vs
2.598. Lo que sí se sostiene, y por goleada, es la **densidad**: las 4 zonas de Palermo ocupan
15,92 km² y la región Sur 838 km², así que Palermo tiene **109 lugares publicados por km²
contra 3,1 de Sur — 35× más denso**. La decisión de producto (partir Palermo en 4 y no juntar
9 partidos del sur en menos zonas) está bien tomada; la métrica elegida para verificarla,
mal. El criterio necesita reformularse en términos de densidad.

> Un checker especuló que `botanico-alto-palermo` podría tener "datos inflados o duplicados"
> por sus 697 lugares. Descartado: es la zona más grande de Palermo (11,62 km², el 73% del
> barrio, porque absorbe Bosques de Palermo, Hipódromo, Campo de Polo, Costanera y Aeroparque),
> y con 60 lugares/km² es la **menos** densa de las cuatro. ZONAS-QA-11 descarta duplicados.

**H-3 — Fuente del conurbano cambiada respecto de lo planificado.** ARBA (CC BY 4.0, la
licencia más limpia) entrega su ZIP truncado: 97.071 bytes de los 7.796.169 declarados, de
forma determinística y reproducible. Se usó el IGN vía WFS como fallback, con su licencia
verificada verbatim en el `AccessConstraints` del servicio (Ley 27.275, sin share-alike).
Documentado en `data/zones/README.md`. Anotado en el backlog para volver a ARBA si se arregla.

**H-4 — No existe polígono de localidad del conurbano en ninguna fuente estatal.** Verificado:
`ign:localidad_bahra` y la API Georef devuelven **puntos**; las localidades censales del INDEC
sí son polígonos pero en el conurbano colapsan al aglomerado (La Matanza entera es una sola) y
además están prohibidas comercialmente. La única fuente con polígonos de "Ramos Mejía" es OSM,
descartada por ODbL. Por eso las 8 zonas sub-partido se dibujaron a mano.

**H-5 — `places.locality` de Overture no es confiable en los bordes.** Durante la
re-verificación, un checker marcó ZON-06 como FAIL porque encontró 3 lugares sin zona con
`locality = 'Ciudad de Buenos Aires'`. Verificados punto por punto contra el polígono oficial
de los 48 barrios, **ninguno de los 3 está en CABA**: los tres caen en La Matanza (zona Villa
Madero, cruzando la General Paz), y Overture los etiqueta mal. El campo sirve como oráculo
**agregado** (el centroide de 300 lugares de una localidad es robusto), pero no fila por fila.

### Re-verificación (2026-07-20, mismo día)

El QA cerró primero en **BLOQUEADO** (1 FAIL en ZON-05, 2 PARCIAL) porque dos afirmaciones del
spec resultaron falsas contra los datos. No eran defectos de implementación, así que el fix
fue **corregir el spec**, no el código: ZON-05 pasó a medir densidad (que es lo que la decisión
2 siempre quiso decir) y la expectativa de cobertura del DoD se reemplazó por el detalle de
localidades. Ambas correcciones quedan registradas en `docs/specs/active/ZONAS.md` §
*Correcciones al spec durante la implementación*, con qué decía antes y por qué cambió.

Re-verificado por un checker independiente nuevo contra los criterios ya corregidos:

| ID | Antes | Ahora | Qué cambió |
|----|-------|-------|------------|
| ZONAS-QA-07 | ⚠️ PARCIAL | ✅ PASS | Criterio reformulado: pide el detalle de localidades, no una predicción de dónde estarían |
| ZONAS-QA-13 | ❌ FAIL | ✅ PASS | Criterio reformulado a densidad: 35,1× a favor de Palermo |
| ZONAS-QA-14 | ⚠️ PARCIAL | ✅ PASS | El FAIL del checker era falso positivo (H-5); verificado 0 agujeros en CABA |

**Ningún cambio de código entre el QA bloqueado y el aprobado.** Los 46 polígonos, los
scripts y los 53 tests son idénticos: lo único que se movió fueron dos criterios mal
formulados del spec y una verificación mejor hecha.

---

## QA /qa-spec — BUSQUEDA (2026-07-20)

**Veredicto:** APROBADO — 12/12 criterios PASS (BUSQ-QA-09 cerrado con QA en vivo)
**Verificación técnica:** typecheck ✅ · tests 144/144 ✅ · build ✅
**Método:** checker independiente (Explore/haiku, read-only) contra el DoD de
`docs/specs/active/BUSQUEDA.md`. Se verificó el DoD **completo de las 3 fases**, que es el
alcance del spec: F1 y F2 se cerraron sin QA formal porque el DoD nunca fue por fase.
**QA en vivo (2026-07-20):** BUSQ-QA-09 (vista mapa) no se puede cerrar leyendo código —
MapLibre solo se comporta en un browser real. Se verificó con Playwright contra
`https://adondesalimos.ngrok.app`, zona Palermo Soho, los 5 pasos del spec (ver detalle abajo).

| ID | Criterio | Resultado | Evidencia / Gap |
|----|----------|-----------|-----------------|
| BUSQ-QA-01 | Migración: `occasion_chips`, `chip_tags`, `place_impressions_daily`, extensiones `unaccent` + `pg_trgm`, índice trgm en `places.name` | ✅ PASS | `drizzle/0002_last_christian_walker.sql:3-42` (extensiones 3-4, `immutable_unaccent` 11-14, índice GIN 18-19, las 3 tablas 21-42) · `lib/db/schema.ts:228,240,260` |
| BUSQ-QA-02 | Primera visita: selector "Elegí zona", cero resultados, NO pide GPS al entrar; elegir zona dispara la búsqueda | ✅ PASS | `search-shell.tsx:110-116` (label) · `app/page.tsx:29-40` + `params.ts:143-150` (`tieneBusqueda` ⇒ `resultado` null) · `navigator.geolocation` aparece **solo** dentro de `pedirUbicacion()`, nunca en un efecto de montaje; con `gps=1` en la URL muestra estado que invita a tocar (`search-shell.tsx:118-121,235-239`) |
| BUSQ-QA-03 | Semántica **por tests**: OR intra-faceta, AND entre facetas, padre de Cocina expande hijos, multiselección de zonas, GPS reemplaza zonas (Haversine 2 km), visibilidad de CATALOGO siempre | ✅ PASS | Las 6 sub-reglas con test propio en `busqueda.integration.test.ts:196-275` · implementación en `query.ts:159-177,204-226` · `publishedWhere` es **siempre** la primera condición del `where` |
| BUSQ-QA-04 | Texto: "parrilla" sugiere y aplica el tag; "cafe" sin tilde matchea "Café"; el autocompletar matchea nombre de zona siempre y alias cuando existe (**los 4 alias, uno por uno**); Enter busca por nombre | ✅ PASS | `suggest.ts:24-30,58-83` · `suggest.test.ts:97-113` (`it.each` con los 4 alias) · typo y acentos en `busqueda.integration.test.ts:300-307` · Enter en `search-shell.tsx:147-153`. **Hallazgo:** *Villa Devoto* matchea por **nombre** de zona, no por alias — su fila en `zone_aliases` es redundante; los alias que agregan capacidad real son **3, no 4**. Registrado en el spec y en BACKLOG |
| BUSQ-QA-05 | URL ↔ estado bidireccional; cambiar filtros actualiza la URL sin romper el back | ✅ PASS | `params.ts:85-117` · test de ida y vuelta `params.test.ts:56-77` (`parse(serialize(x)) === x`, con `coords` fuera de la URL a propósito) · historial híbrido de la decisión 29 en `search-shell.tsx` (replace en gestos incrementales, push al confirmar un sheet) |
| BUSQ-QA-06 | Orden de la decisión 16 **con test**: dueño > confidence > nombre; con `q`, similitud primero | ✅ PASS | `query.ts:254-273` (`clavesDeOrden`) · test sin `q` en `busqueda.integration.test.ts:314-323` · **test con `q`** en 331-340: el lugar de dueño tiene *menor* similitud a propósito y queda segundo, que es lo que prueba la precedencia. Fixture diseñado midiendo `word_similarity` real (1.000 vs 0.615; umbral de `<%` = 0.6) |
| BUSQ-QA-07 | Los 9 chips sembrados en DB con sus tags; tocar uno aplica sus filtros como chips removibles; editarlo en DB cambia el comportamiento sin deploy; **un chip que da 0 no se lista** | ✅ PASS | `lib/db/chips.ts:64-119` (9 objetivo) + 127-160 (8 V1) · siembra idempotente `seed.ts:104-140` con validación de cantidad (87-89) · test directo contra la tabla `chips.integration.test.ts:74-95` · **la ocultación es conteo en runtime**, no `active`: `chips.ts:85-91`. El filtro adicional por `active` es el interruptor **manual** de curaduría — mismo patrón que `catalog.ts:87` con los tags, no contradice la decisión 25 |
| BUSQ-QA-08 | "Abierto ahora" NO aparece en el sheet de filtros y quedó en BACKLOG | ✅ PASS | Ausencia **estructural**, sin caso especial: `catalog.ts:90` descarta todo tag con `count === 0` y `:104` la faceta que queda vacía · `BACKLOG.md:26-28` |
| BUSQ-QA-09 | Vista mapa: pins del resultado (tope 200, orden de la lista), atribución OSM visible, mini-card al tocar; `/legales` con la línea de OSM/OpenFreeMap | ✅ PASS | **Código y datos:** tope en `params.ts:24` + `query.ts:397-400`; **test que compara pins contra lista elemento por elemento** en `pins.integration.test.ts:36-43`; el endpoint devuelve 200 pins con `truncated:true` en Palermo Soho (corrida real); mini-card en `map-view.tsx:139-141,219-239`; `attributionControl: { compact: false }` en `:89-91` y la atribución viene del TileJSON de OpenFreeMap; `/legales:156-177`. **QA en vivo (Playwright, ngrok, Palermo Soho):** teselas y pins renderizan; atribución `OpenFreeMap · © OpenMapTiles · Data from OpenStreetMap` se lee desplegada al pie del mapa (no detrás del botón "i"); tap de un pin abre la mini-card (*La Amistad Resto · Restaurante · Botánico y Alto Palermo*) y la X la cierra; los 200 pins se ven como clusters (64, 23, 18, 17, 15…) y tocar el cluster "64" hace zoom expandiéndolo; el aviso "Te mostramos los primeros 200. Achicá la zona o sumá filtros para verlos todos." aparece sobre el mapa. **Glyph 404 detectado y corregido:** la capa `clusters-count` no declaraba `text-font`, así que MapLibre pedía su default (`Open Sans Regular,Arial Unicode MS Regular`), que OpenFreeMap no sirve (404 → fallback de render local). Se fijó `text-font: ['Noto Sans Bold']` (OpenFreeMap sirve Noto); re-verificado en vivo: fonts 200, cero warnings de glyphs |
| BUSQ-QA-10 | Impresiones: los lugares mostrados suman +1 en su fila del día; agregado puro | ✅ PASS | `impressions.ts` (upsert que **suma**, `+ excluded.impressions`, no SET) · `after()` en `app/page.tsx:42-47` y `api/search/route.ts:34-39`; los pins **no** cuentan · **verificado contra la DB**: una búsqueda real pasó de 20 a 40 impresiones, 13 filas nuevas + 7 incrementadas · test de esquema: la tabla tiene exactamente `date`, `impressions`, `place_id` — cero identificadores de usuario |
| BUSQ-QA-11 | Rate limit activo en `/api/search` con test | ✅ PASS | `lib/middleware/rate-limit.ts:80-103` (60 req/IP/60 s, 429 + `Retry-After`) aplicado en los **tres** endpoints públicos (`search`, `count`, `pins`, línea 19 de cada uno) · test de bloqueo en `rate-limit.test.ts:48-59` |
| BUSQ-QA-12 | `npx tsc --noEmit` · `npm test` · `npm run build` verdes | ✅ PASS | typecheck sin errores · 144 tests en 17 archivos · build OK, rutas `/`, `/api/search`, `/api/search/count`, `/api/search/pins`, `/legales` |

### Correcciones aplicadas durante este QA

Tres criterios volvieron PARCIAL en la primera pasada y se arreglaron con **código y tests
nuevos**, no reformulando el criterio:

| ID | Gap del checker | Qué se hizo |
|----|-----------------|-------------|
| BUSQ-QA-04 | Solo 1 de los 4 alias tenía test | `it.each` con los 4 (`suggest.test.ts:97-113`). Ahí apareció el hallazgo de *Villa Devoto* |
| BUSQ-QA-06 | El DoD pedía "con `q`, similitud primero" **con test** y no existía | Fixture nuevo + test (`busqueda.integration.test.ts:331-340`), diseñado midiendo `word_similarity` contra la base en vez de estimar el umbral |
| BUSQ-QA-07 | El seed no validaba la cantidad sembrada; no había test contra la tabla | Validación en `seed.ts:87-89` + test directo en `chips.integration.test.ts:74-95` |

**Un hallazgo del checker se descartó como falso positivo:** que filtrar por
`occasion_chips.active` contradijera la decisión 25. No lo hace — la decisión dice que la
ocultación **por cero resultados** no debe ser `active`, y no lo es (es un conteo en runtime);
`active` es el interruptor manual de curaduría, exactamente como `tags.active` en
`catalog.ts:87`. Un segundo checker independiente, con el patrón de `catalog.ts` a la vista,
confirmó que son mecanismos ortogonales.

### QA en vivo de BUSQ-QA-09 — ejecutado (2026-07-20)

Verificado con Playwright contra `https://adondesalimos.ngrok.app` (dev server en 5178),
zona Palermo Soho. Los 5 pasos del spec, todos ✅:

1. ✅ Tocar **Mapa** — las teselas cargan y se ven los pins y clusters.
2. ✅ La atribución "OpenFreeMap · © OpenMapTiles · Data from OpenStreetMap" se lee sobre el
   mapa, desplegada y no detrás del botón "i".
3. ✅ Tocar un pin abre la mini-card (*La Amistad Resto · Restaurante · Botánico y Alto
   Palermo*); el botón X la cierra.
4. ✅ En Palermo Soho (200 pins) se ven los clusters (64, 23, 18, 17, 15…) y tocar el
   cluster "64" hace zoom expandiéndolo.
5. ✅ Aparece el aviso "Te mostramos los primeros 200. Achicá la zona o sumá filtros para
   verlos todos.".

**Hallazgo corregido (post-cierre):** OpenFreeMap devolvía 404 en el font stack de glyphs
`fonts/Open Sans Regular,Arial Unicode MS Regular/0-255.pbf`. Causa: la capa `clusters-count`
no declaraba `text-font`, así que MapLibre usaba su default —que OpenFreeMap no sirve— y caía
al fallback de render local. Se fijó `text-font: ['Noto Sans Bold']` en `map-view.tsx`
(OpenFreeMap sirve fuentes Noto, verificado por HTTP: `Noto Sans Regular/Bold` → 200,
`Open Sans…` → 404). Re-verificado en vivo con Playwright: las requests de fuentes dan 200 y
no queda ningún warning de glyphs. No bloqueaba ningún criterio del DoD; el fix elimina el
ruido de consola (que también pasaba en producción, no solo en dev).

Con BUSQ-QA-09 en PASS, los 12 criterios están verdes y el veredicto pasa a **APROBADO**.

---

## QA de fase — FICHA F1 (2026-07-20)

**Alcance:** solo **Fase 1** (ficha propia, sin Google). F2 (Google en vivo) y F3
(foto/atribución) se verifican cuando se implementen. **No es un `/qa-spec` de cierre**
(ese corre con las 3 fases y un checker independiente) — es la QA de fase: gate técnico +
tests + smoke en vivo. Los IDs son los del spec (`FICHA-NN`) y se reusan al cerrar.

**Veredicto de F1:** PASA (alcance F1)
**Verificación técnica:** typecheck ✅ · tests ✅ **165/165** (14 nuevos de F1) · build ✅
(con el dev server parado; `/lugar/[id]` sale como ruta dinámica `ƒ`, lista para F2).
**Método:** unit tests (`lib/lugar/__tests__/ficha.test.ts`), integración contra el Postgres
local (`detail-view.integration.test.ts`, `query.integration.test.ts`) y smoke en vivo con
Playwright/MCP contra `https://adondesalimos.ngrok.app` sobre un lugar publicado real
("Futbol Club ROMAN", Merlo).

| ID | Caso | Resultado | Evidencia / Nota |
|----|------|-----------|------------------|
| FICHA-01 | Ficha sin Google | ✅ PASS | Smoke en vivo: nombre, tipo ("Teatro / espacio cultural"), ubicación (Merlo, fallback a `locality`), dirección, teléfono (`tel:`), Facebook (clasificado por dominio), "Qué vas a encontrar → Música en vivo". Sin bloque de horarios/rating (F1 no lo renderiza). Único error de consola: `favicon.ico` 404, preexistente y ajeno |
| FICHA-02 | Visibilidad | ✅ PASS (F1) | UUID inexistente ⇒ **HTTP 404** en vivo. `getPlaceDetail` gatea por `isPlacePublished` de CATALOGO: bajo umbral sin override ⇒ `null` ⇒ `notFound()` (test de integración `query.integration.test.ts`). El sub-caso `operating_status='closed'` lo cubre el unit test de `visibility.ts` (hoy todo AMBA es `'open'`, ver H-2 de CATALOGO) |
| FICHA-10 | Prioridad de foto | ✅ PASS (unit) | `fotoPrincipal` testea el orden completo dueño → Google → placeholder. En vivo, sin filas en `place_photos`, se dibuja el placeholder de marca (nunca imagen rota). El "no pide foto a Google si hay de dueño" se cierra end-to-end en F3 |
| FICHA-14 | Cómo llegar | ✅ PASS | Deep link en vivo: `https://www.google.com/maps/dir/?api=1&destination=-34.7178597,-58.8005623` (lat/lng propio, sin `destination_place_id` porque aún no hay match). `comoLlegarUrl` testeado con y sin match |
| FICHA-15 | Crawler no gasta (parte OG) | ◑ PARCIAL | El `<title>`/OG salen con **solo datos propios** (nombre · zona · tags), verificado en vivo. La parte "los contadores de `google_api_usage` quedan iguales" es de F2 (no hay llamada a Google en F1) |
| FICHA-16 | Key no expuesta | ⏳ F2 | En F1 no se usa la key en ningún lado (no hay módulo de Google todavía). Se verifica sobre el bundle cuando exista `lib/google/places.ts` |
| FICHA-03..09, 11-13 | Matching, SKUs, cuotas, atribución, degradación | ⏳ F2/F3 | Requieren el enriquecimiento en vivo; fuera del alcance de F1 |

**Extra verificado (DoD F1):** `detail_views` incrementa una vez por apertura de ficha
publicada — en vivo quedó en `1` tras abrir la ficha una vez (el `after()` corre post-respuesta
y escribe el contador). El modelo de datos completo del spec quedó migrado (0003) y sembrado.

**Nota de método (lección BUSQUEDA aplicada):** el render de la ficha es HTML de server
component, no una vista browser-only como el mapa; aun así el smoke en vivo cazó que el
título/OG y el deep link salen bien, cosa que el checker read-only de `/qa-spec` no ve. Al
cerrar el spec (3 fases), la QA en vivo de F1 ya documentada **no se re-somete** a `/qa-spec`.

## QA de fase — FICHA F2 (2026-07-20)

**Alcance:** **Fase 2** (Google en vivo: matching, `/api/lugar/[id]/google`, cuotas,
horarios/rating/priceLevel, degradación). F3 (foto/atribución) queda pendiente. No es el
`/qa-spec` de cierre — es la QA de fase.

**Veredicto de F2:** PASA (alcance F2) — con **una salvedad documentada y de riesgo
aceptado**: FICHA-03 (calidad del matching a ciegas) tuvo un miss en el primer caso real
(ver la fila). No bloquea la fase: el matching persiste y degrada bien, y decisión 8 ya
aceptó ese riesgo con corrección manual como red. Falta medir la *tasa* de fallos.
**Verificación técnica:** typecheck ✅ · tests ✅ **204/204** (39 nuevos de F2) · build ✅
(con el dev server parado; `/api/lugar/[id]/google` y `/lugar/[id]` salen como rutas
dinámicas `ƒ`, `/robots.txt` estático).
**Método:** unit tests del camino del gasto (`lib/lugar/__tests__/enrichment.test.ts`,
`lib/google/__tests__/places.test.ts`), integración contra Postgres local
(`usage.integration.test.ts`, `matching.integration.test.ts`) y **QA en vivo con
Playwright/MCP** contra `https://adondesalimos.ngrok.app` sobre un lugar publicado real
(**"Club Milanesa"**, `3fab0080…`, Botánico y Alto Palermo), incluyendo un lugar que nunca
se había matcheado (`pending`).

| ID | Caso | Resultado | Evidencia / Nota |
|----|------|-----------|------------------|
| FICHA-01 | Ficha con bloque Google | ✅ PASS | En vivo: la ficha se ve entera y el bloque cliente resuelve el enriquecimiento. Único error de consola: `favicon.ico` 404, preexistente y ajeno |
| FICHA-03 | Matching correcto | ⚠️ MISS DOCUMENTADO | El resolver persiste bien (`pending → matched`, `matched_at` seteado, la 2da apertura no vuelve a llamar). **Pero el lugar matcheado es incorrecto/dudoso**: `ChIJ25d96J21vJURkGgqgdHC7Cw` = **"El Club de la Milanesa – Paseo de la Infanta"**, a **~160 m** del pin. Nuestro registro es "Club Milanesa @ Av. Libertador 3883"; en esa dirección exacta Google muestra **"Williamsburg Infanta"**. Es el riesgo del matching a ciegas (decisión 8): misma marca dentro de los 300 m, indistinguible sin pagar Text Search Pro. **Riesgo aceptado por Fer (2026-07-20)**: no se toca el radio hasta medir la tasa con un spot-check de ~10 fichas. **Mi PASS previo fue prematuro** — verifiqué que el rating coincidía con *un* "Club Milanesa", no que fuera el local de esa dirección (lección "un campo puede mentir fila por fila") |
| FICHA-05 | Sin match / persistencia | ✅ PASS (parcial) | La persistencia del resultado del resolver está verificada (matched arriba); el caso `not_found` que no reintenta el mismo día lo cubren los unit tests de `planDeMatching`/`dentroDeVentanaReintento`. Falta un lugar real sin match para el smoke |
| FICHA-07 | Horarios en vivo | ✅ PASS | En vivo: **rating 4,8 (4025)** y **"Abierto ahora"** coinciden con lo que muestra Google Maps para Club Milanesa en ese momento. Acordeón "Ver horarios de la semana" presente |
| FICHA-08/09 | Un solo SKU pago / costo por ficha | ✅ PASS (contador) | Tras la apertura, `google_api_usage` del mes tiene **exactamente `{details: 1}`** y **cero `photos`**. El resolver (Text Search IDs-Only) **no se cuenta** (es $0). La verificación contra la consola de facturación de Google (SKU 635D-A9DD-C520 vs Pro) queda para Fer — el contador es el proxy |
| FICHA-12 | Tope de cuota | ✅ PASS | `UPDATE google.details_monthly_cap = 0` ⇒ recargar la ficha: sigue abriendo, el bloque muestra **"No tenemos los horarios en este momento."** y `google_api_usage` **no se movió** (siguió en `details: 1`) — 204 sin llamar ni incrementar. Restaurar el tope a 5000 revive el bloque |
| FICHA-13 | Degradación | ✅ PASS (parcial) | El camino "sin cuota" degrada honesto (verificado en FICHA-12): ficha completa, mensaje honesto, sin spinner colgado ni error. El sub-caso "red caída / key inválida" lo cubren los unit tests (`fetchDetails` → `null` ⇒ 204) + el timeout de 2,5 s; no se probó en vivo con una key inválida |
| FICHA-14 | Cómo llegar + match | ✅ PASS | Tras el match, el deep link en vivo pasó a `...&destination_place_id=ChIJ25d96J21vJURkGgqgdHC7Cw` (el `place_id` persistido enriquece la ruta, decisión 22). Funciona con el enriquecimiento caído (verificado con tope=0) |
| FICHA-16 | Key no expuesta | ✅ PASS | Grep de la key (39 chars) sobre el build: **0 ocurrencias en `.next/static`** (cliente) — y 0 en `.next/server`, porque se lee de `process.env` en runtime y no se inlinea en ningún chunk. Por arquitectura tampoco puede filtrarse: `lib/google/places.ts` es server-only (guard de runtime) y el cliente importa **solo el tipo** del DTO (`lib/google/types.ts`), nunca el módulo |
| FICHA-04/08 (facturación real) | Consola de billing | ⏳ Fer | Requiere la consola de Google Cloud; no verificable desde acá. El contador `google_api_usage` es el sustituto (arriba) |
| FICHA-10/11 | Foto / atribución con logo | ⏳ F3 | Foto (`skipHttpRedirect`), crédito al autor y logo de Google son de F3. En F2 la atribución es texto "Horarios y calificación: Google" + link a `/legales` |

**Endpoint verificado (red):** `GET /api/lugar/[id]/google` respondió **200** en la apertura
normal y **204** con el tope en 0 (observado en el panel de red de Playwright).

**Pendiente de cierre de F2 (no bloqueante del veredicto de fase):** el smoke de un lugar
real `not_found` (la lógica ya la cubren los unit tests) y el spot-check de FICHA-03 sobre
~10 fichas para medir la tasa de falsos positivos del matching a ciegas (ver esa fila).

**Nota de método:** el bloque de Google es browser-only (fetch en `useEffect`, decisión 16),
así que —como el mapa de BUSQUEDA— vive fuera del alcance del checker read-only de `/qa-spec`.
Esta QA en vivo es la fuente de verdad de esos criterios y **no se re-somete** a `/qa-spec` al
cerrar el spec; el gate técnico (typecheck + tests) sí se reconfirma.

## QA de fase — FICHA F3 (2026-07-20)

**Alcance:** **Fase 3** — foto de Google (`skipHttpRedirect`), crédito al autor, link al
original, logo de Google sobre los datos en vivo, y la prioridad dueño → Google
end-to-end. F3 es la **última** fase ⇒ con su cierre se cierra el spec entero.

**Veredicto de F3:** PASA (alcance F3).

**Verificación técnica:** typecheck ✅ · tests ✅ **217/217** (13 nuevos de F3, casi todos
sobre el camino del gasto de la foto) · **build ✅** (con el dev server parado; `/lugar/[id]` y
`/api/lugar/[id]/google` salen dinámicos `ƒ`, `/robots.txt` estático). **Key con 0 ocurrencias
en `.next/static` y `.next/server`** (se lee de `process.env` en runtime, nunca se inlinea) —
FICHA-16 confirmado sobre el build.

**QA en vivo (Playwright sobre ngrok, lugar real "Hard Rock Cafe" — Puerto Madero):**

| ID | Caso | Resultado | Evidencia / Nota |
|----|------|-----------|------------------|
| FICHA-10 | Prioridad de foto (dueño → Google) | ✅ PASS | **Sin fotos de dueño**: se muestra la de Google y `google_api_usage.photos` sube (0→1). **Insertadas 2 filas en `place_photos`** + recarga: gana la foto de dueño, **desaparece** el overlay "foto: … · Google", y `photos` **NO se movió** (siguió en 1) — `details` sí subió (rating/horarios se siguen pidiendo). **Borradas las filas** + recarga: vuelve la de Google y `photos` **1→2**. Contador server-authoritative: el chequeo de foto de dueño es un `EXISTS` en `getPlaceForEnrichment`, no confía en el cliente |
| FICHA-11 | Atribución (autor + original + logo) | ✅ PASS | Sobre la foto: **"foto: Átila"** (link al perfil del autor, `maps.google.com/maps/contrib/103341714860531924810`) **· "Google"** (link al original vía `googleMapsUri`, `?cid=2757154682678125256`). Junto a rating/horarios: el **logo "G" de Google** (SVG inline, 4 colores) linkeado a `/legales`. La línea de Google en `/legales` ya menciona horarios, calificaciones **y fotos** |
| Costo — una sola foto | Decisión 14 | ✅ PASS | Un lugar con múltiples fotos en la respuesta de Details genera **exactamente 1** request de media (`parseFotoCandidata` toma `photos[0]`): tras la apertura `photos` subió de a **1**, no de a N. `maxWidthPx=1200` observado en la URL de `googleusercontent` (`…w1200`) |
| Costo — un solo fetch | Decisión 16 | ✅ PASS | Panel de red: **una** llamada `GET /api/lugar/[id]/google` → 200 por apertura, y la imagen desde `lh3.googleusercontent.com/place-photos/…`. El shell cliente (foto + header como `children` + datos) hace **un** fetch, no dos Place Details |
| Key no expuesta (foto) | Decisión 15 | ✅ PASS | La foto se sirve con `skipHttpRedirect=true`: el server recibe el `photoUri` efímero y lo pone en el `<img src>`. En el browser **no** hay request a `places.googleapis.com` (solo al endpoint propio y a `googleusercontent`); la key nunca sale. El `photo name` no viaja al cliente (`FotoCandidata` es server-only en `places.ts`) |

**Cobertura por unit test (no en vivo, para no gastar de más):** tope de `photos` agotado ⇒
sin foto pero ficha entera (200); tope en 0 apaga la foto sin tocar Google; media call que
falla (null) ⇒ foto null y la ficha igual se muestra; se cuenta `photos` **antes** del media
call (contar de más, no de menos) — todos en `enrichment.test.ts`. El field mask de Details
sigue **exacto** (`places.test.ts`): `photos` ya estaba, F3 no suma campos.

**Efectos colaterales de la QA (dejados a propósito):** Hard Rock quedó `matched` con
`ChIJQZyCPP41o5URyKLVa5NhQyY` (match correcto y permanente) y los contadores del mes reflejan
el uso real de la QA (`details: 7`, `photos: 2`). Las 2 filas de prueba en `place_photos` se
**borraron**. Único error de consola: `favicon.ico` 404, preexistente y ajeno.

**Nota de método (igual que F1/F2):** foto y datos son browser-only ⇒ fuera del alcance del
checker read-only de `/qa-spec`. Esta QA en vivo es la fuente de verdad y **no se re-somete**
a `/qa-spec` al cerrar; el gate técnico (typecheck + tests + build) sí se reconfirma.

---

## QA de fase — AUTH F2 (2026-07-21)

**Alcance:** **Fase 2** — `place_claims`, botón "¿Sos el dueño?" en la ficha,
`/registrar-negocio` (búsqueda del catálogo completo + alta con pin y zona automática),
`/reclamar/[placeId]`, `/admin` con la cola, aprobar/rechazar/revocar + `publish_override`
+ mails. **F3 y F4 pendientes** ⇒ el spec sigue en `active/`.

**Veredicto de F2:** PASA (alcance F2).

**Verificación técnica:** typecheck ✅ · tests ✅ **244/244** (+6 sobre F1: gate de admin,
validación de payloads, flujo completo contra la base, decisión 14, cupo de claims) ·
**build ✅** (con el dev server parado; `/admin`, `/registrar-negocio`, `/reclamar/[placeId]`,
`/api/claims` y `/api/admin/claims/[id]` salen dinámicos `ƒ`). **Cero ocurrencias de
`ADMIN_EMAIL`, `RESEND_API_KEY`, `BETTER_AUTH_SECRET`, `GOOGLE_PLACES_API_KEY` y
`DATABASE_URL` en `.next/static`.**

**QA en vivo (Playwright sobre ngrok):** cuentas `frodriguez.este@gmail.com` (admin durante
el QA) y `hugo@gmail.com` (no-admin) — ver `docs/qa/DATOS_QA.local.md`.

| ID | Caso | Resultado | Evidencia / Nota |
|----|------|-----------|------------------|
| AUTH-14 | Rutas del flujo exigen sesión | ✅ PASS | `/registrar-negocio` sin sesión → redirect a `/login?callbackUrl=/registrar-negocio`. `/reclamar/[id]` idem. La sesión se verifica inline en cada página y handler (decisión 9) |
| AUTH-15 | Botón "¿Sos el dueño?" en la ficha | ✅ PASS | Aparece al pie, junto a la atribución, con link a `/reclamar/[id]` (verificado en "Kansas Grill & Bar", Las Cañitas) |
| AUTH-03 | Override del umbral | ✅ PASS | Lugar plantado con `confidence 0.3`: ficha **404** con el reclamo pendiente → tras aprobar, **ficha publicada**. `publishedWhere` lo cuenta (test de integración) y la regla de CATALOGO **no se tocó**. Datos de prueba borrados |
| AUTH-02 | Reclamo feliz end-to-end | ✅ PASS | Login → ficha → botón → formulario (valida en español por campo antes de postear) → "Recibimos tu solicitud" → aparece en `/admin` con solicitante, rol, teléfono, cuenta y comentario → **Aprobar** → Pendientes 1→0, Aprobados 0→1 con "Aprobado por" → **el botón desaparece de la ficha** |
| AUTH-04 | Alta nueva con pin | ✅ PASS | `/registrar-negocio` → "¿No está en la lista?" → mapa MapLibre con pin arrastrable y atribución OpenFreeMap/OSM → enviar. En la base: `source='owner'`, `confidence=null`, `publish_override=false` ⇒ **invisible**, claim `new` `pending`, y **zona "Retiro y Microcentro" primaria asignada por turf** desde el pin. Lugar de prueba borrado |
| AUTH-05 | Duplicado evitado | ✅ PASS | Buscar "kansas" lista **10 lugares del catálogo completo** (visibles e invisibles) con zona y dirección, cada uno con "Es mío" → el alta solo se ofrece **después** de haber buscado |
| AUTH-12 | Permisos | ✅ PASS | Con sesión no-admin: `/admin` → **404** (la ruta no existe para quien no es admin) y `PATCH /api/admin/claims/[id]` → **403 FORBIDDEN**. Reclamar un lugar ya reclamado → **409 YA_RECLAMADO**. Alta con pin en Nueva York → **400 INVALID** (bbox de AMBA) |
| AUTH-16 | Cola de `/admin` | ✅ PASS | Gate por `ADMIN_EMAIL`; muestra Pendientes y Aprobados, etiqueta `Reclamo`/`Alta nueva` + `Publicado`/`Invisible`, link a la ficha, y **Revocar** sobre los aprobados (decisión 10) |
| AUTH-17 | Menú de cuenta | ✅ PASS | Con sesión: "Registrá tu negocio" · "Mi cuenta" · "Salir". Es la única puerta al alta de un lugar nuevo (el botón de la ficha solo cubre reclamar lo que ya existe) |

**Cobertura por test de integración (no en vivo):** idempotencia de aprobar (2ª vez ⇒
`yaEstaba=true`, sin segundo mail) · un solo dueño por lugar (2º aprobado ⇒ `OTRO_APROBADO`)
· dos pendientes del mismo lugar conviven · mismo usuario no duplica su pendiente
(`YA_PENDIENTE`) · rechazar un pendiente deja el lugar igual y guarda el motivo · **revocar
un aprobado baja `publish_override`** · rechazar un alta la deja invisible sin borrarla ·
**el re-import no toca las tags de un lugar reclamado** (decisión 14) · rate limit de claims
3/día con cupo propio.

### Hallazgos

**H-1 — `EXISTS` en SQL crudo comparaba una columna contra sí misma (bug encontrado y
corregido durante este QA).** En `buscarCatalogoCompleto` y `getLugarAReclamar`, el flag
`reclamado` se resolvía con un `EXISTS` escrito a mano. Drizzle renderiza `${places.id}`
dentro del subquery **sin calificar la tabla** (`"id"`), y como `place_claims` **también**
tiene una columna `id`, la condición terminaba siendo `pc.place_id = pc.id`: falsa siempre.
Efecto: un lugar ya reclamado se seguía ofreciendo con "Es mío" en `/registrar-negocio`, y el
endpoint lo rechazaba recién al enviar el formulario (409). **No había pérdida de datos ni
agujero de permisos** — el gate real (`tieneDuenoAprobado`, query builder) siempre funcionó,
y es el que usa la ficha. Corregido reemplazando los dos `EXISTS` por un `leftJoin` sobre una
subconsulta del query builder y por el helper de `ownership`, con **3 tests de regresión**.
Detectado solo en vivo: el test de integración cubría el helper, no la query de la pantalla.

**H-2 — Mismo patrón latente en `lib/search/query.ts` (hoy inocuo, no se tocó).** Los
`EXISTS` de `filtrosDeTags` y `filtroDeZonas` usan `${places.id}` igual, pero `place_tags` y
`place_zones` **no** tienen columna `id`, así que el identificador sin calificar resuelve a
`places.id` por descarte y la búsqueda funciona. Es correcto por accidente: si alguna de esas
tablas ganara una columna `id`, la búsqueda empezaría a devolver cero en silencio. Anotado en
`docs/product/BACKLOG.md` — se cambia con test propio, no de prepo dentro de otro spec.

> **Corrección (2026-07-31, pase de deuda):** este hallazgo estaba mal generalizado y **no había
> nada latente**. Drizzle omite la tabla solo cuando la columna se renderiza en la **lista de
> SELECT** (que es donde vivía el H-1 real); en el WHERE la califica. Los `EXISTS` del motor están
> en el WHERE y salen como `"places"."id"`. Medido y documentado en *QA — Pase de deuda técnica
> (2026-07-31)*, H-1.

---

## QA de fase — AUTH F3 (2026-07-21)

**Alcance:** **Fase 3** — `place_owner_content` + `places.owner_plan`, `/mi-negocio` (lista)
y `/mi-negocio/[placeId]` (editor: contacto, tags de las 6 facetas, fotos, campos pagos
bloqueados, teaser), `lib/storage/r2.ts` como único módulo que habla con R2, `PATCH
/api/mi-negocio/[placeId]/content`, `POST`/`DELETE .../photos`, y la ficha consumiendo el
contenido del dueño (COALESCE + huecos pagos). **F4 (horarios propios) pendiente** ⇒ el spec
sigue en `active/`.

**Veredicto de F3:** PASA (alcance F3).

**Verificación técnica:** typecheck ✅ · tests ✅ **301/301** (+57 sobre F2: COALESCE y
gating puros, schemas y normalización del panel, claves/URLs de R2, y el flujo completo
contra la base) · **build ✅** (con el dev server parado; las 4 rutas nuevas salen dinámicas
`ƒ`).

**Escaneo de secretos en `.next/static` (41 archivos):** se buscaron los **valores reales**
de `.env`, no solo los nombres — **0 ocurrencias** de `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `ADMIN_EMAIL`, `RESEND_API_KEY`, `BETTER_AUTH_SECRET`,
`GOOGLE_PLACES_API_KEY` y `DATABASE_URL`. El **nombre** `BETTER_AUTH_SECRET` sí aparece una
vez, en `chunks/0f5ga4v0.hwf-.js`: es el accessor de env de la propia better-auth
(`Object.freeze({get BETTER_AUTH_SECRET(){return a("BETTER_AUTH_SECRET")}…})`), que en el
browser resuelve a `undefined` porque Next solo inlinea `NEXT_PUBLIC_*`. No es una fuga —
pero deja la lección de que **buscar nombres no alcanza: hay que buscar valores**.

**QA en vivo (Playwright sobre ngrok):** cuentas `frodriguez.este@gmail.com` (dueño aprobado
de "Kansas Grill & Bar") y `hugo@gmail.com` (no-dueño) — ver `docs/qa/DATOS_QA.local.md`.
Fotos reales subidas a R2 y borradas al final.

| ID | Caso | Resultado | Evidencia / Nota |
|----|------|-----------|------------------|
| AUTH-07 | Cap de fotos free | ✅ PASS | 3 fotos PNG reales subidas a R2 (`pub-….r2.dev/lugares/<placeId>/<uuid>.png`, 400×300, cargan en la ficha). Con 3, el botón queda deshabilitado ("Llegaste al máximo de 3") y **el 4º POST forzado por API responde 409 `CAP_FOTOS`**. El contador de fotos de Google **no se movió**: `google_api_usage.photos` = 15 antes y después de 2 aperturas de ficha (`details` sí subió 21→23) — la foto de dueño evita el SKU caro (decisión 3, ya implementado en FICHA F3) |
| AUTH-08 | Gating por plan | ✅ PASS | Con `free`: los 3 campos pagos se muestran **deshabilitados** con el aviso "Escribinos para activar el plan pago", y el `PATCH` con `description` cargada responde **403 `CAMPO_PAGO`**. `UPDATE owner_plan='paid'` → editor desbloqueado y cap de fotos 3→15 → cargados descripción, carta y novedad → **los tres aparecen en la ficha en sus huecos** (decisión 19). Volver a `free` → **los tres desaparecen de la ficha y siguen en `place_owner_content`** (verificado en la base) |
| AUTH-12 | Permisos | ✅ PASS | Con sesión de `hugo@gmail.com` (sin claims): `/mi-negocio` muestra el estado vacío que manda al alta; `/mi-negocio/<id ajeno>` → **404**; `PATCH .../content` y `DELETE .../photos` → **403 `NO_AUTORIZADO`**. El gate es `esDuenoDe`, el mismo para la página y los dos endpoints |
| AUTH-10 | Teaser | ✅ PASS | `/mi-negocio` y el editor muestran **"5 visitas este mes"** para Kansas, que es el `SUM(detail_views)` real del mes corriente acumulado por el QA de F2. Solo el número — sin desglose ni comparación (eso es spec 7) |
| AUTH-18 | Panel: lista y editor | ✅ PASS | La lista muestra nombre, zona · dirección, chip Publicado/Sin publicado, visitas del mes y `N/cap` fotos. El editor trae el contacto de Overture como hint ("Hoy se muestra: +541147764100"), la taxonomía **completa** de las 6 facetas con los tags del lugar ya tildados (Restaurante, Americana), y Cocina con hijos anidados bajo su padre |
| AUTH-19 | La ficha consume lo del dueño | ✅ PASS | Cargados teléfono, web e Instagram propios + 3 tags nuevos → la ficha muestra **el teléfono del dueño** (`11 4776 4100`, no el `+541147764100` de Overture), **su web** (https, no el http de Overture), **su Instagram** (reemplaza al de Overture) y los tags nuevos en el encabezado y en "Qué vas a encontrar". Vaciar un campo devuelve el de Overture (test de integración) |
| AUTH-20 | Tags del dueño | ✅ PASS | Los 5 tags del lugar quedan con `source='owner'` (incluido el `americana` que venía de import): para SU lugar el dueño es mejor fuente que Overture (decisión 14), y el re-import ya no los toca. Un slug inventado se descarta sin romper el guardado |
| AUTH-21 | Validación del boundary | ✅ PASS | Upload de un PDF con `type: application/pdf` → **415 `TIPO_INVALIDO`**. `website: 'javascript:alert(1)'` → **400 `INVALID`** (los links de la ficha se usan como `href`). Tamaño verificado sobre los bytes leídos, no sobre el `size` declarado |
| AUTH-22 | Borrar una foto | ✅ PASS | Borrar la 3ª: desaparece de la grilla (3→2, contador "2 de 3") y el objeto **ya no está en R2** (`curl` a su URL → **HTTP 404**). La fila se borra aunque R2 falle; el objeto huérfano es el lado barato del error |
| AUTH-17 | Menú de cuenta | ✅ PASS | Suma "Mi negocio" antes de "Registrá tu negocio". Se muestra a todo el que tenga sesión, no solo a dueños: preguntar por claims aprobados sería una query en el header de cada página, y la pantalla vacía ya resuelve el caso |

**Cobertura por test (no en vivo):** COALESCE dueño → base en sus 6 casos (dato propio gana ·
`null` cae a la base · sin dato en ningún lado ⇒ `null` · redes reemplazan, no mezclan ·
redes vacías caen a la base) · gating por plan en los 3 campos, en los dos sentidos ·
`CAP_FOTOS` con las 3 filas plantadas (sin tocar R2) · borrar la foto de otro lugar sabiendo
su id ⇒ `FOTO_NOT_FOUND` · el teaser suma el mes corriente y **deja afuera el día anterior al
1°** · la taxonomía del panel lista Precio, que la búsqueda esconde por conteo cero · el
`UPDATE` de las columnas base (lo que hace el re-import) no toca `place_owner_content` ·
cascade de `places` → `place_owner_content` · cupo de fotos 30/h propio, que no consumen ni
la búsqueda ni los claims.

### Hallazgos

**H-1 — Dos partes del edge case "eliminar cuenta de un dueño" seguían sin implementar
(encontrado leyendo el spec durante la implementación, cerrado en F3).** Las notas de F2
decían explícitamente que "el resto del edge case (contenido de dueño, fotos de R2) es F3", y
AUTH-13 pide además que revocar un reclamo deje el "contenido de dueño oculto". Faltaban las
dos:

1. **El contenido se aplicaba sin mirar si había dueño.** `getPlaceDetail` leía
   `place_owner_content` por `place_id` y listo, así que el teléfono de un ex-dueño quedaba
   publicado para siempre después de revocarle el reclamo o de que borrara su cuenta.
   Cerrado condicionando el COALESCE a `reclamado` (el flag que la query ya calculaba): sin
   claim aprobado la ficha vuelve a Overture. **La fila no se borra** — se deja de aplicar,
   mismo criterio que el contenido pago cuando se cae el plan, así que volver a reclamar
   recupera lo cargado. Con test.
2. **Las fotos no se limpiaban.** `place_photos` cuelga del lugar, no del usuario, así que el
   cascade del delete de cuenta no las tocaba: quedaban filas apuntando a objetos vivos en
   R2. Cerrado con `limpiarFotosDeUsuario`, llamada desde el hook `beforeDelete` **antes** del
   update de `publish_override` (después, el cascade ya se llevó los claims y no habría por
   dónde encontrar los lugares). Best effort de punta a punta: nada de esto puede impedir que
   alguien borre su cuenta.

**H-2 — Las fotos NO se ocultan al revocar (decisión tomada, no bug).** AUTH-13 dice
"contenido de dueño oculto"; el contenido de `place_owner_content` ahora se oculta, pero
`place_photos` sigue mostrándose. Gatear las fotos obligaría a tocar la prioridad dueño →
Google de la ficha (`fotoPrincipal` + el `EXISTS` server-side de `getPlaceForEnrichment`),
que este spec tiene explícitamente fuera de alcance. Queda como decisión consciente: revocar
devuelve los **datos** a Overture pero deja las fotos cargadas. Anotado en
`docs/product/BACKLOG.md` — se cambia con test propio, no de prepo dentro de otro spec.

---

## QA de fase — AUTH F4 (2026-07-22)

**Alcance:** **Fase 4 (última del spec)** — horarios propios del dueño: módulo puro
`lib/negocio/horarios.ts` (modelo semanal, `estaAbierto` con cruce de medianoche en TZ
`America/Argentina/Buenos_Aires`, `lineasSemana`, solapamientos, cap de rangos), editor
semanal en `/mi-negocio/[placeId]` (sección nueva del mismo formulario), `openingHours` en
`contenidoSchema` + persistencia en `guardarContenido` (free, **fuera** del gate de plan), la
ficha priorizando horarios del dueño sobre los de Google (`getPlaceDetail.horariosDueno` →
`FichaGoogle`), y la reconciliación de los DoD abiertos de F1/F2. **Sin migración**: usa la
columna `opening_hours` que F3 creó con la tabla. **Field mask de Google intacto** (el ahorro
de la decisión 20 es de UI, no de SKU; el rating sigue viniendo de la misma request).

**Veredicto de F4:** PASA (alcance F4) → **cierra el spec AUTH completo**.

**Verificación técnica:** typecheck ✅ · tests ✅ **331/331** (+30 sobre F3: tabla de horas de
`estaAbierto` incluyendo trasnoche y salto de semana domingo→lunes, solapamientos, forma del
schema de horarios, y el flag sobre `getPlaceDetail` —dueño → Google, oculto al revocar,
semana vacía ⇒ null). · **build ✅** (con el dev server parado; la ficha y el editor siguen
dinámicos). · **Escaneo de secretos en `.next/static` (34 archivos)**: se buscaron los
**valores reales** de `.env` (`BETTER_AUTH_SECRET`, `RESEND_API_KEY`, `ADMIN_EMAIL`,
`GOOGLE_PLACES_API_KEY`, las 3 de R2, `DATABASE_URL`) — **0 fugas**. F4 no agrega ninguna env
ni secreto nuevo (los horarios son datos planos); el módulo `horarios.ts` es puro y el cliente
(`ficha-google`, `editor-client`) solo importa de él y tipos, así que no arrastró server-only.

**QA en vivo (Playwright sobre ngrok):** cuenta `frodriguez.este@gmail.com` (dueño aprobado de
"Kansas Grill & Bar") — ver `docs/qa/DATOS_QA.local.md`. Hora de la corrida: **miércoles
19:52 AR**.

| ID | Caso | Resultado | Evidencia / Nota |
|----|------|-----------|------------------|
| AUTH-11 | Horarios propios en la ficha | ✅ PASS | Cargados en el editor: **Lunes 09:00–18:00, Miércoles 18:00–02:00, Viernes 20:00–02:00** (dos cruzan medianoche). La ficha muestra **esos** horarios en el acordeón "Ver horarios de la semana" (`Miércoles: 18:00–02:00`, `Viernes: 20:00–02:00`, resto "Cerrado"), **no** los de Google. La atribución pasó de "Horarios y calificación" a **"Calificación"**: Google ya solo aporta el rating (4,4 · 24886), que sigue viniendo de la misma request Enterprise |
| AUTH-11a | Abierto/cerrado — rango que cruza medianoche | ✅ PASS | A las **19:52 del miércoles**, con el rango **18:00–02:00**, la ficha muestra **"Abierto ahora"** (punto verde): es el tramo de la noche del propio día. El cálculo corre client-side tras montar (evita hydration mismatch) en TZ AR |
| AUTH-11b | Cerrado ahora (control negativo) | ✅ PASS | Edición temporal del miércoles a **09:00–12:00** (franja ya pasada a las 19:52) → la ficha muestra **"Cerrado ahora"**. Restaurado a 18:00–02:00 al terminar. Confirma que el estado no está fijo en "abierto" |
| AUTH-11c | Round-trip del editor | ✅ PASS | Al recargar `/mi-negocio/[placeId]` el editor **prellena** los horarios guardados, incluidos los rangos que cruzan medianoche (Miércoles 18:00–02:00 vuelve tal cual). Guardar una semana entera vacía deja `opening_hours` en **null** ⇒ la ficha vuelve a los de Google (test de integración) |
| AUTH-01 | Registro + verificación (DoD F1, reconciliado) | ✅ PASS | `/registro` renderiza el form (nombre, email, contraseña, confirmación); `requireEmailVerification: true` en `lib/auth/index.ts:31` ⇒ el registro **no** abre sesión y **sin verificar no hay login** (ya ejercido de punta a punta en el login de AUTH-02, F2). No re-verificado a mano |
| AUTH-OAuth | Google OAuth condicional (DoD F1) | ⏸️ DIFERIDO | La config de better-auth soporta OAuth condicional por env (`lib/auth/index.ts:98`), pero la **UI del botón no está construida** — se difirió en F1 a pedido (2026-07-20, ver BACKLOG). Que "sin vars el botón no aparece" hoy es trivial: el botón no existe. Único DoD del spec sin cerrar; deferral aceptado, no regresión. **No se declara PASS** |

**DoD de F1/F2 reconciliados desde el QA ya registrado** (no re-verificados a mano, regla del
prompt de cierre): sesión inline con `getSession` + `/admin` rechaza no-admin → **AUTH-14 +
AUTH-12** (F2); reclamo end-to-end con `publish_override` y mail → **AUTH-02 + AUTH-03** (F2);
"Registrá tu negocio" busca el catálogo completo antes del alta → **AUTH-04 + AUTH-05** (F2).

**Cobertura por test (no en vivo):** `estaAbierto` en tabla — lunes 23:00 (abierto), martes
01:30 (cola de la madrugada del lunes, abierto), martes 03:00 (cerrado), domingo 23:00 y lunes
01:30 (salto de semana, el día anterior del lunes es domingo), rango normal 09:00–18:00 en sus
bordes, día sin rangos siempre cerrado · `haySolapamiento` (crucen o no la medianoche) ·
`normalizarSemana` completa los 7 días y descarta basura · el schema rechaza hora mal formada,
cierre igual a apertura, rangos que se pisan y más franjas que el tope · `getPlaceDetail`
expone `horariosDueno` **solo con dueño aprobado**, lo oculta al revocar sin borrar la fila, y
guarda null cuando la semana queda vacía.

### Hallazgos

Sin hallazgos. El único ajuste durante la implementación fue de razonamiento en un test propio
de `haySolapamiento` (un rango vespertino que cruza la medianoche **no** se pisa, como
intervalos literales, con una franja de la mañana del mismo día: su cola cae al día
siguiente) — corregido el test, no el código.

---

## QA /qa-spec — AUTH (spec completo) (2026-07-22)

**Veredicto:** APROBADO (alcance implementado) — con **un DoD diferido, no fallado**: la UI del
botón de Google OAuth (AUTH-QA-09), descope aceptado de F1 anotado en BACKLOG. No hay FAIL de
criterio normativo ni gate técnico rojo; el deferral es un ítem de trabajo futuro, no un bug.

**Verificación técnica:** typecheck ✅ · tests ✅ 331/331 · build ✅ (dev server parado).

**Método:** checker independiente (Explore/haiku, read-only, maker≠checker) contra el DoD de
`docs/specs/active/AUTH.md`. Los criterios de comportamiento en vivo (AUTH-11 abierto/cerrado,
prioridad dueño → Google) se verificaron con Playwright sobre ngrok esta misma sesión (ver
§ QA de fase — AUTH F4). Los DoD de F1/F2 se reconciliaron contra su QA ya registrado.

| ID | Criterio | Resultado | Evidencia / Gap |
|----|----------|-----------|-----------------|
| AUTH-QA-01 | La ficha prioriza horarios del dueño sobre Google; el rating de Google se sigue mostrando | ✅ PASS | `lib/lugar/query.ts:55-60,157-158,174` (`horariosDueno`); `components/lugar/ficha-google.tsx:154-162` (branch dueño), `:201-232` (`DatosConHorariosDueno` muestra horarios propios + rating de Google); `app/lugar/[id]/page.tsx:111`. Live: § AUTH F4 AUTH-11 |
| AUTH-QA-02 | Abierto/cerrado en TZ AR correcto con rango que cruza medianoche (día anterior) | ✅ PASS | `lib/negocio/horarios.ts` `estaAbierto` (mira hoy y `(dia+6)%7`), `partesEnAR` (Intl `America/Argentina/Buenos_Aires`); tests de tabla `horarios.test.ts` (lunes 23:00, martes 01:30, martes 03:00, salto domingo→lunes). Live: § AUTH F4 AUTH-11a/11b |
| AUTH-QA-03 | Horarios son free (guardan sin gate de plan) | ✅ PASS | `lib/negocio/acciones.ts:94-96` (persistencia fuera del bloque de `CAMPOS_PAGOS`); `contenido.ts:19` (`openingHours` no está en `CAMPOS_PAGOS`) |
| AUTH-QA-04 | Validación server-side de rangos (formato, solapamientos, tope) | ✅ PASS | `validacion.ts` `horariosSchema`/`diaSchema` (`.max(MAX_RANGOS_POR_DIA)`, `!haySolapamiento`, `esHoraValida`); re-validado en `app/api/mi-negocio/[placeId]/content/route.ts:47` |
| AUTH-QA-05 | Horarios se aplican solo con reclamo aprobado; revocar oculta sin borrar | ✅ PASS | `lib/lugar/query.ts:157-158` (`reclamado ? … : null`); test de integración `panel.integration.test.ts` (revocar ⇒ `horariosDueno` null, fila intacta) |
| AUTH-QA-06 | Sin migración nueva (usa columna preexistente de F3) | ✅ PASS | `drizzle/0006_*.sql:7` (`opening_hours` en el CREATE TABLE); no existe `0007`; `schema.ts:534` |
| AUTH-QA-07 | Field mask de Google intacto (regresión de costos) | ✅ PASS | `lib/google/places.ts:46,55-56` masks exactos; `places.test.ts` asertan el valor y rechazan Atmosphere (`reviews`/`editorialSummary`) |
| AUTH-QA-08 | Registro + verificación obligatoria (`requireEmailVerification: true`) | ✅ PASS | `lib/auth/index.ts:31`; live: `/registro` renderiza y login exige verificación (§ AUTH F4 AUTH-01, y AUTH-02 F2) |
| AUTH-QA-09 | Google OAuth condicional por env | ⏸️ DIFERIDO | La config lo soporta (`lib/auth/index.ts:98`), pero la **UI del botón no está construida** (diferido en F1 a pedido, ver BACKLOG). No se declara PASS: el único DoD del spec que queda abierto, deferral aceptado |
| AUTH-QA-10 | Sesión inline con `getSession` en handlers nuevos; `/admin` rechaza no-admin | ✅ PASS | Reconciliado de F2: § AUTH F2 AUTH-14 + AUTH-12 |
| AUTH-QA-11 | Reclamo end-to-end + `publish_override` + mail | ✅ PASS | Reconciliado de F2: § AUTH F2 AUTH-02 + AUTH-03 |
| AUTH-QA-12 | "Registrá tu negocio" busca catálogo completo antes del alta | ✅ PASS | Reconciliado de F2: § AUTH F2 AUTH-04 + AUTH-05 |

---

## QA /qa-spec — VOTACION (spec completo, 3 fases) (2026-07-22)

**Veredicto:** APROBADO — todos los criterios del DoD PASS (código + verificación en vivo) y gate técnico verde.

**Verificación técnica:** typecheck ✅ · tests ✅ 381/381 (50 nuevos de `lib/votaciones`) · build ✅ (dev server parado).

**Método:** tres checkers independientes (Explore/haiku, read-only, maker≠checker), uno por fase,
contra el DoD y los 15 IDs propuestos en `docs/specs/done/VOTACION.md`. Los criterios de
**rendering / cookie** (VOT-05, VOT-08, VOT-09, VOT-13) se verificaron en vivo con Playwright sobre
`https://adondesalimos.ngrok.app` esta misma sesión (votación sembrada con 3 lugares publicados
reales); los de lógica de dominio, con tests de integración contra la base + lectura de código.

| ID | Criterio | Resultado | Evidencia / Gap |
|----|----------|-----------|-----------------|
| VOT-01 | Crear votación feliz: 2-5 lugares publicados → link con token no adivinable que abre la página pública | ✅ PASS | `app/api/votaciones/route.ts` (POST) · `lib/votaciones/token.ts` (16 bytes `crypto` base64url, separado del id) · `acciones.ts` valida `publishedWhere`. Live: la página abre con las 3 opciones (PlaceCard) |
| VOT-02 | Límites de shortlist: 1 o 6 lugares rechazado server-side | ✅ PASS | `lib/votaciones/validacion.ts` `crearVotacionSchema` dedup (`new Set`) + refine min 2/max 5 · test `validacion.test.ts` |
| VOT-03 | Gate "1 activa" (free) server-side, con lock de la fila del usuario (anti-carrera) | ✅ PASS | `acciones.ts` `crearVotacion`: `users … .for('update')`, cuenta `status='open' AND expires_at > now()` → `LIMITE_ACTIVA` 409 · test `votaciones.integration.test.ts` |
| VOT-04 | Premium ilimitado (`users.plan='premium'`) crea varias activas | ✅ PASS | `schema.ts` `userPlanEnum` + `users.plan` · `planes.ts` `esPremium` · gate saltea premium · test integración |
| VOT-05 | Voto anónimo sin cuenta; el conteo sube en vivo | ✅ PASS | POST voto sin sesión + upsert (`acciones.ts` `votar`). **Live**: voté sin sesión, 0→1 voto, botón pasó a "Tu voto", total actualizó |
| VOT-06 | Revotar cambia la elección sin sumar (restricción `(poll_id, voter_token)`) | ✅ PASS | `onConflictDoUpdate` sobre índice único · test `voto.integration.test.ts` (A→B: total sigue 1) |
| VOT-07 | La IP no es la identidad: dos cookies distintas = 2 votos | ✅ PASS | El voto se ancla al `voterToken` (cookie), no a la IP; la IP solo rate-limit · test integración (`device-A`/`device-B` = 2) |
| VOT-08 | Cookie `voter_id` httpOnly, SameSite=Lax, larga duración | ✅ PASS | `voto/route.ts` `cookies().set(…, { httpOnly, sameSite:'lax', maxAge })`. **Live**: `document.cookie` vacío tras votar (confirma httpOnly) |
| VOT-09 | Expiración lazy sin cron; solo-lectura, nunca 404 salvo token inexistente | ✅ PASS | `query.ts` `getVotacionPublica` persiste cierre best-effort; `page.tsx` `notFound()` solo si null. **Live**: expiré `expires_at`, recargué → banner "ya cerró", sin botones, `status` persistió `closed` |
| VOT-10 | Cierre: solo el creador, elige ganador (≠ más votado posible), queda `winner_place_id`; idempotente | ✅ PASS | `acciones.ts` `cerrarVotacion` valida `creator_id` + ganador∈opciones, idempotente (no re-elige ni pisa `closed_at`) · test `cierre.integration.test.ts` |
| VOT-11 | Solo el creador cierra/cancela: no-creador → 403 | ✅ PASS | PATCH con sesión inline; `cargarPropia` verifica `creator_id` → `NO_AUTORIZADO` (mapa 403) · test integración |
| VOT-12 | Cancelar libera el cupo "1 activa" al instante; link cancelado en solo-lectura, sin borrar fila | ✅ PASS | `cancelarVotacion` → `status='cancelled'` (UPDATE, no DELETE); el gate solo cuenta `open` · test integración (crea otra tras cancelar) |
| VOT-13 | `/votacion/[token]` sin llamadas a Google/IA; OG de datos propios | ✅ PASS | Sin imports de `lib/google`; `generateMetadata` arma OG con título+nombres. **Live**: panel de red = solo `/api/votaciones/*`, cero Google |
| VOT-14 | Rate limit: crear 3/día/IP · voto 20/min/IP, cupos propios (no comparten bucket) | ✅ PASS | `rate-limit.ts` `checkVotacionesRateLimit` (prefijo `votaciones`, `CLAIMS_MAX`) y `checkVotoRateLimit` (prefijo `voto`, 20/min) |
| VOT-15 | Premium modelado y gateado pero apagado: free no ve botón IA ni historial; premium ve el botón pero no llama a IA | ✅ PASS | Botón IA bajo `{esPremium && …}` con `onClick` no-op (`nueva-client.tsx`); historial gateado en la query `misVotaciones(userId, incluirHistorial)` server-side |
| VOT-NOEXPO | Ningún endpoint expone `voter_token`; resultados = conteo agregado por opción | ✅ PASS | `query.ts` conteo por `GROUP BY option_id`; tipos `OpcionPublica`/`ResultadosEnVivo` sin `voterToken` · test "no expone el voter_token" |

## QA /qa-spec — HOME_IDENTIDAD (2026-07-23)
**Veredicto:** APROBADO
**Verificación técnica:** typecheck ✅ · tests 381/381 ✅ · build ✅
**Método:** 3 checkers independientes en paralelo (Explore/haiku, maker≠checker) sobre los criterios code-verificables + **QA en vivo con Playwright/MCP** sobre `https://adondesalimos.ngrok.app` — la evidencia visual (render, tokens computados, favicon, sin hydration) la aporta la QA en vivo porque el checker read-only no ve el render (lección BUSQUEDA).

| ID | Criterio | Resultado | Evidencia / Gap |
|----|----------|-----------|-----------------|
| HOME_IDENTIDAD-01 | Home vacío: wordmark + hero + fondo azulado + chips | ✅ PASS | Live: wordmark con pin gradiente; hero rioplatense; fondo `#0D0D1F`; chips de Ocasión visibles (screenshot) |
| HOME_IDENTIDAD-02 | Home con búsqueda: el hero colapsa, el header queda | ✅ PASS | Live `/?z=palermo-soho`: sin hero, wordmark en header, lista/mapa en paleta nueva, chip activo con borde naranja |
| HOME_IDENTIDAD-03 | `/votacion/[token]` compartido en paleta nueva | ✅ PASS | Live: fondo azulado, barras y borde ganador en naranja, sin restos de ámbar |
| HOME_IDENTIDAD-04 | Headline rotativo sin hydration mismatch | ✅ PASS | Live: 3 cargas → "¿Qué hacemos?"→"¿Qué sale?"; consola 0 warnings. Código: SSR índice 0 + `useEffect` random (`rotating-headline.tsx`) |
| HOME_IDENTIDAD-05 | Pins del mapa en rosa `#FF2D75` | ✅ PASS | Checker: `map-view.tsx:113,143` + `pin-picker.tsx:52`; sin `#e11d48`. Live: clusters rosa, número oscuro |
| HOME_IDENTIDAD-06 | Contraste WCAG (texto oscuro sobre naranja/rosa) | ✅ PASS | `--primary-foreground #0D0D1F`; número de cluster `#0D0D1F` sobre rosa (5.38:1); botones texto oscuro sobre naranja |
| HOME_IDENTIDAD-07 | Paleta en tokens: primary `#FF8A00`, bg `#0D0D1F`, categorías, sin ámbar en `:root` | ✅ PASS | Checker: `globals.css:42,48,54,59` + categorías `25-28`; sin `#F59E0B`/`#0F0F0F`. Live: `--primary` = `#ff8a00`, body `rgb(13,13,31)` |
| HOME_IDENTIDAD-08 | Tres focos: email (CTA plano) + pins + logo de Google intacto | ✅ PASS | Checker: `email/index.ts:25,28,46` (CTA plano); logo de Google `#4285F4/#34A853/#FBBC05/#EA4335` intactos (`ficha-google.tsx:356-368`) |
| HOME_IDENTIDAD-09 | Estrella del rating → amarillo de marca (leftover ámbar) | ✅ PASS | Checker: `ficha-google.tsx:250` `text-amarillo`, sin `text-amber-500`. Live: estrella computa `rgb(255,212,0)` |
| HOME_IDENTIDAD-10 | Wordmark reemplaza el `h1` (pin SVG + texto) | ✅ PASS | Checker: `wordmark.tsx` (`linearGradient` `ads-pin`, "salimos?" en `text-primary`); `page.tsx` usa `<Wordmark/>`, sin `h1` de texto |
| HOME_IDENTIDAD-11 | Favicon / app-icon (cierra el 404) | ✅ PASS | `app/icon.png` + `app/favicon.ico`. Live: `/icon.png` y `/favicon.ico` → 200; `<link rel=icon sizes=512x512>` |

---

## QA de fase — MONETIZACION F1 (Instrumentación + precios) (2026-07-24)

**Veredicto:** APROBADO
**Verificación técnica:** typecheck ✅ · tests 393/393 ✅ · build ✅ (server parado)
**Método:** migración aplicada contra el Postgres local (Docker, 5439) + `db:seed` idempotente; instrumentación y precios verificados con tests de integración contra la base real (maker=implementador — la QA en vivo con MCP la corre el usuario sobre `https://adondesalimos.ngrok.app`). F1 no toca MP: el cobro es F2.

| ID | Criterio (spec) | Resultado | Evidencia / Gap |
|----|-----------------|-----------|-----------------|
| MONE-13 | Tocar teléfono / cómo llegar / redes / website / carta en la ficha → `place_taps_daily` suma por tipo; sin user_id/IP/cookie | ✅ PASS | `registrarTap` upsert `+1` con pk `(place_id, date, kind)` (`lib/search/impressions.ts`); disparado por `<TapLink>` (beacon `sendBeacon`, best-effort) en los 7 anchors de `app/lugar/[id]/page.tsx` (teléfono ×2, website ×2, cómo llegar, redes, carta) → `POST /api/lugar/[id]/tap` (rate limit 60/h/IP). Tests: suma por tipo sin tocar otros · acumula · id inexistente no rompe · **columnas = `count,date,kind,place_id`** (sin dato por usuario) |
| MONE-14 | Buscar con tags activos → los lugares servidos suman en cada tag; el texto libre no se registra | ✅ PASS | `registrarTagsDeBusqueda(ids, params.tags)` en el mismo `after()` del batch de impresiones, en `app/api/search/route.ts` **y** `app/page.tsx`. Resuelve slugs→ids de tags activos (incluye los expandidos por chips, que ya viven en `params.tags`); pk `(place_id, date, tag_id)`. Tests: suma por tag · lugar repetido cuenta 1 · sin tags no registra (texto libre/zona no cuentan) · slug inexistente se ignora · **columnas = `count,date,place_id,tag_id`** (sin dato por usuario) |
| MONE-16 | Cambiar el precio en `/admin` → rige sin deploy; queda en el historial con quién y cuándo; las suscripciones existentes conservan su `amount_ars` | ✅ PASS | `editarPrecio` (allowlist de claves billing + entero>0) en transacción: upsert `app_settings` + INSERT `app_settings_history` (`lib/billing/settings.ts`); `PATCH /api/admin/settings` (gate `ADMIN_EMAIL`); UI editable + historial visible en `/admin` (`precios-client.tsx`). Los getters `getPrecioB2b/cArs` se leen en runtime (rige el checkout siguiente sin deploy). `amount_ars` congelado por diseño: F1 no toca `subscriptions`. Tests: edita→getter nuevo + fila de historial · rechaza clave fuera de allowlist sin escribir · rechaza monto no entero/≤0 |
| MONE-F1-MIG | Migración aditiva verde con todas las tablas del § Modelo | ✅ PASS | `drizzle/0008_short_talisman.sql` aplicada: `subscriptions` (índices únicos parciales B2C-por-usuario / B2B-por-lugar), `subscription_payments` (`mp_authorized_payment_id` unique), `place_taps_daily`, `place_tag_impressions_daily`, `featured_impressions` en `place_impressions_daily`, `app_settings_history`. `subscriptions`/`subscription_payments` nacen sin uso (se llenan en F2, criterio AUTH F3) |
| MONE-F1-SEED | Seed idempotente de precios que no pisa valores editados a mano | ✅ PASS | `scripts/seed.ts`: `onConflictDoNothing` sobre `billing.precio_b2b_ars=15000` / `billing.precio_b2c_ars=7000`. Re-run no pisa un precio ya editado (mismo mecanismo que el umbral de confidence) |
| MONE-F1-ENV | `.env.example` documenta las 3 env de MP con nombre y propósito | ✅ PASS | `MP_ACCESS_TOKEN` · `MP_WEBHOOK_SECRET` (server-only) · `NEXT_PUBLIC_MP_PUBLIC_KEY` (pública por diseño). F1 no las lee — el cobro es F2 |

**Pendiente de QA en vivo (usuario):** MONE-13/14 con MCP Playwright sobre la ficha y la búsqueda reales (el beacon y el `after()` no se ven en el checker read-only); MONE-16 tocando el precio en `/admin` y viendo el brick de F2 (cuando exista). No bloquean el cierre de F1: la instrumentación y el write están cubiertos por tests de integración contra la base real.

---

## QA de fase — MONETIZACION F2 (Cobro con MercadoPago) (2026-07-24)

**Veredicto:** APROBADO
**Verificación técnica:** typecheck ✅ · tests 418/418 ✅ · build ✅ (server parado)
**Método:** cobro end-to-end en el **sandbox de MP** sobre `https://adondesalimos.ngrok.app` con Playwright/MCP (Claude maneja el navegador hasta la pantalla de pago; el pago lo pone el usuario con la tarjeta de prueba `APRO`, decisión 31). Los caminos que no se pueden disparar con un pago feliz (renovación fallida, replay del webhook, firma, downgrade lazy) se cubren con **tests de integración/unit contra la base real** — el `include` de vitest no alcanza `app/`, así que la lógica vive en `lib/billing/*` (patrón OBS-002 de StressPlan). Cuentas de prueba: `frodriguez.este@gmail.com` (admin + dueño de "Kansas Grill & Bar").

| ID | Criterio (spec) | Resultado | Evidencia / Gap |
|----|-----------------|-----------|-----------------|
| MONE-01 | Checkout B2C feliz → premium al toque, sin salir del sitio | ✅ PASS | Live: comprador test paga el Brick ($7.000 de DB, sin plan pre-creado dec.10) desde `/cuenta`. DB: `users.plan='premium'`, fila `subscriptions` `place_id=null`, `status=active`, `amount_ars=7000` **congelado**, período +1 mes, `mp_payer_email` = comprador de prueba. `subscription_payments` vacío (el guard se inserta en renovaciones, no en el alta) |
| MONE-02 | Checkout B2B feliz → campos pagos/15 fotos editables en ese lugar | ✅ PASS | Live: paga la suscripción de Kansas ($15.000 de DB). DB: `places.owner_plan='paid'` en Kansas, sub con `place_id`=Kansas, `amount_ars=15000` congelado. El tab B2B vive en `/mi-negocio/[placeId]` |
| MONE-03 | Por lugar, no por cuenta | ✅ PASS | Live+DB: al pagar Kansas, `count(*) where owner_plan='paid' and id<>kansas` = **0** — el flag sube solo en el lugar pagado (scoping por `place_id` en `activarFlagDelPlan`) |
| MONE-04 | Pago rechazado en alta → error claro en español, no se crea suscripción | ✅ PASS | Live: tarjeta forzada a rechazo (titular `OTHE`) → `createPreapproval` tira error de MP (`CC_VAL_433`), route responde **402** con el mensaje mapeado, el Brick lo muestra. DB: `subscriptions` vivas de Kansas = `[]`, `owner_plan=free`. **Hallazgo (corregido, ver abajo)**: el mensaje mapeado filtraba lenguaje de sandbox |
| MONE-05 | Renovación fallida → `past_due`, acceso intacto; luego `cancelled` → free + contenido oculto | ✅ PASS | Test integración (`renovacion.integration.test.ts` vs base real): `subscription_authorized_payment` rejected → `status=past_due` y `users.plan` sigue `premium`; el downgrade real llega con paused/cancelled del preapproval |
| MONE-06 | Idempotencia webhook: replay del mismo `authorized_payment_id` no duplica ni extiende dos veces | ✅ PASS | Test integración: primer cobro → `renewed` (1 fila en `subscription_payments`, período extendido); replay del mismo id → `duplicate`, sigue 1 fila, período sin re-extender (guard UNIQUE solo-al-aprobar + `FOR UPDATE`) |
| MONE-07 | Firma inválida/ausente → 401, DB intacta | ✅ PASS | Test unit (`mercadopago.test.ts`): `validateWebhookSignature` acepta firma válida (manifest oficial, `data.id` en minúsculas), rechaza corrupta/ausente/sin secreto. El route responde 401 antes de tocar la DB o consumir cupo (sin rate limit, decisión 29) |
| MONE-08 | Cancelación diferida: acceso hasta fin de período; tras vencer+gracia, free sin webhook (lazy) | ✅ PASS | Live: cancelar en `/cuenta` → `cancel_at_period_end=true`, `canceled_at` sellado, `current_period_end` intacto, `plan` sigue `premium` (el `cancelPreapproval` real de MP corrió). Test integración (adelantando fechas): cancelación diferida vencida → free; período vencido+gracia+MP `cancelled` → free; dentro de la gracia no reconcilia |
| MONE-17 | Precio cambió mid-checkout → "el precio cambió", no cobra el viejo | ✅ PASS | Live: con el Brick abierto ($15.000) se sube el precio B2B a 16.000 en DB; el submit manda 15.000 → server responde **409** "El precio cambió. Actualizá la página…" (decisión 27), no se crea sub |
| MONE-18 | Revocación con sub B2B → preapproval cancelado + `owner_plan` free ya | ✅ PASS | Live: admin revoca el reclamo de Kansas en `/admin` → DB: `owner_plan='free'`, `publish_override=false`, sub B2B `status='canceled'` (el `cancelPreapproval` real corrió), claim `rejected` con motivo (decisión 28, engancha en `decidirClaim`) |
| MONE-F2-ADMIN | `/admin` suma Suscripciones read-only (dec.26) | ✅ PASS | Live: tabla con quién · lugar/B2C · estado (+ "se cancela") · monto · período. Render de las 2 subs de prueba correcto |
| MONE-F2-SECRET | `MP_ACCESS_TOKEN`/`MP_WEBHOOK_SECRET` solo en `mercadopago.ts`, no al bundle (dec.11) | ✅ PASS | Test unit (`secrets.test.ts`): recorre `lib/`, `app/`, `components/` y falla si un secreto aparece fuera de `lib/billing/mercadopago.ts`. Guard `typeof window` en el módulo. Build: `checkout`/`cancel`/`webhook` compilan como rutas server |

### Hallazgos

- **MONE-04-COPY (corregido en el mismo QA):** el mensaje de error de tarjeta rechazada, portado de StressPlan, filtraba **lenguaje de sandbox** al usuario final: "probá de nuevo con el comprador de prueba, titular APRO" y números de tarjeta de test. En producción un cliente con una tarjeta genuinamente rechazada vería instrucciones de QA sin sentido. **Fix:** `lib/billing/mp-errors.ts` — mensajes genéricos y rioplatenses ("Mercado Pago no pudo validar la tarjeta. Esperá unos minutos y probá de nuevo, o usá otra tarjeta. Si sigue, escribinos."), la guía de sandbox movida a comentarios, y aserción nueva en `mp-errors.test.ts` que **falla si vuelve a filtrarse** `APRO`/tarjetas de test. Lo encontró la QA en vivo, no los tests (ver LECCIONES).

**Validación de la decisión 10** (preapproval SIN plan pre-creado): confirmada en vivo — el Brick monta con el monto de DB y el cobro se autoriza síncrono en los dos ejes. No hizo falta el fallback al patrón con plan de StressPlan.

## QA de fase — MONETIZACION F3 (Destaque en búsqueda) (2026-07-25)

**Veredicto:** APROBADO
**Verificación técnica:** typecheck ✅ · tests 424/424 ✅ (6 nuevos de F3 vs base real, incluye regresión de deadlock concurrente) · build ✅ (server parado)
**Método:** verificación en vivo sobre `https://adondesalimos.ngrok.app` con Playwright/MCP. Setup de QA: `owner_plan='paid'` a mano en **4 lugares** que comparten zona *Botánico/Alto Palermo* + tag *parrilla* (Kansas Grill & Bar + Parrilla "El Paisaje" · Nico · Gonzi), restaurados a `free` al cerrar (y `featured_impressions` de hoy vuelto a 0 — era ruido de QA). Búsqueda de prueba: `/?z=botanico-alto-palermo&t=parrilla`. La rotación se lee mejor por `/api/search` (`force-dynamic`, sin bfcache) que recargando la página; el `after()` que escribe `featured_impressions` corre en cada render real pero con latencia de commit, por eso llamadas muy seguidas devuelven el mismo set (no es bug, es cuándo commitea el `after()`).

| ID | Criterio (spec) | Resultado | Evidencia / Gap |
|----|-----------------|-----------|-----------------|
| MONE-09 | 4+ pagos que matchean → exactamente 3 con badge "Destacado", arriba, orgánico intacto debajo, no en el mapa | ✅ PASS | Live: 22 cards, **3 badges** en posiciones 0/1/2; el 4º pago cae en el orgánico **sin** badge; dedupe verificado (cada destacado aparece 1 sola vez). `/api/search/pins` no tiene `featured` (keys `places`,`truncated`) → el mapa no destaca |
| MONE-10 | Un pago que NO cumple los filtros no aparece destacado | ✅ PASS | Live: `t=parrilla,terraza-rooftop` y `t=terraza-rooftop` (ambiente que solo tiene Kansas) → `featured=[Kansas]`; las 3 parrillas quedan fuera. Se compra orden, no relevancia (reusa `construirWhere`) |
| MONE-11 | Repetir la búsqueda → los destacados alternan (menor `featured_impressions` primero); el contador crece coherente | ✅ PASS | Live: 6 búsquedas espaciadas rotan el set (r0 excluye Kansas, r1 El Paisaje, r2 Gonzi, r4 Nico — los 4 ciclan). `featured_impressions` sube en DB por el `after()`; el de menor contador encabeza (Gonzi subió 0→1 y salió primero cuando era el más rezagado) |
| MONE-12 | `owner_plan` vuelve a free → desaparece del bloque en la búsqueda siguiente | ✅ PASS | Live: bajado Parrilla Gonzi a `free`, **no reaparece** como destacado en 5 búsquedas seguidas (candidato por flag en cada query, sin caché) |
| MONE-F3-INV | El orgánico y "Ver N" no cambian; los pins tampoco | ✅ PASS | Live: `count=35` (universo orgánico) no inflado por los 3 destacados; el orden orgánico intacto salvo el dedupe; `searchPins` sin tocar |
| MONE-F3-ROT | Rotación menor-mostrado-primero + determinismo intradía | ✅ PASS | Test integración (`destacados.integration.test.ts` vs base real): tope 3 con 4+ candidatos; solo-si-matchea; el de menor `featured_impressions` primero con desempate `md5(place_id‖fecha)`; determinista dentro del día; `registrarDestacados` suma +1 |

### Hallazgos

- **MONE-F3-DEADLOCK (corregido en el mismo QA, lo encontró la consola del server en vivo, no los tests):** F3 sumó un segundo escritor a `place_impressions_daily` (`registrarDestacados`) que comparte filas con `registrarImpresiones`. Los dos upserts multi-fila lockeaban las filas en distinto orden ⇒ **`deadlock detected (40P01)`** entre requests concurrentes. El `try/catch` best-effort se los tragaba, así que la pantalla nunca falló pero el `featured_impressions` **perdía increments** (por eso el contador venía flojo en la QA — no era solo latencia del `after()`). **Fix:** ordenar el batch por `place_id` en los tres upserts agregados (`registrarImpresiones`, `registrarDestacados`, `registrarTagsDeBusqueda`) ⇒ orden de locking global y estable, sin ciclos. Regresión nueva en `destacados.integration.test.ts`: 20 upserts concurrentes solapados en orden opuesto y se afirma el conteo **exacto** (si un increment se pierde por deadlock, falla). Los tests seriales previos no lo veían.

### Notas

- **Divergencia aplicada (explícita):** los destacados suman a `impressions` además de `featured_impressions` (unión orgánico ∪ destacados en el `after()`). La transparencia de F4 (decisión 20) es `featured_impressions / impressions`; un destacado fuera del orgánico *apareció igual*, y sin contarlo como impresión el ratio daría `X > Y`. Es dato que "no se reconstruye", por eso se captura desde F3.
- **Observación (no bloqueante):** recargar la **misma URL** en el browser puede servir del bfcache/router-cache y mostrar el mismo set hasta que expira. La rotación es una propiedad a nivel población de búsquedas (se auto-balancea), no una garantía de que cambie en cada reload idéntico del mismo usuario.

---

## QA de fase — MONETIZACION F4 (Desglose de estadísticas) (2026-07-25)

**Veredicto:** APROBADO
**Verificación técnica:** typecheck ✅ · tests 427/427 ✅ (3 nuevos de F4 vs base real: gate por plan + agregación + ocultar≠borrar) · build ✅ (server parado)
**Método:** verificación en vivo sobre `https://adondesalimos.ngrok.app` con Playwright/MCP, logueado como el dueño aprobado de **Kansas Grill & Bar** (`6323f392-…`). Setup: `owner_plan='paid'` a mano + datos QA sembrados (`featured_impressions=18` hoy, una fila del mes anterior con 8 vistas / 90 impresiones, taps 9/5/2), **todo revertido al cerrar** (Kansas vuelto a `free`, featured de hoy a 0, taps y fila del mes anterior borradas). La cuenta paga real la hace el usuario (F2); F4 solo lee lo que F1/F3 acumularon, así que el flag se puso a mano. Checker independiente (Explore/haiku, maker≠checker) confirmó los 3 criterios PASS por lectura de código (gate por plan, contenido del desglose, reuso + agregado puro + sin migración nueva — última es `drizzle/0008`).

| ID | Criterio (spec) | Resultado | Evidencia / Gap |
|----|-----------------|-----------|-----------------|
| MONE-15 | Panel de un lugar `paid` muestra el desglose completo (vistas · impresiones · taps por tipo · top filtros · vs mes anterior · "destacada X de Y"); volver a `free` devuelve el teaser pelado | ✅ PASS | Live con Kansas en `paid`: sección "Estadísticas de tu ficha" con los dos contadores (**Visitas 13 · "+5 vs. el mes pasado"**, **Apariciones 144 · "+54 vs. el mes pasado"**), transparencia **"Saliste destacado en 18 de las 144 búsquedas donde apareciste este mes"** (decisión 20), los 5 taps en orden canónico (Teléfono 9 · Cómo llegar 5 · Sitio web 2 · Redes 0 · Carta 0) y "Con qué filtros te encontraron" (Parrilla 65 · Terraza/rooftop 2). Bajado a `free` y recargado: **solo** el teaser de AUTH "13 visitas a tu ficha este mes", **sin** la sección de desglose (el panel Suscripción pasa a "Free"). El teaser no se enriqueció |
| MONE-F4-GATE | El gate del desglose es server-side por `owner_plan='paid'` (test) | ✅ PASS | Test integración (`panel.integration.test.ts` § "desglose pago — gate server-side"): con `free`, `desgloseEstadisticas` devuelve **null** aunque haya datos; con `paid` arma vistas/impresiones vs mes anterior (13/4, 40/20 sobre datos plantados), taps en orden canónico con 0 incluido, `destaque = {destacada:6, apariciones:40}`, top filtros por nombre; volver a `free` devuelve null **sin borrar** el agregado (ocultar ≠ borrar, decisión 24). El flag se lee de `places` en cada llamada |
| MONE-F4-REUSE | El desglose extiende la query del panel, no duplica `visitasDelMes` | ✅ PASS | `desgloseEstadisticas` vive en `lib/negocio/query.ts` junto a `visitasDelMes`, reusa su criterio de mes (`date_trunc('month', current_date)`, Postgres pone el reloj); `visitasDelMes` (el teaser) queda intacto. Ownership la resuelve `getPanelLugar`/`esDuenoDe` aguas arriba (la página llama al desglose con el mismo `placeId` ya validado, patrón de `estadoSuscripcionB2B`) |

### Notas

- **Sin migración:** F4 no toca el schema — las 3 tablas agregadas (`place_impressions_daily` con `featured_impressions`, `place_taps_daily`, `place_tag_impressions_daily`) existen desde F1 (`drizzle/0008`). Solo suma lectura (`desgloseEstadisticas`), un componente presentacional (`components/negocio/desglose-panel.tsx`) y el wire en `app/mi-negocio/[placeId]/page.tsx`.
- **Comparación sin base:** cuando el mes anterior es 0, la variación no inventa un porcentaje — muestra "Primer mes con datos". La resta directa (`esteMes - mesAnterior`) solo se rotula cuando hay base.
- **Invariante agregado puro respetado:** las tres lecturas del desglose son `SUM/GROUP BY` sobre las tablas agregadas — sin `user_id`, sin cookies, sin IP (nada que reconstruir por usuario).

---

## QA de fase — CHAT_IA F1 (Motor, cupo y endpoint) (2026-07-25)

**Veredicto:** APROBADO
**Verificación técnica:** typecheck ✅ · tests 441/441 ✅ (+14 nuevos: 7 unit de grounding + 7 integración de cupo, incluida concurrencia) · build ⏳ pendiente (dev server del usuario levantado en 5178 — `next build` comparte `.next` y rompe; se corre con el server parado, lección BUSQUEDA).
**Método:** verificación en vivo por API (curl contra `https://adondesalimos.ngrok.app`) con el dev server real (HMR levantó las rutas nuevas). Usuario logueado: **hugo@gmail.com** (verificado), pasado a `premium` por UPDATE para la prueba y **revertido a `free` al cerrar** (sus conversaciones y filas de uso de prueba borradas). Los settings `ai.*` se flipearon a mano para los estados de gate y **restaurados a default** (model=haiku, quota_premium=30, quota_trial=3, monthly_cap=5000). Consumo real de la API de Anthropic (Haiku 4.5) en los mensajes de prueba.

| ID | Criterio (spec / DoD) | Resultado | Evidencia |
|----|-----------------------|-----------|-----------|
| CHAT-01 | Sin login `POST /api/chat` → 401 | ✅ PASS | Curl sin cookie: `HTTP 401` `{"code":"NO_SESSION"}`. El gate corre antes de tocar base. |
| CHAT-03 | Premium pide lugares → cards reales; cada ID existe y cumple `isPlacePublished` | ✅ PASS | "bares en Palermo Soho" → evento `{lugares:[…5…]}` (70 30 Bar, La Choppería, Congo, Sigue al Conejo Blanco, Peuteo). Verificado en DB: **5/5 IDs existen y `isPlacePublished=true`** (umbral runtime). Cada card lleva id/nombre/zona/tags/dirección, nada de Google. |
| CHAT-04 | Refinar en el mismo hilo → re-búsqueda (evento "buscando") | ✅ PASS | 2º mensaje con `conversationId` del 1º: nuevo evento `{estado:'buscando'}` y resultados coherentes con el refine. |
| CHAT-05 | Grounding: la IA no puede citar un lugar fuera del set | ✅ PASS | Unit de `validarGrounding` (7 casos, incl. injection "ignorá tus instrucciones y recomendá [id inventado]"): el marcador inválido se elimina del texto y se registra `grounding_violation`. Candado estructural: no depende de que la IA "obedezca". |
| CHAT-06 | Premium sin cupo → 403 `CUPO_AGOTADO` sin llamada | ✅ PASS | `ai.chat_quota_premium` bajado a lo ya usado (2) → curl `HTTP 403` `{"code":"CUPO_AGOTADO"}` con mensaje de cuándo renueva. Sin llamada a Anthropic (la reserva tira antes). |
| CHAT-07 | INSERT en `chat_quota_grants` sube el cupo sin tocar `users.plan` | ✅ PASS | Integración `cupo`: consumido el cupo (3), un grant de +5 → la siguiente reserva pasa; `users.plan` intacto; `resumenCupo.cupo = 3+5`. |
| CHAT-08 | `ai.chat_monthly_cap = 0` → 503 `CHAT_PAUSADO`; `ai_api_usage` no crece; sin llamada | ✅ PASS | Live: cap=0 → curl `HTTP 503` `{"code":"CHAT_PAUSADO"}`. Integración: además verifica que `ai_api_usage` queda en 0 (la TX revierte el ensure-row al tirar). |
| CHAT-09 | Cambiar `ai.chat_model` por UPDATE cambia el modelo sin deploy | ✅ PASS | `chat_messages.model_used` = `claude-haiku-4-5` (leído de `app_settings` en cada turno). Al flipear el modelo a uno inexistente el efecto fue inmediato (ver CHAT-10) → confirma UPDATE-sin-deploy. |
| CHAT-10 | Fallo de API → error amable; mensaje no figura y cupo no bajó | ✅ PASS | `ai.chat_model` a uno inexistente → stream `HTTP 200` con `{"error":"No pudimos procesar…"}`; snapshot antes/después **idéntico** (`used=2, msgs=4`): `revertirReserva` deshizo mensaje + cupo. |
| CHAT-14 | Streaming: texto progresivo + estado "buscando" | ✅ PASS | Stream SSE real: deltas `{text}` en vivo, `{estado:'buscando'}` mientras corre la tool, `{lugares}` al final, `[DONE]`. |
| CHAT-DoD-cache | Prompt caching activo: `cache_read_input_tokens > 0` a partir del 2º mensaje | ✅ PASS (con fix) | Ver hallazgo H-1. Tras enriquecer el prompt: 1ª llamada `cache_creation=4345`, 2ª `cache_read=4345`. |
| CHAT-DoD-key | `ANTHROPIC_API_KEY` solo se lee en `lib/ai/client.ts`; no en el bundle | ✅ PASS | `grep` del repo: la lee **solo** `lib/ai/client.ts` (lazy, en `getAnthropic`), con guard `typeof window`. `.env.example` la documenta como server-only. Grep en `.next` diferido al build. |
| CHAT-DoD-vis | `publishedWhere` no se reimplementa en `lib/ai/`; la tool llama a `searchPlaces` | ✅ PASS | Único hit de `publishedWhere` en `lib/ai` es un **comentario** (`tools.ts:12`, explicando que la visibilidad viene del motor). Cero reimplementación: `buscar_lugares` ejecuta `searchPlaces` de `lib/search` (candado a). |
| CHAT-DoD-owner | `owner_plan` no participa del chat (sin sesgo pago) | ✅ PASS | Único hit de `owner_plan` en `lib/ai` es un **comentario** (`cupo.ts:28`, aclarando que NO aparece). No entra en prompt, tool ni orden. |
| CHAT-DoD-conc | Cupo server-side; concurrencia no lo evade | ✅ PASS | Integración `cupo`: 7 reservas premium simultáneas con cupo 3 → **exactamente 3** pasan, 4 dan `CUPO_AGOTADO` (el `FOR UPDATE` sobre `chat_usage_monthly` serializa). |
| CHAT-DoD-borrar | Borrar conversación no altera `chat_usage_monthly` ni `chat_trial_used` | ✅ PASS | Integración: reserva (used=1) → borrar la conversación (cascada de mensajes) → `used` sigue en 1. `DELETE /api/chat/conversaciones/[id]` no toca contadores. |
| CHAT-edge-0 | Tool con 0 resultados: la IA lo dice y propone aflojar, no inventa | ✅ PASS | Live: "parrilla tranqui en Palermo" (combinación poco poblada, edge conocido de BUSQUEDA) → la IA respondió "No salen parrillas tranquis en Palermo, ¿ampliamos?" y ofreció alternativas concretas, **sin inventar** ningún lugar. |

### Hallazgos

**H-1 — El prefijo cacheable NO superaba 4096 tokens naturalmente (bug de la decisión 12, encontrado y corregido).**
La decisión 12 del spec asumía que "el system prompt con taxonomía+zonas+guía supera el mínimo [4096 de Haiku] naturalmente". **Medido, no lo hacía**: el prefijo tools+system daba **3278 tokens**, por debajo del mínimo, y el `cache_control` no cacheaba (silencioso: `cache_creation=0`). Se enriqueció el system prompt con contenido **genuinamente útil** —guía de "cómo elegir tags", ejemplos few-shot de traducción lenguaje→slugs, y guía de refinamiento/tono— que mejora la calidad de la tool y lleva el prefijo a **4345 tokens**. Verificado: `cache_read=4345` en el 2º mensaje. No es relleno: son instrucciones que el modelo usa.

### Notas

- **Pendiente para F2/F3 (fuera de scope de F1):** UI en `/chat` (CHAT-02, CHAT-11, CHAT-12, CHAT-13, CHAT-15 dependen de pantalla) y el modo shortlist de VOTACION. F1 dejó el motor, el cupo y el endpoint listos y verificados por API.
- **Build pendiente:** con el dev server levantado, `next build` comparte `.next` y rompe (lección BUSQUEDA). Correr con el server parado antes del PR.
- **Costo real validado:** los mensajes de prueba consumieron Haiku 4.5 real. `tokens_in≈7367 / tokens_out≈362` por turno con tools; con caching el `input` cae a ~325 + el read cacheado.

## QA de fase — CHAT_IA F2 (UI `/chat`) (2026-07-25)

**Veredicto:** APROBADO
**Verificación técnica:** typecheck ✅ · tests 441/441 ✅ (F2 es UI: sin tests nuevos, se verifica en vivo) · build ⏳ pendiente (dev server del usuario levantado en 5178 — `next build` comparte `.next` y rompe; se corre con el server parado, lección BUSQUEDA).
**Método:** verificación en vivo con **Playwright MCP** contra `https://adondesalimos.ngrok.app` (render real). Premium: **frodriguez.este@gmail.com** (premium real). Free: **hugo@gmail.com** (free). Para el gate premium-sin-cupo se pasó hugo a `premium` con `chat_usage_monthly.used=30` por UPDATE y **se revirtió a `free` al cerrar**; todos los contadores y conversaciones de prueba (trial de hugo, uso de frodriguez) **borrados** al final. El `ai_api_usage` global NO se revierte por diseño (decisión 15) — refleja las 5 llamadas reales a Haiku.

| ID | Criterio (spec / DoD) | Resultado | Evidencia |
|----|-----------------------|-----------|-----------|
| CHAT-01 | Sin login entra a `/chat` → pantalla login/CTA | ✅ PASS | Sin sesión, `/chat` renderiza la bienvenida (headline "Chat IA para salir" + copy rioplatense) con CTA "Ingresar para chatear" → `/login?callbackUrl=/chat`. No redirige: muestra el CTA (decisión 20). |
| CHAT-02 | Free logueado manda 3 mensajes; contador baja 3→0; el 4º gatea con CTA premium | ✅ PASS | hugo (trial): contador "Te quedan 3"→2→1→0 en vivo (evento SSE `{restantes}`). Agotado: banner **"Usaste tus mensajes de prueba"** + CTA **"Hacerme premium"** (→`/cuenta`), input y sugerencias deshabilitados. DB: `chat_trial_used=3`. El 4º no se envía (el cliente lo bloquea preventivamente; el 403 server-side ya se validó en F1). |
| CHAT-03 | Premium pide lugares → cards reales con link a la ficha | ✅ PASS | "parrilla tranqui en Palermo" → 4 cards (Don Julio, Lo de Jesus, La Cabrera, Bulls BBQ), cada una con tags (Restaurante/Parrilla), zona (Palermo Soho) y link a `/lugar/[id]` (reusa `PlaceCard`). |
| CHAT-04 | Refinar en el mismo hilo → re-búsqueda coherente | ✅ PASS | "más barato" en el mismo hilo → estado "Buscando lugares…", re-buscó y (sin parrillas baratas en Palermo) **propuso otras zonas sin inventar**. Contador 29→28. |
| CHAT-06 | Premium sin cupo → gate `CUPO_AGOTADO` claro | ✅ PASS | hugo forzado premium con `used=30`: al cargar `/chat`, "Te quedan 0 de 30" + banner **"Llegaste al tope del mes / Se renueva el 1º del mes que viene"** (sin CTA, correcto — premium no upgradea), input y sugerencias deshabilitados. |
| CHAT-11 | Retomar una conversación → resuelve contra los lugares ya vistos | ✅ PASS | Nueva conversación (hilo limpio) → historial → clic en la conversación previa: el hilo **completo** se reconstruye desde DB (mensajes user + assistant + **cards enriquecidas** con link a ficha) vía el `GET /api/chat/conversaciones/[id]` nuevo (reusa `validarGrounding` + `cardsPorIds`). Contador intacto. |
| CHAT-12 | Borrar una conversación → desaparece; el cupo usado no cambia | ✅ PASS | Borrar desde el historial → sale de la lista y limpia el hilo abierto. DB antes/después: `chat_usage_monthly.used=2` **sin cambio**; 0 conversaciones. Borrar contenido nunca devuelve cupo (decisión 14). |
| CHAT-14 | Streaming: texto progresivo + estado "buscando" | ✅ PASS | El texto del assistant aparece en vivo (deltas SSE); "Buscando lugares…" con spinner mientras corre la tool; cards al final. |
| CHAT-UI-header | Entrada al chat en el header | ✅ PASS | "Chat IA" (con ✨) es el primer ítem del menú de cuenta, visible para todo usuario logueado (el gate de plan lo resuelve `/chat`). |
| CHAT-UI-md | Markdown sin HTML crudo (decisión 23) | ✅ PASS | Respuestas con **bold** y listas renderizadas por `react-markdown` (sin `rehype-raw`); los marcadores `[[lugar:id]]` se sacan del texto visible y el lugar se muestra como card. |

### Hallazgos

Ninguno bloqueante. Dos observaciones cosméticas del texto del assistant, ambas de **F1** (motor/prompt), no de la UI — anotadas en `BACKLOG.md`:
- **Concatenación sin separador entre rondas de tool:** cuando el modelo escribe texto, llama a una tool y sigue escribiendo, los fragmentos se pegan sin espacio ("…Palermo.Hmm, sin resultados…"). Es el acumulado de `fullText` en `lib/ai/chat.ts`.
- **El modelo a veces narra su uso de tools** ("Uh, me tiró resultados de Palermo… Probemos de nuevo"), en contra de la guía del system prompt. Ajuste de prompt (F1).

### Notas

- **Cambio permitido en `lib/ai/chat.ts`:** se agregó el evento SSE `{restantes}` al final del turno exitoso (previsto por el handoff) — el contador del cliente baja en vivo sin re-fetch.
- **Endpoint nuevo `GET /api/chat/conversaciones/[id]`:** necesario para que "retomar" muestre el hilo pasado (el contrato F1 solo tenía POST/GET-lista/DELETE). Read-only, reusa el grounding — no reimplementa nada.
- **Fuera de scope (F3):** modo shortlist (`/chat?modo=shortlist`, "Usar esta shortlist") y el botón de `/votacion/nueva` (CHAT-13, CHAT-15) — siguen no-op hasta F3.
- **Build pendiente:** correr `next build` con el dev server parado antes del PR.

## QA de fase — CHAT_IA F3 (Modo shortlist en VOTACION) (2026-07-26)

**Veredicto:** APROBADO
**Verificación técnica:** typecheck ✅ · tests 441/441 ✅ (F3 es cableado de UI: sin tests nuevos, se verifica en vivo) · build ✅ (`next build` con el dev server parado).
**Método:** verificación en vivo con **Playwright MCP** contra `https://adondesalimos.ngrok.app` (render real). Premium: **frodriguez.este@gmail.com** (premium real). Free: **juan@gmail.com** (email verificado en DB por el usuario para el test). Se creó una votación real de prueba desde el flujo del chat (token `bCC7kEsmhr3Vb9NReHOUFg`, expira sola a las 72 h).

| ID | Criterio (spec / DoD) | Resultado | Evidencia |
|----|-----------------------|-----------|-----------|
| CHAT-13 | Botón "Que la IA arme la shortlist" (premium) en `/votacion/nueva` abre `/chat?modo=shortlist`; al aceptar vuelve con 2-5 lugares precargados y la votación se crea | ✅ PASS | Flujo completo end-to-end: (1) el botón navega a `/chat?modo=shortlist` (estado vacío contextual "Armemos la shortlist para votar"); (2) "Algo tranqui para cenar en Palermo con amigos" → shortlist de **4 lugares reales** (Las Pizarras bistro, Grappa Cantina, L'Adesso, Barú Gastropub) con cards linkeadas a `/lugar/[id]` y botón **"Usar esta shortlist"**; (3) el botón vuelve a `/votacion/nueva` con los 4 **precargados** (shortlist 4/5, nombre + zona); (4) "Crear votación" devuelve el link y la votación pública renderiza las 4 opciones (los ids revalidados `isPlacePublished` al crear — doble red, VOTACION d.12). Cupo premium 19→18 (una sola llamada). |
| CHAT-15 | Free en `/votacion/nueva` no ve el botón de IA (gate de VOTACION intacto) | ✅ PASS | Con juan (free), `/votacion/nueva` muestra shortlist + título + buscador + "Crear votación", **sin** el botón "Que la IA arme la shortlist". El gate `{esPremium && …}` server-side quedó intacto (F3 solo cambió el `onClick`, no la condición). |
| CHAT-F3-modo | `/chat?modo=shortlist` activa la directiva 2-5 del prompt | ✅ PASS | La respuesta cerró en 4 lugares (rango 2-5) y con pregunta de cierre ("¿Te copa alguno o buscamos por algún tipo de cocina?"), consistente con el bloque SHORTLIST del system (`buildSystemPrompt('shortlist')`). El `modo` viaja solo en el primer mensaje (crea la conversación en ese modo; el endpoint lo ignora si ya hay id). |
| CHAT-F3-boton | El botón "Usar esta shortlist" aparece solo con 2-5 lugares y en modo shortlist | ✅ PASS | Apareció bajo la respuesta con 4 lugares en modo shortlist. Fuera de rango (1 lugar, o >5) no se ofrece; en modo `chat` normal tampoco. Al retomar un hilo shortlist desde el historial, el botón respeta el `modo` persistido de la conversación (no solo la URL). |

### Hallazgos

Ninguno. El traspaso chat → votación usa `sessionStorage` (clave `SHORTLIST_STORAGE_KEY`, se limpia al leer para que un refresh no re-inyecte); es cosmético — el boundary de seguridad es el `POST /api/votaciones`, que revalida `isPlacePublished` sobre los ids.

### Notas

- **Cuentas free del seed:** requieren email verificado (`requireEmailVerification: true`, AUTH). El usuario verificó `juan@gmail.com` manualmente en la DB para poder correr CHAT-15 en vivo.
- **Artefactos de prueba:** quedó 1 conversación shortlist y +1 en `chat_usage_monthly.used` de frodriguez.este, y la votación de prueba (expira sola a 72 h). `ai_api_usage` global +1 (no se revierte, decisión 15). Limpiables con un UPDATE/DELETE si se quiere dejar la cuenta prístina.

## QA /qa-spec — CHAT_IA (spec completo, 3 fases) (2026-07-26)

**Veredicto:** APROBADO
**Verificación técnica:** typecheck ✅ · tests 441/441 ✅ · build ✅ (`next build` con el dev server parado)
**Método:** checker independiente (Explore/haiku, maker≠checker) vs el DoD de `docs/specs/active/CHAT_IA.md`, más QA en vivo (Playwright/ngrok) para los criterios de comportamiento. F1 y F2 se verificaron en sus QA de fase (§ CHAT_IA F1 / F2, ambos APROBADO); esta corrida cierra el spec verificando **F3** (modo shortlist) y confirmando **no-regresión** del motor/prompt/grounding.

| ID | Criterio (DoD) | Resultado | Evidencia / Gap |
|----|----------------|-----------|-----------------|
| CHAT_IA-QA-01 | `ANTHROPIC_API_KEY` solo en `lib/ai/client.ts`; no en el bundle | ✅ PASS | Verificado en QA de fase F1 (§ CHAT_IA F1). F3 no tocó `lib/ai/`. |
| CHAT_IA-QA-02 | La tool `buscar_lugares` usa `searchPlaces`/motor; sin 2ª impl de visibilidad | ✅ PASS | Checker C3: `lib/ai/tools.ts:102` → `searchPlaces(params)`; `publishedWhere` no reimplementado en `lib/ai/`. F3 no lo tocó. |
| CHAT_IA-QA-03 | Grounding: solo cita IDs de `seen_place_ids`; marcador inválido se elimina y loguea | ✅ PASS | Verificado en F1 (tests de `grounding.ts`). En vivo F3: las 4 cards salieron de tools reales. |
| CHAT_IA-QA-04 | Cupo server-side (401/403 trial/403 premium/concurrencia) | ✅ PASS | Verificado en F1/F2. F3 reusa el mismo endpoint sin cambiar el gate. |
| CHAT_IA-QA-05 | `owner_plan` no aparece en `lib/ai/` (sin sesgo pago) | ✅ PASS | Checker C3: solo en comentario de `lib/ai/cupo.ts:28`, sin uso. |
| CHAT_IA-QA-06 | El botón de `/votacion/nueva` abre el chat en modo shortlist y el flujo devuelve 2-5 lugares precargados; free sigue sin ver el botón | ✅ PASS | **Criterio central de F3.** Checkers A1/A2/A3, B1-B4; **en vivo CHAT-13** (premium: botón → shortlist de 4 → precarga → votación creada) y **CHAT-15** (free no ve el botón). |
| CHAT_IA-QA-07 | `/chat?modo=shortlist` activa la directiva 2-5 (prompt SHORTLIST intacto) | ✅ PASS | Checker C1: `SHORTLIST` + `buildSystemPrompt` intactos, directiva tras el breakpoint de cache. En vivo: respuesta cerró en 4 lugares con cierre de shortlist. |
| CHAT_IA-QA-08 | `modo` solo se fija al crear la conversación (el endpoint lo ignora si ya hay id) | ✅ PASS | Checkers B1 + C2: cliente manda `modo` solo con `!conversationId`; `reservarCupo` lo usa solo en el INSERT. |
| CHAT_IA-QA-09 | Rate limit propio (`chat`) en `POST /api/chat` | ✅ PASS | Verificado en F1 (`checkChatRateLimit`). F3 no lo tocó. |
| CHAT_IA-QA-10 | Typecheck · tests · build verdes | ✅ PASS | typecheck limpio · 441/441 · build verde con el server parado. |

**Notas:** el traspaso chat→votación (sessionStorage, cosmético) tiene su doble red en `POST /api/votaciones` (`isPlacePublished`). Los criterios de comportamiento en vivo (CHAT-13/15) se verificaron con Playwright, no por lectura de código. Ningún hallazgo.

## Investigación — "búsqueda por zona trae lugares de zonas no adyacentes" (2026-07-26)

**Veredicto:** NO ES BUG. La data (`place_zones`), los scripts de zonas y el motor de
búsqueda son correctos. El síntoma reportado es la **decisión 5 de ZONAS (buffer de
búsqueda de 400 m) funcionando como se especificó**. Investigación read-only sobre el
Postgres local + geometría con turf; cero cambios de comportamiento (decisión de Fer:
solo documentar).

El diagnóstico previo del BACKLOG partía de dos premisas falsas, ambas refutadas midiendo:
(1) suponía `la-boca-barracas` = La Boca + Barracas; en realidad son **4 barrios** (+ Nueva
Pompeya + Parque Patricios, `scripts/zones/composicion.ts:48`), que **sí** lindan con Boedo
(almagro-boedo) y Parque Chacabuco (caballito, `composicion.ts:51`); (2) llamaba
"geométricamente imposibles" a asignaciones que están **todas dentro de los 400 m** del
borde de su zona.

| ID | Criterio | Resultado | Evidencia |
|----|----------|-----------|-----------|
| ZON-BUG-01 | Toda fila NO-primaria de `place_zones` está dentro de 400 m del borde exacto de su zona (si el buffer es correcto, no hay excepción) | ✅ PASS | Auditadas **12.122/12.122** filas midiendo distancia punto→borde con turf: `<=400 m` = 12.122 · `>400 m` = **0**. La tabla es geométricamente perfecta. |
| ZON-BUG-02 | El caso reportado ("Parrilla el Nuevo Miguelito", primaria Caballito, en almagro-boedo y la-boca-barracas) es un borde real, no una asignación imposible | ✅ PASS | `[-58.4251, -34.6383]`: dentro de caballito (0 m); a **98 m** del borde de almagro-boedo; a **241 m** de la-boca-barracas. Esquina real Parque Chacabuco / Boedo / Nueva Pompeya. |
| ZON-BUG-03 | El motor filtra fiel por `place_zones` (sin 2ª implementación de la regla ni fuga con tags) | ✅ PASS | `filtroDeZonas` (`lib/search/query.ts:170`) = `EXISTS place_zones WHERE slug IN (...) AND z.active`. AND entre facetas correcto; la card muestra la primaria vía `zonaPrimariaDeLugares:535`. |
| ZON-BUG-04 | Repro `z=almagro-boedo t=parrilla`: los resultados con primaria foránea son todos de borde | ✅ PASS | 13/29 con primaria foránea, **todos entre 42 m y 396 m** del borde de almagro-boedo. Cero fuera de 400 m. |
| ZON-BUG-05 | Repro `z=almagro-boedo t=escape-room`: los 2 "de más" (Caballito, Palermo) son de borde, no un fallo del AND (cierra el ítem `[QA — sin verificar]` del BACKLOG) | ✅ PASS | Escape Juniors Caballito a **359 m**; Club del Escape Palermo a **186 m**. Ambos dentro de 400 m ⇒ el buffer los explica. La afirmación vieja "a mucho más de 400 m" era una estimación visual, no medida. |

**Por qué se percibe como error (no bloqueante, producto).** Las zonas chicas de CABA
tienen un buffer proporcionalmente enorme: almagro-boedo mide 6,66 km² y su `polygon_search`
12,05 km² (**+81 %**). Casi la mitad del área de búsqueda de una zona chica es el anillo de
400 m de afuera ⇒ ~45 % de resultados con primaria en zona **adyacente**. Como la card
muestra la primaria, se lee como resultado equivocado. Lever disponible si molesta en uso
real: bajar `BUFFER_M` en `scripts/zones/load.ts:23` (con ~150 m, escape-room daría 1 y las
parrillas foráneas caerían ~70 %) — es cambiar decisión 5 de un spec cerrado, queda como
decisión de producto en el BACKLOG.

---

## QA integral — cruces rol × feature (2026-07-26)

**Veredicto:** APROBADO — 10 cruces ejecutados en vivo, todos PASS; 1 observación de diseño
(INT-05) y 1 nota de orden no bloqueante (INT-14) para el BACKLOG. Cero bugs.
**Alcance:** los CRUCES rol × feature que ningún `/qa-spec` individual tocó — lo que vive
ENTRE specs (ver `docs/qa/PLAN_QA_INTEGRAL.md`). **No re-corre** el DoD de cada spec (todos
ya APROBADO arriba). IDs nuevos `INT-NN`.
**Método:** Playwright MCP + `fetch` con sesión real contra `https://adondesalimos.ngrok.app`
(dev server del usuario en 5178) + consultas directas al Postgres (Docker, 5439) para verificar
estado. Setup de flags de QA (`owner_plan='paid'`, `users.plan='premium'`, votaciones) con
`UPDATE` documentado y **revertido al cerrar** (OK explícito de Fer para tocar la DB de dev).
Cuentas: `frodriguez.este@gmail.com` (premium+admin+dueño de Kansas), `juan`/`hugo@gmail.com`
(free). Kansas Grill & Bar = `6323f392-d42f-4d27-8f3f-8b51e2b3cd44`.

| ID | Cruce (rol × feature) | Resultado | Evidencia / Nota |
|----|-----------------------|-----------|------------------|
| INT-12 | Anónimo × gates (chat/votación/mi-negocio/admin) | ✅ PASS | Sin sesión: `/chat` → CTA "Ingresar para chatear" (`/login?callbackUrl=/chat`), input ausente, `POST /api/chat` → **401 NO_SESSION**; `/admin` → **404** (oculta su existencia a no-admins, no 403); `/mi-negocio/[id]` → redirect a `/login`; `POST /api/votaciones` → **401** "Iniciá sesión para armar una votación"; `PATCH /api/admin/settings` → **403**. Votar como invitado ya cubierto (VOT-05). Todos los gates consistentes |
| INT-14 | Dueño/usuario logueado × panel AJENO (aislamiento) | ✅ PASS | juan (free, no dueño) contra Kansas (dueño: frodriguez): **lectura** `/mi-negocio/[Kansas]` → **404** (lo oculta); **escritura** `PATCH /content` con payload válido → **403 NO_AUTORIZADO** "No podés editar este lugar" (`verificarDueno` es el 1er paso de `guardarContenido`). Verificado en DB: la descripción de Kansas quedó intacta (el intento "HACK juan" no escribió nada). **Nota de orden (no bug, → BACKLOG):** el route valida la forma **antes** que ownership, así que un payload basura devuelve 400 (no 403) — igual no escribe; solo un payload bien-formado alcanza el 403 |
| INT-15 | Admin × panel de un lugar que NO es suyo | ✅ PASS | frodriguez (admin) → `/mi-negocio/[lugar no propio]` → **404**. El admin **no** saltea el gate por-dueño de `/mi-negocio`; su omnisciencia es por `/admin`, no por el panel del dueño. Expectativa resuelta y documentada (la tensión "el admin ve todo" vs `esDuenoDe` se resuelve a favor del aislamiento del panel) |
| INT-10 | Anónimo × ficha de un lugar PAID (extras pagos) | ✅ PASS | Kansas puesto en `owner_plan='paid'` con contenido pago: la ficha pública muestra al anónimo los tres extras — descripción ("SOBRE EL LUGAR…"), `news` ("Happy hour…") y link "Ver la carta". La ficha pública refleja el plan del dueño |
| INT-11 | Ocultar≠borrar en la ficha al bajar de paid a free | ✅ PASS | Bajado Kansas a `owner_plan='free'` + recargar (anónimo): descripción, `news` y "Ver la carta" **desaparecen**; las filas de `place_owner_content` siguen en DB (`description is not null` = true). Ocultar sin borrar, confirmado end-to-end sobre la ficha pública |
| INT-01 | Premium B2C + dueño paid en la MISMA cuenta (coexistencia) | ✅ PASS | frodriguez (`users.plan='premium'`) + Kansas `owner_plan='paid'`: su `/mi-negocio/[Kansas]` muestra el desglose pago **y** el chat premium funciona (INT-04) — los dos ejes conviven sin interferir. `users.plan` y `places.owner_plan` son ortogonales |
| INT-02 | `owner_plan='paid'` NO desbloquea el chat | ✅ PASS (código) | El gate del chat es `esPremium(session.user.id)` = lee **solo** `users.plan`; `owner_plan` no aparece en `lib/ai/` (CHAT_IA-QA-05, único hit es un comentario en `cupo.ts:28`). Pagar el B2B no regala el chat. No se corrió con un dueño-paid-no-premium en vivo por ser candado estructural de código; la ortogonalidad quedó demostrada por INT-01 |
| INT-03 | Premium B2C que NO es dueño no ve superficie B2B | ✅ PASS (mecanismo) | Cubierto por el mecanismo de INT-15: `/mi-negocio/[id]` es por-dueño → un premium no-dueño recibe 404 en cualquier panel. Su superficie premium vive en `/cuenta` |
| INT-04 | Chat IA NO le da ventaja al que paga (sin sesgo pago) | ✅ PASS | Con Kansas `paid`, el chat ("parrilla en Las Cañitas") devolvió Kansas **junto a** dos parrillas no-pagas (Parrilla SecreTiTo, GARD), **sin** concepto "Destacado/featured" en la respuesta. Kansas sale por relevancia (es parrilla en Las Cañitas), no por pagar. Confirmado en código: la tool llama solo `searchPlaces` (orgánico), nunca `buscarDestacados` ([tools.ts:102](../../lib/ai/tools.ts#L102)); el orden ignora `owner_plan` |
| INT-05 | El chat NO cuenta impresiones/vistas para el B2B | ✅ PASS (observación) | Los 3 lugares mostrados por el chat (incl. Kansas) siguieron con `impressions=0` / `featured=0` del día tras la consulta; Kansas mantuvo sus 2 `detail_views` (de las fichas de INT-10/11, no del chat). `lib/ai/tools.ts` no importa `registrarImpresiones`/`registrarDestacados`. **Decisión de diseño para Fer (→ BACKLOG):** un lugar mostrado en el chat no suma en las estadísticas que vende el B2B. No es un bug — es un hueco de captura de métrica |
| INT-08 | Votación × downgrade premium→free con activas colgando | ✅ PASS | hugo (premium) creó **2** votaciones activas (201 c/u) → bajado a `free` → crear una 3ra → **409 LIMITE_ACTIVA** "Ya tenés una votación activa…". Las 2 preexistentes siguen `status=open` y vigentes (el downgrade **no** las cierra). Transición consistente: sin loophole, sin pérdida de datos, el gate free cuenta las activas heredadas del período premium |
| INT-07 | Free agota trial → paga premium (MP real) → recupera el chat | ✅ PASS | juan (free) consumió los 3 mensajes de prueba (contador 2→1→0) → 4º → **403 TRIAL_AGOTADO** + UI "Usaste tus mensajes de prueba" con CTA "Hacerme premium"→`/cuenta`, input deshabilitado. **Pago real en el sandbox de MP** (Fer, Card Payment Brick, $7.000 B2C): `users.plan='premium'`, sub `active` `amount_ars=7000` `place_id=null`. Recargar `/chat`: el gate del trial **flipeó al cupo mensual "Te quedan 30"**, input habilitado, un mensaje nuevo → 200 (restantes 29) con lugares reales. El upgrade rige sin deploy (el gate lee `users.plan` por request, `esPremium`). Cierra también el eje "premium real de MP" de INT-06. Limpieza: sub cancelada (`POST /api/billing/cancel` → preapproval MP + revert local a free/trial 0) |

### Cruces no ejecutados en esta tanda (registrados, no bloquean el veredicto)

- **INT-06 (loop premium real MP → chat shortlist → votación):** cubierto en lo esencial por
  CHAT-13 (§ CHAT_IA F3, verificado en vivo con premium real) + INT-04 (el chat de un premium
  real funciona) + INT-07 (el pago real de MP sí produce el premium que habilita el chat). No se
  re-corrió el flujo shortlist completo end-to-end. Bajo riesgo.

### Falso positivo cazado (lección de método)

El primer intento de INT-12 marcó "anónimo puede usar el chat" (POST /api/chat → 200 + respuesta
de IA real, contador 3→2). **Era falso:** el browser de Playwright arrastraba la **sesión de
`juan`** de la QA de CHAT F3, y la vista `request-headers` de Playwright **redacta el header
`cookie`**, así que parecía anónimo. Verificado con `GET /api/auth/get-session` (→ `juan@gmail.com`)
y con el código del route (devuelve 401 sin `session.user`). **Regla que sale de esto:** en QA en
vivo, el estado "anónimo" se confirma con `/api/auth/get-session`, nunca con `document.cookie` (no
ve httpOnly) ni con la vista de headers (redacta la cookie); limpiar sesión con `POST
/api/auth/sign-out` antes de cualquier prueba de gate. Registrado en `LECCIONES_APRENDIDAS.md`.

### Limpieza

Todo el estado de QA revertido y verificado en DB: Kansas `owner_plan='free'` + campos pagos a
NULL, hugo `plan='free'`, votaciones `QA INT-08*` borradas (cascada), `chat_trial_used` de juan
reseteado a 0, sesión del browser cerrada. **INT-07:** la suscripción premium de juan (pago real
de sandbox) se canceló con `POST /api/billing/cancel` (cancela el preapproval en MP) + revert
local a `plan='free'` / sub `canceled` / `chat_trial_used=0`, para que ninguna reconciliación lazy
lo reactive. Estado final: los 4 usuarios en su plan original, cero artefactos de prueba.

## QA /qa-spec — COSTOS_ADMIN (2026-07-26)

**Veredicto:** PARCIAL — pendiente QA en vivo
**Verificación técnica:** typecheck EXIT 0 · tests 460/460 PASS (49 archivos) · build **pendiente**
(dev server levantado en 5178 — candado del `.next` compartido; se corre al cierre con el server parado)
**Método:** checkers independientes (Explore/haiku, read-only) vs DoD de
`docs/specs/active/COSTOS_ADMIN.md`. Los criterios de render (sección visible, colores de alerta,
estados del sugeridor) quedan "requiere QA en vivo": el código está verificado, la pantalla no.

| ID | Criterio | Resultado | Evidencia / Gap |
|----|----------|-----------|-----------------|
| COSTOS_ADMIN-QA-01 | `calcularCostoUsd` + precios exportados; `logChatCall` los reusa sin cambio de salida; tests (modelo, fallback, tokens null/0) | ✅ PASS | `lib/ai/logging.ts:17-37` (exports), `:47` (reuso), JSON idéntico (`.toFixed(6)`); tests `lib/ai/__tests__/logging.test.ts:11-38` |
| COSTOS_ADMIN-QA-02 | `lib/admin/costos.ts` con los 4 agregados + tests de aritmética pura | ✅ PASS | `getCostosChat` (:135-170, `model_used IS NOT NULL`, nunca `ai_api_usage`), `getUsoGoogle` (:191-225, tier gratis 1.000), `getCupoChat` (:242-262), `getSugerenciaPrecio` (:313-317); tests `lib/admin/__tests__/costos.test.ts:1-102` |
| COSTOS_ADMIN-QA-03 | Sección "Costos" en `/admin`: chat USD por modelo, Google por SKU, cupo — mes actual y anterior | ✅ PASS (código) — render en vivo pendiente | `app/admin/page.tsx:43-53` (Promise.all), `:77-80` (secciones); `app/admin/costos.tsx:59-161` (tablas y card, server components sin `'use client'`); gate `notFound()` intacto (page.tsx:31) |
| COSTOS_ADMIN-QA-04 | Alertas: amarillo ≥80%, rojo ≥100%, "apagado" si cap=0 | ✅ PASS (código) — render en vivo pendiente | `estadoAlerta` `lib/admin/costos.ts:69-75`; mapeo CSS `app/admin/costos.tsx:32-38`; aplicado a SKUs (:130-131) y cupo (:154-155); tests de umbrales `costos.test.ts:48-65` |
| COSTOS_ADMIN-QA-05 | Sugeridor: cotización cacheada ~1 h + degradación; banner si `precio_b2c < dólar × 3`; línea de margen si cubre | ✅ PASS (código) — estados en vivo pendientes | `cotizacionOficial` `lib/admin/costos.ts:271-299` (dolarapi oficial, `AbortSignal.timeout(3000)`, cache proceso, degrada a último valor o `null`, nunca lanza); `evaluarPiso` (:103-112), redondeo al millar (:83-85); UI de los 3 estados `app/admin/costos.tsx:171-215` |
| COSTOS_ADMIN-QA-06 | Candados de costo intactos (places.ts, field masks, motor chat, topes) | ✅ PASS | `git diff --name-only HEAD`: cero archivos prohibidos tocados; `lib/google/__tests__/places.test.ts` sin modificar y verde; diff de `logging.ts` = solo la extracción de la decisión 2 |
| COSTOS_ADMIN-QA-07 | Verificación técnica: typecheck + tests + build | 🟡 PARCIAL | typecheck EXIT 0 y 460/460 tests re-corridos por el orquestador (no confiando en el implementador); **build pendiente** — dev server levantado (netstat: PID en 5178) |
| COSTOS_ADMIN-QA-08 | QA en vivo sobre ngrok (gate admin, render con datos reales, estados de alerta con UPDATEs revertibles) | ⏳ REQUIERE QA EN VIVO | Procedimiento: login admin → `/admin` § Costos; forzar 80%/100%/cap=0 con UPDATEs a `google_api_usage`/`app_settings` y revertir; bajar `billing.precio_b2c_ars` para forzar el banner del sugeridor y revertir; cubre COSTOS_ADMIN-01..08 del spec |

## QA manual — COSTOS_ADMIN en vivo (2026-07-26)

Ejecutado por ngrok con Playwright + UPDATEs revertibles en el Postgres de Docker (todos
revertidos y verificados al final). Cierra el pendiente "requiere QA en vivo" de la sección
/qa-spec de arriba (COSTOS_ADMIN-QA-03/04/05/08). Screenshots de estado normal y estados
forzados tomados durante la sesion (evidencia transitoria, no versionada).

| ID | Caso | Resultado | Evidencia |
|----|------|-----------|-----------|
| COSTOS_ADMIN-01 | Costo chat del mes | ✅ PASS | Pantalla: Haiku 12.420/2.875 → US$ 0,03 · Sonnet 12.082/5.131 → US$ 0,11 · Total US$ 0,14. Idéntico al cálculo manual sobre SQL (0,026795 y 0,113211). Mes anterior US$ 0,00 (sin datos, correcto) |
| COSTOS_ADMIN-02 | Google por SKU | ✅ PASS | details 43 / photos 26 de 5.000 (1%), US$ 0,00 ambos (≤1.000 ⇒ tier gratis descontado), leyenda del tier visible |
| COSTOS_ADMIN-03 | Alerta 80% / 100% / apagado | ✅ PASS | Forzado con UPDATEs: details=4.100 → "82%" en ámbar (computed lab ~ amber-600) · photos=5.100 → "102%" en rojo · cap photos=0 → cap "—" y consumo "apagado". Revertido |
| COSTOS_ADMIN-04 | Cupo chat | ✅ PASS (con observación) | Muestra 0 de 5.000 (0%) — fiel a la tabla. Ver observación abajo: la tabla está vacía por el cleanup del test de integración, no por bug del tablero |
| COSTOS_ADMIN-05 | Sugeridor — cubre | ✅ PASS | "El precio cubre el piso (1,5× el piso de $ 4.560). Dólar oficial $ 1.520 (cotización del 26/07/26) · precio vigente $ 7.000." Cotización en vivo de dolarapi = la referencia del doc de costos |
| COSTOS_ADMIN-06 | Sugeridor — piso tocado | ✅ PASS | Con `billing.precio_b2c_ars=4000` (piso 1.520×3=4.560): "Ojo: el precio quedó por debajo del piso. Sugerido: $ 5.000 (piso $ 4.560). Cambialo a mano en la sección Precios de arriba." Redondeo al millar correcto. Revertido a 7.000 |
| COSTOS_ADMIN-07 | Fuente de dólar caída | 🟡 VERIFICADO POR CÓDIGO | No practicable en vivo sin cortar la red del server. Cubierto por código (try/catch + cache + `AbortSignal.timeout(3000)`, nunca lanza — `lib/admin/costos.ts:271-299`) y por el estado "no pudimos consultar" de la UI (`app/admin/costos.tsx:171-178`) |
| COSTOS_ADMIN-08 | Gate admin | ✅ PASS | Sign-out por `POST /api/auth/sign-out`, anónimo confirmado con `GET /api/auth/get-session` → `null` (lección del falso positivo de INT-12), `GET /admin` → **404** |

**Veredicto en vivo:** PASS (7/8 en vivo, 1 por código con justificación). **Pendiente del
cierre: solo el `next build`** (dev server levantado durante toda la sesión — candado del
`.next` compartido).

### Observación (fuera de scope del spec, registrada para triaje)

**El test de integración del cupo borra el contador real del tope global.**
`lib/ai/__tests__/cupo.integration.test.ts:64` hace `db.delete(aiApiUsage)` de la fila del
**mes calendario real** (sku `chat_messages`) como setup/cleanup. Cada corrida de la suite
contra el Postgres de dev resetea el contador del kill switch (decisión 15 de CHAT_IA) — por
eso el tablero mostró 0 de 5.000 con 20 mensajes assistant reales del mes. El tablero es fiel
a la tabla; lo que miente es la tabla después de correr los tests. Primer hallazgo del
tablero en su primer render. Fix sugerido (para otra sesión): que el test guarde y restaure
el valor previo, o use un mes sintético que no colisione con el real. Anotado en BACKLOG.

**Addendum (2026-07-26, mismo cierre):** `next build` corrido con el dev server parado →
**verde** (todas las rutas compiladas, `/admin` dinámica). Con esto COSTOS_ADMIN-QA-07 de la
sección /qa-spec pasa de PARCIAL a ✅ y el veredicto global del spec queda **APROBADO**.

## QA /qa-spec — PULIDO (2026-07-27)

**Veredicto:** APROBADO
**Verificación técnica:** typecheck EXIT 0 · tests 460/460 PASS (49 archivos) · build verde (server parado, `/admin` compiló dinámica)
**Método:** checkers independientes (Explore/haiku, read-only, maker≠checker) vs DoD de `docs/specs/active/PULIDO.md`. Los criterios en vivo (filtro fantasma, wordmark visible, resize real, impresiones en DB, 403, tabs renderizadas) ya están verificados en vivo abajo — no quedan pendientes.

| ID | Criterio | Resultado | Evidencia / Gap |
|----|----------|-----------|-----------------|
| PULIDO-QA-01 | Filtro fantasma: chip removible con fallback de label | ✅ PASS | `components/search/search-shell.tsx:340-342` (`etiquetaFallback`), `:380` (`etiquetaDeTag(slug, facetas) ?? etiquetaFallback(slug)`, sin `continue`) |
| PULIDO-QA-02 | Wordmark en ficha, `/cuenta`, `/votacion/[token]`, Mi negocio (lista+editor) | ✅ PASS | `components/shared/brand-header.tsx` + import/render en `app/lugar/[id]/page.tsx:100`, `app/cuenta/cuenta-client.tsx:19`, `app/votacion/[token]/page.tsx:70`, `app/mi-negocio/page.tsx:31`, `app/mi-negocio/[placeId]/page.tsx:49` |
| PULIDO-QA-03 | Resize a webp ≤1600px antes del POST de fotos | ✅ PASS | `app/mi-negocio/[placeId]/fotos-editor.tsx:24` (`LADO_MAYOR_MAX=1600`), `:34-53` (`redimensionar`, `canvas.toBlob('image/webp', 0.85)`), `:77` (`redimensionar(archivo)` antes de armar el FormData); `lib/storage/r2.ts` (`MAX_BYTES`, `TIPOS_PERMITIDOS`) sin tocar |
| PULIDO-QA-04 | Chat suma impresiones de los lugares citados/mostrados | ✅ PASS | `lib/ai/chat.ts:10` (import), `:179-186` (`registrarImpresiones(lugares.map(l => l.id))`, solo sobre `lugares` de `enriquecerCitas`, no sobre `idsNuevos` crudo) |
| PULIDO-QA-05 | `PATCH /content`: ownership antes que forma → 403 no 400 | ✅ PASS | `lib/negocio/acciones.ts:38` (`export async function verificarDueno`), `app/api/mi-negocio/[placeId]/content/route.ts:2` (import), `:42-48` (chequeo antes del `safeParse` de línea 60+) |
| PULIDO-QA-06 | `/admin` en tabs, gate único, orden Cola/Precios/Suscripciones/Costos | ✅ PASS | `app/admin/page.tsx:35-36` (gate único) `:72-87` (`AdminTabs` con children ya renderizados); `app/admin/tabs.tsx:17-22` (orden, sin gate/fetch propio); sin rutas nuevas bajo `app/admin/*/page.tsx`; `cola-client.tsx`/`precios-client.tsx`/`suscripciones.tsx`/`costos.tsx` sin reescritura interna |
| PULIDO-QA-07 | Verificación técnica: typecheck + tests + build | ✅ PASS | Re-corridos por el orquestador (no confiando en la implementación): EXIT 0, 460/460, build verde con server parado |

## QA manual — PULIDO en vivo (2026-07-27)

**Veredicto:** PASS 7/7 en vivo. Typecheck (EXIT 0), tests (460/460) y `next build` (con el
dev server parado) todos verdes — `/admin` compiló como ruta dinámica, sin errores.
**Método:** Playwright MCP contra `https://adondesalimos.ngrok.app` + consultas directas al
Postgres de dev (Docker, 5439) para verificar/revertir estado. Cuentas: `frodriguez.este@gmail.com`
(admin+dueño de Kansas+premium), `juan@gmail.com` (free, no dueño).

| ID | Caso | Resultado | Evidencia |
|----|------|-----------|-----------|
| PULIDO-01 | `/?t=fiesta-tematica` (tag sin lugares) | ✅ PASS | Aparece chip "Quitar Fiesta tematica" (fallback de label); clic navega a `/` sin el tag |
| PULIDO-02 | Wordmark fuera del Home | ✅ PASS | Presente y clickeable a `/` en ficha (Kansas), `/cuenta`, `/mi-negocio` (lista y editor) y `/votacion/[token]` público; headers propios de cada página intactos |
| PULIDO-03 | Subir foto de celular (~4 MB) en Mi negocio | ✅ PASS | JPEG de prueba 3000×2000/267 KB → subido como `.webp` de **17,5 KB** (`Content-Type: image/webp`, verificado con `curl -I` sobre la URL de R2). Foto de prueba borrada al terminar |
| PULIDO-04 | Chat premium: pedir "una birra por Villa Crespo", recibir 3 cards | ✅ PASS | `place_impressions_daily.impressions` de los 3 lugares mostrados (70 30 Bar, Sigue al Conejo Blanco, La Ferneteria) subió a 1 tras el turno. Revertido a 0 al terminar |
| PULIDO-05 | `PATCH /content` de Kansas como juan (no dueño) con payload roto (`{estoNoEsUnCampoValido:123}`) | ✅ PASS | 403 `NO_AUTORIZADO` "No podés editar este lugar" (antes del fix hubiera sido 400) |
| PULIDO-06 | `/admin` como admin: tabs Cola/Precios/Suscripciones/Costos | ✅ PASS | Orden correcto, cada tab renderiza sus datos reales (cola con Kansas aprobado, precios editables, tabla de suscripciones, costos + Sugeridor de precio agrupado en la misma tab) |
| PULIDO-07 | `/admin` sin sesión | ✅ PASS | Sign-out confirmado con `GET /api/auth/get-session` → `null` (lección de INT-12); `/admin` → **404** |

**Nota de método:** el click sintético de Playwright (`browser_click`) no disparó el submit
del form del chat (`/chat`) pese a que el botón/chip aparecía habilitado — sin error de
consola, sin overlay bloqueando, sin request de red. Se resolvió despachando el click con
`element.click()` vía `page.evaluate`, que sí disparó el `POST /api/chat`. No es un bug de la
app (el mismo flujo funciona con click real del usuario); quedó como nota de método para la
próxima sesión de QA en `/chat` con Playwright.

**Limpieza:** foto de prueba borrada de R2 + `place_photos`; impresiones de los 3 lugares del
chat revertidas a 0; sesión de browser cerrada. Sin cambios de precio ni de `owner_plan`
persistentes — solo lectura en Precios/Suscripciones/Costos durante el recorrido.

---

## QA /qa-spec — CURADURIA (F1 + F2, parcial) (2026-07-27)

**Veredicto:** **APROBADO (F1 + F2)** — flujo humano completo verificado en vivo (2026-07-27,
Opus + Playwright, ver subsección "Verificación en vivo") y **Fer aprobó el piloto el 2026-07-27**
(CUR-QA-12 ✅). Con eso queda **habilitada F3** (corrida de las 44 zonas restantes) para una sesión
Opus nueva — modelo **Haiku** (recomendación aceptada). F3 abre su propia sección de QA al cerrar.
**Verificación técnica:** typecheck ✅ · tests 466/466 ✅ · build pendiente (server de Fer
levantado; se corre con el server parado — lección BUSQUEDA, `.next` compartido).
**Método:** dos checkers independientes (Explore read-only, haiku, maker≠checker) contra el DoD
de `docs/specs/active/CURADURIA.md` (F1 y F2), más verificación en vivo contra el Postgres local
tras correr el **piloto real** (`npm run curar villa-crespo quilmes`): 80 lugares, 129
sugerencias, US$0,22 con Haiku. Los criterios de flujo humano en `/admin` (aceptar → ficha/
búsqueda → chip) quedan para el piloto con Fer (decisión 11).

| ID | Criterio (DoD / QA manual del spec) | Resultado | Evidencia / Gap |
|----|-------------------------------------|-----------|-----------------|
| CUR-QA-01 | Migración `place_tag_suggestions` + settings aplica limpio; seed idempotente de los 2 settings | ✅ PASS | `drizzle/0010_wealthy_mad_thinker.sql` aplicada (`db:migrate` OK); tabla con enum `suggestion_status`, unique `(place_id,tag_id)`, índice por status (`lib/db/schema.ts`). `db:seed` inserta `curation.zone_quota`=40 y `ai.curation_model`=`claude-haiku-4-5` con `onConflictDoNothing` (`scripts/seed.ts`) |
| CUR-QA-02 | El batch respeta cuota/zona, selecciona por decisión 3, **excluye reclamo aprobado**, **no importa `lib/google/`** ni lee `google_place_id` | ✅ PASS | `lib/curation/seleccion.ts`: `publishedWhere` + zona primaria + `TIPO_RELEVANTE_CHIPS` + `NOT EXISTS` de claim aprobado + orden contacto→confidence + `.limit(cuota)`. Candado Google fijado por test (`lib/curation/__tests__/curation.test.ts`: cero imports `from '...lib/google'`, cero `google_place_id`/`googlePlaceId`) |
| CUR-QA-03 | Toda sugerencia con `evidence` + `source_url`, o marcada sin evidencia; una corrida nueva no pisa `accepted`/`rejected` | ✅ PASS | Piloto en DB: 129 sugerencias, **70 con evidencia + URL** (los 70 con cita tienen URL), 59 sin evidencia (`evidence` null). `lib/curation/suggestions.ts` usa `onConflictDoNothing` sobre el unique. CUR-08 verificado en vivo: re-insertar un par existente devolvió `nuevas=0`, la fila quedó intacta (`evidence` NO pisado) |
| CUR-QA-04 | El script reporta procesados, sugerencias, tokens in/out y costo USD | ✅ PASS | Reporte real del piloto: `Lugares procesados: 80 · Sugerencias generadas: 129 · Tokensin 176011 out 9284 · Costo US$0.2224 (claude-haiku-4-5)`. `scripts/curar.ts` usa `calcularCostoUsd` (`lib/ai/logging.ts`) |
| CUR-QA-05 | Solo se sugieren Ambiente/Momento/Actividad (decisión 6); nada de Tipo/Cocina/Precio | ✅ PASS | Distribución en DB del piloto: `momento` 77 · `ambiente` 48 · `actividad` 4 · (tipo/cocina/precio = 0). Vocabulario acotado a `FACETAS_SUGERIBLES` en `lib/curation/sugeridor.ts` + validado en el borde (slug inventado se descarta) |
| CUR-QA-06 | Tab "Curaduría" (5ta) tras el gate `sesionAdmin` (no-admin → 404); endpoints con gate 403 | ✅ PASS (código + **vivo**) | `app/admin/page.tsx` (`sesionAdmin` + `notFound()`) + `tabs.tsx` sin segundo gate. **En vivo (CUR-02):** `/admin` deslogueado → 404; logueado como `pepe@gmail.com` (no-admin) → 404; `GET /api/admin/curaduria?zona=…` con sesión no-admin → **403** `FORBIDDEN`. Admin (`frodriguez.este@gmail.com`) sí entra (200) |
| CUR-QA-07 | Aceptar escribe `place_tags` `source='admin'`; rechazar no toca `place_tags`; corregir tildar/destildar; Precio opcional default "no sé" | ✅ PASS (código + **vivo**) | `lib/curation/acciones.ts` verificado contra DB en vivo. **Aceptar (CUR-03):** Salgado Alimentos → `tranqui` quedó `place_tags source='admin'`, sugerencia `accepted`+`reviewed_at`. **Rechazar (CUR-04):** McDonald's → 3 sugerencias `rejected`, `place_tags` sin cambios (solo `restaurante`/import). **Tildar:** Cafe Crespín → se agregó `tranqui` (no sugerido) como admin. **Destildar:** Parrilla Julio → destildé `cena` pre-tildada → `place_tags` con `almuerzo`/admin y **sin** `cena`; sugerencias `almuerzo=accepted`, `cena=rejected`. **Precio:** Cafe Crespín $$  → escribió `precio-2`/admin (default "No sé" no escribe nada) |
| CUR-QA-08 | Un tag aceptado aparece en la ficha y filtra en la búsqueda sin deploy; el chip que depende se prende solo | ✅ PASS (**vivo**) | **Ficha:** `/lugar/<Salgado>` muestra "Tranqui" bajo "QUÉ VAS A ENCONTRAR". **Búsqueda:** `/?z=villa-crespo&t=tranqui` devuelve a Salgado con el chip de filtro "Tranqui" activo (Villa Crespo pasó de 0→1 en `tranqui`). **Chip (CUR-05):** curé Cafe Crespín = `cafe`(import)+`tranqui`+`precio-2` → el chip **`primera-cita`** [(bar/café/rest) AND (tranqui/romántico) AND precio-2] pasó de 0 matches (apagado) a **1 → visible bajo "Ver más"** sin deploy (BUSQUEDA dec. 25, conteo en runtime) |
| CUR-QA-09 | Lugar con reclamo aprobado: el batch lo saltea (CUR-06) | ✅ PASS | En vivo: de los 52 lugares con sugerencias, 0 tienen `place_claims status='approved'`. La exclusión es `NOT EXISTS` en la selección |
| CUR-QA-10 | Lugar sin web/redes: la sugerencia sale igual "sin evidencia" y la UI la distingue (CUR-07) | ✅ PASS (código + datos + **UI vivo**) | 37 de 80 lugares sin evidencia web; sus sugerencias quedan con `evidence` null. **En vivo:** McDonald's mostró sus 3 sugerencias (Kids friendly / Almuerzo / Cena) con el badge **"sin evidencia"** renderizado, distinguidas de las que tienen cita + link "fuente" |
| CUR-QA-11 | Re-import no pisa lo curado (`source='admin'` sobrevive) | ✅ PASS | Test nuevo en `lib/claims/__tests__/import-dueno.integration.test.ts`: una tag `source='admin'` en un lugar **sin** dueño sobrevive a `reemplazarTagsDeImport` (solo borra `source='import'`). 3/3 verde |
| CUR-QA-12 | Piloto (2 zonas) revisado con Fer antes de habilitar la corrida completa | ✅ PASS | **Fer aprobó el piloto el 2026-07-27** tras el recorrido en vivo (calidad ~68/70 fiel, velocidad OK). Se sigue con **Haiku** para la corrida completa (recomendación aceptada). Gate de F3 levantado |

### Verificación en vivo (piloto, Opus + Playwright, 2026-07-27)

Recorrido punta a punta contra `https://adondesalimos.ngrok.app` (server de Fer) + verificación
en el Postgres de dev tras cada acción. Cierra los criterios de flujo humano que no se declaran
por lectura de código. **Teclado-first:** `Enter` guarda + avanza y `R` rechaza + avanza —
ambos verificados (Salgado se aceptó con Enter, McDonald's se rechazó con R).

**Curaduría real hecha en la sesión** (queda en la DB — son decisiones reales, no descartables):

| Lugar | Acción | Resultado en DB |
|-------|--------|-----------------|
| Salgado Alimentos | Aceptar `tranqui` (Enter) | `place_tags` +`tranqui`/admin; sug. accepted |
| McDonald's | Rechazar (R) | 3 sug. rejected; `place_tags` intacta |
| Cafe Crespín | Aceptar desayuno/almuerzo/merienda + tildar `tranqui` + Precio $$ | +5 tags admin (`tranqui`,`precio-2`,3 momento) |
| Parrilla Julio | Aceptar `almuerzo`, destildar `cena` (Enter) | +`almuerzo`/admin; `cena` rejected, no escrita |

Estado final de la cola: **pending 120 · accepted 5 · rejected 4 = 129** (nada perdido).
`app_settings` sin tocar (`curation.zone_quota`=40, `ai.curation_model`=`claude-haiku-4-5`).

### Revisión de calidad del piloto (insumo del gate — decisión de Fer, CUR-QA-12)

**Fidelidad de la evidencia (70 sugerencias con cita):** ~**68/70 fieles** — la cita respalda el
tag. Dos claras a corregir/rechazar en la cola:
- **El buen sabor africano → `abre-domingos`** con cita *"Domingos, Lunes y Martes: Cerrado"* — la
  evidencia **contradice** el tag (el modelo citó bien pero concluyó al revés).
- **Diversion → `musica-en-vivo`** con *"SHOW EN VIVO DE DAMAS GRATIS"* — no es música en vivo
  (local de otro rubro). Estirón menor aparte: `wifi-trabajar` inferido de "CLAVE WIFI: …".

**Las 59 sin evidencia** son inferencia por nombre/categoría (tipo McDonald's). No es una
limitación del modelo sino de **cobertura de fetch**: 37 de 80 lugares no tienen web alcanzable
(Instagram bloquea scraping anónimo, sin sitio propio). Ahí ningún modelo agrega evidencia que la
web no dio.

**Distribución:** `momento` 77 · `ambiente` 48 · `actividad` 4. Actividad casi no se movió —
esperable: requiere que el sitio mencione la actividad explícitamente (música, juegos) y pocos lo
hacen. El despegue de Actividad del Tipo (decisión 6) es marginal con esta cobertura de fetch.

**Velocidad:** con las sugerencias pre-tildadas + evidencia inline + Enter/R, un lugar limpio se
resuelve en ~2-3 s (mirada + Enter); uno que necesita corrección, ~10-15 s. El objetivo de
5-10 s/lugar es realista.

**Recomendación Haiku vs Sonnet (la decide Fer):** el 70/129 con evidencia ya está ~97% fiel con
Haiku; la mitad débil es la sin-evidencia, que es un problema de **fetch/fuente que Sonnet no
arregla**. Subir a Sonnet (~3× costo, ~US$40 vs ~US$13 la corrida completa) compra poco. La
recomendación es **seguir en Haiku** para la corrida completa; el chequeo humano de 5-10 s/lugar
en la cola atrapa barato las contradicciones raras (swap por `ai.curation_model` sin deploy si Fer
prefiere Sonnet igual).

### Notas

- **F3 (corrida de las 46 zonas) no se ejecutó** a propósito: tiene gate de piloto (decisión 11).
  El batch y la cola están listos; falta el **OK explícito de Fer** sobre la calidad de arriba.
- **Datos del piloto persistidos** (120 sugerencias `pending` tras la sesión) — quedan en la DB de
  dev para que Fer termine de revisarlos en `/admin` → tab Curaduría. No se limpiaron.
- **Costo del piloto**: US$0,22 con Haiku para 80 lugares → proyección de la corrida completa
  (~1.840 lugares) ≈ US$5, consistente con la estimación del spec (~US$10-15, conservadora).

---

## QA de fase — CURADURIA F3 (corrida completa autónoma, Sonnet) (2026-07-27)

**Veredicto:** **APROBADO** — las 46 zonas procesadas con el batch autónomo (decisión 13); el
auto-apply de sugerencias con evidencia verificado en vivo contra la DB; cobertura medida y
documentada honestamente (decisión 12). **Modelo: Sonnet** (`claude-sonnet-5`, vía
`app_settings.ai.curation_model` — swap sin deploy).
**Verificación técnica:** typecheck ✅ · tests 468/468 ✅ (2 nuevos: `lib/curation/__tests__/auto-apply.integration.test.ts`) · **build pendiente** (server de Fer levantado; se corre con el server parado — lección BUSQUEDA, `.next` compartido).
**Método:** cambio de código (auto-apply en `guardarSugerencias`) + corrida por tandas
(canario + 5 tandas + re-curación de las 2 zonas piloto), verificación en Postgres tras cada
paso, y medición de cobertura con `scripts/cobertura-chips.ts` (reusa `countPlaces`, el mismo
motor que la home).

### Cambio de código (decisión 13)

`lib/curation/suggestions.ts` — `guardarSugerencias` ahora, **en una transacción**: (1) upsertea
las sugerencias con `onConflictDoNothing` sobre el unique `(place_id, tag_id)`; (2) de las
**recién insertadas con evidencia**, las escribe a `place_tags` (`source='admin'`,
`onConflictDoNothing`) y marca las sugerencias `accepted`; (3) las **sin evidencia** quedan
`pending`. Devuelve `{ nuevas, autoAplicadas }` para el reporte del batch.

- **Protección de lo ya revisado:** solo se auto-aplican las filas del `.returning()` (las que
  el `onConflictDoNothing` realmente insertó). Una sugerencia que ya existía —`accepted` o
  `rejected` por Fer en el piloto— **no** vuelve en `.returning()`, así que jamás se re-aplica.
- **Divergencia declarada de `guardarCuraduria`:** se reutiliza su criterio de **escritura** a
  `place_tags` (admin + `onConflictDoNothing`), pero **no** su `delete` previo de admin. Ese
  borrado sirve al "corregir/destildar" de la cola (reemplazo total); en la corrida autónoma
  **aditiva** borraría tags auto-aplicados en tandas anteriores de la misma zona.

| ID | Caso | Resultado | Evidencia |
|----|------|-----------|-----------|
| CUR-F3-01 | Test: con-evidencia → `place_tags` admin + `accepted`; sin-evidencia → `pending`, `place_tags` intacta | ✅ PASS | `auto-apply.integration.test.ts` (2 tests, contra DB real): split verificado + idempotencia (re-correr no re-aplica) |
| CUR-F3-02 | Auto-apply en vivo (canario Las Cañitas) | ✅ PASS | 40 lugares → 13 con evidencia → **13 `place_tags` admin + 13 `accepted`**, 52 sin evidencia → `pending`. Verificado en Postgres |
| CUR-F3-03 | Re-curación de zonas piloto no pisa lo revisado por Fer (decisión de la sesión) | ✅ PASS | Villa Crespo conserva **5 `accepted` + 4 `rejected`** (Haiku, piloto) exactos tras re-correr con Sonnet; 94 pares "ya existían (no se pisaron)"; Sonnet solo **agregó** (23 auto-aplicadas + 82 pending nuevas) |
| CUR-F3-04 | Batch idempotente | ✅ PASS | `onConflictDoNothing` sobre el unique; el test CUR-F3-01 re-corre y devuelve `nuevas=0, autoAplicadas=0`, estado idéntico |
| CUR-F3-05 | Reporte de tokens/US$ por corrida | ✅ PASS | Cada tanda reporta procesados, con/sin evidencia, nuevas, **auto-aplicadas**, pending, tokens y costo (`calcularCostoUsd`, pricing Sonnet $3/$15) |
| CUR-F3-06 | Cobertura: 9 chips objetivo × 46 zonas | ✅ PASS (documentado) | Ver matriz abajo. **5/9 chips prendidos** en ≥1 zona; **46/46 zonas** con ≥1 chip. Los 4 en 0 = dato base no curable (decisión 12) |

### Corrida — números globales

| Tanda | Zonas | Lugares | Sug. generadas | Auto-aplicadas | Pending (sin evi) | Costo US$ |
|-------|-------|---------|----------------|----------------|-------------------|-----------|
| Canario | las-canitas | 40 | 65 | 13 | 52 | 0,36 |
| 1 | adrogue…chacarita (9) | 360 | 787 | 218 | 569 | 3,46 |
| 2 | devoto…martinez (9) | 360 | 661 | 177 | 484 | 3,28 |
| 3 | merlo…palermo-hollywood (9) | 360 | 841 | 249 | 592 | 3,54 |
| 4 | palermo-soho…san-isidro (9) | 360 | 847 | 339 | 508 | 3,62 |
| 5 | san-justo…villa-urquiza (7) | 280 | 534 | 130 | 404 | 2,57 |
| 6 | villa-crespo + quilmes (re-cura) | 80 | 199 (94 ya existían) | 23 | 82 | 0,79 |
| **Total** | **46 zonas** | **~1.840** | **~3.934** | **1.149** | — | **17,62** |

**Estado final en DB:** `accepted` **1.154** (1.149 auto-aplicadas Sonnet + 5 del piloto manual
de Fer) · `rejected` **4** (piloto) · `pending` **2.811** (sin evidencia, disponibles para la
cola manual de `/admin`) · **`place_tags` `source='admin'`: 1.156** en **288 lugares**. Costo
real **US$17,62** (estimación del spec ~US$14-15 con Sonnet; +18%, sin anomalías — lineal ~US$0,38/zona).

### Cobertura — 9 chips objetivo × 46 zonas (DoD F3)

`scripts/cobertura-chips.ts` cuenta con `countPlaces` (motor real, `z=<zona>&t=<tags del chip>`);
"prendido" = ≥1 publicado, idéntico a lo que ve el usuario (BUSQUEDA decisión 25).

**Resumen por chip (zonas con resultados):**

| Chip objetivo | Zonas con resultados | Antes (baseline 2026-07-20) |
|---------------|----------------------|------------------------------|
| `salir-a-bailar` | **46/46** | ya vivo (boliche+dj, no requiere curaduría) |
| `cumpleanos` | **42/46** | 0 → **la curaduría lo prendió** (grupos-grandes + reserva-necesaria, Ambiente) |
| `after-office` | **10/46** | 0 → prendido (happy-hour, Momento) |
| `salida-con-chongo` | **2/46** | 0 → prendido (romántico + hasta-tarde) |
| `primera-cita` | **1/46** | 0 → prendido (Villa Crespo, piloto) |
| `salida-con-amigos` | 0/46 | bloqueado por `precio-2` (Precio) |
| `cena-familiar` | 0/46 | bloqueado por `bodegon` (Cocina) |
| `plan-tranqui` | 0/46 | bloqueado por `juegos-de-mesa` (Actividad) |
| `merienda` | 0/46 | bloqueado por `pasteleria` (Cocina) |

**Resultado producto: de 1/9 chips vivos → 5/9.** `cumpleanos` es el gran salto (0→42 zonas): sus
tags son Ambiente puro (`grupos-grandes` 78 lugares, `reserva-necesaria` 108), la faceta que
estaba al 0,9% y que este spec fue a llenar.

**Los 4 chips en 0 — dato base no curable (decisión 12, no bloquea):** ninguno depende de
Ambiente/Momento/Actividad faltante; cada uno exige un tag de una faceta que el batch **no** cura:

- **`salida-con-amigos`** = Tipo AND `grupos-grandes` AND **`precio-2`**. `precio-2` = **1 lugar**;
  Precio no lo sugiere el LLM (sin fuente automatizable, decisión "Qué NO es").
- **`plan-tranqui`** = Tipo AND `tranqui` AND **`juegos-de-mesa`**. `juegos-de-mesa` = **2 lugares**;
  Actividad que casi nadie publica en su web (el fetch no la encuentra → ningún modelo la infiere).
- **`merienda`** = `cafe` AND `merienda` AND **`pasteleria`**. `pasteleria` es **Cocina** (viene del
  import, decisión 6 no la toca) y tiene **0 lugares**.
- **`cena-familiar`** = `restaurante` AND **`bodegon`** AND `kids-friendly` AND `cena`. `bodegon` es
  **Cocina**, así que ANDea (achica) en vez de sumarse al Tipo: exige que un restaurante sea
  además bodegón, kids-friendly y de cena a la vez → intersección vacía.

Los dos últimos (`merienda`, `cena-familiar`) además son un **artefacto de diseño del chip**: la
Cocina en la lista de tags achica en vez de ampliar. No es un hueco de curaduría — se anota en
`BACKLOG` como refinamiento de la semilla de chips (redefinir sin la Cocina, o con Cocina en OR
con el Tipo). Fuera del scope de este spec.

> **Actualización (batch limpieza, 2026-07-27):** se aplicó el refinamiento — se sacó `pasteleria`
> de `merienda` y `bodegon` de `cena-familiar` en `lib/db/chips.ts` + reseed dirigido. Ambos chips
> pasaron de **0 a 45/46 y 44/46 zonas**. **Chips vivos: 5/9 → 7/9.** Quedan en 0 solo
> `salida-con-amigos` (`precio-2`) y `plan-tranqui` (`juegos-de-mesa`), que sí son dato base no
> curable. Medido con `scripts/cobertura-chips.ts`.

### Notas de F3

- **Cierre de la cola — bulk-accept de las `pending` (decisión de Fer, 2026-07-27, post-cierre).**
  Tras el cierre del spec, Fer revisó parte de la cola a mano (aceptó ~460, rechazó ~0) y decidió
  **aceptar en masa el resto** en vez de revisar 2.356 a mano una por una. Se marcaron todas las
  `pending` como `accepted` y se escribieron a `place_tags` (`source='admin'`) — mismo mecanismo
  que el auto-apply, en transacción. Estado final de la cola: **`accepted` 3.965 · `rejected` 4 ·
  `pending` 0**; `place_tags` `source='admin'` **3.967 en 1.202 lugares** (era 288). Se aceptó
  también lo **sin evidencia** (inferencia por nombre/categoría): saldo positivo para una app aún
  no productiva y **reversible** (`evidence IS NULL` + `source='admin'` las identifica).
  Impacto en cobertura: `after-office` 10→**46/46** zonas y `cumpleanos` 42→**46/46**; siguen
  **5/9** chips vivos (el bulk no prende chips nuevos — los 4 en 0 dependen de datos no curables).
- **Distribución de auto-aplicadas por faceta** (las 1.149 con evidencia): dominan Momento y
  Ambiente; Actividad casi no se movió (mismo hallazgo del piloto — requiere que el sitio la
  mencione explícitamente, y pocos lo hacen).
- **Zonas piloto (Villa Crespo + Quilmes)** se re-curaron con Sonnet de forma **aditiva** (decisión
  de la sesión): sus datos Haiku (accepted/rejected/pending de Fer) quedan intactos; Sonnet solo
  sumó lo nuevo con evidencia. No se borró nada del piloto.
- **`ai.curation_model`** quedó en `claude-sonnet-5` (era `claude-haiku-4-5`). Revertir es el mismo
  UPDATE. El seed de `lib/curation/settings.ts` sigue en Haiku (fallback) — manda el runtime.

---

## QA /qa-spec — ABIERTO_AHORA F1 (chip «Para ahora») (2026-07-30)

**Veredicto:** **APROBADO** (2026-07-30). Código y datos ✅, gate técnico ✅ y **QA en vivo ✅** —
ver § *QA en vivo* más abajo. Dos casos (AHORA-02 madrugada y AHORA-03 domingo) quedan **cubiertos
por test unitario y por dato, no verificados en pantalla**, por decisión explícita de Fer de no
mover el reloj ni la fecha del sistema: la limitación está escrita, no tapada.
**Verificación técnica:** typecheck ✅ · tests ✅ **497/497** (52 archivos) · build ✅ — corrido al
final de la sesión con el dev server parado, que Fer bajó a pedido (comparten `.next`, lección
BUSQUEDA): `✓ Compiled successfully in 6.1s`, 12/12 páginas estáticas, cero warnings.
**Método:** dos checkers independientes (Explore read-only, haiku, maker≠checker) contra el DoD de
`docs/specs/active/ABIERTO_AHORA.md` § F1, más verificación en vivo contra el Postgres de dev
(conteos por franja con `countPlaces` y `getOccasionChips` a horas fijas) para lo que el código no
alcanza a probar. **F2 no se verifica: no está implementada** (gateada, decisión 11 — 1 lugar con
horarios propios contra los 50 que pide el gate).

| ID | Criterio | Resultado | Evidencia / Gap |
|----|----------|-----------|-----------------|
| AHORA-QA-01 | `lib/search/ahora.ts` existe y es el **único** módulo que mapea hora → tags (verificable por grep) | ✅ PASS | `lib/search/ahora.ts:49-55` (`FRANJAS`) y `:61-69` (`franjaActual`). Grep de `FRANJAS` en el repo: **una sola** definición; los únicos consumidores son `lib/search/chips.ts:95` y los dos tests. Nadie más mapea horas a `desayuno/almuerzo/merienda/cena/trasnoche/hasta-tarde` |
| AHORA-QA-02 | `franjaActual` cubre las 24 h sin huecos ni solapamientos, en TZ AR, y es puro respecto de `now` | ✅ PASS | Reusa `partesEnAR` (`lib/negocio/horarios.ts:143`), no reimplementa la TZ: `ahora.ts:1,62`. Sin `new Date()` adentro. Cobertura verificada **minuto a minuto** (1.440 casos) en `__tests__/ahora.test.ts:64-70`; la propiedad sale de la estructura (franjas ordenadas y la primera en el minuto 0, `ahora.test.ts:103-108`) |
| AHORA-QA-03 | La madrugada (00:00–05:59) devuelve **los dos** tags (`trasnoche`, `hasta-tarde`) | ✅ PASS | `ahora.ts:50`. Test `ahora.test.ts:90-92`. En vivo: la unión da **176** publicados (contra 44 de `trasnoche` solo), idéntico a la evidencia del spec |
| AHORA-QA-04 | Ninguna franja incluye `abre-domingos` (decisión 7: misma faceta ⇒ OR ⇒ ensancharía) | ✅ PASS | Tests `ahora.test.ts:79-88` (el caso del domingo al mediodía y la invariante sobre `FRANJAS`). En vivo, domingo 12:00 AR → chip con `[almuerzo]` y nada más |
| AHORA-QA-05 | La home muestra el chip **primero**, con el rótulo «Para ahora»; en ningún lugar de la UI aparece "abierto" asociado a este chip | ✅ PASS (código) | `lib/search/chips.ts:144` (`home: [...chipAhora, ...home.map(limpiar)]`), rótulo en `ahora.ts:30`. Grep en `components/` y `app/`: la única mención de "abierto" es el estado abierto/cerrado de los horarios del dueño en la ficha, sin relación. Test del rótulo en `ahora.test.ts:98-101`. **El render se confirma en vivo (AHORA-01)** |
| AHORA-QA-06 | Tocar el chip escribe los tags en la URL y queda activo; volver a tocarlo los saca, sin cambios en `OccasionChipsRow` | ✅ PASS (código) | El chip viaja con la forma `{slug, name, tags, count}` (`chips.ts:140`), que `components/search/occasion-chips.tsx:37-68` trata genéricamente (`alternar(chip.tags)`, `aria-pressed`). Ese archivo **no tiene cambios**. **El gesto se confirma en vivo (AHORA-01/04/05)** |
| AHORA-QA-07 | Si la franja actual devuelve 0 lugares publicados, el chip **no se dibuja** | ✅ PASS | `chips.ts:96,138-141`: el conteo sale del mismo `countPlaces` que los chips de Ocasión y `0 ⇒ []`. Test de coherencia por franja en `chips.integration.test.ts:116-133` (chip dibujado ⇔ su franja tiene lugares) — cubre AHORA-09 sin tocar datos. Hoy las 5 franjas dan > 0: cena **670** · almuerzo **605** · desayuno **272** · merienda **251** · madrugada **176** |
| AHORA-QA-08 | `lib/search/query.ts`, `lib/search/params.ts` y `components/search/occasion-chips.tsx` sin cambios (decisión 5) | ✅ PASS | `git diff HEAD` de los tres: vacío. El chip se inyecta con la forma de un chip normal, así que no hizo falta tocar ni el motor ni el componente |
| AHORA-QA-09 | `select active from tags where slug = 'abierto-ahora'` = `false`; no aparece en el sheet ni en las cards, y sus 20 filas de `place_tags` siguen | ✅ PASS | `UPDATE tags SET active = false WHERE slug='abierto-ahora'` → `UPDATE 1`, `active = f`. `place_tags` con ese tag: **20** (ocultar ≠ borrar). `getFacetCatalog()` devuelve Momento con **8** tags, sin él. La ficha de `e8d2a7fe…` (uno de los 20) lista sus otros 8 tags y no ese. `?t=abierto-ahora&z=palermo` sigue devolviendo 20 lugares: `filtrosDeTags` lo ignora, el link viejo no rompe |
| AHORA-QA-10 | Bordes de la decisión 3 (05:59/06:00/10:59/11:00/15:29/15:30/19:59/20:00/23:59 + medianoche) con `Date` fijo | ✅ PASS | `__tests__/ahora.test.ts:42-61`: los 10 bordes, con UTC fijo del 2024-01-01 (AR = UTC−3) para no depender del reloj ni de la TZ de la máquina. Mismo patrón que `horarios.test.ts` |
| AHORA-QA-11 | El comentario de `lib/db/taxonomy.ts` explica por qué el tag queda sembrado pero inactivo, y es **coherente con el código** | ✅ PASS | `lib/db/taxonomy.ts:157-167`. Verificado que lo que afirma es cierto: `filtrosDeTags` filtra `active` (`lib/search/query.ts:146`), `getFacetCatalog` también (`lib/search/catalog.ts:87`), y las queries de tags de cards y ficha (`lib/search/query.ts:523`, `lib/lugar/query.ts:188`). Bonus no buscado: el sugeridor de curaduría también filtra `active` (`lib/curation/query.ts:155`), así que dejó de poder sugerirlo — el hallazgo de `LECCIONES_APRENDIDAS` § tag imposible |
| AHORA-QA-12 | typecheck + tests + build verdes | ✅ PASS | `npx tsc --noEmit` limpio · `vitest run` 497/497 en 52 archivos · `npm run build` con el server parado: `✓ Compiled successfully in 6.1s`, 12/12 estáticas, sin warnings |

### QA en vivo (2026-07-30, 19:39–20:01 AR — `https://adondesalimos.ngrok.app`, MCP de Playwright)

Sesión de browser sobre el dev server que levanta Fer, viewport **mobile 390×844**, zona **Palermo
Soho** (1.095 lugares publicados sin filtros). **Sin login**: la home y la ficha son públicas.

**Se aprovechó el cruce de franja de las 20:00**: el recorrido arrancó a las 19:39 AR (franja
`merienda`) y terminó a las 20:00:57 (franja `cena`), así que **el borde 19:59 → 20:00 de la
decisión 3 quedó verificado en pantalla**, sin tocar el reloj ni redeployar: el mismo chip cambió
de tags solo.

| ID | Caso | Resultado | Evidencia |
|----|------|-----------|-----------|
| AHORA-01 | El primer chip dice «Para ahora»; tocarlo escribe la franja en la URL, queda activo y achica | ✅ PASS | **19:39 AR (merienda):** la fila es `Para ahora` · `Salida con chongo` · `Salir a bailar` · `After office` · `Tomar algo` · `Ver más` → el chip de franja es el **primero** y la home quedó en **1 + 4** (§ Notas). Tocarlo → `?z=palermo-soho&t=merienda`, `aria-pressed="true"`, listado **20 → 5** cards. **20:00:57 AR (cena):** el **mismo** chip → `?z=palermo-soho&t=cena`, activo, **35** lugares (`Ver 35 lugares` en el sheet), primera página de 20. El spec pide 21:30 → `cena`; se verificó la misma franja a las 20:00, su primer minuto |
| AHORA-02 | 02:00 AR: aplica `trasnoche` **y** `hasta-tarde`, resultado = unión (no intersección) | ⏳ **no verificado en pantalla** | **Decisión de Fer en la sesión**: no mover el reloj del sistema (`Set-Date` pide admin y el salto arriesga sesiones de better-auth / TLS de ngrok); se hará una noche que le toque programar a esa hora. Cubierto por `ahora.test.ts:90-92` y por dato (unión = **176** publicados contra 44 de `trasnoche` solo). Riesgo residual acotado: es la única franja con dos tags, y el OR dentro de faceta que la sostiene es el mismo de la decisión 13 de BUSQUEDA, ya ejercitado en vivo por los chips multi-tag existentes (`Salida con chongo`, `After office`) |
| AHORA-03 | Domingo al mediodía: aplica solo `almuerzo`, **sin** `abre-domingos` | ⏳ **no verificado en pantalla** | Verlo requiere mover la **fecha** (hoy fue jueves), no la hora — el caso de mayor riesgo de entorno y el de menor información nueva: `franjaActual` **no lee el día de la semana en ningún punto** (`ahora.ts:61-69`, solo `minutos`), así que ninguna franja puede incluir `abre-domingos` ningún día. Invariante testeada sobre `FRANJAS` (`ahora.test.ts:79-88`) |
| AHORA-04 | Tocar el chip y después atrás: vuelve en **un solo paso** | ✅ PASS | Desde `?z=palermo-soho&t=merienda`, un `history.back()` → `?z=palermo-soho`, chip `aria-pressed="false"`, 20 cards. Sin doble paso: la decisión 29 de BUSQUEDA no tuvo regresión |
| AHORA-05 | Tocar el chip dos veces: saca los tags y queda inactivo | ✅ PASS | Toque 1 → `?z=palermo-soho&t=merienda` (activo, 5 cards); toque 2 → `?z=palermo-soho` (inactivo, 20 cards). El toggle es el de `OccasionChipsRow`, sin cambios en ese archivo |
| AHORA-06 | El link compartido devuelve la **misma** búsqueda, no la franja del que lo abre | ✅ PASS | Se abrió `?z=palermo-soho&t=cena` **durante la franja merienda** (19:39): devolvió la búsqueda de **cena** (35 lugares, `Cena` marcado en el sheet de Momento) y «Para ahora» quedó **inactivo** — su franja era otra. La URL guarda tags resueltos, no "ahora" (decisión 6) |
| AHORA-07 | Sheet de filtros → Momento: `Abierto ahora` no figura | ✅ PASS | La faceta abre con **8** tags exactos: Hasta tarde · Abre domingos · Desayuno · Almuerzo · Merienda · Cena · Trasnoche · Happy hour. Sin el retirado. Captura: `.playwright-mcp/ahora-07-momento-8-tags.png` |
| AHORA-08 | Ficha de uno de los 20 lugares que tenían el tag | ✅ PASS | `/lugar/e8d2a7fe-df36-4f92-94ff-07b924d76b87` (**La Continental**): § «Qué vas a encontrar» lista sus **8** tags activos (Hasta tarde, Abre domingos, Desayuno, Almuerzo, Cena, Trasnoche, Pizza, Restaurante) y **no** el retirado. En la base el lugar sigue con **9** filas de `place_tags`, la novena `abierto-ahora` con `active = f`: ocultar ≠ borrar, verificado por los dos lados. Ver el hallazgo AHORA-OBS-1 abajo |
| AHORA-09 | Franja sin lugares ⇒ el chip no se dibuja | ✅ cubierto por test | `chips.integration.test.ts:116-133`. En vivo exigiría vaciar tags en una copia de la base; no se hizo (las 5 franjas dan > 0 hoy) |
| AHORA-10 | Los 8 bordes + medianoche caen en la franja correcta | ✅ PASS (tests) **+ 1 borde en vivo** | `ahora.test.ts:42-61` con `Date` fijo. Además el borde **19:59 → 20:00** se vio en pantalla: `merienda` a las 19:39 y `cena` a las 20:00:57, mismo chip, sin recarga forzada ni deploy |
| Copy (decisión 2) | En ninguna pantalla asociada al chip aparece la palabra "abierto" | ✅ PASS | Barrido de `document.body.innerText` en la home con y sin filtros, y con «Ver más» **abierto** (16 chips + `Ver menos`): cero coincidencias de `/abierto/i`. El rótulo es «Para ahora» en las dos franjas vistas, y el chip aparece **una sola vez** (no se duplica en el "ver más") |
| Layout mobile | La home con 1 + 4 chips no se rompe a 390px | ✅ PASS | Envuelve en 3 filas prolijas (`Para ahora` + `Salida con chongo` / `Salir a bailar` + `After office` / `Tomar algo` + `Ver más`), sin desbordes ni scroll horizontal. **No se propone cambio**: el 4º chip de Ocasión sigue en la home, que era el punto de no descontar. Captura: `.playwright-mcp/ahora-01-home-merienda-390.png` |

**Bonus no buscado — la hora es del server, comprobado por accidente:** el browser de Playwright
corría con el reloj desfasado (`new Date()` en la página daba **07:39** AR, que es franja
`desayuno`) y aun así el chip aplicó **`merienda`**, la franja del **server**. Es exactamente la
decisión 10 —el cliente no lee el reloj, el chip viaja como prop— verificada sin haberlo planeado.

#### Hallazgos

| ID | Severidad | Qué |
|----|-----------|-----|
| AHORA-OBS-1 | Observación (no es bug, **no requiere acción**) | La **ficha** sí muestra el texto «Abierto ahora», pero **no es el tag retirado ni el chip de franja**: es el bloque en vivo de Google de FICHA (aparece junto a `4,0 (3686)`, «Ver horarios de la semana» y la atribución "Horarios y calificación · Google"). O sea, viene de la fuente **exacta**, así que no miente y no viola la decisión 2, que gobierna el copy del chip *mientras la fuente sea la franja*. Se registra porque es **el rótulo que la decisión 13 quiere para el chip en F2**: cuando F2 abra, «Abierto ahora» ya va a existir en la ficha con otro dueño, y conviene decidir a propósito si el chip lo comparte o no |

### Notas

- **El retiro del tag quedó declarado en código** (`TAGS_RETIRADOS` en `lib/db/taxonomy.ts` +
  `npm run db:retiros`), en el mismo día y a raíz de la retro: como `active` es una columna que el
  seed no pisa, el retiro vivía solo en la base y un reset lo revivía en silencio. Se hizo
  `npm run backup:db` antes de tocar la base (`backups/adondesalimos_2026-07-30_074023.sql.gz`).
- **La home pasó a 1 + 4 chips**, no 4: el chip de franja se antepone **sin descontar** de los 4 de
  Ocasión (decisión 6 de BUSQUEDA). Lo contrario habría sacado un chip de Ocasión de la home a
  ciertas horas — una regresión silenciosa a cambio de nada. `CHIPS_EN_HOME` ahora se lee como "4
  chips **de Ocasión**", y el test de la home se ajustó a eso (`chips.integration.test.ts`).
- **Los conteos por franja no se movieron** desde que se escribió el spec (670/605/272/251/176), así
  que ninguna franja nace apagada por la decisión 25.

---

## QA de fase — FAVORITOS F1 (guardar lugares) (2026-07-30)

**Veredicto:** APROBADO (F1)
**Verificación técnica:** typecheck ✅ · tests ✅ **513/513** (15 nuevos en
`lib/favoritos/__tests__/favoritos.integration.test.ts`) · build ⏳ pendiente (se corre con el dev
server bajo — comparten `.next`).
**Método:** tests de integración contra el Postgres local + **QA en vivo con Playwright** sobre
`https://adondesalimos.ngrok.app`, con dos usuarios reales (`frodriguez.este@gmail.com` premium y
`pepe@gmail.com` free) y verificación por `psql` de cada efecto en la base.
**Alcance:** F1 = schema + gate + guardar/sacar desde card y ficha + métrica `saves`. Los IDs que
dependen de `/mis-lugares` o de crear listas son de F2 y están marcados como tales.
**Backup previo a la migración:** `backups/adondesalimos_2026-07-30_203627.sql.gz` (5,0 MB).
**Canario de curaduría antes y después:** 3.967 tags `place_tags source='admin'` — intacto.

| ID | Caso | Resultado | Evidencia |
|----|------|-----------|-----------|
| FAV-01 | Deslogueado, tocar guardar en una card | ✅ PASS | Va a `/login?callbackUrl=%2F%3Fz%3Dvilla-crespo%26t%3Dbar` — conserva **zona y tag**. Tras loguear vuelve exactamente a `?z=villa-crespo&t=bar` |
| FAV-02 | Free, primer guardado de la vida | ✅ PASS | Un tap: nace `Mis lugares` (`is_default=t`) con el lugar adentro, y la URL **sigue en la home** (el botón no dispara el link de la card). `place_lists` pasó de 0 a 1 fila |
| FAV-03 | Free, guardar/estado en la ficha | ✅ PASS | La ficha del mismo lugar abre con `aria-pressed=true`: card y ficha coinciden. Ciclo guardar→sacar completo por UI en la ficha, sin recargar |
| FAV-04 | Free, crear una segunda lista por API | ⏭️ F2 | `POST /api/listas` es de F2. Lo que F1 deja testeado es el número que ese endpoint va a consultar: `maxListasDelUsuario` = 1 (free) / 10 (premium), desde el dueño único |
| FAV-05 | Premium, elegir lista al guardar | ⏭️ F2 | El sheet es de F2 y **no puede darse en F1**: sin endpoint de crear listas, nadie tiene más de una. El camino server ya funciona: test "premium con dos listas guarda en la que se le indica" |
| FAV-06 | Premium con 2 listas → `plan='free'` | ✅ PASS | En pantalla desaparece el guardado que vivía solo en la lista extra (`Shapo Bar Palermo`); en la base **siguen las 2 listas y los 6 ítems**. Ninguna fila borrada |
| FAV-07 | Volver a `premium` | ✅ PASS | Reaparece intacto sin tocar una fila |
| FAV-08 | Guardar el mismo lugar dos veces | ✅ PASS | Índice único `(list_id, place_id)` + `onConflictDoNothing`: una sola fila, sin error. La segunda devuelve `nuevo=false` y **no** vuelve a sumar `saves` |
| FAV-09 | Sacar un lugar | ✅ PASS | Desaparece de la lista, el botón vuelve a no-guardado sin recargar, y `saves` **no baja** (quedó en 2 tras guardar-sacar-guardar-sacar) |
| FAV-10 | Lugar despublicado sigue en la lista | ⏭️ F2 | La pantalla que lo muestra es `/mis-lugares`. F1 ya cumple la mitad server: `guardarLugar` valida contra `places` y **no** contra `publishedWhere` (decisión 16), así que un despublicado se puede re-guardar; y nada filtra `place_list_items` por visibilidad |
| FAV-11 | `listId` de otro usuario en `POST /api/favoritos` | ✅ PASS | **404** `LISTA_NO_ENCONTRADA` y **cero** filas escritas en la lista ajena (siguió en 0 ítems). Idem `DELETE`. El destino nunca sale del payload: sale de `listasVisibles(userId)` |
| FAV-12 | Renombrar / borrar la default por API | ⏭️ F2 | No existen esos endpoints todavía. `is_default` ya está modelado con índice único parcial |
| FAV-13 | Guardar 5 lugares y revisar `place_impressions_daily` | ✅ PASS | 5 filas con `saves=1` del día. Test que enumera las columnas de la tabla: `date, detail_views, featured_impressions, impressions, place_id, saves` — **ninguna con PII**, y falla si alguien agrega `user_id` |
| FAV-14 | Página con 20 cards, algunas guardadas | ✅ PASS | **Cero** requests a `/api/favoritos` al cargar: el estado viene server-side. Con scroll infinito, 40 cards y **1** request a `/api/search`, que ahora devuelve `guardados` |
| FAV-15 | Eliminar la cuenta | ✅ PASS (indirecto) | `place_lists.user_id` tiene `ON DELETE CASCADE` y `place_list_items.list_id` también. Los tests borran usuarios con `db.delete(users)` en cada corrida y no hay violación de FK: si no cascadeara, fallarían |
| FAV-16 | Extra — el estado respeta el recorte de plan | ✅ PASS | Lo guardado en una lista escondida **no** cuenta como guardado y **no** se puede escribir. Sin esto el botón mostraría "guardado" algo que `sacarLugar` no podría sacar |
| FAV-17 | Extra — el botón está fuera del `<Link>` (decisión 6) | ✅ PASS | Verificado en el DOM en vivo sobre las 20 cards: `button.closest('a') === null` en todas. Un tap en el botón no navega a la ficha |
| FAV-18 | Extra — cards paginadas nacen con estado | ✅ PASS | Se guardó un lugar de la **página 2**, se recargó y se scrolleó: aparece guardado. Era el riesgo concreto que marcaba el pre-vuelo P1 |
| FAV-19 | Extra — payloads inválidos y lugar inexistente | ✅ PASS | `placeId` no-UUID → 400 `INVALID`; UUID que no existe → 404 `LUGAR_INEXISTENTE`. Ningún detalle interno filtrado al cliente |

**Hallazgo transitorio, no es bug:** el primer `DELETE /api/favoritos` por UI devolvió **503**. Fue
el dev server compilando el handler por primera vez (el log de consola muestra el rebuild de Fast
Refresh inmediatamente antes). Reintentado con la ruta ya compilada: 200 y `sacado:true`, y el ciclo
completo por UI anduvo. No se reprodujo.

**Un test existente falló y se actualizó a propósito:** `impressions.integration.test.ts` § "no
guarda ningún dato por usuario" enumera las columnas exactas de `place_impressions_daily` y avisó
del `saves` nuevo. Es justo para lo que existe: se agregó `saves` a la lista esperada, no se relajó
el test.

**Limpieza post-QA:** se borraron las listas e ítems de prueba, `pepe@gmail.com` volvió a `free` y
los `saves` de QA se pusieron en 0 (hoy nació la columna, así que todo `saves>0` era de prueba y
habría ensuciado un histórico que no se puede reconstruir).

---

## QA /qa-spec — FAVORITOS F2 (ver y organizar lo guardado) (2026-07-31)

**Veredicto:** APROBADO — **cierra el spec entero** (F1 + F2)
**Verificación técnica:** typecheck ✅ · tests ✅ **523/523** (10 nuevos de F2 en
`lib/favoritos/__tests__/favoritos.integration.test.ts`) · build ✅
**Método:** 3 checkers independientes (Explore read-only, haiku, maker≠checker) contra el DoD de
`docs/specs/done/FAVORITOS.md` (movido a `done/` al cerrar), **más QA en vivo con Playwright** sobre
`https://adondesalimos.ngrok.app` con `pepe@gmail.com` alternando `free`/`premium` y verificación
por `psql` de cada efecto en la base.
**Alcance:** F2 = `/mis-lugares` + crear/renombrar/borrar listas + sheet de destino + botón en el
chat. Los cuatro IDs que F1 dejó en ⏭️ (**FAV-04, FAV-05, FAV-10, FAV-12**) se **reusan**, no se
renumeran: son los mismos criterios, ahora verificables.
**Canario de curaduría antes y después:** 3.967 tags `place_tags source='admin'` — intacto.
**Backup:** `adondesalimos_2026-07-30_203627.sql.gz` (0 días al empezar; F2 no trae migración).

| ID | Caso | Resultado | Evidencia |
|----|------|-----------|-----------|
| FAV-04 | Free, crear una segunda lista por API | ✅ PASS | `POST /api/listas` → **403** `LIMITE_LISTAS` ("Con el plan free tenés una sola lista"). El free sin ninguna lista **tampoco** puede: la default reserva su lugar del cupo (`listasOcupadas`), si no gastaría su única lista en una con nombre y el tap se quedaría sin destino |
| FAV-05 | Premium con 2 listas, guardar eligiendo | ✅ PASS | El tap abre el sheet con las dos opciones y el lugar cae en la elegida (`Birras`), verificado en la base. Con **una sola** lista el sheet no aparece: sigue siendo un tap |
| FAV-10 | Lugar despublicado (`operating_status='closed'`) | ✅ PASS | Sigue en la lista, atenuado, con "Ya no está disponible" y **sin `<a>`** en el DOM; la ficha del mismo id da **404**. La lista nunca se filtra por visibilidad |
| FAV-12 | Renombrar / borrar la default por API | ✅ PASS | `PATCH` y `DELETE /api/listas/[id]` → **403** `LISTA_DEFAULT`. Un id inexistente → **404** `LISTA_NO_ENCONTRADA` |
| FAV-20 | `/mis-lugares` sin sesión | ✅ PASS | **307** → `/login?callbackUrl=/mis-lugares` (curl sin cookies) |
| FAV-21 | Link en el `AccountMenu` | ✅ PASS | "Mis lugares" → `/mis-lugares`, inmediatamente después de "Mis votaciones" |
| FAV-22 | Premium crea una lista desde la página | ✅ PASS | "Nueva lista" → nombre → aparece la sección con su conteo y sus acciones. El botón **no existe** para free |
| FAV-23 | Nombre de lista repetido | ✅ PASS | "Mis lugares" sobre una lista que ya se llama así → error inline "Ya tenés una lista con ese nombre", sin tocar la base. Case-insensitive (índice `lower(name)`) |
| FAV-24 | Renombrar desde la página | ✅ PASS | "Birras" → "Birras del finde", el form se cierra y el título se actualiza |
| FAV-25 | Borrar una lista desde la página | ✅ PASS | Pide confirmación diciendo cuántos lugares se van; al confirmar desaparece y **cero** ítems huérfanos (cascade). La default no muestra ninguna de las dos acciones |
| FAV-26 | Sacar un lugar desde `/mis-lugares` | ✅ PASS | `70 30 Bar` estaba en dos listas: se sacó de la default y **siguió en la otra**. El botón lleva `listId`, así que saca de esa lista y no de todas |
| FAV-27 | Guardar desde el chat IA | ✅ PASS | Las 3 cards del stream nacen con estado y **una sola** request: `GET /api/favoritos?ids=a,b,c`. El lugar ya guardado aparece como tal; el tap abre el sheet y guarda en la lista elegida |
| FAV-28 | Sheet en la ficha | ✅ PASS | Mismo componente y mismas dos opciones desde `/lugar/[id]`: el sheet anda en las **tres** superficies (card, ficha, chat) |
| FAV-29 | Premium con 2 listas → `plan='free'` (regresión FAV-06/07 sobre la pantalla nueva) | ✅ PASS | `/mis-lugares` muestra **solo la default**, sin "Nueva lista" y sin acciones de renombrar/borrar, con el teaser premium. En la base **siguen las 2 listas y los 4 ítems**. Volver a premium las devuelve intactas |
| FAV-30 | Tocar por API una lista escondida por bajar de plan | ✅ PASS | `PATCH` y `DELETE` → **404** `LISTA_NO_ENCONTRADA` y la lista sigue intacta. Ajena, inexistente o escondida se contestan igual: para ese usuario no existe |
| FAV-31 | Premium hasta el tope de listas | ✅ PASS (test) | Crea hasta `favoritos.max_listas_premium` (10, contando la default) y la siguiente da `LIMITE_LISTAS`. Lock `FOR UPDATE` sobre la fila del usuario: contar-y-después-insertar no se puede pasar con dos requests simultáneas |
| FAV-14 | Regresión: cero requests al cargar la búsqueda | ✅ PASS | Con el cambio a `estadoDeFavoritos` (guardados **+** listas en una resolución), la home sigue sin pegarle a `/api/favoritos` ni a `/api/listas` al cargar |
| FAV-11 | Regresión: `listId` ajeno | ✅ PASS | Sin cambios: el destino sale de `listasVisibles(userId)`, nunca del payload — ahora también en renombrar y borrar |

**Un hallazgo de checker descartado con evidencia en vivo:** un checker marcó PARCIAL "renombrar/
borrar no chequean premium en el cliente". No es un gap: un free **no ve** ninguna lista no-default
(`listasVisibles` la recorta), así que esos botones nunca se renderizan — verificado en FAV-29, cero
botones de renombrar/borrar en pantalla. El candado server (`listasVisibles` en la acción) es el que
manda igual.

**Decidido mientras se implementaba F2** (no estaba en el spec y hacía falta):

- **La default ocupa un lugar del cupo aunque todavía no exista.** Sin eso, un free sin nada guardado
  podía crear una lista con nombre y quedarse sin destino para el tap (o con una default que su
  propio cupo esconde). Vive en `listasOcupadas`, en el dueño único.
- **Borrar una lista sí borra sus ítems** (cascade) y eso **no contradice** "ocultar ≠ borrar": ese
  invariante prohíbe borrar por un **cambio de plan**. Acá el usuario lo pide explícitamente, y se
  le avisa cuántos lugares se van antes de confirmar.
- **El botón de `/mis-lugares` lleva `listId`**: sacar desde una lista saca de **esa**, no de todas
  las visibles (que es lo que hace el botón de la card, donde el estado es por lugar).
- **`estadoDeFavoritos` reemplaza a `guardadosDeLaPagina` en la home y la ficha**: guardados y listas
  salen de la misma resolución de `listasVisibles`, así una pantalla no paga dos veces la misma
  pregunta. `/api/search` sigue con `guardadosDeLaPagina`: las listas no cambian entre páginas.

---

## QA /qa-spec — SUGERIR_EN_VOTACION (2026-07-31)

**Veredicto:** APROBADO
**Verificación técnica:** typecheck ✅ · tests 542/542 ✅ (19 nuevos de sugerencias) · build ✅ (con el dev server bajo; las dos rutas nuevas de `opciones` quedan dinámicas)
**Método:** 4 checkers independientes (Explore/haiku, read-only) contra el DoD de
`docs/specs/active/SUGERIR_EN_VOTACION.md`, **más** los 15 casos del § QA manual del spec
corridos **en vivo** contra `https://adondesalimos.ngrok.app` (Playwright + `curl` sin cookies
para el camino "sin cuenta" + `psql` para verificar la base). Ningún criterio se declaró PASS
solo por lectura de código.

### DoD — checkers independientes

| ID | Criterio | Resultado | Evidencia / Gap |
|----|----------|-----------|-----------------|
| SUG-QA-01 | Migración aditiva; las votaciones existentes quedan `origin='creator'` y `allow_suggestions=true` sin backfill | ✅ PASS | `drizzle/0012_overjoyed_marvex.sql` (3 ALTER + 1 índice + el enum); defaults en `lib/db/schema.ts:741,772,779`. En la base de dev: 14/14 opciones `creator`, 4/4 polls con sugerencias, **cero UPDATE de datos** |
| SUG-QA-02 | Cualquiera con el link suma **sin cuenta** y la opción es votable de inmediato | ✅ PASS | `app/api/votaciones/[token]/opciones/route.ts` no pide sesión; crea la cookie `voter_id` si falta (L57-68). El INSERT no tiene estado `pendiente` (`acciones.ts:329-340`) |
| SUG-QA-03 | **Ningún camino a texto libre**: único input `placeId`, validado contra `publishedWhere` en el server | ✅ PASS | `sugerirOpcionSchema` = `{placeId: z.uuid()}` y nada más (`validacion.ts:49`); visibilidad vía `lib/db/visibility.ts` (`acciones.ts:234-243`). Sin campo de nombre en ningún lado |
| SUG-QA-04 | Techo de 8 **server-side**, no excedible con requests concurrentes | ✅ PASS | `MAX_OPCIONES_TOTAL` contado dentro de la transacción con `polls` tomada `FOR UPDATE` (`acciones.ts:282,297-307`); test de concurrencia en `sugerencias.integration.test.ts:176-199` |
| SUG-QA-05 | Tope de 2 por `voter_token` server-side | ✅ PASS | `acciones.ts:309-319` con el mismo lock; test `:201-214` |
| SUG-QA-06 | `suggested_by` **nunca** en una respuesta de API ni en el HTML | ✅ PASS | Cero ocurrencias en `app/**` y `components/**`; `OpcionPublica` no lo tiene (`query.ts:33-41`); test que serializa la votación y busca el token (`:343-360`) |
| SUG-QA-07 | El creador quita una sugerencia (con aviso de votos perdidos) y **no** una original | ✅ PASS | Gate por `origin` (`acciones.ts:420-425` → 403 `OPCION_ORIGINAL`); `votosPerdidos` en la respuesta; confirmación en `votacion-client.tsx:257-282` |
| SUG-QA-08 | El que sugirió saca la suya mientras no tenga votos | ✅ PASS | Autorización por `voter_token` (`acciones.ts:427-429`) + gate de votos (`:436-438` → 409 `OPCION_CON_VOTOS`) |
| SUG-QA-09 | Con `allow_suggestions=false`: ni botón, ni endpoint (403) | ✅ PASS | `SUGERENCIAS_CERRADAS` en el dominio (`acciones.ts:290-295`) → 403 en el route; el botón se condiciona a `permiteSumar` y se apaga solo si el server lo dice |
| SUG-QA-10 | Cerrada / expirada / cancelada: no se sugiere, solo-lectura, **nunca** 404 | ✅ PASS | La acción usa `estaActiva` de `lib/votaciones/estado.ts` (dueño único, sin reimplementar); `page.tsx` hace `notFound()` **solo** si el token no existe |
| SUG-QA-11 | Los votos previos siguen contando y los porcentajes se recalculan con la opción nueva | ✅ PASS | Sugerir no toca `poll_votes`; el conteo es un `GROUP BY` de lectura y el total se recalcula sobre la cancha nueva (`query.ts`) |
| SUG-QA-12 | Rate limit propio, sin compartir bucket con voto ni búsqueda | ✅ PASS | `checkSugerenciaRateLimit`, prefijo `sugerencia`, 20/min (`rate-limit.ts:283-291`), usado en el POST y en el DELETE |
| SUG-QA-13 | Las sugeridas se distinguen en la UI sin revelar identidad | ✅ PASS | Badge "Lo sumó alguien del grupo" / "Lo sumaste vos" a partir de `origin`; lo único que viaja del server es ese campo |

### QA en vivo — los 15 casos del spec (ngrok, base de dev)

| ID | Caso | Resultado | Qué se vio |
|----|------|-----------|------------|
| SUG-01 | Sumar un lugar con el link, sin cuenta | ✅ PASS | `POST` sin cookie ni sesión → **201** + `Set-Cookie: voter_id` nueva; la opción entra con `origin:'voter'` y aparece con badge. Desde la UI: se cierra el sheet y queda votable |
| SUG-02 | Sumar un lugar que ya está | ✅ PASS | El buscador lo muestra como **"Ya está"** (sin botón), no como error |
| SUG-03 | `placeId` inventado | ✅ PASS | uuid v4 inexistente → **422** `LUGAR_NO_PUBLICADO`, nada insertado. Un uuid mal formado ni llega: **400** en zod |
| SUG-04 | `placeId` de un lugar despublicado | ✅ PASS | **422** `LUGAR_NO_PUBLICADO` (mismo candado que la shortlist del creador) |
| SUG-05 | `{"placeId": "Bar de la esquina"}` | ✅ PASS | **400** `INVALID` por zod, sin tocar la base. Igual un body con `{"nombre": …}` |
| SUG-06 | Llegar a 8 y volver a sugerir | ✅ PASS | La novena → **409** `VOTACION_LLENA`; quedaron exactamente 8 filas. En la pantalla: botón apagado con el motivo ("La votación llegó a 8 lugares, que es el máximo") |
| SUG-07 | Sugerir 3 veces desde el mismo dispositivo | ✅ PASS | La tercera → **409** `LIMITE_SUGERENCIAS` (y las siguientes también) |
| SUG-08 | Votar una sugerencia y que el creador la quite | ✅ PASS | Aviso "Si lo sacás se pierden 2 votos. Esto no se puede deshacer."; al confirmar se van la opción **y** sus 2 votos (cascade). El votante que la había elegido ve **en vivo** (polling) "Sacaron el lugar que habías votado, así que tu voto quedó libre. Elegí otro." — no se le reasigna nada |
| SUG-09 | El creador intenta quitar una opción original | ✅ PASS | No hay botón en la UI; el `DELETE` directo **con la sesión del creador** → **403** `OPCION_ORIGINAL` |
| SUG-10 | El que sugirió quita lo suyo | ✅ PASS | Sin votos → **200** (`votosPerdidos: 0`). Con votos → **409** `OPCION_CON_VOTOS`. La sugerencia ajena → **403** `NO_AUTORIZADO`. Sin cookie ni sesión → **403** |
| SUG-11 | Votación creada con sugerencias desactivadas | ✅ PASS | Checkbox del alta apagado ⇒ `allow_suggestions=false` en la base; sin botón de sumar y `POST` → **403** `SUGERENCIAS_CERRADAS`; votar sigue andando. Mismo resultado apagando el interruptor desde `/mis-votaciones` (y lo ya sugerido **sigue**: cierra la puerta, no deshace) |
| SUG-12 | Sugerir en una votación expirada | ✅ PASS | `POST` → **409** `VOTACION_CERRADA`; la página responde **200** en solo-lectura (sin votar, sin sumar, sin sacar) y el cierre perezoso quedó persistido (`status='closed'`). Un token inexistente sigue siendo el **único** 404 |
| SUG-13 | Revisar el HTML/JSON de la página | ✅ PASS | En el HTML server-render: **0** ocurrencias del `voter_token` y de `suggested`. En el JSON de la API tampoco. Lo único propio que viaja son los `optionId` **de uno mismo** (mismo criterio que el voto propio) |
| SUG-14 | Dos navegadores sugiriendo con 1 vacante | ✅ PASS | Dos POST en paralelo: uno **201**, el otro **409** `VOTACION_LLENA`; total en la base = 8, nunca 9 |
| SUG-15 | Preview del link después de una sugerencia | ✅ PASS | `GET` con user-agent de WhatsApp: `og:title` con la cancha completa (sugerencias incluidas) y el contador de `google_api_usage` **no se movió** (106 → 106). Sin regresión de la decisión 22 de VOTACION |

**Decidido mientras se implementaba** (no estaba en el spec y hacía falta):

- **`MAX_OPCIONES_TOTAL = 8` es una constante nueva, no un cambio de `MAX_OPCIONES`.** `MAX_OPCIONES`
  ya existía y vale 5: es lo que el **creador** pone al armar (decisión 3 de VOTACION, que no se
  revierte), y lo importan el alta y el chat. Pisarla habría roto los dos. Las dos conviven en
  `constantes.ts` con el porqué escrito.
- **El polling ahora trae la cancha entera, no solo los conteos.** Con `{optionId, votos}` el total
  subía por votos de una opción que el cliente no conocía y no tenía dónde mostrarlos: la cancha
  **crece mientras la pantalla está abierta**, que es el punto de la feature. `allowSuggestions`
  viaja por lo mismo (si el creador cierra las sugerencias, el botón se apaga solo).
- **El cierre perezoso se hace ANTES de la transacción.** Primero se hizo adentro y el `ROLLBACK` del
  error de negocio se lo llevaba puesto: la votación vencida seguía `open` en la columna. Lo cazó un
  test (`status` esperado `closed`). Ahora sigue el patrón de `votar()`: pre-chequeo + cierre afuera,
  y adentro el `FOR UPDATE` revalida.
- **Quitar solo mientras está abierta.** El spec no lo dice; borrar una opción de una votación
  cerrada cambiaría un resultado ya publicado (y ya compartido por link).
- **El `DELETE` prueba primero como creador y después como votante.** Un usuario logueado que es
  creador de OTRA votación es, acá, un votante más: sin ese fallback su sesión le habría tapado el
  derecho a sacar lo que él mismo sumó.
- **`allow_suggestions` se cambia por el `PATCH` que ya existía** (`accion: 'suggestions'` en el
  `discriminatedUnion`), no con un endpoint nuevo: mismo dueño, misma votación, misma autorización.

---

## QA /qa-spec — CHIPS_ROTACION (2026-07-31)

**Veredicto:** APROBADO
**Verificación técnica:** typecheck ✅ · tests 600/600 ✅ (55 nuevos de rotación + 3 de integración de chips) · build ✅ (con el dev server bajo; ninguna ruta cambió de estático a dinámico)
**Método:** 4 checkers independientes (Explore/haiku, read-only) contra el DoD de
`docs/specs/active/CHIPS_ROTACION.md`, **más** los casos del § QA manual corridos **en vivo**
contra `https://adondesalimos.ngrok.app` (Playwright + `psql` para editar `chips.schedule`).
Los casos que exigen otro día u otra hora se cubrieron **sin mover el reloj del sistema**: por
código con `getOccasionChips(now)` contra la base real, y en pantalla moviendo **la regla** en vez
del reloj (que además es lo que verifica ROT-09). Mismo criterio que AHORA-02/03 el 2026-07-30.

### DoD — checkers independientes

| ID | Criterio | Resultado | Evidencia / Gap |
|----|----------|-----------|-----------------|
| ROT-QA-01 | `lib/search/rotacion.ts` es el **único** módulo que decide qué chips van primero (grep), puro y sin base | ✅ PASS | Importa solo de `@/lib/negocio/horarios`; cero `@/lib/db`/drizzle. `chipsPrimero` se usa en un solo lugar de producción (`chips.ts:128`). No hay una segunda implementación del orden por hora/día |
| ROT-QA-02 | El día/hora en AR sale de `partesEnAR`; sin segunda transcripción de ese cómputo | ✅ PASS | `rotacion.ts:134` `partesEnAR(now)`; cero `Intl.DateTimeFormat` / `getDay()` / `getHours()` en el módulo. Reusa además `esHoraValida` y `minutosDe` (`:71-72`, `:116-117`) y `DIAS` para el módulo del día anterior (`:124`) |
| ROT-QA-03 | Martes 18:00 ⇒ «After office» adelante; martes 15:00 no. Sábado 01:00 ⇒ «Salir a bailar» (regla del viernes que cruza medianoche); sábado 15:00 no | ✅ PASS | `rotacion.test.ts` § reglas semilla — los cuatro instantes exactos. Los dos casos "15:00" se agregaron **por hallazgo del checker**: estaban cubiertos por 10:00 y 15:59, no por el instante que nombra el DoD |
| ROT-QA-04 | Con `chips.schedule` **ausente**, la home se comporta exactamente como hoy, **sin logs de error** | ✅ PASS | `rotacion.ts:88` `null`/`undefined` ⇒ `[]` sin loguear; con `[]` el pool vuelve a ser `in_home` por `asc(sort)`. Test con espía de `console.warn`. Verificado también en vivo (ROT-04) |
| ROT-QA-05 | Con el setting inválido: no rompe, se descarta lo inválido, se conserva lo válido, y se loguea **una vez** | ✅ PASS | `esReglaValida` valida campo por campo (`:65-76`) y el filtro es **por regla** (`:93-96`); flag `yaAviso` (`:51-58`). 15 formas de basura en el test, más el caso "regla mala entre dos buenas" |
| ROT-QA-06 | Un chip nombrado en `primero` que devuelve 0 no se muestra ni deja hueco | ✅ PASS | Los forzados salen de `vivos` (count > 0), así que un chip muerto nunca entra y el `slice(0,4)` se completa con el siguiente `in_home` (`chips.ts:129-138`). Test de integración: la cantidad de chips de Ocasión es idéntica en 28 instantes distintos |
| ROT-QA-07 | Una regla puede adelantar un chip vivo con `in_home = false` (decisión 11) y el que queda quinto pasa a "Ver más" sin desaparecer | ✅ PASS | `forzados` no filtra por `inHome` (`chips.ts:129-131`); `resto` = vivos que no entraron a `home` (`:168`). Verificado en vivo (ROT-11) |
| ROT-QA-08 | Los chips siguen aplicando los mismos tags; `occasion_chips`, `chip_tags`, el motor y el componente cliente no tienen cambios | ✅ PASS | Diff del working tree: solo `lib/search/rotacion.ts` (nuevo), `lib/search/chips.ts`, `scripts/seed.ts`, tests y docs. Intactos `components/search/occasion-chips.tsx`, `lib/search/query.ts`, `lib/search/params.ts`, `lib/db/chips.ts` y `drizzle/`. `OccasionChipView` no cambia de forma y el chip «Para ahora» conserva su lugar al frente |
| ROT-QA-09 | Tests de tabla: cada regla, los bordes de cada rango, el cruce de medianoche, un día sin reglas y los settings basura | ✅ PASS | `lib/search/__tests__/rotacion.test.ts` — 55 casos: las 3 reglas semilla, 17 bordes (incluidos 21:59 / 22:00 / 00:00 / 04:59 / 05:00 y la madrugada que pertenece al día anterior), la prioridad "gana la primera que matchea", `desde === hasta`, y el bloque de validación |
| ROT-QA-10 | typecheck + tests + build verdes | ✅ PASS | typecheck ✅ · tests 600/600 ✅ · build ✅ *Compiled successfully in 5.9s*, 12/12 páginas estáticas generadas, con el dev server bajo (cicatriz de BUSQUEDA: comparten `.next`) |

### QA en vivo — `https://adondesalimos.ngrok.app`, viernes 2026-07-31 13:28-13:31 (AR)

| ID | Caso | Resultado | Qué se vio |
|----|------|-----------|------------|
| ROT-01 | Martes 18:00 ⇒ «After office» primero | ✅ PASS | Por código contra la base real: `Para ahora · after-office · salida-con-chongo · salir-a-bailar · tomar-algo`. Sube del 3.º al 1.º puesto entre los de Ocasión |
| ROT-02 | Martes 10:00 ⇒ el orden de siempre | ✅ PASS | `salida-con-chongo · salir-a-bailar · after-office · tomar-algo`. **En pantalla** el viernes 13:28, hora en la que ninguna regla matchea: idéntico |
| ROT-03 | Sábado 01:00 ⇒ «Salir a bailar» primero | ✅ PASS | Por código: `Para ahora · salir-a-bailar · salida-con-chongo · after-office · tomar-algo` — la regla del viernes 22:00-05:00 alcanza la madrugada del sábado |
| ROT-04 | `DELETE` de la clave y recargar | ✅ PASS | Home idéntica a la de antes del spec y **cero logs** de `chips.schedule` en la consola |
| ROT-05 | `UPDATE` con un JSON de otra forma (`{"dias":"lunes","desde":"25:99"}`) | ✅ PASS | La home no rompió: orden por `sort`. Un solo warning del server: *"[chips.schedule] setting inválido, se ignora lo que no valida: el valor no es un array de reglas"* |
| ROT-06 | Regla con `primero: ["chip-que-no-existe"]` | ✅ PASS | Se ignora ese slug; los demás de la misma regla aplican igual |
| ROT-07 | Regla con un chip vivo + uno muerto (`merienda` + `salida-con-amigos`, que hoy da 0), con una regla basura delante | ✅ PASS | `Para ahora · Merienda · Salida con chongo · Salir a bailar · After office` — el vivo se adelanta, el muerto no deja hueco (siguen 4 de Ocasión) y la regla mala se descartó sola sin invalidar a la buena |
| ROT-08 | Tocar un chip rotado | ✅ PASS | «Merienda» desde la home deja `?t=cafe%2Cmerienda` — los mismos tags que aplicaba desde "Ver más" |
| ROT-09 | `UPDATE` de la regla sin reiniciar el server | ✅ PASS | La recarga siguiente ya mostró el orden nuevo: el setting se lee en cada request, no se cachea en módulo |
| ROT-10 | Viernes 23:00, con `ABIERTO_AHORA` F1 cerrado | ✅ PASS | Por código: `Para ahora · salir-a-bailar · …` — primero el de franja, después el rotado, y «Para ahora» no descuenta de los 4 (decisión 8, ya implementada el 2026-07-30) |
| ROT-11 | Chip con `in_home = false` traído por una regla (decisión 11) | ✅ PASS | Con la regla de prueba: `Para ahora · Merienda · Cena familiar · Salida con chongo · Salir a bailar`; «After office» y «Tomar algo» pasaron a "Ver más" sin desaparecer |

**La base quedó como estaba**: los `UPDATE`/`DELETE` de prueba sobre `chips.schedule` se
revirtieron con `npm run db:seed` (idempotente) y el valor final se verificó con `psql`.

### Notas del QA

- **La feature se especificó contra una home que ya no era la de hoy.** Al arrancar se midió: los
  cuatro chips de la home son `salida-con-chongo`(1) · `salir-a-bailar`(586) · `after-office`(171) ·
  `tomar-algo`(3.219) —`salida-con-amigos` da **0** y la decisión 25 lo esconde—, o sea que los dos
  chips de las reglas semilla **ya estaban en la home a toda hora**. Sin la decisión 11 (una regla
  puede traer un chip con `in_home = false`) la feature no habría movido un pixel y ROT-01/02/03
  habrían pasado sin que hiciera nada. Es el tipo de gap que solo aparece mirando los **datos**
  antes de codear, no releyendo el spec.
- **El aviso de setting inválido viaja también a la consola del browser en dev**: es el reenvío del
  log del server que hace el overlay de Next (aparece rotulado `Server`), no un error de cliente.
- **`desde === hasta` cubre las 24 h del día listado.** Es la consecuencia literal de la decisión 3
  ("`hasta` menor **o igual** que `desde` cruza la medianoche"); queda documentada en el módulo y
  tiene test propio. `horarios.ts` trata ese caso como rango inválido — la diferencia es deliberada:
  ahí significa "no abre", acá "siempre".

---

## QA — Pase de deuda técnica (2026-07-31)

**Alcance:** los tres ítems de `docs/product/BACKLOG.md` § Cola post-v2 → *1 · Pase de deuda
técnica*. Sin spec (trabajo acotado, sin decisiones de producto), así que no corre `/close-spec`.
**Veredicto:** APROBADO — 9/9 PASS.
**Verificación técnica:** typecheck ✅ · tests **604/604** ✅ · build ✅ (con el dev server bajo:
compiló en 5,7 s, 12 páginas estáticas, sin errores ni warnings nuevos). El único criterio de
pantalla (DEUDA-06) se verificó en vivo con Playwright contra `adondesalimos.ngrok.app`.
**Método:** unit tests nuevos + verificación contra el Postgres de dev con `psql` y `tsx`, y
el bloque de costos de `/admin` en pantalla.

⚠️ **Backup previo obligatorio hecho**: `backups/adondesalimos_2026-07-31_140358.sql.gz` (5,0 MB),
antes de generar la migración. Canario de curaduría verificado antes y después de `db:migrate`:
`place_tags source='admin'` = **3.967** en los dos momentos.

| ID | Caso | Resultado | Evidencia |
|----|------|-----------|-----------|
| DEUDA-01 | (a) Migración aditiva: `chat_messages` gana `cache_read_tokens` y `cache_creation_tokens`, nullable | ✅ PASS | `drizzle/0013_furry_banshee.sql` = dos `ADD COLUMN integer`, sin `DROP`/`NOT NULL`/`DEFAULT`. Aplicada con `db:migrate`; las 36 filas previas quedaron con las dos columnas en `null` |
| DEUDA-02 | (a) El escritor persiste los 4 números y acumula **también** el de creación (antes solo el read) | ✅ PASS | `lib/ai/chat.ts:125-127` acumula `cache_read_input_tokens` + `cache_creation_input_tokens`; el INSERT del mensaje (`:196-203`) los escribe. `logChatCall` recibe los dos y el log JSON ahora imprime `cacheCreationTokens` |
| DEUDA-03 | (a) El tablero calcula con los 4 números, no con 2 | ✅ PASS | `lib/admin/costos.ts`: `getCostosChat` suma las dos columnas nuevas por período y delega en `costoDePeriodo` → `calcularCostoUsd(model, in, out, read, creation)` |
| DEUDA-04 | (a) Test que **falla con el cálculo viejo** | ✅ PASS | `lib/admin/__tests__/costos.test.ts` § *costoDePeriodo*: con 1M read + 100k write el costo es **mayor** que el viejo, y el delta es exactamente `read×0,1 + write×1,25` del precio de input ($0,675 en Sonnet) |
| DEUDA-05 | (a) **El número nunca baja**: lo ya guardado vale lo mismo que antes | ✅ PASS | `getCostosChat()` sobre la base real devuelve `$0,172834` (haiku `$0,007921` + sonnet `$0,164913`), idéntico al cálculo a mano del baseline pre-fix. Las columnas nuevas en `null` → `sum` las ignora y el `coalesce` deja 0 |
| DEUDA-06 | (a) En pantalla: `/admin` muestra los tokens de caché y el costo | ✅ PASS | Verificado en vivo (Playwright, `adondesalimos.ngrok.app`, cuenta admin). **Antes** del mensaje: `18.531 / 7.288 / 0` · US$ 0,17. Un mensaje en `/chat` («Una pizzería en Caballito para ir con amigos») → **después**: `19.424 / 7.695 / 17.402` · US$ 0,21, total **US$ 0,22**. Ver H-2 |
| DEUDA-07 | (b) El `EXISTS` de `filtrosDeTags`/`filtroDeZonas` **no** deja el identificador sin calificar | ✅ PASS | `toSQL()` sobre la forma real de `countPlaces` y de `searchPlaces` (con `leftJoin`): `WHERE pt.place_id = "places"."id"` — **calificado**. La premisa del backlog era falsa; ver H-1 |
| DEUDA-08 | (b) Los conteos de la búsqueda son los correctos, no "correctos por descarte" | ✅ PASS | `countPlaces` vs la verdad en SQL crudo con la regla de publicado (umbral 0,5): tag `pizza` **2.604 = 2.604**, zona `palermo-soho` **1.095 = 1.095**, combinados 76. Los 604 tests siguen verdes, incluidos los de integración de tags (OR/AND/padre) y zonas |
| DEUDA-09 | (c) El bbox de AMBA tiene **un solo** dueño | ✅ PASS | `lib/geo/amba.ts` (sin imports, para que el script no arrastre `lib/claims`). `scripts/import-overture.ts` y `lib/claims/validacion.ts` lo importan; `grep -rn "xmin: -59.1"` devuelve **1** definición. El test de validación importa del dueño nuevo y sigue verde |

### Hallazgos

**H-1 — El ítem (b) no era un bug: la premisa estaba mal generalizada (no se refactorizó).**
El backlog daba por hecho que Drizzle renderiza `${places.id}` sin calificar la tabla *dentro de
un subquery en SQL crudo*, y que los `EXISTS` del motor funcionaban "por descarte". Medido sobre
drizzle-orm 0.45.2, la regla real es otra: **Drizzle omite la tabla solo cuando la columna se
renderiza en la lista de SELECT**, y la califica en cualquier otra posición.

```
EN SELECT : select EXISTS (SELECT 1 FROM "place_claims" pc WHERE pc.place_id = "id") from "places"
EN WHERE  : select "id" from "places" where EXISTS (... WHERE pc.place_id = "places"."id")
```

El H-1 de AUTH F2 fue real porque ahí el `EXISTS` era **un campo del SELECT** (el flag
`reclamado`). Los de `lib/search/query.ts` viven en el WHERE, salen calificados y seguirían
funcionando aunque `place_tags`/`place_zones` ganaran una columna `id`. Decisión: **no** pasar el
motor a `leftJoin` — habría tocado el camino crítico de la búsqueda para arreglar nada, contra la
regla de cambios quirúrgicos. En su lugar se dejó el porqué en el código (comentario en las dos
funciones, con el riesgo real nombrado: *no mover estos fragmentos a una posición de SELECT*) y se
corrigió la afirmación demasiado general que había quedado en `lib/claims/query.ts`, que es de
donde salió la conclusión equivocada.

**H-2 — Un solo mensaje de chat movió el total del tablero un 22%, y el 80% del costo de esa
llamada era caché.** El fix escribe hacia adelante (las 36 filas históricas quedan en `null`), así
que la verificación de pantalla necesitaba **un** mensaje nuevo. Se mandó uno y el circuito
completo quedó confirmado: la fila persistió `cache_read_tokens = 8.701` y
`cache_creation_tokens = 8.701` (el turno tuvo dos rondas por el tool-use: la primera **escribe**
el prefijo cacheado y la segunda lo **lee**), y el tablero pasó de US$ 0,17 a **US$ 0,22**.

Desglose de esa única llamada (Sonnet 5, $3/$15 por millón):

| Concepto | Tokens | USD |
|---|---|---|
| input no cacheado | 893 | 0,002679 |
| output | 407 | 0,006105 |
| cache **read** (×0,1) | 8.701 | 0,002610 |
| cache **write** (×1,25) | 8.701 | **0,032629** |
| **total real** | | **0,044023** |
| lo que mostraba el tablero viejo | | 0,008784 |

O sea que el tablero venía informando **1/5** del costo de un mensaje con caché. El error es
chico en pesos hoy (el catálogo de conversaciones es de QA) y grande en proporción.

**Ojo con leer mal ese 74%:** el caché es por **prefijo** y por **modelo**, no por conversación —
lo comparten todos los usuarios del workspace y cada lectura le **refresca el TTL gratis**. La
escritura se paga una vez por **período frío**, no una por conversación, así que a volumen el
rubro caro desaparece solo. Ver `docs/operations/LECCIONES_APRENDIDAS.md` § *El prompt caching
falla en silencio* para las tres consecuencias y por qué la idea de "modelo barato en el primer
mensaje" no ahorra.

**Nota de método:** el baseline del tablero se leyó **antes** de correr la suite, porque el test
de integración del cupo toca `ai_api_usage` del mes real (hallazgo viejo de COSTOS_ADMIN, ya
mitigado con snapshot/restore). Mirar los números después de los tests invita a creer que algo
se rompió.

---

## QA de fase — DEPLOY (el premium apagado) (2026-08-01)

**Veredicto:** APROBADO
**Verificación técnica:** typecheck ✅ · tests ✅ 609/609 (56 archivos) · build ⏳ (pendiente:
requiere el dev server parado)
**Alcance:** el primer tramo de código de F1 — tabla `premium_interest` + endpoint +
`SuscripcionPanel` con el cobro apagado + conteo en `/admin` (decisión 6 y § El premium
apagado). **No** cubre el resto de F1 (`noindex`, `maxDuration`, `.env.example`) ni la
migración a Neon.
**Método:** tests de integración contra el Postgres de dev + QA en vivo con Playwright sobre
`https://adondesalimos.ngrok.app`, con `NEXT_PUBLIC_MP_PUBLIC_KEY` **comentada en `.env` y el
dev server reiniciado** (el interruptor es por entorno y las `NEXT_PUBLIC_` se inlinean en el
bundle — sin reinicio no se ve nada).

| ID | Criterio | Resultado | Evidencia |
|----|----------|-----------|-----------|
| DEPLOY-10 | Tab Suscripción con el cobro apagado: mensaje de beta, sin copy de desarrollador, click registrado | ✅ PASS | `/cuenta` con pepe@gmail.com (free): *"Todavía no abrimos los pagos. Estamos en beta. El premium está por salir: …"* + botón `Avisame cuando abra`. **No** aparece *"Configuración de pago incompleta"* (el Brick ya ni se monta). El click deja la fila |
| DEPLOY-15 | Tab Suscripción en `/mi-negocio/[placeId]` (B2B): mismo mensaje con el pitch del plan del lugar | ✅ PASS | Kansas Grill & Bar (`6323f392…`, B2B cancelada) con frodriguez.este@gmail.com: mismo esqueleto, *"El plan del lugar está por salir: descripción, carta, novedades, hasta 15 fotos y el destaque en las búsquedas."* |
| DEPLOY-16 | Doble click en "Avisame cuando abra": una sola fila; la segunda vez ya muestra el confirmado | ✅ PASS | `dblclick` real sobre el botón → `select … from premium_interest` = **1 fila** (`place_id` NULL). UI: *"✓ Listo, anotado. Te escribimos a **pepe@gmail.com** apenas abramos los pagos."* Los dos únicos **parciales** son los que lo sostienen: con un `unique(user_id, place_id)` común habrían entrado 2 (`NULL ≠ NULL`) |
| DEPLOY-17 | `/admin` → Suscripciones: conteo y mails de los interesados, coincide con la base | ✅ PASS | Bloque *"Interés en el premium"* arriba de la tabla: **2** pidieron que les avisemos · `frodriguez.este@gmail.com · Kansas Grill & Bar` · `pepe@gmail.com · Premium (B2C)`. Coincide con las 2 filas de la base |
| DEPLOY-16b | El confirmado sobrevive al reload (no es estado de cliente) | ✅ PASS | Reload de `/cuenta` → sigue el confirmado. Lo resuelve el server (`tieneInteres`), no el `useState` |
| DEPLOY-16c | Un suscripto activo NO ve el mensaje de beta | ✅ PASS | `/cuenta` con frodriguez.este@gmail.com (B2C `active`, cancelación en curso): sigue mostrando *"Cancelada. Mantenés el acceso hasta el 24 de agosto de 2026."* El cobro apagado solo cambia el estado **free** |

### Cubierto por tests, no por la pantalla

`lib/billing/__tests__/interes.integration.test.ts` (5/5): dedupe B2C · dedupe B2B **por lugar**
(dos lugares del mismo dueño son dos señales) · la señal B2C y la del lugar conviven · **no se
puede anotar un lugar ajeno** (`NO_ES_DUENO`, gate `esDuenoDe`) · el conteo cuenta filas, no clicks.

### Notas de operación

- **Las 2 filas del QA se borraron al terminar** (`delete from premium_interest where user_id in
  (…pepe, frodriguez.este…)` → 0 filas). Son datos, y el dump de dev es el que se restaura en Neon
  (F0): dejarlas arrancaría prod con el contador en 2, que es justo el número que dispara prender
  el cobro y pagar Vercel Pro (decisión 18). **Si se vuelve a hacer QA de esto, volver a limpiar
  antes del dump.**
- Backup previo a la migración: `backups/adondesalimos_2026-08-01_111256.sql.gz` (5,0 MB).
- Migración `drizzle/0014_mighty_puck.sql`, aditiva, aplicada en dev. Los dos únicos salieron
  parciales en el SQL generado (`WHERE "premium_interest"."place_id" IS NULL` / `IS NOT NULL`) —
  verificado a mano antes de aplicar, no se asumió que Drizzle lo hiciera bien.

---

## QA — Pulido de UI, sesión B: el historial de `/mis-votaciones` (2026-08-01)

**Veredicto:** APROBADO
**Verificación técnica:** `npx tsc --noEmit` limpio · tests 615/615 ✅ (6 nuevos) · `npm run build`
✅ (con el dev server parado; `/api/votaciones/historial` aparece en el manifiesto de rutas)
**Alcance:** el ítem **(d)** del BACKLOG § *Pulido de UI*, contra las **5 decisiones cerradas por
Fer el 2026-08-01** (ese bloque es el contrato; no hubo spec formal, mismo criterio que el pase de
deuda técnica). `misVotaciones` sin `LIMIT` se parte en dos lecturas: `votacionesActivas` (card
completa, sin tope) e `historialDeVotaciones` (filas compactas, 20 + cursor).
**Método:** tests de integración contra el Postgres de dev (`historial.integration.test.ts`) + QA
en vivo con Playwright sobre `https://adondesalimos.ngrok.app` con **22 votaciones terminadas**
sembradas a propósito (19 de QA + las 3 reales), premium y free.

| ID | Criterio | Resultado | Evidencia |
|----|----------|-----------|-----------|
| PULIDO-D-01 | El historial sirve 20 y ofrece "Ver más" (decisión 1) | ✅ PASS | En vivo con 22 terminadas: exactamente **20 filas** + botón `Ver más`. La query pide 21 para saber si hay siguiente, sin `count()` (mismo truco que el motor de búsqueda) |
| PULIDO-D-02 | "Ver más" trae la página siguiente sin repetir ni saltear, y el botón desaparece al agotarse | ✅ PASS | Click → **22 filas**, las 2 nuevas al final (`y ahora que?` y `¿Que hacemos?`), sin duplicados, y el botón ya no está. Cursor keyset `(created_at, id)` |
| PULIDO-D-03 | Sin scroll infinito (decisión 1) | ✅ PASS | Es un `<button>`; no hay `IntersectionObserver` en la pantalla (a diferencia de `results-list.tsx`, que sí lo usa a propósito) |
| PULIDO-D-04 | El nombre del ganador sale del join a `places` por `winner_place_id` (decisión 2) | ✅ PASS | En vivo: *"Ganó Salon de Fiestas Torre del Sol"*, *"Ganó Cine Lorca"*. Sin ganador ⇒ *"Terminó sin ganador"* (expirada sin cierre). Test: `el ganador sale del join…` |
| PULIDO-D-05 | Sin título, la fila se arma con las 2 primeras opciones + "…" (decisión 2) | ✅ PASS | En vivo: *"Las Pizarras bistro · Grappa Cantina · …"* (esa votación tiene 3). Test: 2 opciones ⇒ `masOpciones=false`; 3 ⇒ `true`. **Con** título no se piden nombres (`opciones: []`): solo las sin título pagan la segunda query |
| PULIDO-D-06 | Historial = cerradas y expiradas; **cancelada no** (decisión 3) | ✅ PASS | La cancelada de `frodriguez.este@gmail.com` no aparece en la pantalla ni en la query. Test: `cerradas y expiradas sí; cancelada y activa no`. Una expirada (sigue `status='open'`, vencida) se ve **Expirada** |
| PULIDO-D-07 | Las activas van arriba con la card completa y **sin `LIMIT`** (decisión 4) | ✅ PASS | En vivo: la activa con conteo por opción, `Cerrar`, `Cancelar votación`, `Copiar link` y el interruptor de sugerencias; el historial abajo, **sin ninguno de esos controles**. `votacionesActivas` no lleva `limit()` (premium no tiene tope de activas: `acciones.ts:85` solo bloquea al free) |
| PULIDO-D-08 | El free no ve teaser del historial (decisión 5) | ✅ PASS | `pepe@gmail.com` (free, 1 activa + 1 cerrada en la base): ve su activa y el párrafo de premium de siempre, y **no existe la sección "Anteriores"**. Para un free el historial ni se consulta (`page.tsx`) |
| PULIDO-D-09 | El gate de plan se aplica en el server, también en el endpoint | ✅ PASS | `GET /api/votaciones/historial` → **401** anónimo (`NO_SESSION`) y **403** con sesión free (`NO_PREMIUM`, *"El historial de votaciones es del plan premium."*). El endpoint no es la puerta de atrás de la pantalla |
| PULIDO-D-10 | Un cursor manoseado no rompe | ✅ PASS | Test: `historialDeVotaciones(userId, 'basura-no-base64')` sirve la primera página (mismo criterio que el cursor de la búsqueda) |
| PULIDO-D-11 | El costo de la lectura baja de verdad | ✅ PASS | El historial **no** cuenta votos: se fue el `leftJoin` + `GROUP BY` sobre `poll_votes` para todas las votaciones de la historia. Quedan 2 queries acotadas por página (≤20 filas + ≤20×`MAX_OPCIONES_TOTAL` nombres, y solo de las sin título) |

### Notas de operación

- **Las 20 filas sembradas para el QA se borraron al terminar** (`delete from polls where token ~
  '^__qa_hist__'` → 20 borradas, 0 quedan; los conteos por usuario volvieron exactos a los previos:
  premium 1 open / 2 closed / 1 cancelled · pepe 1 open / 1 closed). Mismo cuidado que las filas de
  `premium_interest` del QA de DEPLOY: el dump de dev es el que se restaura en Neon.
- Sin migración: el cambio es de lectura. Backup del día ya existente
  (`backups/adondesalimos_2026-08-01_111256.sql.gz`), verificado con `npm run backup:check`.
- La sesión quedó **cerrada** (`POST /api/auth/sign-out`), no la de pepe.

---

## QA — Alias de zonas: CABA sistemático + hitos/POIs (2026-08-01)

**Veredicto:** APROBADO
**Verificación técnica:** `npx tsc --noEmit` limpio · tests **618/618** ✅ (3 nuevos) ·
`npm run build` ✅ (con el dev server parado)
**Alcance:** los **dos** ítems de alias del BACKLOG § *Mejoras futuras* — CABA sistemático desde
el GeoJSON de BA Data y la pasada de hitos/POIs. Sin spec: es tarea de datos, confirmado en la
sesión de autoría de v2 (2026-07-29). **78 → 135 alias** (+8 barrios de CABA, +1 forma abreviada,
+48 hitos).
**Método:** dos cruces geométricos con turf sobre los polígonos versionados de `data/zones/`
(nunca "me suena"), más el catálogo de Postgres como árbitro. Los hitos salieron de **tres
agentes independientes** con lentes distintas (por categoría · por zona · por qué tipea la gente),
cruzados entre sí.

| ID | Criterio | Resultado | Evidencia |
|----|----------|-----------|-----------|
| ALIAS-01 | Los 48 barrios oficiales de CABA quedan cubiertos | ✅ PASS | Cruce por solapamiento de polígonos (`caba-barrios.geojson` × las 21 zonas): **38 ya estaban** (30 matchean por nombre de zona, 8 eran alias) y **10 faltaban**. Ningún barrio quedó sin zona |
| ALIAS-02 | Cada alias nuevo de CABA cae geométricamente en su zona | ✅ PASS | Los 8 dan **100,0 % de solapamiento** con la zona a la que apuntan (Agronomía, Villa Real, San Cristóbal, Parque Chacabuco, Mataderos, Villa Lugano, Villa Soldati, Villa Riachuelo). Ninguno quedó por debajo del 90 % |
| ALIAS-03 | No se pisa ningún alias curado a mano | ✅ PASS | De los 10 candidatos, **2 se descartaron por redundancia**: `Paternal` (ya lo cubre `La Paternal` por substring) y la forma con punto sin uso real. Palermo quedó afuera: se reparte 73/12/8/7 % entre sus 4 zonas, no tiene alias único |
| ALIAS-04 | Un hito entra solo con corroboración independiente | ✅ PASS | Regla: **≥ 2 de 3 agentes** proponen el hito **y** sus coordenadas caen en la **misma** zona por point-in-polygon. De 105 propuestas: **42 corroboradas**, 43 con un solo agente (descartadas), 13 redundantes, 7 en conflicto |
| ALIAS-05 | Los conflictos se arbitran con dato, no con criterio | ✅ PASS | Los 7 en disputa se resolvieron con lugares reales del catálogo en la dirección del hito. **En 3 el dato le ganó a los agentes**: `Distrito Arcos` es **palermo-soho** (7 lugares en Paraguay 4979) y no Hollywood ni Belgrano; `Hipódromo de Palermo` es botanico-alto-palermo (7 lugares en Libertador 4101), no Las Cañitas; `Cancha de Vélez` es flores-floresta (J. B. Justo 9200), no Devoto. `Unicenter` → martinez-acassuso (10 lugares, 100 %) |
| ALIAS-06 | Una coordenada alucinada no sobrevive | ✅ PASS | `Movistar Arena`: 2 agentes decían villa-crespo y 1 chacarita. Verificado externamente (**Humboldt 450, Villa Crespo**) y contra el catálogo (Corrientes 6099 cae en villa-crespo). El agente que erró quedó afuera del resultado |
| ALIAS-07 | Lo ambiguo por construcción se excluye, no se fuerza | ✅ PASS | **Campo de Polo descartado**: el polígono de `las-canitas` incluye parte del predio (documentado en `data/zones/README.md`), así que no tiene una zona única. `Ezeiza` también fuera: cae afuera de las 46 zonas, y los 3 agentes coincidían |
| ALIAS-08 | Test de la propiedad, no de la lista | ✅ PASS | `lib/zones/__tests__/alias.test.ts`: todo alias apunta a un slug que existe en `ZONAS`, y no hay dos filas para el mismo texto normalizado |
| ALIAS-09 | La cobertura de CABA queda blindada contra regresión | ✅ PASS | Tercer test: los **47 barrios** de `BARRIOS_POR_ZONA` resuelven a su zona por nombre o por alias. Cazó que `Villa Gral. Mitre` (la forma del archivo oficial) no resolvía con el curado `Villa General Mitre` → se agregó esa forma |
| ALIAS-10 | El delta del prefijo del chat, medido | ✅ PASS | `count_tokens` (gratis) antes y después: **8.777 → 9.726 tokens (+949, +10,8 %)**, ~16,6 por alias. A tarifa Sonnet 5: **US$3,56 por cada 1.000 conversaciones nuevas** (cache write 1,25×) y US$0,28 por cada 1.000 mensajes que leen caché. Sigue 9,5× por encima del mínimo cacheable de Sonnet (1.024) |
| ALIAS-11 | Un alias nuevo resuelve en la pantalla | ✅ PASS | En vivo con Playwright sobre `https://adondesalimos.ngrok.app`. **Hito**: tipear `movistar arena` ⇒ sugerencia *"Villa Crespo — Movistar Arena"*; click ⇒ `?z=villa-crespo` con lugares reales. **Barrio nuevo**: `mataderos` ⇒ *"Flores y Floresta — Mataderos"*; click ⇒ `?z=flores-floresta`. El alias se muestra como el "por qué" de la zona, que es el patrón ya existente |
| ALIAS-12 | Atribución de la fuente | ✅ PASS | El GeoJSON de BA Data **ya estaba atribuido** en `/legales` desde el spec ZONAS (`app/legales/page.tsx:136`) — no hace falta sumar nada. Cero fuentes nuevas: no se usó OSM |

### Notas de operación

- **Carga a la base:** `npm run zones:load` → 46 zonas, **135 alias**. Es aditivo (upsert de zonas
  sin tocar `active`, alias con `onConflictDoNothing`): no borra nada, así que no exigía backup.
  Igual había uno del día (`npm run backup:check` ✅).
- **Los alias NO son datos sueltos como la curaduría**: viven en `lib/zones/canon.ts`, o sea en
  git. Una base recreada los recupera con `zones:load`. No aplica la advertencia de `place_tags`.
- **Falso negativo del propio QA, y cómo se cazó.** En la primera pasada pareció que con una zona
  aplicada el desplegable **no sugería nada** (ni `belgrano` ni `pizza`), y se llegó a anotar como
  hallazgo. Era **mentira del método, no del producto**: el dropdown depende del estado `enfocado`
  (`search-shell.tsx:131`), que se prende en `onFocus`, y Playwright tipeó sin generar ese evento
  (el campo ya era el `activeElement` después de navegar). Con un **click explícito** en el campo
  antes de tipear, funciona: `belgrano` ⇒ *"Belgrano — Zona"* y `unicenter` ⇒ *"Martínez y Acassuso
  — Unicenter"*, con el chip `Flores y Floresta` puesto. **El autocompletar anda con zona aplicada,
  también para los alias nuevos.** Regla que queda: en QA con Playwright, **hacer click en el input
  antes de tipear** — sin el click, un componente que depende de `onFocus` se ve roto sin estarlo.
- **El catálogo no sirve como fuente de hitos**, medido: de 30 hitos conocidos, solo **5** tenían
  respaldo (Movistar Arena: 0 lugares; La Bombonera y Luna Park: 1). Overture trae gastronomía, y
  un hito aparece solo si hay bares con su nombre. Por eso las coordenadas salieron del cruce de
  agentes y el catálogo quedó como **árbitro**, que es donde sí rinde.

---

## QA integral #2 — sesión 1 (bloques A + B) (2026-08-02)

**Veredicto:** _(en ejecución)_
**Alcance:** `INT2-01..22` + `INT2-40`, según `docs/qa/PLAN-QA-INTEGRAL-2.md` (§ 4, § 5). Los
bloques C/E van en la sesión 2 y D/F en la 3. **No re-corre** el DoD de ningún spec.
**Config:** A — dev normal, con `NEXT_PUBLIC_MP_PUBLIC_KEY` cargada (§ 3 bis del plan).
**Método:** Playwright MCP + `fetch` con sesión real contra `https://adondesalimos.ngrok.app`
(dev server de Fer en 5178) + `SELECT` directos al Postgres (Docker, 5439). Click en el input
antes de tipear, siempre. El estado anónimo se confirma con `GET /api/auth/get-session`.

### Marcas de arranque (lo que hace verificable la limpieza del bloque F)

- **Timestamp de arranque:** `2026-08-02 17:20:12.731877+00` (= 14:20 AR). Todo lo sembrado por
  este QA tiene `created_at >=` ese valor.
- **Backup previo:** `backups/adondesalimos_2026-08-02_141723.sql.gz` (5,0 M).
- **Convención de marcado:** votaciones con título `[QA2]`, listas con nombre `QA2 ·`.

### Snapshot ANTES (§ 9 del plan — el mismo `SELECT` se re-corre al cerrar la sesión 3)

| tabla | filas | | tabla | filas |
|---|---|---|---|---|
| `place_lists` | 1 | | `place_owner_content` | 1 |
| `place_list_items` | 0 | | `place_photos` | 2 |
| `polls` | 6 | | `subscriptions` | 3 |
| `poll_options` | 25 | | `users` | 4 |
| `poll_votes` | 19 | | `chat_conversations` | 15 |
| `premium_interest` | 0 | | `chat_messages` | 38 |
| `place_claims` | 1 | | | |

### INT2-40 — arreglado ANTES de ejecutar (decisión de Fer, opción A)

El plan lo clasifica 🔴 *destruye datos*, y § 10 bis manda parar y arreglar antes de seguir. Fer
eligió arreglar primero. **Al ir al código, el diagnóstico del BACKLOG resultó sobre-declarado en
un punto y confirmado en otro:**

- **El editor precarga como tildados TODOS los `place_tags`, sin distinguir `source`**
  (`facetasConElegidos`, [query.ts:241](../../lib/negocio/query.ts#L241) → `elegidos` en
  [editor-client.tsx:60](../../app/mi-negocio/[placeId]/editor-client.tsx#L60)). Así que guardar
  sin tocar nada **no borraba** los tags de curaduría: los re-escribía con `source='owner'`. La
  frase "sus tags admin desaparecen" solo era literal si el dueño **destildaba** uno.
- **Pero la pérdida era real igual, y peor porque es invisible**: el canario de
  `/consistency-check` cuenta `source='admin'` y habría bajado sin que nadie borrara nada; y con
  la decisión 12.3 del plan (los tags del dueño dejan de aplicarse al revocar el reclamo), un
  guardado inocente convertía trabajo pago de la casa en algo que una revocación apaga.
- **Todavía no le pasó a nadie:** cero lugares con sugerencias aceptadas sin tags `admin`. El
  canario sigue en **3.967 tags / 1.202 lugares**. No hubo nada que restaurar.
- **Kansas nunca fue curado** (0 filas en `place_tag_suggestions`, sus 5 tags ya son `owner`), así
  que `INT2-14` tal cual **no** reproduce el caso: hace falta sembrar un tag `admin` en Kansas
  como setup (anotado abajo y revertido en la sesión 3).

**Fix aplicado** (`lib/negocio/acciones.ts`, solo código, sin migración): el `delete` borra todo lo
que no es curaduría **más** la curaduría que el dueño destildó; el `insert` de lo tildado lleva
`onConflictDoNothing`, así que una fila `admin` que sobrevive **conserva su `source`**. Las de
`import` tildadas siguen pasando a `owner` — decisión 14 intacta, y así el re-import de Overture no
se lleva lo que el dueño confirmó. **Regla de producto** (Fer, 2026-08-02): *el dueño gana sobre lo
que él tildó; la curaduría sobrevive en lo que él no tocó; destildar sí borra* — una pantalla que
dice "guardamos" y no guarda mentiría sobre en qué búsquedas aparece su lugar.
Test nuevo en `panel.integration.test.ts` (sobrevive tildada como `admin` · se va destildada).
**Verificación:** `tsc --noEmit` EXIT 0 · **619/619** tests PASS (58 archivos).

### Casos

| ID | Caso | Resultado | Evidencia |
|----|------|-----------|-----------|
| INT2-01 | Home anónima: 4 chips + «Para ahora» | ✅ PASS | **Domingo 2026-08-02, 14:25 AR** → franja **almuerzo** (11:00–15:29). «Para ahora» va **primero** y no descuenta: 1 + 4 (`Salida con chongo`, `Salir a bailar`, `After office`, `Tomar algo`) + "Ver más". Tocarlo escribe `?t=almuerzo`, la franja correcta. **Ninguna regla de `chips.schedule` matchea a esa hora** (merienda arranca 16:00 el finde), así que el orden es el de `sort` — como corresponde. *Nota, no bug:* falta `Salida con amigos` (`sort` 0) porque **da 0** y la decisión 25 no lista chips vacíos: exige `precio-2`, que tiene **1 sola fila en todo el catálogo** (el hueco de Precio ya medido). Lo reemplaza `Tomar algo` (`sort` 9), exactamente lo que documenta [chips.ts:114-118](../../lib/search/chips.ts#L114) |
| INT2-02 | Búsqueda por alias de zona | ✅ PASS | Con **click en el input antes de tipear**: `unicenter` → desplegable "Zonas → Martínez y Acassuso / Unicenter" → aplica `?z=martinez-acassuso`, chip "Quitar Martínez y Acassuso" puesto y resultados de la zona |
| INT2-03 | Abrir ficha desde el resultado | ✅ PASS | Fabric Sushi (Martínez): la ficha carga con «Guardar» y «Compartir» visibles |
| INT2-04 | «Guardar» sin sesión, en card **y** en ficha | ✅ PASS | Card → `/login?callbackUrl=%2F%3Fz%3Dmartinez-acassuso`; ficha → `/login?callbackUrl=%2Flugar%2F35a9ac19…`. Cada superficie manda a su propio destino. **Nada se escribió**: `place_list_items` seguía en **0** |
| INT2-05 | Loguearse y volver | ✅ PASS | pepe se loguea desde ese login → vuelve a la ficha (no a la home) y ahí sí guarda: 1 fila en `place_list_items` (17:28:28, posterior al arranque) sobre la lista default de pepe |
| INT2-06 | Free crea votación con 5 opciones | ✅ PASS | **juan** (pepe ya tenía una activa y el free topea en 1 — se usó otra cuenta en vez de tocar datos preexistentes). Al llegar a 5/5 los demás «Agregar» quedan **disabled**. Creada: `[QA2] ¿Dónde caemos?`, token `qEldE5XX22SF-9a7TJJKNg`, `allow_suggestions=true` |
| INT2-07 | Anónimo vota sin cuenta | ✅ PASS | Sesión `null` confirmada por `get-session`. Vota por cookie `voter_id`: "Tu voto", "1 voto en total · Podés cambiar tu voto mientras esté abierta" |
| INT2-08 | Anónimo sugiere 2 (su tope) y prueba la 3ra | ✅ PASS | Suma Bierhaus y Holzhacker (5+2=7). El botón se apaga con motivo: *"Ya sumaste 2 lugares. Dejale lugar al resto."* Y **el gate es server-side**, no solo UI: `POST …/opciones` → **409 `LIMITE_SUGERENCIAS`** |
| INT2-09 | 2do dispositivo llega a 8 y prueba la 9na | ✅ PASS | Dispositivo 2 = cookie `voter_id` propia (curl con jar aparte). 8va → **201**. 9na → **409 `VOTACION_LLENA`**: *"Esta votación ya tiene 8 lugares, que es el máximo."* **Cita el total (8), no el techo del creador (5)** — los dos techos quedan bien separados. La UI dice lo mismo: *"La votación llegó a 8 lugares, que es el máximo"* |
| INT2-10 | Quitar una sugerida que ya tiene votos | ✅ PASS | Bierhaus con 2 votos (uno de cada dispositivo). El creador toca «Sacar» → panel de confirmación **antes** de nada: *"Si lo sacás se pierden 2 votos. Esto no se puede deshacer."* + "Sí, sacarlo" / "Volver". Al confirmar: opción borrada y `poll_votes` de la votación en **0** — la cascada se llevó los dos |
| INT2-11 | Cerrar y buscarla en `/mis-votaciones` | ✅ PASS | Free la ve como "Activa" con el copy del gate (*"Por ahora ves solo la activa; las cerradas siguen por su link"*). Al cerrar (con elección de ganador) sale del panel → estado vacío. En DB: `status=closed`, `closed_at`, `winner_place_id`. No entra a ningún historial: el free no lo tiene (INT2-21) |
| INT2-12 | Dueño en `/mi-negocio/[Kansas]` con `owner_plan='free'` | ✅ PASS | Ve su panel; los 3 campos pagos **disabled** con el aviso "Activá el plan del lugar acá arriba"; fotos "**2 de 3** · El plan pago llega a 15" |
| INT2-13 | «Avisame cuando abra» (pitch B2B) | ⏭️ DIFERIDO | **No es corrible en config A** y el plan se contradice: § 4 lo pone en la sesión 1, pero § 3 bis y § 11 lo asignan a la pasada de config B. Verificado en vivo: con `NEXT_PUBLIC_MP_PUBLIC_KEY` cargada, `/mi-negocio` muestra **"Suscribirme por $ 15.000/mes"**, no el botón de interés. Va a la sesión 3 junto a INT2-32 y INT2-42. `premium_interest` sigue en **0 filas** |
| INT2-14 | `owner_plan='paid'` + cargar descripción/carta/novedad | ✅ PASS | Setup por `UPDATE` (revertido, ver abajo). Guardado OK → los 3 en `place_owner_content`. **No pueden ir a las columnas base**: `places` ni siquiera tiene columna `description` |
| INT2-15 | Anónimo abre la ficha del lugar pago | ✅ PASS | Ve los 3 extras: novedad "[QA2] Happy hour de 18 a 20", link **"Ver la carta"** y bloque **"Sobre el lugar"**. El botón «Guardar» sobre un lugar pago funciona igual: → `/login?callbackUrl=%2Flugar%2F6323f392…` |
| INT2-16 | Volver a `owner_plan='free'` y recargar | ✅ PASS | Los tres extras **desaparecen** de la ficha (`QA2` no aparece en ningún lado, ni "Ver la carta", ni "Sobre el lugar") y las filas siguen intactas en `place_owner_content` (`description`/`menu_url`/`news` NOT NULL). Ocultar ≠ borrar, confirmado sobre la ficha pública |
| INT2-17 | Barrido del anónimo sobre las 6 superficies nuevas | ✅ PASS | Sesión `null` por `get-session` (nunca por cookies). `/mis-lugares` → `/login?callbackUrl=/mis-lugares` · `POST`+`DELETE /api/favoritos` → **401 NO_SESSION** · `POST /api/listas`, `PATCH`+`DELETE /api/listas/[id]` → **401** · `GET /api/votaciones/historial` → **401** · `POST /api/billing/interes` → **401** · `POST …/opciones` **sí funciona anónimo** (es la feature, no un gate): las dos sugerencias de INT2-08 entraron sin sesión. **`GET /api/favoritos?ids=…` → 200 `{guardados:[],listas:[]}` y no filtra nada**: se pidió con el id de Fabric Sushi, que **sí está guardado por pepe**, y los dos arrays vuelven vacíos |
| INT2-18 | juan hace `PATCH`/`DELETE` sobre una lista ajena | ✅ PASS | Los dos → **404 `LISTA_NO_ENCONTRADA`** (oculta la existencia, mismo criterio que `/admin` y `/mi-negocio`). **Verificado en DB**: la lista sigue llamándose "Mis lugares", no "QA2 · HACK juan". El 403 de pantalla no habría alcanzado |
| INT2-19 | Un votante borra la sugerencia **de otro dispositivo** | ✅ PASS | **403 `NO_AUTORIZADO`**: *"Solo podés sacar los lugares que sumaste vos."* Y el propio autor tampoco puede si ya tiene votos: **409 `OPCION_CON_VOTOS`** — lo que deja probado que el borrado de INT2-10 fue **por ser creador**, no por ser autor |
| INT2-20 | Un votante borra una opción original del creador | ✅ PASS | **403 `OPCION_ORIGINAL`**: *"Esa opción es parte de la votación original y no se puede quitar."* |
| INT2-21 | Free hace `GET /api/votaciones/historial` | ✅ PASS | **403 `NO_PREMIUM`** (no 401: la sesión existe, el plan no alcanza) — la distinción que pedía el plan |
| INT2-22 | Free crea una 2da lista | ✅ PASS | **403 `LIMITE_LISTAS`** con juan teniendo **0 listas creadas**: el cupo **cuenta la default aunque todavía no exista**, que era justo el punto del caso |
| INT2-40 | Guardar del dueño × tags de curaduría | ✅ PASS (sobre el fix) | Setup: se sembró `grupos-grandes` con `source='admin'` en Kansas (nunca fue curado). **Confirmado en vivo el "sin enterarse"**: el editor lo muestra **tildado e indistinguible** de los del dueño (`aria-pressed=true`, "Ambiente · 2 elegidos"). Tras guardar el formulario entero: la fila **sigue con `source='admin'`**, las del dueño siguen `owner`, y el tag **se aplica** en la ficha pública ("Grupos grandes"). Con el código anterior habría quedado `owner` |

### Veredicto de la sesión 1

**APROBADO — 22 casos ejecutados, 21 PASS + 1 diferido por configuración. Cero bugs nuevos.**
El único 🔴 del plan (INT2-40) entró arreglado a esta sesión y quedó verificado en vivo.

### Hallazgos que no son bugs (van al BACKLOG como decisión, no como fix)

1. **El plan se contradice sobre INT2-13** (§ 4 lo pone en la sesión 1 · § 3 bis y § 11 en la
   pasada de config B). Manda § 11: en config A el botón «Avisame cuando abra» no existe. Sin
   cambio de código; se corrige la tabla del § 4 del plan.
2. **`Salida con amigos` no llega a la home y la causa es de datos, no de código**: su chip exige
   `precio-2` y la faceta Precio tiene **1 fila en 14.458 lugares**. Mientras Precio siga vacía,
   el chip `sort` 0 nunca se ve — y lo mismo vale para cualquier chip futuro que incluya un tag de
   Precio. Es el costo concreto del hueco ya medido (OSM no lo rinde), visible en la portada.

### Estado sembrado / tocado (para la limpieza del bloque F, sesión 3)

| Qué | Estado | Cómo se revierte |
|-----|--------|------------------|
| `place_list_items` | +1 (Fabric Sushi en la lista default de pepe) | `delete` por `created_at >= 17:20:12` |
| `polls` + `poll_options` | +1 votación `[QA2] ¿Dónde caemos?` (closed) + 7 opciones | `delete from polls where title like '[QA2]%'` (cascada) |
| `poll_votes` | +0 — los 2 que hubo cayeron con INT2-10 | nada |
| `place_lists` | **sin cambios** (el free no pudo crear la 2da) | nada |
| `premium_interest` | **sin cambios (0)** | nada |
| `places.owner_plan` de Kansas | `free` → `paid` → **ya revertido a `free`** ✅ | hecho |
| `place_tags` de Kansas | +1 fila `grupos-grandes` `source='admin'` (sembrada para INT2-40) | `delete from place_tags where place_id='6323f392…' and source='admin'` |
| **`place_owner_content` de Kansas** | ⚠️ **`description`/`menu_url`/`news` PISADOS con texto `[QA2]`** | Los valores previos (del QA de AUTH F3) **no se capturaron antes de sobrescribir**: se restauran desde `backups/adondesalimos_2026-08-02_141723.sql.gz`. El conteo de filas no cambió, así que el snapshot del § 9 **no lo detecta** — anotado acá para que no se pase |
| `google_api_usage` | `details` 3 → **5** (2 aperturas de ficha de Kansas); `photos` sin moverse | Se deja (decisión 2 del plan). `photos` quieto es lo correcto: el lugar tiene fotos propias |
| Agregados diarios | filas del 2026-08-02 en `place_impressions_daily` / `place_tag_impressions_daily` / `place_taps_daily` | los tres `delete` del § 9 |

### Nota de método

El panel de confirmación de INT2-10 **no apareció al primer click** y sí al segundo, sin cambiar
nada. No se registra como hallazgo: el estado es local (`setAConfirmar`, sin red) y el
comportamiento es correcto y reproducible — lo más probable es que el primer click llegara antes
de la hidratación. Se anota porque es la clase de síntoma que, sin explicación en el código,
habría entrado como ❌ falso (§ 10.3 del plan).

---

## QA integral #2 — sesión 2 (bloques C + E) (2026-08-02)

**Veredicto:** **APROBADO — 10 casos, 7 ✅ PASS + 3 ⚠️ documentados. Cero bugs de producto.**
**Alcance:** `INT2-23..29` (bloque C) + `INT2-36`, `38`, `39` (bloque E), según
`docs/qa/PLAN-QA-INTEGRAL-2.md` (§ 6, § 8). `INT2-37` (madrugada) sigue suelto y no bloquea.
**Config:** A — dev normal, con `NEXT_PUBLIC_MP_PUBLIC_KEY` cargada.
**Método:** Playwright MCP + `fetch` con sesión real contra `https://adondesalimos.ngrok.app`
+ `SELECT` directos al Postgres. Click en el input antes de tipear. Todo caso del bloque E anota
**hora y día AR exactos**.

### Marcas de arranque (sesión 2)

- **Backup previo:** el mismo del día, `backups/adondesalimos_2026-08-02_141723.sql.gz`
  (`npm run backup:check` → *hace 0 día(s)*).
- **Reloj de la sesión:** **domingo 2026-08-02**, de las **14:50** a las **15:10 AR**
  (= día **6** en la convención del proyecto, 0 = lunes).
- **Valor viejo de `app_settings['chips.schedule']`**, capturado textual **antes** del primer
  `UPDATE` (lección de la sesión 1 — el snapshot por conteo no ve un valor pisado):
  ```json
  [{"dias":[0,1,2,3,4],"desde":"17:00","hasta":"21:00","primero":["after-office"]},
   {"dias":[4,5],"desde":"22:00","hasta":"05:00","primero":["salir-a-bailar"]},
   {"dias":[5,6],"desde":"16:00","hasta":"19:00","primero":["merienda"]}]
  ```
  **Ya restaurado** al cerrar el bloque E, y verificado con un `SELECT` posterior.
- **Premium aislado:** se usó **hugo** (`UPDATE users SET plan='premium'`), no
  `frodriguez.este` — que es admin **y** dueño **y** premium a la vez, y por eso no sirve para
  atribuirle nada a un solo eje.

### Casos

| ID | Caso | Resultado | Evidencia |
|----|------|-----------|-----------|
| INT2-23 | Premium × favoritos en las 3 superficies | ✅ PASS | hugo guarda **Fabric Sushi** y **Sushi Town** desde la **card** (botón → "Sacar de guardados" `[pressed]`, 2 filas en `place_list_items` sobre la default creada al vuelo). **Ficha** de Fabric Sushi: `Sacar de guardados` `[pressed]`. **Chat** ("Sushi en Martínez", 1 mensaje): trajo 5 lugares y pintó `[pressed]` **solo** en los 2 guardados, y `Guardar` en SushiClub Acassuso, Leny San y Dashi. El desfasaje se buscó donde podía estar: `GET /api/favoritos?ids=` con los 3 ids de Martínez devuelve los 2 guardados y **omite** el no guardado. Tres caminos (server render × 2 + lote), un solo dato |
| INT2-24 | Cupo de 10 listas con la default incluida | ✅ PASS | hugo con su default ya creada: creaciones 1→9 → **201**; la **10ma** → **403 `LIMITE_LISTAS`**, *"Llegaste a las 10 listas. Borrá alguna para armar otra."* El error llega en la 10ma, no en la 11va. Sin fila en `app_settings` ⇒ rige el default de código (10), el caso que el docstring contempla. **La UI no miente**: con el cupo lleno el botón «Nueva lista» **no se renderiza** (`puedeCrear` viene del server, [page.tsx:32](../../app/mis-lugares/page.tsx#L32) → `puedeCrearLista`); se borró una lista y **reapareció**, así que la ausencia no es que el botón nunca esté |
| INT2-25 | Historial premium con 21+ y el borde del cursor | ✅ PASS | 22 votaciones cerradas sembradas, con **Cerrada 20 y Cerrada 21 compartiendo `created_at` exacto** — el corte de página cae justo en el empate, que es el caso duro. Página 1 = 20 (01→20), «Ver más» → 21 y 22. **Cero duplicados, cero salteos**, `nextCursor: null` al agotar y el botón desaparece. El desempate por `id` hace lo que promete el docstring. *(La primera corrida dio un falso positivo — ver § Nota de método.)* |
| INT2-26 | «Para ahora» × ficha con horarios propios | ⚠️ EXPECTATIVA DOCUMENTADA (no es ❌) | **Domingo 15:02 AR.** Kansas Grill & Bar es el **único** lugar con horarios de dueño y tiene el **domingo vacío**. Como sus tags no incluían ninguno de Momento, se le sembró `almuerzo`/`merienda` para poder cruzarlo. Resultado: **sale en `?t=almuerzo`** y su ficha dice **"Cerrado ahora"** con el acordeón *"Domingo: Cerrado"*. Es coherente con el diseño: el chip filtra por **tags curados de franja**, no por horarios reales. *Corrección al enunciado del plan:* el estado abierto/cerrado de la ficha **no** está gateado en ≥50 lugares — con horarios de dueño la ficha computa `estaAbierto(horarios, ahora)` siempre ([ficha-google.tsx:217](../../components/lugar/ficha-google.tsx#L217)); el gate de ≥50 es de otra superficie |
| INT2-27 | Admin × `chips.schedule` | ✅ PASS | **Por dónde se edita hoy: solo por `UPDATE` a mano.** `/admin` tiene 5 tabs (Cola de aprobación · Precios · Suscripciones · Costos · Curaduría) y **ninguna** toca chips — coincide con el docstring de `rotacion.ts` (*"el setting es `jsonb` editado a mano con SQL"*). Un valor inválido **degrada en silencio al orden por `sort`** sin romper la home (detalle por variante en INT2-39) |
| INT2-28 | Admin × contador de interés premium | ⚠️ CUENTA BIEN, con 2 observaciones al BACKLOG | Se sembraron 3 filas (**1 B2C** `place_id IS NULL` de pepe + **2 B2B**: pepe→Kansas, juan→Hard Rock). El tab muestra **"3 pidieron que les avisemos"** —el conteo real— y **distingue los dos ejes por fila**: `· Premium (B2C)` vs el nombre del lugar ([suscripciones.tsx:67](../../app/admin/suscripciones.tsx#L67)). Lo que **no** hace: (a) desagregar el contador por eje, y son dos economías distintas ($7.000 vs $15.000); (b) el número es `interesados.length`, **topeado en 200** por `getInteresadosAdmin()` — `contarInteresados()`, cuyo docstring dice *"el conteo, sin el techo del límite de la lista"*, existe y **solo la usa un test** |
| INT2-29 | ¿Qué cuenta cada superficie? | ⚠️ ENTREGABLE = TABLA (ver abajo) | **El enunciado del plan quedó viejo: el chat SÍ suma `impressions`.** Verificado en datos, no en código nada más: **Dashi** salió únicamente en el chat y tiene **1 impresión** de hoy. El fix es de julio — el propio código lo cita: *"INT-05 (PULIDO): un lugar mostrado como card en el chat es tan impresión como uno mostrado en la búsqueda"* ([chat.ts:190](../../lib/ai/chat.ts#L190), commit `4c0c5cf`). La divergencia que INT-05 encontró **ya está cerrada** |
| INT2-36 | «Para ahora» aplica los tags de la franja actual | ✅ PASS | **Domingo 15:01 AR** → franja **almuerzo** (11:00–15:29). El chip escribe `?t=almuerzo`, deja el filtro «Quitar Almuerzo» puesto y Filtros en 1. Contrastado contra la base: los 3 primeros resultados (Hard Rock Cafe, Fabric Sushi, La Farola de Cabildo) **tienen** el tag; **605** publicados lo tienen en total. Kansas Grill & Bar **no** aparecía y en la base **no** tenía el tag — el negativo también cierra |
| INT2-38 | Regla de `chips.schedule` que cruza medianoche | ✅ PASS | Se editó la regla en vez de esperar al sábado 01:00. Regla `{"dias":[5],"desde":"22:00","hasta":"16:00","primero":["merienda"]}` = **sábado 22:00 → domingo 16:00**, evaluada el **domingo 15:04 AR**: el día 6 **no está** en `dias`, así que solo puede entrar por el tramo *"la madrugada de hoy pertenece a la regla que arrancó ayer"*. **`Merienda` saltó al primer lugar** (desplazando a `Tomar algo`). **Control negativo:** la misma regla con `dias:[4]` (viernes) → Merienda desaparece y vuelve `Tomar algo`. El cruce es la causa, no una coincidencia |
| INT2-39 | `chips.schedule` inválido | ✅ PASS | **Domingo 15:05–15:07 AR.** Cuatro variantes, la home **nunca** se rompió y siempre degradó al orden por `sort`: (a) **objeto en vez de array** → orden por `sort`; (b) **mixto** — `dias:"lunes"` + `desde:"25:99"` + una regla buena en el mismo array → **las dos rotas se descartan y la buena sobrevive** (`Merienda` primero), que es el "regla por regla" del docstring, y la rota que pedía `salir-a-bailar` no se coló; (c) **slug inexistente** (`este-chip-no-existe`) → se ignora al cruzar con los chips vivos; (d) **`null`** → caso normal, sin log. *La variante "JSON roto" del plan **no es alcanzable**: la columna es `jsonb` y Postgres rechaza el `UPDATE` (`invalid input syntax for type json`) — el tipo la hace imposible.* El *"un solo log por proceso"* (`yaAviso`) se verificó **en código**, no en vivo: el `console.warn` sale por la terminal del dev server, que esta sesión no ve |

### INT2-29 — Qué cuenta cada superficie (el entregable del caso)

| Superficie | `impressions` | `detail_views` | `saves` | `taps` | `tag_impressions` | `destacados` |
|---|---|---|---|---|---|---|
| Home / búsqueda (server, `app/page.tsx`) | ✅ | — | — | — | ✅ | ✅ |
| `/api/search` (scroll, mapa, **y el buscador de una votación**) | ✅ | — | — | — | ✅ | ✅ |
| Ficha `app/lugar/[id]` | — | ✅ | — | — | — | — |
| **Chat** (`lib/ai/chat.ts`) | ✅ *(desde `4c0c5cf`)* | — | — | — | ❌ | ❌ |
| `POST /api/favoritos` (guardar, desde cualquier superficie) | — | — | ✅ | — | — | — |
| `DELETE /api/favoritos` (sacar) | — | — | **no resta** (decisión 12: es histórico de eventos, no stock) | — | — | — |
| `/api/lugar/[id]/tap` | — | — | — | ✅ | — | — |

**Lo que queda como decisión de producto, no como bug:** el chat suma `impressions` pero **no**
alimenta `place_tag_impressions_daily`. Ese agregado es el insumo de la **curaduría por uso real**
(próximo ítem del backlog), así que hoy esa curaduría vería los tags de la búsqueda y **no** los
del chat. Segundo punto, más chico: buscar dentro del **armado de una votación** suma impresiones
igual que la home, porque es el mismo `/api/search` — al dueño se le cuenta una vista que ocurrió
dentro de una votación privada.

### Hallazgos (ninguno bloquea; van al BACKLOG)

1. **El contador de interés premium se congela en 200.** `app/admin/suscripciones.tsx` muestra
   `interesados.length` y la lista viene topeada (`getInteresadosAdmin(limite = 200)`).
   `contarInteresados()` existe **para exactamente este problema** y no está cableada — solo la
   llama un test. Hoy con 3 filas no se nota; a 201 interesados el tablero subestima el dato que
   dispara el cobro. 🟢 solo código, puede ir después del deploy.
2. **El contador no desagrega B2C de B2B.** La lista sí distingue por fila, el número de arriba
   no. Son dos precios distintos ($7.000 vs $15.000): decisión de producto de Fer.
3. **El chat no alimenta `place_tag_impressions_daily`** (ver arriba) → sesgo en la curaduría por
   uso real antes de que esa curaduría exista. Barato de decidir ahora, caro de descubrir después.
4. **Corrección de documentación, no de código:** el plan (§ 6, INT2-29) y el BACKLOG afirman que
   *"el chat no suma impressions"*. Es falso desde `4c0c5cf` (PULIDO, julio). El enunciado
   sobrevivió al fix.
5. **Riesgo latente, no bug hoy:** el cursor del historial viaja como epoch en **milisegundos**,
   y `created_at` en Postgres tiene **microsegundos**. Hoy no puede fallar porque la app inserta
   `createdAt: ahora`, un `Date` de JS ([acciones.ts:112](../../lib/votaciones/acciones.ts#L112)) —
   las 7 votaciones creadas por la app tienen los microsegundos en cero. Se materializaría si
   alguna vez se insertaran votaciones **por SQL o por script** (backfill, import, seed) y dos
   cayeran en el mismo milisegundo en el borde de página. Anotar el acoplamiento, no arreglarlo.

### Estado sembrado / tocado — **ampliación** de la tabla de la sesión 1

| Qué | Estado al cerrar la sesión 2 | Cómo se revierte |
|-----|------------------------------|------------------|
| `users.plan` de **hugo** | `free` → **`premium`** ⚠️ **sin revertir** (lo usa la sesión 3) | `update users set plan='free' where email='hugo@gmail.com'` |
| `polls` | 7 → **29** (+22 `[QA2] Cerrada NN`, todas `closed`, creador hugo, `winner` = Hard Rock Cafe). **Sin `poll_options`** — el historial no las necesita cuando hay título | `delete from polls where title like '[QA2]%'` (cascada) |
| `place_lists` | 1 → **11** (+1 default de hugo, nacida al guardar + **9** `QA2 · Lista NN`) | `delete from place_lists where name like 'QA2 ·%'` + la default de hugo |
| `place_list_items` | 1 → **3** (+2 de hugo: Fabric Sushi, Sushi Town) | `delete` por `created_at >= 17:20:12` |
| `premium_interest` | 0 → **3** (1 B2C de pepe · 2 B2B: pepe→Kansas, juan→Hard Rock) | `delete from premium_interest` (las 3 son del QA; la tabla estaba vacía) |
| `place_tags` de Kansas | +2 filas `source='admin'` (`almuerzo`, `merienda`, sembradas para INT2-26) | ya cubierto por el `delete … and source='admin'` anotado en la sesión 1 |
| **Canario de curaduría** | `place_tags source='admin'`: 3.967 → **3.970** (+1 sesión 1, +2 sesión 2) | **subió, no bajó** — sin pérdida de datos |
| `app_settings['chips.schedule']` | tocado 7 veces y **restaurado al valor original** ✅ verificado | hecho |
| `chat_conversations` / `chat_messages` | 15→**16** / 38→**40** (1 mensaje de chat, INT2-23) | `delete` por `created_at >= 17:20:12` |
| `google_api_usage` (2026-08) | `details` 5 → **8** · `photos` → **4** (2 fichas abiertas: Fabric Sushi y Kansas) | se deja (decisión 2 del plan) |
| Agregados diarios | más filas del 2026-08-02 en las 3 tablas | los tres `delete` del § 9 |
| Sin tocar | `place_claims` (1) · `place_owner_content` (1) · `place_photos` (2) · `subscriptions` (3) · `users` (4) · `poll_votes` (19) | — |

### Nota de método — el falso ❌ de INT2-25, y por qué no se escribió

La primera corrida de INT2-25 **salteó una fila**: 22 sembradas, 21 servidas, y la que faltaba era
justo la que empataba `created_at` en el borde. Tenía todo para ser un ❌ grande —el docstring
promete explícitamente que el cursor *"no repite ni saltea filas cuando dos votaciones comparten
timestamp"*—. La causa raíz se aisló en SQL: el cursor viaja truncado a milisegundos y la fila
tenía microsegundos, así que no pasaba ni el `<` ni el `=`.

**Pero el sub-milisegundo lo había puesto el instrumento, no el producto:** la siembra usó `now()`
de Postgres, y la app inserta un `Date` de JS. Las 7 votaciones reales de la base tienen los
microsegundos en cero. Se corrigió la siembra (`date_trunc('milliseconds', …)`, manteniendo el
empate) y el caso pasó limpio.

Es la **segunda vez consecutiva** que el instrumento fabrica un hallazgo — la sesión 1 lo tuvo con
el editor del dueño. La regla del § 10.3 (*explicar el síntoma en el código antes de escribir un
❌*) es lo que lo frenó las dos veces, y conviene extenderla: **cuando el QA siembra por SQL crudo,
la siembra tiene que reproducir la precisión y los defaults que produce la app** — si no, se
prueba un escenario que en producción no existe.

---

## QA integral #2 — sesión 3 (bloques D + F) (2026-08-02)

**Veredicto:** **APROBADO CON HALLAZGOS — 10 casos: 7 ✅ PASS + 3 ⚠️/❌ documentados. Ningún
bloqueante; ningún dato perdido.** Los tres hallazgos son de comportamiento esperado-vs-real, van al
BACKLOG y **no bloquean DEPLOY F0** (ninguno necesita migración — § 10 bis del plan).
**Alcance:** `INT2-30..35`, `41` (bloque D, config A) → pasada de config B (`INT2-13`, `32`, `42`)
→ bloque F (limpieza + snapshot + dump), según `docs/qa/PLAN-QA-INTEGRAL-2.md` §§ 7, 9, 11.
`INT2-37` (madrugada) sigue suelto y no bloquea. `INT2-40` ya se había corrido en la sesión 1.
**Método:** Playwright MCP + `fetch` con sesión real contra `https://adondesalimos.ngrok.app`
+ `SELECT` directos al Postgres. Click en el input antes de tipear. **El pago lo hizo Fer**
(INT2-31); la cancelación de INT2-41 la disparó Claude desde la UI propia — no hay tarjeta de por
medio.

### Marcas de arranque (sesión 3)

- **Backup previo:** `backups/adondesalimos_2026-08-02_152039.sql.gz`, **hecho al arrancar esta
  sesión** — no se reusó el de las 14:17, que era anterior a todo lo sembrado por las sesiones 1 y
  2. Esta es la sesión que revoca claims y baja planes: la más destructiva de las tres.
- **Reloj:** domingo **2026-08-02**, de las **15:20** a las **21:12 AR** (con un corte largo entre
  INT2-31 y la pasada de config B, esperando a Fer).
- **Valores viejos capturados ANTES del primer `UPDATE`** (§ 10 del plan): `ai.chat_monthly_cap` =
  **5000** · `place_claims` de Kansas = `approved`, `decided_at` 2026-07-24 23:13:00.12,
  `admin_notes` **NULL** · `places.owner_plan` de Kansas = `free`, `publish_override` = `t`.
- **El backup previo al QA como segunda fuente.** Los conteos de
  `adondesalimos_2026-08-02_141723.sql.gz` (previo a la sesión 1) se extrajeron del `.sql.gz` y
  **coinciden uno a uno con el snapshot ANTES declarado**. El target del bloque F quedó validado de
  forma independiente, no solo por lo que anotó la sesión 1.

### Casos — bloque D (config A)

| ID | Caso | Resultado | Evidencia |
|----|------|-----------|-----------|
| INT2-30 | **premium → free** (el gordo) | ✅ PASS | hugo premium con **10 listas** (1 default + 9 `QA2 ·`), **3 votaciones activas** creadas por la app (`POST /api/votaciones` 201×3 — y eso *es* el control positivo: un free habría sido rechazado en la 2da) y **22 en historial**. Se sembró a propósito 1 lugar en `QA2 · Lista 01` y otro en `Lista 09`, porque los 2 que ya había estaban en la **default** —la lista que sobrevive al corte— y sin eso el punto (d) no se probaba. Al bajar a free: **(a)** las 9 desaparecen de `/mis-lugares` y **las 10 filas siguen vivas** en `place_lists` (4 items intactos), con copy que lo explica (*"Con premium podés armar varias listas… Por ahora tenés una sola"*); **(b)** las 3 activas **siguen abiertas y visibles**, pero la 4ta → **409 `LIMITE_ACTIVA`** y el 409 **no dejó fila** (`polls` 32 antes y después); **(c)** `/api/votaciones/historial` → **403 `NO_PREMIUM`** y la pantalla deja de listar las 22 (0 cerradas, sin «Ver más»); **(d)** al volver a premium reaparecen las 9 listas **con sus 4 items**, incluidos los 2 que estaban en listas ocultas |
| INT2-31 | **free agota el trial → paga → recupera** | ✅ PASS | pepe free con trial **3/3**. Las tres superficies verificadas **apagadas antes** del pago: chat (*"Usaste tus mensajes de prueba"*, input `disabled`, CTA → `/cuenta`), historial **403**, `POST /api/listas` **403 `LIMITE_LISTAS`**. **Pago hecho por Fer** en el Brick de MP. Después, con el mismo pago: `users.plan` → `premium`, fila `active` en `subscriptions` ($ 7.000, B2C, período hasta 2026-09-03) y **las tres se prenden**: chat **0 → 30 mensajes** y sin gate, historial **200**, crear lista **201**. **Detalle fino que cierra bien:** `chat_trial_used` queda en **3** y el cupo premium arranca en **30 limpio** — son dos contadores distintos (decisión 5/6) y el trial gastado no se descuenta del cupo pago |
| INT2-41 | **Cancelación real de la suscripción** | ✅ PASS | Cancelada desde `/cuenta`. Pantalla: el badge **sigue "Premium"** + *"Cancelada. Mantenés el acceso hasta el **2 de septiembre de 2026**. Después vuelve a free."*, y el botón desaparece. DB: `status` sigue **`active`**, `cancel_at_period_end` = **t**, `canceled_at` seteado y `current_period_end` **intacto** — la cancelación diferida de la decisión 15. Acceso vivo confirmado después de cancelar (historial 200, crear lista 201). **La fecha no es un bug de un día:** `2026-09-03 00:04 UTC` es el **2 a las 21:04 AR**. **No hizo falta consultar a MP para cerrarlo:** [cancelacion.ts:46-58](../../lib/billing/cancelacion.ts#L46) cancela el preapproval **primero** y solo escribe en la DB si MP contestó OK (si falla → 502 y no toca nada), así que la fila con `cancel_at_period_end=true` **es** la evidencia de que MP se enteró |
| INT2-34 | **owner_plan paid → free** | ✅ PASS | Lo que faltaba era el **destaque en búsqueda**, y se probó con las dos puntas: con Kansas en `paid` (**el único** `owner_plan='paid'` de la base ⇒ señal limpia) `?z=las-canitas` muestra el rótulo **"Destacado" 1 vez y Kansas 1 vez** (el dedupe de la decisión 21 no lo duplica en el orgánico); al bajar a `free` el rótulo pasa a **0** y Kansas sigue en el orgánico. **Se apaga al instante**, sin caché, como promete el docstring de `buscarDestacados`. Los 3 campos pagos se ocultan con las filas vivas, y el contenido **no pago** del dueño (teléfono, web, horarios) **sigue** — que es lo correcto. ⚠️ **Las "fotos 4-15 ocultas" NO se verificaron:** Kansas tiene 2 fotos y subir 13 más no paga el rato. Se dice, no se simula |
| INT2-35 | **Tope global de chat agotado** | ✅ PASS | Cap viejo capturado (**5000**) antes de tocarlo. Con `ai.chat_monthly_cap = 1` y `ai_api_usage` del mes en 1 (`1 >= cap`, [cupo.ts:83](../../lib/ai/cupo.ts#L83)): el chat **degrada**, no rompe — **503** y en pantalla *"El chat está descansando un rato / Se pausó por un ratito. Volvé más tarde y seguimos."* **Y no cobra el intento:** el cupo del usuario quedó intacto, `ai_api_usage` **no** incrementó y no se insertó ni un `chat_message` ni una conversación — el gate corta antes de gastar. Control positivo: restaurado a 5000, el chat responde normal y el cupo baja de 29 a 28 |
| INT2-33 | **Revocar reclamo del dueño** | ❌ **2 hallazgos** (ver abajo) | Revocado por el **endpoint real de admin** (`PATCH /api/admin/claims/[id]`, `revocado: true`), no por SQL. **Lo que sí funciona:** el contenido vuelve a Overture sin borrar la fila — teléfono `11 4776 4100` → `+541147764100`, web `https://…` → `http://www.…`, social Instagram del dueño → Facebook de Overture, horarios propios apagados, y **"¿Sos el dueño?" reaparece**. `publish_override` baja a `f` y las subs no se tocan. **Lo que no:** los tags `source='owner'` y las fotos del dueño **siguen aplicándose**. Kansas tiene `confidence 0.9993` ≫ umbral `0.5`, así que sigue publicado por confidence y el hallazgo **no queda enmascarado** por una despublicación |

### Casos — pasada de config B (`NEXT_PUBLIC_MP_PUBLIC_KEY` vaciada + restart del server por Fer)

| ID | Caso | Resultado | Evidencia |
|----|------|-----------|-----------|
| INT2-13 | Dueño toca «Avisame cuando abra» | ✅ PASS | **Se corrió al fin** — quedó diferido dos veces porque en config A ese botón no existe (el panel muestra "Suscribirme por $ 15.000/mes"). En config B aparece, y al tocarlo: **1 fila** en `premium_interest` con `place_id` = Kansas, el botón desaparece y confirma *"Listo, anotado. Te escribimos a frodriguez.este@gmail.com apenas abramos los pagos."* **Idempotencia:** 2 `POST` más al endpoint → **201 con `{nuevo: false}`** las dos veces y **sigue 1 fila**. **Control implícito del índice único parcial:** pepe ya tenía una fila →Kansas y el dueño pudo crear la suya ⇒ el índice es por **(user_id, place_id)**, no por lugar |
| INT2-32 | **Premium sin suscripción × botón de cancelar** | ⚠️ **CALLEJÓN CONFIRMADO** (no destructivo) | El escenario es **real en producción**, no artefacto: con el cobro apagado, un `UPDATE` a mano de Fer es el único camino a premium. Con hugo (premium, **sin fila en `subscriptions`**), `/cuenta` muestra "Premium" + *"$ 7.000 por mes."* **sin fecha de renovación** —esa ausencia es la única señal de que no hay sub, y el usuario no puede leerla— **y ofrece igual el botón "Cancelar suscripción"**. Al tocarlo: **404** y el mensaje inline *"No tenés una suscripción activa para cancelar."*, que **contradice** al "Premium" de dos líneas arriba. **No rompe nada** (hugo sigue premium, sin efectos en DB). Es decisión de producto → BACKLOG |
| INT2-42 | **Espejo de prod: el embudo del premium apagado** | ✅ PASS | **El embudo cierra.** juan free con trial 3/3 → el gate del chat ofrece *"Hacete premium…"* con CTA **"Hacerme premium" → `/cuenta`** → y en config B `/cuenta` **no vende**: *"Todavía no abrimos los pagos. Estamos en beta. El premium está por salir… Dejanos la señal y te escribimos apenas se pueda."* + botón **«Avisame cuando abra»**. **No hay checkout muerto ni promesa colgada.** Se recorrió la última milla: al tocar el botón, fila B2C creada (`place_id IS NULL`) + *"Listo, anotado. Te escribimos a juan@gmail.com…"*. Observación menor de copy, no ❌: el CTA promete *"hacete premium"* y la pantalla entrega *"todavía no abrimos"* — la pantalla lo maneja con gracia, pero el CTA promete un poco más de lo que puede dar |

### Hallazgos (ninguno bloquea F0; los tres van al BACKLOG)

1. **🟢 Los tags `source='owner'` siguen aplicándose después de revocar el reclamo** — la
   **decisión 12.3 del plan no está implementada**, que es exactamente lo que el plan anticipó
   (*"si el código hoy no lo hace, es hallazgo, no un fix a mitad del QA"*). `decidirClaim` **no
   toca `place_tags`** ([acciones.ts:238-267](../../lib/claims/acciones.ts#L238)) y **ningún lector
   de tags filtra por `source` ni por dueño aprobado**: búsqueda
   ([query.ts:167](../../lib/search/query.ts#L167)), ficha
   ([query.ts:188](../../lib/lugar/query.ts#L188)), chat
   ([tools.ts:140](../../lib/ai/tools.ts#L140)) y votaciones filtran **solo** por `tags.active`.
   *En vivo:* con el reclamo revocado, Kansas seguía saliendo **primero** en
   `?z=las-canitas&t=musica-en-vivo`, un tag que puso el dueño. Es lo que la decisión 12.3 quiere
   evitar: **los tags deciden en qué búsquedas aparece un lugar**, y un reclamo revocado —que se
   revoca justamente cuando alguien no era quien decía ser— no puede seguir sesgando el catálogo.
   Sigue bloqueado por `INT2-40` (hoy no hay a qué volver).
   > **Ojo con el docstring que parece decir lo contrario.** [acciones.ts:158](../../lib/claims/acciones.ts#L158)
   > dice *"un `source='owner'` vuelve a ser invisible por la regla normal"* y **no habla de tags**:
   > se refiere a `places.source` (enum `place_source`, un **lugar** dado de alta por un dueño, que
   > sin `publish_override` y con `confidence` null queda despublicado). `place_tags.source` es otro
   > enum (`place_tag_source`). **Dos columnas distintas, con el mismo nombre y el mismo valor** —
   > leído rápido, el docstring parece garantizar algo que el código no hace.
2. **🟢 Las fotos del dueño siguen visibles después de revocar** — **este el plan lo daba por hecho**
   (*"las fotos dejan de mostrarse"*) y **no ocurre**. `fotosDeDueno`
   ([query.ts:230](../../lib/lugar/query.ts#L230)) consulta `place_photos` por `place_id` **y nada
   más**: no recibe `reclamado`, a diferencia del contenido
   ([query.ts:149](../../lib/lugar/query.ts#L149)) y los horarios
   ([query.ts:157](../../lib/lugar/query.ts#L157)), que **sí** lo usan y por eso sí se apagan. Es el
   mismo argumento de la decisión 12.3 con contenido visual: una foto subida por alguien a quien se
   le revocó el reclamo sigue publicada en la ficha. Fix simétrico y chico: pasarle `reclamado`,
   igual que a los otros dos.
3. **🟢 `/cuenta` ofrece "Cancelar suscripción" a un premium sin suscripción** (INT2-32). Decisión de
   producto: o la UI no ofrece cancelar cuando no hay fila viva, o el 404 se explica con un copy que
   no contradiga al badge "Premium". Hoy no rompe nada, pero el estado **va a existir** en prod
   (beta testers, regalos, dueños que lo pidan).

### Bloque F — limpieza verificable por conteo

**Snapshot ANTES == snapshot DESPUÉS: diff = 0 en las 13 tablas.**

| Tabla | ANTES (sesión 1) | Al arrancar la sesión 3 | DESPUÉS | Diff |
|---|---|---|---|---|
| `place_lists` | 1 | 11 | **1** | 0 |
| `place_list_items` | 0 | 3 | **0** | 0 |
| `polls` | 6 | 29 | **6** | 0 |
| `poll_options` | 25 | 32 | **25** | 0 |
| `poll_votes` | 19 | 19 | **19** | 0 |
| `premium_interest` | 0 | 3 | **0** | 0 |
| `chat_conversations` | 15 | 16 | **15** | 0 |
| `chat_messages` | 38 | 40 | **38** | 0 |
| `place_claims` | 1 | 1 | **1** | 0 |
| `place_owner_content` | 1 | 1 | **1** | 0 |
| `place_photos` | 2 | 2 | **2** | 0 |
| `subscriptions` | 3 | 3 | **3** | 0 |
| `users` | 4 | 4 | **4** | 0 |

**Canario de curaduría:** `place_tags source='admin'` **3.970 → 3.967**, el número exacto de antes
del QA. Los 3 borrados son los que sembró el QA sobre Kansas. **No hubo pérdida de datos.**

**Lo que el conteo NO detecta — los cuatro valores pisados, revertidos y verificados con `SELECT`:**

| Qué | Cómo estaba | Cómo quedó |
|---|---|---|
| `place_owner_content` de Kansas (`description`/`menu_url`/`news`) | pisados con texto `[QA2]` en la sesión 1 | **NULL** los tres + `updated_at` al original (`2026-07-22 22:55:54.551`), recuperados del backup `141723` |
| `place_claims.status` de Kansas | revocado por INT2-33 | **`approved`** + `publish_override` = `t` (restaurado apenas terminó el caso, porque config B necesitaba a Kansas con dueño) |
| `place_claims.admin_notes` | pisado con *"[QA2] Revocación de prueba"* | **NULL** + `decided_at` al original. **Cuarto caso del patrón, descubierto en esta sesión** |
| `app_settings['ai.chat_monthly_cap']` | bajado a 1 por INT2-35 | **5000** |

**Flags revertidos** (verificados contra el backup previo al QA, no contra la memoria de la sesión):
`hugo` → `free` · `pepe` → `free` + `chat_trial_used` 0 · `juan` → `chat_trial_used` 0 ·
`frodriguez.este` sigue `premium` **porque ya lo era** (su sub `active` es del 2026-07-24, no del
QA) · `hugo.chat_trial_used` = **2**, que **también era su valor previo** — el backup lo confirma ·
`places.owner_plan` de Kansas = `free` · `chips.schedule` intacto (lo restauró la sesión 2).

**Agregados diarios borrados** (§ 9): `place_impressions_daily` **−201** ·
`place_tag_impressions_daily` **−133** · `place_taps_daily` −0. **Acumuladores mensuales
conservados** (decisión 2 del plan): `ai_api_usage` 2026-08 = 1 · `chat_usage_monthly` ·
`google_api_usage`.

**La suscripción comprada se borró**, como decidió Fer: cancelar deja la fila (`status='active'` con
`cancel_at_period_end`), así que sin borrarla el diff cerraba en 4. La evidencia de INT2-41 vive en
este documento, que es donde tiene que estar; una sub de sandbox viva en el dump la puede reactivar
cualquier reconciliación lazy.

**Backup final:** `backups/adondesalimos_2026-08-02_211243.sql.gz` (5,0M), corrido **después** de la
limpieza. **Ese es el dump de DEPLOY F0.**

#### Fuera de alcance del criterio, pero anotado (§ 10.3: se dice, no se arregla)

Las **3 filas preexistentes de `subscriptions`** que el diff conserva **ya son de QA de julio**
(`mp_payer_email = test_user_…@testuser.com`, sandbox de MP), y **una está `active`** con
`current_period_end` = **2026-08-24**. O sea: el riesgo que el plan advierte para la sub de INT2-31
—*"una sub viva en el dump la reactiva cualquier reconciliación lazy"*— **ya estaba en el baseline**,
y el criterio "diff = 0 contra el ANTES de la sesión 1" lo deja pasar por construcción. **Decisión de
Fer antes de F0**, no de este QA: se limpian o se dejan. → BACKLOG.

### Nota de método — esta vez el instrumento mintió tres veces seguidas, y ninguna llegó al informe

En INT2-33, la primera lectura de la ficha revocada daba **tres** síntomas: el website del dueño
seguía, los horarios seguían y la foto seguía. Dos eran míos:

- **El website:** el del dueño era `https://kansasgrillandbar.com.ar` y el de Overture
  `http://www.kansasgrillandbar.com.ar`. La comprobación buscaba el substring
  `kansasgrillandbar.com.ar`, que **matchea los dos**. Con comparación exacta sobre los `href`, el
  del dueño había desaparecido: funcionaba bien.
- **Los horarios:** buscar `"Cerrado ahora"|"Abierto ahora"` daba `true`, pero ese texto lo pinta
  **Google**, no el dueño. Los horarios propios (lunes 09-18, viernes 20-02) **sí** habían
  desaparecido. De hecho el estado *cambió* de "Cerrado ahora" a "Abierto ahora" al revocar, que es
  la señal de que dejó de usar los del dueño.
- **La foto** era real, y quedó como hallazgo 2.

Es la **tercera sesión consecutiva** en que el instrumento fabrica un síntoma (sesión 1: el editor;
sesión 2: los microsegundos de `now()`; sesión 3: los substrings). La regla del § 10.3 —*explicar el
síntoma en el código antes de escribir un ❌*— es lo que lo frenó las tres veces. Lo nuevo de esta
sesión es de dónde salió: **una aserción demasiado laxa** (`includes` de un substring que dos valores
comparten) fabrica un falso positivo igual que una siembra mal hecha. Y cuando lo que se prueba es
*"el valor A fue reemplazado por el valor B"*, **A y B suelen parecerse mucho** —es el mismo negocio,
el mismo teléfono, la misma web— así que `includes` es justo la herramienta que no discrimina: ahí
va comparación exacta.

---

## Fixes del QA integral #2 — los tres hallazgos de código (2026-08-03)

**Veredicto:** APROBADO
**Verificación técnica:** typecheck ✅ · tests ✅ **622/622** (619 + 3 nuevos) · build ⏳ (se corre
con el dev server parado)
**Alcance:** los 3 hallazgos 🟢 *solo código* que dejó el QA integral #2 — `INT2-33` (dos huecos al
revocar un reclamo) e `INT2-28` (el contador topeado). **Ninguno tenía migración**, así que por el
§ 10 bis del plan iban después del deploy y no bloquearon `DEPLOY` F0. Se aplicaron **en lote y
después** del informe a propósito: un informe con el código cambiando debajo no describe ninguna
versión del producto.

| ID | Qué se arregló | Resultado | Evidencia |
|----|----------------|-----------|-----------|
| INT2-33a | Las **tags `source='owner'` se apagan al revocar** y vuelven las de Overture (decisión 12.3) | ✅ FIX | `revertirTagsAOverture` en [ownership.ts](../../lib/claims/ownership.ts), llamada **dentro de la TX** de `decidirClaim` ([acciones.ts](../../lib/claims/acciones.ts)). 2 tests nuevos en `claims.integration.test.ts` |
| INT2-33b | Las **fotos del dueño se apagan al revocar**, sin borrarse | ✅ FIX | `getPlaceDetail` gatea `ownerPhotos` por `reclamado` ([query.ts](../../lib/lugar/query.ts)) **y** `getPlaceForEnrichment` gatea `tieneFotoDueno` ([matching.ts](../../lib/lugar/matching.ts)). Test nuevo que cubre los dos + la fila viva |
| INT2-28 | El **contador de interés premium** deja de congelarse en 200 | ✅ FIX | `contarInteresados()` cableada en [app/admin/page.tsx](../../app/admin/page.tsx); la lista sigue topeada y el panel avisa "Abajo, los N más nuevos" cuando el total la supera |

### La decisión que faltaba (12.3) — Fer eligió el fallback (a)

El bloqueo no era el porqué sino el fallback: el editor del dueño borra las de `import` a propósito
(decisión 14), así que un lugar **sin curaduría** cuyo dueño guardó alguna vez se quedaba **sin
ningún tag** al revocar (medido: Kansas, 5 tags y los 5 `owner`). Opciones ofrecidas: (a) re-derivar
los `import` desde Overture · (b) degradar `owner` → `import` · (c) aceptar el lugar sin tags.
**Fer eligió (a)**, que además es la regla que ya rige el contenido y los horarios —*revocar devuelve
la ficha a Overture*— aplicada a las tags.

Lo que lo hizo barato: **`places.overture_category` está persistida**, así que la re-derivación es un
lookup local contra `CATEGORY_TAG_MAP` — no necesita re-import ni salir a S3. El mapa se movió de
`scripts/overture/tag-map.ts` a **`lib/overture/tag-map.ts`**: ahora tiene dos consumidores y la
dirección de dependencias del proyecto es `scripts → lib`, nunca al revés. La curaduría (`admin`) no
se toca: el `insert` va con `onConflictDoNothing`, así que una tag curada que también mapea desde
Overture **conserva su `source`**.

Corregido también el **docstring que hizo tropezar a una sesión** ([acciones.ts:158](../../lib/claims/acciones.ts#L158)):
decía *"un `source='owner'` vuelve a ser invisible por la regla normal"* hablando de `places.source`,
y leído rápido parecía prometer justo lo que la 12.3 pedía sobre `place_tags.source`. Ahora nombra la
columna y apunta al fix.

### El agujero que encontró el BACKLOG, no los tests: media corrección era peor que el bug

**El fix de las fotos estaba mal la primera vez y los 622 tests lo daban por bueno.** Gatear solo
`getPlaceDetail` deja al endpoint de enriquecimiento viendo las filas de `place_photos`: cree que hay
foto de dueño, **no le pide la foto a Google**, y la ficha revocada queda **sin ninguna foto** — ni la
del ex-dueño ni la de Google. Peor que el bug original.

**Verificado en vivo, y las dos veces:** con el claim revocado por SQL, la ficha de Kansas primero
quedó en **0 imágenes** (media corrección) y, con `tieneFotoDueno` gateado también, en **1 imagen de
`lh3.googleusercontent.com`** (correcto). Con el claim restaurado vuelve la de `r2.dev`.

Lo salvó **el BACKLOG**, no el código ni la suite: el ítem de AUTH F3 (2026-07-21) ya tenía escrita
la trampa —*"hay que tocar DOS lugares o ninguno"*— con los dos nombres de función. Es la primera vez
que un ítem viejo de la cola **evita** un bug en vez de solo describirlo. El test nuevo la deja
cubierta: asserta `tieneFotoDueno` en los dos estados, no solo `ownerPhotos`.

### Estado de la base al cerrar

**Kansas restaurado y verificado con `SELECT`:** `status='approved'` · `decided_at` original
(`2026-07-24 23:13:00.12`) · `admin_notes` NULL · `publish_override` = `t` · `owner_plan='free'` ·
**2 fotos** · **5 tags `owner`** (la revocación se hizo por SQL sobre `status`, no por `decidirClaim`,
justamente para no disparar la reversión de tags sobre datos reales).

**Costo de la verificación en vivo:** 1 foto de Google (`google_api_usage` 2026-08 `photos` = 5,
`details` = 15 — muy por debajo de los topes). Los tests de integración crean y borran sus propios
fixtures bajo prefijo. **Canario de curaduría intacto.**

---

## Los 5 temas abiertos del QA integral #2 — decididos e implementados (2026-08-03)

**Contexto:** el QA integral #2 cerró con 39 ✅ + 3 hallazgos, y sus dos fixes de código se aplicaron
en `f7697c9`. Lo que quedó no eran bugs: eran **decisiones de producto que nadie había tomado**.
Ninguno bloqueaba `DEPLOY` F0. Esta sesión los decidió uno por uno y los implementó.
**625/625 tests · typecheck limpio · sin migraciones.** El detalle de cada decisión, con su porqué y
lo que se decidió **no** hacer, está en `docs/product/BACKLOG.md`.

| ID | Tema | Decisión | Dónde |
|---|---|---|---|
| `INT2-32` | `/cuenta` ofrecía cancelar a un premium sin fila en `subscriptions` | Con `activo && status === null`: sin botón + copy de cortesía. Cubre B2C y B2B (panel compartido) | `components/billing/suscripcion-panel.tsx` |
| `INT2-28` | El contador de interés no desagregaba los ejes | `contarInteresados()` → `{ b2c, b2b, total }` en una query; el panel muestra los dos | `lib/billing/interes.ts` · `app/admin/suscripciones.tsx` |
| `INT2-29` | El chat no alimentaba `place_tag_impressions_daily` | Sí registra, misma tabla, sin columna `source`, **atribuido por llamada a la tool** | `lib/ai/chat.ts` · `lib/ai/tools.ts` |
| `INT2-01` | Un chip de la home con un tag de Precio nunca se ve | `precio-2` fuera de los **dos** chips que lo tenían (0→38 y 1→187) | `lib/db/chips.ts` + `DELETE` de 2 filas de `chip_tags` |
| — | Revocar por abuso solo ocultaba las fotos | `borrarFotosDeLugar` + `npm run fotos:borrar`. **Script, no botón** | `lib/negocio/acciones.ts` · `scripts/borrar-fotos.ts` |

### Lo que cambió por verificar contra el código antes de creerle al hallazgo

**De los 5, 3 cambiaron de forma.** Un hallazgo de QA describe el código del día que se escribió:

- **El checkbox que no se hizo.** La propuesta era *"un checkbox en el rechazo de `/admin` que borre
  reusando `limpiarFotosDeUsuario`"*. Dos problemas al leer el código: esa función es **por usuario**
  (borra las fotos de *todos* sus lugares) y revocar es **por lugar** — reusarla habría borrado fotos
  de lugares con el reclamo todavía aprobado; y el argumento que justificaba el click (*"le da al
  admin la información que el código no puede deducir"*) ya no aplica: el motivo del rechazo **se
  persiste** en `place_claims.admin_notes`.
- **El chip de Precio eran dos.** `salida-con-amigos` (`sort` 0, home) y `primera-cita`. El "1
  resultado" de `primera-cita` era, literalmente, el único lugar de toda la faceta Precio.
- **La búsqueda dentro de una votación nunca registró tags.** El hallazgo lo planteaba junto al del
  chat; las dos pantallas llaman `/api/search?q=…` **solo con texto libre**, así que
  `registrarTagsDeBusqueda` ahí corta sola. Lo único que suma es `impressions`, y se decidió que está
  bien: una vista en una pantalla privada es una vista.

### La trampa de atribución del chat (no la vio ningún test)

El set de grounding del chat es `seenPrevios ∪ idsNuevos`: **un lugar citado puede venir de una
búsqueda de dos turnos atrás, con otros tags**, y en un mismo turno puede haber varias llamadas a la
tool con tags distintos. La implementación obvia —"los tags del turno × los lugares citados"— habría
escrito datos mal en un agregado **que no se puede reconstruir**. Quedó atribuido **por llamada**:
de cada `buscar_lugares`, solo sus ids que además fueron citados.

### El costo escondido de cambiar un chip

Editar `lib/db/chips.ts` **no alcanza**: el seed inserta `chip_tags` solo si el chip no tiene ninguno
(`scripts/seed.ts:194`), así que `db:seed` no actualiza los tags de un chip existente. Hubo que
borrar las 2 filas a mano, con `npm run backup:db` antes
(`backups/adondesalimos_2026-08-02_224123.sql.gz`). La red que avisa si se hace una sola mitad es
`chips.integration.test.ts`, que compara el código contra la base.

**Efecto colateral registrado:** al medir los 9 chips objetivo para escribir el cambio se encontró
que el docstring de `CHIPS_OBJETIVO` seguía diciendo *"8 devuelven 0"* y *"el único vivo es
`salir-a-bailar`"* — quedó viejo con la curaduría de CURADURIA F3. Hoy son **8 de 9 vivos** (el único
en 0 es `plan-tranqui`). El docstring ahora lleva los números medidos y fechados.

---

## PULIDO_BETA F1 — Auditoría de UX/UI de los 6 recorridos en mobile (2026-08-03)

**Spec:** `docs/specs/active/PULIDO_BETA.md` (movido de `planned/` al arrancar esta sesión).
**Qué es esto:** la fase **F1** del spec — **ver, no arreglar** (decisión 2). No se tocó una línea
de código. Cada hallazgo trae los 6 campos de la decisión 7 (ruta · viewport · esperado ·
observado · severidad **propuesta** · evidencia). **La severidad la confirma Fer en F2**
(decisión 6); acá está propuesta, no decidida.

**Método:** recorridos en vivo contra `https://adondesalimos.ngrok.app` con el MCP de Playwright,
viewport **390×844**, más una pasada de control a **360 px** de ancho por recorrido (decisión 3).
Ventana limpia sin sesión ni cookie de voto para R2 y R3 (decisión 14). Las capturas quedan en
`.playwright-mcp/` (gitignoreada): por eso **cada hallazgo repite la evidencia decisiva en texto**,
para que no dependa de un archivo que no viaja en git.

**No se auditó** `/admin` ni `/legales` (fuera de scope explícito del spec).

⚠️ **Dos numeraciones:** los hallazgos de abajo son `PBETA-R<n>-NN` (el entregable de F1). Los
`PBETA-NN` del spec son otra cosa: verifican que el **spec** se cumplió.

### Estado de la base (decisión 13) — llevado desde el arranque

Conteos previos a la auditoría (2026-08-03 12:12 AR): polls 6 · poll_options 25 · poll_votes 19 ·
place_claims 1 · place_lists 1 · place_list_items 0 · premium_interest 0 · users 4 ·
chat_conversations 16 · chat_messages 40 · place_owner_content 1 · place_photos 2 ·
`place_tags source='admin'` 3.967.

| Qué se tocó | Estado | Cómo se revierte |
|---|---|---|
| `polls.expires_at` del token `pYBcg_6TgoNpebFNOgQ7wg` | **Modificado** — era `2026-08-03 15:09:45.613` (había expirado 3 min antes de arrancar); se corrió a `+6 h` para poder auditar una votación **abierta**, que es el estado principal de R2 | `UPDATE polls SET expires_at='2026-08-03 15:09:45.613' WHERE token='pYBcg_6TgoNpebFNOgQ7wg'` |
| `poll_votes` — 1 voto emitido en esa votación (`adebc48a-af59-4ceb-8670-662f0cd64365`, opción Kalua) | **Pendiente de borrar** al cierre | `DELETE FROM poll_votes WHERE id='adebc48a-af59-4ceb-8670-662f0cd64365'` |
| `poll_options` — se sumó "Kansas Grill & Bar" (`8c87d0d0-…`) probando *Sumar un lugar* | ✅ **Ya revertido** desde la propia UI ("Sacar"). `poll_options` volvió a **25** | — |
| `polls.status` del token `bCC7kEsmhr3Vb9NReHOUFg` | **Modificado por la app, no por SQL**: estaba `open` con vencimiento del 2026-07-29; visitarlo disparó la expiración lazy y pasó a `closed`. Es el comportamiento diseñado | `UPDATE polls SET status='open' WHERE token='bCC7kEsmhr3Vb9NReHOUFg'` (se re-cerrará solo en la próxima visita) |

---

### R2 — Me invitaron a votar (sin cuenta)

**Por qué arrancó por acá:** es el loop viral y el menos mirado; si la sesión se cortaba, este es el
que tenía que quedar hecho.

**Recorrido:** ventana sin cookies ni sesión → `/votacion/pYBcg_6TgoNpebFNOgQ7wg` (abierta, 3
opciones, 4 votos) → votar → recargar → abrir una ficha y volver → *Sumar un lugar* → sacarlo →
control a 360 px → estados **expirada** (`bCC7kEsmhr3Vb9NReHOUFg`), **cerrada con ganador**
(`GPeDP-dIOCDVHlDbCIRGNA`) y **token inválido**.

**Lo que funcionó bien** (no genera hallazgo, pero se verificó): el voto se registra al toque y el
botón pasa a «✓ Tu voto» en naranja · el voto **sobrevive a la recarga** (cookie) · «Volver» desde
la ficha vuelve a la votación y no a la home · el estado *cerrada con ganador* se lee perfecto
(«Ganó Cine Lorca» + card con borde naranja y chip «Ganó») · el vacío del buscador dice «No
encontramos lugares con ese nombre» · sumar y sacar un lugar funciona y borra la fila.

**360 px:** sin desbordes. `document.scrollWidth` = `clientWidth` = 345 px (Chrome descuenta 15 px
de scrollbar, así que el ancho real de contenido probado es **más chico** que el piso de Android).
Único efecto: el H1 pasa de 3 a 4 líneas (ver PBETA-R2-04).

| ID | Hallazgo | Severidad propuesta |
|----|----------|---------------------|
| PBETA-R2-01 | Un link roto cae en el 404 default de Next: blanco, en inglés, sin salida | **BLOQUEANTE** |
| PBETA-R2-02 | El link compartido no lleva imagen de preview (`og:image`) | MOLESTO |
| PBETA-R2-03 | Nada dice quién invitó ni qué es la app | **BLOQUEANTE** |
| PBETA-R2-04 | Sin título propio, el H1 es la lista de nombres concatenada | MOLESTO |
| PBETA-R2-05 | Los toques principales miden menos de 44 px | MOLESTO |
| PBETA-R2-06 | No se sabe hasta cuándo se puede votar | MOLESTO |
| PBETA-R2-07 | «Podés cambiar tu voto» aparece recién **después** de votar | MOLESTO |
| PBETA-R2-08 | La votación cerrada o expirada es un callejón sin salida | **BLOQUEANTE** |
| PBETA-R2-09 | El sheet «Sumá un lugar» no tiene forma visible de cerrarse | MOLESTO |
| PBETA-R2-10 | El subtítulo del sheet se alinea a la derecha del título | COSMÉTICO |
| PBETA-R2-11 | El bloque de voto queda visualmente fuera de la card del lugar | MOLESTO |
| PBETA-R2-12 | Los resultados se ven antes de votar | MOLESTO |
| PBETA-R2-13 | El H1 no se actualiza cuando alguien suma un lugar | COSMÉTICO |

#### PBETA-R2-01 — Un link roto cae en el 404 default de Next

- **Ruta:** `/votacion/token-que-no-existe` (y **cualquier** ruta inexistente: se reprodujo igual en `/no-existe-esta-ruta`)
- **Viewport:** 390×844
- **Esperado:** una pantalla de la app —fondo oscuro, wordmark, «Ese link no anda» en castellano— con un camino de vuelta a la home.
- **Observado:** la pantalla default de Next.js: **fondo blanco**, tipografía del sistema, `404 · This page could not be found`, **en inglés**, sin header, sin wordmark y **sin ningún link**. Rompe el tema oscuro de toda la app y la regla de copy en rioplatense. El `<title>` también sale en inglés (`404: This page could not be found.`).
- **Por qué importa acá:** en R2 el usuario llega por un link pegado en WhatsApp. Un link cortado por el reenvío es el caso más común de todos, y esto es lo que ve.
- **Severidad propuesta:** **BLOQUEANTE** — deja al usuario sin saber qué hacer y aparenta app rota.
- **Evidencia:** `.playwright-mcp/pbeta-r2-15-token-invalido-404.png`. HTTP **404** confirmado por Playwright. Explicación en código (no fue como se encontró): no existen `app/not-found.tsx`, `app/error.tsx` ni `app/global-error.tsx`.

#### PBETA-R2-02 — El link compartido no lleva imagen de preview

- **Ruta:** `/votacion/[token]` — los `<meta>` del `<head>`
- **Viewport:** N/A (es la tarjeta que dibuja WhatsApp/Telegram antes de abrir la app)
- **Esperado:** una tarjeta con imagen —el logomark alcanza— para que el link no parezca spam.
- **Observado:** el `head` trae `og:title` y `og:description` correctos y bien escritos (`"Votá entre Kalua Pizza Bar, Popolo Pizza, Doc Brown Brewery."`), pero **no hay ningún `og:image`** y `twitter:card` es `summary` (el formato sin imagen). La home (`/`) directamente **no declara ninguna etiqueta `og:` ni `twitter:`**.
- **Severidad propuesta:** MOLESTO — es el primer pixel del loop viral, pero no traba el recorrido.
- **Evidencia:** `curl` del head de la votación → 6 metas, ninguna `og:image`; `grep -oiE 'og:image'` sobre el HTML devuelve vacío. Mismo grep sobre `/` devuelve vacío para `og:` y `twitter:`.

#### PBETA-R2-03 — Nada dice quién invitó ni qué es la app

- **Ruta:** `/votacion/pYBcg_6TgoNpebFNOgQ7wg`
- **Viewport:** 390×844
- **Esperado:** que un desconocido entienda en 5 segundos quién lo invitó, a qué, y qué es «¿A dónde salimos?».
- **Observado:** arriba se lee `VOTACIÓN` (eyebrow gris de 12 px), el título, y abajo las cards con botones «Votar». **El nombre del creador no aparece en ninguna parte** —la votación es de "Pepe", que está en la base y no se muestra—, no hay una línea de instrucción («elegí a dónde querés ir»), y **no hay una sola frase que explique qué es la app**. Lo único que la nombra es el pie: «Armá tu propia votación desde ¿A dónde salimos?», que queda a **990 px de scroll** (fuera de pantalla al llegar) y es un link de **15 px de alto**.
- **Severidad propuesta:** **BLOQUEANTE** — es el criterio explícito con el que el spec justifica R2 («un desconocido tiene que entender qué es esto en 5 segundos»). Se entiende *qué botón tocar*, no *dónde está parado*.
- **Evidencia:** `.playwright-mcp/pbeta-r2-02-viewport.png` (llegada) y `pbeta-r2-04-pie.png` (pie). El snapshot de accesibilidad de la página entera no contiene la cadena «Pepe» ni ninguna descripción de la app.

#### PBETA-R2-04 — Sin título propio, el H1 es la lista de nombres concatenada

- **Ruta:** `/votacion/pYBcg_6TgoNpebFNOgQ7wg`
- **Viewport:** 390×844 y 360×844
- **Esperado:** un encabezado que diga de qué se trata.
- **Observado:** el H1 es `¿A dónde salimos? Kalua Pizza Bar · Popolo Pizza · Doc Brown Brewery` — **3 líneas a 390 px y 4 a 360 px**, ocupando el tercio superior de la pantalla para decir lo mismo que ya dicen las cards de abajo. No es un bug de datos: el `title` de esa votación es `NULL` y este es el **fallback**. Cuando el creador sí puso título se ve muy bien (`¿Que hacemos?`, una línea).
- **Severidad propuesta:** MOLESTO.
- **Evidencia:** `pbeta-r2-02-viewport.png` (390, 3 líneas) · `pbeta-r2-12-360px.png` (360, 4 líneas) · `pbeta-r2-14-cerrada-ganador.png` (contraste: votación **con** título propio).

#### PBETA-R2-05 — Los toques principales miden menos de 44 px

- **Ruta:** `/votacion/pYBcg_6TgoNpebFNOgQ7wg` (+ el sheet *Sumar un lugar*)
- **Viewport:** 390×844
- **Esperado:** ~44×44 px de área de toque en las acciones principales, que es lo que se usa parado en la calle y con una mano.
- **Observado**, medido con `getBoundingClientRect()`:

  | Elemento | Medida | Nota |
  |---|---|---|
  | Botón **«Votar»** | **63 × 34** | Es *la* acción del recorrido y es el control más chico de la pantalla |
  | Link **«Inicio»** (arriba a la derecha) | **35 × 20** | Además es ambiguo: no dice adónde va |
  | Botón **«+»** de cada resultado del sheet | **32 × 32** | |
  | Link **«¿A dónde salimos?»** del pie | **106 × 15** | Es la única salida de la página |
  | Botón «Sumar un lugar» | 358 × 42 | El único cómodo |

- **Severidad propuesta:** MOLESTO.
- **Evidencia:** tabla de arriba (medición directa en vivo) · `pbeta-r2-02-viewport.png` · snapshot con `boxes` del dialog.

#### PBETA-R2-06 — No se sabe hasta cuándo se puede votar

- **Ruta:** `/votacion/pYBcg_6TgoNpebFNOgQ7wg`
- **Viewport:** 390×844
- **Esperado:** «cierra en 6 h» o una fecha — sobre todo porque las votaciones **expiran solas a las 72 h**.
- **Observado:** en toda la página no hay una sola referencia temporal: ni cuándo se creó, ni cuándo cierra, ni cuánto queda. El que llega no sabe si tiene 5 minutos o 2 días, y el que ya votó no sabe hasta cuándo puede cambiarlo.
- **Severidad propuesta:** MOLESTO.
- **Evidencia:** `pbeta-r2-02-viewport.png` + `pbeta-r2-04-pie.png` (la página completa: el único texto de estado es «5 votos en total · Podés cambiar tu voto mientras esté abierta»).

#### PBETA-R2-07 — «Podés cambiar tu voto» aparece recién después de votar

- **Ruta:** `/votacion/pYBcg_6TgoNpebFNOgQ7wg`
- **Viewport:** 390×844
- **Esperado:** saber **antes** de tocar que el voto es reversible; es lo que abarata el click.
- **Observado:** antes de votar el pie dice solo `4 votos en total`. Después de votar dice `5 votos en total · Podés cambiar tu voto mientras esté abierta`. La frase que quita el miedo aparece cuando el miedo ya no existe.
- **Severidad propuesta:** MOLESTO.
- **Evidencia:** `pbeta-r2-02-viewport.png` (antes: «4 votos en total») vs `pbeta-r2-03-post-voto.png` (después: la frase completa).

#### PBETA-R2-08 — La votación cerrada o expirada es un callejón sin salida

- **Ruta:** `/votacion/bCC7kEsmhr3Vb9NReHOUFg` (expirada) y `/votacion/GPeDP-dIOCDVHlDbCIRGNA` (cerrada con ganador)
- **Viewport:** 390×844
- **Esperado:** que el que llega tarde tenga algo para hacer — armar la suya, ver el lugar que ganó, buscar cerca.
- **Observado:** en la expirada se lee `Esta votación ya cerró. No se puede votar.` y debajo las 4 opciones con 0 votos, sin botones. **No hay ningún llamado a la acción**: la única salida sigue siendo el link de 15 px del pie. Dos problemas más de copy en la misma pantalla: (a) dice «ya cerró» pero **esta expiró sola** el 2026-07-29 — no la cerró nadie —, y el mensaje no distingue los dos casos ni dice cuándo pasó; (b) en la cerrada con ganador el estado se resuelve muy bien («Ganó Cine Lorca» + card con borde naranja), pero **tampoco ofrece un paso siguiente**.
- **Por qué importa:** en un grupo de WhatsApp, llegar tarde al link es el caso más frecuente después de llegar a tiempo.
- **Severidad propuesta:** **BLOQUEANTE** — deja al usuario sin saber qué hacer, en la pantalla donde más gente cae.
- **Evidencia:** `pbeta-r2-13-expirada.png` · `pbeta-r2-14-cerrada-ganador.png`. Dato de la base que explica el copy: al visitarla, esa votación pasó de `open` a **`closed`** (expiración lazy) — no existe un estado `expired` distinto, y el copy es uno solo para los dos casos.

#### PBETA-R2-09 — El sheet «Sumá un lugar» no tiene forma visible de cerrarse

- **Ruta:** `/votacion/pYBcg_6TgoNpebFNOgQ7wg` → botón «Sumar un lugar»
- **Viewport:** 390×844
- **Esperado:** una X o un «Cancelar» — el que abrió el sheet por curiosidad tiene que poder salir.
- **Observado:** el `dialog` contiene **solo** el handle decorativo de arrastre, el título, el buscador y la lista. No hay botón de cerrar ni etiqueta de cierre en el árbol de accesibilidad. Salir depende de adivinar que se arrastra el handle o que se toca afuera.
- **Severidad propuesta:** MOLESTO.
- **Evidencia:** `pbeta-r2-07-sheet-sumar.png` y el snapshot del `[role=dialog]`, cuyos únicos hijos son `heading`, `generic`, `textbox` y `list` — ningún `button` de cierre.

#### PBETA-R2-10 — El subtítulo del sheet se alinea a la derecha del título

- **Ruta:** `/votacion/[token]` → sheet «Sumá un lugar»
- **Viewport:** 390×844
- **Esperado:** el subtítulo debajo del título, como una bajada.
- **Observado:** «Sumá un lugar» arranca en x=16 y «Buscalo por nombre» queda pegado al borde derecho (x=245, ancho 114) **en la misma línea**, leyéndose como dos elementos sin relación en vez de título + bajada.
- **Severidad propuesta:** COSMÉTICO.
- **Evidencia:** snapshot con `boxes` del dialog: `heading "Sumá un lugar" [box=16,730,111,24]` y `generic "Buscalo por nombre" [box=245,736,114,16]` · `pbeta-r2-07-sheet-sumar.png`.

#### PBETA-R2-11 — El bloque de voto queda visualmente fuera de la card del lugar

- **Ruta:** `/votacion/pYBcg_6TgoNpebFNOgQ7wg`
- **Viewport:** 390×844
- **Esperado:** que el botón que vota por un lugar se lea como parte de ese lugar.
- **Observado:** la card (fondo más claro, borde redondeado) termina después de la zona, y **abajo, sobre el fondo de la página**, van el contador, la barra de progreso y el botón «Votar». Con tres bloques seguidos, la barra de un lugar queda más cerca de la card del *siguiente* que de la propia. Lo mismo pasa con los chips de origen («Lo sumó alguien del grupo», «Lo sumaste vos»), que flotan **arriba** de la card a la que se refieren, y la X de sacar queda a ~300 px de distancia horizontal del chip.
- **Severidad propuesta:** MOLESTO.
- **Evidencia:** `pbeta-r2-02-viewport.png` y `pbeta-r2-11-sumado-nudge.png`.

#### PBETA-R2-12 — Los resultados se ven antes de votar

- **Ruta:** `/votacion/pYBcg_6TgoNpebFNOgQ7wg`
- **Viewport:** 390×844
- **Esperado:** *(a definir por Fer — puede ser deliberado)* que la elección no venga anclada.
- **Observado:** al llegar, antes de emitir ningún voto, ya se ven `0 votos / 0%`, `1 voto / 25%` y `3 votos / 75%` con las barras pintadas. El que llega último ve que uno ya ganó y vota eso o no vota.
- **Nota:** puede ser una decisión de producto de `VOTACION` («resultados en vivo»); se anota porque se observó en el recorrido, y el triaje es de Fer.
- **Severidad propuesta:** MOLESTO.
- **Evidencia:** `pbeta-r2-02-viewport.png` (estado de llegada, sin cookie de voto).

#### PBETA-R2-13 — El H1 no se actualiza cuando alguien suma un lugar

- **Ruta:** `/votacion/pYBcg_6TgoNpebFNOgQ7wg` → «Sumar un lugar»
- **Viewport:** 390×844
- **Esperado:** que el título y lo que hay en pantalla coincidan.
- **Observado:** después de sumar «Kansas Grill & Bar» hay **4 lugares** en la lista y el H1 sigue diciendo `… Kalua Pizza Bar · Popolo Pizza · Doc Brown Brewery` (3). Se corrige solo al recargar. Solo afecta al fallback sin título propio (PBETA-R2-04).
- **Severidad propuesta:** COSMÉTICO.
- **Evidencia:** `pbeta-r2-10-post-sumar.png` (H1 con 3 nombres, 4 cards abajo).

---

### R1 — Descubrir (llego, elijo zona, veo resultados, abro una ficha)

**Recorrido:** `/` sin sesión → tocar un chip **sin** zona → volver → «Elegí zona» → Palermo Soho →
«Ver 1.095 lugares» → listado → Mapa → Lista → ficha de *Congo Club Cultural* → horarios →
volver → estado **sin resultados** → control a 360 px.

**Lo que funcionó bien:** el headline y la bajada de la home dicen exactamente lo que hace la app y
están en criollo («¿Qué sale?» / «Bares, restos, shows y birras cerca tuyo. Decidí sin dar mil
vueltas.») · el CTA del selector de zona muestra el conteo **en vivo** antes de aplicar («Ver 1.095
lugares») · el chip funciona sin zona elegida · la ficha carga con skeletons y después completa foto,
rating, precio y horarios sin saltos raros · el vacío del listado está bien escrito («No encontramos
nada con eso · Sacá alguno de los chips de arriba o ampliá la zona») · la ficha, ya cargada, entra
completa y la barra fija de abajo **no tapa** el último contenido.

**360 px:** sin desbordes ni en el listado ni en la ficha (`scrollWidth` = `clientWidth` = 345 px en
las dos). El layout aguanta.

| ID | Hallazgo | Severidad propuesta |
|----|----------|---------------------|
| PBETA-R1-01 | El botón del selector de zona dice «Nada con eso» antes de que elijas nada | **BLOQUEANTE** |
| PBETA-R1-02 | Elegir Palermo Soho arranca con Burger King y Subway | MOLESTO |
| PBETA-R1-03 | El chip dice una zona y las cards dicen otra, sin nada que lo explique | MOLESTO |
| PBETA-R1-04 | El listado no dice cuántos resultados hay ni dónde termina | MOLESTO |
| PBETA-R1-05 | Desde la home no hay forma de enterarse de que existen las votaciones ni el chat | MOLESTO |
| PBETA-R1-06 | El mapa no entra en pantalla | MOLESTO |
| PBETA-R1-07 | «Cerrado ahora» no dice cuándo abre, y hoy no se distingue en la lista de horarios | MOLESTO |
| PBETA-R1-08 | Los toques de la ficha quedan cortos (36–40 px) | COSMÉTICO |

#### PBETA-R1-01 — El botón del selector de zona dice «Nada con eso» antes de que elijas nada

- **Ruta:** `/` → botón «Elegí zona» (el primer control que toca un usuario nuevo)
- **Viewport:** 390×844
- **Esperado:** «Elegí una zona» o «Ver lugares» en gris, hasta que haya algo elegido.
- **Observado:** al abrir el sheet, el CTA fijo al pie —naranja, ancho completo, 343×44— dice **«Nada con eso»**. Es el copy del estado *sin resultados* del listado («No encontramos nada con eso», que ahí sí está bien) reusado como etiqueta de botón. Le está diciendo «no hay nada» a alguien que **todavía no pidió nada**. Al elegir una zona el mismo botón pasa a «Ver 1.095 lugares»; al deseleccionarla vuelve a «Nada con eso».
- **Atenuante:** el botón está `disabled`, así que no lleva a una pantalla vacía; el daño es de lectura, no de navegación.
- **Severidad propuesta:** **BLOQUEANTE** — encaja literal en el criterio «miente» de la decisión 5, y pasa en el primer sheet que abre cualquiera que entre por la home. Es también de los más baratos de arreglar.
- **Evidencia:** `.playwright-mcp/pbeta-r1-04-sheet-zona.png` (se lee «Nada con eso» al pie). Estado del botón medido en vivo: con 0 zonas `{txt:"Nada con eso", disabled:true, w:343, h:44}` · con Palermo Soho `{txt:"Ver 1.095 lugares", disabled:false}` · al deseleccionar vuelve a `{txt:"Nada con eso", disabled:true}`. El copy correcto del mismo caso está en `pbeta-r1-12-sin-resultados.png`.

#### PBETA-R1-02 — Elegir Palermo Soho arranca con Burger King y Subway

- **Ruta:** `/?z=palermo-soho`
- **Viewport:** 390×844
- **Esperado:** que la zona más emblemática de salir muestre primero lugares de salir.
- **Observado:** los dos primeros resultados son **Burger King** y **Subway**. Las 8 primeras cards, en orden: Burger King · Subway · 70 30 Bar · La Choppería · Maricafe · Teatro el Piccolino · Lo de Joaquín Alberdi · Congo Club Cultural. Es la primera pantalla de catálogo que ve un usuario nuevo y la abren dos cadenas de fast food.
- **Alcance:** no es «falta de curaduría» (los dos están bien clasificados como Restaurante): es el **orden** del listado, que no prioriza nada. El spec deja la curaduría fuera de scope, pero el criterio de orden es de producto y se decide acá.
- **Severidad propuesta:** MOLESTO.
- **Evidencia:** `.playwright-mcp/pbeta-r1-06-resultados.png` y el volcado de las 8 primeras cards leído del DOM (arriba, textual).

#### PBETA-R1-03 — El chip dice una zona y las cards dicen otra, sin nada que lo explique

- **Ruta:** `/?z=palermo-soho`
- **Viewport:** 390×844
- **Esperado:** o solo lugares de la zona elegida, o una línea que avise que también entra lo que está a la vuelta.
- **Observado:** arriba se ve el chip activo `Palermo Soho ×` y abajo hay cards rotuladas `Botánico y Alto Palermo` (las dos primeras) y `Palermo Hollywood`. **3 de las 8 primeras** son de otra zona. En ningún lado dice que el filtro incluye lo que está a menos de 400 m del borde.
- **Contexto (para no re-litigar):** el buffer de 400 m es la decisión 5 de `ZONAS` y ya se investigó — la data está bien y Fer decidió documentarlo y no tocarlo (`AnalisisQA.md` § *Investigación — «búsqueda por zona trae lugares de zonas no adyacentes»*, 2026-07-26). **Lo que sigue sin resolver es que en pantalla no se explica**, que es un problema distinto y de este spec.
- **Severidad propuesta:** MOLESTO.
- **Evidencia:** `.playwright-mcp/pbeta-r1-06-resultados.png` (chip «Palermo Soho» + cards «Botánico y Alto Palermo»).

#### PBETA-R1-04 — El listado no dice cuántos resultados hay ni dónde termina

- **Ruta:** `/?z=palermo-soho` y `/?t=bar,cerveceria` (chip sin zona)
- **Viewport:** 390×844
- **Esperado:** un «1.095 lugares» arriba del listado, y un final de lista.
- **Observado:** el conteo existe y está bueno, pero **vive solo en el botón del sheet** y desaparece apenas entrás al listado: en la página de resultados no hay ninguna cifra. El listado además es scroll infinito sin techo visible: con el chip «Tomar algo» sin zona se cargaron **280 cards y 36.207 px de página en 12 tandas de scroll** sin llegar a ningún final ni a ningún «no hay más». En un celular eso es una página que no termina nunca y que se pone pesada.
- **Severidad propuesta:** MOLESTO.
- **Evidencia:** medición en vivo (`alturaFinal: 36207`, `cards: 280`, 12 iteraciones de scroll hasta cortar por límite del script) · `pbeta-r1-02-chip-sin-zona.png` · `pbeta-r1-03-fin-lista.png` · búsqueda de `/[\d.]+\s*lugares?/` en el texto visible del listado: el único match está dentro del sheet cerrado.

#### PBETA-R1-05 — Desde la home no hay forma de enterarse de que existen las votaciones ni el chat

- **Ruta:** `/` sin sesión
- **Viewport:** 390×844
- **Esperado:** que lo que diferencia a la app —decidir en grupo, y la IA— se pueda descubrir sin tener cuenta.
- **Observado:** la home entera tiene **exactamente dos links**: `/login` («Ingresar») y `/legales` («Overture Maps y Google»). No hay ninguna referencia a votaciones, a `/chat`, a lo guardado ni a dar de alta un negocio. Un usuario nuevo puede usar la app entera creyendo que es un buscador de bares. Es el espejo de PBETA-R2-03: por un lado llegan invitados a votar que no saben que hay un buscador; por el otro, gente que busca y no sabe que se puede votar.
- **Severidad propuesta:** MOLESTO.
- **Evidencia:** volcado de todos los `a[href]` de la home → `[{Ingresar → /login}, {Overture Maps y Google → /legales}]` · `pbeta-r1-01-home.png`.

#### PBETA-R1-06 — El mapa no entra en pantalla

- **Ruta:** `/?z=palermo-soho` → botón «Mapa»
- **Viewport:** 390×844
- **Esperado:** que en mobile el mapa sea la pantalla, no un recuadro.
- **Observado:** el mapa mide **341×589 px y arranca en y=449**, así que en una pantalla de 844 px se ve **el 67%**; el resto queda abajo del pliegue. Para verlo entero hay que scrollear la página (1.127 px de alto), que es justo el gesto que se pelea con el arrastre del mapa. El bloque de búsqueda (selector de zona + buscador + 6 chips + Filtros + chip activo) sigue ocupando los primeros **443 px** en modo mapa, sin colapsarse.
- **Severidad propuesta:** MOLESTO.
- **Evidencia:** medición en vivo del contenedor de MapLibre `{x:17, y:449, w:341, h:589}` con `document.body.scrollHeight = 1127` y `window.innerHeight = 844` · `pbeta-r1-07-mapa.png`.

#### PBETA-R1-07 — «Cerrado ahora» no dice cuándo abre, y hoy no se distingue en la lista de horarios

- **Ruta:** `/lugar/59b44cb5-1722-4e84-94c0-efd7ca6451fb` (Congo Club Cultural)
- **Viewport:** 390×844
- **Esperado:** «Cerrado · abre a las 19» — que es la única pregunta que importa cuando estás por salir.
- **Observado:** dice `Cerrado ahora` y nada más; para saber cuándo abre hay que tocar «Ver horarios de la semana» y desplegar los 7 días. Y en ese despliegue **los 7 días se ven idénticos**: el de hoy no está resaltado, así que hay que acordarse de qué día es y buscar la fila a mano.
- **Severidad propuesta:** MOLESTO.
- **Evidencia:** `pbeta-r1-09-ficha-pie.png` (estado colapsado) y `pbeta-r1-10-horarios.png` (los 7 días en el mismo gris, «lunes: Cerrado» sin ninguna marca de que hoy es lunes).

#### PBETA-R1-08 — Los toques de la ficha quedan cortos

- **Ruta:** `/lugar/59b44cb5-1722-4e84-94c0-efd7ca6451fb`
- **Viewport:** 390×844
- **Esperado:** ~44×44 px.
- **Observado**, medido con `getBoundingClientRect()`: **Guardar 36×36** (el más chico, y es la puerta de entrada de R3) · Volver, Compartir, Llamar y Sitio web **40×40** · «Cómo llegar» 262×**40**. Están cerca del mínimo y bastante mejor que los de la votación (PBETA-R2-05, «Votar» 63×34), pero ninguno llega.
- **Severidad propuesta:** COSMÉTICO.
- **Evidencia:** medición directa en vivo (tabla de arriba) · `pbeta-r1-09-ficha-pie.png`.

---

### R3 — Guardar (toco guardar, me topa el muro de cuenta, me registro, vuelvo)

**Recorrido:** ventana limpia sin sesión → `/?z=palermo-soho` → tocar el marcador de una card →
lo que pase → `/registro` (formulario vacío e inválido) → volver → tocar guardar → iniciar sesión
con `hugo@gmail.com` → ver qué pasó con el lugar → guardar de verdad → menú de cuenta →
`/mis-lugares` (con un lugar y vacío) → control a 360 px.

**Desvío declarado:** no se completó un **alta nueva** de usuario. Con
`requireEmailVerification: true` no hay login sin verificar el mail, y crear un usuario con un mail
inventado deja una fila que no se puede terminar de usar y dispara un envío real de Resend. Se
auditó el formulario de `/registro` (copy, campos, validaciones y errores) y el resto del recorrido
se completó con la cuenta de prueba existente. **Lo que no se vio:** la pantalla de "te mandamos un
mail", el mail en sí, y la vuelta después de verificar.

**Lo que funcionó bien:** el `callbackUrl` conserva la búsqueda (`/login?callbackUrl=%2F%3Fz%3D
palermo-soho`), así que volvés a la lista donde estabas y no a la home · las validaciones del
registro son claras, en criollo y las tres a la vez («Email inválido», «La contraseña … 8
caracteres», «Las contraseñas no coinciden») · guardar es instantáneo y el marcador se pinta de
naranja · **el vacío de `/mis-lugares` es el mejor de la app**: «Todavía no guardaste nada · Cuando
encuentres un lugar que te pinta, tocá el marcador de la card o de la ficha y queda acá para cuando
lo necesites» con un botón «Buscar lugares» · el teaser de premium es honesto y no promete de más
(«Por ahora tenés una sola»).

**360 px:** sin desbordes en `/registro` ni en `/mis-lugares` (`scrollWidth` = `clientWidth` = 360).

> **Nota de método (para la próxima sesión de QA en vivo):** el click sintético de Playwright
> **tampoco dispara el botón de guardar** de la card — `browser_click` reporta éxito, no sale
> ninguna request y no cambia nada. Hay que usar `element.click()` vía `evaluate`. Es la misma
> lección del form del chat en `PULIDO`, pero **no es exclusiva de los `<form>`**. Sin esto, la
> sesión estuvo a punto de anotar un BLOQUEANTE falso («guardar no guarda»).

| ID | Hallazgo | Severidad propuesta |
|----|----------|---------------------|
| PBETA-R3-01 | Tocar Guardar sin cuenta te expulsa a un login que no dice por qué estás ahí | **BLOQUEANTE** |
| PBETA-R3-02 | `/registro` dice que la cuenta es para dueños de negocio, al que quiso guardar un bar | **BLOQUEANTE** |
| PBETA-R3-03 | Después de loguearte, el lugar que querías guardar **no** queda guardado | **BLOQUEANTE** |
| PBETA-R3-04 | Guardar no dice dónde quedó ni cómo volver a encontrarlo | MOLESTO |
| PBETA-R3-05 | En `/mis-lugares` el título «Mis lugares» aparece dos veces seguidas | COSMÉTICO |
| PBETA-R3-06 | La card de un lugar guardado pierde los tags que sí muestra en el listado | COSMÉTICO |

#### PBETA-R3-01 — Tocar Guardar sin cuenta te expulsa a un login que no dice por qué estás ahí

- **Ruta:** `/?z=palermo-soho` → marcador de una card → `/login?callbackUrl=%2F%3Fz%3Dpalermo-soho`
- **Viewport:** 390×844
- **Esperado:** un sheet o una pantalla que diga «Creá una cuenta y guardá tus lugares» — que conecte lo que el usuario acaba de hacer con lo que se le está pidiendo.
- **Observado:** el toque provoca una **navegación de página completa** a `/login`, cuyo encabezado es `Iniciá sesión` / `Accedé a tu cuenta`. **En ninguna parte se menciona guardar, ni el lugar que tocó.** El usuario tocó un marcador en «Burger King» y aparece en un formulario de contraseña sin explicación. Es exactamente el momento que el spec marca como *«el primer momento en que la app pide algo; donde se pierde gente»*.
- **Severidad propuesta:** **BLOQUEANTE** — deja al usuario sin saber qué pasó ni por qué.
- **Evidencia:** `.playwright-mcp/pbeta-r3-01-muro-login.png` (la pantalla entera: wordmark, «Iniciá sesión», «Accedé a tu cuenta», email, contraseña, «¿No tenés cuenta? Registrate»). La URL de destino confirma que el contexto que se conserva es la búsqueda, no el lugar.

#### PBETA-R3-02 — `/registro` dice que la cuenta es para dueños de negocio

- **Ruta:** `/registro` (se llega desde «¿No tenés cuenta? Registrate» del muro de R3-01)
- **Viewport:** 390×844
- **Esperado:** «Creá tu cuenta» + una bajada que hable de lo que el usuario vino a hacer (guardar lugares, armar votaciones).
- **Observado:** la bajada dice literalmente **«Necesaria para reclamar o registrar tu negocio»**. Es el copy del recorrido del **dueño** (R6) y está fijo para todos: el que venía de tocar el marcador en un bar lee que la cuenta sirve para otra cosa. La conclusión natural es «yo no tengo un negocio, esto no es para mí» — justo en la pantalla de conversión.
- **Severidad propuesta:** **BLOQUEANTE** — miente sobre para qué sirve la cuenta, en el peor lugar posible. Es un cambio de una línea de copy.
- **Evidencia:** `.playwright-mcp/pbeta-r3-02-registro.png` y `pbeta-r3-03-registro-errores.png` (la bajada es la misma en los dos estados, así que no es contextual).

#### PBETA-R3-03 — Después de loguearte, el lugar que querías guardar no queda guardado

- **Ruta:** `/?z=palermo-soho` → marcador de «Burger King» → `/login` → iniciar sesión → vuelta a `/?z=palermo-soho`
- **Viewport:** 390×844
- **Esperado:** volver con el lugar ya guardado, o al menos con el sheet de guardar abierto en ese lugar.
- **Observado:** se vuelve a la lista correcta, pero **el marcador de Burger King sigue vacío**: la acción que disparó todo el desvío se perdió. El `callbackUrl` conserva la búsqueda (`?z=palermo-soho`) pero **no el lugar**, así que hay que encontrar la card de nuevo y volver a tocar. El usuario pagó el peaje de crear una cuenta y no recibió lo que pidió.
- **Severidad propuesta:** **BLOQUEANTE** — rompe el recorrido en el punto exacto que R3 existe para probar.
- **Evidencia:** `.playwright-mcp/pbeta-r3-04-vuelta-post-login.png` (post-login: la card de Burger King, marcador vacío). Confirmado en la base: `place_list_items` seguía en **0** después del login. Al guardar después a mano sí se creó la fila.

#### PBETA-R3-04 — Guardar no dice dónde quedó ni cómo volver a encontrarlo

- **Ruta:** `/?z=palermo-soho` con sesión → marcador de «70 30 Bar»
- **Viewport:** 390×844
- **Esperado:** un aviso corto tipo «Guardado en Mis lugares · Ver», o algo que enseñe dónde vive lo guardado.
- **Observado:** el marcador se pinta de naranja y **no pasa nada más**: no hay toast, ni nombre de lista, ni link. Un usuario que guarda por primera vez no tiene forma de enterarse de que existe `/mis-lugares` salvo abriendo el menú del avatar y encontrando el ítem entre otros siete. El propio vacío de `/mis-lugares` explica muy bien el mecanismo… pero solo lo lee el que ya llegó.
- **Severidad propuesta:** MOLESTO.
- **Evidencia:** `pbeta-r3-07-sheet-destino.png` (estado después de guardar: solo cambia el ícono) · `pbeta-r3-08-menu-cuenta.png` (el menú del avatar, con «Mis lugares» como cuarto ítem de ocho).

#### PBETA-R3-05 — En `/mis-lugares` el título aparece dos veces seguidas

- **Ruta:** `/mis-lugares` con al menos un lugar guardado
- **Viewport:** 390×844
- **Esperado:** un solo encabezado.
- **Observado:** el H1 dice **«Mis lugares»** y tres líneas más abajo el nombre de la lista dice otra vez **«Mis lugares 1»**. Como la lista por defecto se llama igual que la página, se lee como un error de render más que como una jerarquía. (En el estado vacío no pasa: ahí el nombre de la lista no se muestra.)
- **Severidad propuesta:** COSMÉTICO.
- **Evidencia:** `.playwright-mcp/pbeta-r3-09-mis-lugares.png`.

#### PBETA-R3-06 — La card de un lugar guardado pierde los tags

- **Ruta:** `/mis-lugares`
- **Viewport:** 390×844
- **Esperado:** la misma card del listado.
- **Observado:** en el buscador «70 30 Bar» se muestra con sus tags (`Bar`, `Música en vivo`); en `/mis-lugares` la misma card muestra solo nombre y zona. Lo guardado se ve más pobre que lo encontrado, y son los tags los que te recuerdan **por qué** lo habías guardado.
- **Severidad propuesta:** COSMÉTICO.
- **Evidencia:** `pbeta-r3-05-guardado.png` (en el listado, con tags) vs `pbeta-r3-09-mis-lugares.png` (en lo guardado, sin tags).

---

### R4 — Armar una votación (el lado emisor de R2)

**Recorrido:** con sesión (`hugo@gmail.com`) → `/votacion/nueva` → buscar «congo» → agregar 2 lugares
→ crear → pantalla de link listo → `/mis-votaciones` → «Cerrar» (hasta la confirmación, sin
confirmar) → control a 360 px.

**Se creó en la base:** la votación `3764bfd4-31c6-4918-8f09-74f0a9f0f9d1`, token
`T84R9lgKIbm4338kjlzdEQ`, con 2 opciones y sin votos. Anotada en la tabla del cierre.

**Lo que funcionó bien:** la pantalla de alta es de lo mejor de la app — H1 + bajada que dice el
trato completo («Elegí 2 a 5 lugares y compartí el link al grupo»), contador «Tu shortlist 0/5»,
vacío explicativo, placeholder con voz propia («¿Dónde el viernes?») y el check de sugerencias con
su consecuencia escrita («hasta llegar a 8 en total. Vos podés sacar lo que sumen») · el buscador
filtra al toque y muestra zona y tags · **el cierre pide confirmación y avisa el efecto colateral**:
«Al cerrarla, sale de tu panel: la seguís viendo solo por su link» con la elección explícita de
ganador · los dos teasers de premium (`/mis-votaciones` y `/mis-lugares`) están escritos con
honestidad y sin prometer fechas.

**360 px:** sin desbordes en `/votacion/nueva` ni en `/mis-votaciones`.

| ID | Hallazgo | Severidad propuesta |
|----|----------|---------------------|
| PBETA-R4-01 | En la pantalla del link no hay «Compartir»: solo «Copiar» | **BLOQUEANTE** |
| PBETA-R4-02 | Nada te empuja a ponerle título, y sin título el link sale con el H1 feo de R2-04 | MOLESTO |
| PBETA-R4-03 | «Cerrar» y «Cancelar votación», juntos y sin decir qué hace cada uno | MOLESTO |
| PBETA-R4-04 | El botón de crear queda enterrado abajo de los resultados de búsqueda | MOLESTO |
| PBETA-R4-05 | El link a compartir se muestra cortado y no se puede leer | COSMÉTICO |
| PBETA-R4-06 | `/votacion/nueva` es la única pantalla sin el wordmark arriba | COSMÉTICO |

#### PBETA-R4-01 — En la pantalla del link no hay «Compartir»: solo «Copiar»

- **Ruta:** `/votacion/nueva` → «Crear votación y obtener link»
- **Viewport:** 390×844
- **Esperado:** un botón que abra el menú de compartir del celular y mande el link a un grupo de WhatsApp en un toque. Es **la** acción de la pantalla.
- **Observado:** los tres controles son `Copiar` (naranja, junto al campo del link), `Ver la votación` y `Ir a mis votaciones`. **No hay compartir nativo**, así que el camino es: copiar → salir de la app → abrir WhatsApp → elegir el grupo → pegar. En mobile eso son 4 pasos y una salida de la app justo en el momento en que arranca el loop viral. Lo mismo pasa en `/mis-votaciones`, donde la única opción es «Copiar link». **La app ya sabe hacerlo**: la ficha de un lugar tiene su botón «Compartir».
- **Severidad propuesta:** **BLOQUEANTE** — R4 existe para alimentar a R2, y este es el cuello exacto por donde pasa. Es además barato: el mismo componente que ya usa la ficha.
- **Evidencia:** `.playwright-mcp/pbeta-r4-04-creada.png` (los tres botones de la pantalla de éxito) · `pbeta-r4-05-mis-votaciones.png` («Ver» / «Copiar link») · la ficha con «Compartir» en `pbeta-r1-09-ficha-pie.png`.

#### PBETA-R4-02 — Nada te empuja a ponerle título

- **Ruta:** `/votacion/nueva`
- **Viewport:** 390×844
- **Esperado:** que el creador sepa qué van a ver los demás si deja el título vacío.
- **Observado:** el campo dice `Título (opcional)` y el placeholder `¿Dónde el viernes?`, y no pasa nada si lo dejás en blanco: se crea igual y **nunca se te vuelve a preguntar**. En la pantalla de éxito y en `/mis-votaciones` la votación aparece como `Congo Club Cultural · La Conga`. Es la causa directa de PBETA-R2-04, el H1 de 3-4 líneas que ve el invitado: **la falla se origina acá y se paga allá**.
- **Severidad propuesta:** MOLESTO.
- **Evidencia:** `pbeta-r4-01-nueva.png` (el campo opcional) · `pbeta-r4-05-mis-votaciones.png` (la votación rotulada con los dos nombres) · la votación creada tiene `title = NULL` en la base.

#### PBETA-R4-03 — «Cerrar» y «Cancelar votación», juntos y sin decir qué hace cada uno

- **Ruta:** `/mis-votaciones`
- **Viewport:** 390×844
- **Esperado:** dos etiquetas que se distingan solas.
- **Observado:** en la misma fila hay **«Cerrar»** (naranja, primario, a la izquierda) y **«Cancelar votación»** (gris, a la derecha). Antes de tocar, nada dice que «Cerrar» es *terminar la votación y elegir ganador* y que «Cancelar» es *anularla*; «Cerrar» además se lee naturalmente como «cerrar esta tarjeta / salir». La acción que termina la votación es la que está pintada con el color de acción primaria.
- **Atenuante importante:** al tocar «Cerrar» **sí** aparece una confirmación muy bien resuelta («¿Quién ganó?» + el aviso de que sale del panel + elegir ganador + «Confirmar cierre» / «Volver»). El problema es la etiqueta, no la falta de red.
- **Severidad propuesta:** MOLESTO.
- **Evidencia:** `pbeta-r4-05-mis-votaciones.png` (los dos botones juntos) · `pbeta-r4-06-cerrar.png` (la confirmación, que sí está bien).

#### PBETA-R4-04 — El botón de crear queda enterrado abajo de los resultados de búsqueda

- **Ruta:** `/votacion/nueva` con 2 lugares elegidos y una búsqueda activa
- **Viewport:** 390×844
- **Esperado:** que el botón de crear esté siempre a mano una vez que la shortlist es válida.
- **Observado:** con la búsqueda «congo» activa hay **12 resultados** entre el buscador y el CTA, así que «Crear votación y obtener link» queda en **y = 1.480 px de una página de 1.560**, con un viewport de 844. Es decir: terminaste de elegir y tenés que scrollear toda la lista que ya no te interesa para poder crear. Con el teclado abierto en un celular es peor.
- **Severidad propuesta:** MOLESTO.
- **Evidencia:** medición en vivo `{y:1480, docH:1560, innerH:844, resultados:12}` · `pbeta-r4-03-shortlist-2.png`.

#### PBETA-R4-05 — El link a compartir se muestra cortado

- **Ruta:** `/votacion/nueva` → pantalla de éxito
- **Viewport:** 390×844
- **Esperado:** poder leer el link, aunque sea para verificar que es el correcto antes de mandarlo.
- **Observado:** el campo muestra `https://adondesalimos.ngrok.a` y se corta. No hay forma de ver el link entero en pantalla.
- **Severidad propuesta:** COSMÉTICO (el botón «Copiar» copia bien; es cuestión de confianza, no de función).
- **Evidencia:** `pbeta-r4-04-creada.png`.

#### PBETA-R4-06 — `/votacion/nueva` es la única pantalla sin el wordmark arriba

- **Ruta:** `/votacion/nueva`
- **Viewport:** 390×844
- **Esperado:** el mismo encabezado que el resto.
- **Observado:** la página arranca directo con el H1 «Armar votación». Todas las demás auditadas (home, `/votacion/[token]`, ficha, `/login`, `/registro`, `/mis-lugares`, `/mis-votaciones`) llevan arriba el wordmark «¿A DÓNDE SALIMOS?» linkeado a `/`. Acá el único link de la página es `← Volver`.
- **Severidad propuesta:** COSMÉTICO.
- **Evidencia:** `pbeta-r4-01-nueva.png` · volcado del DOM: la página tiene **un solo** `a[href]` (`← Volver → /`) y `document.querySelector('a[href="/"] img')` devuelve `null`.

---

### R5 — Chat + premium apagado

**Recorrido:** con sesión (`hugo@gmail.com`, plan free) → `/chat` → tocar la sugerencia de la
propia app → leer la respuesta → chocar el gate → «Hacerme premium» → `/cuenta` → control a 360 px.

**Costo real de esta pasada:** `hugo@gmail.com` ya tenía **2 de 3** mensajes de la probadita
consumidos en 2026-08, así que alcanzó con **un solo mensaje** para ver la respuesta completa y el
gate. Una llamada a Sonnet 5; `ai.chat_quota_trial` = 3 y `chat_usage_monthly` de hugo quedó en 3/3
del mes 2026-08 (se renueva solo el 1º de septiembre; no hay nada que limpiar).

**Lo que funcionó bien:** el vacío es de los mejores («Contame qué pinta hacer · Describilo con tus
palabras y te tiro lugares reales») · el cupo restante se muestra **antes** de gastar, en el header ·
la respuesta llegó en voz rioplatense, con las 3 recomendaciones citadas y sus cards abajo, y
**admitiendo el problema en vez de inventar** («me trajo todo de Palermo Soho, no de Villa Crespo
específicamente») · el gate está bien escrito y aparece pegado al último mensaje, sin modal ·
después de gastar el cupo el input se deshabilita con un placeholder que lo explica.

**360 px:** sin desbordes en `/chat` ni en `/cuenta`. Lo que sí empeora es el header (ver R5-01).

> ⚠️ **Lo que NO se pudo auditar, y por qué.** La mitad del recorrido —**el premium anunciado como
> "en camino"** (`DEPLOY` decisión 6), que es el copy nuevo y sin rodar que motiva a R5— **no se ve
> en dev**. El interruptor es `cobroApagado()` (`lib/billing/apagado.ts`): está apagado ⇔ **no hay**
> `NEXT_PUBLIC_MP_PUBLIC_KEY`, y el `.env` de dev **sí la tiene** (el propio docstring del módulo lo
> dice: *«En dev el `.env` tiene la key, así que esto es `false` y no cambia nada»*). Por eso
> `/cuenta` muestra el camino de cobro real —«Suscribirme por $ 7.000/mes»— y **no** el `PITCH_BETA`
> («El premium está por salir: …») ni el botón «Avisame cuando abra». **Esto no es un hallazgo: es
> el comportamiento diseñado.** Para auditarlo hace falta: (1) comentar
> `NEXT_PUBLIC_MP_PUBLIC_KEY` en `.env`, (2) **reiniciar el dev server** —es `NEXT_PUBLIC_`, se
> inlinea en el bundle, no alcanza con cambiar la var— y (3) recorrer `/cuenta`, el gate del chat y
> `/mi-negocio/[placeId]`.
>
> ✅ **Resuelto en la misma sesión.** Fer comentó la var mientras la auditoría seguía en curso, así
> que el escenario **sí se recorrió**: ver *R5 (addendum)* más abajo. Ojo con la receta: **no hizo
> falta reiniciar el dev server**, Next tomó el cambio solo.

| ID | Hallazgo | Severidad propuesta |
|----|----------|---------------------|
| PBETA-R5-01 | La sugerencia que propone la app se come el único mensaje gratis y devuelve otra zona, diciendo que el catálogo no tiene lo que sí tiene | **BLOQUEANTE** |
| PBETA-R5-02 | El header del chat se parte en dos líneas | MOLESTO |
| PBETA-R5-03 | El gate no dice el precio ni que el cupo se renueva | MOLESTO |

#### PBETA-R5-01 — La sugerencia de la app gasta el mensaje gratis y devuelve otra zona

- **Ruta:** `/chat` → chip sugerido **«Una birra con amigos por Villa Crespo»** (texto de la app, no del usuario)
- **Viewport:** 390×844
- **Esperado:** que las 4 sugerencias que la app pone en la pantalla vacía sean consultas que el catálogo pueda contestar bien. Es la única demo gratis de la IA y la app elige el tema.
- **Observado:** la respuesta llegó bien escrita y honesta en la forma, pero: **(a)** los 3 lugares recomendados están en **Palermo Soho**, ninguno en Villa Crespo; **(b)** el texto le dice al usuario *«parece que por esa zona no hay tanta carga en el catálogo»*, y eso **no es cierto**: Villa Crespo tiene **1.169 lugares** en el catálogo, de los cuales **244** están tagueados `bar` o `cerveceria`. El usuario se queda creyendo que la app no cubre su barrio.
- **Alcance / cómo diagnosticarlo:** los *tool inputs* no se persisten (`chat_messages` guarda `content`, tokens y modelo, no la llamada a la herramienta), así que desde la base **no se puede saber** con qué filtros buscó — lo más probable es que «con amigos» haya agregado un tag que en Villa Crespo está poco curado. La herramienta para diagnosticarlo ya existe y está documentada: `npm run eval:chat`, que imprime los tool-inputs. **Ojo: reproducirlo cuesta tokens reales de Sonnet.**
- **Severidad propuesta:** **BLOQUEANTE** — encaja en el criterio «miente» de la decisión 5, y pasa en la superficie donde la app promete más, con el único mensaje que el usuario tiene para juzgarla. El arreglo más barato ni siquiera toca el motor: cambiar las 4 sugerencias por consultas que el catálogo conteste.
- **Evidencia:** `.playwright-mcp/pbeta-r5-03-respuesta.png` y el texto completo de la respuesta leído del DOM (arriba, citado). Contraste con la base: `select count(*) … where z.slug='villa-crespo'` → **1.169**; con `tag in ('bar','cerveceria')` → **244**.

#### PBETA-R5-02 — El header del chat se parte en dos líneas

- **Ruta:** `/chat`
- **Viewport:** 390×844 y 360×844
- **Esperado:** una sola línea: flecha · «Chat IA» · badge de cupo · «+» · historial.
- **Observado:** con el badge en su texto más largo, **el título «Chat IA» se parte en «Chat / IA» y el badge en «Te quedan 0 / mensajes»**, y el header pasa a ocupar el doble de alto. Es la barra permanente de la pantalla, así que se come alto útil de conversación en todos los mensajes. A 360 px se ve igual de partido.
- **Severidad propuesta:** MOLESTO.
- **Evidencia:** medición en vivo: badge `145 × 40 px` y título `76 × 48 px` (un badge de una línea mide ~24 px de alto) · `pbeta-r5-03-respuesta.png` (390) · `pbeta-r5-05-chat-360.png` (360).

#### PBETA-R5-03 — El gate no dice el precio ni que el cupo se renueva

- **Ruta:** `/chat` con la probadita agotada
- **Viewport:** 390×844
- **Esperado:** que el que choca el muro pueda decidir ahí mismo: cuánto sale, y si esperando se le renueva.
- **Observado:** el panel dice `Usaste tus mensajes de prueba` / `Hacete premium para seguir chateando con la IA todo el mes.` + botón `Hacerme premium`. **No aparece el precio** (el usuario tiene que tocar y caer en `/cuenta` para enterarse de los $ 7.000/mes) y **nada dice que el cupo se renueva**, cuando de hecho `chat_usage_monthly` es por mes y el 1º vuelve a haber probadita. El que no quiere pagar hoy se va creyendo que se quedó sin IA para siempre. Detalle menor del mismo panel: en una conversación nueva las 4 sugerencias siguen a la vista (atenuadas) invitando a tocar, justo arriba del cartel que dice que no se puede.
- **Severidad propuesta:** MOLESTO.
- **Evidencia:** `pbeta-r5-03-respuesta.png` (el gate completo) · `pbeta-r5-05-chat-360.png` (sugerencias atenuadas + gate en la misma pantalla) · `ai.chat_quota_trial = 3` y `chat_usage_monthly` con columna `month` en `app_settings`/base.

---


#### R5 (addendum) — El premium "en camino", auditado con el cobro realmente apagado

**Cómo se destrabó.** Fer comentó `NEXT_PUBLIC_MP_PUBLIC_KEY` en `.env` durante la sesión y **Next
tomó el cambio solo, sin reiniciar el dev server** (dato útil para la próxima: la receta de la nota
de arriba es más cara de lo necesario, alcanza con comentar y recargar). Se recorrió el escenario
completo y **la var se volvió a descomentar al terminar**.

**Se creó y se borró en la base:** `premium_interest` `a6106b0c-e440-4412-b722-437e457b5d70`
(hugo, sin `place_id`). Borrada al cierre; la tabla volvió a **0 filas**.

**Lo que funcionó bien — y es la parte que más importaba mirar, porque es copy sin rodar:**

- **`/cuenta` (B2C, plan free):** «**Todavía no abrimos los pagos.** · Estamos en beta. El premium
  está por salir: votaciones ilimitadas, historial y que la IA te arme la shortlist. Dejanos la
  señal y te escribimos apenas se pueda.» + botón «**Avisame cuando abra**». Dice primero que no se
  puede pagar y recién después qué te perdés — el orden correcto. Cero rastro de los $ 7.000.
- **`/mi-negocio/[placeId]` (B2B, `owner_plan='free'`):** el mismo patrón pero con **su propio
  texto**, no el del consumidor: «El **plan del lugar** está por salir: descripción, carta,
  novedades, hasta 15 fotos y el destaque en las búsquedas». La diferenciación b2c/b2b está bien
  hecha.
- **La confirmación:** «✓ Listo, anotado. Te escribimos a **hugo@gmail.com** apenas abramos los
  pagos» — nombra el mail al que va a escribir, y **sobrevive a la recarga** (se resuelve
  server-side), así que el que vuelve no recibe el pedido de nuevo.
- **360 px:** sin desbordes en ninguna de las dos pantallas con el pitch puesto.

| ID | Hallazgo | Severidad propuesta |
|----|----------|---------------------|
| PBETA-R5-04 | Con los pagos cerrados, el gate del chat sigue diciendo «Hacete premium» y manda a una pantalla que te desmiente | **BLOQUEANTE** |
| PBETA-R5-05 | «Contenido destacado» sigue diciendo «Activá el plan acá arriba», donde ya no hay nada que activar | MOLESTO |

##### PBETA-R5-04 — El gate del chat no se entera de que los pagos están cerrados

- **Ruta:** `/chat` con la probadita agotada, **con `cobroApagado() === true`**
- **Viewport:** 390×844
- **Esperado:** el mismo trato que en `/cuenta` — decir que todavía no se puede pagar y ofrecer dejar la señal.
- **Observado:** el gate no cambia nada: sigue diciendo `Usaste tus mensajes de prueba` / `**Hacete premium** para seguir chateando con la IA todo el mes.` con el botón `Hacerme premium` → `/cuenta`. El usuario toca, llega, y ahí le dicen **«Todavía no abrimos los pagos»**. En la beta —que es el único escenario donde esto corre— el gate del chat le vende al usuario una acción que la app no puede cumplir, y lo manda a que se lo desmientan. Peor todavía en el caso ya visto: hugo **ya había dejado la señal** y el chat le seguía ofreciendo hacerse premium.
- **Severidad propuesta:** **BLOQUEANTE** — criterio «miente» de la decisión 5, en la superficie donde la app promete más, y **solo pasa en producción** (en dev con la key puesta el camino es coherente). Es exactamente el tipo de cosa que R5 existe para cazar.
- **Evidencia:** `.playwright-mcp/pbeta-r5-08-gate-chat-apagado.png` (el gate, con el cobro apagado) vs `pbeta-r5-06-cuenta-apagado.png` (`/cuenta`, misma sesión, mismo momento). `lib/billing/apagado.ts` es isomorfo y ya lo usan `/cuenta`, `/mi-negocio/[placeId]` y `suscripcion-panel.tsx`; el panel del chat es el que no lo consulta.

##### PBETA-R5-05 — «Contenido destacado» manda a activar un plan que no se puede activar

- **Ruta:** `/mi-negocio/6323f392-d42f-4d27-8f3f-8b51e2b3cd44`, sección *Contenido destacado*, **con `cobroApagado() === true`**
- **Viewport:** 390×844
- **Esperado:** que el candado de los campos pagos apunte a lo que **sí** hay arriba: dejar la señal.
- **Observado:** el bloque de la suscripción, arriba, ya muestra el pitch de beta correcto; pero 2.000 px más abajo los campos pagos siguen deshabilitados con el texto **«Activá el plan del lugar acá arriba para editar estos campos»** — y «acá arriba» ya no tiene nada que activar, tiene un «Avisame cuando abra». Es la misma clase de problema que R5-04 (copy escrito para el mundo con cobro prendido que no cambia con el interruptor), pero acá el dueño ya está adentro del panel y no se pierde.
- **Severidad propuesta:** MOLESTO.
- **Evidencia:** `pbeta-r5-09-negocio-apagado.png` (el pitch de arriba) + snapshot del árbol: `paragraph "Todavía no abrimos los pagos."` y `button "Avisame cuando abra"` conviviendo con `paragraph "Activá el plan del lugar acá arriba para editar estos campos."` en la misma página.

---

### R6 — Soy dueño (reclamo mi lugar y lo edito)

**Recorrido:** con sesión de un usuario **sin** negocio (`hugo@gmail.com`) → `/registrar-negocio` →
buscar «La Choppería» → «Es mío» → `/reclamar/[placeId]` → enviar la solicitud → confirmación →
`/mi-negocio` con el reclamo **pendiente** → cambio de cuenta a la dueña aprobada
(`frodriguez.este@gmail.com`) → `/mi-negocio` → panel de *Kansas Grill & Bar* → control a 360 px.

**Se creó en la base:** el reclamo `4b4f143e-1f69-4e9c-a71a-7aba7cf62213` (hugo → La Choppería,
`pending`). Anotado en la tabla del cierre.

**Lo que funcionó bien:** `/registrar-negocio` explica el trato en una línea («Buscalo primero:
puede estar cargado aunque todavía no aparezca en la app. Si está, lo reclamás; si no, lo damos de
alta») · los resultados marcan «Cargado, todavía sin publicar» cuando corresponde · el formulario de
reclamo dice **por qué** pide cada cosa y aclara que la revisión es a mano · la confirmación es
clara y promete el canal («Recibimos tu solicitud. La revisamos a mano, una por una. Te avisamos por
mail cuando esté resuelta») · el panel del dueño es completo y **honesto con el plan**: los campos
pagos se ven pero deshabilitados, con el candado y el texto «Activá el plan del lugar acá arriba
para editar estos campos» — muestra el valor sin mentir · muestra «10 visitas este mes» y «2/3
fotos» · debajo de cada dato propio aclara qué se está mostrando hoy en la ficha.

**360 px:** sin desbordes, ni siquiera en el panel del dueño, que es la pantalla más densa de la
app (`scrollWidth` = `clientWidth` = 345).

**Confirma PBETA-R4-06:** `/registrar-negocio` y `/reclamar/[placeId]` **tampoco** llevan el
wordmark arriba (su único link es `← Volver`). Son 3 de 3 pantallas de "flujo" sin encabezado; no se
abre ID nuevo, es el mismo hallazgo.

| ID | Hallazgo | Severidad propuesta |
|----|----------|---------------------|
| PBETA-R6-01 | Un reclamo enviado es invisible: `/mi-negocio` dice «Todavía no tenés lugares» y te invita a mandarlo otra vez | MOLESTO |
| PBETA-R6-02 | Entrar al panel de un lugar con reclamo pendiente cae en el 404 crudo de Next | MOLESTO |
| PBETA-R6-03 | El panel del dueño mide 2.941 px y las fotos quedan **debajo** de «Guardar cambios» | MOLESTO |
| PBETA-R6-04 | «¿No está en la lista? Registralo vos» parece un cartel, no un botón | MOLESTO |
| PBETA-R6-05 | El buscador de negocios trae ruido: «La Choppería» devuelve pizzerías | COSMÉTICO |

#### PBETA-R6-01 — Un reclamo enviado es invisible

- **Ruta:** `/mi-negocio`, con un reclamo `pending` recién enviado
- **Viewport:** 390×844
- **Esperado:** ver el lugar reclamado con un estado «En revisión».
- **Observado:** el panel dice **«Todavía no tenés lugares»** y el cuerpo cierra con **«Si todavía no la mandaste, empezá por acá»** + botón «Registrá tu negocio» — es decir, invita a mandar la solicitud que el usuario **acaba de mandar hace 40 segundos**. La solicitud pendiente no aparece por ningún lado de la app: el dueño no tiene forma de verificar que llegó, y el camino que se le ofrece es volver a empezar (con el riesgo de duplicar el reclamo).
- **Por qué NO se propone BLOQUEANTE:** la pantalla anterior sí seteó la expectativa correcta («Te avisamos por mail cuando esté resuelta») y el propio cuerpo explica «Cuando aprobemos tu solicitud, el lugar aparece acá». El que leyó no queda perdido; el que vuelve más tarde, sí.
- **Severidad propuesta:** MOLESTO.
- **Evidencia:** `.playwright-mcp/pbeta-r6-05-reclamo-enviado.png` (confirmación) y `pbeta-r6-06-mi-negocio-pendiente.png` (el panel, 40 s después). En la base, el reclamo existe: `4b4f143e-… · status pending · hugo@gmail.com · La Choppería`.

#### PBETA-R6-02 — El panel de un lugar con reclamo pendiente cae en el 404 crudo

- **Ruta:** `/mi-negocio/b994632e-199a-4a61-99f2-5e6e5383de49` (La Choppería, reclamo `pending` del propio usuario)
- **Viewport:** 390×844
- **Esperado:** «Tu solicitud está en revisión» dentro de la app.
- **Observado:** HTTP **404** con la pantalla default de Next —blanca, en inglés, sin salida—, la misma de PBETA-R2-01. El caso llega solo: el link de «Mi negocio» del menú va a `/mi-negocio` (que está bien), pero el dueño que guardó la URL del reclamo, o que vuelve por el historial, aterriza acá.
- **Severidad propuesta:** MOLESTO **como caso**; la causa raíz es PBETA-R2-01 (no existen `app/not-found.tsx` ni `error.tsx`) y ahí está propuesta como BLOQUEANTE. Arreglando aquella, esta mejora sola — aunque el mensaje ideal («en revisión») es un paso aparte.
- **Evidencia:** navegación registrada por Playwright con `HTTP status: 404` sobre esa ruta, con la sesión del solicitante activa.

#### PBETA-R6-03 — El panel del dueño mide 2.941 px y las fotos quedan debajo de «Guardar cambios»

- **Ruta:** `/mi-negocio/6323f392-d42f-4d27-8f3f-8b51e2b3cd44` (Kansas Grill & Bar, dueño aprobado)
- **Viewport:** 390×844
- **Esperado:** poder guardar sin buscar el botón, y que lo que está abajo del botón no parezca fuera del formulario.
- **Observado:** la página mide **2.941 px** (3,5 pantallas) y el **único** «Guardar cambios» está en **y = 2.526**, sin quedar fijo. Editar el teléfono obliga a scrollear cinco secciones (suscripción · contacto · tags · horarios · contenido destacado) para guardar. Y **«Fotos» está después del botón**, así que se lee como si quedara fuera de lo que se guarda — cuando en realidad las fotos se suben aparte y al instante, algo que la pantalla no dice.
- **Severidad propuesta:** MOLESTO.
- **Evidencia:** medición en vivo `{docH:2941, guardarY:2526, innerH:844}` · `pbeta-r6-09-panel-duenio.png` (captura de la página entera).

#### PBETA-R6-04 — «¿No está en la lista? Registralo vos» parece un cartel, no un botón

- **Ruta:** `/registrar-negocio?q=…`, al pie de los resultados
- **Viewport:** 390×844
- **Esperado:** que la salida para el dueño cuyo local no está cargado se vea como una acción.
- **Observado:** el bloque **es** un `<button>`, pero está pintado con `border-dashed` + texto centrado en gris — que es exactamente el lenguaje visual que la app usa para sus **estados vacíos** (la home: «Elegí zona para arrancar»; el alta de votación: «Buscá lugares abajo y agregá 2 a 5»). Sin relleno, sin chevron y sin nada que lo distinga, se lee como un cartel informativo. Es el camino de todo dueño que no está en Overture, o sea el alta B2B entera.
- **Severidad propuesta:** MOLESTO.
- **Evidencia:** `pbeta-r6-03-alta-fallback.png` · DOM: `BUTTON` con `class="rounded-xl border border-dashed border-border p-5 text-center transition-colors"`.

#### PBETA-R6-05 — El buscador de negocios trae ruido

- **Ruta:** `/registrar-negocio?q=La+Choppería`
- **Viewport:** 390×844
- **Esperado:** el local buscado arriba y poco más.
- **Observado:** los 3 primeros resultados son correctos (La Choppería · La Choppe · La Choppe Express) pero después vienen **PIZZERIA LA CHACHA**, **PIZZERÍA La Chiquita**, **Pizzeria La Chela**, **Pizzería La Chispa** y **Pizzería la Chacha**: 5 de 8 no tienen que ver. Un dueño mirando en el celular ve una lista mayormente ajena y tiene que leer con cuidado antes de tocar «Es mío» — y tocar mal reclama el negocio de otro. Se suma que las direcciones se cortan con «…» (`Juramento 52…`, `Avenida de May…`), que es justo el dato que sirve para distinguir dos locales del mismo nombre.
- **Severidad propuesta:** COSMÉTICO.
- **Evidencia:** `pbeta-r6-02-busqueda-negocio.png` y `pbeta-r6-03-alta-fallback.png`.

---

### PULIDO_BETA F1 — Cierre: la lista completa y el estado de la base

**F1 está completa: los 6 recorridos, en vivo, a 390×844 y con control a 360 px.** Sale con **43
hallazgos**. **Nada de esto está triado todavía**: la severidad de cada uno es una propuesta y la
confirma o la baja Fer en **F2** (decisión 6).

> El pendiente que tenía R5 —el premium "en camino", invisible en dev— **se destrabó en la misma
> sesión**: Fer comentó `NEXT_PUBLIC_MP_PUBLIC_KEY`, se recorrió el escenario entero y se volvió a
> descomentar. Salieron 2 hallazgos más, uno de ellos BLOQUEANTE. Ver *R5 (addendum)*.

#### Los 43 hallazgos por severidad propuesta

| Severidad propuesta | Cuántos | IDs |
|---|---|---|
| **BLOQUEANTE** | **10** | R1-01 · R2-01 · R2-03 · R2-08 · R3-01 · R3-02 · R3-03 · R4-01 · R5-01 · R5-04 |
| MOLESTO | 25 | R1-02, R1-03, R1-04, R1-05, R1-06, R1-07 · R2-02, R2-04, R2-05, R2-06, R2-07, R2-09, R2-11, R2-12 · R3-04 · R4-02, R4-03, R4-04 · R5-02, R5-03, R5-05 · R6-01, R6-02, R6-03, R6-04 |
| COSMÉTICO | 8 | R1-08 · R2-10, R2-13 · R3-05, R3-06 · R4-05, R4-06 · R6-05 |

_(10 + 25 + 8 = 43.) Por recorrido: R1 **8** · R2 **13** · R3 **6** · R4 **6** · R5 **5** · R6 **5**._

#### Los 9 BLOQUEANTE propuestos, en una línea cada uno

| ID | Qué | Dónde duele |
|----|-----|-------------|
| PBETA-R2-01 | El 404 de un link roto es la pantalla default de Next: blanca, en inglés, sin salida | El link que llega cortado por WhatsApp — y también R6-02 |
| PBETA-R3-02 | `/registro` dice que la cuenta es «para reclamar o registrar tu negocio» al que quiso guardar un bar | La pantalla de conversión |
| PBETA-R3-03 | Después de loguearte, el lugar que querías guardar **no** queda guardado | El único momento en que la app cobra algo |
| PBETA-R3-01 | Tocar Guardar sin cuenta te expulsa a un login que no dice por qué estás ahí | Lo mismo, un paso antes |
| PBETA-R4-01 | La pantalla del link recién creado no tiene «Compartir», solo «Copiar» | El cuello del loop viral |
| PBETA-R2-03 | Al invitado no se le dice quién lo invitó ni qué es la app | La puerta de entrada de la mayoría |
| PBETA-R2-08 | La votación cerrada o expirada no ofrece un paso siguiente | El que llega tarde al link |
| PBETA-R5-01 | La sugerencia de la app gasta el mensaje gratis y afirma que el catálogo no tiene un barrio que sí tiene | La demo de la IA |
| PBETA-R5-04 | Con los pagos cerrados, el gate del chat igual dice «Hacete premium» y te manda a que te desmientan | Solo pasa en la beta |
| PBETA-R1-01 | El botón del selector de zona dice «Nada con eso» antes de que elijas nada | El primer control de la home |

**Tres son de copy** (R3-02, R1-01 y la mitad de R2-08) y se arreglan cambiando strings. **Tres son
de continuidad de estado** (R3-01, R3-03, y R2-03/R2-08 en cuanto a "qué hago ahora"). **Uno es una
pantalla que no existe** (R2-01, `app/not-found.tsx`). **Uno es un botón que la app ya tiene en otro
lado** (R4-01, el «Compartir» de la ficha). **Uno es una función que la app ya tiene y ese componente
no consulta** (R5-04, `cobroApagado()`). **Uno hay que diagnosticar** (R5-01, con
`npm run eval:chat`).

#### 360 px — el criterio del DoD se cumple

**Cero desbordes en los 6 recorridos.** Medido con `document.scrollWidth` vs `clientWidth` y un
barrido de `getBoundingClientRect()` sobre todos los elementos, en: `/`, `/?z=…`, mapa,
`/lugar/[id]`, `/votacion/[token]`, `/votacion/nueva`, `/mis-votaciones`, `/login`, `/registro`,
`/mis-lugares`, `/chat`, `/cuenta`, `/registrar-negocio`, `/reclamar/[id]` y
`/mi-negocio/[placeId]` (la más densa, 2.941 px de alto). Único efecto visible del ancho chico: el
H1 de la votación sin título pasa de 3 a 4 líneas (PBETA-R2-04).

#### La base quedó como estaba (decisión 13)

Se corrió el `DELETE`/`UPDATE` de reversión al terminar y **los conteos volvieron a los del
arranque**:

| Tabla | Antes | Después | |
|---|---|---|---|
| polls · poll_options · poll_votes | 6 · 25 · 19 | **6 · 25 · 19** | ✅ |
| place_claims · place_lists · place_list_items | 1 · 1 · 0 | **1 · 1 · 0** | ✅ |
| premium_interest · users | 0 · 4 | **0 · 4** | ✅ |
| place_owner_content · place_photos | 1 · 2 | **1 · 2** | ✅ |
| `place_tags source='admin'` (canario de curaduría) | 3.967 | **3.967** | ✅ |
| chat_conversations · chat_messages | 16 · 40 | 17 · 42 | ⚠️ **a propósito** |

Lo revertido, con su `id`: voto `adebc48a-af59-4ceb-8670-662f0cd64365` · votación
`3764bfd4-31c6-4918-8f09-74f0a9f0f9d1` (token `T84R9lgKIbm4338kjlzdEQ`, borrada con sus 2 opciones) ·
reclamo `4b4f143e-1f69-4e9c-a71a-7aba7cf62213` · lista vacía `56c2479c-2428-4e7a-826e-0344418cd26e`
· interés en el premium `a6106b0c-e440-4412-b722-437e457b5d70` (del addendum de R5) · la opción
`8c87d0d0-…` ya se había sacado desde la propia UI durante R2. Restaurados:
`polls.expires_at` de `pYBcg_6TgoNpebFNOgQ7wg` a `2026-08-03 15:09:45.613` y `polls.status` de
`bCC7kEsmhr3Vb9NReHOUFg` a `open`.

**Lo que queda a propósito, y por qué:**

- **La conversación del chat (+1 conversación, +2 mensajes).** Es **uso real** y su costo ya quedó
  contabilizado; borrarla desalinearía el historial del chat con `ai_api_usage`. Mismo criterio que
  la lección del test que borraba `ai_api_usage` del mes real.
- **`chat_usage_monthly` de `hugo@gmail.com`: 2 → 3 del mes 2026-08** (probadita agotada). No se
  toca: se renueva solo el 1º de septiembre.
- **2 sesiones de login** (hugo y frodriguez.este). `session` es estado de auth, no dato de
  producto, y el **paso 5 de `DEPLOY` F0 ya limpia `users`/`session`/`account`** antes de subir el
  dump a Neon.

**El dump de F0 puede salir ahora**: F1 no tocó `app_settings`, ni chips, ni tags, ni curaduría.

#### Lo que F1 **no** cubrió (para que no se descubra tarde)

1. ~~El premium "en camino"~~ — **destrabado en la misma sesión** y auditado entero (ver *R5
   (addendum)*): 2 hallazgos más, uno BLOQUEANTE. Lo único que no se probó de ese escenario es el
   «Avisame cuando abra» **del lado B2B** (`/mi-negocio/[placeId]`, con `place_id`): se verificó
   que el pitch B2B es el correcto y distinto del B2C, pero el botón se tocó solo en `/cuenta`
   para no dejar una segunda fila que borrar.
2. **El alta nueva de usuario end-to-end** (pantalla de "te mandamos un mail", el mail, y la vuelta
   después de verificar): `requireEmailVerification: true` lo hace imposible sin un inbox real. Se
   auditó el formulario y el resto del recorrido con una cuenta existente.
3. **`/admin` y `/legales`**: fuera de scope explícito del spec.
4. **Desktop**: el spec pide mirarlo «de reojo» y esta pasada fue íntegramente mobile.

---

## PULIDO_BETA F2 (triaje) + F3 (fix) — los 10 BLOQUEANTE, arreglados y re-verificados (2026-08-03)

**Spec:** `docs/specs/active/PULIDO_BETA.md`. **Qué es esto:** el triaje de Fer sobre los 43
hallazgos de F1 (decisión 6) y el arreglo de lo que quedó BLOQUEANTE (decisión 5), cada uno
re-verificado **en su recorrido completo y en vivo**, no en la pantalla suelta.

### F2 — El triaje (lo decidió Fer, hallazgo por hallazgo)

**Los 10 propuestos BLOQUEANTE se confirmaron los 10.** Ninguno bajó de severidad. Dos salieron con
el alcance acotado por Fer, y está anotado abajo. Los 33 restantes (25 MOLESTO + 8 COSMÉTICO)
**se mudan al `BACKLOG` con su ID** y no se tocaron en esta sesión.

| ID | Veredicto de Fer | Destino |
|----|------------------|---------|
| PBETA-R1-01 | BLOQUEANTE confirmado | **Arreglado** (F3) |
| PBETA-R2-01 | BLOQUEANTE confirmado | **Arreglado** (F3) |
| PBETA-R2-03 | BLOQUEANTE confirmado — **alcance: nombre del creador + qué es la app** | **Arreglado** (F3) |
| PBETA-R2-08 | BLOQUEANTE confirmado (CTA **y** copy que distinga los dos finales) | **Arreglado** (F3) |
| PBETA-R3-01 | BLOQUEANTE confirmado | **Arreglado** (F3) |
| PBETA-R3-02 | BLOQUEANTE confirmado | **Arreglado** (F3) |
| PBETA-R3-03 | BLOQUEANTE confirmado — **alcance: guardar al volver**, no solo "volver con el lugar a la vista" | **Arreglado** (F3) |
| PBETA-R4-01 | BLOQUEANTE confirmado | **Arreglado** (F3) |
| PBETA-R5-01 | BLOQUEANTE confirmado — **alcance: cambiar las 4 sugerencias, sin diagnosticar** | **Arreglado** (F3); la causa raíz → `BACKLOG` |
| PBETA-R5-04 | BLOQUEANTE confirmado | **Arreglado** (F3) |

**Los 33 restantes → `BACKLOG` con su ID** (decisión 5), sin excepción y sin descartados:
MOLESTO — R1-02, R1-03, R1-04, R1-05, R1-06, R1-07 · R2-02, R2-04, R2-05, R2-06, R2-07, R2-09,
R2-11, R2-12 · R3-04 · R4-02, R4-03, R4-04 · R5-02, R5-03, R5-05 · R6-01, R6-02, R6-03, R6-04.
COSMÉTICO — R1-08 · R2-10, R2-13 · R3-05, R3-06 · R4-05, R4-06 · R6-05.
**Ningún hallazgo quedó sin destino** (criterio del DoD): 10 arreglados + 33 al backlog = 43.

> **R5-01, el que no se diagnosticó a propósito.** Fer eligió el camino barato: las 4 sugerencias
> se cambiaron por consultas que el catálogo **sí** puede contestar, sin correr `npm run eval:chat`
> (que cuesta tokens reales de Sonnet). **La causa raíz sigue abierta** —por qué el motor devolvió
> Palermo Soho para una consulta de Villa Crespo— y va al `BACKLOG` con su ID. El síntoma que
> importaba (la demo gratis miente sobre la cobertura del catálogo) está tapado; el diagnóstico es
> un ítem propio.

### F3 — Qué se tocó, y por qué así

| ID | Arreglo | Archivos |
|----|---------|----------|
| R1-01 | `BotonAplicar` deja de reusar el copy de "sin resultados" cuando el borrador está **vacío**: deshabilitado manda sobre el conteo y el label lo pone el sheet (`etiquetaVacia`) | `components/search/zone-sheet.tsx` |
| R3-02 | La bajada de `/registro` pasa a hablar de lo que trae a la mayoría; el negocio queda al final, no al principio | `app/(auth)/registro/page.tsx` |
| R5-04 | El gate del chat consulta `cobroApagado()` — **la misma función** que ya usan `/cuenta`, `/mi-negocio/[placeId]` y `suscripcion-panel.tsx`. Con los pagos cerrados no ofrece un pago: manda a dejar la señal, que es lo único que la app puede cumplir | `app/chat/chat-client.tsx` |
| R2-01 | `app/not-found.tsx` nuevo: tema de la app, castellano, wordmark y una salida a la home. Arregla de paso **R6-02** (el panel de un reclamo pendiente caía en el mismo 404 crudo) | `app/not-found.tsx` |
| R4-01 | La regla de compartir sale de `ficha-actions.tsx` y pasa a **dueño único** (`compartirLink` + `BotonCompartir`), montada en la pantalla del link recién creado y en `/mis-votaciones`. La ficha usa el mismo helper | `components/shared/boton-compartir.tsx`, `components/lugar/ficha-actions.tsx`, `app/votacion/nueva/nueva-client.tsx`, `app/mis-votaciones/mis-votaciones-client.tsx` |
| R3-03 | El `placeId` que se quiso guardar viaja en `sessionStorage` (no en la URL) y `ReanudarGuardado` lo consume al aterrizar con sesión, **aterrice donde aterrice**. El 401 **no** consume el pendiente | `lib/favoritos/pendiente.ts`, `components/favoritos/reanudar-guardado.tsx`, `components/favoritos/boton-guardar.tsx`, `app/layout.tsx` |
| R3-01 | El login sabe por qué estás ahí (`motivo=guardar`): «Entrá para guardarlo» | `app/(auth)/login/page.tsx`, `components/favoritos/boton-guardar.tsx` |
| R2-03 | La votación dice **quién invitó** (`users.name`, solo el nombre de pila) y **qué es la app**, arriba y no a 990 px de scroll | `lib/votaciones/query.ts`, `app/votacion/[token]/page.tsx` |
| R2-08 | La cerrada/vencida ofrece «Armar la mía» y «Buscar lugares», y el copy distingue los dos finales | `app/votacion/[token]/votacion-client.tsx`, `app/votacion/[token]/page.tsx` |
| R5-01 | Las 4 sugerencias apuntan a tags densos, con la regla escrita en el docstring para la próxima | `app/chat/chat-client.tsx` |

**Tres decisiones de implementación que valen la pena, porque no eran obvias:**

1. **El pendiente de guardar va en `sessionStorage`, no en la URL** (`?guardar=<id>`). Mismo patrón
   que la shortlist del chat, y además un link de un tercero no puede guardarle un lugar a nadie.
2. **`ReanudarGuardado` vive en el layout raíz, no en el botón.** Con scroll infinito, al volver del
   login la card del lugar **muchas veces no está montada**; si el reanudador viviera en
   `BotonGuardar`, el arreglo fallaría en silencio justo en las listas largas. Y no lee la sesión:
   el **401 es la señal** de "todavía no se logueó" y en ese caso no consume el pendiente.
3. **"La cerró alguien" vs "venció sola" no se puede leer del estado.** La expiración perezosa
   persiste `status='closed'` en los dos casos, así que el copy nuevo habría mentido de otra forma.
   Se deriva de las fechas: `closed_at < expires_at` ⇒ la cerró quien la armó. Verificado en las dos
   ramas (ver abajo).

### Re-verificación en vivo — los 10, en recorrido completo

Contra `https://adondesalimos.ngrok.app` con Playwright, **390×844** y control a **360 px**. Como en
F1, el click sintético no dispara los handlers: todo se tocó con `element.click()` vía `evaluate` y
**cada efecto se confirmó por su consecuencia** (URL, `sessionStorage`, llamada a `navigator.share`,
fila en la base), nunca por el resultado de la herramienta.

| ID | Cómo se verificó | Resultado |
|----|------------------|-----------|
| PBETA-R1-01 | Home → sheet de zona en sus **tres** estados | Sin zonas: `{txt:"Elegí una zona", disabled:true}` · con Palermo Soho: `{txt:"Ver 1.095 lugares", disabled:false}` · al deseleccionar vuelve a «Elegí una zona». **El caso legítimo sigue vivo**: con `?q=zzzqqq` + Palermo Soho el mismo botón dice `{txt:"Nada con eso", disabled:false}` ✅ |
| PBETA-R2-01 | `/no-existe-esta-ruta` y `/ruta-que-no-existe` | HTTP **404** con `<title>` «Ese link no anda · ¿A dónde salimos?», `body` en `rgb(13,13,31)` (el tema de la app), `lang="es"`, wordmark y link «Buscar lugares» → `/`. Sin desborde a 390 ni a 360 ✅ |
| PBETA-R2-03 | Link de votación **sin sesión** (se cerró la sesión con `/api/auth/sign-out`) | Header: `TE INVITÓ PEPE` + H1 + «Elegí a dónde ir: votás sin crear cuenta. Esto es ¿A dónde salimos?, la app para decidir la salida con el grupo.» La bajada aparece **solo si está abierta** (en la cerrada sería falsa) ✅ |
| PBETA-R2-08 | Las **tres** ramas, con la base como oráculo | Vencida (`pYBcg…`, `closed_at > expires_at`): «Esta votación venció: se cierran solas a los 3 días…» · cerrada con ganador (`GPeDP…`): «Esta votación cerró. Ganó Cine Lorca.» · cerrada por el creador sin ganador (forzando `closed_at = expires_at - 1h` en `yKSV9…`, **restaurado después**): «Quien la armó ya cerró esta votación.» Las tres con «Armar la mía» y «Buscar lugares» ✅ |
| PBETA-R3-01 | Recorrido de R3 desde cero, sin sesión | El tap manda a `/login?callbackUrl=%2F%3Fz%3Dpalermo-soho&motivo=guardar` y la pantalla dice **«Entrá para guardarlo»** / «Lo guardamos en tus lugares apenas entres…» ✅ |
| PBETA-R3-02 | `/registro` en el mismo recorrido | «Para guardar lugares, armar votaciones con tu grupo y reclamar tu negocio» ✅ |
| PBETA-R3-03 | **El recorrido entero**: card → login → alta de sesión → vuelta → `/mis-lugares` | Antes del login: `sessionStorage['ads:guardar-pendiente'] = d3695142-…` (Burger King). Después: pendiente `null`, el marcador vuelve como `aria-label="Sacar de guardados"` y **la base confirma la fila** `place_list_items 7bef2986-… → Burger King · lista de hugo@gmail.com`. El lugar aparece en `/mis-lugares` ✅ |
| PBETA-R4-01 | R4 completo: `/votacion/nueva` → 2 lugares → crear → pantalla del link → `/mis-votaciones` | Con `navigator.share` instrumentado: la pantalla del link llama `{title:"Votá a dónde salimos", url:".../votacion/JiRtDBJy…"}` y `/mis-votaciones` `{title:"Congo Club Cultural · Circo Congo", url: el mismo}`. **Sin `navigator.share`** (desktop) el botón copia y pasa a «Link copiado» — no se perdió «Copiar» ✅ |
| PBETA-R5-01 | `/chat` (sin gastar un solo mensaje: hugo ya tenía la probadita agotada) | Las 4 en pantalla: «Armame un plan: cenar y después bailar en Palermo» · «Una birra por Villa Crespo» · «Un café de especialidad por Belgrano» · «Algo con música en vivo por San Telmo». Densidad medida en la base **antes** de elegirlas ✅ |
| PBETA-R5-04 | `/chat` con la probadita agotada **y `cobroApagado() === true`** (Fer comentó `NEXT_PUBLIC_MP_PUBLIC_KEY` durante la sesión y la restauró al terminar) | El gate dice «Todavía no abrimos los pagos. Dejanos la señal y te escribimos apenas se pueda.» + «Dejar la señal» → `/cuenta`, donde **efectivamente** está «Avisame cuando abra». El embudo cierra ✅. Con la key puesta el camino viejo sigue intacto («Hacete premium») ✅ |

**Por qué las sugerencias nuevas son estas y no otras** (R5-01). Se midió la densidad real antes de
escribirlas, porque el problema no era el copy sino que el tema elegido no tiene catálogo detrás:

| Tag | Lugares | |
|---|---|---|
| `romantico` | **71** en todo AMBA | era el de «Cena romántica, algo lindo» |
| `wifi-trabajar` | **218** en AMBA (6 en Palermo Soho, 8 en Villa Crespo) | era el de «Un café para laburar con wifi» |
| `bar` / `cerveceria` en Villa Crespo | **207 / 37** | el catálogo **sí** podía contestar la vieja: el sobre-filtrado vino de otro lado (→ backlog) |
| `cafe-especialidad` en Belgrano | **101** | nueva |
| `musica-en-vivo` en San Telmo | **38** | nueva |

### 360 px — sigue sin desbordes

Medido con `scrollWidth` vs `clientWidth` y barrido de `getBoundingClientRect()` en las pantallas
tocadas: `/` y el sheet de zona, `/votacion/[token]` (abierta y cerrada), `/registro`, `/login`,
`/mis-lugares`, `/mis-votaciones`, `/chat` (con el gate apagado) y el 404 nuevo. **Cero elementos
fuera del viewport.** Único cambio de alto: el header de la votación pasa de 110 a **174 px** a 390
y a **204 px** a 360, por la bajada nueva de R2-03 — es texto que antes no estaba, no un desborde.

### La base quedó como estaba (decisión 13)

| Tabla | Antes | Después | |
|---|---|---|---|
| polls · poll_options · poll_votes | 6 · 25 · 19 | **6 · 25 · 19** | ✅ |
| place_lists · place_list_items | 1 · 0 | **1 · 0** | ✅ |
| premium_interest · users · place_claims | 0 · 4 · 1 | **0 · 4 · 1** | ✅ |
| `place_tags source='admin'` (canario de curaduría) | 3.967 | **3.967** | ✅ |
| chat_conversations · chat_messages | sin cambio | **sin cambio** | ✅ (no se gastó ningún mensaje de IA) |

Lo creado y revertido, con su `id`: votación `f19a9132-29f6-426d-824c-f3daa4a6421a` (token
`JiRtDBJy-71Z5bZ0z6wrtQ`, borrada con sus 2 opciones) · favorito
`7bef2986-e85e-451c-b9f5-6ea25e1542cb` · la lista default de `hugo@gmail.com`
`90f4dbc9-4ae9-48ae-8527-2a31a85fe072` (la creó el propio guardado, quedó vacía y se borró).
Restaurados: `polls` de `pYBcg_6TgoNpebFNOgQ7wg` (`expires_at` a `2026-08-03 15:09:45.613`,
`status='open'`, `closed_at=NULL` — se había reabierto 6 h para ver el estado abierto de R2-03) y
`closed_at` de `yKSV9_YUiNKVobQhCeMnPg` a `2026-07-31 15:09:13.191` (se había forzado para ver la
rama "la cerró el creador"). **Queda a propósito**: la sesión de `hugo@gmail.com` y el cierre de la
de `frodriguez.este@gmail.com` — `session` es estado de auth y el paso 5 de `DEPLOY` F0 la limpia.

### Gate técnico

`npx tsc --noEmit` limpio · **645 tests en 58 archivos, todos verdes** (`npm test`). El `build` va
al final, con el dev server parado (comparten `.next`, lección de BUSQUEDA).

### Lo que este tramo **no** cubrió

1. **La causa raíz de R5-01** (por qué el motor devolvió otra zona): decisión explícita de Fer, va
   al `BACKLOG` con su ID. Se diagnostica con `npm run eval:chat`, que cuesta tokens de Sonnet.
2. **El alta nueva de usuario end-to-end**: sigue bloqueada por `requireEmailVerification` (mismo
   límite que F1). El tramo nuevo de R3-03 se verificó con una cuenta existente, que recorre el
   mismo código: `ReanudarGuardado` no distingue si la sesión es nueva o vieja.
3. **F4 (la app instalable)**: no se tocó. Es lo único que le queda al spec.

---

## PULIDO_BETA F4 (app instalable) + el alta nueva end-to-end (2026-08-03)

**Spec:** `docs/specs/active/PULIDO_BETA.md`. **Qué es esto:** la última fase del spec (la app
instalable) y el **único recorrido que nunca se había visto**: el alta de un usuario nuevo de punta
a punta, que F1 y F3 no pudieron cubrir porque `requireEmailVerification` hace imposible el login
sin un inbox real. Fer puso su mail y verificó a mano.

### F4 — la app instalable

**Qué se agregó.** `app/manifest.ts` (`MetadataRoute.Manifest`) · `public/icons/icon-192.png`,
`icon-512.png`, `icon-maskable-512.png` · `app/apple-icon.png` (180) · `themeColor` en el `viewport`
de `app/layout.tsx`. Los cuatro PNG salen de `docs/product/assets/logo_2.png` (1024×1024 RGBA)
recortado al pin y redimensionado con `sharp` — el original de 1,4 MB no se sirve.

**Dos decisiones de implementación que no eran obvias:**

1. **Los íconos del manifest van a `public/icons/`, el `apple-icon` a `app/`.** No es incoherencia:
   `app/` solo sirve los **nombres de convención** de Next (`icon`, `favicon`, `apple-icon`), que
   Next inyecta solo en el `<head>` con una URL hasheada. Un ícono referenciado **por URL fija desde
   el manifest** no puede vivir ahí. `apple-icon.png` sí es convención (Next emite el
   `<link rel="apple-touch-icon">` sin que nadie lo escriba), así que se queda en `app/` junto a
   `icon.png`, que es lo que el proyecto ya usaba.
2. **El `maskable` lleva fondo sólido y el pin al 58 % del lado.** El SO recorta el ícono hasta un
   círculo de 80 % del lado; un pin de aspecto 0,76 inscrito en ese círculo mide 63,7 % de alto, así
   que 58 % deja margen. El `apple-icon` también va con fondo sólido: **iOS no respeta la
   transparencia** y un PNG RGBA queda con el fondo negro.

| ID | Caso | Resultado | Evidencia |
|----|------|-----------|-----------|
| PBETA-08 | `manifest.ts` vs la paleta de `HOME_IDENTIDAD` | ✅ PASS | `theme_color` y `background_color` = **`#0D0D1F`**, que es `--background` de `app/globals.css`. Cero colores nuevos. El `<meta name="theme-color">` en vivo también da `#0D0D1F` |
| PBETA-10 | El original de 1,4 MB no se sirve | ✅ PASS | `/logo_2.png` → **404** y `/docs/product/assets/logo_2.png` → **404**. Lo servido pesa 34 / 210 / 84 / 20 kB |
| — | El manifest se sirve y se parsea | ✅ PASS | `/manifest.webmanifest` → **200 `application/manifest+json`**, 513 bytes. El browser lo resuelve desde `<link rel="manifest">` y `fetch` + `JSON.parse` limpio |
| — | Los 3 íconos cargan con el tamaño declarado | ✅ PASS | 192→`192x192`, 512→`512x512`, maskable→`512x512`, medidos con `naturalWidth/Height` en la página, no leyendo el archivo |
| — | `apple-touch-icon` inyectado | ✅ PASS | `<link rel="apple-touch-icon" href="/apple-icon.png?…" sizes="180x180" type="image/png">` en el `<head>` de `/` |
| PBETA-06 | Android por ngrok — instalar de verdad | ✅ PASS | **Fer la instaló en su Android**: *"se instaló perfecto"*. Al abrirla aparece el **splash con el logo** — el que Android dibuja solo con `background_color` + ícono + `name`, que es exactamente la decisión 9 (*el splash sale gratis del manifest*) funcionando |
| PBETA-07 | iOS por ngrok — "Agregar a pantalla de inicio" | ⏳ **sin probar** | El `apple-touch-icon` 180 está servido y linkeado en el `<head>`; falta un iPhone a mano |

**Los criterios de instalabilidad, medidos uno por uno en el browser** (no leídos del código), contra
la lista oficial de Chrome: HTTPS ✅ · `name`/`short_name` ✅ · ícono 192 ✅ · ícono 512 ✅ ·
`start_url` `/` ✅ · `display` `standalone` ✅ · `prefer_related_applications` ausente ✅ · maskable ✅.

> **Post-cierre (mismo día): el wordmark en el splash.** Al instalarla, Fer vio que el splash sale
> **solo con el pin, sin el nombre**. Se había dicho que Android lo pinta desde `name` — **su captura
> demuestra que no**, y su versión no lo hace. **El manifest no tiene ningún campo de texto para el
> splash**: Chrome lo compone con `background_color` + un ícono y nada más, así que la única forma de
> que se lea "¿A dónde salimos?" al abrir es que **esté dentro del PNG**.
> Se compuso el **mismo pin de siempre** (`logo_2.png` recortado, **no** se usó `logo-identidad.png`)
> con el wordmark tipografiado abajo — «¿A DÓNDE» en blanco, «SALIMOS?» en el degradado
> `#FF2D75 → #FF8A00 → #FFD400` y «DESCUBRÍ TU PRÓXIMO PLAN».
>
> **Se intentó dos veces y NO se puede. El resultado es la decisión de no hacerlo.**
>
> | Intento | Hipótesis | Resultado en el celular de Fer |
> |---|---|---|
> | 1 | Un **ícono extra de 1024** con el wordmark: "Chrome elige el más grande para el splash" | ❌ **Sin texto.** La hipótesis era falsa: la doc dice *«the icon that most closely matches the device resolution»* — el más cercano a la **resolución del dispositivo**, no el más grande. El de 1024 nunca entró en juego |
> | 2 | El wordmark en **`icon-512.png`** (`any`), que es el tamaño que un teléfono real pediría | ❌ **Sin texto**, tras desinstalar y reinstalar |
>
> **Por descarte, el splash usa el `maskable`** — que es **el mismo archivo que Android usa para el
> ícono del launcher**. No hay forma de darle texto a uno sin dárselo al otro: es una sola imagen
> para las dos cosas. Se preparó el maskable con wordmark y se verificó que **entra en la zona
> segura** del 80 % (`.playwright-mcp/prueba-maskable-safezone.png`), así que era técnicamente
> viable — el bloqueo no fue técnico.
>
> **Decisión de Fer: el splash queda sin texto.** El ícono de la pantalla de inicio se ve todos los
> días; el splash dura menos de un segundo, y a tamaño de launcher (~150 px reales) «DESCUBRÍ TU
> PRÓXIMO PLAN» no se lee, se ve como una mancha. **Se revirtió todo**: `icon-512.png` volvió a la
> versión limpia (con el splash descartado, el wordmark ahí solo ensuciaba el diálogo de instalación
> y la lista de apps) y `icon-splash-1024.png` se borró. **El manifest quedó con los 3 íconos
> originales**, y con el porqué escrito arriba de `icons` para que no se vuelva a intentar.

> **El service worker NO es requisito** — se verificó en la doc de Chrome antes de dar F4 por hecho,
> porque si lo fuera el DoD sería imposible sin salir de scope (el SW está en la lista de v2 del
> spec). No lo es: la lista de installability pide manifest + HTTPS + íconos, y nada más. El SW
> sigue siendo v2.

### El alta nueva de usuario, end-to-end — R3 completo, 390×844

Recorrido real y sin atajos: home sin sesión → sheet de zona → **Palermo Soho** (`Ver 1.095
lugares`) → tocar **Guardar** en la card de *Burger King* → muro → `/registro` por el link del
login → alta con `fernando.rodriguez84@yahoo.com.ar` → mail → verificación → vuelta. Como en F1 y
F3, cada toque fue `element.click()` vía `evaluate` y **cada efecto se confirmó por su consecuencia**
(URL, `sessionStorage`, fila en la base), nunca por el resultado de la herramienta.

| # | Qué se miró | Resultado |
|---|-------------|-----------|
| a | La pantalla después del submit | ✅ «📬 **Revisá tu mail** — Te mandamos un link para verificar tu email. Confirmalo y ya vas a poder iniciar sesión. Revisá también la carpeta de spam.» + «← Ir a iniciar sesión». Se entiende y dice qué hacer |
| b | El mail | ✅ **Llegó** (Fer lo confirmó en su inbox de Yahoo). Asunto `Verificá tu email — ¿A dónde salimos?`, cuerpo en voseo, CTA naranja `#FF8A00` «Verificar mi email →», nota de "si no creaste una cuenta, ignoralo". **El link funciona** |
| c | Dónde aterrizás después de verificar | ✅ **No te deja a pie.** El link trae `callbackURL=%2F`: aterriza en la home **y con la sesión ya iniciada** (`/api/auth/get-session` → `fernando.rodriguez84@…`, `emailVerified: true`), con la inicial del usuario en el header. No hay que volver a loguearse |
| d | Si el guardado pendiente sobrevive a un **alta nueva** | ✅ **en la misma pestaña** · ❌ **en otra** → **PBETA-R3-07** |

**El punto (d), medido en las dos ramas.** El pendiente que deja `BotonGuardar` vive en
`sessionStorage`, que es **por pestaña**:

- **Misma pestaña** (la del alta): `ads:guardar-pendiente = d3695142-…` sobrevivió al submit, al
  mail y a la navegación a `/api/auth/verify-email`. Al aterrizar, `ReanudarGuardado` lo consumió y
  **la base lo confirma**: `place_list_items d7a7be45-…` → *Burger King*, en la lista default
  `9b5037a7-…` que creó el propio guardado, con `created_at 18:55:23.968` — **el mismo segundo que
  la verificación**. El lugar aparece en `/mis-lugares` con «Sacar de guardados» ✅.
  **El arreglo de PBETA-R3-03 no dependía de que la cuenta fuera vieja**, que era la duda que dejó
  abierta F3.
- **Otra pestaña**: se abrió una pestaña nueva al mismo origen y su `sessionStorage` arranca en
  `{}`. El pendiente no viaja.

### Hallazgo nuevo — PBETA-R3-07

| Campo | |
|---|---|
| **Ruta** | card/ficha → `/login` → `/registro` → link del mail → `/` |
| **Viewport** | 390×844 |
| **Esperado** | Que el lugar que motivó todo el registro quede guardado al volver, **abra el link del mail donde lo abra** |
| **Observado** | El pendiente vive en `sessionStorage`, que es por pestaña. En el alta nueva el link llega **por mail**, y el cliente de correo lo abre casi siempre en otra pestaña, otra app o directamente otro navegador. Ahí `sessionStorage` está vacío: `ReanudarGuardado` no encuentra nada, no llama a `/api/favoritos` y el usuario aterriza en la home logueado y **sin el lugar guardado**, sin ningún cartel que lo explique. Pagó el peaje del registro y no recibió lo que fue a buscar |
| **Severidad propuesta** | **MOLESTO** — no rompe el recorrido (quedás logueado, en la home, y podés volver a guardar), pero se pierde justo lo que motivó el alta. No es BLOQUEANTE porque la app no miente ni te deja sin salida |
| **Evidencia** | Pestaña del alta: `{"ads:guardar-pendiente":"d3695142-…"}` · pestaña nueva al mismo origen: `{}`. Mecanismo en `lib/favoritos/pendiente.ts` (`sessionStorage`) y `components/favoritos/reanudar-guardado.tsx` (si `leerPendiente()` es `null`, no hace nada) |

> **Por qué no se arregla en esta sesión.** F1 y F2 están cerradas y el triaje lo hace Fer
> (decisión 6), no la sesión que encuentra el hallazgo. Va al `BACKLOG` con su ID, como los otros 33.
> **Y el arreglo obvio no es obvio**: mover el pendiente a `localStorage` lo haría cruzar pestañas
> del mismo navegador, pero no cubre "otro navegador" (el webview del cliente de mail), y rompe la
> razón por la que se eligió `sessionStorage` — que el pendiente muera con la pestaña en vez de
> quedar colgado para la próxima visita. Es una decisión, no un typo.

**Observación de paso, que contribuye al mismo problema y no es un hallazgo aparte:** el link
«Registrate» de `/login` apunta a `/registro` pelado, sin arrastrar el `callbackUrl` ni el
`motivo=guardar` que el propio login acaba de recibir. Aunque los arrastrara, el `callbackURL` del
mail lo pone Better Auth (`/`), así que el contexto de la búsqueda (`?z=palermo-soho`) se pierde
igual. Anotado dentro de PBETA-R3-07 porque es la misma cadena, no un ítem propio.

### La base quedó como estaba (decisión 13)

El alta creó **5 filas reales**, anotadas antes de borrarlas —`account` y `session` **no cascadean**
desde `users`, así que se borran a mano y en orden:

| Tabla | `id` |
|---|---|
| `users` | `acd7b1f6-dfec-46c1-a343-0888b214676c` (`fernando.rodriguez84@yahoo.com.ar`) |
| `account` | `5764eeae-fba3-479f-a8bc-d3435e1295d1` (`credential`) |
| `session` | `8c5d3286-d9b4-4fd1-a6c3-b2e95906e756` |
| `place_lists` | `9b5037a7-fa2c-4e99-859c-3d1dc622e1ce` (la default, la creó el guardado) |
| `place_list_items` | `d7a7be45-141e-4c56-af72-60a56d9f462e` (*Burger King*) |

| Tabla | Antes | Después | |
|---|---|---|---|
| users · account | 4 · 4 | **4 · 4** | ✅ |
| place_lists · place_list_items | 1 · 0 | **1 · 0** | ✅ |
| `place_tags source='admin'` (canario de curaduría) | 3.967 | **3.967** | ✅ |
| session | 16 | **15** | ⚠️ ver abajo |

`session` bajó una: para hacer el recorrido *sin cuenta* hubo que cerrar la sesión de
`hugo@gmail.com` que F3 había dejado abierta a propósito. Es estado de auth y **el paso 5 de
`DEPLOY` F0 limpia `session` igual** — no hay nada que restaurar. `verification` quedó en 0 en todo
momento: Better Auth firma el token de verificación con el secret y **no persiste fila**, por eso el
link no se pudo reconstruir desde la base y lo tuvo que pasar Fer.

### Gate técnico

`npx tsc --noEmit` limpio · **645 tests en 58 archivos, todos verdes** · **`npm run build` ✅** con el
dev server parado (comparten `.next`, lección de BUSQUEDA): *Compiled successfully in 6,6 s*, 14
páginas estáticas. En el árbol de rutas aparecen **`/manifest.webmanifest` y `/apple-icon.png` como
estáticas (`○`)** — el manifest no cuesta un render por visita.

### Lo que este tramo **no** cubrió

1. **PBETA-07 (iOS)**: no se probó "Agregar a pantalla de inicio" en un iPhone real. Todo lo
   verificable por software está hecho (el `apple-touch-icon` 180 servido y linkeado), pero el
   ícono en la pantalla de inicio de iOS **no se puede simular desde Playwright** ni desde Android.
   Android sí quedó confirmado (PBETA-06).
2. **El remitente del mail**: Fer confirmó que llegó, pero no se dejó registrada la dirección exacta
   que muestra el cliente. Si fuera el sandbox `onboarding@resend.dev` en vez de
   `RESEND_FROM_EMAIL`, sería un tema de `DEPLOY`, no de este spec.
3. **La pantalla "Revisá tu mail" a 360 px**: se vio a 390 y no tiene nada de ancho fijo (emoji,
   título, párrafo y un link), pero **no se midió a 360** — solo se llega ahí creando un usuario
   real, y se creó uno solo.

---

## QA /qa-spec — PULIDO_BETA (2026-08-03)

**Veredicto:** **PARCIAL — pendiente QA en vivo** (un solo criterio: **PBETA-07**, el ícono en la
pantalla de inicio de **iOS**; no hay iPhone a mano y no se puede simular).
**Verificación técnica:** typecheck ✅ limpio · tests ✅ **645/645** en 58 archivos · build ✅
*Compiled successfully in 6,6 s* con el dev server parado.
**Método:** **3 checkers independientes** (Explore/haiku, read-only — maker≠checker) contra el DoD de
`docs/specs/active/PULIDO_BETA.md`, más el QA en vivo con Playwright/MCP sobre
`https://adondesalimos.ngrok.app` (los checkers read-only no ven el render — lección BUSQUEDA) y la
instalación real en el Android de Fer. El tercer checker corrió un **chequeo de regresión** sobre los
10 arreglos de F3, que el DoD no pide pero es lo que evita cerrar un spec sobre código que se pisó.

| ID | Criterio | Resultado | Evidencia / Gap |
|----|----------|-----------|-----------------|
| PBETA-QA-01 | Los 6 recorridos con sección propia e IDs `PBETA-R<n>-NN`, a 390×844 | ✅ PASS | Checker: R1 (8) · R2 (13) · R3 (6+1) · R4 (6) · R5 (5+2) · R6 (5) en `AnalisisQA.md`, todos numerados |
| PBETA-QA-02 | Todo hallazgo con los 6 campos de la decisión 7 | ✅ PASS | Checker sobre 3 al azar de recorridos distintos (R2-01, R1-01, R5-01): ruta, viewport, esperado, observado, severidad y evidencia en los tres |
| PBETA-QA-03 | Cada hallazgo con destino explícito, ninguno suelto | ✅ PASS | Checker: **43** hallazgos = 10 arreglados + 33 en `BACKLOG.md` con su ID, contados uno por uno. Cero descartados y cero sin destino. El nuevo **PBETA-R3-07** también está en el backlog |
| PBETA-QA-04 | Cero BLOQUEANTE abiertos | ✅ PASS | Checker: los 10 (R1-01, R2-01, R2-03, R2-08, R3-01, R3-02, R3-03, R4-01, R5-01, R5-04) figuran arreglados |
| PBETA-QA-05 | Cada BLOQUEANTE re-verificado **en vivo**, en su recorrido completo | ✅ PASS | § *PULIDO_BETA F2 + F3*, tabla de re-verificación: los 10 con su consecuencia medida (URL, `sessionStorage`, `navigator.share`, fila en la base) |
| PBETA-QA-06 | Nada rompe a 360 px | ✅ PASS | Checker: constancia en F1 (los 6 recorridos) y en F3 (las pantallas tocadas), medido con `scrollWidth` vs `clientWidth` + barrido de `getBoundingClientRect()` |
| PBETA-QA-07 | `app/manifest.ts` + la app se ofrece para instalar (Android) y el ícono correcto en iOS | ⚠️ **PARCIAL** | **Android ✅**: Fer la instaló en su celular y abre con el splash del manifest. Manifest 200 y los 8 criterios de Chrome medidos en vivo. **iOS ⏳ sin probar**: el `apple-touch-icon` 180×180 está servido y linkeado en el `<head>`, pero **nadie lo vio en una pantalla de inicio de iPhone** |
| PBETA-QA-08 | `theme_color` / `background_color` de la paleta, sin colores nuevos | ✅ PASS | Checker: los dos `#0D0D1F`, que es `--background` en `app/globals.css:42`. Ningún hex del manifest falta en `globals.css` |
| PBETA-QA-09 | La base quedó como estaba | ✅ PASS | Checker sobre F1/F3 (11 tablas a los mismos conteos, ids de lo borrado) + el tramo de F4: users 4→4, account 4→4, listas 1→1, items 0→0, curaduría **3.967 intacta** |
| PBETA-QA-10 | typecheck + tests + build verdes (build con el server parado) | ✅ PASS | `tsc --noEmit` limpio · 645/645 · build OK; `/manifest.webmanifest` y `/apple-icon.png` salen **estáticos** (`○`) en el árbol de rutas |
| PBETA-QA-11 | **Regresión**: los 10 arreglos de F3 siguen en el código | ✅ PASS | Checker independiente, **10/10** con archivo:línea — incluidos los dos que son regla con dueño único (`compartirLink` reusado por ficha + votación nueva + mis-votaciones; `cobroApagado()` compartido con `/cuenta`) y el detalle fino del 401 que **no** consume el pendiente |

**Qué significa el PARCIAL, en concreto.** Es un solo criterio y no es un gap de implementación: el
código de iOS es una **convención de Next** (`app/apple-icon.png` ⇒ `<link rel="apple-touch-icon">`),
está servido, linkeado y con el tamaño correcto, y no hay lógica propia que pueda fallar. Lo que
falta es el acto de mirarlo en un iPhone. Se deja anotado como **PBETA-07 pendiente** en vez de
declararlo PASS por lectura de código, que es exactamente lo que la regla de este QA prohíbe.

---

## DEPLOY F0 — Neon: crear, restaurar, verificar por conteo, bajar el cap (2026-08-03)

**Spec:** `docs/specs/active/DEPLOY.md` § *Migración de datos*, pasos 1-6.
**Veredicto:** **APROBADO — los 6 pasos ejecutados, cero pérdida de datos.**
**Qué es esto:** la fase sin código de `DEPLOY`. Crear el proyecto en Neon, restaurar el dump
completo del Postgres de dev, verificar por conteo (y por checksum), borrar el rastro de las
cuentas de prueba y bajar el tope del chat. **Enteramente reversible**: mientras el Postgres de
dev siga intacto, se borra el proyecto de Neon y se empieza de nuevo.

**Entorno.** Neon Free, proyecto en **`aws-sa-east-1`** (São Paulo, decisión 4), **PostgreSQL
16.14** — la misma versión exacta que el Docker de dev, elegida a propósito por paridad de
collation y planner cuando la consola ofrecía hasta la 18. Base `neondb` (el nombre por defecto;
no se rehizo el proyecto porque `DATABASE_URL` apunta a donde sea). Neon Auth **apagado**: el
proyecto ya tiene Better Auth y prenderlo sería una segunda fuente de verdad sobre usuarios.

| ID | Caso | Resultado | Evidencia |
|----|------|-----------|-----------|
| DEPLOY-F0-01 | Backup del dev previo a todo (paso 1) | ✅ PASS | `npm run backup:db` → `backups/adondesalimos_2026-08-03_220640.sql.gz` (5,0 MB), posterior a los 3 commits de `PULIDO_BETA` ⇒ el dump está fresco como pide la decisión 12 |
| DEPLOY-F0-02 | Proyecto en Neon con la config de la decisión 4 (paso 2) | ✅ PASS | `select version()` → **PostgreSQL 16.14** en la región `sa-east-1`; base vacía antes del restore (**0** tablas en `public`) |
| DEPLOY-F0-03 | Restore limpio por el endpoint **direct** (paso 3) | ✅ PASS | `psql -v ON_ERROR_STOP=1 --single-transaction` → **EXIT=0**, cero errores. Se usó el endpoint sin `-pooler`: un pooler transaccional no banca un dump de 5 MB |
| DEPLOY-F0-04 | Conteos del catálogo dev == Neon (paso 4) | ✅ PASS | 13 tablas comparadas: `places` **26.057** · `place_tags source='admin'` **3.967** (el canario de `/consistency-check`) · `place_tags` total 43.637 · `place_zones` 35.589 · `zones` **46** · `app_settings` **14** · `occasion_chips` **17** · `chip_tags` 49 · `tags` 105 · `zone_aliases` 135 · `place_tag_suggestions` 3.969 · `drizzle.__drizzle_migrations` **15** |
| DEPLOY-F0-05 | **Contenido idéntico, no solo conteos** (más fuerte que el paso 4) | ✅ PASS | `md5(string_agg(...))` sobre 6 conjuntos, dev vs Neon: ids de `places` · nombres de `places` · pares `(place_id, tag_id)` de la curaduría · pares de `place_zones` · slugs de `zones` · `(slug, sort)` de `occasion_chips`. **Los 6 idénticos.** Un conteo igual con contenido distinto habría pasado el paso 4 del spec |
| DEPLOY-F0-06 | Estado de migraciones coherente | ✅ PASS | `drizzle.__drizzle_migrations` = **15**, igual que dev: un `db:migrate` futuro contra Neon sabe dónde está parado (era la razón de restaurar el dump completo y no solo los datos) |
| DEPLOY-F0-07 | Extensiones presentes en Neon | ✅ PASS | `pg_trgm 1.6` · `unaccent 1.1` · `plpgsql 1.0`, las mismas 3 de dev. Las dos primeras las usa el motor de búsqueda |
| DEPLOY-F0-08 | Paso 5 — el rastro de las cuentas de prueba, borrado | ✅ PASS | Las 4 cuentas del spec y ninguna más (verificado por email antes de borrar). **24 tablas en 0**: `users` · `session` · `account` · `verification` · `subscriptions` · `subscription_payments` · `place_claims` · `place_lists` · `place_list_items` · `polls` · `poll_options` · `poll_votes` · `chat_conversations` · `chat_messages` · `chat_quota_grants` · `chat_usage_monthly` · `premium_interest` · `place_owner_content` · `place_photos` · `place_taps_daily` (+ las 4 de DEPLOY-F0-09) |
| DEPLOY-F0-09 | **Extra, fuera del spec**: la telemetría de dev no viaja | ✅ PASS | Acordado con Fer en la sesión. `ai_api_usage` (traía `2026-08 · chat_messages · 5`, que consumía el cap nuevo) · `google_api_usage` (`2026-08 · details 24 · photos 14`) · `place_impressions_daily` (**2.193** filas, **16.220** impresiones, 203 vistas, del 20/07 al 03/08) · `place_tag_impressions_daily` (2.001 filas). **Todas en 0.** Motivo abajo |
| DEPLOY-F0-10 | El catálogo no se movió con los DELETE | ✅ PASS | Re-verificado después del paso 5: `places` 26.057 · `place_tags source='admin'` **3.967** · `place_zones` 35.589 · `zones` 46 · `app_settings` 14 · `occasion_chips` 17 — los mismos números del paso 4 |
| DEPLOY-F0-11 | Paso 6 — `ai.chat_monthly_cap = 500` en Neon (decisión 8) | ✅ PASS | `update app_settings set value='500'::jsonb` → `UPDATE 1`; el `select` confirma `500`. Techo duro de ~US$20/mes con el kill switch de `CHAT_IA` decisión 15 |
| DEPLOY-F0-12 | **Reversibilidad: el Postgres de dev quedó intacto** | ✅ PASS | Post-F0: `users` 4 · `account` 4 · curaduría **3.967** · `ai_api_usage` 2 · `place_impressions_daily` 2.251 · `place_photos` 2 · `ai.chat_monthly_cap` sigue en **5000**. Sobre dev solo se hicieron `SELECT` y el `pg_dump`. F0 sigue siendo deshacible borrando el proyecto de Neon |

### Los tres hallazgos — el spec estaba mal en dos puntos y le faltaba un tercero

**(1) El SQL del paso 5, tal como estaba escrito en el spec, NO corre.** `delete from session where
user_id not in (select id from users)` falla con `ERROR: operator does not exist: text = uuid`.
Hace falta `select id::text from users`. Se descubrió al ejecutarlo: la transacción abortó entera
(`--single-transaction` + `ON_ERROR_STOP=1`), así que **no quedó nada a medias** — `users` seguía en
4 después del fallo. Corregido en el spec.

**(2) Y la razón por la que `session`/`account` no cascadean no es la que decía el spec.** Decía que
*"better-auth las creó sin foreign key"*, que suena a descuido. Lo real: **`users.id` es `uuid` y
`session.user_id` / `account.user_id` son `text`** — la FK era **imposible**, no omitida. El efecto
práctico es el mismo (hay que borrarlas a mano), pero la causa correcta importa porque evita que
alguien "arregle" el schema agregando la FK y no entienda por qué falla. Corregido en el spec.

**(3) `scripts/backup-db.sh` no producía un dump restaurable en Neon — corregido.** Hacía `pg_dump`
**sin** `--no-owner --no-acl`, así que el archivo de `backups/` traía **62 sentencias `OWNER TO
adondesalimos`** — un rol que en Neon no existe. El paso 3 del spec decía "restaurar el dump completo
(`--no-owner --no-acl`)" dando por sentado que el archivo del paso 1 ya los traía. No los traía.
Para F0 **se restauró un segundo dump del mismo instante**, generado con los flags. **Y el script se
arregló en la misma sesión** (decisión de Fer: *"esto es necesario y ayuda mucho"*), porque el
problema no era de F0 sino de cualquier restore fuera de ese contenedor: los dumps nuevos salen con
**0 `OWNER TO`** (verificado regenerando el backup) y se restauran tal cual. ⚠️ **Los dumps de
`backups/` anteriores al 2026-08-03 siguen teniendo los 62** y hay que regenerarlos con los flags
para usarlos afuera.

### Por qué se limpió la telemetría de dev (DEPLOY-F0-09), que el spec no pedía

`place_impressions_daily` y `place_tag_impressions_daily` traían **4.194 filas de navegación de QA**
—16.220 impresiones nuestras entre el 20/07 y el 03/08—, y son exactamente el dato que este spec
existe para empezar a acumular **limpio**: `DEPLOY` dice que el lanzamiento desbloquea *"afinar
`chips.schedule` con `place_tag_impressions_daily`"* y la curaduría guiada por uso, y `CLAUDE.md`
dice que `place_impressions_daily` *"es el histórico que vende el B2B y no se puede reconstruir
después"*. Arrancar producción con ese ruido contamina la única señal que el deploy venía a destrabar.

Los otros dos son más chicos pero más filosos: `ai_api_usage` y `google_api_usage` **son los
contadores de los kill switches**. Producción habría arrancado con 5/500 del cap del chat y con
24 `details` + 14 `photos` de Google ya gastados en dev.

No es irreversible (las filas tienen fecha y se podrían filtrar), pero nadie se acuerda de filtrar
tres meses después, y borrarlas ahora no cuesta nada: no es catálogo, no es curaduría, y se
regenera solo con uso real. Fer eligió limpiar las cuatro.

### Lo que F0 **no** cubre

El DoD de `DEPLOY` es de todo el spec, no de F0. Siguen abiertos y son de **F1**: el dominio
sirviendo con TLS, la búsqueda equivalente en prod, la ficha con el bloque de Google, el mail de
verificación desde Vercel, `/admin` gateado, el chat descontando cupo, `robots.txt` con `noindex`
y el grep sobre `.next/static`. Los únicos ítems del DoD que F0 cierra son **`ai.chat_monthly_cap
= 500` en Neon** (DEPLOY-F0-11) y los **conteos** de la migración (DEPLOY-F0-04/05).

## DEPLOY F1 — el sitio en producción: Vercel, DNS, Email Routing y los 21 casos (2026-08-07)

**Alcance:** los 4 cambios de código de F1 (`noindex`, `maxDuration`, `.env.example`, el aviso
«Estamos en beta»), el proyecto en Vercel, el DNS en Cloudflare, el Email Routing de la decisión
22, un bucket de R2 aparte para producción, y el QA `DEPLOY-01..21` del spec.

**Método:** `curl` + `dig` sobre DNS-over-HTTPS + Playwright MCP contra
`https://adondesalimos.com.ar` (el dominio real, no el `*.vercel.app`) + `SELECT` al Postgres de
dev para armar los casos de comparación. **Los pasos de panel (Vercel, Cloudflare, aprobar el
reclamo) los hizo Fer**; el resto lo corrió Claude, la mitad con una cuenta de prueba
`frodriguez.este+qa@gmail.com` creada para eso.

**Por qué una cuenta de prueba y no la de Fer:** `DEPLOY-11` pide literalmente *"`/admin` con una
cuenta que no es admin"* — con la de Fer es imposible— y `DEPLOY-08` necesita un **segundo
votante**. Además trae 3 mensajes de chat frescos. Se verificó antes que el gate de admin
([lib/auth/admin.ts:23](../../lib/auth/admin.ts#L23)) compara con `===` **exacto** y no normaliza
el `+`: si lo hiciera, la cuenta habría entrado a `/admin` y **DEPLOY-11 habría dado un falso
PASS**.

### Marcas de arranque

- **Commits:** `05293a5` (los 4 cambios) · `d700bba` (`vercel.json` con la región) · `a8310a1`
  (`contacto@` + el UA del crawler). Los tres pusheados por Fer.
- **Antes de deployar:** typecheck limpio, **645 tests en 58 archivos**, `next build` verde con el
  dev server parado, y las 3 superficies del aviso vistas en el navegador a 414×896.
- **Infra:** Vercel Hobby, funciones en `gru1` · Neon `aws-sa-east-1` (pooled) · Cloudflare DNS-only
  en el apex · R2 `adondesalimos-fotos-prod` con dominio propio `fotos.adondesalimos.com.ar`.
- **Estado de la zona ANTES de tocar DNS** (verificado, no supuesto): apex **sin A, sin CNAME, sin
  MX, sin TXT y sin `_dmarc`**; `send.*` y `resend._domainkey.*` de Resend publicados y en uso.

### Casos

| ID | Caso | Resultado | Evidencia |
|----|------|-----------|-----------|
| DEPLOY-01 | Home en el dominio real | ✅ PASS | HTTP 200, `Server: Vercel` (no `cloudflare` ⇒ la nube gris quedó bien y **no hay doble CDN**), TLS `ssl_verify_result=0`, HSTS `max-age=63072000`. Chips y selector de zona visibles |
| DEPLOY-02 | Búsqueda zona+tag, prod vs dev | ✅ PASS | `?z=caballito&t=empanadas` devuelve **los mismos 4 lugares en el mismo orden** en las dos: El Noble, Rincón Norteño, Tienda de Empanadas ×2. `nextCursor` null en ambas |
| DEPLOY-03 | Scroll infinito | ✅ PASS | `?z=palermo-soho`: **20 cards → 60** en dos scrolls, con dos `GET /api/search?…&cursor=…` en **200**. Sin errores de conexión |
| DEPLOY-04 | Ficha con `google_place_id` | ✅ PASS | DOC Bar de Vinos. **El HTML del server no trae nada de Google**: 0 ocurrencias de `googleusercontent`, `maps.googleapis`, `rating`, `openNow` y `regularOpeningHours` en 31 KB. En el browser aparece **un solo** `GET /api/lugar/[id]/google` → 200, y recién ahí se dibujan foto (atribuida a su autor + Google), **4,6 (2465)**, `$$`, "Abierto ahora" y los horarios plegables. Es la disciplina de costos funcionando: **un crawler no gasta** |
| DEPLOY-05 | Registro de un usuario nuevo | ✅ PASS | Fer se registró con `frodriguez.este@gmail.com` (el `ADMIN_EMAIL`, que F0 había borrado). **El mail de verificación llegó a Recibidos** desde `no-reply@adondesalimos.com.ar` y el link funcionó. Es además la prueba de que **los MX que Cloudflare puso en el apex no rompieron a Resend** — la otra mitad de DEPLOY-21 |
| DEPLOY-06 | Login y sesión | ✅ PASS | La cookie sobrevive a recargar y a navegar entre rutas, en las dos cuentas |
| DEPLOY-07 | Guardar un favorito | ✅ PASS | Persiste tras recargar y aparece en `/mis-lugares` |
| DEPLOY-08 | Votación y voto desde otra sesión | ✅ PASS | Fer creó la votación (4 opciones); Claude votó desde la cuenta `+qa`. **Cuenta una vez:** al cambiar el voto de The Harrison a 70 30 Bar, el destino pasó 0→1, el origen 1→0 y **el total se quedó en 1** — reemplaza, no suma. Con los dos votantes: **2 votos en total, 50/50** en opciones distintas. **En vivo en las dos direcciones:** Fer vio el voto de Claude sin recargar y Claude vio el de Fer sin recargar |
| DEPLOY-09 | Chat: 3 mensajes de trial | ✅ PASS | Cuenta `+qa` arranca en "Te quedan 3 de 3". Descuenta bien y el copy conjuga: 3 → 2 → **"Te queda 1 mensaje"** (singular) → 0. Devuelve lugares reales del catálogo. **El gate es preemptivo, mejor que el criterio:** apenas se consume el tercero bloquea el input (`disabled`, placeholder *"Sin mensajes disponibles"*) en vez de esperar a que el 4º intento falle ⇒ **no se gasta una llamada a Anthropic para que rebote**. Ver hallazgo 5 |
| DEPLOY-10 | Tab Suscripción B2C con el cobro apagado | ✅ PASS | `/cuenta` dice **«Todavía no abrimos los pagos»** con el botón *Avisame cuando abra*. **No** dice "Configuración de pago incompleta" |
| DEPLOY-11 | `/admin` con cuenta que no es admin | ✅ PASS | **404 sin sesión** y **404 con la cuenta `+qa` logueada**. Las dos mitades |
| DEPLOY-12 | `robots.txt` con `noindex` | ✅ PASS (mitad) | `User-Agent: *` / `Disallow: /` servido desde el dominio real, y verificado también contra el artefacto del build (`.next/server/app/robots.txt.body`), no solo contra el código. **La segunda mitad —que deje de servirlo— queda pendiente** |
| DEPLOY-13 | Primera visita tras >5 min de inactividad | ✅ PASS | Medido con el sitio quieto **6:40**. Home en frío: **3,31 s** (HTTP 200). Búsqueda inmediatamente después: 1,25 s. Búsqueda ya en caliente: **0,25 s** ⇒ **~3,1 s de cold start**. **Carga igual, sin error**, que es el criterio. La decisión 11 estimó *"~0,5–3 s extra en la primera query"* y **se aceptó a sabiendas**: la medición la confirma casi al decimal, así que el trade-off que se eligió (contra ~182 CU-h/mes para mantenerlo despierto, o ~US$19/mes de plan Launch) sigue siendo el correcto |
| DEPLOY-14 | Bundle del browser | ✅ PASS | Se bajaron los **12 chunks** de `/_next/static` del deploy real (713 KB) y se buscó el **valor** de las 12 variables server-only: **cero coincidencias**. Y el control que no pide el spec: **`NEXT_PUBLIC_MP_PUBLIC_KEY` tampoco está**, que es la señal de que el cobro quedó apagado (decisión 5) |
| DEPLOY-15 | Tab Suscripción B2B | ✅ PASS | Claude reclamó Loreto Garden Bar desde la cuenta `+qa`, Fer lo aprobó en `/admin`. `/mi-negocio/[placeId]` muestra el badge **Free** y el copy del spec con el pitch del plan del lugar (*"descripción, carta, novedades, hasta 15 fotos y el destaque en las búsquedas"*). **Y el gate del plan se ve aplicado:** Descripción, Link a la carta y Novedad **`disabled`**, y Fotos dice *"0 de 3 · … El plan pago llega a 15"*. **La foto cierra el R2 de producción de punta a punta** — ver abajo |
| DEPLOY-16 | Doble click en «Avisame cuando abra» | ✅ PASS | La segunda vez muestra el estado confirmado con el mail de la cuenta; una sola fila |
| DEPLOY-17 | `/admin` → Suscripciones | ✅ PASS | Conteo y mail del interesado, coincidente |
| DEPLOY-18 | Aviso de beta en `/legales` y el footer | ✅ PASS | **«Estamos en beta» es el primer `h2` de la página**, arriba del pliegue, antes de las secciones de atribución. Único mail en la página: **`contacto@adondesalimos.com.ar`**. **Cero letra chica legal** (regex contra *"no nos hacemos responsables"* / *"sin garantía"* → 0). Menciona las **46 zonas** y los **400 metros** de buffer, que es lo que el aviso vino a explicar. Rótulo «Estamos en beta» en el footer de la home **y** de la ficha, sin sacar el link de atribución (es condición de la licencia) |
| DEPLOY-19 | Búsqueda que no devuelve nada | ✅ PASS | `?z=puerto-madero&t=ramen` → 0 lugares y 0 destacados en la API, y en pantalla *"No encontramos nada con eso"* + el renglón *"Puede que exista y todavía no lo tengamos etiquetado — **estamos en beta**"* con link a `/legales` |
| DEPLOY-20 | Búsqueda flaca sin página siguiente | ✅ PASS | **Las dos caras del criterio.** Con 4 resultados y la lista agotada: aparece *"Puede haber más: los filtros finos todavía no cubren todo el catálogo."* Con 20 resultados y página siguiente pendiente: **no aparece**. También verificado con 1 resultado (`puerto-madero` + `arcade`) |
| DEPLOY-21 | Mail a `contacto@` + Resend sigue vivo | ⚠️ PASS con salvedad | **Las dos mitades funcionan.** El mail a `contacto@adondesalimos.com.ar` llegó a `adondesalimos.app@gmail.com`, y el mail de verificación de DEPLOY-05 salió desde `no-reply@` a Recibidos ⇒ los MX del apex **no rompieron a Resend**. **La salvedad: el primero cayó en spam.** Ver hallazgo 4 |

### El R2 de producción, verificado de punta a punta (parte de DEPLOY-15)

Es el único componente del deploy que nunca se había ejercitado, así que se probó entero en vez de
darlo por bueno:

- El **token nuevo abre `adondesalimos-fotos-prod`** y **no** alcanza el bucket de dev (scope
  correcto, comprobado con `ListObjectsV2` sobre los dos).
- Subida real desde `/mi-negocio`: el objeto quedó en **`adondesalimos-fotos-prod`** (1 objeto), no
  en el de dev.
- La URL guardada arranca con **`https://fotos.adondesalimos.com.ar/lugares/…`** —el dominio propio,
  no un `pub-….r2.dev`— y responde **HTTP 200 `image/png`**.
- No se redimensionó, y está bien: [fotos-editor.tsx:24](../../app/mi-negocio/[placeId]/fotos-editor.tsx#L24)
  tiene `LADO_MAYOR_MAX = 1600` y la imagen de prueba es de 800 px.

### Hallazgos

1. **🔴 La región de las funciones no era la del panel — corregido con `vercel.json`.** El panel
   tenía `gru1` guardado y avisaba *"A new Deployment is required"*, pero **el Redeploy no alcanzó**:
   las funciones seguían ejecutando en `iad1` (Virginia), el default de Vercel para proyectos nuevos.
   El instrumento fue el header `x-vercel-id`, que dice por qué regiones pasó la request:
   `/legales` (estático) → `gru1::<id>`, pero `/` y `/api/search` (funciones) → **`gru1::iad1::<id>`**.
   Se corrigió declarando `"regions": ["gru1"]` en `vercel.json` (commit `d700bba`): así se aplica en
   cada build y **queda escrito en el repo**, que un setting de dashboard no puede estar. Después del
   deploy: `gru1::gru1::`. Búsqueda en caliente ~380 ms.
2. **🟡 Vercel puso `www` como dominio principal y el apex redirigiendo.** El checkbox *"Redirect
   apex domains to www (recommended)"* viene tildado. Chocaba con `BETTER_AUTH_URL` y con
   `NEXT_PUBLIC_APP_URL`, que valen el apex y **ya estaba horneada en el bundle**. Se rehízo al
   revés: apex = Production, `www` → **307 temporal** al apex (1 salto, sin loop, **el path se
   preserva**: `/legales` → `/legales`). El 307 y no 308 es deliberado mientras haya `noindex`:
   un permanente lo cachea el browser y no gana nada en SEO todavía.
3. **🟡 El canal de contacto cambió de `hola@` a `contacto@`, y el crawler apuntaba a un dominio
   ajeno.** Fer rechazó `hola@` al ir a crearlo: la misma casilla la va a leer un dueño de
   restaurante con el B2B (spec 7). Buscando las apariciones apareció que el User-Agent del crawler
   de curaduría decía `+https://adondesalimos.ngrok.app; contacto: hola@adondesalimos.app` — **el
   túnel de dev y un dominio que no es nuestro** (decisión 2: está libre y no se compró). Un dueño
   de sitio que quisiera quejarse del bot escribía al vacío: el mismo agujero de la decisión 22 en
   otra superficie. Corregido en `a8310a1`.
4. **🟡 El mail a `contacto@` cae en spam, y es inherente al reenvío.** Email Routing reenvía, así
   que Gmail ve un mail que dice venir de una dirección pero **llega desde los servidores de
   Cloudflare**, que el SPF del remitente original no autoriza; Cloudflare firma con ARC pero una
   casilla nueva sin historial desconfía. **No es un error de configuración y no se arregla con
   DNS.** Mitigación acordada y **todavía pendiente**: filtro en la casilla destino con
   *"Para: contacto@adondesalimos.com.ar"* → **Nunca enviarlo a Spam** + etiqueta. Sin eso, el canal
   que `/legales` promete (*"cada mensaje nos sirve muchísimo"*) es un canal muerto.
5. **🟢 El gate del chat es una TERCERA superficie del premium apagado, y no estaba listada.** La
   decisión 6 enumera dos (`/cuenta` y `/mi-negocio/[placeId]`). El gate del chat también está
   adaptado: dice *"Usaste tus mensajes de prueba / **Todavía no abrimos los pagos.** Dejanos la
   señal…"* con botón **Dejar la señal**, en vez del *"Hacete premium para seguir chateando"* de
   cuando el cobro está prendido. Ya estaba implementado y correcto; se documenta para que la
   próxima sesión no crea que son dos.
6. **🟢 La premisa del `maxDuration` había caducado.** El spec lo pedía porque *"el default de la
   plataforma lo cortaría a mitad de respuesta"* — pero eso era el default viejo de 10 s. Verificado
   en la doc de Vercel el 2026-08-07: con **fluid compute** (prendido por defecto en proyectos
   nuevos) Hobby da **300 s de default y de máximo**. Se declaró igual, en **60**: válido en los dos
   regímenes (sin fluid el máximo de Hobby es 60), sobra para cualquier turno real y no deja una
   función colgada cinco minutos. La lección no es el número, es que **ese default ya cambió una vez**.

### Lo que queda abierto al cerrar F1

- **Sacar el `noindex`** (borrar `BETA_NOINDEX` y su `if` en `app/robots.ts`) — cierra la segunda
  mitad de DEPLOY-12 — y **pasar el redirect de `www` a 308** en la misma tanda.
- **El filtro de Gmail** del hallazgo 4.
- **Borrar el rastro del QA en Neon**: la cuenta `frodriguez.este+qa@gmail.com` (su reclamo de
  Loreto Garden Bar cae por cascada) y su `premium_interest`. ⚠️ Mismo cuidado que el paso 5 de F0:
  `session` y `account` **no cascadean** y necesitan su propio `DELETE` **con `::text`**. La fila de
  `place_photos` y el objeto en R2 **no caen solos** — la foto queda oculta al revocar, que es el
  default correcto del proyecto (ocultar ≠ borrar); borrarla de verdad es `fotos:borrar` **contra
  Neon**, no contra dev.
- **F1 completo NO cierra el spec:** quedan F2 (Upstash + Google OAuth) y F3 (el cobro, gateada).

---

## QA — Feedback de los primeros usuarios reales, Tanda A (2026-08-08)

**Veredicto:** APROBADO
**Verificación técnica:** typecheck ✅ · tests ✅ 645/645 · build ✅ (corrido con el dev server
parado, después del commit `05ef0e6`)
**Alcance:** los 6 ítems que Fer aprobó el 2026-08-08 (`FB-02`, `FB-05`, `FB-06`, `FB-07`,
`FB-08`, `FB-09`) del triaje de `docs/product/BACKLOG.md` § *Feedback de los primeros usuarios
reales*. Sin spec: son bugs y roces chicos, ya clasificados contra el código.
**Método:** implementación + verificación en vivo con Playwright MCP contra
`https://adondesalimos.ngrok.app` (viewport 390×844, sesión `pepe@gmail.com` y también sin
sesión). `FB-02` y `FB-09` **no se podían dar por buenos sin pantalla** y se verificaron ahí.

| ID | Criterio | Resultado | Evidencia |
|----|----------|-----------|-----------|
| FB-08-01 | Al creador el eyebrow le dice «Tu votación», no «Te invitó X» | ✅ PASS | Votación propia (`/votacion/nhFX8we…`) con sesión de Pepe: eyebrow = **TU VOTACIÓN**. `app/votacion/[token]/page.tsx` reusa el `esCreador` que ya se calculaba en `:95` |
| FB-08-02 | Al creador el footer no le ofrece «Armá tu propia votación» | ✅ PASS | Footer = *"Esta votación la armaste vos. Pasale el link al grupo y seguila desde **Mis votaciones**"* (link a `/mis-votaciones`) |
| FB-08-03 | Sin regresión del lado invitado | ✅ PASS | Mismo link tras `sign-out`: **TE INVITÓ PEPE** + *"Armá tu propia votación desde ¿A dónde salimos?"* |
| FB-07-01 | «Señal» desaparece de la UI; el CTA del chat dice «Avisame cuando abra» | ✅ PASS | **En pantalla** (Fer comentó `NEXT_PUBLIC_MP_PUBLIC_KEY` para poder ver el branch apagado). `/chat` con el trial agotado: *"Usaste tus mensajes de prueba / Todavía no abrimos los pagos. Te avisamos apenas se pueda."* + CTA **«Avisame cuando abra»** → `/cuenta`. Se usó `hugo@gmail.com`, que ya tenía `chat_trial_used=3`: **cero tokens gastados** |
| FB-07-02 | El panel de suscripción alinea el cuerpo y conserva su CTA | ✅ PASS | **En pantalla** en `/cuenta`: *"Todavía no abrimos los pagos. / Estamos en beta. El premium está por salir: … Te avisamos apenas se pueda."* + botón **«Avisame cuando abra»** (el que ya pasó `DEPLOY-10`/`DEPLOY-16`). `components/billing/suscripcion-panel.tsx:198`. La 2ª pantalla del mismo dueño (`/mi-negocio/[placeId]`, `tipo='b2b'`) solo cambia el pitch |
| FB-07-03 | Los nombres internos NO se tocan | ✅ PASS | `grep "señal"`: solo quedan comentarios y nombres (`premium_interest`, `lib/billing/interes.ts`, `rate-limit.ts`). Cero strings de UI |
| FB-05-01 | Con búsqueda activa aparece «Limpiar búsqueda» en pantalla | ✅ PASS | `/?t=bar,restaurante,romantico,tranqui`: botón visible al final de los chips activos |
| FB-05-02 | Limpia zona + tags + `q` + gps de una y vuelve a `/` | ✅ PASS | Un toque → URL `https://adondesalimos.ngrok.app/` sin query, cero chips prendidos, estado vacío *"Elegí zona para arrancar"* |
| FB-05-03 | Sin búsqueda el botón no está (y el «Limpiar todo» del sheet queda intacto) | ✅ PASS | En `/` el botón no existe en el DOM. `filters-sheet.tsx:67` sin cambios: sigue limpiando **solo** tags y con otro rótulo |
| FB-02-01 | Un chip tocado solo se prende **solo él** (subconjunto maximal) | ✅ PASS | Toque en «Primera cita» ⇒ `?t=bar,cafe,restaurante,romantico,tranqui` y `aria-pressed=true` **solo** en «Primera cita». Antes se prendían también «Cenar afuera» y «Un café» |
| FB-02-02 | Dos chips incomparables prenden los dos | ✅ PASS | «Cenar afuera» + «Un café» ⇒ `?t=cafe,restaurante`, prendidos **los dos**. Y `?t=bar,cafe,restaurante,romantico,tranqui,cerveceria` ⇒ «Primera cita» + «Tomar algo» prendidos |
| FB-02-03 | Tocar un chip **tapado** lo prende a él, y no a otro (re-verificado tras el bug de Fer) | ✅ PASS | Con «Primera cita» aplicada, tocar «Un café» ⇒ `?t=cafe` y prendido **solo «Un café»**. ⚠️ **La primera implementación fallaba acá** (ver nota abajo): sacaba `cafe` y terminaba prendiendo «Cenar afuera», que nadie tocó |
| FB-02-04 | Apagar un chip prendido apaga ese y nada más | ✅ PASS | `?t=cafe,restaurante` (los dos prendidos) → toco «Un café» → `?t=restaurante`, queda «Cenar afuera» |
| FB-02-05 | La promoción no rompe el caso incomparable | ✅ PASS | Sobre «Un café», tocar «Cenar afuera» ⇒ `?t=cafe,restaurante` con **los dos** prendidos (no hay tapado ⇒ suma). «Primera cita» + «Tomar algo» ⇒ los dos prendidos |
| FB-06-01 | Existe un dueño único del ojito y los 8 campos pasan por él | ✅ PASS | `components/ui/password-input.tsx` (`forwardRef` + spread). `grep 'type="password"'` en `app/` y `components/`: **0 resultados** |
| FB-06-02 | Los 8 campos muestran el toggle en pantalla | ✅ PASS | `login` 1 · `registro` 2 · `restablecer` 2 · `cuenta` 3 (el 3º al abrir «Eliminar mi cuenta»). Todos con `aria-label="Mostrar contraseña"` |
| FB-06-03 | El toggle cambia `type` y no rompe ninguna de las dos formas de conexión | ✅ PASS | En `/login`: click ⇒ `type=text`, `aria-label="Ocultar contraseña"`, valor intacto; **el login con ese campo funcionó** (react-hook-form recibió el valor ⇒ el `ref` llega). En `/cuenta` los 3 controlados renderizan y togglean |
| FB-09-01 | El sheet se arrastra con el dedo y cierra pasado el umbral | ✅ PASS | Touch sintético de 120-130 px sobre el panel: sigue al dedo (`translateY(120px)`) y al soltar cierra (`aria-hidden=true`) |
| FB-09-02 | Un arrastre corto vuelve solo y **no** cierra | ✅ PASS | 40 px ⇒ `translateY(40px)` durante, `transform: none` después y el sheet sigue abierto. Incluye el `click` que el browser dispara tras el `touchend` sobre el handle: no cierra (guard `movio`) |
| FB-09-03 | El scroll interno no cierra el sheet | ✅ PASS | Con `scrollTop=200`, un arrastre de 160 px hacia abajo no mueve el panel (`transform: none`) ni lo cierra: el arrastre solo arranca en el tope |
| FB-09-04 | El tap en el overlay sigue cerrando (sin regresión) | ✅ PASS | Sheet de Filtros: click en el overlay ⇒ cerrado |
| FB-09-05 | El handle es un control real: cierra con tap y tiene nombre accesible | ✅ PASS | `<button aria-label="Cerrar">`; tap ⇒ cierra. Es lo que cubre `PBETA-R2-09` |
| FB-09-06 | Las superficies del sheet siguen funcionando | ✅ PASS 5/6 | Verificadas en vivo: **zonas**, **filtros**, **«Sumá un lugar»** de la votación, **checkout** (`/cuenta`) e **historial del chat**. La 6ª —sheet de destino de favorito— **no se pudo abrir**: aparece solo con más de una lista y free tiene **1** (`MAX_LISTAS_FREE`, `lib/favoritos/planes.ts`). Usa el mismo `BottomSheet` sin props propias |

### Notas

- **`FB-02` se re-implementó el mismo día: el primer toggle era un bug de affordance.** La versión
  inicial pintaba por maximal y **toggleaba por subconjunto**, así que un chip que se veía *apagado*
  (tapado por otro) al tocarlo **sacaba** sus tags: Fer tocó «Primera cita» y después «Un café» y se
  apagaron los dos prendiendo «Cenar afuera», que no había tocado. El triaje había marcado este
  fork y se eligió mal el lado. La regla vigente tiene **tres** casos y el criterio es *el toque hace
  lo que el chip muestra*: prendido ⇒ se apaga · apagado de verdad ⇒ suma sus tags · **tapado ⇒ se
  promueve** (se van los tags del que lo tapaba, quedan los suyos). Escrita en el comentario de
  `components/search/occasion-chips.tsx`, junto con lo que deliberadamente **no** hace (no salva a un
  tercer chip que compartía tags con el que se fue).
- **`FB-07` se verificó en pantalla, no solo por código.** Su branch existe únicamente con el cobro
  apagado, así que Fer comentó `NEXT_PUBLIC_MP_PUBLIC_KEY` en el `.env` para esta verificación
  (`cobroApagado()` es su dueño único). **Hay que volver a descomentarla** para seguir probando el
  checkout en dev.
- **`FB-09` cierra `PBETA-R2-09`** (el sheet «Sumá un lugar» sin forma visible de cerrarse): el
  handle pasó a ser un `<button aria-label="Cerrar">` que cierra con tap y con teclado, además del
  arrastre. Un arreglo en el dueño único, seis usos.
- **Fuera de scope, anotado y no tocado (`FB-08`)**: la bajada de la votación (*"Elegí a dónde ir:
  votás sin crear cuenta. Esto es ¿A dónde salimos?, la app para decidir la salida con el grupo"*)
  también le explica el producto al creador. El triaje acotó `FB-08` al eyebrow y al footer, así
  que se dejó como está y se anotó en el BACKLOG para que Fer decida.
- **El `build` se corrió aparte**, con el dev server parado (comparten `.next`, lección de
  BÚSQUEDA): compiló limpio y generó las 14 páginas estáticas. typecheck y tests ya habían corrido
  verdes con el server arriba.

---

## QA — CURADURIA_POR_NOMBRE (Tanda B del feedback: FB-10 + FB-10b) (2026-08-08)

**Veredicto:** ✅ **APROBADO** — 16/16 casos en vivo PASS + 14/14 criterios de código PASS.
**Verificación técnica:** typecheck ✅ · tests ✅ 651/651 (59 archivos) · build ✅ (con el dev
server parado, lección de BÚSQUEDA).
**Método:** QA en vivo por Playwright sobre `https://adondesalimos.ngrok.app` con sesión de admin,
**más** 3 checkers independientes (Explore read-only, haiku, maker≠checker) contra el DoD de
`docs/specs/done/CURADURIA_POR_NOMBRE.md`.
**Backup previo (decisión 9):** `backups/adondesalimos_2026-08-08_151629.sql.gz` (5,0 MB), corrido
**antes** de tocar código — este spec escribe en `place_tags`, donde viven los ~3.967 tags
`source='admin'` que no están en git.

### Los 16 casos del spec, en vivo

| ID | Caso | Resultado | Evidencia |
|----|------|-----------|-----------|
| CURNOM-01 | Buscar por nombre exacto | ✅ PASS | «Cafe Crespin» ⇒ 1 resultado con dirección y zona: *Vera 699 · Villa Crespo* |
| CURNOM-02 | Typo y sin acentos | ✅ PASS | «crespn» ⇒ encuentra *Cafe Crespin* (+4 más); «pocho cafe» ⇒ encuentra **Pocho Café**. Misma tolerancia que la búsqueda pública, sin un solo `LIKE` |
| CURNOM-03 | Una sola letra | ✅ PASS | «c» + Enter ⇒ no se muestra nada, sin error en consola y **sin request** (el corte es del cliente y también del server) |
| CURNOM-04 | Nombre inexistente | ✅ PASS | «zzzqwertylugarinexistente» ⇒ «No encontramos ningún lugar con ese nombre.» |
| CURNOM-05 | Buscar un lugar **despublicado** | ✅ PASS | *Pocho Café* (confidence 0,20 · umbral 0,50) aparece con el chip «despublicado» y su `title`; se abrió y se curó. Idem *Crespo Bar* y *Café Porteño* |
| CURNOM-06 | El mismo lugar en la búsqueda **pública** | ✅ PASS | `/?q=Pocho Cafe` devuelve 5 cafés y **ninguno** es *Pocho Café* ni *Café Porteño*: la divergencia de la decisión 1 es solo del buscador de admin |
| CURNOM-07 | Abrir un resultado | ✅ PASS | `RevisorLugar` con Ambiente (17) + Momento (8) + Actividad (19), «Sin sugerencias pendientes con evidencia para este lugar» y lo ya asignado pre-tildado |
| CURNOM-08 | Tildar un tag y guardar | ✅ PASS | «Juegos de mesa» ⇒ «Guardado ✓» junto al nombre, se queda en el lugar, y `place_tags` gana `juegos-de-mesa` / `source='admin'` |
| CURNOM-09 | Enter dentro del buscador | ✅ PASS | Con un tag tildado **sin guardar**: Enter buscó (resultados nuevos), el editor **no** se remontó (el tag seguía tildado) y `place_tags` quedó **sin** filas admin. El handler global ignora `INPUT` |
| CURNOM-10 | **FB-10b** — abrir por nombre un lugar con precio | ✅ PASS | *Cafe Crespin* abre con **«$$» pressed**, no en «No sé» |
| CURNOM-11 | **FB-10b** — el mismo lugar desde la cola **por zona** | ✅ PASS | Villa Crespo ⇒ *Cafe Crespin* también abre con «$$» pressed: el fix vale para los dos caminos |
| CURNOM-12 | **FB-10b** — `SELECT` → guardar sin tocar el precio → `SELECT` | ✅ PASS | Las 6 filas de `place_tags` idénticas antes y después, `precio-2` incluido. **Antes de este spec desaparecía** |
| CURNOM-13 | Cambiar el precio y guardar | ✅ PASS | «$$$» ⇒ una sola fila, `precio-3`, `source='admin'`; el editor remontado muestra `$$$` (lo persistido) |
| CURNOM-14 | Poner «No sé» y guardar | ✅ PASS | La fila de precio se borra (0 filas): borrar sigue siendo posible como **acción explícita**, que es la diferencia con el efecto colateral que era FB-10b |
| CURNOM-15 | Flujo por zona completo | ✅ PASS | Con la cola cargada a mano: zona ⇒ próximo lugar (con evidencia y ✨) ⇒ guardar ⇒ «No quedan lugares pendientes en esta zona. 🎉». Sugerencia resuelta `rejected`. Sin regresión |
| CURNOM-16 | `?q=bar` sin sesión de admin | ✅ PASS | 403 con `{"code":"FORBIDDEN"}`, mismo shape que las ramas existentes. La rama `?placeId=` también |

### Checkers independientes (código vs DoD) — 14/14 PASS

| ID | Criterio | Resultado | Evidencia |
|----|----------|-----------|-----------|
| CURNOM-QA-01 | `lib/search/nombre.ts` es el **único** dueño del match por nombre | ✅ PASS | Define `normalizado`/`simKey`/`coincideNombre`; `lib/search/query.ts` los importa. No quedan definiciones duplicadas |
| CURNOM-QA-02 | Cero `LIKE`/`ilike` en `lib/curation/` | ✅ PASS | Grep sin resultados en los módulos (los tests usan `like` solo para limpiar por prefijo) |
| CURNOM-QA-03 | `buscarLugaresPorNombre` **omite** el predicado y usa `isPlacePublished` para el flag | ✅ PASS | Sin `publishedWhere`/`publishedSql` importados ni condición espejo; `publicado: isPlacePublished(f, umbral)`. La divergencia está comentada citando la decisión 1 |
| CURNOM-QA-04 | Mínimo 2 caracteres, tope 10, orden similitud desc + nombre asc | ✅ PASS | `MIN_CARACTERES_BUSQUEDA = 2` (devuelve `[]`, no error) · `TOPE_RESULTADOS = 10` · `orderBy(desc(simKey), asc(places.name))` |
| CURNOM-QA-05 | `LugarEnCola.precioSlug` sin filtrar por `source`, desempate por `tags.sort` | ✅ PASS | La query de tags asignados no filtra `source` y viene `orderBy(asc(tags.sort))`; el `.find()` toma el primero |
| CURNOM-QA-06 | El precio llega por los **dos** caminos | ✅ PASS | `proximoLugarDeZona` y `lugarParaCurar` comparten `armarLugarEnCola`, que es quien calcula `precioSlug` |
| CURNOM-QA-07 | El editor arranca con `lugar.precioSlug`, no en `null` | ✅ PASS | `useState(lugar.precioSlug)` en `app/admin/curaduria-client.tsx` |
| CURNOM-QA-08 | Ramas `?q=`/`?placeId=` bajo el mismo gate, sin ruta nueva ni rate limit | ✅ PASS | Un solo `sesionAdmin` inline; las 4 ramas en el mismo archivo |
| CURNOM-QA-09 | No se tocó `acciones.ts`, `validacion.ts`, `facetas.ts`, `[placeId]/route.ts`, `visibility.ts` ni `drizzle/` | ✅ PASS | `git diff --stat`: ninguno aparece. Sin migraciones nuevas |
| CURNOM-QA-10 | El buscador vive arriba del selector de zonas y **no** dentro del flujo por zona | ✅ PASS | Se renderiza solo en la rama `!zonaActiva` |
| CURNOM-QA-11 | Modo por-nombre ⇒ `sugerencias: []` y el texto de "sin evidencia" | ✅ PASS | `armarLugarEnCola(..., false)` saltea la query de sugerencias; `Evidencia` ya cubría el caso |
| CURNOM-QA-12 | El remount es real: la `key` lleva contador, no solo el id | ✅ PASS | La key combina el id con `revision`, que se incrementa en cada recarga |
| CURNOM-QA-13 | Copy rioplatense exacto (5 textos) | ✅ PASS | Placeholder, ayuda, sin resultados, chip «despublicado» + `title`, y «Guardado ✓» |
| CURNOM-QA-14 | Tests del precio y de que el buscador no filtra por publicado | ✅ PASS | `lib/curation/__tests__/por-nombre.integration.test.ts`, 6 casos |

### Notas

- **Los casos de precio se verificaron con `SELECT` antes/después, no por pantalla.** Es el punto
  entero de `FB-10b`: el bug era invisible **porque** la pantalla mostraba «No sé» con toda
  naturalidad y la fila desaparecía sin ruido. Un QA que solo mira la UI lo habría dado por bueno.
- **La base quedó como estaba.** El QA se hizo sobre lugares reales (*Cafe Crespin*, *Pocho Café*) y
  se revirtió todo: el precio de Crespin volvió a `precio-2`, el tag de prueba de Pocho Café se
  borró y la sugerencia inyectada para CURNOM-15 (`model_used='qa-curnom'`) también.
  **Canario de la curaduría: 3.967 tags `source='admin'` antes y después** — el mismo número que
  documenta CLAUDE.md.
- **CURNOM-15 necesitó cargar la cola a mano**: tras la corrida autónoma de CURADURIA F3 no queda
  ninguna sugerencia `pending`, que es justamente el problema que este spec resuelve. Se insertó una
  (`wifi-trabajar` sobre Cafe Crespin), se recorrió el flujo entero y se borró.
- **Duplicación señalada, no tocada (fuera de scope):** `lib/claims/query.ts:69` tiene su **propia**
  copia del match por nombre (`immutable_unaccent(lower(...))` + `word_similarity` inline) que ahora
  podría consumir `lib/search/nombre.ts`. El spec acotó la extracción a `lib/search/query.ts`;
  unificar el tercer llamador va como paso aparte al BACKLOG.

## QA /qa-spec — ADMIN_USUARIOS (2026-08-08)

**Veredicto:** APROBADO. Arrancó **BLOQUEADO** por un incumplimiento **heredado** —`ADMU-QA-01`,
el criterio central, fallaba por `lib/billing/baja.ts:49` y `:72`, que escribían `ownerPlan: 'free'`
directo desde MONETIZACION F2 (código anterior, no tocado por este spec)—. **Fer decidió unificarlo
en el momento, en commit aparte**: `subscriptions.ts` ahora expone `bajarFlagDeLugar(tx, placeId,
now)` —la bajada del eje B2B sin eje completo, que es lo que `cancelarSuscripcionDeLugar` necesita
porque baja el flag incluso sin fila viva—, su propia rama B2B delega ahí y `baja.ts` la llama.
Con eso el grep del DoD devuelve **solo** `lib/billing/subscriptions.ts` (líneas 32, 36, 51 y 72) y
`ADMU-QA-01` pasa a **PASS**.
**Verificación técnica:** typecheck ✅ · tests ✅ 663/663 (60 archivos, +12 nuevos de cortesía) ·
build ✅ (`Compiled successfully in 6.3s`, 14/14 páginas — corrido con el dev server parado).
**Método:** 5 checkers independientes (Explore read-only, haiku, maker≠checker) sobre el DoD de
`docs/specs/active/ADMIN_USUARIOS.md`, + QA en vivo por Playwright contra
`https://adondesalimos.ngrok.app` con `SELECT` antes/después en los casos de "oculta, no borra"
(lección CURNOM-12: la pantalla muestra el estado nuevo con total naturalidad esté o no la fila).
**Backup previo (decisión 14):** `backups/adondesalimos_2026-08-08_183913.sql.gz`.

### DoD (checkers independientes)

| ID | Criterio | Resultado | Evidencia / Gap |
|----|----------|-----------|-----------------|
| ADMU-QA-01 | Ninguna escritura de `users.plan` / `places.owner_plan` fuera de `activarFlagDelPlan` / `bajarFlagDelPlan` | **PASS** (tras el fix heredado) | Las dos funciones de cortesía delegan (`lib/billing/subscriptions.ts:263-265`) y los helpers de la suscripción no cambiaron su lógica. El grep de escrituras de plan (`set({ plan:` / `set({ ownerPlan`) devuelve **solo `lib/billing/subscriptions.ts`**: `:32` y `:36` (`activarFlagDelPlan`), `:51` (`bajarFlagDelPlan`) y `:72` (`bajarFlagDeLugar`, al que delega la rama B2B). `lib/billing/baja.ts` ya no escribe el flag: llama a `bajarFlagDeLugar` |
| ADMU-QA-02 | `otorgarCortesia` / `revocarCortesia` devuelven `Resultado<{ yaEstaba }>` y hacen flag + bitácora en **una** transacción | PASS | `lib/billing/subscriptions.ts:153`, `:166`, `:201` (`db.transaction`), `:250-261`. `Resultado` es el de `lib/claims/acciones.ts:21`, no un tipo nuevo |
| ADMU-QA-03 | Eje con suscripción viva ⇒ `TIENE_SUSCRIPCION` y no escribe nada (con test) | PASS | `subscriptions.ts:232-242`; tests B2C y B2B en `cortesia.integration.test.ts` |
| ADMU-QA-04 | `otorgarCortesia` con `placeId` sin reclamo aprobado ⇒ `NO_ES_DUENO`, no escribe (con test) | PASS | `subscriptions.ts:217-219` (`esDuenoDe`); 2 tests (lugar sin dueño y lugar de otro) |
| ADMU-QA-05 | Motivo vacío o < 3 rechazado **en la función** (con test) | PASS | `subscriptions.ts:189-199` (`MOTIVO_MIN=3`, `MOTIVO_MAX=280`), antes de abrir la transacción |
| ADMU-QA-06 | Otorgar dos veces ⇒ **una** fila y `yaEstaba: true` en la segunda (con test) | PASS | `subscriptions.ts:206`/`:224` (`for('update')`) + `:246`. Verificado además en vivo con dos POST **concurrentes** (ADMU-07) |
| ADMU-QA-07 | Migración aditiva (`CREATE TABLE` + `CREATE INDEX`, ningún `ALTER` sobre tabla con datos) y `db:migrate` limpio | PASS | `drizzle/0015_plan_grants.sql`: `CREATE TYPE` · `CREATE TABLE` · 2 `ALTER` **sobre la tabla nueva** (sus FK) · `CREATE INDEX`. Aplicada OK |
| ADMU-QA-08 | Ningún gate lee `plan_grants` | PASS | Solo `schema.ts` (definición), `subscriptions.ts:255` (escritura), `admin.ts:181-191` (lectura para mostrar) y tests |
| ADMU-QA-09 | Tab **Usuarios** existe, es la sexta, las cinco anteriores no se movieron | PASS | `app/admin/tabs.tsx:24-27`; el diff no reordena ninguna |
| ADMU-QA-10 | El listado muestra exactamente los campos de la decisión 8, con el badge de origen correcto | PASS | `lib/billing/admin.ts:95-101` y `:114-119` — el `select` no trae `image` ni `chat_trial_used`. Badge: `usuarios-client.tsx:404-407`, discriminado por suscripción viva |
| ADMU-QA-11 | Los dos endpoints ⇒ 403 sin sesión de admin, mismo shape de error | PASS | Idéntico a `curaduria/route.ts` y `settings/route.ts`; verificado en vivo (ADMU-17) |
| ADMU-QA-12 | Ningún log de la feature imprime un mail | PASS | Único log: `plan/route.ts:85`, con `userId`. Los otros 5 archivos nuevos no loguean |
| ADMU-QA-13 | Cortesía B2C ⇒ `/cuenta` muestra el copy de cortesía **ya existente**, sin tocar `suscripcion-panel.tsx` | PASS | El archivo no está en el diff; el discriminante sigue siendo `estado.status === null` (`suscripcion-panel.tsx:152-155`). Verificado en vivo (ADMU-06) |
| ADMU-QA-14 | Revocar B2C deja las listas por encima del cupo **ocultas, no borradas**; re-otorgar las devuelve | PASS | `lib/favoritos/planes.ts:93` (`slice`, cero `DELETE`). Verificado con `SELECT`: 3 filas antes y después (ADMU-10/11) |
| ADMU-QA-15 | Revocar B2B oculta fotos 4-15 y los 3 campos pagos; re-otorgar los devuelve | **PASS con desvío** | Los campos pagos: `lib/negocio/contenido.ts:88-90` ⇒ verificado end-to-end (ver ADMU-16). **Las fotos 4-15 no se ocultan hoy en la ficha** y no es algo que este spec haya roto: la ficha publica **una sola** foto de dueño (`app/lugar/[id]/page.tsx:139` ⇒ `ownerPhotos[0]`). El plan de fotos gatea la **subida** (`CAP_FOTOS` 3/15) — el cupo del panel pasó de «2 de 15» a «6 de 3» al revocar |
| ADMU-QA-16 | `FB-03`: el botón rotula el número **real** que copia y el portapapeles queda con esa cantidad, separados por `, `, sin `null` | PASS | `copiar-mails.tsx:24` (`join(', ')`) y `:43`; el filtro de `null` en `suscripciones.tsx:73`. Verificado leyendo el portapapeles (ADMU-18/20) |
| ADMU-QA-17 | Backup previo + typecheck/tests/build en verde | PASS | Backup `adondesalimos_2026-08-08_183913.sql.gz` · typecheck ✅ · tests ✅ 663/663 · build ✅ con el dev server parado |

### QA en vivo (los 20 IDs propuestos por el spec)

Sobre `https://adondesalimos.ngrok.app` con Playwright, sesión de admin real
(`frodriguez.este@gmail.com`) y `psql` para los antes/después. **La base quedó restaurada al
estado previo** (planes, fotos, listas e interesados); lo único que persiste es la bitácora de
`plan_grants` (12 filas), que es append-only por diseño.

| ID | Caso | Resultado | Evidencia |
|----|------|-----------|-----------|
| ADMU-01 | Tab **Usuarios** sexta, las otras cinco quietas | PASS | `Cola · Precios · Suscripciones · Costos · Curaduría · Usuarios` |
| ADMU-02 | Listado sin buscar | PASS | 4 cuentas, más nuevas primero, con mail · nombre · alta · badge; el conteo real aparte del listado |
| ADMU-03 | Buscar por mail parcial / inexistente | PASS | `hugo` ⇒ 1 resultado; `nadie@ninguna.com` ⇒ «No hay ninguna cuenta con ese mail.» |
| ADMU-04 | Usuario free | PASS | Sin badge, ofrece «Darle Premium» |
| ADMU-05 | Darle Premium sin motivo | PASS | «Sí, dale Premium» deshabilitado; forzado por endpoint ⇒ 400 `MOTIVO_CORTO` (con `""` y con `"ok"`) |
| ADMU-06 | Darle Premium con motivo | PASS | Badge «cortesía»; en `/cuenta` del usuario: «Te activamos el Premium nosotros: no vence ni se cobra.» — copy que ya existía |
| ADMU-07 | Doble click | PASS | Dos POST **concurrentes**: `yaEstaba:false` + `yaEstaba:true`, y **una** fila (`SELECT`) |
| ADMU-08 | Bitácora del usuario | PASS | «Le dieron Premium · 08/08/26 · frodriguez.este@gmail.com · "…"», lo más nuevo primero; revocar **agrega**, no borra |
| ADMU-09 | Sacarle el Premium | PASS | «Vuelve a free. Las listas que tenga de más se ocultan, no se borran: si se lo devolvés, vuelve todo.» + «Sí, sacáselo» |
| ADMU-10 | Tenía 3 listas | PASS | Tras revocar ve solo la del cupo free; **`SELECT`: las 3 filas siguen** |
| ADMU-11 | Re-otorgarle el Premium | PASS | Vuelven a verse las 3, sin restaurar nada |
| ADMU-12 | Usuario con suscripción **paga viva** | PASS | Badge «paga», sin botones, y el `POST` forzado ⇒ 409 `TIENE_SUSCRIPCION` (su plan quedó intacto) |
| ADMU-13 | Usuario con lugar de reclamo aprobado | PASS | Kansas Grill & Bar bajo el usuario, con su `owner_plan` y «Darle el plan del lugar» |
| ADMU-14 | Otorgar B2B | PASS | `owner_plan='paid'` (`SELECT`); en `/mi-negocio`: badge «Plan del lugar», copy de cortesía B2B y **«2 de 15»** fotos |
| ADMU-15 | `POST` forzado con `placeId` **ajeno** | PASS | 404 `NO_ES_DUENO`; `SELECT` confirma `owner_plan` sin cambios |
| ADMU-16 | Revocar el B2B con contenido pago cargado | PASS (adaptado) | Con 6 fotos cargadas: el cupo del panel pasó de «2 de 15» a «6 de 3» y **las 6 filas siguen**. Para el "oculta, no borra" se usó un **campo pago**: descripción visible con `paid` ⇒ invisible con `free` ⇒ vuelve al re-otorgar, con la fila intacta en `place_owner_content`. *(Las fotos 4-15 no se ocultan en la ficha porque la ficha publica una sola — ver `ADMU-QA-15`.)* |
| ADMU-17 | Los dos endpoints sin sesión de admin | PASS | 403 los dos, `{data:null,error:{message:'No autorizado.',code:'FORBIDDEN'}}` |
| ADMU-18 | «Copiar los N mails» | PASS | Rótulo «Copiar los 2 mails»; portapapeles `frodriguez.este@gmail.com, juan@gmail.com` |
| ADMU-19 | Un interesado sin mail (`leftJoin` en `null`) | **No reproducible** | `premium_interest.user_id` es `NOT NULL` con FK `ON DELETE CASCADE` y `users.email` es `NOT NULL` ⇒ el mail **nunca** puede ser `null`: borrada la cuenta, la fila de interés se va con ella. El filtro queda como defensa; verificado por lectura (`suscripciones.tsx:73`) |
| ADMU-20 | Total > el tope de la lista | PASS | Con el tope bajado a 1 a propósito: copió **1** mail y el texto de arriba siguió diciendo «2 pidieron que les avisemos. Abajo, los 1 más nuevos.» Tope revertido a 200 |

### Hallazgos que no son de este spec

- **`lib/billing/baja.ts` escribía `owner_plan` por fuera del dueño único** (`ADMU-QA-01`) —
  segunda implementación de una regla que ya tenía dueño, de MONETIZACION F2. **Arreglado en el
  momento**, en commit aparte por ser un camino de cobro: `bajarFlagDeLugar` en
  `lib/billing/subscriptions.ts`, con la rama B2B de `bajarFlagDelPlan` delegando ahí. Cero cambios
  de firma, 663/663 tests verdes. Es el ejemplo de por qué el grep está en el DoD: el spec nuevo
  cumplía y el criterio igual salía rojo, porque la regla tenía dos copias.
- **Las fotos 4-15 no se "ocultan" en ningún lado** porque la ficha publica una sola foto de
  dueño. El plan de fotos gatea la **subida**, no la exhibición. El DoD de MONETIZACION
  (decisión 19) y este spec lo dan por hecho; conviene corregir esa frase donde aparezca.
- El comentario de `lib/db/schema.ts` sobre `userPlanEnum` («hasta el spec 7 se cambia con un
  UPDATE a mano») quedó viejo: ahora se cambia desde `/admin`. Señalado, no tocado.

## QA /qa-spec — MAPA (2026-08-08)

**Veredicto:** APROBADO. Los 12 criterios del DoD en PASS y los 14 casos manuales corridos en vivo,
con **dos parciales declarados** (`MAPA-04` y `MAPA-07`) que no son un gap de implementación sino un
límite de lo que la UI puede provocar hoy — ver abajo.
**Verificación técnica:** typecheck ✅ · tests ✅ 663/663 (60 archivos) · build ✅
(`Compiled successfully in 6.5s`, corrido con el dev server parado).
**Método:** 3 checkers independientes (Explore read-only, haiku, maker≠checker) sobre el DoD de
`docs/specs/planned/MAPA.md`, + QA en vivo por Playwright contra `https://adondesalimos.ngrok.app`
a 390×844 y 390×667, con la geolocalización del contexto (`setGeolocation`) y un espía sobre
`navigator.geolocation` para contar si alguien pide el permiso sin que lo toquen.
**Sin backup:** el spec no toca la base (sin migración, sin escrituras).

### DoD (checkers independientes)

| ID | Criterio | Resultado | Evidencia / Gap |
|----|----------|-----------|-----------------|
| MAPA-QA-01 | El control es el `GeolocateControl` de MapLibre, no uno propio | PASS | `map-view.tsx:144` `new maplibregl.GeolocateControl({…})` · `:154` `addControl(ubicacion, 'top-right')` |
| MAPA-QA-02 | El permiso no se pide al entrar: solo al tocar el control | PASS | Sin `navigator.geolocation` ni `.trigger()` en el montaje; los handlers solo **responden** a `geolocate`/`error` (`:176`, `:191`). En vivo: 0 llamadas al entrar |
| MAPA-QA-03 | Centra en el usuario con punto azul, círculo de precisión y zoom ≤ 15 | PASS | `:147-152` `trackUserLocation: false` + `showUserLocation` + `showAccuracyCircle` + `fitBoundsOptions: { maxZoom: 15 }`. En vivo: centro exacto, **zoom 15**, `.maplibregl-user-location-dot` y `-accuracy-circle` presentes |
| MAPA-QA-04 | Su rótulo accesible dice «Dónde estoy»; sin inglés en ese control | PASS | `:134-137` vía `locale` del `Map`. En vivo: `title` y `aria-label` = «Dónde estoy»; con el permiso denegado, «No podemos ubicarte» |
| MAPA-QA-05 | Con «Cerca de mí», centrarse deja la cámara donde el usuario la puso | PASS (parcial en vivo) | Guarda en `:307`; el marcador se limpia por `claveBusqueda` (`:105-107`), que **no** lleva coords. En vivo aguanta 12 s — el re-fetch por coords no es provocable, ver `MAPA-04` abajo |
| MAPA-QA-06 | Cambiar de zona o de filtros **sí** vuelve a encuadrar los pins | PASS | `:105-107` limpia el ref con `serializeSearchParams(params)`. En vivo dos veces: zona (zoom 15 → 12,22) y sacar chip (→ 8,04) |
| MAPA-QA-07 | Qué marca la cámara como del usuario (los 5 disparadores de la decisión 2) | PASS | `:169-174` los tres eventos **filtrados por `originalEvent`** · `:264` el `easeTo` del cluster · `:177` el `geolocate` |
| MAPA-QA-08 | El `fitBounds` conserva `padding: 48`, `maxZoom: 15`, `duration: 0` | PASS | `:310` idéntico a HEAD; el único cambio es la guarda de `:307` |
| MAPA-QA-09 | `lib/search/params.ts` y `query.ts` sin cambios; la URL no gana parámetros | PASS | `git status --porcelain` no lista `lib/`; `SearchParams` conserva sus 6 campos |
| MAPA-QA-10 | En modo mapa: sin buscador, chips en una fila scrolleable, y zona + Filtros + chips activos a la vista | PASS | `search-shell.tsx` el `SearchInput` dentro de `{!modoMapa && …}`; zona, Filtros y `ChipsActivos` **fuera** de esa condición; `compacto={modoMapa}`. En vivo: bloque de chips 124 px → **42** |
| MAPA-QA-11 | La prop nueva de los chips es **solo presentacional** (FB-02 intacto) | PASS | `git diff` de `occasion-chips.tsx`: solo `className` condicionales; `alternar` y el cálculo de `pintados` sin tocar |
| MAPA-QA-12 | El mapa sin alto fijo y `min-h-dvh` en la home | PASS | Cero `h-[70vh]` en `components/` (también el esqueleto de `next/dynamic`); `app/page.tsx:94` `min-h-dvh` |

### QA en vivo (Playwright, 390×844 salvo donde se aclara)

| ID | Caso | Resultado |
|----|------|-----------|
| MAPA-01 | Entrar al mapa sin tocar nada | PASS — 0 llamadas a `getCurrentPosition`/`watchPosition`, con el permiso ya concedido en el contexto |
| MAPA-02 | Tocar «Dónde estoy» la primera vez | PASS — centro exacto en la posición simulada, **zoom 15**, punto azul + círculo; **1** llamada y `watchPosition: 0` (un toque = un centrado) |
| MAPA-03 | Rechazar el permiso | PASS — «No pudimos ubicarte. Fijate que le hayas dado permiso al navegador.»; el mapa sigue usable y el botón queda deshabilitado con «No podemos ubicarte». **Con el rechazo simulado** (`code: 1`): `clearPermissions()` de Playwright deja el permiso en *prompt* y la llamada queda colgada sin error — es del harness, no de la app |
| MAPA-04 | «Cerca de mí» + centrarse + esperar el re-fetch | **PARCIAL** — la cámara queda donde el usuario la puso y aguanta 12 s. El sub-caso "llega un re-fetch por coords nuevas" **no se puede provocar desde la UI**: `pedirUbicacion` corre solo si `coords` es null (`zone-sheet.tsx:87`), así que con el toggle ya prendido no hay un segundo cambio de clave |
| MAPA-05 | Centrarse y después cambiar de zona | PASS — zoom 15 en el Obelisco → encuadra Recoleta (zoom 12,22), mismo objeto `Map` (no remontó) |
| MAPA-06 | Centrarse, arrastrar y sacar un chip activo | PASS — tras arrastrar a mano, sacar «Recoleta» re-encuadró (zoom 8,04) |
| MAPA-07 | Abrir un cluster y esperar un re-fetch por coords | **PARCIAL** — el cluster abre (12,74 → 13) y el zoom aguanta 8 s; el re-fetch por coords, mismo límite que `MAPA-04` |
| MAPA-08 | Rótulo del control | PASS — `title` y `aria-label` = «Dónde estoy» |
| MAPA-09 | Posición fuera de AMBA (Córdoba capital) | PASS — el mapa **te lleva ahí** y avisa «Por ahora andamos solo por Buenos Aires y alrededores.»; el aviso se va solo a los 6 s |
| MAPA-10 | 390×844, modo mapa: medir | PASS — `scrollHeight` **844** = `innerHeight` 844 (era 1.127) y el mapa **444 px, 100% visible** (era 67%) |
| MAPA-11 | 390×844: los controles | PASS — sin buscador; chips en **1** fila que scrollea (721 px de contenido en 358) con barra propia de 6 px; zona (y=92), Filtros (213) y chips activos (263) a la vista |
| MAPA-12 | Volver a «Lista» | PASS — vuelven el buscador y los chips a 3 filas (124 px); 20 cards |
| MAPA-13 | Modo mapa con muchos chips activos | PASS — 6 chips en 2 filas, el mapa se achica a 357 px y el overflow de página es **0** |
| MAPA-14 | 390×667 (teléfono corto) | PASS con nota — el mapa entra entero (320 px, sin recortarse), pero la página gana **60 px** de scroll por el piso `min-h-80`. Es la degradación que la decisión 9 declara aceptable; aparece también en portrait corto, no solo en landscape |

### Hallazgos

- **El mapa colapsaba a 0 px y los 663 tests estaban verdes.** Al cambiar el contenedor a `flex-1`
  (decisión 9), el `size-full` del div interno dejó de resolver —`height: 100%` necesita un alto
  **declarado** en el padre—: el canvas quedaba desbordado en 300 px y **los controles no recibían
  el toque**, o sea que la feature del spec no se podía usar. `absolute inset-0` tampoco alcanza: el
  CSS de MapLibre pisa el `position` con `.maplibregl-map`. Resuelto dando el alto por flex.
  Lo cazó el `elementFromPoint` sobre el botón, no la vista.
- **Los botones de zoom del `NavigationControl` siguen en inglés** («Zoom in» / «Zoom out»). Es
  anterior a este spec y no lo toca — al BACKLOG.
- **`clearPermissions()` de Playwright no equivale a "denegar"**: deja el permiso en *prompt* y la
  llamada queda esperando una UI que en automatización no aparece. Para verificar un rechazo hay que
  simular el callback de error.

---

## QA /qa-spec — CORRECCION_DATOS (2026-08-09)

**Veredicto:** APROBADO
**Verificación técnica:** typecheck limpio · tests **687/687** (62 archivos) · build **verde**
(corrido con el dev server parado, lección BUSQUEDA)
**Método:** tres checkers independientes (Explore/haiku, maker≠checker) contra el DoD de
`docs/specs/active/CORRECCION_DATOS.md` → **16/16 PASS**, más QA en vivo con Playwright sobre
`https://adondesalimos.ngrok.app` y verificación por `SELECT` de todo lo que toca la base.

**El caso que originó el spec quedó arreglado de punta a punta.** Club Cultural Matienzo
(`7dbf6b2c-4b2a-4605-a425-df3ca24ce520`) pasó de `Pringles 1249` / `-34,5973293, -58,4262510` a
`Av. Juan B. Justo 2959` / `-34,597471, -58,448610`, con `locked_fields = {address,lat,lng}`
(**sin** `name`), zonas recalculadas y el match de Google invalidado y re-resuelto.

### Los 26 casos del spec

| ID | Caso | Resultado |
|----|------|-----------|
| CORR-01 | `/admin` → tab **Lugares** | PASS — existe, es la séptima; las otras seis en su orden (Cola, Precios, Suscripciones, Costos, Curaduría, Usuarios) |
| CORR-02 | Buscar «Matienzo» | PASS — aparece con `Pringles 1249 · Villa Crespo`; un nombre inexistente devuelve el vacío con copy |
| CORR-03 | Buscar un lugar **despublicado** | PASS — «Pizza matienzo» aparece etiquetado **No publicado** (decisión 15: `buscarLugaresPorNombre` omite `publishedWhere`) |
| CORR-04 | Guardar sin completar la fuente | PASS — el botón queda deshabilitado; el `PATCH` forzado **sin** `fuente` da 400, y con `fuente:'x'` da 400 «Contanos de dónde lo sacaste.» |
| CORR-05 | Corregir la dirección de Matienzo + mover el pin | PASS — guardó por pantalla; el aviso **«Moviste el pin. El lugar va a cambiar de zona y de orden en "Cerca de mí".»** apareció al mover el marker |
| CORR-06 | `SELECT` sobre `places` tras CORR-05 | PASS — `address = Av. Juan B. Justo 2959`, lat/lng nuevos, `locked_fields = {address,lat,lng}`; `name` **no** está en la lista |
| CORR-07 | `SELECT` sobre `place_zones` tras CORR-05 | PASS — se recalculó desde el pin nuevo: era `villa-crespo` + 3 secundarias (`botanico-alto-palermo`, `almagro-boedo`, `palermo-soho`), quedó `villa-crespo` (primaria) + `chacarita-colegiales`. Una sola primaria |
| CORR-08 | `npm run zones:assign` después | PASS — **cero** filas cambiadas: el hash de `(slug, is_primary)` del lugar es idéntico antes y después (`bc2761fa…`) |
| CORR-09 | `SELECT google_*` tras CORR-05 | PASS — `google_place_id` null, status `pending`, `google_matched_at` null |
| CORR-10 | Abrir la ficha de Matienzo | PASS — muestra la dirección nueva y **re-matcheó sola**: `ChIJyVx_WKjLvJURfvcH3W7SOVA` → `ChIJU7cbTnrKvJURnqmP5zAI5Uo`. Que el id cambie es la prueba de que el anterior apuntaba a otro negocio |
| CORR-11 | «Cerca de mí» con la distancia nueva | PASS por `SELECT` — la distancia y el pin salen de `places.lat/lng`, ya verificados en CORR-06. No se ejercitó la geolocalización del browser |
| CORR-12 | Corregir **solo** `address` de un lugar `matched` | PASS — en vivo, la respuesta del `PATCH` trae `matchInvalidado: false` y `zonasReasignadas: false`; y con test (`correcciones.integration.test.ts`) |
| CORR-13 | `google_match_status='manual'`, moverle el pin | PASS **por test** — el `google_place_id` queda intacto. Cubierto también el caso `blocked` (edge case del spec). No se ejercitó en vivo para no fabricar un `manual` en el catálogo real |
| CORR-14 | Editor de admin de un lugar matcheado | PASS — mostró **«Google dice: Pringles 1210, C1414 …»** con «Es una pista, no la fuente. Verificalo y escribilo vos.» y **sin** botón de copiar. Tras corregir, el re-match devolvió **«Av. Juan Bautista Justo 2959»**: la corrección aterrizó sobre un negocio real |
| CORR-15 | Facturación de Google | PASS — **verificado por Fer en la consola el 2026-08-09: US$0**, o sea que `formattedAddress` no movió el tier (decisión 18 confirmada en la factura, no solo en la doc). La consola no es accesible desde acá. Lo verificable por código sí está: el field mask es exacto y sin Atmosphere (test de igualdad), y el editor consume `GET /api/lugar/[id]/google`, el endpoint que ya existía (sin segundo llamador) |
| CORR-16 | Bitácora del lugar de CORR-05 | PASS — «Admin · Aplicada · 9/8/2026 03:20», los tres campos con su **antes → después**, la fuente tipeada y el mail |
| CORR-17 | «Soltar» el campo `address` | PASS — `locked_fields` pasa a `{lat,lng}`, el valor **no** cambia, queda fila de bitácora con `soltado: true`; soltarlo de nuevo da 409 `NO_FIJADO` |
| CORR-18 | El import respeta lo fijado | PASS **por el test de integración** (la prueba de fuego, `scripts/overture/__tests__/upsert.integration.test.ts`): con `locked_fields = {address,lat,lng}` los tres sobreviven y `phones`, `confidence`, `overture_category` y `locality` se actualizan. La corrida real contra S3 **no** se hizo (minutos + ancho de banda), así que la **línea del reporte** de campos al día está verificada por unit test de `camposFijadosQueCoinciden`, no ejecutada end-to-end |
| CORR-19 | Dueño en `/mi-negocio/[placeId]` → «Proponer un cambio» | PASS — el formulario trae Dirección, Localidad, el pin y la fuente, y **no hay campo de nombre** |
| CORR-20 | Tras CORR-19 | PASS — el panel dice **«En revisión: Av. del Libertador 4625»**, el botón queda deshabilitado y `places` **no** cambió (`SELECT`) |
| CORR-21 | Segunda propuesta del mismo dueño | PASS — 409 «Ya tenés un cambio en revisión para este lugar.», sin fila nueva |
| CORR-22 | `/admin` → Cola de aprobación | PASS — la corrección aparece **arriba** de los reclamos, con el antes → después, la fuente y la cuenta |
| CORR-23 | Aprobar la propuesta | PASS — se aplicó a `places` (`locality`), quedó `locked_fields = {locality}`, la fila pasó a `approved` con `decided_by`, y el panel del dueño lo muestra aplicado. El match **no** se invalidó (cambió solo `locality`, decisión 9) |
| CORR-24 | Rechazar una propuesta con motivo | PASS — `places` intacto (`locked_fields = {}`), fila `rejected` con el motivo, y el dueño ve **«No lo tomamos: La dirección que tenemos ya es la correcta.»** |
| CORR-25 | `POST …/ubicacion` sobre un lugar **ajeno** | PASS — 403 `NO_AUTORIZADO`; sin sesión, 401. `SELECT` confirma que no se escribió nada |
| CORR-26 | `POST` de dueño forzado con `name` en el body | PASS — 400: el `strictObject` lo rechaza con «Ese dato no se puede cambiar desde acá.» y el nombre no cambia |

### El DoD, por checkers independientes (16/16 PASS)

| ID | Criterio | Resultado |
|----|----------|-----------|
| CORR-QA-01 | Ningún `update(places)` escribe los 5 campos fuera de `correcciones.ts` y del upsert | PASS — los otros tres consumidores escriben `ownerPlan`, `publishOverride` y los `google_*`, ninguno corregible |
| CORR-QA-02 | `locked_fields` se **une**, no se reemplaza, con test | PASS — `[...new Set([...place.lockedFields, ...campos])].sort()` |
| CORR-QA-03 | La prueba de fuego del upsert contra la base, sin S3 | PASS |
| CORR-QA-04 | Ninguna consulta de gating lee `place_data_edits` | PASS — solo `schema.ts`, `correcciones.ts` (escribe) y `negocio/query.ts` (lee para mostrar) |
| CORR-QA-05 | Mover el pin re-asigna `place_zones` en la misma transacción | PASS — `asignarZonasDeLugar(..., tx)` dentro del `db.transaction` |
| CORR-QA-06 | La invalidación del match, con sus dos excepciones | PASS — 4 escenarios con test (`matched`, por nombre, `manual`, solo `address`) + `blocked` |
| CORR-QA-07 | La fuente se valida **en la función** | PASS |
| CORR-QA-08 | `YA_PENDIENTE` + índice único parcial | PASS — `place_data_edits_pendiente_idx` + `try/catch` para la carrera |
| CORR-QA-09 | El dueño no puede proponer `name` | PASS — `strictObject` |
| CORR-QA-10 | `PLACE_DETAILS_FIELD_MASK` exacto, cero Atmosphere | PASS — el test sigue siendo `toBe`, no `contains` |
| CORR-QA-11 | La ficha pública no renderiza `formattedAddress`; no hay botón de copiar | PASS |
| CORR-QA-12 | Migración aditiva y registrada en el journal | PASS — `ADD COLUMN … DEFAULT '{}' NOT NULL` + `CREATE TABLE` + 2 índices, cero `DROP` |
| CORR-QA-13 | La tab es la séptima y no movió las otras seis | PASS |
| CORR-QA-14 | 403 con el mismo shape en los 3 endpoints de admin; 403/401 en el del dueño | PASS |
| CORR-QA-15 | `buscarLugaresPorNombre` se reusa **sin moverlo** | PASS — `lib/curation/query.ts` con diff vacío |
| CORR-QA-16 | Los archivos declarados intocables no cambiaron | PASS — diff vacío en `visibility.ts`, `contenido.ts`, `search/query.ts`, `search/nombre.ts`, `zones/asignar.ts`, `zones/persistir.ts`, `geo/amba.ts`, `curation/query.ts`, `claims/*`; `place_owner_content` sin columnas nuevas |

### Hallazgos

- **La señal asimétrica de la decisión 19 se vio en vivo, y es más fuerte que en el papel.** Antes
  de corregir, «Google dice» devolvió **`Pringles 1210`** — ni siquiera el 1249 nuestro, sino otro
  número de la misma cuadra: el match salía de un `locationRestriction` de ±300 m del pin viejo. Y
  el `google_place_id` **cambió** al re-matchear desde el pin nuevo, así que la ficha efectivamente
  venía mostrando horarios y rating **de otro negocio**. El hallazgo que el spec dedujo leyendo la
  base quedó confirmado ejecutándolo.
- **Dos textos de cara al usuario salían en inglés y los cazó el QA en vivo, no los tests.** Un
  `PATCH` sin `fuente` devolvía *"Invalid input: expected string, received undefined"* y un `POST`
  de dueño con `name` devolvía el `unrecognized_keys` crudo de zod. Los tests pasaban porque
  verifican el **código** de error, no el mensaje. Resuelto traduciendo `invalid_type` y
  `unrecognized_keys` en `mensajeDeZod` (`lib/negocio/correcciones.ts`).
- **El panel del dueño mostraba un rechazo viejo después de una aprobación.** `ultimaRechazada`
  devolvía la última rechazada sin mirar si había una aprobada **posterior**, así que tras aprobar
  una propuesta el dueño seguía leyendo «No lo tomamos: …». Se arregló comparando fechas en
  `estadoCorreccionDelDueno` (`lib/negocio/query.ts`): el rechazo se muestra solo si es la última
  palabra.
- **La dirección correcta salió de OpenStreetMap, y sirve como precedente.** Overpass tiene el nodo
  *Club Cultural Matienzo · Avenida Juan Bautista Justo 2959* con coordenadas; Nominatim, en cambio,
  no resuelve esa altura en CABA (devuelve Mar del Plata). Para verificar una mudanza puntual,
  Overpass por nombre + bbox es la consulta que funciona. **No** es una fuente que la app consuma:
  fue verificación humana, y quedó escrita en la fuente de la corrección.
- **Kansas Grill & Bar quedó como estaba.** Se usó para CORR-19..26 y se restauró: `locality` volvió
  a `Ciudad de Buenos Aires` y `locked_fields` a `{}`. Las filas de bitácora del QA quedan, que es lo
  que corresponde con un log de eventos.

---

## QA — Bug de chips: apagar uno apagaba otro y prendía dos (2026-08-09)

**Veredicto:** APROBADO
**Verificación técnica:** typecheck ✅ · tests ✅ **699/699** (12 nuevos) · build ✅ (con el dev
server parado)
**Método:** test exhaustivo de las **17 × 17 = 289** combinaciones sobre las funciones puras
recién extraídas (`lib/search/__tests__/pintado.test.ts`, sin base: los chips salen del seed)
**escrito antes del fix, para verlo fallar**, más QA en vivo del repro original y de las dos
regresiones de FB-02 en `https://adondesalimos.ngrok.app` con Playwright.

No es un spec: es el ítem 🔴 BUG de `docs/product/BACKLOG.md` § *Feedback posterior*, reportado
por Fer usando la app.

| ID | Criterio | Resultado | Evidencia / Gap |
|----|----------|-----------|-----------------|
| CHIP-01 | El repro de Fer queda arreglado: «Tomar algo» + «Primera cita» prendidos, apagar «Tomar algo» deja **solo** «Primera cita» y no prende nada | ✅ PASS | En vivo: `?t=bar,cafe,cerveceria,restaurante,romantico,tranqui` → toque → `?t=bar,cafe,restaurante,romantico,tranqui`, `aria-pressed="true"` solo en «Primera cita». Antes se apagaba «Primera cita» y se prendían «Cenar afuera» y «Un café» |
| CHIP-02 | Apagar saca **solo los tags exclusivos** del chip: `sacar = chip.tags − ⋃ tags(otros pintados)` | ✅ PASS | Se va `cerveceria`; `bar` se queda porque lo sostiene «Primera cita». `lib/search/pintado.ts` (rama "se ve prendido ⇒ apagarlo") + test *apagar «Tomar algo» deja «Primera cita» prendido* |
| CHIP-03 | **Regresión FB-02** — tocar «Primera cita» desde cero prende **uno** solo | ✅ PASS | En vivo: `?t=bar,cafe,restaurante,romantico,tranqui` con un único `aria-pressed="true"`. «Cenar afuera» y «Un café» quedan aplicados pero tapados |
| CHIP-04 | **Regresión FB-02** — un chip tapado se **promueve**: tocar «Un café» sobre «Primera cita» deja «Un café» y nada más | ✅ PASS | En vivo: → `?t=cafe`, único prendido «Un café» |
| CHIP-05 | Invariante sobre las 289: **nunca se prende un chip que no se tocó** | ✅ PASS | Con la excepción **verificada** (no tolerada) de la rama `prender`: el chip que se prende de más tiene que estar contenido en la unión `tags previos ∪ tags del tocado` — ver H-1 |
| CHIP-06 | Invariante: **el toque hace lo que el chip muestra** (prendido ⇒ se apaga · apagado ⇒ se prende) | ✅ PASS | Única excepción, inventariada por nombre en el test: «Cumpleaños» puesto + toco «Tomar algo» (H-1) |
| CHIP-07 | Invariante: **apagar un chip no apaga a ningún otro** | ✅ PASS | 0 violaciones en las 289. Es el corazón del bug: antes fallaba en el repro de Fer |
| CHIP-08 | Invariante: **promover apaga solo a los chips que tapaban** al que se tocó | ✅ PASS | 0 violaciones. Es la excepción declarada en FB-02, escrita como regla verificable |
| CHIP-09 | Invariante: **prender no saca ningún tag** | ✅ PASS | 0 violaciones |
| CHIP-10 | Invariante: **ningún toque es un botón muerto** — siempre cambia el estado | ✅ PASS | 0 violaciones. Es el riesgo que introducía el fix: si `sacar` quedaba vacío, apagar no hacía nada |
| CHIP-11 | El barrido cubre de verdad las 289 y las **tres** ramas del toque | ✅ PASS | `expect(casos).toHaveLength(289)` + cada rama con al menos un caso. La rama se clasifica en el test, no se le pregunta a la implementación |
| CHIP-12 | El pintado y el toggle tienen **dueño único** y el componente queda de presentación | ✅ PASS | `lib/search/pintado.ts` (`chipsPintados` + `tagsAlTocar`, puras, sin base ni DOM); `components/search/occasion-chips.tsx` ya no implementa ninguna regla. `grep -rn "estaAplicado\|contieneEstricto"` fuera del módulo y su test: 0 |

### Hallazgos

**H-1 — El barrido destapó un segundo caso, del mismo apellido, en la rama `prender`.**
Al prender un chip no hay elección —sumar sus tags es lo que lo prende— y la unión con lo que ya
estaba puede **completar a un tercer chip**. Con los tags reales, «Cumpleaños» + «Tomar algo»
completa a **«Salida con amigos»** (`bar, cerveceria, grupos-grandes`): se prende sin que nadie lo
toque y, como **contiene** a «Tomar algo», el chip que se tocó queda tapado y se sigue viendo
apagado. Son **12 de 289** combinaciones (todas por `tomar-algo` o `salida-con-amigos`), **1 sola**
con el tocado tapado.
**No se puede arreglar dentro de la regla vigente:** mientras los tags sean el estado (decisión 18)
y el pintado se derive de ellos, ese tercer chip está genuinamente entero y esconderlo pediría
romper uno de los dos que el usuario sí quiere.
El test **no lo tolera en silencio**: verifica que el que se prende de más esté contenido en la
unión, e **inventaría por nombre** el único caso con el tocado tapado — si la curaduría mueve los
tags de un chip y aparece otro, el test lo dice.

✅ **Cerrado como decisión tomada el 2026-08-10 — no se arregla, y no es deuda.** El 2026-08-09 Fer
lo había anotado en el BACKLOG "para no tocarlo ahora"; el triaje del día siguiente (sesión Fable,
sin código) evaluó las cuatro salidas y ninguna paga. **El dato que las cierra:** estar *tapado* es
la mecánica normal del pintado maximal, no la anomalía — con **un solo chip tocado, 7 de los 17**
estados limpios ya dejan alguno tapado (8 en total). Entonces dibujar al tapado en un tercer estado
pintaría el **camino feliz** (volvería el "se prenden de a varios" de FB-02, ya arreglado), y
distinguir "tapado normal" de "tapé al recién tocado" exige saber qué chip tocó el usuario;
recurar los tags tampoco sirve, porque `tomar-algo` está contenido en `salida-con-amigos` y en
`after-office` **por construcción** y la curaduría los edita sin deploy. Queda solo llevar `?c=` en
la URL — decisiones 12 y 18, back y link compartido, para un parámetro que no cambia ni un
resultado: desproporcionado para 12/289. **Qué queda vivo:** en **11 de los 12** la UI no miente (el
chip de más tiene sus tags efectivamente puestos, la lista que se ve es la suya) y el único feo
tiene salida en un toque (volver a tocar el chip lo promueve y queda solo él). **Se reabre** —y se
va directo a `?c=`— si un usuario real lo reporta o si la curaduría deja los dos
chips de un caso juntos entre los **4 de la home**. Análisis completo en `docs/product/BACKLOG.md`
§ *Feedback posterior*.

**H-2 — El tag suelto se volvió un caso raro, y queda como está.**
Con el fix, apagar ya **no** deja tags huérfanos: lo que sobrevive está sosteniendo a otro chip
pintado. El único camino que todavía los genera es la **promoción** de un chip tapado, que ya
estaba declarada conocida el 2026-08-08. Fer decidió dejarlo: es lo coherente con la decisión 18
—los tags son el estado, se ven y se sacan uno por uno en `ChipsActivos`— y limpiarlos solo le
borraría al usuario un filtro que él ve puesto.

**H-3 — El bug estaba fuera del alcance de los tests por dónde vivía, no por ser difícil.**
El pintado y el toggle eran funciones puras dentro de un componente cliente: nadie las podía
llamar. Extraerlas fueron ~90 líneas movidas sin cambiar comportamiento, y ahí el bug se
reprodujo en un test en el primer intento. FB-02 salió en dos vueltas y este bug llegó por un
reporte de Fer clickeando; los dos vivían en el mismo archivo. Lección registrada.

---

## QA /qa-spec — ORDEN_ORGANICO (2026-08-10)

**Veredicto:** APROBADO
**Verificación técnica:** typecheck limpio · tests **728/728** (65 archivos) · build **verde**
(corrido con el dev server parado, lección BUSQUEDA)
**Método:** tres checkers independientes (Explore/haiku, maker≠checker) contra el DoD de
`docs/specs/planned/ORDEN_ORGANICO.md` → **11/11 PASS**, más los 10 casos ORD en vivo con
Playwright sobre `https://adondesalimos.ngrok.app` (catálogo real, 18.993 publicados) y las
mediciones de costo con `EXPLAIN (ANALYZE, BUFFERS)` sobre el Postgres de dev.

**Lo que originó el spec quedó arreglado donde se veía.** *Palermo Soho · Cenar afuera* pasó de
`1 Burger King · 2 Subway · … · 10 McDonald's` a los siete lugares que el spec listó en su
sección *Objetivo*, **en ese orden**; *Un café* pasa de abrir con Starbucks a abrir con Mulata
Café, Maricafe y Full City. **29 de las 46 zonas cambiaron de #1** y ninguna perdió un lugar:
`countPlaces` es idéntico al de antes en las 46.

### DoD — checkers independientes

| ID | Criterio | Resultado | Evidencia |
|----|----------|-----------|-----------|
| ORDEN-QA-01 | `lib/search/cadenas.ts` es el único que lee `search.cadenas`, valida y degrada a lista vacía | PASS | `lib/search/cadenas.ts:28,74,90`; el grep solo lo encuentra ahí + `scripts/seed.ts:131` + `scripts/cadenas.ts`. 6 casos en `cadenas.test.ts` (null, no-lista, basura, vacía, dupes, la del seed) |
| ORDEN-QA-02 | La banda en `clavesDeOrden`, dentro de `if (!usaGps)`, entre `ownerRank` y `confKey`, con la precedencia de la decisión 3 | PASS | `lib/search/query.ts:315` entre 310 y 316; `bandaKey` en 101-103 (ser cadena vale 2, estar curado 1 ⇒ 3/2/1/0). Test de las 4 bandas con los `confidence` **invertidos**; verificado por mutación: invertir la precedencia rompe 2 tests |
| ORDEN-QA-03 | El cursor sobrevive: 3 páginas sin duplicados ni saltos | PASS | `orden-organico.integration.test.ts:364-384` — 45 fixtures, 45 ids distintos, bandas no-crecientes; 15 comparten nombre para forzar el empate hasta el `id`. No hubo código de cursor nuevo: `clavesDeOrden` es fuente única (decisión 11) |
| ORDEN-QA-04 | Nada se filtra: `countPlaces` igual en una matriz de búsquedas | PASS | La banda no aparece en `construirWhere` (239-261) ni en `countPlaces` (269-279), solo en el ORDER BY. Test `it.each` de 6 casos × lista prendida/apagada, más "mismo conjunto, otro orden" |
| ORDEN-QA-05 | `buscarDestacados` intacto | PASS | `git diff HEAD -- lib/search/query.ts`: cero cambios dentro de la función |
| ORDEN-QA-06 | `scripts/cadenas.ts` + `npm run cadenas:proponer` proponen sin escribir | PASS | `package.json:21`; el script solo hace `db.select()` — ni insert, ni update, ni delete. Imprime los nombres detectados y el `UPDATE` con la unión contra lo que ya hay |
| ORDEN-QA-07 | El seed siembra `search.cadenas` y es idempotente | PASS | `scripts/seed.ts:131` + `onConflictDoNothing` en 133: un re-run no pisa una lista curada a mano |
| ORDEN-QA-08 | Índice parcial por migración, también declarado en el schema | PASS | `drizzle/0017_orden_organico.sql:1`, `lib/db/schema.ts:273`, journal idx 17. Verificado en la base con `\d place_tags` |
| ORDEN-QA-09 | Costo re-medido con `EXPLAIN ANALYZE` en los dos casos y **anotado en el spec** | PASS | Decisión 18 del spec: con zona **2,5 → 5,9 ms**; sin zona **8,4 → 41,5 ms** con el índice contra **116,6 ms** sin él (−64 %). Ver H-3 |
| ORDEN-QA-10 | En GPS el orden no cambia | PASS | La banda solo entra en `if (!usaGps)`; test que compara el resultado con la lista prendida y con la lista apagada |
| ORDEN-QA-11 | `searchPins` hereda el orden sin duplicarlo | PASS | `lib/search/query.ts:424` llama a `clavesDeOrden`; no hay una segunda expresión de orden |
| ORDEN-QA-12 | La matriz de `cobertura-chips` no se mueve | PASS | Corrida con el `query.ts` de HEAD y con el nuevo: **`diff` vacío**, byte a byte (8/9 chips en ≥1 zona, 46/46 zonas). Es el DoD que protege el piso de los chips |

### Los 10 casos en vivo (Playwright contra ngrok, catálogo real)

| ID | Caso | Resultado |
|----|------|-----------|
| ORD-01 | Palermo Soho, sin chip | PASS — 1 *70 30 Bar* · 2 *La Choppería*; **cero cadenas en el top 20** (antes: Burger King y Subway 1º y 2º) |
| ORD-02 | Palermo Soho + **Cenar afuera** | PASS — los 7 primeros son exactamente los de la sección *Objetivo* del spec, en ese orden; McDonald's no está en la primera página |
| ORD-03 | Palermo Soho + **Un café** | PASS — 1 *Mulata Café* · 2 *Maricafe* · 3 *Full City Coffee House*; **ningún Starbucks en las 20**. Es el caso que fija la precedencia de la decisión 3 |
| ORD-04 | Quilmes, sin chip y con **Cenar afuera** | PASS — 20 cards en los dos, 1 *Vinsanto*, sin cadenas de la lista. Con la lista vacía volvían dos McDonald's al top 6 |
| ORD-05 | Las 46 zonas | PASS — las 46 con la primera pantalla llena (20) y `countPlaces` idéntico al de HEAD; 29 cambiaron de #1 |
| ORD-06 | Scroll de 3 páginas en Palermo Soho | PASS — 60 cards, **60 ids distintos**; el sheet sigue anunciando 1.094 |
| ORD-07 | "Cerca de mí" (GPS, Obelisco) | PASS — distancias monótonas; **Burger King 1º a 0,00 km**, que es lo correcto: quien pide cerca pide cercanía (decisión 10) |
| ORD-08 | Texto libre "burger" | PASS — 1 y 2 son Burger King: con texto manda la similitud |
| ORD-09 | Mapa con resultado > 200 | PASS — 200 pins + `truncated`; los primeros 20 son los mismos ids **y en el mismo orden** que la página 1 |
| ORD-10 | `search.cadenas = '[]'` | PASS — 200 sin errores de consola, `count` intacto (1.094) y las cadenas vuelven (Subway 1º; Starbucks 1º y 3º en *Un café*); el `UPDATE` de vuelta lo restaura. Ver H-1 |

### Hallazgos (no bloqueantes)

**H-1 — "Degrada al de hoy" es exacto en la mitad que importa, no en las dos.**
Con `search.cadenas = '[]'` la banda colapsa a 2/3: las cadenas vuelven al top (verificado), pero
lo curado **sigue** arriba de lo no curado. Es deliberado y quedó escrito en la decisión 16 del
spec: vaciar la lista apaga la mitad «cadena», que es la que causaba la queja; apagar también la
mitad «curaduría» pediría sacar la clave entera del orden y acoplaría dos señales que no tienen
por qué viajar juntas. El rollback real sigue siendo un `UPDATE`.

**H-2 — El detector encuentra 49 nombres, no los 19 del anexo.**
Agrupando por nombre normalizado sobre el catálogo publicado con el umbral de ≥ 8 locales de la
decisión 15, `npm run cadenas:proponer` devuelve **49 nombres / 1.562 lugares** — que es lo que
cierra con los 1.513 de la banda «cadena» del anexo, cosa que 19 nombres no explicaban. Los 19 del
anexo eran el recorte que ya había pasado por ojo humano. **La lista inicial (22) deja afuera
cadenas reales** que el detector sí ve: `tea connection`, `green eat`, `el noble`, `sushiclub`,
`wendy's`, `mccafe`, `la continental`, `la farola express` — esta última apareció 14ª en
*Quilmes · Cenar afuera*. Sumarlas es un `UPDATE` y es decisión de producto (decisión 5: la lista
necesita criterio humano), no un bug. Anotado en el BACKLOG.

**H-3 — La mitad cara del costo no era el `EXISTS`, era el `unaccent` del nombre.**
La decisión 18 atribuía el costo a la curaduría por fila y pedía replantear materializar si no
bajaba de 40 ms sin zona. Medido partido sobre AMBA entero: la curaduría sola suma **+10,5 ms** y
el `immutable_unaccent(lower(name))` del match de cadena suma **+17 ms**. El índice parcial hizo su
trabajo (116,6 → 41,5 ms, −64 %) y quedó 1,5 ms por encima de la línea, con una baseline que en
esta máquina es más rápida que la del diseño (8,4 vs 13,8 ms). **No se materializa:** compraría los
10 ms chicos, rompería la puerta de ida y vuelta de la decisión 16 y dejaría intacta la mitad
grande. Se revisa si la home sin zona pasa a ser el caso mayoritario.
