# Spec: Catálogo + import de Overture

**Estado:** ✅ Implementado (2026-07-20)
**Prioridad:** Alta — es el spec 1: búsqueda, zonas, ficha y reclamo de dueño leen todos de acá
**Gate:** Ninguno (requiere el scaffold del paso 0 ya creado)
**Bloquea:** Zonas · Búsqueda + filtros · Ficha · Auth/reclamo de negocio
**Depende de:** scaffold Next.js (paso 0) · decisiones de `docs/product/IDEAS.md` § Arquitectura de datos y § Taxonomía de filtros

---

## Problema

No existe catálogo: no hay tablas, no hay tags, no hay lugares. Sin esto no hay búsqueda,
ni ficha, ni nada que un dueño pueda reclamar. La arquitectura ya está decidida (catálogo
propio persistido de Overture + Google en vivo solo en la ficha) pero **el modelo de datos
concreto — tablas, campos, relaciones — es el contenido de este spec**.

## Objetivo

1. Schema Drizzle del catálogo: lugares, taxonomía (facetas + tags), asignación de tags y
   settings editables desde admin.
2. Las tags de las 7 facetas como **datos semilla** (seed idempotente).
3. Script de **import de Overture** (release `2026-06-17.0`, bbox AMBA) que carga todo el
   catálogo inicial: `confidence` como columna, `operating_status` guardado, re-ejecutable
   sin duplicar.
4. Regla de **visibilidad/publicación** en la query (umbral de confidence configurable +
   `operating_status` + override por reclamo aprobado).
5. Página `/legales` con la **atribución completa** de las 9 fuentes de Overture + Google.

## Qué NO es esta feature

- **Zonas** (spec 2): acá no hay polígonos ni columna `zone_id` — se agrega por migración
  en el spec de Zonas, que también decide si entra PostGIS.
- **Búsqueda y filtros** (spec 3): ni UI ni endpoints de búsqueda. Los **chips de Ocasión**
  tampoco: son capa de curaduría sobre las facetas, viven en el spec de Búsqueda.
- **Ficha / Google en vivo** (spec 4): la columna `google_place_id` queda creada pero vacía;
  el matching Overture↔Google y el fetch de horarios/rating es del spec de Ficha.
- **Reclamo de dueño** (spec 5): la columna `publish_override` queda lista y la query la
  respeta desde el día 1, pero el flujo de reclamo/aprobación no existe todavía.
- **Sugerencia de tags por dueños/usuarios** (modelo curado, v2): el schema lo soporta
  (`active` en tags), el flujo no se construye.
- **Regla compuesta de rescate de la cola** (confidence bajo + teléfono + redes ⇒ real):
  quedó 💡 sin decidir en IDEAS.md. Con el corte en la query, probarla después es gratis.
- **Nada de Google se persiste** salvo `place_id` (única excepción del ToS). No hay columnas
  para nombre/horarios/rating/fotos de Google — no es olvido, es prohibición.

## Decisiones cerradas

Las 1-10 vienen decididas de `IDEAS.md` (no se reabren); las 11-19 son decisiones de diseño
de **este spec**.

