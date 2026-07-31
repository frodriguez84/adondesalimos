# Spec: FAVORITOS — guardar lugares y listas

**Estado:** Parcial — **F1 ✅ Implementado (2026-07-30)**; F2 (`/mis-lugares`, crear/renombrar/borrar
listas, sheet de selección) pendiente. QA: `docs/qa/AnalisisQA.md` § FAVORITOS F1.
**Prioridad:** Alta — #3 del orden de momentum de v2 y **la apuesta grande** de la tanda
(IDEAS § Estado de la conversación, 2026-07-27): es la única feature de la cola que da
**retención** (una razón para volver a la app cuando no estás decidiendo una salida) y a la vez
suma un **gancho premium** que no depende del cupo de IA.
**Gate:** Ninguno.
**Bloquea:** nada. Habilita el "armá una votación con esta lista" de v2 (ver § v2).
**Depende de:** AUTH (sesión inline, `/cuenta`, patrón de acciones de dominio), MONETIZACION
(`users.plan`, `esPremium`, criterio "subir un cupo es un regalo; bajarlo es una traición"),
BUSQUEDA (`PlaceCard`, la lista de resultados), FICHA (`/lugar/[id]`), VOTACION (patrón de
endpoint y de tabla hija: `polls`/`poll_options`).

---

## Problema

Hoy la app **no tiene memoria**. Todo lo que el usuario descubre se pierde al cerrar la pestaña:

- El que encuentra tres bodegones que le pintan y quiere ir "el finde que viene" no tiene dónde
  ponerlos. El único artefacto que sobrevive a la sesión es una **votación**, que dura 72 h, es
  para un grupo y exige decidir ahora.
- Sin nada guardado, **no hay razón para volver** salvo empezar otra búsqueda de cero. La app se
  usa una vez y se olvida: el loop viral (`/votacion/[token]`) trae gente, pero nada la retiene.
- El premium B2C hoy es **solo el chat** (cupo de 30 mensajes) y la votación múltiple. Es un
  gancho angosto y caro: cada conversión premium cuesta tokens de Sonnet. Falta un beneficio
  premium que **no tenga costo marginal**.

## Objetivo

Que guardar un lugar sea **un tap desde la card o la ficha**, que lo guardado viva en una página
propia, y que la diferencia free/premium sea la **cantidad de listas** — aplicada server-side
desde el día 1, sin costo marginal por usuario.

## Qué NO es esta feature

- **No es un ranking personalizado.** Guardar un lugar **no** cambia el orden de la búsqueda ni
  los chips. El motor (`lib/search/query.ts`) no se toca.
- **No es social.** Las listas son privadas: no se comparten, no se siguen, no tienen link
  público. Compartir una lista es v2 (y arrastra moderación).
- **No hay notas, ratings ni "ya fui" por lugar.** Un ítem es un lugar en una lista y nada más.
- **No hay carpetas, tags ni orden manual de listas.** El orden es por fecha de guardado, descendente.
- **No se toca el panel del dueño.** La métrica de guardados se **empieza a contar** (decisión 12)
  pero no se muestra en `/mi-negocio` en v1.
- **No hay import/export ni migración de nada.** No existe data previa que traer.
- **No se crea nada en el alta de usuario.** La lista por defecto nace al primer guardado
  (decisión 2).

## Decisiones cerradas

