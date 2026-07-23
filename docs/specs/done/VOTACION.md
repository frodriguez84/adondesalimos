# Spec: Votación en grupo ("¿a dónde salimos?")

**Estado:** ✅ Implementado (2026-07-22) — 3 fases cerradas (F1 crear+shortlist+gate · F2 votar anónimo+resultados en vivo · F3 cierre+desempate+panel). QA APROBADO (VOT-01..15), ver `docs/qa/AnalisisQA.md`. Gate técnico verde: typecheck · 381 tests · build
**Prioridad:** Alta — es el **loop viral** del producto: cada link compartido lleva la app a un grupo nuevo sin costo de adquisición. Es la única feature de v1 que trae usuarios en vez de solo servirlos
**Gate:** Ninguno para el free (1 votación activa). El tramo premium (ilimitadas · IA arma shortlist · historial) queda **modelado pero apagado** hasta el spec 7 (MercadoPago)
**Bloquea:** nada
**Depende de:** AUTH (sesión inline con `getSession`, `requireEmailVerification: true`, rate limit propio en `lib/middleware/rate-limit.ts`, patrón de tablas sin columna `role`) · BUSQUEDA (`lib/search` + `publishedWhere` para armar la shortlist) · FICHA (`PlaceCard`, `getPlaceDetail` para render de opciones) · CATALOGO (`lib/db/visibility.ts` — solo se votan lugares publicados)

---

## Problema

Decidir a dónde salir **en grupo** es el momento donde la app se abandona: uno busca, encuentra
tres lugares que le sirven, y ahí la decisión se muda a un grupo de WhatsApp donde se pierde en
mensajes. La app resuelve la búsqueda individual (specs 1-4) pero no la **decisión colectiva**,
que es el problema real de "¿a dónde salimos?".

Y ese momento es justo el de mayor potencial de crecimiento: cuando alguien comparte su
shortlist al grupo, la app entra a un grupo entero de gente que no la tiene. Hoy no existe la
pieza que convierta "yo encontré tres lugares" en "votemos entre estos tres" — y con ella, cada
decisión de salida es un canal de adquisición.

## Objetivo

1. **Crear una votación** (usuario autenticado): arma una shortlist de **2-5 lugares** del
   catálogo publicado reusando la búsqueda existente, y obtiene un **link compartible**.
2. **Votar sin cuenta** (el loop viral): cualquiera que reciba el link vota **sin registrarse**.
   Un voto por dispositivo, cambiable mientras esté abierta; anti-doble-voto sin login.
3. **Resultados en vivo** mientras la votación está abierta — ver que tu lugar va ganando es lo
   que empuja a compartir de nuevo.
4. **Cierre y desempate del creador**: cierra cuando quiere y elige el ganador (default = el más
   votado). El link expira solo a las **72 hs** si no lo cerró antes.
5. **Freemium desde el día 1, server-side**: free = **1 votación activa a la vez**. El tramo
   premium (ilimitadas · IA arma la shortlist · historial navegable) queda **modelado y gateado**,
   pero el cobro que lo enciende es del spec 7.

## Qué NO es esta feature

- **Cobro / suscripción premium** (spec 7). Acá el plan del usuario es un flag manual
  (`users.plan`, mismo criterio que `owner_plan` en AUTH) y el gate premium está construido pero
  no hay forma de volverse premium todavía salvo un `UPDATE`.
- **IA que arma la shortlist** (premium → spec 7/8): en v1 el creador elige los lugares a mano.
  El gate existe; la IA detrás, no.
- **Historial navegable de votaciones pasadas** como feature (premium). En free, una votación
  cerrada sigue siendo accesible **por su link**, pero no hay una lista persistente de "todas mis
  votaciones" — eso es premium.
- **Que los votantes agreguen opciones.** "El que arma la votación arma la cancha" (IDEAS). Sugerir
  un lugar es mejora futura. → BACKLOG.
- **Chat / comentarios dentro de la votación**: se vota, no se conversa. La conversación vive en
  el grupo de WhatsApp donde se compartió el link.