| # | Decisión |
|---|----------|
| 1 | Catálogo propio persistido: Overture places + lugares de dueños. Google solo enriquece la ficha en vivo |
| 2 | Overture release `2026-06-17.0`, bbox AMBA `lon -59.10/-58.10 · lat -35.05/-34.28` (~282.865 POIs, ~27.683 gastronómicos) |
| 3 | Construir contra `taxonomy` (struct `primary/hierarchy/alternates`), **NO** contra `categories` (se elimina en la release de septiembre 2026) |
| 4 | Se importa **TODO** sin cortar por confidence; `confidence` es columna y el filtro vive en la **query**, umbral inicial **0.5** editable desde `/admin` (tabla de settings) |
| 5 | `operating_status` se filtra **siempre**, independiente del confidence: lugar cerrado no se publica ni con 0.9 |
| 6 | Los que no pasan el umbral **no se borran**: quedan en la tabla, invisibles. Bajar el umbral los revive sin costo |
| 7 | El reclamo de dueño aprobado **sobrescribe el umbral** de confidence (no el filtro de `operating_status`) |
| 8 | Exclusiones de import por principio "salida vs compra": `ice_cream_shop`, `bakery`, `dessert_shop` afuera |
| 9 | De Google solo se persiste `place_id` (sin límite temporal). Lat/lng de Google, si alguna vez se usara, máximo 30 días — no aplica acá porque lat/lng vienen de Overture |
| 10 | Atribución: string completo de las 9 fuentes de Overture en `/legales` + atribución a Google |
| 11 | **Una sola tabla `places`** para ambos orígenes (`source: 'overture' \| 'owner'`), no dos tablas: la búsqueda los mezcla, el reclamo convierte uno en otro. Campos de Overture nullables para lugares de dueño |
| 12 | **Facetas como `pgEnum`, no tabla**: el set de 6 facetas con tags es fijo por decisión de producto ("crear una faceta nueva rompe el modelo de 7"). El modelo curado agrega *tags*, no facetas. Labels y orden de UI en constante de código |
| 13 | **Tabla `tags` única** para las 6 facetas: `facet` (enum) + `parent_id` autorreferente (solo Cocina lo usa: 9 padres filtrables) + `group_label` (grupos de Actividad/Ambiente — ordenan la UI, no filtran) + `slug` único global + `active` (curaduría: desactivar sin borrar) |
| 14 | **`place_tags`** N-a-N con `source` (`'import' \| 'owner' \| 'admin'`): la procedencia importa para la moderación ya anotada como riesgo (dueños que se auto-tildan todas las vibras) |
| 15 | **`app_settings`** genérica (`key` pk, `value` jsonb): nace con `catalog.confidence_threshold = 0.5` y `pricing.band_limits = [15000, 30000, 60000]` (los cortes de `$..$$$$` también son editables por decisión de producto). Mismo patrón servirá para precios de planes y cupos IA |
| 16 | **Import con DuckDB desde Node** (`scripts/import-overture.ts`): query directa al parquet S3 de Overture con filtro de bbox + categorías, upsert a Postgres vía Drizzle. Mismo método ya probado en la medición de la tanda 3 |
| 17 | **Idempotencia por `overture_id`** (unique): re-correr el import actualiza `confidence`/`operating_status`/contacto y **preserva** `google_place_id`, `publish_override` y las tags con `source != 'import'` |
| 18 | Se guarda `overture_category` (= `taxonomy.primary`) como columna de trazabilidad: permite re-mapear categorías→tags sin volver a S3 |
| 19 | Contacto en **jsonb** (`phones`, `websites`, `socials`, `emails`) tal como vienen de Overture (arrays), sin aplanar: la ficha muestra redes y teléfono, ninguna query filtra por ellos |

### Modelo de datos (schema Drizzle — `lib/db/schema.ts`)

**`places`**

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | uuid pk | `defaultRandom()` |
| `source` | enum `'overture' \| 'owner'` | not null |
| `overture_id` | text **unique**, nullable | clave de idempotencia del import; null si `source='owner'` |
| `google_place_id` | text nullable | único dato de Google persistible; lo llena el spec de Ficha |
| `name` | text not null | |
| `lat` / `lng` | double precision not null | de Overture (dato propio, sin problema de ToS) |
| `address` | text nullable | `addresses[0].freeform` |
| `locality` | text nullable | `addresses[0].locality` |
| `phones` / `websites` / `socials` / `emails` | jsonb nullable | arrays tal como vienen (86% teléfono, 98% redes) |
| `overture_category` | text nullable | `taxonomy.primary`, trazabilidad del mapeo |
| `confidence` | real nullable | null para lugares de dueño |
| `operating_status` | text not null default `'open'` | de Overture |
| `publish_override` | boolean not null default `false` | reclamo aprobado por admin ⇒ true (spec 5) |
| `created_at` / `updated_at` | timestamp | |

