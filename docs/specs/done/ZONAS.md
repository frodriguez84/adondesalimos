# Spec: Zonas de AMBA

**Estado:** ✅ Implementado (2026-07-20)
**Prioridad:** Alta — spec 2: la búsqueda (spec 3) filtra por zona como gesto default
**Gate:** Ninguno
**Bloquea:** Búsqueda + filtros (spec 3)
**Depende de:** CATALOGO (tabla `places` con lat/lng) · decisiones de `docs/product/IDEAS.md` § Faceta 7 — Zona

---

## Problema

La zona es el default de la búsqueda ("primero elegís zona") y está decidida a nivel
producto — 4 regiones → zonas de salida por granularidad asimétrica, zona primaria +
buffer de 400 m, multiselección, alias — pero no existe nada de eso como datos: ni
polígonos, ni tablas, ni asignación de lugares a zonas.

## Objetivo

1. Modelo de datos de zonas: `zones` (con polígono y polígono expandido), `zone_aliases`,
   `place_zones`.
2. Los **46 polígonos** como archivos GeoJSON versionados en el repo + script de carga.
3. Script de **asignación** lugar→zonas: una primaria (por polígono exacto) + las zonas
   cuyo polígono expandido 400 m lo contienen (para la búsqueda). Idempotente.
4. Seed de alias (nombres viejos y absorbidos: "Villa Ortúzar" → Chacarita y Colegiales).

### Precisión sobre los conteos

IDEAS.md dice "~19 zonas CABA / ~44 totales" (aproximados a propósito). La enumeración
validada da exacto: **CABA 21 · Norte 9 · Oeste 7 · Sur 9 = 46 zonas**. Este spec fija los
números exactos; no cambia ninguna lista.

## Qué NO es esta feature

- **UI del selector** (buscador con autocompletar + regiones desplegables): vive en el spec
  de Búsqueda. Acá solo los datos que ese selector consume (zonas, orden, alias).
- **"Cerca de mí" / GPS**: es del spec de Búsqueda (y no usa zonas — el toggle las
  reemplaza, ya decidido).
- **Zona default = última usada**: estado del cliente, spec de Búsqueda.
- **La Plata**: fuera de v1. Si entra algún día, es la 5ª región — el modelo lo soporta
  sin cambios (una región más en el enum + sus zonas).
- **PostGIS**: no entra en v1 (ver decisión 12). Si una feature futura necesita geo-queries
  en vivo, se re-evalúa ahí.

## Decisiones cerradas

Las 1-10 vienen de `IDEAS.md` (no se reabren); las 11-19 son diseño de este spec.

