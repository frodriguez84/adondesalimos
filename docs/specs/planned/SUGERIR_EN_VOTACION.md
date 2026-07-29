# Spec: SUGERIR_EN_VOTACION — que el grupo sume opciones a la cancha

**Estado:** 🔵 Planned — en diseño
**Prioridad:** Media-alta — #4 del orden de momentum de v2 (IDEAS § Estado de la conversación,
2026-07-27). Es la extensión natural del loop viral: hoy el link circula para *votar*, con esto
circula para *participar*.
**Gate:** Ninguno.
**Bloquea:** nada.
**Depende de:** **VOTACION** (`docs/specs/done/VOTACION.md` — este spec **revierte su decisión 2**,
ver § Relación con otros specs), BUSQUEDA (`/api/search`, `PlaceCard`), CATALOGO
(`lib/db/visibility.ts` — el candado de que la opción sea un lugar real y publicado).

---

## Problema

VOTACION cerró con una asimetría deliberada (su decisión 2): **el creador arma la cancha y los
votantes solo votan**. Fue la decisión correcta para v1 —modelaba el caso simple y evitaba el
problema de permisos— pero en uso real deja dos agujeros:

1. **El grupo no puede corregir la cancha.** El caso concreto: el creador armó 3 bares en
   Palermo y alguien del grupo conoce **el** lugar que falta. Hoy la única salida es escribirlo
   por WhatsApp y que el creador cierre la votación y abra otra — que además consume su cupo de
   "1 activa" si es free.
2. **El votante es pasivo.** Vota entre lo que le dieron y se va. Sumar una opción es el único
   gesto que convierte al que recibió el link en alguien que **aporta** — y el que aportó
   comparte el link de nuevo ("puse el mío, voten").

Y hay una trampa que el spec tiene que cerrar de entrada: si "sugerir" se implementa como **texto
libre**, la votación se llena de nombres que no son lugares del catálogo (mal escritos,
duplicados, inexistentes), sin ficha, sin zona y sin nada que mostrar. La opción tiene que ser un
lugar **real y publicado**, siempre.

## Objetivo

Que cualquiera con el link pueda **sumar un lugar del catálogo** a una votación abierta, con
techo duro de opciones y con el creador pudiendo quitar lo que no va.

## Qué NO es esta feature

- **No hay texto libre.** Nunca. Una opción es un `place_id` publicado, validado server-side
  (decisión 4). No se agrega un campo "nombre del lugar" ni un "otro".
- **No pide cuenta al votante.** La decisión 1 de VOTACION ("los votantes JAMÁS") no se toca: la
  identidad sigue siendo la cookie `voter_id`.
- **No hay moderación previa.** La sugerencia entra y se puede votar al instante (decisión 3).
- **No hay notificaciones.** El creador no recibe mail ni push cuando alguien suma algo — el
  proyecto no tiene cron ni push y este spec no los agrega.
- **No se editan las opciones originales del creador.** VOTACION no tiene edición de la shortlist
  y no se agrega acá: el poder de moderación se limita a las sugerencias (decisión 8).
- **No cambia nada del voto ni del cierre**: `poll_votes`, la definición de "activa", la
  expiración lazy de 72 h, el cierre con ganador y la pantalla de solo-lectura quedan como están.
- **No usa IA.** El botón premium "que la IA arme la shortlist" (CHAT_IA F3) es otro camino y no
  se toca.

## Decisiones cerradas

