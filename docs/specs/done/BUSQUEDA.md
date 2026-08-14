# Spec: Búsqueda + filtros

**Estado:** ✅ Implementado (2026-07-20) — F1 ✅, F2 ✅ y F3 ✅; QA APROBADO (12/12, BUSQ-QA-09 verificado en vivo)
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

Las 1-11 vienen de `IDEAS.md`; las 12-26 son diseño de este spec; las 27-29 se cerraron **con
el usuario al implementar F2**, sobre huecos que el diseño había dejado abiertos.

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
| 24 | **Faceta Momento visible en v1 sin "Abierto ahora"** (ver Qué NO es); Actividad y Ambiente visibles completas — son el diferencial y crecen con la curaduría. ⚠️ **La decisión 27 pisa el "completas"**: se listan solo los tags con lugares. La intención (que las facetas del diferencial estén a la vista y crezcan con la curaduría) se mantiene; lo que cambia es que no se muestran los tags vacíos |
| 25 | **Un chip que hoy devuelve 0 no se muestra.** El seed siembra los 9 tal cual; la home y el "ver más" listan solo los que tienen resultados con el catálogo actual. No es `active` (eso es curaduría manual): es un conteo. Un chip apagado se prende solo cuando la curaduría o los dueños llenan sus tags — sin deploy, que es lo que la decisión 18 buscaba |
| 26 | **Los 4 chips de la home se recuran contra datos reales antes de sembrarse** (ver § *Medición de cobertura*). El seed de la tabla de abajo es la curaduría *objetivo*, no la que entra en v1: con el catálogo de hoy, 8 de los 9 chips dan cero. La recuración concreta se define al implementar F3, con el usuario, y queda registrada acá |
| 27 | **Un tag con cero lugares publicados no se lista en el sheet de filtros, y una faceta que queda vacía tampoco.** Es la decisión 25 (un chip que da 0 no se muestra) aplicada a las facetas, y por el mismo motivo: ofrecer un filtro que devuelve 0 siempre es mentir. Con el catálogo de hoy borra **Precio entera** (0 filas en `place_tags`) y deja Ambiente en 5 tags y Momento en 2. No es `active` —eso es curaduría manual— sino un conteo: se prende solo cuando la curaduría o los dueños llenen tags, sin deploy. Decidido al implementar F2 (2026-07-20) |
| 28 | **Un deep link con `gps=1` no dispara el permiso al entrar.** Las coordenadas no viajan en la URL (son del dispositivo que mira, no del que compartió el link), así que el primer render no tiene ubicación. Se muestra el toggle **prendido** y un estado que invita a tocarlo. Sostiene la decisión 17 al pie de la letra: el permiso se pide al TOCAR, nunca al entrar — la intención del link es de quien lo compartió, no de quien lo abre. Decidido al implementar F2 (2026-07-20) |
| 29 | **Historial híbrido.** Tocar chips dentro de un sheet no navega; quitar un chip activo o aceptar una sugerencia hace `replace`; **confirmar un sheet con "Ver N lugares" hace `push`**. Resuelve la tensión entre la decisión 12 ("el back del browser funciona solo") y el DoD ("replace, sin romper el back"): el back deshace la última tanda deliberada de filtros en vez de cada toque suelto, y el historial no se inunda. Decidido al implementar F2 (2026-07-20). ⚠️ **ENMENDADA el 2026-08-14 por [`NAVEGACION`](NAVEGACION.md) (decisión 2): el `push` de confirmar un sheet pasa a `replace`.** La medición mostró que incluso una tanda por gesto deja 4 de 5 backs en la misma pantalla de búsqueda, y que prender y apagar un chip apila **dos** entradas para una URL idéntica. Hoy **todo el eje de filtros es `replace`**; la URL sigue siendo el estado y sigue siendo compartible (decisión 12, intacta) |
| 30 | **Se siembran las dos curadurías de chips: los 9 objetivo + 8 chips V1.** Resuelve la decisión 26. Los 9 objetivo entran tal cual (8 dan 0 hoy y la decisión 25 los oculta) para que la intención quede escrita y **se prenda sola** cuando la curaduría llene tags — sin deploy, que era el punto de la decisión 18. Los 8 V1 se construyen solo con tags que hoy tienen datos y son los que hacen que la home tenga chips el día 1. La alternativa —sembrar solo los objetivo— dejaba la home con **un** chip, que se lee como bug cuando en realidad es el dato. Decidido con el usuario al implementar F3 (2026-07-20) |
| 31 | **La home muestra los primeros 4 chips `in_home` _que tengan resultados_**, no los 4 marcados a secas. Es lo que hace convivir la decisión 6 ("4 fijos") con la 25 ("el que da 0 no se muestra") sin que la home quede con huecos. Hay más de 4 marcados a propósito: los objetivo tienen `sort` menor, así que el día que revivan vuelven solos a la home y desplazan a los V1 al "ver más" |
| 32 | **El mapa no trae "el resultado", trae hasta 200 pins con el mismo orden que la lista.** La lista pagina de a 20 —un mapa de AMBA con 20 puntos se ve vacío y el clustering no se activaría nunca— y el resultado entero puede ser 11.438 lugares, o 572 requests contra un endpoint con rate limit. Endpoint propio `GET /api/search/pins`, mismo `where` y mismo orden que la lista, así los pins son el encabezado exacto de los resultados y no una muestra arbitraria. Si hay más, el mapa **lo dice**. El clustering va siempre y no pasado cierto número: 200 pins sobre Palermo son igualmente ilegibles sueltos. Decidido con el usuario al implementar F3 (2026-07-20) |

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

