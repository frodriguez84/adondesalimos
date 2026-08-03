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
