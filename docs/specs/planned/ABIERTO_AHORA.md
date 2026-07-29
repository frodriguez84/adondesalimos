# Spec: ABIERTO_AHORA — el chip «Para ahora» (y el camino al abierto de verdad)

**Estado:** 🔵 Planned — en diseño
**Prioridad:** Alta — #2 del orden de momentum de v2 (IDEAS § Estado de la conversación,
2026-07-27), primero de los que necesitan spec. El que abre la app a las 23:30 no quiere ver la
cafetería que cerró a las 19, y hoy la app no tiene forma de sacársela de encima.
**Gate:** **F1: ninguno.** **F2: gateada** en tener masa de horarios propios de dueño —
al 2026-07-29 hay **1** lugar con `place_owner_content.opening_hours` cargado (ver decisión 11).
**Bloquea:** nada.
**Depende de:** BUSQUEDA (chips de Ocasión, motor, decisiones 12/13/18/25), CURADURIA (los tags
de Momento son la materia prima de F1), AUTH F4 (`lib/negocio/horarios.ts` — horarios propios y
`estaAbierto`, la materia prima de F2), CATALOGO (la taxonomía que trae `abierto-ahora`).

---

## Problema

Tres cosas que hoy están mal a la vez:

1. **El tag `abierto-ahora` miente por construcción.** Nació en la taxonomía de CATALOGO y
   BUSQUEDA lo dejó fuera de v1 con el motivo correcto ("el catálogo no tiene horarios"). Pero la
   corrida de CURADURIA F3 se lo asignó a **20 lugares publicados** (`place_tags source='admin'`):
   un booleano **estático** para un concepto que **depende de la hora en que uno mira**. Filtrar
   por él a las 4 de la mañana devuelve 20 lugares "abiertos" que nadie verificó. No es un tag
   incompleto — es un tag que no puede ser correcto nunca.
2. **La necesidad real no está atendida.** No hay ningún gesto en la app que diga "esto no me
   sirve a esta hora". El único filtro temporal disponible son los tags de Momento sueltos en el
   sheet, que el usuario tiene que elegir a mano sabiendo que existen.
3. **La fuente exacta no está disponible.** Overture no trae horarios; Google los trae pero **no
   se pueden persistir** (ToS, disciplina de costos de FICHA) y consultarlos en la búsqueda
   costaría ~**US$0,64 por página de 20** (Place Details, no cacheable). Los horarios propios de
   dueño —la única fuente persistible y gratis— existen desde AUTH F4 pero todavía no tienen masa.

## Objetivo

Un chip que, **a costo cero y sin mentir**, achique el resultado a lo que sirve **a esta hora**,
y que el día que haya horarios propios de dueños se vuelva **exacto sin rediseñar nada**.

## Qué NO es esta feature

- **F1 no promete "abierto".** Promete "a esta hora". El copy es parte del contrato, no
  decoración (decisión 2).
- **No consulta Google.** Ni en la búsqueda ni para precalentar nada. Medido arriba: rompería la
  disciplina de costos de FICHA por dos lados (gasto por página + no cacheable).
- **No persiste horarios de ninguna fuente externa.** La única fuente persistible sigue siendo el
  dueño (`place_owner_content.opening_hours`).
- **No agrega parámetros a la URL ni toca el motor de búsqueda.** El chip escribe tags normales
  (decisión 5). `lib/search/query.ts` no se modifica en F1.
- **No toca `operating_status`.** El hallazgo H-2 (Overture lo entrega NULL en todo AMBA → todos
  `'open'`) sigue abierto y es otro problema.
- **No exige "franja Y abre-domingos"** — es imposible con la semántica vigente (decisión 6).

## Evidencia medida

Postgres de dev, 2026-07-29, umbral de confidence 0.5 → **18.993 publicados**. Los conteos son
de **lugares publicados con el tag**, en todo AMBA (en una zona concreta son uno o dos órdenes
menos, que es como se usan de verdad):

| Tag de Momento | Publicados | | Fuente exacta | Lugares |
|---|---|---|---|---|
| `cena` | 670 | | `place_owner_content.opening_hours` no nulo | **1** |
| `almuerzo` | 605 | | `places.google_place_id` persistido | 20 |
| `desayuno` | 272 | | Costo de Google en búsqueda | ~US$0,64 / página de 20 |
| `merienda` | 251 | | | |
| `happy-hour` | 189 | | **Tag a retirar** | |
| `abre-domingos` | 183 | | `abierto-ahora` (`source='admin'`) | 20 |
| `hasta-tarde` | 173 | | | |
| `trasnoche` | 44 | | | |
| `trasnoche` ∪ `hasta-tarde` | **176** | | | |