- **Notificaciones** (push/mail de "cerró la votación", "alguien votó"): fuera de v1. → BACKLOG.
- **Votar lugares invisibles** (bajo umbral, sin ficha pública): solo se agregan lugares
  publicados — la opción tiene que poder abrir su ficha.
- **Cron / worker de expiración**: la expiración se resuelve **lazy** al leer (patrón del matching
  perezoso de FICHA). El proyecto no tiene infra de cron y este spec no la agrega.

## Decisiones cerradas

Las 1-6 vienen de IDEAS.md § "Feature: votación en grupo" y § planes (no se reabren); las 7-24 son
diseño de **este** spec y cierran las preguntas abiertas que traía la feature.

| # | Decisión |
|---|----------|
| 1 | **El creador necesita cuenta; los votantes JAMÁS** (IDEAS). Ahí está el loop viral: pedir registro para votar mataría la difusión. Si un votante resulta tener cuenta, no cambia nada — vota igual, anónimo |
| 2 | **Los votantes NO agregan opciones** (IDEAS). El creador arma la shortlist y esa es la cancha. Sugerir lugar = mejora futura |
| 3 | **Shortlist de 2-5 lugares** (IDEAS). Menos de 2 no es una votación; más de 5 diluye la decisión y ensucia el link |
| 4 | **El creador cierra cuando quiere y desempata él** (IDEAS). El cierre es una acción suya, no automática por umbral de votos |
| 5 | **Free = UNA votación activa a la vez** (IDEAS, no "una por mes"): cubre el caso real de una persona normal, no frustra, y mata el incentivo multi-cuenta (una segunda cuenta solo daría dos votaciones simultáneas, caso rarísimo). Premium = **ilimitadas + IA arma shortlist + historial** |
| 6 | **Anti-abuso v1** (IDEAS): el creador ya pasó por email verificado obligatorio (AUTH) + rate limit por IP. Los votantes se acotan con identidad por dispositivo + rate limit por IP (decisión 9) |
| 7 | **Identidad del votante = cookie opaca por dispositivo, NO IP.** Al abrir el link se setea una cookie `voter_id` (UUID opaco, `httpOnly`, `SameSite=Lax`, larga duración, reutilizada entre votaciones). El voto se ancla a ese token. **La IP NO es la identidad** — todo un grupo de WhatsApp junto en una WiFi (o detrás de CGNAT móvil) comparte IP y se pisaría los votos, que es exactamente el caso de uso. La IP se usa **solo como rate-limit** (decisión 9). Trade-off aceptado explícitamente: la cookie es evadible (incógnito, borrar cookies, otro navegador), y **está bien que lo sea** — el stake es decidir un asado entre amigos, no una elección con validez legal. Encarecer el anti-fraude arruinaría el caso de uso a cambio de proteger algo que no lo vale. La cookie es **funcional** (dedupe de voto), no analítica: no se cruza con métricas, no hay `user_id`, no rastrea entre sitios |
| 8 | **El voto es cambiable mientras la votación esté abierta.** Restricción única `(poll_id, voter_token)`: revotar = `UPDATE` de `option_id`, no una fila nueva. Al reabrir el link, el votante ve su elección actual marcada. Cerrada o expirada ⇒ el voto queda congelado |
| 9 | **Rate limit propio con el helper existente** (`lib/middleware/rate-limit.ts`, memoria de proceso — mismo criterio que AUTH, sin advisory locks): `POST /api/votaciones` (crear) **3/día por IP** (reusa exactamente el cupo de claims: cada poll es barato pero acota spam); `POST /api/votaciones/[token]/voto` **20/min por IP** (generoso: un grupo entero vota casi a la vez desde la misma IP; solo corta el bot que borra cookies en loop). Cupos con prefijo propio, no comparten bucket |
| 10 | **El link es un token aleatorio no adivinable** (`nanoid`/uuid), nunca el id secuencial: la URL `/votacion/[token]` es la *capability* — quien tiene el token, vota. Evita enumerar votaciones ajenas. El token va en la fila, indexado único |
| 11 | **Expiración lazy, no cron.** `expires_at = created_at + 72 hs` (máximo del rango 48-72 de IDEAS: un fin de semana entero para que el grupo vote). **"Activa" se define como `status='open' AND expires_at > now()`** — una votación vencida cuenta como cerrada aunque su columna `status` siga `'open'`. Al leerla, si venció, se muestra en modo cerrado (y se persiste el cierre en ese acceso, best-effort). Sin worker: el proyecto no tiene cron y este spec no lo agrega. La duración es una **constante documentada** (`VOTACION_TTL_HORAS`); moverla a `app_settings` es sobre-ingeniería para v1 → nota en el código |
| 12 | **La shortlist se arma reusando la búsqueda existente**, no un selector nuevo: `/votacion/nueva` embebe el motor de `lib/search` (mismo `publishedWhere`) y el creador va agregando lugares hasta 2-5. Las opciones se renderizan con `PlaceCard` (FICHA/shared). **Solo lugares publicados** (`isPlacePublished`): un invisible no tiene ficha que compartir |
| 13 | **Resultados visibles EN VIVO** para todos, no solo al cerrar: ver el conteo/% por opción mientras está abierta es lo social y lo que empuja a re-compartir ("vamos 2 a 2, voten"). Es el motor del loop viral, no un lujo. Conteo agregado por opción — nunca quién votó qué |
| 14 | **Cierre = acción del creador que elige el ganador.** Al cerrar (`status→'closed'`, `closed_at`), el creador **confirma el ganador** entre las opciones, con default en el más votado. Esto cubre de un solo camino el empate (decisión 4: desempata él) y el caso "ganó X pero elijo Y" (él arma la cancha). Queda `winner_place_id`. Solo el creador (sesión) puede cerrar |
| 15 | **Link cerrado o expirado ⇒ pantalla de resultados en solo-lectura**, con el ganador si se eligió — **nunca un 404**. El link circula por WhatsApp mucho después; el que llega tarde debe ver "esta votación cerró, ganó *Tal Lugar*", no un error. No se puede votar |
| 16 | **El gate free/premium se aplica server-side desde el día 1** (mismo principio que `owner_plan` en AUTH — *"subir un cupo es un regalo; bajarlo es una traición"*). Al crear una votación, si el usuario **no es premium** y ya tiene una **activa** (definición de la decisión 11), el `POST` responde 4xx con mensaje claro ("Cerrá tu votación actual o esperá a que expire para abrir otra"). El chequeo es una query de conteo, no confía en el cliente |
| 17 | **El plan premium del usuario se modela con `users.plan`** (`pgEnum 'free'·'premium'` not null default `'free'`), gateado por un único helper `esPremium(userId)` — espejo B2C de `owner_plan` (que es B2B, por lugar). Hasta el spec 7 se cambia con un `UPDATE` documentado; el spec 7 lo automatiza con MercadoPago. **Alternativa descartada**: tabla `user_subscriptions` aparte — se descarta para v1 por YAGNI (una fila por usuario premium y ningún dato de suscripción todavía); el spec 7 puede introducirla y migrar el flag si el cobro lo pide. Ver "Relación con otros specs" |
| 18 | **La IA que arma la shortlist es premium y NO se construye acá** (spec 7/8). El gate existe (un botón "que la IA elija" visible solo a premium, deshabilitado/oculto en free), pero detrás no hay llamada a IA en v1. Modelar el lugar del botón, no el botón |
| 19 | **El historial navegable es premium.** Free: "Mis votaciones" muestra la **activa** (para gestionarla/cerrarla) y nada más; las cerradas siguen vivas por su link. Premium: lista persistente de todas las pasadas. El gate se aplica en la query de esa vista |
| 20 | **Solo el creador ve la identidad de "su" votación en el panel; el votante nunca necesita cuenta ni ve un panel** — solo la página pública `/votacion/[token]`. Sin sesión no hay nada que verificar del lado del votante |
| 21 | **Modelo de datos: tres tablas nuevas** (`polls`, `poll_options`, `poll_votes`) + la columna `users.plan`. Detalle abajo. Los votos son **agregado a nivel opción**: el conteo sale de `poll_votes` con `GROUP BY option_id`, sin exponer el `voter_token` a ningún cliente |
| 22 | **La página `/votacion/[token]` es server-render sin Google ni IA**: lee solo nuestra DB (datos base de `places` de las opciones + conteos). Barato de crawlear — el preview de WhatsApp del link (título + lugares) **no dispara ninguna llamada paga** (contrasta con la ficha, cuyo bloque Google va al cliente justo por eso, FICHA). `generateMetadata` arma un OG estático con el título y los nombres de los lugares |
| 23 | **Envelope de respuesta `{ data, error }`** en todos los endpoints nuevos (patrón del proyecto: `claims`, `search`). Códigos de dominio → status con un mapa, igual que `POST /api/claims` |
| 24 | **Borrar / cancelar una votación**: el creador puede cancelarla (`status→'cancelled'`) desde su panel — libera el cupo de "1 activa" al instante sin esperar la expiración. No se borra la fila (los votos ya emitidos son dato); el link pasa a modo solo-lectura "cancelada" |