| # | Decisión |
|---|----------|
| 1 | Dos niveles: **Región (4: CABA · Zona Norte · Zona Oeste · Zona Sur) → zona de salida (46)**. Nunca se muestran todas juntas |
| 2 | **Granularidad asimétrica**: la grilla sigue la densidad de salidas (Palermo en 4 zonas; todo el oeste de CABA en 2) |
| 3 | CABA en zonas agrupadas, **no** los 48 barrios oficiales; conurbano por **corredor + localidad**, no por partido |
| 4 | **Zona primaria única** por lugar (la que muestra la card) asignada por polígono exacto |
| 5 | La **búsqueda** por zona usa el polígono **expandido ~400 m**: el bar de Córdoba y Dorrego aparece buscando Villa Crespo y buscando Palermo Soho |
| 6 | **Multiselección libre** de zonas, sin límite |
| 7 | El selector matchea **nombres viejos y alias** ("Villa Ortúzar" lleva a Chacarita) |
| 8 | Palermo Soho / Hollywood / Botánico **no tienen polígono oficial**: se dibujan a mano (límites por avenida). El resto de CABA sale del GeoJSON oficial de `data.buenosaires.gob.ar` |
| 9 | La Plata fuera de v1; el bbox del import ya la excluye |
| 10 | El mapa con zonas tocables está descartado para v1 |
| 11 | **Región como `pgEnum`** (`caba · norte · oeste · sur`): set chico y estable; una región nueva (La Plata) es un `ALTER TYPE ... ADD VALUE`, no un rediseño |
| 12 | **Sin PostGIS en v1.** La asignación lugar→zona se **precomputa** con turf.js en un script (point-in-polygon + buffer): las zonas son estáticas y los lugares solo cambian con el import o cuando un dueño crea/edita. El runtime lee `place_zones` con índices comunes — Postgres vanilla en Docker y Neon, cero extensión nueva. El buffer de 400 m se materializa una vez (`polygon_search`), no se calcula por query |
| 13 | **Los GeoJSON viven versionados en `data/zones/`** (un archivo por zona): son artefactos curados a mano (merges + 3-4 dibujados), no derivables — si se pierden, se redibuja. El script de carga upsertea por slug |
| 14 | **Los 4 de Palermo particionan el polígono oficial de Palermo**: Soho, Hollywood y Botánico/Alto Palermo se dibujan con límites por avenida; Las Cañitas se dibuja o queda como resto de la partición — pero la unión de los 4 = Palermo oficial, sin huecos ni solapes |
| 15 | **Conurbano: fuente estatal (IGN/BAHRA/INDEC, licencia con cita) o dibujo manual aproximado — NUNCA OSM**: los límites de OSM son ODbL (share-alike), el riesgo exacto que se descartó al elegir Overture; no se reintroduce por los polígonos. Verificar la licencia de la fuente elegida es tarea de implementación; si no es limpia, se dibuja a mano (para "Quilmes" un polígono grueso alcanza — la zona es la salida, no el catastro) |
| 16 | **Asignación reconstruible**: `zones:assign` borra y regenera `place_zones` completo (idempotente); corre después de cada import de Overture y al crear/editar un lugar de dueño (hook del spec 5). Reporta asignados, sin zona y conteo por zona |
| 17 | **Lugar fuera de toda zona: 0 filas en `place_zones`** — no aparece filtrando por zona (correcto: está fuera del área de salidas), sí por texto o GPS. El reporte del script los lista para auditarlos |
| 18 | **Solape accidental de polígonos primarios**: no debería haber (son partición), pero si un punto cae en dos, la primaria es la de **menor área** (la más específica) — regla determinística, sin intervención manual |
| 19 | **Alias como tabla** (`zone_aliases`), no lógica: agregar un alias es un INSERT (mismo espíritu curado que las tags). El matching por partes del nombre compuesto ("Banfield" encuentra "Lomas de Zamora y Banfield") no necesita alias — lo resuelve el buscador del selector (spec 3) contra el nombre |

### Modelo de datos (migración sobre el schema de CATALOGO)

**`zones`**

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | serial pk | |
| `region` | pgEnum `caba \| norte \| oeste \| sur` | not null |
| `name` | text not null | ej. "Chacarita y Colegiales" |
| `slug` | text unique not null | clave de upsert del loader |
| `polygon` | jsonb not null | GeoJSON Polygon/MultiPolygon exacto (asigna primaria) |
| `polygon_search` | jsonb not null | el mismo expandido 400 m (turf.buffer), precomputado |
| `sort` | int | orden dentro de la región en el selector |
| `active` | boolean default true | |

**`zone_aliases`** — `id` serial pk · `zone_id` fk · `alias` text (unique junto con zone_id).

**`place_zones`** — pk compuesta (`place_id`, `zone_id`) · `is_primary` boolean not null
default false. Índices: por `zone_id` (la query de búsqueda entra por zona) y parcial
`is_primary` por `place_id`. Invariante (verificada por test): **a lo sumo una** fila
`is_primary` por lugar.

### Las 46 zonas (canon — slugs y composición)

**CABA (21).** Entre paréntesis, los barrios oficiales del GeoJSON que se mergean; ✏️ = se
dibuja a mano.