| # | Decisión |
|---|----------|
| 1 | **Dos tablas nuevas: `place_lists` y `place_list_items`.** No una columna array en `users` ni un `place_favorites` plano: el modelo free-1-lista / premium-N-listas es el gancho comercial, y una tabla de listas desde el día 1 evita una migración de datos reales más adelante (schema con data = puerta de ida). Es el mismo patrón padre/hijo que `polls`/`poll_options`. |
| 2 | **La lista por defecto es *lazy*: se crea al primer guardado**, con `name = 'Mis lugares'` e `is_default = true`. No se crea en el signup — better-auth no se toca y no se siembran filas para el usuario que nunca guarda nada. Un usuario tiene **como máximo una** lista `is_default` (índice único parcial). |
| 3 | **Gate: free = 1 lista (la default) · premium = hasta N listas con nombre.** Se aplica **server-side en la acción de dominio desde el día 1** (mismo criterio que `owner_plan` en AUTH F3: "subir un cupo es un regalo; bajarlo es una traición"). El cliente esconde el botón de "nueva lista" para free, pero eso es cosmética: el candado está en el server y hay test que lo prueba. |
| 4 | **Bajar de plan oculta, no borra.** Un premium con 5 listas que vuelve a `free` sigue viendo **solo su default**; las otras quedan en la base, invisibles, y **reaparecen intactas** si vuelve a premium. Es el mismo invariante que el contenido pago del dueño (CLAUDE.md § Contenido del dueño: "ocultar ≠ borrar, en los dos ejes"). Nunca un `DELETE` disparado por un cambio de plan. |
| 5 | **Dueño único de la regla de cupo: `lib/favoritos/planes.ts`.** Expone `MAX_LISTAS_FREE = 1` (constante en código: es la *definición* del plan free, no un cupo a tunear), los cupos de premium leídos de `app_settings` (`favoritos.max_listas_premium`, `favoritos.max_items_por_lista`) y `listasVisibles(userId)`, que aplica la decisión 4. **Nadie más decide cuántas listas puede tener alguien** — el gate de plan sigue siendo `esPremium` (`lib/votaciones/planes.ts`), que no se duplica. |
| 6 | **El botón de guardar entra a `PlaceCard` como *slot*, no como lógica.** `PlaceCard` es presentación pura (así está escrito) y todo su cuerpo está dentro de un `<Link>` — un botón anidado en un link es inválido y roba el tap. Solución: prop opcional `accion?: React.ReactNode`, posicionada absolute arriba a la derecha, **fuera** del `<Link>`. El componente cliente con el estado vive aparte (`components/favoritos/boton-guardar.tsx`). Misma card, sin lógica de datos adentro. |
| 7 | **Sin sesión, el botón se muestra igual** y al tocarlo lleva a `/login?callbackUrl=<url actual>` (patrón existente). Es deliberado: es el punto de conversión más natural que tiene la app —el usuario ya quiere algo— y esconderlo tira a la basura el único momento en que un consumidor tiene motivo para registrarse (hoy casi no se loguea nadie que no sea dueño: ver el diferimiento de Google OAuth). |
| 8 | **Free = un tap y listo. Premium con más de una lista = un tap abre el sheet de "¿en qué lista?".** Nadie elige lista si solo tiene una. El sheet reusa `components/ui/bottom-sheet.tsx`. |
| 9 | **El estado "guardado" se resuelve server-side, una query por página**, no una por card: `inArray(place_list_items.placeId, idsDeLaPagina)` sobre las listas visibles del usuario, y viaja como `Set<string>` a los componentes. Mismo criterio que `tagsDeLugares`/`zonaPrimariaDeLugares` en el motor ("los tags de la página en una query, no una por card"). |
| 10 | **Página propia `/mis-lugares`**, no una tab de `/cuenta`, con link en el `AccountMenu` al lado de "Mis votaciones" — que es exactamente el mismo tipo de objeto (algo mío, con su propia pantalla). `/cuenta` es configuración de la cuenta; esto es contenido. |
| 11 | **Un lugar que se despublica sigue en la lista.** Misma decisión que `poll_options` de VOTACION ("si un lugar se vuelve invisible después, la opción sigue"): el usuario lo guardó, no se le desaparece sin explicación. Se muestra atenuado con un "ya no está disponible" y **no linkea** a la ficha (que devolvería 404 por `publishedWhere`). La lista **nunca** se filtra silenciosamente por visibilidad. |
| 12 | **Se cuenta `saves` en `place_impressions_daily` desde el día 1** (columna nueva, aditiva, agregado puro: sin `user_id`, sin cookie, sin IP — igual que `impressions` y `detail_views`). Por qué ahora y no cuando se muestre: sacar un favorito **borra la fila** de `place_list_items`, así que el histórico "cuánta gente lo guardó" **no se puede reconstruir después** (CLAUDE.md § Métricas agregadas). Se escribe en el mismo patrón `after()` que las impresiones. Mostrarlo en `/mi-negocio` es v2. |
| 13 | **Rate limit propio: `checkFavoritosRateLimit`** en `lib/middleware/rate-limit.ts`, con prefijo propio, generoso (guardar es una acción legítima y repetida) pero acotado — es un endpoint autenticado que escribe. Mismo patrón que los 10 cupos que ya existen. Implementado en 60/min por IP. |
| 14 | **Endpoints mínimos, todos con el patrón de `POST /api/votaciones`** (rate limit → sesión inline → zod → acción de dominio → `{data, error:{message, code}}`): <br>· `POST /api/favoritos` `{placeId, listId?}` — guarda; sin `listId` va a la default (creándola si no existe) <br>· `DELETE /api/favoritos` `{placeId, listId}` — saca <br>· `POST /api/listas` `{name}` — crea lista (gate premium) <br>· `PATCH /api/listas/[id]` `{name}` · `DELETE /api/listas/[id]` — renombrar / borrar |
| 15 | **La lista default no se puede borrar ni renombrar.** Es el contenedor que garantiza que free siempre tenga dónde guardar; borrarla dejaría al usuario sin destino y obligaría a recrearla en el próximo tap. Se valida en la acción de dominio, no solo en la UI. |
| 16 | **Solo se guardan lugares del catálogo real.** El `placeId` se valida contra `places` (existe) — no contra `publishedWhere`: se puede guardar solo lo que se puede ver, y lo que se ve ya pasó por el filtro de visibilidad en la búsqueda o la ficha. Chequear publicado otra vez acá rompería el caso de la decisión 11 al re-guardar. |

