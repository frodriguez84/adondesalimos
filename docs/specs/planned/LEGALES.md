# Spec: Legales de verdad — T&C, privacidad y la letra chica que hoy no existe

**Estado:** 🔵 Planned — en diseño
**Prioridad:** **Alta — el único ítem de la cola que NO está gateado por tráfico.** La app **ya
cobra** (MercadoPago, `subscriptions`) y **ya guarda datos personales** (`users.email`, `session`,
`account`, fotos de dueños en R2, `place_owner_content.phone`) **sin T&C ni política de privacidad
en ninguna parte del repo**. Con 3 usuarios el riesgo es chico; crece solo y no avisa.
**Gate:** Ninguno. Se saltea la cola de los 9 del ítem 10 del backlog a propósito: aquellos esperan
que llegue gente, este no espera nada.
**Bloquea:** nada técnicamente. Pero es prerrequisito honesto de cualquier difusión y de encender
el cobro de verdad ([`DEPLOY`](../active/DEPLOY.md) F3).
**Depende de:** [`TITULARIDAD`](../active/TITULARIDAD.md) (Ley 25.326 ya investigada, decisión 8 =
minimización) · [`MONETIZACION`](../done/MONETIZACION.md) decisión 22 (instrumentación agregada
pura) · [`DEPLOY`](../active/DEPLOY.md) decisión 21 (el aviso de beta y por qué no es un escudo) ·
[`SEO`](../active/SEO.md) decisión 5 (las 301 páginas estáticas — restricción dura, ver decisión 10)

> ⚠️ **Esto no lo revisa un abogado** (decisión de Fer, 2026-08-21). Escrito así **cubre
> razonablemente y es muchísimo mejor que nada, pero NO garantiza cumplimiento.** Está acá arriba
> para que dentro de un año nadie lo lea como un olvido. Lo que compensa la falta de abogado es el
> criterio de redacción de la decisión 3: **describir lo que el código realmente hace**.

---

## Problema

`app/legales/page.tsx` son **263 líneas y todas sus secciones son atribución** (Overture con sus 9
fuentes y 3 licencias, Foursquare, AllThePlaces, las zonas de BA Data e IGN, MapLibre/OpenFreeMap,
Google) más el aviso de beta. **No hay términos y condiciones ni política de privacidad.** Grep
sobre el repo entero: cero.

Mientras tanto, el código sí hace todo esto:

- cobra suscripciones por MercadoPago y guarda el email del pagador (`subscriptions.mp_payer_email`);
- guarda cuentas con email, nombre y hash de contraseña (`users`, `account`);
- guarda **IP y user-agent de cada sesión** (`session.ip_address`, `session.user_agent`);
- recibe fotos de dueños y las sirve públicamente desde R2 sin haberles pedido una licencia;
- manda el texto que el usuario escribe en el chat a **Anthropic**, un tercero en otro país;
- manda mails por **Resend**;
- deja que el navegador del visitante le pegue directo a **Google**, **OpenFreeMap** y **R2**.

Y el footer manda *«Estamos en beta»* y *«Datos de Overture y Google»* **al mismo lugar**, que es la
confusión concreta que nombró Fer: dos cosas distintas —una expectativa de producto y una condición
de licencia— comparten página, dueño y ciclo de vida.

## Objetivo

Que la app tenga la letra chica que le corresponde a lo que **ya hace**: términos, privacidad,
atribución y el camino de baja, cada uno en su URL, cada uno describiendo código verificable.

## Qué NO es esta feature

- **No es un dictamen legal.** Ver el aviso del header.
- **No es el contador de visitas / «# online».** Está parado con gate en **≥200 `detail_views` por
  semana** (backlog ítem 11, decisión 3 de Fer). Con 69 aperturas en 13 días el contador diría
  *«Visitas hoy: 2 · 0 online»*, que es prueba social **en contra**. No se reabre acá.
- **No es un banner de cookies.** No hay cookies de analítica ni de terceros que consentir (ver
  decisión 6). Poner un banner sería teatro.