### Ampliación de la medición (2026-07-20, al implementar F3)

Dos correcciones a lo de arriba, medidas contra la base al recurar los chips. **No se
reescribió nada del texto anterior**: se agrega acá con los números crudos, y la decisión de
producto que sale de esto la tomó el usuario (decisión 30).

**1. La correlación tag↔Tipo no es solo de Actividad: es de todas las facetas derivadas.**
El texto de arriba dice "12 de 13 tags de Actividad conviven con exactamente un Tipo". Vale
igual para Ambiente y Momento, que el spec daba por disponibles para recurar:

| Tag | Publicados | Único Tipo con el que convive |
|-----|-----------|-------------------------------|
| `aire-libre` | 99 | **solo** `cerveceria` |
| `wifi-trabajar` | 26 | **solo** `cafe` |
| `desayuno` | 64 | **solo** `restaurante` |
| `merienda` | 47 | **solo** `cafe` |
| `lgbtq-friendly` | 15 | **solo** `bar` |

Las únicas dos excepciones en toda la base son `catas-degustaciones` (bar, cervecería,
wine-bar) y `tematico` (bar, restaurante). La causa es la misma que ya estaba escrita —
`tag-map.ts` deriva los tags de la categoría de Overture— pero el alcance es mayor: **todo
tag que no es de Tipo viene pegado a su Tipo por construcción.** Medido: `cafe + aire-libre`
= 0, `bar + aire-libre` = 0, `restaurante + aire-libre` = 0.

Consecuencia para cualquier curaduría futura: un chip solo puede ser una **unión dentro de
una faceta**, o un Tipo cruzado con **su propio** tag socio. Por eso los chips V1 son
gruesos — es lo único que los datos de hoy sostienen.

**2. El único chip "vivo" lo está por casualidad.** *Salir a bailar* = boliche ∩ (dj ∪
salsa-bachata) = **586**, y `boliche` solo = **586**: los 575 `dj` + 11 `salsa-bachata`
cubren *exactamente* los 586 boliches, así que la faceta Actividad no filtra nada. En los
hechos es un chip de un solo Tipo. El spec lo daba como el caso que funciona; funciona, pero
no por lo que parecía.

### Curaduría V1 de chips (decisión 30, sembrada 2026-07-20)

`lib/db/chips.ts` es la semilla. Los 9 objetivo se siembran sin tocar. Los 8 V1:

| Chip | slug | Home | Tags | AMBA |
|------|------|------|------|------|
| Tomar algo | `tomar-algo` | ✅ | Tipo: bar, cerveceria | 3.219 |
| Cenar afuera | `cenar-afuera` | ✅ | Tipo: restaurante | 11.438 |
| Un café | `un-cafe` | ✅ | Tipo: cafe | 2.058 |
| Música en vivo | `musica-en-vivo` | | Actividad: musica-en-vivo | 882 |
| Teatro y cultura | `teatro-y-cultura` | | Actividad: teatro, stand-up, proyecciones-cine | 595 |
| Catas y vinos | `catas-y-vinos` | | Actividad: catas-degustaciones | 181 |
| Jugar | `jugar` | | Actividad: arcade, bowling, karaoke, escape-room, pool-metegol-dardos | 135 |
| Al aire libre | `al-aire-libre` | | Tipo: cerveceria · Ambiente: aire-libre | 99 |

Con esto la home arranca con **Salir a bailar · Tomar algo · Cenar afuera · Un café** y el
"ver más" lista los otros 5 vivos. Los 8 objetivo apagados no se ven pero están en la base.