## Schema (migración aditiva)

```
place_lists
  id            uuid pk default random
  user_id       uuid not null → users.id on delete cascade
  name          text not null
  is_default    boolean not null default false
  created_at    timestamp not null default now()
  updated_at    timestamp not null default now()
  index (user_id)
  unique index (user_id) where is_default          -- una sola default por usuario
  unique index (user_id, lower(name))              -- sin dos listas con el mismo nombre

place_list_items
  id            uuid pk default random
  list_id       uuid not null → place_lists.id on delete cascade
  place_id      uuid not null → places.id
  created_at    timestamp not null default now()
  unique index (list_id, place_id)                 -- no repetir un lugar en la lista
  index (list_id)
  index (place_id)                                 -- para el estado "guardado" por página

place_impressions_daily
  + saves       integer not null default 0          -- decisión 12
```

`place_id` **sin** `on delete cascade`, igual que `poll_options.place_id`: el catálogo no borra
lugares (los despublica), y si algún día borrara, queremos que falle ruidoso en vez de vaciar
listas de gente en silencio.

## Implementación

| Archivo | Qué |
|---------|-----|
| `lib/db/schema.ts` + `drizzle/` | Las dos tablas + la columna `saves` (migración aditiva) |
| `lib/favoritos/planes.ts` | **Dueño único del cupo** (decisión 5) + `listasVisibles` |
| `lib/favoritos/acciones.ts` | `guardarLugar` · `sacarLugar` · `crearLista` · `renombrarLista` · `borrarLista`. Todos los gates viven acá, no en los routes |
| `lib/favoritos/query.ts` | `listasDelUsuario(userId)` (con ítems y conteo) · `guardadosDeLaPagina(userId, ids)` (decisión 9) |
| `lib/favoritos/validacion.ts` | Schemas zod (nombre de lista: 1-40 chars, trim) |
| `app/api/favoritos/route.ts`, `app/api/listas/route.ts`, `app/api/listas/[id]/route.ts` | Adaptadores finos (decisión 14) |
| `components/favoritos/boton-guardar.tsx` | Cliente: estado optimista, sheet de listas, redirect a login |
| `components/shared/place-card.tsx` | **Solo** el prop `accion` (decisión 6) |
| `app/mis-lugares/page.tsx` + `mis-lugares-client.tsx` | La página (patrón de `/mis-votaciones`) |
| `components/shared/account-menu.tsx` | Un link |
| `lib/search/impressions.ts` | `registrarGuardado(placeId)` — mismo patrón agregado |