- **No es una tabla de «aceptaste la versión X»** (decisión 15).
- **No cambia el borrado de datos que hoy hace el código.** Donde el borrado es parcial, el
  documento lo dice; cambiarlo es puerta de ida y va al backlog (decisión 8).
- **No agrega crons de retención.** No hay ninguno hoy (`vercel.json` no tiene `crons`) y prometer
  un borrado automático que nadie ejecuta sería exactamente el pecado de la decisión 3.

---

## El inventario — qué hace la app con datos (leído del código, 2026-08-21)

**Esta sección es la fuente del texto de los documentos.** No se escribe una cláusula que no pueda
señalar una fila de estas tablas. Si algo cambia en el código, cambia acá primero.

### A · Lo que se guarda en la base

| Dato | Dónde vive | Para qué | Al eliminar la cuenta |
|---|---|---|---|
| Email | `users.email` | Login, mails transaccionales | **Se borra** |
| Nombre | `users.name` | Saludo en la UI | **Se borra** |
| Avatar | `users.image` | Perfil | **Se borra**. Hoy siempre `null`: no hay OAuth conectado |
| Hash de contraseña | `account.password` | Login. **Nunca la contraseña en claro** | Se borra (cascade) |
| **IP y user-agent de la sesión** | `session.ip_address`, `session.user_agent` | Los escribe better-auth al crear sesión. Seguridad de la cuenta | Se borra (cascade) |
| Tokens de verificación / reset | `verification.value` | Verificar mail, resetear contraseña | Expiran solos; no se loguean nunca (cicatriz `AUD-03`) |
| Nombre, teléfono, rol y comentario del reclamo | `place_claims.applicant_name/phone/role/comment` | Que el admin verifique el vínculo con el negocio | Se borra (cascade) |
| Contenido cargado por el dueño | `place_owner_content` (`phone`, `website`, `socials`, `description`, `menu_url`, `news`) | Pisar los datos de Overture en la ficha | ⚠️ **NO se borra: deja de mostrarse** (ver decisión 8) |
| Fotos del dueño | `place_photos` + objetos en R2 | Galería de la ficha | **Se borran, base y R2** (`limpiarFotosDeUsuario`) |
| Votaciones creadas | `polls`, `poll_options` | El loop viral | Se borran (cascade) |
| Voto y sugerencia | `poll_votes.voter_token`, `poll_options.suggested_by` | Un voto por dispositivo. **Es la cookie `voter_id`, no una identidad**; nunca se expone a ningún cliente | Sobreviven si la votación es de otro creador |
| Conversaciones del chat | `chat_conversations`, `chat_messages.content` | Historial del chat IA | Se borran (cascade) |
| Consumo del chat | `chat_usage_monthly`, `users.chat_trial_used` | Cupo. **Contador propio**: borrar una conversación no devuelve cupo | Se borra (cascade) |
| Suscripción y pagos | `subscriptions` (incl. `mp_payer_email`), `subscription_payments` | Cobro y renovación | Se borran (cascade), tras cancelar el preapproval en MP |
| Listas guardadas | `place_lists`, `place_list_items` | «Mis lugares» | Se borran (cascade) |
| Correcciones propuestas | `place_data_edits.requested_by` | Cola de correcciones | `ON DELETE SET NULL` — **la propuesta queda, el autor no** |
| Cupo de mails por destinatario | `email_recipient_daily.recipient_hash` | Tope por persona por día | **SHA-256 del email, nunca la dirección en claro** |

### B · Lo que NO se guarda — la mejor carta que tiene la app

Esto no es un trámite: es una ventaja real y hay que escribirla como tal.

- **La instrumentación es agregada pura** ([`MONETIZACION`](../done/MONETIZACION.md) decisión 22):
  `place_impressions_daily`, `place_taps_daily` y `place_tag_impressions_daily` cuentan **por lugar
  y por día**, **sin `user_id`, sin cookies, sin IP**. No hay forma de reconstruir qué miró una
  persona porque el dato nunca existió.