| # | Decisión |
|---|----------|
| 1 | **Puede sugerir cualquiera con el link** — el mismo que ya puede votar. **Decidido por Fer, 2026-07-29** (alternativas evaluadas: moderación previa del creador, que mata el momentum si no mira el celular; y solo-el-creador, que no es la feature). Justificación del riesgo: quien tiene el token ya podía votar y ya podía inclinar el resultado; sumar una opción no le da un poder nuevo sobre alguien. El link circula entre amigos, no en la vía pública. |
| 2 | **Techo duro: 8 opciones por votación** (constante `MAX_OPCIONES` documentada, igual criterio que `VOTACION_TTL_HORAS`). El creador sigue poniendo **2-5** al crear (decisión 3 de VOTACION, intacta); las sugerencias llenan lo que queda hasta 8. La preocupación original de esa decisión ("más de 5 diluye") era el creador solo con 9 lugares; acá **cada opción extra viene con alguien que la quiere**, que es justamente lo que la vuelve votable. Llegado a 8, el botón de sugerir se apaga con el motivo a la vista. |
| 3 | **La sugerencia entra directo y es votable al instante.** Sin estado `pendiente`, sin aprobación. Los votos ya emitidos **no se tocan**: los porcentajes en vivo se recalculan solos sobre el total nuevo. |
| 4 | **Candado de grounding: el server valida el `place_id` contra el catálogo publicado**, con `isPlacePublished`/`publishedWhere` (`lib/db/visibility.ts`, fuente única) — exactamente el mismo chequeo que hace `crearVotacion` para la shortlist del creador (decisión 12 de VOTACION). **Nota de divergencia:** el prompt de autoría sugería reusar `lib/ai/grounding.ts`; **no aplica** — ese módulo valida *marcadores de texto de la IA* (`[[lugar:id]]`) contra los IDs que las tools devolvieron en una conversación. Acá no hay IA ni texto. Lo que se reusa es el **criterio** ("el server no le cree al cliente qué lugares existen") y el dueño único de la visibilidad. |
| 5 | **El buscador para sugerir reusa `/api/search` tal cual**, sin endpoint nuevo: un campo de búsqueda por nombre + zona dentro de un `bottom-sheet` en la página de voto, que muestra `PlaceCard`s y un botón "Sumar". Consecuencia aceptada y explícita: esas búsquedas **cuentan impresiones** como cualquier otra (el endpoint ya hace `registrarImpresiones` + `registrarTagsDeBusqueda` en un `after()`), lo cual es correcto — el lugar efectivamente se le mostró a alguien. |
| 6 | **Solo se puede sugerir en una votación abierta**, con la misma definición de "activa" de la decisión 11 de VOTACION (`status='open' AND expires_at > now()`). Cerrada, expirada o cancelada: la pantalla de solo-lectura no ofrece sugerir. |
| 7 | **Tope de 2 sugerencias por dispositivo y por votación** (`MAX_SUGERENCIAS_POR_VOTANTE = 2`). Evita que uno solo se quede con todas las vacantes; deja margen para que dos o tres personas aporten. Se cuenta por `voter_token`, con el mismo trade-off asumido en la decisión 7 de VOTACION (la cookie es evadible y está bien que lo sea: el stake es decidir un asado). |
| 8 | **El creador puede quitar sugerencias, no las opciones originales.** Es el poder de moderación mínimo que hace innecesaria la aprobación previa. Quitar una sugerencia **borra sus votos** por el cascade de `poll_votes.option_id` — así que la UI avisa cuántos votos se pierden antes de confirmar, y el votante que había elegido esa opción encuentra su voto vacío y puede votar de nuevo (la pantalla lo dice; no se lo reasigna en silencio). |
| 9 | **El que sugiere NO vota automáticamente.** Después de sumar el lugar, la UI le ofrece votarlo ("¿La votás?"). Auto-votar cambiaría su voto anterior sin pedírselo, y revotar es un `UPDATE` (decisión 8 de VOTACION) — un efecto invisible sobre algo que ya había decidido. |
| 10 | **El creador puede cerrar las sugerencias de *su* votación**: `polls.allow_suggestions boolean not null default true`, elegible al crear y cambiable desde su panel. Default `true` — con `false` por default la feature no existiría en la práctica. Es la respuesta honesta a "no quiero que me ensucien la cancha" sin bloquear a todos los demás. |
| 11 | **Se distingue visualmente lo sugerido**: badge "Lo sumó alguien del grupo" en la opción. **Sin identidad**, porque no existe: los votantes son anónimos por diseño. Le da contexto al creador para moderar y al grupo para entender que la cancha creció. |
| 12 | **El `voter_token` de quien sugirió se guarda pero NUNCA se expone a ningún cliente** — mismo invariante que `poll_votes.voter_token` (decisiones 7 y 21 de VOTACION). Se usa para dos cosas server-side: el tope de la decisión 7 y permitir que el que sugirió **saque su propia** sugerencia mientras nadie la haya votado. |
| 13 | **Rate limit propio: `checkSugerenciaRateLimit`**, generoso como el del voto (todo el grupo cae desde la misma WiFi o el mismo CGNAT: la IP no es la identidad). Cupo con prefijo propio, sin compartir bucket. |
| 14 | **Endpoints, con el patrón fino de `POST /api/votaciones/[token]/voto`** (rate limit → cookie `voter_id` —creándola si falta— → zod → acción de dominio → `{data, error:{message, code}}`): <br>· `POST /api/votaciones/[token]/opciones` `{placeId}` <br>· `DELETE /api/votaciones/[token]/opciones/[optionId]` (creador con sesión, o el que la sugirió si no tiene votos) |