Lectura: la curaduría dejó las franjas de comida con volumen usable (250-670) y la madrugada
flaca pero viva (176). La fuente exacta está en 1.

## Decisiones cerradas

| # | Decisión |
|---|----------|
| 1 | **Dos fases, y solo la F1 se implementa ahora.** F1 = franja horaria sobre tags curados (sirve hoy, costo $0). F2 = abierto **real** desde horarios de dueño (exacto, hoy devolvería 1 lugar). Se escriben las dos juntas porque la forma de F1 se elige para que F2 encastre sin rediseño; se implementan por separado. **Decidido por Fer, 2026-07-29** (alternativas evaluadas: solo-real, que nacería invisible; e híbrido completo de una, que cuesta el doble para ganar 1 lugar de precisión). |
| 2 | **El copy es el contrato: el chip se llama «Para ahora».** Nunca "Abierto ahora", "Abierto" ni "Abierto hasta tarde" mientras la fuente sea la franja. La promesa es *lo que suele servir a esta hora*, no *lo que está abierto*. Si el copy se afloja, la feature pasa a mentir y esta decisión es la que hay que citar para frenarlo. |
| 3 | **La franja se resuelve con una tabla fija en TZ `America/Argentina/Buenos_Aires`**, la misma zona horaria fija que ya usa la ficha (AUTH decisión 20): el chip no depende del reloj de quien mira. Franjas (cubren las 24 h, sin huecos ni solapamientos): <br>· `06:00–10:59` → `desayuno` (272) <br>· `11:00–15:29` → `almuerzo` (605) <br>· `15:30–19:59` → `merienda` (251) <br>· `20:00–23:59` → `cena` (670) <br>· `00:00–05:59` → `trasnoche` + `hasta-tarde` (176) |
| 4 | **Dueño único de la regla: `lib/search/ahora.ts`** (nuevo). Expone la tabla de franjas y `franjaActual(now: Date)`. Nadie más calcula "qué franja es". Reusa `partesEnAR` de `lib/negocio/horarios.ts` — el cómputo de día/hora en AR ya tiene dueño y no se reimplementa. |
| 5 | **El chip se inyecta al frente de `OccasionChips.home`**, con la forma que ya tiene un chip (`{slug, name, tags, count}`). Consecuencia buscada: **cero cambios** en `components/search/occasion-chips.tsx` (que ya renderiza `chip.tags` de forma genérica), en `lib/search/params.ts` y en `lib/search/query.ts`. Tocarlo escribe `?t=cena` en la URL como cualquier otro chip. |
| 6 | **La URL guarda los tags resueltos, no "ahora".** Un link compartido a las 21 h dice `t=cena` para siempre: significa lo mismo mañana, es honesto y no requiere param nuevo (decisión 12 de BUSQUEDA: la URL es el estado). El "ahora" vive en el chip, no en el resultado. |
| 7 | **El domingo NO se suma `abre-domingos`.** Los dos tags están en la faceta Momento y el motor hace **OR dentro de faceta** (decisión 13): `cena, abre-domingos` devolvería *cena **o** abre-domingos* — **ensancharía** el resultado en vez de achicarlo. Es exactamente la trampa AND/OR que causó el sobre-filtrado del chat (CHAT_IA, 2026-07-26). Exigir "franja **y** abre domingos" requiere partir Momento en dos facetas o un filtro dedicado → v2. |
| 8 | **En la madrugada el OR sí es lo que se quiere**, y por eso la franja `00:00–05:59` lleva los dos tags: "abierto de madrugada" es `trasnoche` **o** `hasta-tarde` (176 lugares, contra 44 de `trasnoche` solo). Es una unión dentro de una faceta, el único tipo de chip que los datos sostienen bien (ver `lib/db/chips.ts`). |
| 9 | **Un chip que da 0 no se muestra** — se reusa la decisión 25 de BUSQUEDA vía `countPlaces`, igual que los chips de Ocasión, y por el mismo motivo (ofrecer un atajo que devuelve 0 es mentir). El conteo es global, no de la búsqueda en curso. |
| 10 | **Se retira `abierto-ahora`: `UPDATE tags SET active = false WHERE slug = 'abierto-ahora'`.** Es la palanca correcta y es **reversible**: (a) el seed no pisa `active` —es curaduría, ver `scripts/seed.ts`—; (b) `filtrosDeTags` ya ignora tags inactivos ("un link viejo con un tag retirado sigue funcionando"); (c) `getFacetCatalog` y `tagsDeLugares` filtran por `active = true`, así que desaparece del sheet y de las cards; (d) las **20 filas de `place_tags` no se borran** (ocultar ≠ borrar, mismo criterio que el contenido de dueño). Se documenta el UPDATE y se agrega el comentario en `lib/db/taxonomy.ts` explicando por qué el tag existe sembrado pero inactivo. |
| 11 | **Gate de F2, explícito y verificable: ≥ 50 lugares publicados con horarios propios cargados.** Hoy: 1. Por debajo de eso el filtro exacto es peor que el de franja (achica a casi nada y castiga justo a los lugares sin dueño), y la decisión 25 lo escondería igual. La consulta que decide el gate: `select count(*) from place_owner_content oc join places p on p.id = oc.place_id where oc.opening_hours is not null` cruzado con `publishedWhere`. |
| 12 | **F2 no reimplementa `estaAbierto` en SQL.** La regla de horarios tiene dueño (`lib/negocio/horarios.ts`) y una segunda copia en SQL driftearía (§ *Una regla, un dueño*). El camino: extraer de `estaAbierto` una función `expandirRangos(HorariosSemana)` que devuelva los rangos normalizados a minutos-de-semana (los que cruzan medianoche se parten en dos), hacer que **`estaAbierto` se derive de esa misma expansión** (mismo resultado, tests existentes como red) y materializarla en una tabla derivada `place_open_ranges(place_id, dow, desde_min, hasta_min)` que se reescribe **solo** desde `guardarHorarios` (`lib/negocio/acciones.ts`), el único lugar que ya escribe horarios. La búsqueda filtra con un `EXISTS` sobre esa tabla; la ficha sigue usando `estaAbierto`. Una regla, dos proyecciones. |
| 13 | **En F2 el chip cambia de nombre a «Abierto ahora» solo si el filtro pasa a ser exacto para todos.** Mientras conviva con lugares sin horarios, la decisión de scope (exacto puro vs híbrido franja+exacto, con badge "según horarios del local" en las cards que lo tienen) se toma **al abrir F2**, con la cobertura real de ese momento a la vista. No se pre-decide acá: es una puerta de ida y vuelta y hoy faltan datos para elegir bien. |