## Pre-vuelo contra el código (2026-07-30)

Auditoría de los supuestos de este spec contra el código real, hecha **antes** de implementar (3
exploradores en paralelo + verificación a mano). El spec se escribió el 2026-07-29 sin abrir los
archivos; esto dice qué de lo que afirma es cierto hoy. **No cambia ninguna decisión** — marca lo
que hay que decidir antes de codear.

**Confirmado, se puede reusar tal cual:** `esPremium(userId, tx)` (`lib/votaciones/planes.ts:16`,
importada en 5 archivos) · `poll_options.place_id` **sin** cascade, tal como lo cita la decisión 1
(`schema.ts:702-751`) · `users.plan` enum `free|premium` (`schema.ts:535`) · el orden del handler de
`POST /api/votaciones` es exactamente el de la decisión 14, **con la sesión antes del payload**
(rate limit :26 → sesión :31 → JSON :40 → zod :49 → acción :61 → `{data, error}` :68) · `/login`
lee el param **`callbackUrl`** (`app/(auth)/login/page.tsx:29`) · `bottom-sheet.tsx` con
`{open, onClose, children, className}` · `account-menu.tsx` ya tiene "Mis votaciones" · `/mis-votaciones`
usa el patrón server + `*-client.tsx` · **hay 3 precedentes de índice único parcial** en Drizzle
(`place_claims_aprobado_idx`, los dos de `subscriptions`), así que el `unique index (user_id) where
is_default` de la decisión 2 es escribible · `place_impressions_daily` es PK `(place_id, date)` con
`impressions`/`detail_views`/`featured_impressions`, y `lib/search/impressions.ts` ya tiene cinco
`registrarX` con el upsert `onConflictDoUpdate` que `saves` copiaría · eliminar la cuenta usa cascade
de FK + hook `beforeDelete` (`lib/auth/index.ts:46-91`), así que FAV-15 sale solo con el cascade ·
**no existe nada de favoritos todavía** (ni `lib/favoritos/`, ni `components/favoritos/`, ni
`app/mis-lugares/`, ni tabla con "list"/"favorit"): es campo virgen.

**Resueltas con Fer al abrir la sesión de F1 (2026-07-30)** — las tres se cerraron antes de escribir
código y así quedaron implementadas:

| # | Decisión tomada |
|---|-----------------|
| P1 | **(a) Fuera del motor.** `lib/search/query.ts` quedó **intacto**. `guardadosDeLaPagina(userId, ids)` (`lib/favoritos/query.ts`) se llama desde el server component de `/` —que ya traía la sesión para el `AccountMenu`— y desde la ficha; `/api/search` suma sesión + la misma query y devuelve `guardados: string[]` para que las cards del scroll infinito nazcan con estado. **Hallazgo del pre-vuelo que faltaba:** `SearchShell` y `ResultsList` son componentes **cliente**, así que el estado igual tenía que viajar serializado — la opción (b) no lo habría evitado. Verificado en vivo: la card de la página 2 aparece guardada tras el scroll. |
| P2 | **Listado + ficha, y nada más** (lo que dice el DoD). Chat, popup del mapa y votación **no pasan el prop `accion`** y no muestran botón: es decisión, no omisión. El chat queda para F2 porque sus cards llegan por streaming y necesitan un endpoint de lectura por lote (`GET /api/favoritos?ids=`) que no está en la decisión 14 y que F2 va a tener igual para `/mis-lugares`. |
| P3 | **Default en código + fila opcional en `app_settings`**, como `getConfidenceThreshold`. Valores: `favoritos.max_listas_premium = 10`, `favoritos.max_items_por_lista = 200` (constantes `DEFAULT_MAX_LISTAS_PREMIUM` / `DEFAULT_MAX_ITEMS_POR_LISTA` en `lib/favoritos/planes.ts`). **No se sembró ninguna fila**: el feature funciona en una base que nunca corrió un seed nuevo, y un UPDATE los cambia sin deploy. |