### Modelo de datos (migración sobre AUTH)

**`users`** — columna nueva: `plan` pgEnum `'free'`·`'premium'` not null default `'free'`
(decisión 17). Se agrega a la tabla que maneja better-auth vía **additionalFields** (verificar el
patrón exacto en `lib/auth/index.ts` — StressPlan ya extiende el user; no inventar un mecanismo
nuevo). Si extender la tabla de better-auth resultara friccionado al implementar, el fallback es la
tabla `user_subscriptions(user_id pk, plan)` de la decisión 17 — decidir en F1 con el código de
better-auth a la vista, y anotarlo.

**`polls`** — la votación.

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | uuid pk | |
| `creator_id` | fk → `users` on delete cascade, not null | el creador siempre tiene cuenta |
| `token` | text unique not null | el del link (`nanoid`, no adivinable — decisión 10) |
| `title` | text nullable | opcional (ej. "¿Dónde el viernes?"); si falta, se arma uno con los nombres |
| `status` | pgEnum `'open'`·`'closed'`·`'cancelled'` not null default `'open'` | expirada = `'open'` + `expires_at` pasado (decisión 11) |
| `winner_place_id` | fk → `places` nullable | lo fija el creador al cerrar (decisión 14) |
| `created_at` | timestamp not null | |
| `expires_at` | timestamp not null | `created_at + VOTACION_TTL_HORAS` |
| `closed_at` | timestamp nullable | |

