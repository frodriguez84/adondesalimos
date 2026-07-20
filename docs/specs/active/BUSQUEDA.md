# Spec: Búsqueda + filtros

**Estado:** 🟡 En curso — F1 en implementación (2026-07-20). F2 y F3 pendientes
**Prioridad:** Alta — spec 3: es el producto. "La app sirve para decidir a dónde ir según lo que escriba el usuario + una tanda de filtros"
**Gate:** Ninguno
**Bloquea:** Ficha (spec 4, se llega desde los resultados) · Votación (spec 6, arma shortlist desde búsquedas) · Monetización (spec 7, los destacados se insertan en estos resultados)
**Depende de:** CATALOGO (catálogo publicado + tags) · ZONAS (zonas + `place_zones`)

---

## Problema

Con catálogo y zonas cargados no hay forma de usarlos: no existe la pantalla de búsqueda,
que es la app entera para el consumidor. Las decisiones de producto están tomadas (facetas,
chips de Ocasión, zona como default, lista + mapa) pero falta el diseño concreto de la
home/búsqueda — el inventario de pantallas quedó explícitamente sin diseño, y ese diseño
vive acá.

## Objetivo

1. **Home = Search** (`/`): selector de zona + campo de texto + chips de Ocasión + botón
   Filtros + resultados en lista. Pública, sin login, mobile-first, absurdamente intuitiva.
2. **Motor de búsqueda** en Postgres sobre el catálogo publicado: texto (nombre + tags +
   zonas, con typos y sin acentos), filtros por facetas, zonas con multiselección, GPS.
3. **La URL es el estado de la búsqueda** — toda búsqueda es compartible por link.
4. **Chips de Ocasión como datos** (tabla + seed de los 9): combinaciones prearmadas y
   transparentes de filtros.
5. **Vista mapa** ("ver en mapa") con pins del resultado actual.
6. **Impresiones agregadas por lugar desde el día 1** — el histórico es el argumento de
   venta del B2B ("tu ficha apareció en N búsquedas este mes").

## Qué NO es esta feature

- **Ficha del lugar** (spec 4): tocar una card navega a `/lugar/[id]` — acá termina la
  responsabilidad de este spec. Nada de Google en vivo acá.
- **Búsqueda con IA** (chat/wizard): pospuesta hasta monetización, ya decidido.
- **Destacados**: spec 7. El orden de resultados de v1 deja el hueco (3 slots arriba) sin
  rediseño posterior.
- **Filtro "Abierto ahora"**: el tag existe (CATALOGO) pero **no se muestra en v1** — el
  catálogo no tiene horarios (Overture no trae, Google no deja cachear) y ofrecer el filtro
  sería mentir. Se activa cuando exista masa de horarios propios de dueños (spec 5+). Va a
  `BACKLOG.md` como mejora futura.
- **Desglose de "qué filtros te encontraron"** (estadística B2B fina): spec 7. Acá solo el
  contador agregado de impresiones.
- **Reviews, rating propio, favoritos**: fuera, ya decidido.

## Decisiones cerradas

Las 1-11 vienen de `IDEAS.md`; las 12-24 son diseño de este spec.

