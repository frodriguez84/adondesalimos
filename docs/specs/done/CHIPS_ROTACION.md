# Spec: CHIPS_ROTACION — los chips de Ocasión rotan por día y hora

**Estado:** ✅ Implementado (2026-07-31)
**Prioridad:** Baja-media — #5 (último) del orden de momentum de v2 (IDEAS § Estado de la
conversación, 2026-07-27). Mejora la home sin agregar superficie, pero nadie está bloqueado.
**Gate:** Ninguno para la **mecánica**. Lo que necesita datos de uso es el **contenido** de las
reglas (ver decisión 7) — por eso el spec arranca con dos reglas defendibles y se afina después.
**Bloquea:** nada.
**Depende de:** BUSQUEDA (chips de Ocasión, decisiones 6/18/25), CATALOGO/`app_settings`
(`lib/db/settings.ts`), CURADURIA (qué chips están vivos hoy), AUTH F4 (`partesEnAR`).
**Relacionado:** `docs/specs/active/ABIERTO_AHORA.md` — los dos leen el reloj; el reparto está en
la decisión 8 (**ya implementado** por ABIERTO_AHORA F1, 2026-07-30).

---

## Problema

La home muestra **los primeros 4 chips de Ocasión con resultados**, ordenados por una columna
`sort` fija que se decidió al sembrarlos (BUSQUEDA, decisiones 6 y 25). Son los mismos 4 a
cualquier hora de cualquier día:

- Un martes a las 18 h, "After office" es el chip más útil que existe — y está detrás de "Ver
  más" porque su `sort` así lo dejó.
- Un sábado a la 1 de la mañana, "Un café" ocupa un lugar en la home que "Salir a bailar" usaría
  mejor.
- El orden por `sort` es **curaduría estática**: refleja qué nos pareció importante en general,
  no qué le sirve al que está mirando la pantalla ahora.

La app se abre para decidir **una salida concreta, ahora**. El atajo de la home es lo único que
puede aprovechar eso sin pedirle nada al usuario, y hoy no lo hace.

## Objetivo

Que el orden de los chips de la home dependa del **día y la hora** (en TZ AR), con reglas que se
cambian **con un UPDATE y sin deploy**, y que un setting mal escrito **no pueda romper la home**.

## Qué NO es esta feature

- **No cambia qué chips existen ni qué tags aplican.** `lib/db/chips.ts` (la semilla) y las tablas
  `occasion_chips`/`chip_tags` no se tocan. Esto reordena, nada más.
- **No inventa chips nuevos** ni prende los que están en 0. La decisión 25 sigue mandando: un chip
  sin resultados no se muestra, esté primero en la regla o no.
- **No es personalización.** No hay historial, ni cookies, ni "chips para vos": la única variable
  es el reloj. Lo mismo para todos los que abren la app a la misma hora.
- **No toca el motor de búsqueda** ni la URL. Un chip rotado aplica exactamente los mismos tags.
- **No agrega tabla ni UI de admin.** Las reglas se editan con un `UPDATE` documentado, igual que
  el umbral de confidence y los topes de Google.
- **No hay A/B testing ni medición de qué chip funciona mejor.** Los datos ya se acumulan
  (`place_tag_impressions_daily`); analizarlos es otra tarea.

## Decisiones cerradas

