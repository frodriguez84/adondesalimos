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