| # | Decisión |
|---|----------|
| 1 | Home = Search, misma pantalla para todos; sin landing. Búsqueda completa gratis y sin login |
| 2 | Zona es el gesto default; **primera visita: selector vacío ("Elegí zona") y sin resultados hasta elegir**; después, la última zona usada |
| 3 | "Cerca de mí" (GPS) es toggle secundario que **reemplaza** al conjunto entero de zonas elegidas |
| 4 | Multiselección de zonas libre; el filtro usa `place_zones` (polígono expandido 400 m, ya materializado en ZONAS) |
| 5 | El campo de texto matchea nombres y **tags de cualquier faceta** ("parrilla" trae `Cocina: Parrilla`); la distinción Tipo/Cocina es interna |
| 6 | Chips de Ocasión: 4 fijos en la home (**Salida con amigos · Salida con chongo · Salir a bailar · After office**), los otros 5 detrás de "ver más". Son combinaciones prearmadas de las otras facetas |
| 7 | Resultados: **lista default + botón "ver en mapa"**. Cards sin foto de Google y sin rating de Google (no persistibles); foto de dueño sí cuando exista (spec 5) |
| 8 | Las 6 facetas viven detrás de un botón "Filtros" — siete filtros a la vista en un celular es lo opuesto a intuitivo (propuesta de IDEAS que este spec cierra como diseño) |
| 9 | UI del selector de zona: buscador con autocompletar + 4 regiones desplegables; matchea alias (tabla de ZONAS). Mapa tocable descartado |
| 10 | Tono del copy: canchero rioplatense, cero emojis |
| 11 | Rate limit en endpoints públicos (regla global de seguridad) |
| 12 | **La URL es el estado**: `/?z=palermo-soho,villa-crespo&t=bar,juegos-de-mesa&q=texto&gps=1`. Server component lee searchParams y consulta; toda búsqueda es un deep link compartible (coherente con el loop viral de la votación) y el back del browser funciona solo |
| 13 | **Semántica de filtros: OR dentro de una faceta, AND entre facetas.** Zonas = OR. Cocina padre = OR de sus hijos (y del padre mismo, por si el import asignó el genérico). Implementación: un `EXISTS` por faceta activa sobre `place_tags` |
| 14 | **Texto con `unaccent` + `pg_trgm`** (extensiones vanilla, disponibles en Neon y Docker): similitud sobre nombre de lugar, nombre de tag y nombre/alias de zona. Tolera "cafe" vs "café" y typos razonables |
| 15 | **Comportamiento del campo de texto**: mientras tipeás, dropdown de sugerencias en dos grupos — **Filtros** (tags que matchean; tocar uno lo aplica como filtro visible) y **Zonas** (si matchea nombre/alias). Enter sin elegir = busca por nombre de lugar con el texto tal cual. Nunca un "modo búsqueda" opaco: lo que se aplica se ve como chip removible |
| 16 | **Orden orgánico v1** (sin rating propio ni de Google ni datos de uso): lugares reclamados/de dueño primero (mejor dato), luego `confidence` desc, luego nombre. Con texto: similitud primero. Con GPS: distancia. Determinístico y explicable; los 3 slots de destacados (spec 7) se insertan arriba sin tocar esto |
| 17 | **GPS: radio fijo 2 km**, sin slider (menos fricción); Haversine en SQL sobre lat/lng con pre-filtro por bounding box — sin PostGIS, consistente con ZONAS. El permiso se pide recién al tocar el toggle, nunca al entrar (ya decidido) |
| 18 | **Chips de Ocasión en DB** (`occasion_chips` + `chip_tags`), no hardcodeados: son curaduría y se ajustan sin deploy — mismo patrón que umbral/precios/cupos. Seed inicial en este spec; tocar un chip **aplica sus filtros a la vista** (chips removibles) — el usuario ve qué activó y aprende el sistema |
| 19 | **Paginación por cursor + infinite scroll** (mobile-first); página de 20 |
| 20 | **El sheet de filtros muestra "Ver N lugares"** con el conteo en vivo (1 query de count) — evita el "0 resultados" sorpresa, que con Actividad/Ambiente/Momento ralas al inicio (el import de Overture casi no las llena; las llena la curaduría y los dueños) sería frecuente |
| 21 | **Mapa: MapLibre GL JS + tiles de OpenFreeMap** (gratis, sin API key, uso comercial permitido). Pins de lat/lng propios (Overture — cero costo). Atribución OSM visible en el mapa + línea en `/legales`. Clustering nativo si el resultado supera ~200 pins. **Los polígonos de zona no se dibujan** (el mapa responde "qué hay acá", no "dónde está la zona") |
| 22 | **Impresiones agregadas por día** (`place_impressions_daily`: place_id, fecha, contador): se registra en batch al servir resultados. Es lo mínimo que no se puede reconstruir después y habilita el teaser B2B ya decidido. Sin datos por usuario, sin cookies — solo conteo |
| 23 | **0 resultados con filtros activos**: mensaje canchero + los chips activos a mano para sacar + sugerencia de aflojar el que más restringe. Nunca una pantalla muerta |
| 24 | **Faceta Momento visible en v1 sin "Abierto ahora"** (ver Qué NO es); Actividad y Ambiente visibles completas — son el diferencial y crecen con la curaduría |
| 25 | **Un chip que hoy devuelve 0 no se muestra.** El seed siembra los 9 tal cual; la home y el "ver más" listan solo los que tienen resultados con el catálogo actual. No es `active` (eso es curaduría manual): es un conteo. Un chip apagado se prende solo cuando la curaduría o los dueños llenan sus tags — sin deploy, que es lo que la decisión 18 buscaba |
| 26 | **Los 4 chips de la home se recuran contra datos reales antes de sembrarse** (ver § *Medición de cobertura*). El seed de la tabla de abajo es la curaduría *objetivo*, no la que entra en v1: con el catálogo de hoy, 8 de los 9 chips dan cero. La recuración concreta se define al implementar F3, con el usuario, y queda registrada acá |

