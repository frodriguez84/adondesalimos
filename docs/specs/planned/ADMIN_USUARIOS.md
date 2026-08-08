# Spec: ADMIN_USUARIOS — usuarios y premium de cortesía en `/admin` (FB-01 + FB-03)

**Estado:** 🔵 Planned — en diseño
**Prioridad:** Media — es la **Tanda C** del feedback de los primeros usuarios reales: no arregla
ningún bug ni desbloquea otro spec, pero saca de `psql` las dos operaciones que hoy **solo** se
pueden hacer a mano sobre una base **de producción** (Neon, desde DEPLOY F0). El costo de no
tenerlo no es una pantalla fea: es que la única forma de darle premium a alguien sea un `UPDATE`
escrito a mano contra la base viva.
**Gate:** Ninguno — el mecanismo de gating de planes ya existe entero (MONETIZACION, decisión 8) y
el producto **ya prevé el caso** (`components/billing/suscripcion-panel.tsx:58-62`).
**Bloquea:** nada.
**Depende de:** [MONETIZACION](../done/MONETIZACION.md) (decisiones 8, 12, 19, 26 —
`lib/billing/subscriptions.ts` como dueño único de los flags) · [AUTH](../done/AUTH.md)
(decisiones 8 y 22 — gate `ADMIN_EMAIL` inline, `esDuenoDe`, precedente de auditoría
`decidedBy`) · [PULIDO](../done/PULIDO.md) (decisiones 2-3 — `/admin` en tabs) ·
[DEPLOY](../active/DEPLOY.md) (decisión 6 — el cobro apagado y el interés medido).

---

## Por qué un solo spec para los dos ítems

`FB-01` (usuarios + cortesía) tiene reglas de negocio y toca al dueño único de los flags de plan;
`FB-03` (copiar los mails) es un botón de tres líneas y **no ameritaría spec por sí solo**. Van
juntos igual, por tres razones concretas:

1. Son **la misma pantalla** (`/admin`) y la misma tanda: se implementan de una sentada.
2. `FB-03` sí tiene **una decisión** que hay que dejar escrita —el tope de 200 de
   `getInteresadosAdmin()`— y sin spec quedaría solo en el backlog, que es donde las decisiones
   se pierden.
3. Los dos comparten el **criterio de privacidad** que cierra la decisión 9, y ese criterio se
   entiende justamente al ver los dos casos al lado: los interesados **pidieron** que les
   escriban; los usuarios, no.

Lo que **no** hicieron es fusionarse: `FB-03` no depende de nada de `FB-01` y se puede implementar
primero, en cinco minutos, si hace falta soltarlo antes (ver § *Orden de implementación*).

## Problema

Dos operaciones cotidianas de la beta hoy exigen abrir `psql` contra la base de producción:

1. **Darle premium a alguien (`FB-01`).** El producto **ya tiene el caso previsto y su copy
   escrito**: `components/billing/suscripcion-panel.tsx:58-62` define el *premium de cortesía*
   (*«Te activamos el Premium nosotros: no vence ni se cobra»*) y lo muestra cuando el plan está
   activo y **no hay fila de suscripción** (`estado.status === null`). Lo que no existe es la
   forma de otorgarlo: `/admin` tiene 5 tabs (Cola · Precios · Suscripciones · Costos ·
   Curaduría) y **ninguna es de usuarios**. La única vía es un `UPDATE users SET plan='premium'`
   a mano — que además es exactamente el "UPDATE documentado" que `lib/billing/subscriptions.ts`
   **se llevó puesto** al declararse dueño único de `users.plan` y `places.owner_plan`. O sea: el
   camino que el CLAUDE.md todavía documenta para `owner_plan` es un camino que el código ya
   declaró prohibido.
   La buena noticia es que la cortesía es **estable aun con el cobro prendido**, y está
   verificado: `bajarFlagDelPlan` se llama **siempre a partir de una fila de `subscriptions`**
   (`vencimiento.ts:32` sobre la fila fresca, `webhook.ts:66` sobre la suscripción) ⇒ un premium
   sin suscripción no lo toca nadie y no se cae solo.