- **El texto libre de las búsquedas no se registra** (decisión 22, por cardinalidad y privacidad).
- **Nada de Google se almacena.** Horarios, rating y fotos se piden en vivo y se tiran
  ([`FICHA`](../done/FICHA.md), decisiones 7-22). Lo único que persiste es `google_place_id`.
- **Ninguna tarjeta pasa por la app.** El cobro lo hace MercadoPago; nosotros guardamos el `id` del
  preapproval y el email del pagador.
- **La evidencia de titularidad no se guarda** ([`TITULARIDAD`](../active/TITULARIDAD.md) decisión
  8): se mira y se registra el veredicto, sin CUIT, sin DNI, sin archivo adjunto.
- **El rate limit vive en memoria del proceso** (`lib/middleware/rate-limit.ts`): la IP no se
  persiste en ningún lado y se pierde al reciclar la instancia.
- **No hay tracker de terceros** — ni Google Analytics, ni Meta Pixel, ni Hotjar.

### C · Las cookies que sí existen — y por qué decir «no usamos cookies» sería mentira

Son **dos**, las dos **funcionales**, ninguna de analítica:

| Cookie | Quién la pone | Para qué |
|---|---|---|
| Sesión de better-auth | `lib/auth/index.ts` | Mantenerte logueado |
| `voter_id` | `app/api/votaciones/[token]/voto/route.ts` (`VOTER_COOKIE`) | Un voto por dispositivo en una votación, sin pedirte cuenta |

⚠️ El invariante *«sin cookies»* de MONETIZACION decisión 22 es sobre **la instrumentación**, no
sobre la app entera. Copiarlo textual a una política de privacidad convierte una buena carta en una
declaración falsa.

### D · A quién le llegan datos

Dos grupos, y la diferencia importa porque uno lo decidimos nosotros y el otro lo hace el navegador
del visitante sin que podamos evitarlo.

**Le mandamos datos desde el servidor:**

| Tercero | Qué le mandamos | Cuándo |
|---|---|---|
| **Anthropic** | El texto que escribís en el chat + el catálogo que las tools devuelven | Solo si usás `/chat` |
| **MercadoPago** | El monto, el plan y tu email de pagador | Solo si contratás |
| **Resend** | Tu dirección de mail y el contenido del mail | Verificación, reset de contraseña, reclamo aprobado/rechazado (los 4 SKU de `lib/email/index.ts`) |
| **Google Maps Platform** | El `place_id` del lugar que estás mirando | Al abrir una ficha |

**Tu navegador les pega directo (y por eso ven tu IP):**

| Tercero | Qué carga |
|---|---|
| **Google** | La foto de la ficha: es una URI efímera que el `<img>` resuelve contra Google (`components/lugar/ficha-google.tsx`) |
| **OpenFreeMap** | Las teselas del mapa |
| **Cloudflare R2** | Las fotos que subieron los dueños (`R2_PUBLIC_URL`, egress directo) |
| **Vercel** (hosting) y **Neon** (base) | Toda la app corre ahí; sus logs de request incluyen la IP |

⚠️ **Omitir este segundo grupo es la clase de silencio que hace que el resto del documento no
valga.** No podemos ocultarle la IP a un host de teselas, pero sí podemos decirlo.

### E · Retención

**No hay borrado automático de nada.** No existe un solo cron (`vercel.json` no declara `crons`).
Los datos viven mientras exista la cuenta; las votaciones expiran a las 72 h pero **las filas
quedan**. El documento dice exactamente eso y **no** promete un plazo que ningún código cumple.

---

## Decisiones cerradas

Las 1-3 las tomó Fer el **2026-08-21** en el triaje del ítem 11; las 4-16 son diseño de este spec.