### Diseño de la pantalla (mobile-first)

```
┌──────────────────────────────┐
│ ¿A dónde salimos?            │  wordmark chico, arriba
│ [📍 Palermo Soho +1      ∨ ] │  selector de zona (bottom sheet al tocar)
│ [🔍 Buscá lugares o tags   ] │  SearchInput con dropdown de sugerencias
│ (Amigos)(Chongo)(Bailar)(AO) │  4 chips de Ocasión + "ver más"
│ [Filtros (2)]     [Mapa]     │  botón filtros con contador · toggle vista
│ ─ chips activos removibles ─ │  ej. (Bar ×)(Juegos de mesa ×)
│ ┌──────────────────────────┐ │
│ │ PlaceCard                │ │  lista infinita, cards del scaffold
│ │ PlaceCard                │ │
└──────────────────────────────┘
```

- **Selector de zona** (BottomSheet del scaffold): buscador arriba (autocompletar sobre
  nombre + alias), 4 regiones desplegables abajo, zonas como chips multiseleccionables,
  toggle "Cerca de mí" que desactiva visualmente las zonas al encenderse. Botón "Ver N
  lugares" cierra y aplica.
- **Sheet de filtros** (BottomSheet): las 6 facetas en acordeón — Tipo (chips) · Cocina
  (padres expandibles, tocar el padre selecciona el grupo) · Actividad y Ambiente (chips
  agrupados por `group_label`) · Precio ($ $$ $$$ $$$$) · Momento. "Limpiar todo" + "Ver N
  lugares".
- **Card** (PlaceCard del scaffold): nombre · tags distintivos (Tipo + hasta 2 de
  Actividad/Cocina) · zona primaria · banda de precio si la tiene · foto solo si es de
  dueño (spec 5). Tocar → `/lugar/[id]` (spec 4).
- **Vista mapa**: mismo estado de búsqueda, pins del resultado; tocar pin → mini-card
  flotante con nombre/tags/zona y acceso a la ficha. Botón "Lista" vuelve.

### Modelo de datos (migración sobre CATALOGO + ZONAS)

**`occasion_chips`** — `id` serial pk · `name` text ("Salida con chongo") · `slug` unique ·
`in_home` boolean (los 4 decididos) · `sort` int · `active` boolean.

**`chip_tags`** — pk (`chip_id`, `tag_id`).

**`place_impressions_daily`** — pk (`place_id`, `date`) · `impressions` int. Upsert
`ON CONFLICT ... SET impressions = impressions + N`.

Extensiones: `CREATE EXTENSION IF NOT EXISTS unaccent, pg_trgm` (migración). Índices trgm
sobre `places.name`; los de tags/zonas son tablas chicas, no hace falta.

### Seed de los 9 chips (curaduría inicial — editable en DB sin deploy)

| Chip | slug | Home | Filtros (tags) |
|------|------|------|----------------|
| Salida con amigos | `salida-con-amigos` | ✅ | Tipo: bar, cerveceria · Ambiente: grupos-grandes · Precio: precio-2 |
| Salida con chongo | `salida-con-chongo` | ✅ | Tipo: bar, wine-bar · Ambiente: romantico · Momento: hasta-tarde |
| Salir a bailar | `salir-a-bailar` | ✅ | Tipo: boliche · Actividad: dj, fiesta-tematica, salsa-bachata |
| After office | `after-office` | ✅ | Tipo: bar, cerveceria · Momento: happy-hour |
| Primera cita | `primera-cita` | | Tipo: bar, cafe, restaurante · Ambiente: tranqui, romantico · Precio: precio-2 |
| Cumpleaños | `cumpleanos` | | Tipo: bar, restaurante, patio-gastronomico · Ambiente: grupos-grandes, reserva-necesaria |
| Cena familiar | `cena-familiar` | | Tipo: restaurante · Cocina: bodegon · Ambiente: kids-friendly · Momento: cena |
| Plan tranqui | `plan-tranqui` | | Tipo: cafe, bar · Ambiente: tranqui · Actividad: juegos-de-mesa |
| Merienda | `merienda` | | Tipo: cafe · Momento: merienda · Cocina: pasteleria (la combinación ya decidida en IDEAS) |