| Zona (slug) | Composición |
|---|---|
| `palermo-soho` ✏️ · `palermo-hollywood` ✏️ · `botanico-alto-palermo` ✏️ · `las-canitas` ✏️ | partición del barrio oficial Palermo (decisión 14) |
| `villa-crespo` | (Villa Crespo) |
| `chacarita-colegiales` | (Chacarita + Colegiales + Villa Ortúzar) |
| `villa-urquiza-coghlan` | (Villa Urquiza + Coghlan) |
| `belgrano` | (Belgrano) |
| `nunez` | (Núñez) |
| `saavedra` | (Saavedra) |
| `recoleta` | (Recoleta) |
| `retiro-microcentro` | (Retiro + San Nicolás) |
| `puerto-madero` | (Puerto Madero) |
| `san-telmo` | (San Telmo) |
| `monserrat-congreso` | (Monserrat + parte de Balvanera sur — ajustar al dibujar) |
| `la-boca-barracas` | (La Boca + Barracas) |
| `almagro-boedo` | (Almagro + Boedo) |
| `once-abasto` | (Balvanera — cae acá por decisión ya tomada) |
| `caballito` | (Caballito) |
| `devoto-villa-del-parque` | (Villa Devoto + Villa del Parque + aledaños del oeste norte) |
| `flores-floresta` | (Flores + Floresta + aledaños del oeste sur) |

> Los barrios oficiales que no aparecen nombrados (Villa Lugano, Mataderos, Parque
> Chacabuco, etc.) se reparten entre las zonas limítrofes al armar los merges, priorizando
> "cómo habla la gente" — es trabajo de curaduría del que dibuja, documentado en
> `data/zones/README.md`. Ningún punto de CABA queda fuera de toda zona.

**Zona Norte (9):** `olivos-vicente-lopez` · `martinez-acassuso` · `san-isidro` ·
`tigre-nordelta` · `san-fernando` · `san-miguel-bella-vista` · `pilar` · `escobar` ·
`san-martin-villa-ballester`

**Zona Oeste (7):** `ramos-mejia-haedo` · `moron-castelar` · `ituzaingo` ·
`caseros-tres-de-febrero` · `san-justo` · `moreno` · `merlo`

**Zona Sur (9):** `avellaneda` · `quilmes` · `lomas-banfield` · `temperley` · `lanus` ·
`adrogue-burzaco` · `monte-grande` · `berazategui` · `florencio-varela`

**Aliases seed inicial:** `villa-ortuzar` → chacarita-colegiales · `balvanera` →
once-abasto · `san-nicolas` → retiro-microcentro · `villa-devoto` → devoto-villa-del-parque.
Se amplía por curaduría (INSERT) a medida que aparezcan búsquedas que no matchean.

### Scripts

- **`npm run zones:load`** — lee `data/zones/*.geojson`, valida (polígono cerrado, slug
  conocido, región válida), calcula `polygon_search` (turf.buffer 400 m) y upsertea por
  slug. Falla ruidosamente si falta alguna de las 46.
- **`npm run zones:assign`** — recorre `places`, point-in-polygon (turf) contra `polygon`
  para la primaria (regla de menor área si hay solape) y contra `polygon_search` para las
  de búsqueda; regenera `place_zones` completo en transacción. Reporta: total, asignados,
  sin zona (listados), top zonas por cantidad.

## Criterios de done (DoD)

- [ ] Migración Drizzle crea `zones`, `zone_aliases`, `place_zones` + enum `region`;
      aplica limpio sobre la base del spec CATALOGO
- [ ] `data/zones/` contiene los **46 GeoJSON** (21 CABA · 9 Norte · 7 Oeste · 9 Sur) con
      `data/zones/README.md` documentando fuente y composición de cada uno, incluida la
      licencia de la fuente del conurbano (decisión 15: estatal o dibujo propio, no OSM)
- [ ] Los 4 polígonos de Palermo particionan el barrio oficial: unión ≈ Palermo, sin
      huecos ni solapes (test con turf sobre los archivos)
- [ ] `zones:load` carga las 46 zonas + aliases seed; re-correrlo no duplica
- [ ] `zones:assign` deja cada lugar con ≤1 primaria (test de invariante) y ≥ las mismas
      zonas en búsqueda que en primaria; re-correrlo da el mismo resultado
- [ ] Test del caso borde documentado: un punto a <400 m del límite Villa Crespo/Palermo
      Soho queda con 1 primaria y 2 zonas de búsqueda
- [ ] Lugares sin zona: reporte generado y revisado, con el detalle de **en qué localidades**
      están (es lo que permite decidir si falta una zona)
- [ ] `npx tsc --noEmit` · `npm test` · `npm run build` verdes

## QA manual (IDs propuestos)