## Schema (migración aditiva)

```
poll_option_origin  enum ('creator', 'voter')

poll_options
  + origin        poll_option_origin not null default 'creator'
  + suggested_by  text                       -- voter_token; NUNCA se expone (decisión 12)
  + created_at    timestamp not null default now()
  index (poll_id, suggested_by)               -- el tope de la decisión 7

polls
  + allow_suggestions  boolean not null default true   -- decisión 10
```

`origin` con default `'creator'` deja las filas existentes correctas sin backfill. Las
sugerencias toman `position = max(position) + 1` dentro de la votación (van al final: la cancha
del creador se lee primero).

## Implementación

| Archivo | Qué |
|---------|-----|
| `lib/db/schema.ts` + `drizzle/` | El enum, las 3 columnas, el índice (aditivo) |
| `lib/votaciones/acciones.ts` | `sugerirOpcion(token, placeId, voterToken)` · `quitarOpcion(token, optionId, quien)`. **Todos** los gates (abierta · `allow_suggestions` · techo 8 · tope 2 por votante · lugar publicado · duplicado) viven acá |
| `lib/votaciones/validacion.ts` | Schema zod de `{placeId}` |
| `lib/votaciones/query.ts` | La query de la página suma `origin` (y **no** `suggested_by`) a lo que viaja al cliente |
| `app/api/votaciones/[token]/opciones/route.ts` + `[optionId]/route.ts` | Adaptadores finos |
| `app/votacion/[token]/*-client.tsx` | Botón "Sumar un lugar" → sheet con el buscador; badge de sugerida; quitar (creador) |
| `lib/middleware/rate-limit.ts` | `checkSugerenciaRateLimit` |
| `app/votacion/nueva/*` + panel del creador | El check de `allow_suggestions` |

## Edge cases

- **Sugerir un lugar que ya está en la votación** → rechazado por el índice único
  `(poll_id, place_id)` que ya existe; la UI lo marca como "ya está" en el buscador, no como error.
- **Dos personas sugieren a la vez con 1 vacante** → el techo se valida dentro de la transacción
  de inserción; la segunda recibe el error de techo lleno, no una novena opción.
- **Sugerir un lugar que se despublica después** → la opción **sigue** (decisión ya tomada en
  VOTACION: "si un lugar se vuelve invisible después, la opción sigue"). El chequeo de publicado
  es del momento de sugerir.
- **La votación expira mientras alguien tiene el sheet abierto** → el `POST` responde con el
  código de "no está abierta" y la pantalla pasa a solo-lectura; no se inserta nada.
- **El creador cierra las sugerencias con el sheet de alguien abierto** → mismo camino: el gate
  está en la acción de dominio, no en la UI.

## Criterios de done (DoD)

- [ ] Migración aditiva aplicada; las votaciones existentes quedan con `origin='creator'`,
      `allow_suggestions=true` y sin backfill manual.
- [ ] Cualquiera con el link puede sumar un lugar del catálogo a una votación abierta, **sin
      cuenta**, y la opción es votable de inmediato.
- [ ] **No existe ningún camino a una opción con texto libre**: el único input aceptado es un
      `placeId`, validado contra `isPlacePublished` en el server (test: un uuid de un lugar
      despublicado y un uuid inventado, los dos rechazados).
- [ ] El techo de 8 opciones se aplica **en el server** y no se puede exceder ni con requests
      concurrentes (test).
- [ ] El tope de 2 sugerencias por `voter_token` se aplica en el server.
- [ ] `suggested_by` **nunca** aparece en una respuesta de API ni en el HTML de la página
      (verificable por `grep` en la query y en el cliente).