> ⚠️ **Esta tabla es la curaduría objetivo, no la de v1.** Ver decisión 26 y la medición de
> abajo: con el catálogo de hoy, 8 de estos 9 chips devuelven cero resultados.

### Medición de cobertura (2026-07-20, sondeo previo a implementar — 18.993 publicados)

Cobertura de tags **sobre lugares publicados**, medida contra la base, no estimada:

| Faceta | Publicados con algún tag | % |
|--------|--------------------------|---|
| Tipo | 18.993 | 100% |
| Cocina | 7.156 | 37,7% |
| Actividad | 2.390 | 12,6% |
| Ambiente | 164 | 0,9% |
| Momento | 111 | 0,6% |
| **Precio** | **0** | **0%** |

**`place_tags` no tiene ni una fila de faceta Precio.** Los 4 tags existen; no los usa nadie.
No es un bug del import: Overture no trae precio y `places` no tiene columna de la que
derivarlo. Google sí tiene `price_level`, pero es dato de Google — mostrable en vivo en la
ficha (spec 4), **no persistible ni filtrable** (ToS). Precio se llena solo con curaduría o
dueños (spec 5). Anotado en `BACKLOG.md`.

Los 23 slugs del seed de chips **existen todos** en la taxonomía (ninguno inventado), pero 13
tienen cero lugares publicados: `precio-2`, `grupos-grandes`, `romantico`, `tranqui`,
`kids-friendly`, `reserva-necesaria`, `hasta-tarde`, `happy-hour`, `cena`, `bodegon`,
`pasteleria`, `juegos-de-mesa`, `fiesta-tematica`. Con la semántica AND-entre-facetas de la
decisión 13, eso apaga 8 de los 9 chips — incluidos 3 de los 4 de la home. El único vivo es
*Salir a bailar* (boliche ∩ (dj 575 ∪ salsa-bachata 11)).

**Los tags de Actividad están pegados a un solo Tipo.** 12 de los 13 tags de Actividad con
datos conviven con **exactamente un** tag de Tipo: `musica-en-vivo`, `teatro`, `stand-up` y
`proyecciones-cine` solo aparecen en `teatro-espacio-cultural`; `dj` y `salsa-bachata` solo en
`boliche`; `arcade`, `bowling` y `karaoke` solo en `centro-entretenimiento`. La única excepción
es `catas-degustaciones` (bar, cervecería, wine-bar).

Es consecuencia estructural del import: `scripts/overture/tag-map.ts` mapea cada categoría de
Overture a un Tipo **y** una Actividad, así que la correlación es perfecta por construcción.
Consecuencia práctica: **cualquier filtro que cruce Tipo con una Actividad que no sea la del
par original devuelve cero.** "Bar + música en vivo" en Palermo Soho da 0 y no es un bug del
motor — verificado: hay 235 bares y 29 lugares con música en vivo en esa zona, y ningún lugar
tiene los dos tags. Vale tanto para la recuración de chips (decisión 26) como para el sheet de
filtros de F2.

Tags **con** datos disponibles para recurar (publicados): Tipo — restaurante 11.438, bar
2.671, cafe 2.058, boliche 586, cerveceria 548, wine-bar 135. Actividad — musica-en-vivo 882,
dj 575, teatro 431, catas-degustaciones 181, proyecciones-cine 151, arcade 66. Ambiente —
aire-libre 99, wifi-trabajar 26, tematico 20. Momento — desayuno 64, merienda 47.

Notas de la curaduría: *Primera cita* vs *Chongo* implementa la lectura acordada (cita =
tranqui + se puede hablar; chongo = hasta tarde, sin tranqui). *Salida con amigos* es
específico a propósito (el riesgo "devuelve 8.000 lugares" está anotado en IDEAS) — el
ejemplo "bares + cervecerías + $$ + para grupos" es de IDEAS. Dentro del chip aplica la
misma semántica OR-dentro / AND-entre facetas.