Índice por `creator_id` (panel "Mis votaciones" + query del gate "1 activa"). Índice único por `token`.

**`poll_options`** — los lugares de la shortlist (2-5 por poll).

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | uuid pk | |
| `poll_id` | fk → `polls` on delete cascade, not null | |
| `place_id` | fk → `places`, not null | solo lugares publicados al crear (decisión 12) |
| `position` | int not null | orden en que el creador los puso |

Único `(poll_id, place_id)` — no repetir un lugar en la misma votación.

**`poll_votes`** — los votos (agregado por opción; nunca se expone el token).

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | uuid pk | |
| `poll_id` | fk → `polls` on delete cascade, not null | denormalizado para la restricción única y el conteo |
| `option_id` | fk → `poll_options` on delete cascade, not null | |
| `voter_token` | text not null | el UUID de la cookie `voter_id` (decisión 7) |
| `created_at` | timestamp not null | |
| `updated_at` | timestamp not null | revotar actualiza esto (decisión 8) |

Índice único `(poll_id, voter_token)` — un voto por dispositivo por votación; revotar es `UPDATE`.
Índice por `option_id` (conteo `GROUP BY`).

**Env nuevas:** ninguna. La cookie `voter_id` no necesita secreto (es un identificador opaco, no
firmado — no protege nada que valga falsificar; decisión 7).

### Rutas