## Implementación (F1)

Archivos, en orden:

1. **`lib/search/ahora.ts`** (nuevo, ~40 líneas) — `FRANJAS` (tabla de la decisión 3) +
   `franjaActual(now: Date): { slug, name, tags }`. Puro, sin DB ni React: se testea con una
   tabla de horas, igual que `lib/negocio/horarios.ts`.
2. **`lib/search/chips.ts`** — `getOccasionChips()` acepta un `now` opcional (default
   `new Date()`, para poder testear) y antepone el chip de `franjaActual` a `home` si su
   `countPlaces` da > 0. El chip **no** es fila de `occasion_chips`: sus tags dependen de la hora
   y `chip_tags` es estática.
3. **UPDATE de la decisión 10** + comentario en `lib/db/taxonomy.ts`.
4. **Tests**: `ahora.test.ts` (una hora por franja + los cuatro bordes + medianoche) y un caso en
   los tests de chips (el chip va primero y desaparece cuando su franja da 0).

No hay migración, no hay endpoint nuevo, no hay cambio de UI cliente.

## Criterios de done (DoD)

**F1 — chip «Para ahora»**

- [ ] `lib/search/ahora.ts` existe y es el **único** módulo que mapea hora → tags; nadie más
      calcula la franja (verificable por `grep`).
- [ ] `franjaActual` cubre las 24 h sin huecos ni solapamientos, en TZ AR, y es puro respecto de
      `now` (test con `Date` fijo, sin depender del reloj de la máquina).