### Motor (server)

- Server component en `/` lee searchParams → query única con: helper de visibilidad
  (CATALOGO) + `EXISTS` por faceta + `zone_id IN` vía `place_zones` (o Haversine si GPS) +
  similitud trgm si hay `q` + orden de la decisión 16 + cursor.
- Route handler `GET /api/search` para el infinite scroll y la vista mapa (mismos params,
  misma función de query). **Rate limit por IP** (patrón StressPlan).
- El batch de impresiones se dispara tras servir la página de resultados (los 20 mostrados,
  no todo el resultado).

## Fases

| Fase | Alcance | Cierre verificable | Estado |
|------|---------|--------------------|--------|
| **F1 — Motor + lista** | Migración (chips, impresiones, extensiones) + query + `/` con searchParams + cards + paginación + rate limit | Buscar por URL directa funciona end-to-end con datos reales del import | ✅ 2026-07-20 |
| **F2 — Selectores** | Bottom sheet de zona (autocompletar + regiones + GPS) + sheet de filtros con "Ver N" + chips removibles + sugerencias del campo de texto | Toda búsqueda se puede armar sin tocar la URL | ⬜ |
| **F3 — Chips + mapa + impresiones** | Seed de los 9 chips + home con 4 + "ver más" + vista mapa MapLibre + logging de impresiones | Home completa como el diseño de arriba | ⬜ |

### F1 — qué quedó construido (2026-07-20)

- **Migración** `drizzle/0002_last_christian_walker.sql`: las 3 tablas + `unaccent` + `pg_trgm`
  + índice GIN trgm. Las tablas de chips e impresiones se crean acá y **las usa F3**.
- **`immutable_unaccent(text)`**: `unaccent()` se declara STABLE y Postgres no acepta STABLE en
  un índice. El wrapper fija el diccionario y la vuelve IMMUTABLE. **La query tiene que filtrar
  por `immutable_unaccent(lower(name))`** para pegarle al índice; si no, es seq scan sobre 26.057.
- **Texto: `word_similarity` (`<%`), no `similarity` (`%`).** `similarity` compara strings
  enteros y se cae con nombres largos. Medido con "parrila": 877 matches contra 611, y usa el
  mismo índice. Es lo que hace que el typo entre "Parrila El Juanca".
- **`lib/search/params.ts`** — URL ↔ estado, puro y testeado en los dos sentidos. Las
  coordenadas del GPS **no viajan en la URL**: son del dispositivo que mira, no del que
  compartió el link. Solo van como `lat`/`lng` a `/api/search`.
- **`lib/search/query.ts`** — el motor. Cursor keyset con `id` como último criterio siempre,
  para que el orden sea total y la paginación no repita ni saltee en los empates.
- **Rate limit** (`lib/middleware/`): `getClientIp` portado de StressPlan sin cambios;
  el contador **diverge** a memoria del proceso en vez de la tabla `rate_limit_logs`, porque
  `/api/search` es de lectura y se llama en cada scroll. Motivo y límites, en el archivo.
- **`fileParallelism: false` en vitest**: los fixtures de zona de este spec rompían el
  invariante "hay 46 zonas" de ZONAS al correr en paralelo contra la misma base.
- **La card perdió el prop `rating`** del scaffold: no hay fuente legal que lo llene
  (decisión 7 + ToS de Google). Y `location` es nullable — los 1.890 sin zona primaria.

**Pendiente de F1 que se completa en F2** (no son huecos, son la fase siguiente): el selector de
zona y el sheet de filtros; las sugerencias del campo de texto; el infinite scroll (hoy hay un
"Ver más" sin JS que ejerce el mismo cursor); los chips removibles del estado de 0 resultados.

## Criterios de done (DoD)

- [ ] Migración: `occasion_chips`, `chip_tags`, `place_impressions_daily`, extensiones
      `unaccent` + `pg_trgm`, índice trgm en `places.name`
- [ ] `/` sin zona elegida (primera visita): selector "Elegí zona", cero resultados, sin
      pedir GPS; elegir zona dispara la primera búsqueda