| Ruta | Qué |
|------|-----|
| `app/votacion/nueva` | crear votación (sesión requerida): buscador embebido (`lib/search`) → agregar 2-5 lugares → título opcional → generar link. Aplica el gate "1 activa" (decisión 16) |
| `app/votacion/[token]` | **página pública** (sin sesión): opciones con `PlaceCard`, conteo en vivo, botón de voto. Cerrada/expirada/cancelada ⇒ solo-lectura con ganador (decisión 15). `generateMetadata` con OG estático (decisión 22) |
| `app/mis-votaciones` | panel del creador (sesión): free = la activa; premium = historial (decisión 19). Acciones: cerrar (elegir ganador), cancelar |
| `app/api/votaciones` | `POST` crear votación (rate limit 3/día/IP · sesión inline · gate "1 activa" · valida 2-5 lugares publicados) |
| `app/api/votaciones/[token]/voto` | `POST` votar/revotar (rate limit 20/min/IP · lee/crea cookie `voter_id` · valida votación abierta · upsert por `(poll_id, voter_token)`) |
| `app/api/votaciones/[token]` | `PATCH` cerrar (con `winner_place_id`) o cancelar — **solo el creador** (sesión inline, verifica `creator_id`) |
| La home / header | gana una entrada "Armar votación" / "Mis votaciones" en el menú de cuenta (junto a "Mi negocio"). Ningún otro cambio en búsqueda ni ficha |

### Reuso obligatorio (regla de CLAUDE.md § "código acumulado es contexto")

- **Sesión inline**: `auth.api.getSession({ headers })` con `.catch(() => null)`, exactamente como
  `app/api/claims/route.ts:32`. No hay `middleware.ts` global (AUTH decisión 9).
- **Rate limit**: agregar `checkVotacionesRateLimit` (reusa `CLAIMS_MAX`/ventana diaria) y
  `checkVotoRateLimit` (nueva ventana 20/min) en `lib/middleware/rate-limit.ts`, con el mismo
  `checkIpRateLimit` compartido. No reimplementar el bucket.
- **Búsqueda**: el selector de lugares reusa `lib/search` y `publishedWhere`/`isPlacePublished`
  (`lib/db/visibility.ts`). No una segunda query de catálogo.
- **Render de lugar**: `PlaceCard` (`components/shared`) para las opciones; los nombres/datos base
  salen del mismo lugar que la ficha, sin Google.
- **Envelope y mapa de status**: patrón `{ data, error }` + `STATUS_POR_CODIGO` de `claims/route.ts`.

### Fases

| Fase | Alcance | Verificable con |
|------|---------|-----------------|
| **1 — Crear + shortlist + gate** | Migración (`polls`, `poll_options`, `poll_votes`, `users.plan`), `esPremium`, `/votacion/nueva` con búsqueda embebida, `POST /api/votaciones` con gate "1 activa" server-side, generación del token/link, entrada en el header | Un free crea una votación y obtiene link; al intentar una segunda activa recibe 4xx; un usuario con `plan='premium'` (UPDATE manual) crea varias |
| **2 — Votar anónimo + resultados en vivo** | `/votacion/[token]` público, cookie `voter_id`, `POST .../voto` (votar y revotar), conteo en vivo por opción, rate limit del voto, expiración lazy, OG estático | Tres navegadores distintos votan y el conteo sube; revotar cambia la elección sin sumar; borrar la cookie permite otro voto (evasión aceptada); un link abierto por 4º dispositivo tras expirar muestra solo-lectura |
| **3 — Cierre + desempate + panel** | `PATCH .../[token]` cerrar (elegir ganador) y cancelar, `/mis-votaciones` (free = activa · premium = historial gateado), pantalla de cerrada/expirada/cancelada con ganador | El creador cierra eligiendo ganador ≠ el más votado y queda registrado; cancelar libera el cupo "1 activa"; un no-creador no puede cerrar (403) |

## Edge cases

- **Votación con menos de 2 o más de 5 lugares**: rechazada al crear (decisión 3), server-side.
- **Un lugar de la shortlist se vuelve invisible después de crear la votación** (revocan un
  reclamo, baja el confidence): la opción **sigue en la votación** (ya es parte de la cancha) y se
  puede votar; su ficha pública podría no abrir. Aceptado — congelar la shortlist al crear es más
  simple que re-validar en cada lectura, y el caso es raro. → nota en el código.