Índices: unique en `overture_id` · btree en `confidence` (la query de publicación lo usa
siempre).

**`tags`** — `id` serial pk · `facet` pgEnum(`tipo · cocina · actividad · ambiente · precio ·
momento`) · `parent_id` fk自 nullable · `group_label` text nullable · `name` text ·
`slug` text unique · `sort` int · `active` boolean default true.

**`place_tags`** — pk compuesta (`place_id`, `tag_id`) · `source` text default `'import'`.

**`app_settings`** — `key` text pk · `value` jsonb not null · `updated_at`.

### Regla de visibilidad (helper compartido — la usan búsqueda, ficha y admin)

```
publicado ⇔ operating_status = 'open'
          AND (confidence >= umbral(app_settings) OR publish_override = true)
```

- Para `source='owner'` (confidence null): visible **solo** con `publish_override = true`
  (la aprobación manual es la señal — coherente con el flujo del spec 5).
- El umbral se lee de `app_settings` en runtime: un `UPDATE` cambia el catálogo publicado
  sin redeploy.

### Datos semilla — las tags de las 6 facetas con datos

La enumeración canónica es la de `IDEAS.md` § Taxonomía (validada ítem por ítem con Fer);
acá se fijan los slugs. Seed idempotente por `slug` (`npm run db:seed`).

✅ **Resuelto (2026-07-19):** Fer confirmó que los resúmenes de IDEAS.md tenían la suma mal
(decían 94). El canon son las listas enumeradas: **96 tags** (Cocina 37 hijos · Actividad
19). Los conteos de IDEAS.md ya fueron corregidos.

**Tipo (10):** `restaurante` · `bar` · `cerveceria` · `cafe` · `wine-bar` (Wine bar /
vinoteca) · `boliche` · `patio-gastronomico` (Patio gastronómico / food hall) ·
`teatro-espacio-cultural` · `club-de-juegos` · `centro-entretenimiento`

**Cocina (9 padres filtrables + 37 hijos):**

| Padre (slug) | Hijos (slugs) |
|---|---|
| `argentina` | `parrilla` · `bodegon` · `milanesas` · `empanadas` · `nortena-locro` |
| `italiana` | `pizza` · `pastas` · `trattoria` |
| `asiatica` | `japonesa-sushi` · `ramen` · `china` · `coreana` · `tailandesa` · `vietnamita` |
| `india-medio-oriente` | `india` · `pakistani` · `arabe` · `armenia` · `turca` |
| `latinoamericana` | `peruana` · `mexicana` · `venezolana` · `colombiana` · `boliviana` · `brasilena` |
| `europea` | `espanola-tapas` · `francesa` · `alemana` |
| `americana` | `hamburguesas` · `bbq-costillas` |
| `dulce-y-cafe` | `pasteleria` · `cafe-especialidad` |
| `dietas` | `vegetariana` · `vegana` · `sin-tacc` · `kosher` · `halal` |

Sin `heladeria` ni `panaderia` (excluidas, tanda 5). `pasteleria` se mantiene (la necesita
el chip Merienda).

**Actividad (19, con `group_label`):**

| Grupo | Slugs |
|---|---|
| Escenario | `stand-up` · `musica-en-vivo` · `open-mic` · `teatro` · `pena-folclorica` |
| Baile | `dj` · `milonga-tango` · `salsa-bachata` · `fiesta-tematica` |
| Juegos | `juegos-de-mesa` · `pool-metegol-dardos` · `trivia` · `arcade` · `bowling` · `escape-room` |
| Participar | `karaoke` · `catas-degustaciones` |
| Mirar | `futbol-en-pantalla` · `proyecciones-cine` |