- [ ] Semántica verificada por tests de la query: OR dentro de faceta, AND entre facetas,
      padre de Cocina expande hijos, multiselección de zonas, GPS reemplaza zonas
      (Haversine 2 km), visibilidad de CATALOGO respetada siempre
- [ ] Texto: "parrilla" sugiere el tag y lo aplica como chip; "cafe" (sin tilde) matchea
      "Café"; "Villa Ortúzar" sugiere la zona Chacarita y Colegiales; Enter busca por
      nombre
- [ ] URL ↔ estado bidireccional: cargar un deep link reproduce exactamente la búsqueda;
      cambiar filtros actualiza la URL (replace, sin romper el back)
- [ ] Orden estable de la decisión 16 con test (dueño > confidence > nombre; con `q`,
      similitud primero)
- [ ] Los 9 chips sembrados en DB con sus tags; tocar un chip aplica sus filtros como chips
      removibles; editarlo en DB cambia el comportamiento sin deploy. **Un chip que devuelve
      0 no se lista** (decisión 25). El DoD NO exige que los 9 devuelvan resultados: con el
      catálogo actual eso es falso y depende de curaduría, no de esta implementación
- [ ] "Abierto ahora" NO aparece en el sheet de filtros (y quedó en BACKLOG como futura)
- [ ] Vista mapa: pins del resultado actual, atribución OSM visible, mini-card al tocar;
      `/legales` actualizado con la línea de OpenStreetMap/OpenFreeMap
- [ ] Impresiones: tras una búsqueda, los lugares mostrados suman +1 en su fila del día
- [ ] Rate limit activo en `/api/search` con test
- [ ] `npx tsc --noEmit` · `npm test` · `npm run build` verdes

## QA manual (IDs propuestos)

| ID | Caso | Criterio |
|----|------|----------|
| BUSQ-01 | Primera visita | Selector vacío, cero resultados, NO pide permiso de GPS |
| BUSQ-02 | Búsqueda base | Zona Palermo Soho + Tipo Bar devuelve bares publicados de esa zona (spot-check contra la realidad) |
| BUSQ-03 | Semántica | Bar + Cerveceria (OR) amplía; agregar Juegos de mesa (AND) achica; quitar chips restaura |
| BUSQ-04 | Cocina padre | "Asiática" ⊇ resultados de "Japonesa / sushi" |
| BUSQ-05 | Texto | "parrila" (typo) y "cafe" sin tilde matchean; "Villa Ortúzar" lleva a Chacarita |
| BUSQ-06 | Borde de zona | El lugar del test ZON-02 aparece buscando Villa Crespo y buscando Palermo Soho |
| BUSQ-07 | GPS | Activar "cerca de mí" con zonas elegidas: las zonas se apagan; resultados a ≤2 km |
| BUSQ-08 | Chips | Tocar un chip listado aplica sus tags como chips removibles visibles; "ver más" muestra los chips no-home que tengan resultados. Un chip con 0 no aparece (decisión 25) |
| BUSQ-09 | Deep link | Compartir la URL de una búsqueda armada la reproduce idéntica en otro dispositivo |
| BUSQ-10 | Mapa | "Ver en mapa" muestra los pins del mismo resultado; atribución OSM visible |
| BUSQ-11 | Vacío | Filtros que dan 0: mensaje + chips removibles, nunca pantalla muerta; "Ver N" del sheet anticipó el número |
| BUSQ-12 | Impresiones | `SELECT` de `place_impressions_daily` crece tras buscar; no hay datos por usuario |

## Relación con otros specs

- **CATALOGO**: usa el helper de visibilidad tal cual (única puerta al catálogo publicado).
- **ZONAS**: usa `zones`/`zone_aliases` para el selector y `place_zones` para filtrar; el
  matching por partes del nombre ("Banfield") se resuelve acá con trgm sobre el nombre.
- **Ficha (spec 4)**: recibe la navegación desde card y mini-card del mapa.
- **Auth/reclamo (spec 5)**: las fotos de dueño empiezan a aparecer en las cards sin
  cambios acá (la card ya contempla el slot).
- **Monetización (spec 7)**: inserta hasta 3 destacados arriba del orden orgánico y
  consume `place_impressions_daily` (y ahí se agrega el desglose "qué filtros").
- **Mejora futura (BACKLOG)**: "Abierto ahora" cuando haya horarios de dueños; rotación de
  chips por día/hora (ya anotada).