- **Votar en una votación cerrada / expirada / cancelada**: el `POST` de voto responde 4xx (no
  409 silencioso — mensaje claro "esta votación ya cerró"). La página ya la muestra en solo-lectura.
- **Revotar la misma opción** (click en lo que ya votó): idempotente, no duplica ni mueve el conteo.
- **Cerrar una votación ya cerrada** (doble click): `PATCH` idempotente, no re-elige ganador ni
  pisa `closed_at`.
- **Creador sin cookie que vota en su propia votación**: puede votar como un anónimo más (tiene su
  `voter_id`); su rol de creador no le da voto extra ni se lo quita. Un voto por dispositivo, él
  incluido.
- **Empate al cerrar**: no hay desempate automático — el creador elige (decisión 14). El default
  sugerido con empate puede ser el de menor `position` (determinista), pero decide él.
- **`voter_id` presente pero de otra votación**: la restricción es `(poll_id, voter_token)`, así que
  el mismo dispositivo vota una vez en *cada* votación distinta — correcto, no un bug.
- **Free intenta 2ª votación activa teniendo una expirada sin cerrar**: la expirada **no cuenta como
  activa** (decisión 11) ⇒ se le permite crear la nueva. El gate consulta `status='open' AND
  expires_at > now()`, no solo `status`.
- **Usuario borra su cuenta con votaciones abiertas**: `on delete cascade` limpia sus polls y los
  votos asociados. Los links quedan muertos (404 real, no solo-lectura — la votación ya no existe).
  Aceptable: sin creador no hay votación.

## Criterios de done (DoD)

- [ ] Migración crea `polls`, `poll_options`, `poll_votes` y `users.plan` (`free`/`premium`,
      default `free`); `npm run db:migrate` aditivo y verde
- [ ] Un usuario autenticado crea una votación con 2-5 lugares publicados y recibe un link
      `/votacion/[token]` con token no adivinable; menos de 2 o más de 5 se rechaza server-side
- [ ] **Gate "1 activa" server-side**: un `plan='free'` con una votación activa recibe 4xx al crear
      otra; `plan='premium'` (UPDATE manual) crea varias; una votación expirada **no** bloquea la
      creación de una nueva
- [ ] Voto anónimo: un dispositivo sin cuenta vota vía cookie `voter_id`; el conteo por opción sube
      en vivo; revotar cambia la elección sin sumar un voto nuevo (restricción `(poll_id,
      voter_token)`)
- [ ] La IP **no** es la identidad del votante: dos cookies distintas detrás de la misma IP cuentan
      como dos votos (verificable en test o QA en vivo); el rate limit del voto es por IP y no
      bloquea un grupo votando casi a la vez
- [ ] Expiración lazy: pasada `VOTACION_TTL_HORAS`, la votación se lee en modo cerrado sin cron; el
      link nunca devuelve 404 salvo token inexistente (cerrada/expirada/cancelada ⇒ solo-lectura)
- [ ] Cierre: solo el creador cierra; elige el ganador (default = más votado) y queda
      `winner_place_id`; un no-creador recibe 403. Cancelar libera el cupo "1 activa"
- [ ] `/votacion/[token]` server-render **no dispara ninguna llamada a Google ni IA**; el OG del
      preview de WhatsApp sale de datos propios (test o inspección del field mask / requests)
- [ ] Rate limit activo: `POST /api/votaciones` 3/día/IP · `POST .../voto` 20/min/IP, con cupos
      propios que no comparten bucket con búsqueda/claims
- [ ] El tramo premium está **modelado y gateado pero apagado**: el botón "que la IA arme la
      shortlist" no existe para free y no llama a ninguna IA para premium (no-op en v1); el historial
      de "Mis votaciones" solo lo ve premium