| # | Decisión |
|---|----------|
| 1 | **No lo revisa un abogado.** T&C genéricos que cubran lo que la app hace hoy. **La consecuencia va escrita** —cubre razonablemente, no garantiza cumplimiento— en el header del spec y como comentario de código en cada documento, **no de cara al usuario** (un documento que arranca dudando de sí mismo no sirve para nada) |
| 2 | **La separación de la atribución es la F0 de este spec, no un spec aparte.** Motivo estructural, no de prolijidad: la atribución es **condición de licencia** (CDLA-Permissive de Overture, Apache 2.0 de Foursquare, ODbL de OSM, ToS de Google) y los T&C son un **contrato con el usuario**. Dos documentos con dueños, ciclos de vida y riesgos distintos en un solo archivo terminan driftando, y el que quede viejo es el que rompe una licencia |
| 3 | **Criterio de redacción, y es el que reemplaza al abogado: se describe lo que el código hace.** Cada cláusula tiene que poder señalar una fila del § *Inventario*. **Si no se puede señalar dónde vive, no se escribe.** Unos T&C que prometen algo que el código no cumple son **peores** que no tenerlos: convierten un vacío en una declaración falsa |
| 4 | **`/legales` NO se mueve: se convierte en índice.** La atribución baja a `/legales/atribucion`. **Cero redirects**, porque la URL vieja sigue respondiendo 200 — que es el motivo de elegir esto y no `/atribucion`: `/legales` está linkeado desde **9 links en 6 archivos** y está en `app/sitemap.ts`. Es puerta de ida y queda resuelta antes de tocar nada |
| 5 | **Los 9 links se re-apuntan por MOTIVO, no en bloque — y el motivo NO se adivina por el archivo.** Al verificarlos uno por uno aparecieron **5 de beta y 4 de atribución**, y dos que parecían de atribución por vivir en la búsqueda (`results-list.tsx`, `search-shell.tsx`) resultaron ser el aviso de beta. **Los 4 que existen porque una licencia lo exige van a `/legales/atribucion`**; los 5 de beta se quedan en `/legales`. Re-apuntarlos todos al índice dejaría la atribución a **dos** clicks de donde la licencia la pide, que es justo el incumplimiento que la F0 viene a evitar |
| 6 | **La política declara las dos cookies funcionales.** *«No usamos cookies»* sería **falso** (sesión de better-auth + `voter_id`) y falso de un modo verificable en 5 segundos con el inspector. Lo que sí se dice, y es verdad y es mejor: **no hay cookies de analítica ni de terceros**, y por eso no hay banner |
| 7 | **La excepción a «sin IP» se declara: `session.ip_address` y `session.user_agent`.** Las escribe better-auth y son de **seguridad de la cuenta**, no de analítica. Se separa explícitamente del invariante de la instrumentación para que las dos afirmaciones convivan sin contradecirse. ⚠️ **A verificar en F2 contra la base**: confirmar que las columnas efectivamente se llenan (`select count(*) from session where ip_address is not null`) — si vinieran vacías, se dice eso |
| 8 | **`place_owner_content` no se borra al eliminar la cuenta, y el documento lo escribe tal cual.** *«Deja de mostrarse»* ≠ *«se borra»*, y la política dice la segunda solo si es cierta. El derecho de supresión de la Ley 25.326 se cubre con un **canal accesible** —`contacto@adondesalimos.com.ar`, el único mail que recibe— y no con un borrado automático que no existe. **Cambiar el código para que borre es puerta de ida y va al BACKLOG**, no a este spec |
| 9 | **Nada de exoneración total de responsabilidad.** Cicatriz de [`DEPLOY`](../active/DEPLOY.md) decisión 21 (el aviso de beta): *«no nos hacemos responsables de nada»* **no cubre** y el que sabe lo detecta. Y acá hay un motivo extra que no es de estilo: la **Ley 24.240 declara nulas las cláusulas abusivas**, así que una exoneración total es literalmente letra muerta. Lo que sí se dice: el catálogo sale de datos públicos y puede tener errores — que es lo que el aviso de beta ya dice bien |
| 10 | ⚠️ **El link de baja del footer es un `<Link>` pelado, y esto NO es un detalle de estilo.** El footer vive en `app/page.tsx` **y en `app/salir/layout.tsx`**: un componente que lea `headers()`, `cookies()` o `getSession` para decidir si mostrar *«Cancelar suscripción»* convierte **301 landings estáticas en 301 funciones serverless** ([`SEO`](../active/SEO.md) decisión 5) y en Vercel Hobby cada visita del crawler pasa a gastar cuota. **No tira error**: el build las marca `ƒ` en vez de `○`. Por eso el footer linkea a una página estática que explica, y la acción con sesión vive donde ya vive (`/cuenta`) |
| 11 | **Resolución 424/2020 — la sustancia está, el lugar no.** *«Cancelar suscripción»* existe hoy dentro de `components/billing/suscripcion-panel.tsx`, o sea a varios clicks y detrás de login. La norma pide **botón de arrepentimiento y botón de baja accesibles desde la página principal**. Se resuelve con un link en el footer a `/legales/baja`, página estática que explica los dos y lleva a `/cuenta`. ⚠️ **A verificar, no es sentencia**: sale de una lectura, no de un abogado |
| 12 | **El T&C se acepta por uso, con una línea en el alta.** *«Al crear la cuenta aceptás los Términos y la Política de Privacidad»* bajo el botón de registro — copy, no checkbox. **No se agrega un checkbox duro**: el de [`TITULARIDAD`](../active/TITULARIDAD.md) decisión 5 existe porque ahí la declaración **es la prueba que sostiene revocar una cuenta**; acá no sostiene nada que el T&C no cubra, y la fricción se paga en el embudo más caro que tiene la app |
| 13 | **Las fotos: licencia no exclusiva y revocable, pedida en el punto de subida.** El dueño **declara tener derecho** sobre la foto y nos da permiso para mostrarla en la app **mientras la foto exista**; borrarla desde el panel corta el permiso. Hoy el flujo de subida **no tiene una sola línea legal** (verificado en `components/negocio/`). Va una línea de copy en el punto de subida, mismo criterio que la 12 |
| 14 | **Edad: la app se usa sin cuenta y sin edad mínima; crear cuenta y contratar es 18+.** Declarado, **sin verificación** — no existe y prometerla sería violar la decisión 3. Es lo mínimo coherente con que la app se cobra y buena parte del catálogo son bares |
| 15 | **Los documentos se versionan con una fecha visible y con git, sin tabla nueva.** Cada uno lleva *«Última actualización: YYYY-MM-DD»*. **No se guarda qué versión aceptó cada usuario**: sería un pasivo nuevo sin ningún uso hoy. Es la cicatriz de TITULARIDAD decisión 6 leída al revés — allá se versionó en la base porque la declaración sostiene una revocación; acá no sostiene nada |
| 16 | **El aviso de beta se queda en `/legales`, arriba del índice.** No es un documento legal, pero **es lo que viene a leer quien toca el link del footer**, y darle URL propia agrega una página para no ganar nada. `/legales` queda siendo *«la letra chica»*: beta arriba, los cuatro documentos abajo, correcciones al pie |