**Lo que se decidió mientras se implementaba** (no estaba en el spec y hacía falta):

- **El estado "guardado" respeta el recorte de plan.** `guardadosDeLaPagina` pasa por `listasVisibles`,
  no por `place_lists` derecho. Si no lo hiciera, un lugar guardado solo en una lista escondida se
  mostraría como guardado y `sacarLugar` —que también opera solo sobre visibles— no podría sacarlo:
  la pantalla mentiría. Verificado en vivo (FAV-06/07).
- **`saves` suma solo el guardado nuevo.** Re-guardar es idempotente y no es un evento nuevo; el
  contador mide "cuánta gente lo guardó", no cuántos taps hubo. Por eso `guardarLugar` devuelve `nuevo`.
- **`sacarLugar` acepta `listId` opcional.** El botón de la card sabe qué lugar sacar pero no de qué
  lista salió el estado (que se resuelve por lugar). Sin `listId` saca de todas las listas visibles.
- **El sheet de selección no se implementó y no es un gap**: en F1 nadie puede tener más de una lista
  porque crear listas es F2. La condición del DoD ("premium con >1 lista") no puede darse todavía.

**A decidir ANTES de escribir código** (los dos primeros son conflictos internos del spec) — *ya
resueltos, se dejan como registro de qué se auditó*:

| # | Qué | Por qué importa |
|---|-----|-----------------|
| P1 | **La decisión 9 y el "el motor no se toca" de § Qué NO es esta feature se contradicen si se sigue el precedente literal.** `tagsDeLugares` y `zonaPrimariaDeLugares` **no están exportadas**: son privadas de `lib/search/query.ts:509,535` y se llaman **desde adentro** del motor, en 3 sitios (`:335,:407,:491`). Copiar ese patrón para `guardadosDeLaPagina` obliga a tocar el motor y a pasarle un `userId`. | Hay que elegir: **(a)** resolver el estado **fuera** del motor —en el server component de la home y en la ficha, con los ids ya obtenidos— y dejar `query.ts` intacto, o **(b)** aceptar tocar el motor y corregir el "no se toca". Recomendación: **(a)**, que es lo que el spec ya prometió. Ojo con el segundo tramo: la paginación ("ver más") trae cards desde **`/api/search`** (`app/api/search/route.ts:40`), así que ese endpoint también tiene que devolver el estado, o las cards paginadas nacen sin él. |
| P2 | **`PlaceCard` se renderiza en 5 lugares, no en uno**: listado (`components/search/results-list.tsx:141,153`), popup del mapa (`map-view.tsx:233`), **chat IA** (`app/chat/chat-client.tsx:571`) y **votación** (`app/votacion/[token]/votacion-client.tsx:131`). El DoD solo nombra "la card del listado y la ficha". | El slot `accion` de la decisión 6 es opcional, así que las otras superficies simplemente no lo pasan y no muestran botón — **funciona, pero hay que decidirlo a propósito**. Guardar desde el chat es el gesto más natural de todos (el usuario acaba de pedir recomendaciones) y quedaría afuera por omisión, no por decisión. |
| P3 | **Cómo nacen las claves nuevas de `app_settings`** (`favoritos.max_listas_premium`, `favoritos.max_items_por_lista`). El dueño de la lectura es `getSetting<T>(key, db)` (`lib/db/settings.ts`), y el patrón vigente es una función tipada por clave con **default en código** (`getConfidenceThreshold` → `DEFAULT_CONFIDENCE_THRESHOLD`), no una fila obligatoria. | Si se asume "la fila existe" el feature nace roto en cualquier base que no corrió un seed nuevo. Seguir el patrón: default en código + fila opcional que lo pisa sin deploy. |

**Citas corregidas** (2026-07-30, ya aplicadas en el texto de arriba): la decisión 13 decía "los
**12** cupos que ya existen" y eran **10** funciones `check*RateLimit`; el DoD citaba la "lección
**INT-14** de PULIDO" para "sesión inline antes del payload" cuando `INT-14` es el caso de
aislamiento entre dueños y lo que corresponde es la **decisión 7 de `docs/specs/done/PULIDO.md`**.