| ID | Caso | Criterio |
|----|------|----------|
| ZON-01 | Carga completa | `SELECT region, count(*) FROM zones GROUP BY region` = caba 21 · norte 9 · oeste 7 · sur 9 |
| ZON-02 | Borde real | Un bar conocido de Av. Córdoba y Dorrego: primaria una sola (Villa Crespo **o** Palermo Soho), y `place_zones` lo tiene en ambas |
| ZON-03 | Invariante primaria | Query: cero lugares con 2+ filas `is_primary` |
| ZON-04 | Alias | `villa-ortuzar` resuelve a Chacarita y Colegiales; `balvanera` a Once y Abasto |
| ZON-05 | Sanity de densidad | Las 4 zonas de Palermo tienen una **densidad** de lugares publicados por km² mucho mayor que la región Sur — es el dato que justifica la granularidad asimétrica |
| ZON-06 | Sin zona | Los lugares con 0 zonas son minoría y **ninguno** cae en el centro de CABA |
| ZON-07 | Idempotencia | Segundo run de `zones:load` + `zones:assign`: mismos conteos |

## Correcciones al spec durante la implementación (2026-07-20)

Tres afirmaciones de este spec resultaron falsas al contrastarlas con los datos reales. Se
corrigieron **arriba**; queda acá el registro de qué decía antes y por qué cambió, para que
la corrección no se lea como haber ajustado el árbitro a la implementación.

1. **ZON-05 decía "suman más lugares publicados que la región Sur entera".** Es falso: las 4
   zonas de Palermo dan 1.734 publicados y la región Sur 2.598. Lo que sí es cierto —y por
   goleada— es la densidad: Palermo ocupa 15,92 km² y Sur 838 km², o sea **109 lugares
   publicados por km² contra 3,1, unas 35×**. La decisión de producto (decisión 2, granularidad
   asimétrica) está bien tomada; la métrica elegida para verificarla estaba mal. El criterio
   ahora mide densidad, que es lo que la decisión siempre quiso decir.

2. **El DoD esperaba que los lugares sin zona fueran "minoría en los bordes del bbox —
   Escobar/Pilar/Varela profundos".** Escobar, Pilar y Florencio Varela tienen **cero** lugares
   sin zona. Los 2.200 sin zona (8,4%) están en partidos densos y céntricos que la lista de 46
   no enumera: José C. Paz, Gregorio de Laferrere, General Rodríguez, González Catán,
   Hurlingham, Ezeiza, Isidro Casanova, Longchamps. **La lista de 46 no se tocó** (queda como
   canon); el hueco está en `docs/product/BACKLOG.md` para decidir con el dato en la mano.

3. **La decisión 15 preveía "fuente estatal (IGN/BAHRA/INDEC)" para el conurbano.** De las
   tres, dos no sirven: INDEC prohíbe expresamente la comercialización (*"queda prohibida su
   comercialización en cualquiera de sus formas"* — peor que ODbL para este caso) y BAHRA solo
   publica **puntos**. Se usó **IGN vía WFS**, con la licencia verificada verbatim en el
   servicio (Ley 27.275, sin share-alike). ARBA (CC BY 4.0) era mejor pero entrega el ZIP
   truncado de forma determinística. **Ninguna fuente estatal argentina publica polígonos de
   localidades del conurbano**, así que las 8 zonas sub-partido se dibujaron a mano, tal como
   la decisión 15 preveía como alternativa. Detalle en `data/zones/README.md`.

## Relación con otros specs

- **CATALOGO (spec 1)**: prerequisito — `places` con lat/lng de Overture. Este spec NO toca
  esa tabla: agrega `place_zones` al lado (la card obtiene la zona por join).
- **Búsqueda (spec 3)**: consume `zones` (selector: regiones → zonas, orden, alias),
  `place_zones` (filtro, multiselección = `zone_id IN (...)`) y el nombre de la primaria
  para la card. El matching por partes del nombre y el autocompletar son de ese spec.
- **Auth/reclamo (spec 5)**: al crear/editar lugar de dueño, ejecutar la asignación de ese
  lugar (mismo helper que usa `zones:assign`).
- **Import de Overture** (CATALOGO): después de cada re-import corre `zones:assign`.