- [ ] El creador puede quitar una sugerencia (con aviso de votos perdidos) y **no** puede quitar
      una opción original.
- [ ] El que sugirió puede sacar su propia sugerencia mientras no tenga votos.
- [ ] Con `allow_suggestions = false` no hay camino a sugerir: ni botón, ni endpoint (403).
- [ ] Votación cerrada / expirada / cancelada: no se puede sugerir; la pantalla sigue siendo
      solo-lectura y **nunca** un 404 (decisión 15 de VOTACION, sin regresión).
- [ ] Los votos previos siguen contando y los porcentajes en vivo se recalculan con la opción
      nueva incluida.
- [ ] Rate limit propio activo, sin compartir bucket con voto ni con búsqueda.
- [ ] Las opciones sugeridas se distinguen en la UI sin revelar identidad.
- [ ] typecheck + tests + build verdes.

## QA manual (IDs propuestos)

| ID | Caso | Criterio |
|----|------|----------|
| SUG-01 | Abrir el link en incógnito (sin cuenta) y sumar un lugar buscándolo | Se agrega, aparece con el badge y se puede votar en el mismo gesto |
| SUG-02 | Sumar un lugar ya presente en la votación | El buscador lo muestra como "ya está"; no se duplica |
| SUG-03 | `POST /api/votaciones/[token]/opciones` con un `placeId` inventado | Rechazado (422/400), nada insertado |
| SUG-04 | Idem con el id de un lugar despublicado | Rechazado |
| SUG-05 | Idem con `{placeId: "Bar de la esquina"}` (texto libre) | Rechazado por zod, sin tocar la base |
| SUG-06 | Llegar a 8 opciones y volver a sugerir | Botón apagado con el motivo; el `POST` directo también falla |
| SUG-07 | Sugerir 3 veces desde el mismo dispositivo | La tercera es rechazada por el tope de 2 |
| SUG-08 | Votar una sugerencia y que el creador la quite | Aviso de votos perdidos; al confirmar, la opción y sus votos se van; el votante ve que puede votar de nuevo |
| SUG-09 | Creador intenta quitar una de sus opciones originales | No hay botón, y el `DELETE` directo devuelve 4xx |
| SUG-10 | El que sugirió quita su sugerencia (sin votos) | Se va; si ya tiene votos, no puede |
| SUG-11 | Crear una votación con sugerencias desactivadas | No hay botón de sumar y el endpoint da 403 |
| SUG-12 | Sugerir en una votación expirada (forzar `expires_at` al pasado) | Pantalla solo-lectura, sin sugerir, sin 404 |
| SUG-13 | Revisar el HTML/JSON de la página de voto | No aparece ningún `voter_token`/`suggested_by` |
| SUG-14 | Dos navegadores sugiriendo con 1 vacante libre, casi simultáneos | Entra uno; el otro recibe techo lleno |
| SUG-15 | Preview del link en WhatsApp después de una sugerencia | Sigue sin disparar llamadas pagas (decisión 22 de VOTACION, sin regresión) |

## Relación con otros specs

- **VOTACION (`done/`) — este spec revierte su decisión 2.** Esa decisión decía textualmente: *"Los
  votantes NO agregan opciones. El creador arma la shortlist y esa es la cancha. Sugerir lugar =
  mejora futura"*. Esta **es** esa mejora futura. Al cerrar este spec hay que anotar la reversión
  en `VOTACION.md` (una línea en su decisión 2 apuntando acá), para que nadie lea el spec cerrado
  y lo tome como vigente. Su decisión 3 (2-5 del creador) **no** se revierte: sigue siendo el
  rango del alta; lo que cambia es el techo total (decisión 2 de acá).
- **BUSQUEDA**: se reusa `/api/search` sin cambios, con sus impresiones (decisión 5).
- **FAVORITOS** (`planned/`): si se implementa antes, su v2 "armar una votación desde una lista"
  se apoya en esta feature.
- **CHAT_IA F3**: el modo shortlist sigue siendo un camino independiente para *crear*; no se cruza.

## Esfuerzo

**Una sesión larga**: migración aditiva chica, dos endpoints con el patrón existente, todos los
gates en la acción de dominio, y el sheet de búsqueda en la página de voto (que reusa componentes
que ya existen).