### ⚠️ La única entrada que este spec no puede resolver solo

**Quién es el titular del servicio.** La Ley 24.240 art. 4 pide que el proveedor esté
identificable, y unos T&C sin titular son casi lo mismo que no tenerlos. **No bloquea F0** —
bloquea el cierre de F1.

⚠️ **El dominio NO alcanza, y esta es la pregunta que ya se hizo una vez** (Fer, 2026-08-21):
*«¿puedo poner `adondesalimos.com.ar` y el mail de contacto?»*. **No**: un dominio no es una
persona ni una razón social, no se le puede reclamar nada, y un contrato cuyo titular es una URL
es un contrato **sin una de las dos partes**. Es exactamente el pecado de la decisión 3 —parecer
legal sin describir nada— aplicado al campo que sostiene todos los demás. Queda escrito acá para
que la sesión que implemente F1 no la re-abra.

**Lo que hace falta, entonces:**

| Dato | Estado |
|---|---|
| Nombre completo de Fer (persona física) | ⏳ pendiente |
| CUIT / CUIL | ⏳ pendiente. **No es sensible**: es público y se baja con la constancia de ARCA solo con el número ([`TITULARIDAD`](../active/TITULARIDAD.md) ya lo relevó) |
| Mail de contacto | ✅ `contacto@adondesalimos.com.ar` |
| Jurisdicción | ✅ Ciudad Autónoma de Buenos Aires, salvo que Fer diga otra |
| Domicilio | ➖ **se publica sin domicilio** (ver abajo) |