| # | Decisión |
|---|----------|
| 1 | **Las reglas viven en `app_settings`, clave `chips.schedule`.** **Decidido por Fer, 2026-07-29** (alternativas evaluadas: tabla `chip_schedule` con UI de admin —migración + pantalla para una feature todavía sin datos de uso, y un schema es puerta de ida—; y reglas hardcodeadas en `lib/db/chips.ts` —rompe el criterio del proyecto de que la curaduría se toca sin deploy, que es *el* motivo por el que los chips viven en DB). `app_settings` ya es el dueño único de la config de runtime (umbral de confidence, topes de Google, modelo del chat): reusarlo es cero migración y un UPDATE. |
| 2 | **Forma de la regla** (array; se evalúan en orden y **gana la primera que matchea**): `{ dias: number[], desde: "hh:mm", hasta: "hh:mm", primero: string[] }`. `dias` usa la convención del proyecto **0 = lunes** (`DIAS` de `lib/negocio/horarios.ts`), no la de JS. `primero` son slugs de `occasion_chips`. |
| 3 | **Un rango cuyo `hasta` es menor o igual que el `desde` cruza la medianoche** y pertenece al día en que empieza — la misma semántica que ya tienen los horarios del dueño (`lib/negocio/horarios.ts`), y por el mismo motivo: "viernes 22:00–05:00" es *la noche del viernes*, y una app de salidas que se equivoque en eso se equivoca justo en su horario pico. |
| 4 | **El cómputo de día y hora en AR no se reimplementa**: sale de `partesEnAR` (`lib/negocio/horarios.ts`), que ya es el dueño de eso. TZ fija `America/Argentina/Buenos_Aires`: el orden de los chips no depende del reloj de quien mira. |
| 5 | **Dueño único de la rotación: `lib/search/rotacion.ts`** (nuevo). Expone el tipo de la regla, la validación y `chipsPrimero(reglas, now): string[]`. **Puro, sin DB** — se testea con una tabla de (día, hora) → chips esperados, igual que `horarios.ts`. `lib/search/chips.ts` lo consume: lee la clave, valida, y usa el resultado para ordenar antes de partir en `home`/`resto`. |
| 6 | **Degradación obligatoria: un setting inválido se ignora en silencio y la home usa el orden por `sort`** (el comportamiento de hoy). Se valida forma por forma: una regla mal escrita se descarta sola sin invalidar las demás; un slug que no existe se ignora. **La home nunca puede romperse por un UPDATE mal tipeado** — mismo criterio que el sugeridor de dólar de COSTOS_ADMIN ("degradar si la fuente cae, nunca bloquear"). Se loguea una vez, no por request. |
| 7 | **La rotación sólo reordena entre los chips que ya están vivos.** Un chip listado en `primero` que devuelve 0 (decisión 25) sigue sin mostrarse; el resto ocupa su lugar. Consecuencia: cargar una regla que nombra un chip muerto **no** deja un hueco en la home. |
| 8 | **Reparto con `ABIERTO_AHORA`:** el chip «Para ahora» va **primero y no cuenta** contra los 4 de Ocasión (`CHIPS_EN_HOME`); los rotados vienen después. Son dos gestos distintos —"a esta hora está abierto" vs "a esta hora la gente hace tal plan"— y ninguno reemplaza al otro. La fila ya usa `flex-wrap`, así que un chip más no rompe el layout. Si al final los dos specs están cerrados y la fila se siente cargada, se recorta ahí, no acá. |
| 9 | **La semilla de `chips.schedule` arranca con reglas, no vacía.** Un array vacío sería cero riesgo pero también cero feature (y nada que verificar en QA). Son de sentido común y usan chips que hoy están vivos: <br>· **After office** — lunes a viernes, `17:00–21:00` → `after-office` (171) <br>· **Salir a bailar** — viernes y sábado, `22:00–05:00` → `salir-a-bailar` (586) <br>· **Merienda del finde** — sábado y domingo, `16:00–19:00` → `merienda` (176) — **agregada el 2026-07-31 como consecuencia de la decisión 11**: es la única de las tres que se *ve*, porque `merienda` tiene `in_home = false` y hoy vive detrás de "Ver más". Es del finde y no de toda la semana para no pisarse con After office entre semana (gana la primera regla que matchea, decisión 2). <br>Se documentan explícitamente como **primera aproximación**, a afinar con datos de uso reales (que es lo que el BACKLOG pedía). El `onConflictDoNothing` del seed no pisa un valor ya editado a mano. |
| 10 | **El orden se resuelve en el server**, donde ya se resuelven los chips (`getOccasionChips`, llamado por el server component de `/`): el cliente recibe la lista ya ordenada y no recalcula nada — sin riesgo de divergencia de hidratación. `getOccasionChips` acepta un `now` opcional para poder testearlo. **Ya implementado por ABIERTO_AHORA F1** (`chips.ts:57`): la firma con `now` existe desde el 2026-07-30. |
| 11 | **Una regla puede traer a la home un chip con `in_home = false`.** **Decidido por Fer, 2026-07-31**, al empezar la implementación, porque el § *Problema* describía una home que ya no es la de hoy. Medido ese día: la home real es `salida-con-chongo`(1) · `salir-a-bailar`(586) · `after-office`(171) · `tomar-algo`(3.219) —`salida-con-amigos` da 0 y la decisión 25 lo esconde—, o sea que **los dos chips de las reglas semilla ya están en la home a toda hora**. Con la rotación limitada al pool `in_home` (alternativa evaluada, más conservadora) la feature no movería un pixel y ROT-01/02/03 serían inverificables. Consecuencia asumida: **`in_home` pasa a significar "candidato por defecto", no "candidato a la home"**. El riesgo está acotado por la decisión 7 (un chip muerto no deja hueco) y por la 6 (sin setting, la home es exactamente la de hoy). El pool de candidatos queda `[los de `primero` que estén vivos, en el orden de la regla] + [los `in_home` vivos por `sort`]`, y de ahí salen los 4. |