**Hallazgo fuera de este spec:** `CLAUDE.md` § Estructura de carpetas dice `drizzle/ … (0000..0003)`
y hoy hay **11** migraciones (`0000`..`0010_wealthy_mad_thinker`). Es drift de doc, no de código.

## Criterios de done (DoD)

**Modelo y gate**

- [x] Migración aditiva aplicada (`drizzle/0011_easy_wolfsbane.sql`); `npm run db:migrate` no
      destruye nada y el seed sigue idempotente. Backup previo: `2026-07-30_203627`.
- [x] `lib/favoritos/planes.ts` es el **único** módulo que decide cuántas listas puede tener un
      usuario (verificado por `grep`: `MAX_LISTAS_FREE`/`getMaxListasPremium`/`maxListasDelUsuario`
      solo aparecen ahí); el gate de plan sale de `esPremium`, que no se duplicó.
- [~] Un usuario **free** que intenta crear una segunda lista recibe error **desde el server**.
      *El endpoint `POST /api/listas` es de F2*; lo que F1 deja listo y testeado es el número que
      ese endpoint va a consultar (`maxListasDelUsuario` = 1 en free, 10 en premium).
- [~] Un **premium** puede crear hasta `favoritos.max_listas_premium` listas — **F2** (misma razón).
- [x] Bajar el plan a `free` **no borra ninguna fila**: las listas no-default quedan y dejan de
      listarse; volver a `premium` las muestra de nuevo con sus ítems intactos (test + FAV-06/07
      en vivo). Además, guardar en una lista escondida se rechaza y el estado "guardado" tampoco
      la cuenta.
- [~] La lista default no se puede borrar ni renombrar — **F2**: en F1 no existe el endpoint que
      borre o renombre. `is_default` ya está en el modelo con su índice único parcial.
- [x] Un lugar no se puede duplicar en la misma lista (índice único `(list_id, place_id)` + acción
      idempotente con `onConflictDoNothing`; test + FAV-08).

**Guardar / sacar**

- [x] Desde la card del listado y desde la ficha, un tap guarda el lugar, directo a la default,
      creándola si es el primer guardado. *El sheet de selección no aplica en F1*: crear listas es
      F2, así que nadie puede tener más de una.
- [x] El botón refleja el estado real al cargar la página (server-side, decisión 9) y no dispara
      una query por card: **cero** requests a `/api/favoritos` al cargar (FAV-14), y las cards del
      scroll infinito nacen con estado porque `/api/search` lo devuelve.
- [x] Sin sesión, el botón lleva a `/login?callbackUrl=…` y al volver el usuario queda en la misma
      búsqueda, con zona y tags (FAV-01, verificado en vivo).
- [x] `PlaceCard` sigue sin lógica de datos: el diff en ese archivo es el prop `accion` y su
      posicionamiento (`relative` + `pr-12`), nada más.
- [x] Sacar un lugar lo quita de la lista y el botón vuelve al estado no-guardado sin recargar.

**Página `/mis-lugares`** — F2 entera, no aplica a esta fase

- [ ] Sin sesión redirige a login; con sesión muestra las listas visibles y sus lugares (más
      recientes primero).
- [ ] Un lugar despublicado sigue apareciendo, atenuado, con "ya no está disponible" y sin link
      (decisión 11).
- [ ] Premium puede crear, renombrar y borrar listas no-default desde la página.
- [ ] Link presente en el `AccountMenu`.

**Métrica y seguridad**

- [x] Guardar suma +1 a `place_impressions_daily.saves` del día, en un `after()`, sin `user_id`
      ni ninguna otra PII en la fila (FAV-13; hay un test que enumera las columnas y falla si
      alguien agrega una identificatoria). Solo suma el guardado **nuevo**.