**Sobre el domicilio, que es la parte incómoda: se omite a propósito y con la brecha anotada.**
Publicar la dirección particular de un dev solo tiene un costo real y concreto, y hay dos
mitigantes que no son excusas: el **checkout de MercadoPago identifica al vendedor con nombre y
CUIT antes de que nadie pague** —o sea, el punto donde se forma la relación de consumo sí muestra
un responsable—, y el mail de contacto es un canal vivo que se contesta. **Esto es una brecha
declarada, no una omisión**: si el volumen o el ingreso lo justifican, se agrega un domicilio
comercial y se actualiza la fecha del documento (decisión 15).

---

## Fases

Orden por dependencia, no por riesgo. **F3 no depende de F1 ni F2** y puede adelantarse si hay poco
tiempo: es la más barata y la única con un requisito de **forma**.

### F0 — Separar la atribución (código, sin texto nuevo)
Mover las secciones de atribución de `app/legales/page.tsx` a `app/legales/atribucion/page.tsx` sin
tocar una palabra del texto, dejar `/legales` como índice con el aviso de beta arriba, re-apuntar
los 8 links según la decisión 5 y sumar las URLs nuevas al sitemap.

### F1 — Términos y Condiciones (`/legales/terminos`)
Qué es el servicio, qué no garantiza (sin exoneración total, decisión 9), la cuenta y su baja, el
contenido del dueño y la licencia de las fotos (decisión 13), el uso aceptable, los planes pagos y
la aceptación por uso (decisión 12). Suma la línea del alta y la del punto de subida.

### F2 — Política de privacidad (`/legales/privacidad`)
El § *Inventario* convertido en documento: qué se guarda, qué **no** (la carta del bloque B), las
dos cookies, los terceros de los dos grupos, la retención real y los derechos de la Ley 25.326 con
el canal para ejercerlos.

### F3 — Baja y arrepentimiento (`/legales/baja` + link en el footer)
La Resolución 424/2020 hecha lugar, no redacción. Página estática y link pelado (decisión 10).

---

## Criterios de done (DoD)

Escritos para que `/qa-spec` los pueda verificar con `grep` y con una lectura de pantalla.

### F0 — Separación
- [ ] `app/legales/atribucion/page.tsx` existe y contiene **todas** las secciones de licencia que
      hoy están en `app/legales/page.tsx`: Overture, los 7 de CDLA Permissive 2.0, Foursquare
      (Apache 2.0), AllThePlaces (CC0), zonas (BA Data + IGN), MapLibre/OpenFreeMap (ODbL) y Google.
- [ ] `/legales` responde **200** y es índice: aviso de beta arriba + link a los cuatro documentos.
- [ ] **Cero redirects nuevos** — `grep -rn "redirect" app/legales` no devuelve nada.
- [ ] Los **4 links que existen por licencia** apuntan a `/legales/atribucion`: la segunda mitad
      del footer de `app/page.tsx` y de `app/salir/layout.tsx` (*«Overture Maps y Google»*), el
      *«Fuentes y atribución»* de `app/lugar/[id]/page.tsx` y el del bloque de Google en
      `components/lugar/ficha-google.tsx` (que es **el** que la licencia de Google exige).
- [ ] Los **5 links de *«Estamos en beta»*** siguen apuntando a `/legales`: `app/page.tsx`,
      `app/salir/layout.tsx`, `app/lugar/[id]/page.tsx`, `components/search/results-list.tsx` y
      `components/search/search-shell.tsx`.
- [ ] `grep -rn "\"/legales\"" app components` devuelve exactamente esos 5; ningún link a
      `/legales` quedó siendo de atribución.