- [ ] Ningún endpoint expone `voter_token` a un cliente; los resultados son conteo agregado por opción
- [ ] `typecheck` + tests + `build` verdes (build con el dev server parado)

## QA manual (IDs propuestos)

| ID | Caso | Criterio |
|----|------|----------|
| VOT-01 | Crear votación feliz | Usuario verificado arma shortlist de 3 lugares publicados → recibe link con token no adivinable → el link abre la página pública con las 3 opciones |
| VOT-02 | Límites de shortlist | Intentar crear con 1 lugar y con 6 lugares → ambos rechazados server-side con mensaje claro |
| VOT-03 | Gate "1 activa" (free) | Free con una votación activa intenta crear otra → 4xx "cerrá la actual"; tras cancelar/cerrar la primera, la segunda se crea |
| VOT-04 | Premium ilimitado | `UPDATE users SET plan='premium'` → el mismo usuario crea 2 votaciones activas sin bloqueo |
| VOT-05 | Voto anónimo | Abrir el link en un navegador sin sesión → votar → el conteo de esa opción sube en vivo, sin pedir registro |
| VOT-06 | Cambiar el voto | Votar opción A, luego opción B en el mismo navegador → A baja, B sube, total de votos del dispositivo sigue 1 |
| VOT-07 | IP no es identidad | Dos navegadores distintos (misma IP) votan → cuentan 2; el rate limit del voto no los bloquea |
| VOT-08 | Evasión aceptada | Borrar cookies y votar de nuevo → se cuenta otro voto (comportamiento esperado, no bug — documentado) |
| VOT-09 | Expiración lazy | Adelantar `expires_at` al pasado (o esperar) → abrir el link → modo solo-lectura, no se puede votar, sin cron; y una nueva votación del mismo free ya se permite |
| VOT-10 | Cierre + desempate | Creador cierra eligiendo un ganador ≠ el más votado → queda registrado `winner_place_id`; la página muestra "ganó X" en solo-lectura |
| VOT-11 | Solo el creador cierra | Otro usuario (o anónimo) intenta `PATCH` de cierre/cancelación → 403 |
| VOT-12 | Cancelar libera cupo | Creador cancela su votación activa → puede crear otra de inmediato; el link cancelado muestra solo-lectura "cancelada" |
| VOT-13 | Sin Google en el link | Abrir/compartir `/votacion/[token]` → inspeccionar requests: cero llamadas a Google/IA; el OG trae título y nombres de lugares |
| VOT-14 | Rate limit de voto | Disparar >20 votos/min desde una IP → 429 con `Retry-After`; por debajo, un grupo vota sin trabas |
| VOT-15 | Premium apagado | Free no ve el botón "IA arma shortlist" ni el historial; premium ve el botón pero en v1 no dispara ninguna llamada de IA |

## Relación con otros specs

- **AUTH (spec 5)**: consume los usuarios autenticados y verificados que creó. Reusa la sesión
  inline, el rate limit propio y el patrón sin columna `role`. **Introduce `users.plan`** — el
  primer atributo de plan **del usuario** (AUTH solo tenía `owner_plan` por lugar, B2B).
- **BUSQUEDA (spec 3)**: el selector de la shortlist reusa el motor de búsqueda y la regla de
  visibilidad; no se abre una segunda query de catálogo.
- **FICHA (spec 4)**: reusa `PlaceCard` y los datos base de `places`. A diferencia de la ficha, la
  página de votación **no** usa Google (decisión 22) — el preview del link es gratis de crawlear.
- **Spec 7 (Monetización)**: **enciende el premium** que este spec dejó modelado. Automatiza
  `users.plan` con MercadoPago (hoy es un `UPDATE` manual, mismo camino que `owner_plan`), y detrás
  del gate ya construido conecta las votaciones ilimitadas + historial. Si el cobro necesita datos de
  suscripción, puede migrar el flag `users.plan` a la tabla `user_subscriptions` de la decisión 17.
- **Spec 8 (Chat IA, candidato)**: construye la IA que arma la shortlist detrás del gate premium que
  este spec dejó apagado (decisión 18), reusando su cupo de mensajes y prompt.