## Ejemplo del setting

```jsonc
// app_settings['chips.schedule']
[
  { "dias": [0,1,2,3,4], "desde": "17:00", "hasta": "21:00", "primero": ["after-office"] },
  { "dias": [4,5],       "desde": "22:00", "hasta": "05:00", "primero": ["salir-a-bailar"] },
  { "dias": [5,6],       "desde": "16:00", "hasta": "19:00", "primero": ["merienda"] }
]
// dias: 0 = lunes (convención del proyecto). El segundo rango cruza la medianoche
// y pertenece al viernes/sábado en que empieza (decisión 3).
```

## Implementación

| Archivo | Qué |
|---------|-----|
| `lib/search/rotacion.ts` | **Nuevo, ~60 líneas.** Tipo, validación defensiva y `chipsPrimero(reglas, now)`. Puro |
| `lib/search/chips.ts` | Lee `chips.schedule` con `getSetting`, valida, y aplica el orden antes del corte `home`/`resto`. El `now` opcional **ya existe** (ABIERTO_AHORA F1) |
| `scripts/seed.ts` | La clave con las reglas de la decisión 9 (`onConflictDoNothing`) |
| `lib/search/__tests__/rotacion.test.ts` | Tabla de (día, hora) → orden esperado, incluidos los cruces de medianoche, los bordes y los settings basura |

Sin migración, sin endpoint, sin cambios en `components/search/occasion-chips.tsx`.

### Lo que quedó implementado (2026-07-31)

- **`lib/search/rotacion.ts`** — `CHIPS_SCHEDULE_KEY`, el tipo `ReglaRotacion`, `validarReglas`,
  `chipsPrimero(reglas, now)` y `DEFAULT_CHIPS_SCHEDULE` (la semilla). Puro y sin base: reusa
  `partesEnAR`, `esHoraValida`, `minutosDe` y `DIAS` de `lib/negocio/horarios.ts` en vez de
  transcribirlos.
- **`lib/search/chips.ts`** — el setting se lee **en paralelo** con los conteos (mismo motivo que
  el chip «Para ahora»: no sumarle un round-trip en serie al render) y se aplica justo antes del
  corte `home`/`resto`. El pool de candidatos pasa a ser `[forzados vivos] + [in_home vivos]`.
- **La semilla se sembró en el Postgres de dev** con `npm run db:seed` (la clave no existía, así
  que el `onConflictDoNothing` la insertó). Verificado con `psql`.
- **Cero cambios** en `components/search/occasion-chips.tsx`, `lib/search/query.ts`,
  `lib/search/params.ts`, `lib/db/chips.ts` y `drizzle/`, como prometía el § *Qué NO es*.
- Detalle heredado que quedó documentado: **`desde === hasta` cubre las 24 h** del día listado
  (consecuencia literal de la decisión 3). En `horarios.ts` ese mismo caso es un rango inválido;
  la diferencia es deliberada — ahí significa "no abre", acá "siempre".

## Criterios de done (DoD)