2. **Escribirles a los que pidieron que les avisen (`FB-03`).** `app/admin/suscripciones.tsx`
   lista los mails en `<li>` de a uno; para armar el envío hay que seleccionarlos con el mouse de
   a uno o volver a `psql`. Es la lista que la decisión 6 de DEPLOY puso ahí **para escribirles**:
   sin forma de copiarla, el contador es un número sin acción.

## Objetivo

Que las dos cosas se hagan desde `/admin`, en el navegador, sin `psql` y sin escribir el flag por
fuera de su dueño:

- Una tab **Usuarios** con el listado de cuentas, buscador por mail, y —por usuario— **dar y sacar
  el premium de cortesía**, tanto el del usuario (B2C) como el de sus lugares reclamados (B2B).
  Cada movimiento queda registrado con **quién, cuándo y por qué**.
- Un botón **«Copiar los N mails»** en Suscripciones → Interés en el premium, que diga con
  precisión cuántos copió.

## Qué NO es esta feature

- **No es un CRUD de usuarios.** No se edita el mail, ni el nombre, ni se borra una cuenta, ni se
  fuerza la verificación de mail, ni se resetea una contraseña. Solo se lee, y se mueve el flag de
  plan.
- **No es una segunda forma de escribir `users.plan` / `places.owner_plan`.** Las dos funciones
  nuevas viven en `lib/billing/subscriptions.ts` y **delegan la escritura del flag en
  `activarFlagDelPlan` / `bajarFlagDelPlan`, que no se tocan** (decisión 2). Si aparece un
  `tx.update(users).set({ plan: … })` fuera de esas dos funciones, el spec está mal implementado.
- **No es un sistema de roles.** Sigue habiendo un solo admin, resuelto por `ADMIN_EMAIL` (AUTH,
  decisión 8). No se agrega `users.role` ni una tabla de roles.
- **No crea suscripciones ni cobra.** La cortesía **no** inserta filas en `subscriptions`: si lo
  hiciera, rompería el discriminante que el panel ya usa (decisión 3) y encima quedaría una fila
  sin preapproval de MP que la reconciliación intentaría consultar. El cobro sigue viviendo entero
  en MONETIZACION F2 y hoy está apagado (DEPLOY, decisión 6).
- **No toca `components/billing/suscripcion-panel.tsx`.** El copy de cortesía y el de free ya
  están escritos y ya cubren los dos estados. Es la prueba de que esta feature es la mitad que
  faltaba, no una feature nueva.
- **No manda mails** (decisión 11).
- **No exporta la lista de usuarios** (decisión 9). `FB-03` copia **interesados**, que es otra
  cosa.
- **No es la Tanda D** (`FB-04`, el botón de "centrarme" en el mapa), ni la curaduría de cobertura.

## Decisiones cerradas

