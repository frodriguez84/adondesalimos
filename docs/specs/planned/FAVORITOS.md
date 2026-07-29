# Spec: FAVORITOS — guardar lugares y listas

**Estado:** 🔵 Planned — en diseño
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
| 13 | **Rate limit propio: `checkFavoritosRateLimit`** en `lib/middleware/rate-limit.ts`, con prefijo propio, generoso (guardar es una acción legítima y repetida) pero acotado — es un endpoint autenticado que escribe. Mismo patrón que los 12 cupos que ya existen. |
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

## Criterios de done (DoD)

**Modelo y gate**

- [ ] Migración aditiva aplicada; `npm run db:migrate` no destruye nada y el seed sigue idempotente.
- [ ] `lib/favoritos/planes.ts` es el **único** módulo que decide cuántas listas puede tener un
      usuario (verificable por `grep`); el gate de plan sigue saliendo de `esPremium`.
- [ ] Un usuario **free** que intenta crear una segunda lista recibe error **desde el server**
      (test de integración con el endpoint, no solo con la UI escondida).
- [ ] Un usuario **premium** puede crear hasta `favoritos.max_listas_premium` listas; la N+1 falla.
- [ ] Bajar el plan a `free` **no borra ninguna fila**: las listas no-default quedan y dejan de
      listarse; volver a `premium` las muestra de nuevo, con sus ítems intactos (test).
- [ ] La lista default no se puede borrar ni renombrar (test de la acción de dominio).
- [ ] Un lugar no se puede duplicar en la misma lista (índice único + acción idempotente).

**Guardar / sacar**

- [ ] Desde la card del listado y desde la ficha, un tap guarda el lugar (free: directo a la
      default, creándola si es el primer guardado; premium con >1 lista: sheet de selección).
- [ ] El botón refleja el estado real al cargar la página (server-side, decisión 9) y no dispara
      una query por card.
- [ ] Sin sesión, el botón lleva a `/login?callbackUrl=…` y al volver el usuario queda en la
      misma búsqueda.
- [ ] `PlaceCard` sigue sin lógica de datos: el diff en ese archivo es solo el prop `accion`.
- [ ] Sacar un lugar lo quita de la lista y el botón vuelve al estado no-guardado sin recargar.

**Página `/mis-lugares`**

- [ ] Sin sesión redirige a login; con sesión muestra las listas visibles y sus lugares (más
      recientes primero).
- [ ] Un lugar despublicado sigue apareciendo, atenuado, con "ya no está disponible" y sin link
      (decisión 11).
- [ ] Premium puede crear, renombrar y borrar listas no-default desde la página.
- [ ] Link presente en el `AccountMenu`.

**Métrica y seguridad**

- [ ] Guardar suma +1 a `place_impressions_daily.saves` del día, en un `after()`, sin `user_id`
      ni ninguna otra PII en la fila.
- [ ] Sacar un favorito **no** descuenta el contador (es un histórico de eventos, no un stock).
- [ ] Todos los endpoints: sesión verificada inline **antes** de mirar el payload (lección INT-14
      de PULIDO), rate limit propio, y **nunca** operan sobre una lista de otro usuario (test:
      un `listId` ajeno devuelve 403/404, no 200).
- [ ] typecheck + tests + build verdes.

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