- [ ] `app/sitemap.ts` incluye `/legales` **y** las cuatro páginas nuevas.
- [ ] `npm run build` marca **`○` (estática)** para `/legales` y sus hijas, y **las 301 páginas de
      `/salir` siguen `○`** — el criterio duro de la decisión 10.

### F1 — Términos
- [ ] `/legales/terminos` existe, es estática y lleva *«Última actualización: YYYY-MM-DD»*.
- [ ] Identifica al titular del servicio (el dato pendiente de Fer) y la jurisdicción.
- [ ] `grep -in "no nos hacemos responsables\|bajo ninguna circunstancia\|renuncia a todo"` sobre
      el archivo devuelve **cero** (decisión 9).
- [ ] Dice 18+ para crear cuenta y contratar (decisión 14).
- [ ] Cubre la licencia de fotos como **no exclusiva y revocable al borrar la foto** (decisión 13).
- [ ] La pantalla de registro muestra la línea de aceptación con link a `/legales/terminos` y
      `/legales/privacidad` (decisión 12).
- [ ] El punto de subida de fotos muestra la línea de declaración de derechos (decisión 13).

### F2 — Privacidad
- [ ] `/legales/privacidad` existe, es estática y lleva fecha de última actualización.
- [ ] **Cada dato del § Inventario bloque A está en el documento**, con su para qué y qué pasa al
      dar de baja.
- [ ] Dice que `place_owner_content` **deja de mostrarse pero no se borra** (decisión 8) y da el
      canal de supresión.
- [ ] Declara las **dos** cookies funcionales y dice que no hay cookies de analítica ni banner.
- [ ] `grep -in "no usamos cookies\|sin cookies"` sobre el archivo devuelve **cero** (decisión 6).
- [ ] Declara `session.ip_address` / `user_agent` como excepción de seguridad, **verificado contra
      la base** antes de escribirlo (decisión 7).
- [ ] Enumera los **dos grupos** de terceros del bloque D, incluidos los que reciben la IP porque el
      navegador les pega directo (Google, OpenFreeMap, R2, Vercel, Neon).
- [ ] Dice que el chat manda el texto a Anthropic y linkea la política de Anthropic **en vez de
      afirmar en su nombre** qué hace con el dato.
- [ ] Dice la retención real: **no hay borrado automático**; los datos viven mientras exista la
      cuenta. `grep -in "a los [0-9]* \(días\|meses\)"` no debe encontrar un plazo inventado.
- [ ] Enumera los derechos de la Ley 25.326 (acceso, rectificación, actualización, supresión) con
      `contacto@adondesalimos.com.ar` como canal.

### F3 — Baja y arrepentimiento
- [ ] `/legales/baja` existe, es **estática**, explica arrepentimiento (10 días) y baja, y linkea a
      `/cuenta` y al mail de contacto.
- [ ] Hay un link a `/legales/baja` en el footer de `app/page.tsx` **y** de `app/salir/layout.tsx`.
- [ ] ⚠️ Ese link es un `<Link href>` literal: `grep -n "headers()\|cookies()\|getSession"` sobre
      los dos footers y sobre `/legales/**` devuelve **cero**.
- [ ] `npm run build` sigue marcando `○` en las 301 páginas de `/salir` (decisión 10).

---

## QA manual (IDs propuestos)