- [x] Sacar un favorito **no** descuenta el contador (FAV-09, verificado en vivo y en test).
- [x] Todos los endpoints: sesión verificada inline **antes** de mirar el payload (decisión 7 de
      `docs/specs/done/PULIDO.md`), rate limit propio (`checkFavoritosRateLimit`, 60/min), y
      **nunca** operan sobre una lista de otro usuario (test + FAV-11 en vivo: `listId` ajeno da
      404 y **cero** filas escritas en la lista ajena).
- [x] typecheck + tests verdes (513/513). Build: pendiente, se corre con el dev server bajo.

## QA manual (IDs propuestos)

| ID | Caso | Criterio |
|----|------|----------|
| FAV-01 | Deslogueado, tocar guardar en una card | Va a login con `callbackUrl`; al volver sigue en la misma búsqueda |
| FAV-02 | Free, primer guardado de la vida | Se crea "Mis lugares" sola y el lugar queda guardado en un tap |
| FAV-03 | Free, tocar guardar en la ficha | Mismo comportamiento que en la card; el estado coincide en las dos pantallas |
| FAV-04 | Free, intentar crear una segunda lista por API (curl con sesión) | Rechazado por el server con código de dominio, no 200 |
| FAV-05 | Premium, crear 2 listas y guardar eligiendo una | El sheet aparece, el lugar cae en la lista elegida |
| FAV-06 | Premium con 3 listas → `UPDATE users SET plan='free'` | `/mis-lugares` muestra solo la default; en la base **siguen las 3 filas** |
| FAV-07 | Volver a `premium` | Reaparecen las 3 listas con sus ítems, sin haber tocado nada |
| FAV-08 | Guardar el mismo lugar dos veces | No duplica; la acción es idempotente |
| FAV-09 | Sacar un lugar | Desaparece de la lista y el botón vuelve a no-guardado; `saves` **no** baja |
| FAV-10 | Despublicar un lugar guardado (`UPDATE places SET operating_status='closed'`) | Sigue en `/mis-lugares`, atenuado, sin link; la ficha da 404 |
| FAV-11 | Usar el `listId` de otro usuario en `POST /api/favoritos` | 403/404, y nada escrito en la lista ajena |
| FAV-12 | Renombrar / borrar la lista default por API | Rechazado |
| FAV-13 | Guardar 5 lugares y revisar `place_impressions_daily` | `saves` = 5 en el día, sin ninguna columna con PII |
| FAV-14 | Página de resultados con 20 cards, todas guardadas | Un solo query de estado (verificable por log/`EXPLAIN`), no 20 |
| FAV-15 | Eliminar la cuenta (`/cuenta`) | Listas e ítems se van con el cascade; no quedan huérfanos |

## Relación con otros specs

- **MONETIZACION**: suma el primer beneficio premium **sin costo marginal** (el chat cuesta tokens
  por mensaje; una lista más cuesta una fila). No toca precios ni el flujo de cobro.
- **VOTACION**: comparten el patrón padre/hijo y el criterio de "la opción guardada sobrevive al
  despublicado". La conexión funcional (armar una votación desde una lista) es v2.
- **BUSQUEDA**: solo el slot en la card. El motor y el orden no se tocan (decisión: no es un
  ranking personalizado).

## v2 (fuera de scope)

- **"Armar votación con esta lista"** — el puente entre retención y loop viral. Es la extensión
  más obvia y la que más valor agrega; queda afuera para no acoplar dos specs en una tanda.
- **Mostrarle al dueño cuántos lo guardaron** (`/mi-negocio`), y desglose pago en el panel B2B.
  El dato se empieza a acumular ahora (decisión 12) justamente para que esto sea posible.
- **Compartir una lista por link** — arrastra moderación y contenido público; no antes de tener
  reportes.
- **Notas por lugar, "ya fui", orden manual, listas colaborativas.**
- **Recomendaciones a partir de lo guardado** — requiere volumen que hoy no existe.

## Esfuerzo

**Dos fases dentro del spec, cerrables por separado:**
**F1** (schema + gate + guardar/sacar desde card y ficha + métrica): una sesión larga.
**F2** (`/mis-lugares`, crear/renombrar/borrar listas, sheet de selección): una sesión.