**Ambiente (17, con `group_label`):**

| Grupo | Slugs |
|---|---|
| Vibra | `tranqui` · `movido` · `romantico` · `grupos-grandes` · `aire-libre` · `terraza-rooftop` · `con-vista` · `speakeasy` · `tematico` · `bar-notable` |
| Servicios | `pet-friendly` · `kids-friendly` · `accesible` · `wifi-trabajar` · `estacionamiento` · `reserva-necesaria` · `lgbtq-friendly` |

**Precio (4):** `precio-1` ($) · `precio-2` ($$) · `precio-3` ($$$) · `precio-4` ($$$$).
Los cortes en ARS viven en `app_settings.pricing.band_limits`, no en las tags.

**Momento (9):** `abierto-ahora` · `hasta-tarde` · `abre-domingos` · `desayuno` ·
`almuerzo` · `merienda` · `cena` · `trasnoche` · `happy-hour`.

> Nota de diseño: `abierto-ahora` se siembra como tag (es parte de la taxonomía decidida)
> pero **no puede evaluarse contra `place_tags`** — la app no persiste horarios (prohibido
> por ToS). Su semántica de filtrado se resuelve en el spec de Búsqueda. Las demás tags de
> Momento sí son atributos asignables al lugar.

Total: **105 filas** en `tags` (96 tags + 9 padres de Cocina).

### Import de Overture (`scripts/import-overture.ts` + `npm run import:overture`)

1. **Fuente:** `s3://overturemaps-us-west-2/release/2026-06-17.0/theme=places/type=place`
   vía DuckDB (paquete Node), filtro bbox AMBA en la query parquet.
2. **Selección de categorías** contra `taxonomy.primary`: listas `INCLUDE`/`EXCLUDE` en
   `scripts/overture/categories.ts`. INCLUDE cubre gastronomía (restaurant*, bar*, pub,
   cafe/coffee, brewery, wine bar, night club/boliche, food hall) y actividades del alcance
   (bowling, escape room, karaoke, teatro/artes escénicas, juegos). EXCLUDE explícito:
   `ice_cream_shop` · `bakery` · `dessert_shop`. La lista fina se ajusta en implementación
   contra los datos reales aplicando el principio **"salida vs compra"** — el criterio ya
   está decidido, la lista es su aplicación.
3. **Mapeo categoría→tags semilla** en `scripts/overture/tag-map.ts`
   (ej. `pizza_restaurant` → Tipo `restaurante` + Cocina `pizza`; `wine_bar` → Tipo
   `wine-bar`; `sushi_restaurant` → Tipo `restaurante` + Cocina `japonesa-sushi`). Es
   semilla, no reemplazo de la taxonomía propia: lo que no mapea queda solo con su Tipo, y
   Actividad/Ambiente los completa el dueño o el admin (Overture no tiene esa dimensión).
4. **Upsert por `overture_id`** (decisión 17). Sin transformación destructiva: se guarda
   todo lo que el schema contempla, incluso bajo el umbral.
5. **Reporte final**: total leído del bbox, incluidos/excluidos por categoría, insertados,
   actualizados, distribución de confidence (para contrastar con la medición: ~27.683
   gastronómicos, 71% ≥ 0.5).

### Página `/legales`

Atribución completa (fuente: `https://docs.overturemaps.org/attribution/`):
- Meta · Microsoft · PinMeTo · Krick · RenderSEO · DAC · BrightQuery — **CDLA-Permissive
  2.0** (incluir el texto de la licencia).
- Foursquare — **Apache 2.0** + copyright + referencia a su `NOTICE.txt`
  (`https://opensource.foursquare.com/places-notice-txt/`).
- AllThePlaces — **CC0 1.0**.
- Atribución a Google (los datos en vivo de la ficha), según sus lineamientos — el logo
  sobre datos lo resuelve el spec de Ficha; acá va el texto legal.

Página estática con los tokens del scaffold, linkeable desde el footer.