| ID | Caso | Criterio |
|----|------|----------|
| LEG-01 | Entrar a `/legales` | Responde 200, muestra el aviso de beta y el índice de los 4 documentos |
| LEG-02 | Entrar a `/legales/atribucion` | Están las 9 fuentes de Overture, las 3 licencias, zonas, OSM/OpenFreeMap y Google, con el mismo texto que antes |
| LEG-03 | Abrir una ficha con datos de Google y tocar la atribución de Google | Cae en `/legales/atribucion`, **no** en el índice — la licencia lo exige a un click |
| LEG-04 | Tocar *«Estamos en beta»* en el footer de la home | Cae en `/legales` |
| LEG-05 | Tocar *«Overture Maps y Google»* en el footer de `/salir/palermo` | Cae en `/legales/atribucion` |
| LEG-05b | Buscar algo sin resultados y tocar *«estamos en beta»* del estado vacío | Cae en `/legales`, **no** en la atribución |
| LEG-06 | `npm run build` con el dev server **parado** | `/legales` y sus hijas salen `○`; las 301 de `/salir` **siguen** `○` |
| LEG-07 | Pedir `sitemap.xml` | Contiene `/legales`, `/legales/atribucion`, `/legales/terminos`, `/legales/privacidad` y `/legales/baja` |
| LEG-08 | Leer `/legales/terminos` buscando quién presta el servicio | Titular y jurisdicción identificables |
| LEG-09 | Leer `/legales/terminos` buscando cláusulas de exoneración total | No hay ninguna |
| LEG-10 | Crear una cuenta nueva | Bajo el botón aparece la línea de aceptación con los dos links, y los dos abren |
| LEG-11 | Entrar al panel del dueño y abrir el subidor de fotos | Se ve la línea de declaración de derechos sobre la foto |
| LEG-12 | Cruzar el bloque A del inventario contra `/legales/privacidad` | Cada fila tiene su párrafo; ninguna falta |
| LEG-13 | Buscar en `/legales/privacidad` qué pasa con el contenido del dueño al borrar la cuenta | Dice que deja de mostrarse y **no** que se borra, y da el canal para pedir la supresión |
| LEG-14 | Abrir el inspector en la home y mirar las cookies | Las que hay están declaradas en la política; no hay ninguna de analítica |
| LEG-15 | Votar en una votación desde una pestaña limpia y mirar las cookies | Aparece `voter_id` y está declarada |
| LEG-16 | Buscar en `/legales/privacidad` los terceros | Están los 4 del server y los 5 que ve el navegador, con la IP dicha explícitamente |
| LEG-17 | Buscar un plazo de retención | No hay ninguno inventado; dice que los datos viven mientras exista la cuenta |
| LEG-18 | Entrar a la home **sin sesión** y buscar cómo darse de baja | Hay un link visible en el footer que lleva a `/legales/baja` |
| LEG-19 | Desde `/legales/baja` seguir el camino hasta cancelar | Llega a `/cuenta` (con login) y ahí está el botón que ya existía |
| LEG-20 | `select count(*) from session where ip_address is not null` | El número respalda lo que dice la política (decisión 7) |

---

## Relación con otros specs

- **[`TITULARIDAD`](../active/TITULARIDAD.md)** — su decisión 8 (la evidencia no se guarda) es una
  de las mejores frases de la política de privacidad. Y su decisión 5 es el contraejemplo que
  justifica la 12 de acá: cuándo un checkbox duro se paga y cuándo no.
- **[`MONETIZACION`](../done/MONETIZACION.md)** — la decisión 22 es el bloque B entero. ⚠️ Se cita
  con la corrección de la decisión 6: *«sin cookies»* vale para la instrumentación, no para la app.
- **[`SEO`](../active/SEO.md)** — su decisión 5 es la restricción dura de la decisión 10 de acá.
  Cualquier cosa de sesión en un footer compartido mata 301 páginas estáticas en silencio.
- **[`DEPLOY`](../active/DEPLOY.md)** — su decisión 21 (el aviso de beta) fija el tono: expectativa
  honesta, no escudo legal. Y su F3 (encender el cobro) es lo que este spec deja limpio.
- **[`FICHA`](../done/FICHA.md)** — la disciplina de costos de Google (nada se persiste) resulta ser
  también una ventaja de privacidad. No estaba buscada; se cobra igual.

## v2 (fuera de scope)

- Borrar `place_owner_content` al eliminar la cuenta (decisión 8) — puerta de ida, al BACKLOG.
- Revisión por un abogado, si el volumen o el ingreso lo justifican.
- Registro de bases de datos ante la AAIP (Ley 25.326 art. 21) — evaluar cuando haya volumen real.
- Tabla de aceptación versionada (decisión 15), si algún día un cambio de términos lo pide.