Dos cosas anotadas y no resueltas acá: *Cenar afuera* devuelve 11.438 en AMBA, que es
exactamente el riesgo "devuelve 8.000 lugares" de IDEAS — en una zona concreta da 527
(Palermo Soho) / 378 (Olivos) / 262 (Lomas), que es como se usa de verdad, porque la home
pide zona primero (decisión 2). Y tocar un chip sin zona elegida sí dispara una búsqueda de
AMBA entera, paginada de a 20. Ambas van a `BACKLOG.md`.

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
| **F2 — Selectores** | Bottom sheet de zona (autocompletar + regiones + GPS) + sheet de filtros con "Ver N" + chips removibles + sugerencias del campo de texto | Toda búsqueda se puede armar sin tocar la URL | ✅ 2026-07-20 |
| **F3 — Chips + mapa + impresiones** | Seed de los 9 chips + home con 4 + "ver más" + vista mapa MapLibre + logging de impresiones | Home completa como el diseño de arriba | ✅ 2026-07-20 |

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

### F2 — qué quedó construido (2026-07-20)

- **`lib/search/catalog.ts`** — lo que dibujan los selectores: la taxonomía con **conteo de
  lugares publicados por tag** y las 46 zonas con sus alias. No es una copia de
  `lib/db/taxonomy.ts`: ese archivo es la semilla (qué tags existen), esto es el estado de la
  DB (cuáles están activos y cuáles tienen datos hoy).
- **La regla de la decisión 27 vive en una sola función** (`getFacetCatalog`), no en el
  componente. Medido con el catálogo de hoy, lo que queda visible es: Tipo 10 · Cocina 37 ·
  Actividad 13 · Ambiente 5 · Momento 2 · **Precio no aparece**.
- **"Abierto ahora" desaparece solo**, sin caso especial: tiene 0 lugares asignados porque la
  app no persiste horarios, así que la regla de la decisión 27 lo saca por el mismo camino que
  a cualquier otro tag vacío. El ítem del DoD queda satisfecho estructuralmente.
- **`countPlaces`** reusa el constructor de `where` de `searchPlaces` (extraído a
  `construirWhere`). Es deliberado: si el `where` se escribiera dos veces, el N del botón y la
  lista divergirían en cuanto una de las copias cambiara. Los tests comparan el conteo contra
  el resultado real de la misma búsqueda, que es el invariante que hace útil al botón.
- **`GET /api/search/count`** con el mismo rate limit que `/api/search` — se llama en cada
  toque de chip.
- **Los sheets editan un borrador**, no el estado aplicado: nada cambia hasta "Ver N lugares".
  Es lo que permite que el contador anticipe una selección que todavía no pasó (decisión 20).
- **Sugerencias sin roundtrip**: el dropdown matchea contra el catálogo que el server ya mandó
  (105 tags + 46 zonas en memoria). **Divergencia deliberada de la decisión 14**, que pedía
  trgm también para tags y zonas: sobre una lista de ~150 items un trigrama no compra nada que
  el usuario note, y costaría un fetch por tecla. La tolerancia a typos sigue viva donde
  importa —los 26.057 nombres de lugar— con `word_similarity` en `query.ts`. Anotado en
  `BACKLOG.md` por si el catálogo de tags crece un orden de magnitud.
- **`REGION_LABELS`/`REGION_ORDER` viven en `lib/zones/canon.ts`**, no en `catalog.ts`: el
  sheet de zona es un componente cliente e importarlas desde un módulo que toca Postgres
  arrastraba el driver al bundle del browser. Lo cazó `npm run build`, no el typecheck — un
  `import type` se borra, un import de valor no.
- **El modo GPS busca desde el cliente.** Es la única búsqueda que el server component no
  puede hacer: las coordenadas no están en la URL. `ResultsList` tiene por eso dos orígenes
  (sembrado por el server / pedido por API), y no es complejidad de más.

**Pendiente de F2 que se completa en F3**: los chips de Ocasión, la vista mapa y el logging de
impresiones. El "ver más" sin JS de F1 ya no existe: lo reemplazó el infinite scroll.

### F3 — qué quedó construido (2026-07-20)

- **`lib/db/chips.ts`** — la semilla de los 17 chips (9 objetivo + 8 V1, decisión 30), con el
  mismo rol que `taxonomy.ts` para los tags. `scripts/seed.ts` la escribe de forma
  idempotente: un re-run corrige nombre, orden e `in_home`, pero **no toca `active` ni los
  `chip_tags` de un chip que ya existe**. Son las dos cosas que la curaduría edita a mano en
  la base, y todo el sentido de la decisión 18 es que ese ajuste sobreviva sin deploy.
- **El conteo de los chips sale de `countPlaces`, no de una query propia.** Se escribió
  primero la versión "inteligente" —una sola query que contara los 17 de una— y fue **20×
  más lenta**: 7,4 s contra 370 ms, porque el AND-entre-facetas escrito de forma genérica
  obliga a Postgres a correlacionar por lugar. Con `countPlaces` en paralelo son ~90 ms, y
  además desaparece la posibilidad de que el número del chip y lo que devuelve tocarlo
  diverjan: es literalmente la misma función. Mismo razonamiento que llevó a `construirWhere`
  en F2.