- [ ] La madrugada (`00:00–05:59`) devuelve **los dos** tags (`trasnoche`, `hasta-tarde`).
- [ ] Ninguna franja incluye `abre-domingos` (decisión 7).
- [ ] La home muestra el chip **primero**, antes de los chips de Ocasión, con el rótulo «Para
      ahora» — y en ningún lugar de la UI aparece la palabra "abierto" asociada a este chip.
- [ ] Tocar el chip escribe los tags de la franja en la URL (`?t=…`) y el chip queda marcado como
      activo; volver a tocarlo los saca (comportamiento existente de `OccasionChipsRow`, sin
      cambios en ese archivo).
- [ ] Si la franja actual devuelve 0 lugares publicados, el chip **no se dibuja**.
- [ ] `lib/search/query.ts`, `lib/search/params.ts` y `components/search/occasion-chips.tsx` no
      tienen cambios.
- [ ] `select active from tags where slug = 'abierto-ahora'` = `false`; el tag no aparece en el
      sheet de filtros ni en las cards, y sus 20 filas de `place_tags` siguen existiendo.
- [ ] typecheck + tests + build verdes.

**F2 — abierto real (no se implementa hasta pasar el gate de la decisión 11)**

- [ ] El gate está medido y documentado (≥ 50 publicados con horarios propios).
- [ ] `estaAbierto` y el filtro de búsqueda salen de **la misma** expansión de rangos; no hay una
      segunda transcripción de la regla horaria (decisión 12).
- [ ] `place_open_ranges` se escribe únicamente desde `guardarHorarios`, y borrar/vaciar los
      horarios del dueño borra sus filas.
- [ ] Los tests de horarios existentes siguen verdes después de refactorizar `estaAbierto`.

## QA manual (IDs propuestos)

| ID | Caso | Criterio |
|----|------|----------|
| AHORA-01 | Abrir la home a las 21:30 (AR) con zona elegida | El primer chip dice «Para ahora»; tocarlo deja `?t=cena` en la URL y el resultado se achica |
| AHORA-02 | Abrir la home a las 02:00 (AR) | El chip aplica `trasnoche` **y** `hasta-tarde`; el resultado es la unión (no la intersección) |
| AHORA-03 | Abrir la home un domingo al mediodía | El chip aplica solo `almuerzo`; **no** aparece `abre-domingos` en la URL |
| AHORA-04 | Tocar el chip y después el botón atrás | Vuelve al estado anterior en un solo paso (decisión 29 de BUSQUEDA, sin regresión) |
| AHORA-05 | Tocar el chip dos veces | La segunda vez saca los tags y el chip queda inactivo |
| AHORA-06 | Compartir el link resultante y abrirlo al otro día a otra hora | Devuelve la misma búsqueda (`t=cena`), no la franja del que lo abre |
| AHORA-07 | Sheet de filtros → faceta Momento | `Abierto ahora` no figura entre las opciones |
| AHORA-08 | Ficha de uno de los 20 lugares que tenían el tag | No muestra el chip/tag `Abierto ahora`; el resto de sus tags sigue igual |
| AHORA-09 | Forzar una franja sin lugares (p. ej. vaciar `trasnoche`+`hasta-tarde` en una copia) | El chip no se dibuja y la home no queda con un hueco |
| AHORA-10 | Recorrer los bordes 05:59 / 06:00 / 10:59 / 11:00 / 15:29 / 15:30 / 19:59 / 20:00 / 23:59 | Cada borde cae en la franja de la decisión 3, sin huecos |

## v2 (fuera de scope)

- **Franja Y día** (`abre-domingos` combinado con la franja): requiere partir la faceta Momento
  o un filtro dedicado — ver decisión 7.
- **`happy-hour` como franja propia** (189 lugares): tentador para el after office, pero el
  horario de happy hour varía por local y no está en los datos.
- **Ordenar por "cierra más tarde"** en vez de filtrar: necesita horarios, o sea F2.
- **Cruzar con la rotación de chips por día/hora** (ver `docs/specs/planned/CHIPS_ROTACION.md`):
  los dos leen el reloj, y cuando existan los dos conviene que la home no repita el mismo gesto
  dos veces.

## Esfuerzo

**F1: una sesión** (un módulo puro nuevo, un cambio chico en `chips.ts`, un UPDATE y dos tests).
**F2:** una sesión larga, más un refactor de `horarios.ts` con red de tests — cuando abra el gate.