| # | Decisión |
|---|----------|
| 1 | **Un solo spec para `FB-01` + `FB-03`**, por lo escrito arriba en § *Por qué un solo spec*. El nombre `ADMIN_USUARIOS` describe el 90% del contenido; `FB-03` entra como una decisión chica (la 12) porque comparte pantalla, tanda y criterio de privacidad, no porque sea parte de la sección de usuarios |
| 2 | **`lib/billing/subscriptions.ts` se extiende con `otorgarCortesia` y `revocarCortesia`; el flag lo siguen escribiendo `activarFlagDelPlan` / `bajarFlagDelPlan`, que no se tocan.** Es el punto entero de la decisión 8 de MONETIZACION: el módulo ya es el dueño único de los dos flags y ya resuelve el eje con la misma forma (`placeId === null` ⇒ usuario; con valor ⇒ lugar), así que la cortesía es *un llamador más de lo que ya existe*, no una escritura nueva. Firmas:<br>`otorgarCortesia(eje, opts): Promise<Resultado<{ yaEstaba: boolean }>>`<br>`revocarCortesia(eje, opts): Promise<Resultado<{ yaEstaba: boolean }>>`<br>con `eje = { userId: string; placeId: string \| null }` y `opts = { motivo: string; adminEmail: string }`. `Resultado<T>` es el que ya usan `lib/claims/acciones.ts` y `lib/billing/interes.ts` — no se inventa un tipo de retorno nuevo. `yaEstaba: true` = el flag ya estaba en ese valor: **idempotente ante doble click**, mismo criterio que `decidirClaim`, y **no escribe fila de bitácora** (nada cambió, nada que registrar) |
| 3 | **La cortesía es exclusivamente para ejes SIN suscripción viva, y las dos funciones lo rechazan explícitamente** (`getSuscripcionViva(eje) !== undefined` ⇒ `{ ok: false, code: 'TIENE_SUSCRIPCION' }`). No es una restricción cosmética, es lo que mantiene **una regla, un dueño**: el discriminante "esto es cortesía" **ya existe y ya está en producción** — es `estado.status === null` en `lib/billing/estado.ts`, que es lo que hace que el panel muestre el copy de cortesía. Si la cortesía pudiera pisar a alguien con suscripción paga, ese discriminante dejaría de ser cierto y habría que inventar un segundo (una columna `es_cortesia`, un flag) que driftearía contra el primero. Efecto lateral bienvenido: **es imposible sacarle desde acá el premium a alguien que lo está pagando** — para eso está la cancelación, que ya existe y vive en otro lado |
| 4 | **Sí se puede revocar, y es puerta de ida y vuelta.** Es el nudo del spec y se cierra a favor de poder sacarlo, por cuatro motivos, en orden de peso: **(a)** el producto **ya lo prometió**: el copy vigente (`suscripcion-panel.tsx:154`) dice textual *«Si lo querés dar de baja, escribinos y lo sacamos»* — o sea, hoy la baja de la cortesía ya es una operación ofrecida al usuario, que se ejecuta con `psql`; **(b)** sin revocar, otorgársela al usuario equivocado sería irreparable desde el producto y devolvería a `psql` justo al caso más urgente, que es el error recién cometido — la feature perdería su razón de ser; **(c)** *"subir un cupo es un regalo; bajarlo es una traición"* (CLAUDE.md) es una regla sobre **qué le pasa a los datos**, y acá no le pasa nada: revocar B2C **oculta** listas de favoritos por encima del cupo free (`lib/favoritos/planes.ts`: bajar de plan oculta, no borra) y revocar B2B **oculta** las fotos 4-15 y los 3 campos pagos (MONETIZACION, decisión 19), sin borrar ni una fila. Re-otorgar devuelve **todo**; **(d)** el copy que el usuario ve nunca prometió perpetuidad: *«no vence ni se cobra»* es verdad y sigue siendo verdad — no vence **por tiempo** y no se **cobra**. Revocar es una decisión humana, no un vencimiento. ⚠️ Lo que sí exige: **motivo obligatorio** (decisión 6) y **confirmación explícita** que nombre qué se oculta (decisión 10) |
| 5 | **Los dos ejes: B2C (`users.plan`) y B2B (`places.owner_plan`).** Dejar B2B afuera sería hacer la mitad del trabajo por cero ahorro: `activarFlagDelPlan` **ya está parametrizado por eje**, así que soportar los dos no cuesta una línea más de lógica de negocio; y `owner_plan` es justamente el flag que el CLAUDE.md todavía documenta como *"se cambia con un `UPDATE` documentado"* — el `psql` que este spec viene a matar. **Acotación que evita una UI nueva:** la cortesía B2B se otorga **desde el usuario**, sobre los lugares que ese usuario tiene con **reclamo aprobado** (`esDuenoDe`, `lib/claims/ownership.ts`, el mismo gate que ya usa `registrarInteres`). Darle el plan pago a un lugar sin dueño no le sirve a nadie: no hay quien entre al panel a usarlo. Fuera del reclamo aprobado ⇒ `{ ok: false, code: 'NO_ES_DUENO' }` |
| 6 | **Motivo obligatorio, en las dos direcciones.** Texto libre, mínimo 3 caracteres, máximo 280, validado **en la función** (no solo en la UI: el endpoint es un boundary). Es lo que hace útil a la bitácora: *"quién"* con un solo admin vale poco, *"por qué"* y *"desde cuándo"* valen mucho — sobre todo el día que se prenda el cobro y haya que separar quién es premium porque pagó de quién porque se lo regalaron |
| 7 | **La auditoría es una tabla nueva, `plan_grants`, append-only — y NO es fuente de verdad del estado.** El estado vigente se sigue leyendo de `users.plan` / `places.owner_plan`, siempre; `plan_grants` es **bitácora**: se escribe y se lee para mostrar, nunca para decidir un gate. Que quede escrito acá para que nadie la convierta después en el segundo discriminante que la decisión 3 evita.<br>**Por qué una tabla y no columnas en `users`/`places`:** columnas (`plan_granted_by`, `plan_granted_at`, …) guardarían solo el **último** estado, habría que limpiarlas al revocar —o quedarían mintiendo— y tocarían **dos tablas con datos reales de producción**. Una tabla nueva es la migración más barata de revertir que existe (un `DROP TABLE` y no se perdió nada de lo anterior), conserva la historia completa incluso después de revocar, y es append-only: **no puede corromper un dato existente**. Precedentes del producto para el "quién": `place_claims.decided_by` (que la cola muestra como *"Aprobado por"*) y `app_settings_history.changed_by` — los dos guardan el **email** del admin en `text`, porque no hay tabla de roles que referenciar. Se sigue ese criterio.<br>**Forma:** `id uuid pk` · `user_id uuid not null → users(id) on delete cascade` · `place_id uuid null → places(id) on delete cascade` (`null` = B2C, mismo criterio que `subscriptions` y `premium_interest`) · `accion` enum `'grant' \| 'revoke'` · `motivo text not null` · `granted_by text not null` · `created_at timestamptz not null default now()`. Índice por `(user_id, created_at desc)`. El `cascade` es deliberado: borrada la cuenta no queda a quién auditar |
| 8 | **Qué muestra la tab Usuarios, y qué no.** Por fila: **mail** · **nombre** (si lo cargó) · **plan** con su origen (**«paga»** si hay fila viva · **«cortesía»** si es premium sin fila · nada si es free) · **verificado** (sí/no) · **alta** · sus **lugares con reclamo aprobado** con el `owner_plan` de cada uno. Nada más. **Explícitamente NO se muestra:** `image` (avatar de OAuth, ruido), `chat_trial_used` (dato de cupo — vive en Costos y ahí se queda) y, obviamente, nada de `session`/`account`/`verification`. Aplica la regla de seguridad del CLAUDE.md global (*nunca exponer PII en logs*): **ningún `console.log` de esta feature imprime un mail** — ni en el endpoint, ni en el catch de error. El error se loguea con el `userId`, que no es PII fuera de esta base |
| 9 | **La lista de usuarios NO se copia ni se exporta.** Es la diferencia que justifica que `FB-03` sí exista: los de `premium_interest` **pidieron explícitamente** que les escriban (*"avisame cuando abra"*, DEPLOY decisión 6) — hay consentimiento y hay un uso declarado. Los usuarios de la beta se registraron para usar la app, no para recibir mails. Un botón de "copiar todos los mails" sobre la tabla de usuarios es un exportador de base de datos personales con un solo click, y el día que exista nadie se acuerda de por qué estaba bien; el día que no existe, no hay nada que explicar |
| 10 | **Toda acción pasa por una confirmación que nombra la consecuencia**, y las dos direcciones no pesan igual: otorgar confirma en una línea; **revocar avisa qué se oculta** (listas por encima del cupo free en B2C; fotos 4-15 y los 3 campos pagos en B2B) **y que no se borra nada**. Es la misma asimetría del bulk-accept de la curaduría: el gesto barato se confirma barato, el que asusta se explica |
| 11 | **Sin mail automático, en ninguna de las dos direcciones.** La cortesía en la beta se otorga *en conversación* (Fer le escribe a alguien, o alguien le escribe a Fer): el aviso ya existe y es esa conversación. Un mail transaccional agregaría plantilla, copy, y el problema de qué decir cuando se saca. Y el usuario **ve el cambio donde importa**: `/cuenta` (o `/mi-negocio/[placeId]`) pinta el estado nuevo en el próximo render, sin caché — `estadoSuscripcionB2C` lee el flag en vivo, que es exactamente por qué el flag nunca viajó en la sesión |
| 12 | **`FB-03` copia los mails visibles, y el botón dice cuántos son.** `getInteresadosAdmin()` está topeado en 200 y el conteo real sale de `contarInteresados()` (INT2-28): "Copiar todos" copiaría *los 200 más nuevos*. Se descarta el endpoint que traiga la lista completa — hoy el total es de un dígito, y cuando no lo sea el arreglo es **subir el tope**, no agregar una superficie de admin que devuelva una lista ilimitada de PII. Lo que se elige es **no mentir**: el botón se rotula **«Copiar los N mails»** con `N = interesados.length`, y el texto que ya existe arriba (*«Abajo, los N más nuevos»*) explica la diferencia contra el total cuando la hay. Formato: mails separados por **`, `** (lo que un cliente de correo acepta pegado en el campo *Para*/*CCO*); los `null` del `leftJoin` se filtran antes de copiar y no cuentan para la N |
| 13 | **La tab Usuarios va sexta y última, sin reordenar las cinco que ya están.** La decisión 3 de PULIDO ordenó las tabs por **frecuencia de uso** (Cola primero), y otorgar una cortesía es la acción más rara de todo `/admin`. Temáticamente pegaría al lado de Suscripciones, pero mover una tab de lugar le rompe la memoria muscular a la única persona que usa esta pantalla, a cambio de nada |
| 14 | **⚠️ `npm run backup:db` antes de implementar y antes del QA.** No por la migración —la tabla es nueva y aditiva— sino porque el QA de esta feature **mueve flags de plan sobre la base de dev**, que es donde viven los ~3.967 tags de curaduría que no están en git ni en el seed (CLAUDE.md § Notas importantes). La regla es la regla: antes de cualquier operación de escritura sobre la base, backup |

## Alcance del código (lo que se toca, y nada más)

| Archivo | Qué cambia |
|---------|-----------|
| `lib/db/schema.ts` | **`planGrants`** + el enum `plan_grant_action` + tipos inferidos (decisión 7) |
| `drizzle/00XX_*.sql` | Migración **aditiva**: la tabla nueva y su índice. Nada `ALTER` sobre tablas con datos |
| `lib/billing/subscriptions.ts` | **`otorgarCortesia`** y **`revocarCortesia`** (decisiones 2-6). Una transacción cada una: `activarFlagDelPlan`/`bajarFlagDelPlan` + la fila de bitácora, juntas o ninguna. **`activarFlagDelPlan`, `bajarFlagDelPlan` y `getSuscripcionViva` no cambian una línea** |
| `lib/billing/admin.ts` | **`getUsuariosAdmin(q?, limite = 50)`**, **`contarUsuarios()`** y **`getBitacoraCortesia(userId)`** (decisiones 7-8). Se extiende el módulo que ya existe para las lecturas de admin de billing; no se crea uno nuevo |
| `app/api/admin/usuarios/route.ts` | **Nuevo.** `GET` con rama `?q=` — mismo patrón exacto que `app/api/admin/curaduria/route.ts`: gate `sesionAdmin` inline, 403 con el mismo shape de error, sin rate limit (admin gateado, no superficie pública) |
| `app/api/admin/usuarios/[userId]/plan/route.ts` | **Nuevo.** `POST` con body `{ accion: 'otorgar' \| 'revocar', placeId?: string, motivo: string }`, validado con zod. Es el adaptador HTTP: la validación de negocio vive en las funciones de `subscriptions.ts` (mismo reparto que `PATCH /api/admin/settings` ↔ `editarPrecio`) |
| `app/admin/usuarios-client.tsx` | **Nuevo.** Buscador + listado + acciones con confirmación (decisiones 8, 10). `router.refresh()` al terminar — no mantiene estado propio que pueda mentir, mismo criterio que `ColaClient` y `PreciosClient` |
| `app/admin/tabs.tsx` | Sexta entrada en `TABS` (decisión 13) |
| `app/admin/page.tsx` | Dos lecturas más en el `Promise.all`. El gate y el `Promise.all` siguen viviendo solos acá (PULIDO, decisión 2) |
| `app/admin/copiar-mails.tsx` | **Nuevo.** Cliente mínimo: recibe `mails: string[]`, `navigator.clipboard.writeText(mails.join(', '))`, «Copiado ✓». Si falla, un aviso — no un fallback elaborado |
| `app/admin/suscripciones.tsx` | Sigue siendo server component; solo monta `<CopiarMails>` pasándole los mails ya filtrados de `null` (decisión 12) |

**Sin cambios en:** `components/billing/suscripcion-panel.tsx` · `lib/billing/estado.ts` ·
`lib/billing/vencimiento.ts` · `lib/billing/webhook.ts` · `lib/votaciones/planes.ts` ·
`lib/claims/ownership.ts` · `lib/billing/interes.ts` · `lib/favoritos/planes.ts`.

## Orden de implementación (un tramo, tres pasos)

Sin fases formales. El orden importa porque el primer paso es soltable solo:

1. **`FB-03` primero** (decisión 12): el botón de copiar mails. Es media hora, no depende de nada
   de lo de abajo y ya deja algo usable si el resto se frena.
2. **El backend de `FB-01`**: migración + las dos funciones en `subscriptions.ts` + los tests. Se
   puede verificar entero sin una sola línea de UI, y es donde están todas las reglas.
3. **La UI de `FB-01`**: endpoints, la tab y el cliente.

## Copy (rioplatense)

- Tab: **«Usuarios»**.
- Buscador: placeholder **«Buscá por mail o nombre»**. Sin resultados: **«No hay ninguna cuenta con
  ese mail.»** Sin usuarios: **«Todavía no hay nadie registrado.»**
- Badges de plan: **«cortesía»** · **«paga»** · (free: sin badge).
- Botones: **«Darle Premium»** (B2C) · **«Darle el plan del lugar»** (B2B) · **«Sacarle el
  Premium»** / **«Sacarle el plan»**.
- Confirmación de otorgar: *«Le vas a activar el Premium. No vence y no se le cobra.»* Campo:
  **«¿Por qué? (queda registrado)»**. Botón: **«Sí, dale Premium»**.
- Confirmación de revocar (B2C): *«Vuelve a free. Las listas que tenga de más **se ocultan, no se
  borran**: si se lo devolvés, vuelve todo.»* Botón: **«Sí, sacáselo»**.
- Confirmación de revocar (B2B): *«El lugar vuelve a free. Las fotos de la 4 a la 15, la
  descripción, la carta y las novedades **se ocultan, no se borran**.»*
- Con suscripción paga viva: **«Tiene una suscripción paga: desde acá no se toca.»** (sin botones).
- Bitácora, por línea: **«Le dieron Premium · 8/8/26 · fer@… · "beta testers"»**.
- `FB-03`: **«Copiar los 12 mails»** → tras copiar, **«Copiado ✓»**; si falla, **«No pudimos
  copiar. Probá de nuevo.»**

## Edge cases

- **Cortesía + suscripción paga después.** Si alguien con cortesía se suscribe y paga,
  `activarFlagDelPlan` lo deja premium (ya lo estaba) y ahora **sí** hay fila viva ⇒ el panel pasa
  solo del copy de cortesía al de pago. Sin código nuevo. Pero si después **cancela**,
  `bajarFlagDelPlan` lo baja a `free` y **se lleva puesta la cortesía**. Se acepta a conciencia:
  hoy no puede pasar (el cobro está apagado), y el arreglo "que `bajarFlagDelPlan` consulte
  `plan_grants`" convertiría la bitácora en fuente de verdad del estado, que es justo lo que la
  decisión 7 prohíbe. Cuando pase, la bitácora deja ver que tuvo cortesía y se re-otorga con un
  click — que es la feature que este spec entrega.
- **Doble click en «Darle Premium»** ⇒ `yaEstaba: true`, una sola fila de bitácora (decisión 2).
- **Revocar algo que ya está en free** ⇒ `yaEstaba: true`, sin fila, sin error.
- **Otorgar B2B a un lugar cuyo reclamo fue revocado después.** El flag queda en `paid` y el
  contenido pago **se sigue ocultando igual**, porque el gate del contenido es el reclamo aprobado
  (`resolverContenidoDueno`), no el plan. No hay nada que arreglar acá: son dos gates
  independientes y los dos tienen dueño.
- **El admin se busca a sí mismo.** Aparece como un usuario más y puede darse cortesía. No se
  agrega un caso especial: es el mismo `ADMIN_EMAIL` que ya puede editar precios y aprobar
  reclamos, y la bitácora lo registra igual que a cualquier otro.

## Criterios de done (DoD)

- [ ] `grep -rn "update(users)" lib/ app/` y `grep -rn "ownerPlan:" lib/ app/` no devuelven
      **ninguna** escritura de plan fuera de `activarFlagDelPlan` / `bajarFlagDelPlan`
      (decisión 2) — el criterio central del spec, verificable por grep
- [ ] `otorgarCortesia` / `revocarCortesia` existen en `lib/billing/subscriptions.ts`, devuelven
      `Resultado<{ yaEstaba }>` y hacen flag + bitácora **en una sola transacción**
- [ ] Sobre un eje **con suscripción viva**, las dos devuelven `TIENE_SUSCRIPCION` y **no escriben
      nada** (decisión 3) — con test
- [ ] `otorgarCortesia` con `placeId` de un lugar que el usuario **no** tiene aprobado devuelve
      `NO_ES_DUENO` y no escribe nada (decisión 5) — con test
- [ ] Motivo vacío o de menos de 3 caracteres ⇒ rechazado **en la función**, no solo en la UI
      (decisión 6) — con test
- [ ] Otorgar dos veces seguidas deja **una** fila en `plan_grants` y `yaEstaba: true` en la
      segunda (decisión 2) — con test
- [ ] La migración es **aditiva** (`CREATE TABLE` + `CREATE INDEX`, ningún `ALTER` sobre tablas con
      datos) y `npm run db:migrate` corre limpio
- [ ] Ninguna consulta de gating lee `plan_grants`: `grep -rn "planGrants" lib/` solo aparece en
      `schema.ts`, `subscriptions.ts` (escritura) y `admin.ts` (lectura para mostrar) — decisión 7
- [ ] La tab **Usuarios** existe, es la sexta, y las cinco anteriores mantienen su orden
      (decisión 13)
- [ ] El listado muestra exactamente los campos de la decisión 8, con el badge de origen
      («cortesía» vs «paga») correcto en los dos casos
- [ ] `GET /api/admin/usuarios` y `POST /api/admin/usuarios/[userId]/plan` responden **403 sin
      sesión de admin**, con el mismo shape de error que las rutas de admin existentes
- [ ] Ningún `console.log`/`console.error` de esta feature imprime un mail (decisión 8) —
      verificable por lectura de los dos handlers nuevos
- [ ] Dar cortesía B2C desde `/admin` hace que `/cuenta` muestre el copy de cortesía **ya
      existente**, sin haber tocado `suscripcion-panel.tsx`
- [ ] Revocar B2C deja al usuario en free y sus listas por encima del cupo **ocultas, no
      borradas**: re-otorgar las devuelve (decisión 4) — verificado con `SELECT`, no solo por
      pantalla
- [ ] Revocar B2B oculta las fotos 4-15 y los 3 campos pagos, y re-otorgar las devuelve
- [ ] **`FB-03`:** el botón rotula el número **real de mails que copia** y el portapapeles queda
      con esa misma cantidad, separados por `, `, sin `null` ni vacíos (decisión 12)
- [ ] `npm run backup:db` corrido antes del QA (decisión 14) · typecheck + tests + build en verde
      (el build con el dev server parado)

## QA manual (IDs propuestos)

| ID | Caso | Criterio |
|----|------|----------|
| ADMU-01 | `/admin` → tab **Usuarios** | Existe, es la sexta; las otras cinco no se movieron |
| ADMU-02 | Listado sin buscar | Los más nuevos primero, con mail, plan, verificado y alta; el conteo real aparte del listado topeado |
| ADMU-03 | Buscar por mail parcial | Encuentra la cuenta; con un mail inexistente, «No hay ninguna cuenta con ese mail.» |
| ADMU-04 | Un usuario free | Sin badge de plan; ofrece «Darle Premium» |
| ADMU-05 | Darle Premium sin escribir motivo | No deja confirmar; el endpoint también lo rechaza si se fuerza |
| ADMU-06 | Darle Premium con motivo | Confirmación → queda «cortesía»; en `/cuenta` de ese usuario aparece el copy de cortesía ya existente |
| ADMU-07 | Doble click en «Darle Premium» | Una sola fila en `plan_grants` (`SELECT`), sin error en pantalla |
| ADMU-08 | Bitácora del usuario de ADMU-06 | Muestra quién, cuándo y el motivo tipeado |
| ADMU-09 | Sacarle el Premium | La confirmación dice que se **ocultan, no se borran**; queda free y `/cuenta` vuelve al estado free |
| ADMU-10 | El usuario de ADMU-09 tenía 3 listas de favoritos | Tras revocar ve solo la del cupo free; **`SELECT` confirma que las 3 filas siguen** |
| ADMU-11 | Re-otorgarle el Premium al de ADMU-10 | Vuelven a verse las 3 listas, sin haber restaurado nada |
| ADMU-12 | Un usuario con suscripción **paga viva** (simulada con una fila `active`) | Badge «paga», sin botones, y el `POST` forzado responde `TIENE_SUSCRIPCION` |
| ADMU-13 | Usuario con un lugar de reclamo **aprobado** | El lugar aparece bajo el usuario con su `owner_plan` y ofrece «Darle el plan del lugar» |
| ADMU-14 | Otorgar B2B a ese lugar | `places.owner_plan='paid'` (`SELECT`); en `/mi-negocio/[placeId]` se habilitan los campos pagos y las 15 fotos |
| ADMU-15 | `POST` forzado con el `placeId` de un lugar **ajeno** al usuario | `NO_ES_DUENO`; `SELECT` confirma que `owner_plan` no cambió |
| ADMU-16 | Revocar el B2B de ADMU-14 con 6 fotos cargadas | Se ven 3; **`SELECT` sobre `place_photos` confirma que las 6 filas siguen** |
| ADMU-17 | `GET /api/admin/usuarios` y `POST …/plan` sin sesión de admin | 403 los dos, mismo shape de error que las rutas de admin existentes |
| ADMU-18 | **`FB-03`** — Suscripciones → «Copiar los N mails» | Copia N mails separados por `, `; N coincide con lo listado y con lo pegado |
| ADMU-19 | **`FB-03`** — un interesado sin mail (usuario borrado, `leftJoin` en `null`) | No se copia ni cuenta para la N |
| ADMU-20 | **`FB-03`** — total > 200 (o con el tope bajado a 2 para probarlo) | El botón dice los **visibles**, y el texto de arriba sigue explicando el total |

## Esfuerzo estimado

Una sesión. El backend son dos funciones en un módulo que ya existe, sobre dos helpers que ya
existen, más una tabla nueva sin `ALTER`. El grueso es UI: una tab, un listado con acciones y su
confirmación. `FB-03` es media hora.

## Relación con otros specs

- **Cierra la deuda de MONETIZACION, decisión 8.** Ese spec se llevó los "UPDATE documentados" de
  AUTH y VOTACION al declarar a `subscriptions.ts` dueño único de los flags, pero no dejó forma de
  moverlos a mano — este spec la agrega **por dentro del dueño**. Al implementarlo hay que
  **actualizar el CLAUDE.md** § *Contenido del dueño y planes*, que todavía dice que `owner_plan`
  *"se cambia con un `UPDATE` documentado"*: pasa a cambiarse desde `/admin`.
- **Consume** los gates `esDuenoDe` y `sesionAdmin` de AUTH (decisiones 11 y 8), sin tocar
  ninguno.
- **Complementa DEPLOY, decisión 6:** el interés medido ya se muestra; `FB-03` lo vuelve
  accionable.
- **No toca** CHAT_IA ni FAVORITOS, pero **los mueve**: darle premium a alguien le abre el chat y
  las listas ilimitadas. Es el punto — es la única forma que hay hoy de que alguien pruebe el
  premium con el cobro apagado.