- **`clavesDeOrden` se extrajo de `searchPlaces`** por el mismo motivo que `construirWhere`:
  cuando el resultado excede el tope de pins, el mapa tiene que quedarse con **los mismos**
  lugares que encabezan la lista. Si el orden se escribiera dos veces, el mapa mostraría
  otros 200. Hay test que compara pins contra lista, elemento por elemento.
- **`searchPins` + `GET /api/search/pins`** (decisión 32): tope de 200, mismo rate limit que
  el resto. La mini-card del pin reusa `PlaceCard`, `tagsDestacados` y `ubicacionDeCard` — es
  la misma card de la lista, no una segunda versión.
- **La atribución de OSM no la escribe la app**: viene en el TileJSON de OpenFreeMap
  (`OpenFreeMap · © OpenMapTiles · Data from OpenStreetMap`) y MapLibre la muestra. Se
  configura `attributionControl: { compact: false }` para que vaya **siempre desplegada** y
  no detrás del botón "i": es condición de licencia, no un detalle de UI.
- **MapLibre entra por `next/dynamic` con `ssr: false`** — son ~200 KB gzip y la home es una
  lista; el mapa se descarga recién al tocar "Mapa". El `ssr: false` además es necesario:
  MapLibre toca `window` al construirse.
- **La vista (lista/mapa) NO va a la URL.** Es estado de UI, no de búsqueda: un link
  compartido abre en lista, que es el default de la decisión 7.
- **Impresiones en `after()`** (Next 16): la respuesta sale y la escritura ocurre después,
  así el contador no le mete latencia a la pantalla. Lo registran el server component y
  `/api/search` —cada página del scroll cuenta, no solo la primera— y **no** `/api/search/pins`:
  un pin no es una impresión de ficha. La fecha la pone `current_date` de Postgres y no el
  proceso: con el server en UTC y la app en Buenos Aires, dos relojes partirían el día en
  lugares distintos.
- **`registrarImpresiones` nunca tira.** Una impresión perdida no puede voltear la búsqueda
  que la generó. Con test: un id inexistente (FK) se traga y loguea.

**Hueco conocido, no bloqueante**: con `gps=1` y zonas en la URL a la vez, el server renderiza
los resultados por zona (no tiene las coordenadas) y el cliente los reemplaza al obtener
permiso. Esos 20 lugares suman impresión aunque se hayan visto un instante. Es un
sobreconteo chico en un caso de borde de una métrica agregada; anotado en `BACKLOG.md`.

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
- [ ] Vista mapa: pins del resultado actual **hasta el tope de 200, con el orden de la lista**
      (decisión 32), atribución OSM visible, mini-card al tocar; `/legales` actualizado con la
      línea de OpenStreetMap/OpenFreeMap
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
| BUSQ-05 | Texto | "parrila" (typo) y "cafe" sin tilde matchean; el autocompletar matchea **nombre de zona siempre**, y **alias cuando existe** — los 4 alias cargados se verifican uno por uno |

> **Medición para BUSQ-05 (2026-07-20, F2).** El caso "Villa Ortúzar → Chacarita y Colegiales"
> **existe y pasa**: está en `zone_aliases`. Pero `zone_aliases` tiene **4 filas en toda la
> DB** — Villa Ortúzar, Balvanera (→ Once y Abasto), San Nicolás (→ Retiro y Microcentro) y
> Villa Devoto (→ Villa Devoto y Villa del Parque). Verificarlo, entonces, prueba que el
> mecanismo de alias funciona, **no** que el autocompletar por alias sea útil en general: hoy
> cubre 4 barrios de 46 zonas.
>
> **Hallazgo al verificar los 4 uno por uno (F3):** *Villa Devoto* matchea por **nombre**, no
> por alias — la zona se llama "Villa Devoto y Villa del Parque", así que el término llega
> igual sin el alias. Su fila en `zone_aliases` es **redundante**. De los 4 alias cargados,
> **3 agregan capacidad real** (Villa Ortúzar, Balvanera, San Nicolás). El usuario llega a la
> zona en los 4 casos, que es lo que el invariante exige; pero la cobertura efectiva de alias
> es todavía más chica de lo que decía la medición de F2.
>
> **Resuelto (2026-07-20, al implementar F3): el usuario decidió reformularlo como
> invariante**, y así quedó escrito arriba. El criterio ahora mide lo que la implementación
> puede garantizar (el mecanismo, y los 4 alias que existen) en vez de una capacidad que
> depende de cuánta curaduría de alias haya cargada. El hueco de cobertura —42 zonas sin
> alias— se ataca cargando alias y está en `BACKLOG.md`; no es un defecto de Búsqueda.
>
> El criterio original se deja arriba a la vista: **quien implementó no reescribió el DoD para
> que su implementación aprobara** (lección de ZONAS). Se reportó la medición cruda y la
> reformulación la decidió el usuario.
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