## Criterios de done (DoD)

- [ ] Migración Drizzle genera y aplica limpio (`drizzle-kit generate` + `migrate`) las
      tablas `places`, `tags`, `place_tags`, `app_settings` y el enum `facet` en el
      Postgres local de Docker
- [ ] `npm run db:seed` carga las **105 filas** de `tags` (con padres, grupos y slugs de
      este spec) + los 2 settings iniciales; correrlo dos veces no duplica ni pisa cambios
      manuales de `active`
- [ ] `npm run import:overture` corre contra la release `2026-06-17.0` y carga el bbox AMBA
      completo con include/exclude aplicado (cero registros `ice_cream_shop`/`bakery`/
      `dessert_shop`) y **sin cortar por confidence** (existen filas con confidence < 0.5)
- [ ] Re-correr el import no duplica filas y preserva `google_place_id`, `publish_override`
      y `place_tags` con `source != 'import'` (test de integración o verificación manual
      documentada)
- [ ] Helper de visibilidad único exportado desde `lib/db` con tests unitarios de los 4
      casos: bajo umbral ⇒ invisible · `publish_override` ⇒ visible aunque no llegue al
      umbral · `operating_status != 'open'` ⇒ invisible **siempre** (aun con override) ·
      `source='owner'` sin override ⇒ invisible
- [ ] El umbral se lee de `app_settings` en runtime: un `UPDATE` del valor cambia el
      conteo de publicados sin rebuild (test)
- [ ] `/legales` renderiza la atribución de las 9 fuentes con sus 3 licencias + Google
- [ ] `npx tsc --noEmit` · `npm test` · `npm run build` verdes

## QA manual (IDs propuestos)

| ID | Caso | Criterio |
|----|------|----------|
| CAT-01 | Seed de taxonomía | `SELECT count(*) FROM tags` = 105; spot-check: `pasteleria` existe, `heladeria` NO existe, `asiatica` es padre de 6 hijos |
| CAT-02 | Volumen del import | Total importado consistente con la medición (~27.683 gastronómicos en el bbox + actividades); reporte del script sin errores |
| CAT-03 | Exclusiones | Cero lugares con `overture_category` en (`ice_cream_shop`, `bakery`, `dessert_shop`) |
| CAT-04 | Calidad de datos | Un lugar conocido de Palermo (elegido en QA) tiene nombre, dirección, teléfono y redes correctos contra la realidad |
| CAT-05 | Umbral en vivo | Con umbral 0.5 anotar el conteo publicado; `UPDATE` a 0.7 y el conteo baja **sin redeploy**; volver a 0.5 lo restaura |
| CAT-06 | Override de reclamo | Poner `publish_override=true` a un lugar con confidence 0.3 ⇒ aparece publicado; marcarle `operating_status='closed'` ⇒ desaparece |
| CAT-07 | Idempotencia | Segundo run del import: mismo `count(*)` de `places`, `google_place_id` de prueba intacto |
| CAT-08 | Atribución | `/legales` muestra las 9 fuentes, las 3 licencias, el NOTICE de Foursquare y la atribución a Google |

## Relación con otros specs

- **Zonas (spec 2)** agrega `zone_id` a `places` por migración y decide PostGIS (el buffer
  de 400 m lo pide). Este spec solo garantiza lat/lng confiables.
- **Búsqueda (spec 3)** consume el helper de visibilidad y las tags; ahí se resuelven los
  chips de Ocasión y la semántica de `abierto-ahora`. ⚠️ Nota heredada: el listado **no
  puede** mostrar rating de Google (no persistible, y pedirlo por card es costo por
  request) — la card de resultados se diseña sabiéndolo.
- **Ficha (spec 4)** llena `google_place_id` (matching) y trae horarios/rating/fotos en
  vivo.
- **Auth/reclamo (spec 5)** opera `publish_override` y crea lugares con `source='owner'`.