- [x] `lib/search/rotacion.ts` es el **único** módulo que decide qué chips van primero
      (verificable por `grep`), es puro y no toca la base.
- [x] El día/hora en AR sale de `partesEnAR`; no hay una segunda transcripción de ese cómputo.
- [x] Un martes 18:00 (AR) la home muestra «After office» entre los chips visibles; un martes
      15:00 no necesariamente.
- [x] Un sábado 01:00 (AR) «Salir a bailar» está en la home (la regla del viernes 22:00–05:00
      alcanza a la madrugada del sábado); un sábado 15:00 no.
- [x] Con `chips.schedule` **ausente**, la home se comporta **exactamente** como hoy (orden por
      `sort`) — sin excepciones ni logs de error.
- [x] Con `chips.schedule` inválido (JSON de otra forma, `dias: "lunes"`, `desde: "25:99"`, slug
      inexistente, regla suelta mal escrita entre dos buenas): la home **no rompe**, se ignora lo
      inválido y se conserva lo válido.
- [x] Un chip nombrado en `primero` que devuelve 0 no se muestra ni deja hueco (decisión 7).
- [x] Una regla puede adelantar un chip vivo con `in_home = false` (decisión 11), y el chip que
      queda quinto pasa a "Ver más" sin desaparecer.
- [x] Los chips siguen aplicando los mismos tags a la URL; `occasion_chips`, `chip_tags`, el motor
      y el componente cliente no tienen cambios.
- [x] Tests de tabla cubren: cada regla, los bordes de cada rango, un rango que cruza la
      medianoche, un día sin reglas y los settings basura.
- [x] typecheck + tests + build verdes.

## QA manual (IDs propuestos)

| ID | Caso | Criterio |
|----|------|----------|
| ROT-01 | Home un martes 18:00 (AR), zona elegida | «After office» es el **primer chip de Ocasión** (después de «Para ahora»), no el tercero como manda `sort` |
| ROT-02 | Home un martes 10:00 | El orden es el de siempre (`sort`): «Salida con chongo» primero, «After office» tercero |
| ROT-03 | Home un sábado 01:00 | «Salir a bailar» primero (regla del viernes que cruza medianoche) |
| ROT-11 | Home un sábado 17:00 | «Merienda» está en la home **sin** tener `in_home` (decisión 11) y el cuarto chip de Ocasión de siempre pasa a "Ver más" |
| ROT-04 | `DELETE` de la clave `chips.schedule` y recargar | Home idéntica a la de antes del spec |
| ROT-05 | `UPDATE` de la clave con un JSON de forma incorrecta | Home funciona, orden por `sort`, sin pantalla de error |
| ROT-06 | Regla con `primero: ["chip-que-no-existe"]` | Se ignora; los 4 chips normales se muestran igual |
| ROT-07 | Regla con un chip vivo + uno muerto | El vivo se adelanta, el muerto no deja hueco |
| ROT-08 | Tocar un chip rotado | Aplica los mismos tags que aplicaba antes (URL idéntica) |
| ROT-09 | Agregar una regla nueva por `UPDATE` sin reiniciar el server | Toma efecto en la recarga siguiente (se lee en cada request, no se cachea en módulo) |
| ROT-10 | Con `ABIERTO_AHORA` cerrado: home un viernes 23:00 | Primero «Para ahora», después «Salir a bailar», después el resto (decisión 8) |

## v2 (fuera de scope)

- **Afinar las reglas con datos de uso reales** (`place_tag_impressions_daily` ya acumula qué tags
  encontraron a la gente): es lo que el BACKLOG pedía y lo que convierte estas dos reglas de
  sentido común en curaduría con evidencia.
- **UI en `/admin`** para editar las reglas sin SQL — cuando se toquen seguido.
- **Rotación por zona** ("Puerto Madero un jueves" ≠ "Villa Crespo un jueves"): necesita volumen
  por zona que hoy no existe.
- **Estacionalidad** (verano → `aire-libre`): el mismo mecanismo con fechas en vez de horas.

## Esfuerzo

**Una sesión corta**: un módulo puro nuevo con su test de tabla, un cambio chico en `chips.ts` y
una clave en el seed. Sin migración ni UI.
