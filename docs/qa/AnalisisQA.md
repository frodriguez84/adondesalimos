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
