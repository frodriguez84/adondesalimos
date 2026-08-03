# Spec: Deploy a producción (Neon + Vercel)

**Estado:** Parcial — § *El premium apagado* ✅ Implementado (2026-08-01, el primer tramo de código de F1: tabla `premium_interest` + endpoint + `SuscripcionPanel` + conteo en `/admin`); F0, el resto de F1 (`noindex`, `maxDuration`, `.env.example`, Vercel + DNS), F2 y F3 pendientes
**Prioridad:** Alta — es el #2 de la cola post-v2 y lo único que separa "todo implementado" de "usable". Desbloquea el backlog que hoy no se puede trabajar por falta de usuarios reales (afinar `chips.schedule` con `place_tag_impressions_daily`, el gatillo de Google OAuth, la curaduría guiada por uso del #3).
**Gate:** Ninguno para F0/F1/F2. **F3 (encender el cobro) está gateada** — ver decisión 18.
**Bloquea:** la curaduría de cobertura (#3 de la cola post-v2), que depende de datos de uso reales; ABIERTO_AHORA F2; el afinado de CHIPS_ROTACION.
**Depende de:** `CLAUDE.md` § Reversibilidad · § Disciplina de costos de Google · § Redes de seguridad · `docs/specs/done/MONETIZACION.md` (decisión 15, cancelación) · `docs/specs/done/CHAT_IA.md` (decisión 15, kill switch) · `docs/specs/done/AUTH.md` (decisión 23, rate limit; F1 diferida = Google OAuth)
**⚠️ Orden:** `docs/specs/planned/PULIDO_BETA.md` va **antes de F0** (su decisión 12). No es preferencia: F0 restaura un dump y el valor del dump es que esté fresco — si el pulido toca algo que vive en la base, F0 se hace dos veces. Además `PULIDO_BETA` F4 (la app instalable, `manifest.ts`) cubre terreno vecino a los 4 cambios chicos de F1.

---

## Problema

La app está entera y corre solo en la notebook de Fer, expuesta por un túnel ngrok. Nadie la
puede usar. Y sin usuarios reales hay una cola de trabajo que **no se puede empezar**: las reglas
de rotación de chips son sentido común declarado en vez de curaduría con evidencia, el gatillo de
Google OAuth ("funnel real de signups") no puede cumplirse, y la curaduría de cobertura se pagaría
a ciegas sobre 14.458 lugares sin saber cuáles importan.

Además hay tres cosas del entorno de dev que **no sobreviven a serverless** y hoy nadie mira: el
rate-limit vive en la memoria del proceso, la base es un contenedor de Docker en localhost:5439, y
la curaduría (~3.967 tags `source='admin'`) no está en git ni en el seed — existe **solo** en ese
Postgres.

## Objetivo

Poner la app en `https://adondesalimos.com.ar`, con la base en Neon y el catálogo completo migrado,
**gastando US$0/mes**, y empezar a acumular los datos de uso que destraban el resto del backlog.

## Qué NO es esta feature

- **No es encender el cobro.** MercadoPago queda apagado (decisión 5). El premium sigue
  modelado, gateado server-side y encendido en la base — lo único apagado es el checkout.
- **No es una landing de marketing.** La home es el buscador (BUSQUEDA decisión 1) y así queda.
- **No es tocar el motor, el catálogo ni la curaduría.** Los datos viajan tal cual están.
- **No es Google OAuth ni Upstash.** Los dos son post-deploy (F2), a propósito: ver decisión 12.
- **No es CI/CD ni entorno de staging.** Un solo entorno, deploy desde `main` por push.

---

## Presupuesto — los números antes de la recomendación

| Servicio | Plan elegido | Costo | Límite relevante | Margen real |
|---|---|---|---|---|
| **Dominio** | `adondesalimos.com.ar` en NIC | **ya pago** — $8.500/año de renovación | — | .ar sale $25.500/año; no se usa |
| **Vercel** | Hobby | **US$0** | Prohíbe uso comercial ⇒ el cobro apagado no es una preferencia, es la condición | Pro = US$20/mes ≈ ARS 46.000 ≈ **7 premium solo para empatar** |
| **Neon** | Free | **US$0** | 0,5 GB storage · 100 CU-h/mes · 5 GB egress | la base pesa **48 MB = 10%** del cupo |
| **Upstash** (F2) | Free | **US$0** | 500.000 comandos/mes · 256 MB | ~2 comandos/request ⇒ ~8.000 requests/día |
| **Cloudflare R2** | Free | **US$0** | 10 GB | ya en uso, sin cambios |
| **Resend** | Free | **US$0** | ~3.000 mails/mes (verificar al configurar) | signups de una beta no se acercan |
| **Anthropic** | pay-as-you-go | **≤ US$20/mes** | tope duro `ai.chat_monthly_cap = 500` (decisión 8) | el único costo variable, y tiene kill switch |

**Total fijo: US$0/mes.** El único gasto posible es Anthropic, acotado por un tope que degrada
la app en vez de facturar.

Tamaño de la base, medido el 2026-07-31: 48 MB totales — `places` 21 MB · `place_zones` 6,7 MB ·
`place_tags` 5,8 MB · `zones` 2,4 MB · `place_tag_suggestions` 1,3 MB.

---

## Decisiones cerradas

| # | Decisión |
|---|----------|
| 1 | **El dominio es `adondesalimos.com.ar`, y ya está registrado a nombre de Fer.** Verificado el 2026-07-31: la zona existe en Cloudflare (`lee`/`isabel.ns.cloudflare.com`), mismo patrón que `turnia.com.ar`. **La puerta de ida ya está cruzada**: no hay nada que decidir ni que comprar, solo DNS que apuntar. ⚠️ **La zona NO está vacía**: el apex no tiene A/MX/TXT, pero los subdominios de Resend **sí están publicados y en uso** (ver decisión 19) — al agregar el registro de Vercel, no tocar nada de `send.*` ni de `resend._domainkey.*`. Para el registro en sí: el whois público de `.ar` no es consultable desde afuera (`rdap.nic.ar` cierra la conexión), así que se mira en nic.ar con clave fiscal o en el panel de Cloudflare. |
| 2 | **No se compran dominios defensivos ahora.** Al 2026-07-31 están **libres** `adondesalimos.com` (~US$12/año) y `adondesalimos.app`; están **tomados** `quesale.com.ar`, `quepinta.com.ar`, `salimos.com.ar` y `quesale.com`. Comprar el `.com` es puerta de ida y vuelta (se compra cuando y si hace falta) y no aporta nada a un producto de AMBA cuya audiencia tipea `.com.ar`. Anotado en el BACKLOG por si aparece intención de marca. |
| 3 | **Hosting: Vercel Hobby (US$0).** El stack que Fer ya opera en turnia. |
| 4 | **Base: Neon Free, región `aws-sa-east-1` (São Paulo); funciones de Vercel en `gru1` (São Paulo).** Los dos en Sudamérica: ~30 ms desde AR contra ~120 ms si la base quedara en Virginia, y el motor de búsqueda hace varias queries por página. Mover un proyecto de Neon de región después es dump/restore, así que se elige bien de entrada. |
| 5 | **El cobro sale APAGADO. No se setean `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` ni `NEXT_PUBLIC_MP_PUBLIC_KEY` en Vercel.** No es una preferencia de producto: Vercel Hobby prohíbe el uso comercial (cualquier deploy "atado a ganancia financiera", incluidas donaciones), y la sanción es que te suspendan el proyecto sin aviso. Cobrar exige Pro (US$20/mes). **Y el día 1 no hay a quién cobrarle**: no hay dueños reclamados (1 lugar con horarios propios) ni usuarios. Encender el cobro habilita que alguien *pueda* pagar, que no es lo mismo que recaudar. Esperar cuesta exactamente cero. |
| 6 | **El premium NO se esconde: se anuncia como "en camino" y se mide el interés.** Sin la public key de MP, hoy `checkout-modal.tsx` degrada a *"Configuración de pago incompleta."* — no rompe la app, pero es copy de desarrollador y le dice al usuario que algo está roto. Se reemplaza por un mensaje de producto en `SuscripcionPanel`, con un botón que **registra el interés**. Ese contador es el dato que dispara los US$20: se deja de decidir por corazonada. **Copy, schema y superficies: ver § El premium apagado**, más abajo. |
| 6b | **Y NO se regala el premium durante la beta.** Es la pregunta natural ("si no podés cobrar, abrilo gratis") y la contesta una regla que ya existe en `CLAUDE.md`: *"subir un cupo es un regalo; bajarlo es una traición"*. Abrirlo ahora obliga a sacarlo después, y de paso **destruye la señal**: nadie pide lo que ya tiene. Los gates de free (1 lista, 3 mensajes de chat) siguen aplicándose igual que hoy. |
| 7 | **El chat IA queda encendido** (un free ya tiene `ai.chat_quota_trial = 3` mensajes/mes). Es el diferencial del producto y en una beta sin cobro lo que querés es justamente que lo prueben. |
| 8 | **`ai.chat_monthly_cap` baja de 5.000 a 500 para el lanzamiento** — un `UPDATE` en `app_settings`, cero código, cero deploy. Techo duro de ~US$20/mes. Al llegar, `reservarCupo` corta **antes** de llamar a Anthropic y el usuario ve un banner rioplatense ("El chat está descansando un rato / Volvé más tarde y seguimos") con el input bloqueado, sin perder su mensaje: es la degradación que diseñó la decisión 15 de CHAT_IA, ya probada. Se sube cuando el consumo real se vea en `/admin`. |
| 9 | **El sitio sale con `noindex` y se prende después del QA en prod.** Google reindexando una beta con un bug es caro de despintar; unos días de demora en SEO no se notan. Son 3 líneas en `app/robots.ts` y sacarlas es otro cambio de 3 líneas. `/api/` y `/admin` siguen bloqueados como ya estaban (FICHA decisión 16). |
| 10 | **El pooling NO cambia el driver.** Se usa el endpoint **pooled** de Neon con el `postgres-js` que ya está: `lib/db/index.ts` ya hace `{ prepare: false, max: 1 }` cuando `NODE_ENV === 'production'`, que es exactamente lo que pide un pooler transaccional. Migrar a `@neondatabase/serverless` tocaría el módulo por el que pasa **toda** la app para ganar nada medible a este volumen. Las **migraciones y los scripts offline** (`db:migrate`, `curar`, `import-overture`, `zones:*`) van por el endpoint **direct**, no por el pooled. |
| 11 | **Se acepta el cold start de Neon.** El plan Free apaga el compute a los 5 minutos de inactividad: con tráfico ralo, casi toda visita paga ~0,5–3 s extra en la primera query. Las alternativas son peores: mantenerlo despierto 24/7 son ~182 CU-h/mes contra las 100 gratis, o ~US$19/mes en el plan Launch. Se acepta, se anota, y se revisa cuando el tráfico lo haga doler (que es justo cuando el compute deja de dormirse solo). |
| 12 | **El rate-limit sale a producción en memoria, degradado y con fecha de vencimiento.** En serverless cada instancia lleva su propio contador, así que el límite se afloja tantas veces como instancias haya vivas. Se banca en F1 (beta sin cobro, tráfico bajo) y se mueve a **Upstash Free** en F2, **después** del primer deploy: no se mete un proveedor nuevo en el mismo paso donde ya cambian la base, el hosting y el dominio — si algo falla, tiene que saberse qué fue. Donde más duele mientras tanto no es `/api/search` (raspar el catálogo es molesto, no caro) sino **reclamos/altas**: 3 por día por IP se vuelven 3 × instancias, y cada fila la mira un humano en `/admin`. |
| 13 | **`TRUSTED_IP_HEADER = x-real-ip` en Vercel.** Sin esa declaración, `getClientIp` es fail-closed a propósito: todas las requests caen en el mismo bucket y comparten cupo. Falta en `.env.example` — se agrega. |
| 14 | **`DISABLE_RATE_LIMIT` NO se setea en Vercel, nunca.** Es de dev. |
| 15 | **La única `NEXT_PUBLIC_` que viaja es `NEXT_PUBLIC_APP_URL`** (la URL pública del sitio, que por definición no es secreto). Todo lo demás —`GOOGLE_PLACES_API_KEY`, `ANTHROPIC_API_KEY`, `R2_*`, `BETTER_AUTH_SECRET`, `RESEND_API_KEY`— va **sin** prefijo y por lo tanto Next garantiza que nunca llega al bundle: es el compilador el que lo asegura, no la disciplina de nadie. `BETTER_AUTH_SECRET` de producción se **genera nuevo** (`openssl rand -hex 32`), distinto al de dev. |
| 16 | **La key de Google Places queda restringida por API, no por IP.** Las funciones serverless no tienen IP fija, así que la restricción por IP no es opción. El control de gasto real ya existe y es otro: los topes por SKU en `app_settings` (`google.details_monthly_cap` / `photos_monthly_cap`), que degradan la ficha en vez de facturar. |
| 17 | **El DNS de Vercel en Cloudflare va DNS-only (nube gris), no proxeado.** Proxear Cloudflare por delante de Vercel es doble CDN y es la causa clásica de loops de redirección y de headers de IP inconsistentes — que además romperían la decisión 13. |
| 18 | **El cobro se prende (y con él Vercel Pro) cuando el interés medido lo justifique**, no por calendario. Disparador propuesto: **≥10 clicks de usuarios distintos** en el botón de la decisión 6, **o** el primer dueño que pida el plan B2B (ARS 15.000 ⇒ 3 pagan el hosting, contra 7 del B2C). Es puerta de ida y vuelta: el número se ajusta cuando haya datos. Prenderlo es setear 3 env vars + upgrade de plan, **sin tocar una línea de código** — pero **sí requiere redeploy**: `NEXT_PUBLIC_MP_PUBLIC_KEY` se inlinea en el build, así que setearla en el panel de Vercel no alcanza hasta que se reconstruya. |
| 19 | **El mail transaccional ya está resuelto — no es un bloqueante de lanzamiento.** El dominio está verificado en Resend y probado: DKIM en `resend._domainkey.adondesalimos.com.ar`, SPF y MX en `send.adondesalimos.com.ar` (→ `feedback-smtp.sa-east-1.amazonses.com`), y `RESEND_FROM_EMAIL = no-reply@adondesalimos.com.ar` ya en el `.env` de dev. En F1 la var se copia a Vercel y listo: no hay trámite pendiente. Bonus: Resend quedó en **sa-east-1**, la misma región que Neon y Vercel (decisión 4). |
| 20 | **Las cuentas de prueba se borran EN NEON, después del restore y antes del punto de no retorno** (decidido con Fer el 2026-08-02, a partir de su pregunta *"¿la tabla `users` no se crea vacía?"* — **no**: `pg_dump` copia schema **y** datos). El dump trae 4 usuarios, sus 4 `account` con los hashes de contraseña y 11 `session`, más todo su rastro por cascada. Lo grave no son las filas sueltas sino que **`frodriguez.este@gmail.com` es `ADMIN_EMAIL`**: si viaja, la cuenta admin de producción arranca con la contraseña de dev (y `pepe`/`juan`/`hugo` traen `12345678`, que está escrito en un archivo del repo). **Se limpia en Neon y no antes del dump** para que el Postgres de dev quede intacto con sus cuentas de prueba, y para que el paso siga siendo reversible: si sale mal, se borra el proyecto de Neon y se empieza de nuevo. **No se pierde `/admin`**: el gate es por email, así que Fer se registra de nuevo en prod con el mismo mail y queda admin con una contraseña nueva. ⚠️ **`session` y `account` NO tienen FK a `users`** —better-auth las creó sin foreign key— así que **no caen por cascada** y necesitan su propio `DELETE`. El SQL completo y la verificación por conteo están en el paso 5 de F0. **Origen:** el bloque F del QA integral #2 dejó la base *como estaba antes del QA*, que no es lo mismo que *lista para producción*; ese segundo criterio no tenía dueño y ahora lo tiene este paso. |

---

## Migración de datos — orden y punto de no retorno

⚠️ **La curaduría (~3.967 tags `place_tags source='admin'`), el catálogo y las zonas NO están en
git ni en el seed.** Son datos. El seed no los regenera y re-curarlos cuesta ~US$17. Todo este
bloque existe para que no se pierdan.

**F0 — cero código, enteramente reversible.** Mientras el Postgres de dev siga intacto, se puede
borrar el proyecto de Neon y empezar de nuevo sin perder nada.

1. `npm run backup:db` — es la red de seguridad **y** el archivo que se restaura. No se avanza sin esto.
2. Crear el proyecto en Neon, región **`aws-sa-east-1`**. Guardar las **dos** connection strings (pooled y direct).
3. Restaurar el dump completo a Neon por el endpoint **direct** (`--no-owner --no-acl`). El dump incluye `drizzle.__drizzle_migrations`, así que el estado de migraciones queda coherente y un `db:migrate` futuro sabe dónde está parado.
4. **Verificar por conteo, no mirando la pantalla**: `places` · `place_tags where source='admin'` (≈3.967, el canario de `/consistency-check`) · `place_zones` · `zones` (46) · `app_settings` (14) · `occasion_chips`.
5. **Borrar el rastro de las cuentas de prueba, EN NEON** (decisión 20). Ver abajo — es el paso que faltaba.
6. `UPDATE` de `ai.chat_monthly_cap` a 500 **en Neon** (decisión 8).

### El paso 5, en detalle — por qué existe y qué borra

**`pg_dump` copia schema *y* datos: `users` NO llega vacía.** El dump del 2026-08-02 trae **4
usuarios** de prueba, sus **4 `account`** (hashes de contraseña) y **11 `session`**, más todo su
rastro: 3 `subscriptions` de sandbox de MP —una `active` hasta el 2026-08-24—, el claim aprobado de
Kansas, 6 `polls`, 15 conversaciones de chat. Dos razones por las que no puede viajar así:

- **`frodriguez.este@gmail.com` es `ADMIN_EMAIL`**: esa fila haría que la cuenta admin de producción
  arranque con la contraseña de dev. Y `pepe`/`juan`/`hugo` viajan con `12345678`, que además está
  escrito en `docs/qa/DATOS_QA.local.md`.
- Una **suscripción viva** en el dump la puede reactivar cualquier reconciliación lazy.

**No se pierde el acceso a `/admin`:** el gate es por **email**, no por fila. Fer se registra en
producción con el mismo `frodriguez.este@gmail.com` y queda admin, con una contraseña nueva.

**Se hace en Neon y no antes del dump** (decidido con Fer, 2026-08-02): así el Postgres de dev
queda intacto con sus cuentas de prueba para seguir laburando, y el paso sigue siendo reversible —
si algo sale mal, se borra el proyecto de Neon y se empieza de nuevo.

```sql
-- ⚠️ Correr SOLO en Neon recién restaurado, ANTES del punto de no retorno.
-- Por email explícito y no `delete from users` a secas: si esto se corriera por error
-- más tarde, borra estas 4 cuentas y ninguna real.
delete from users where email in
  ('frodriguez.este@gmail.com','pepe@gmail.com','juan@gmail.com','hugo@gmail.com');

-- ⚠️ `session` y `account` NO tienen FK a `users` — better-auth las creó sin foreign key,
-- así que NO caen por cascada. Sin estos dos DELETE quedan 11 sesiones y 4 hashes de
-- contraseña huérfanos en producción.
delete from session where user_id not in (select id from users);
delete from account where user_id not in (select id from users);

-- No cascadean tampoco: cuelgan de `place_id`, no de `user_id`. Son el contenido y las
-- fotos del dueño de prueba de Kansas (las fotos apuntan al R2 de dev).
delete from place_owner_content;
delete from place_photos;
```

**Lo que sí cae por cascada** con el primer `DELETE` (las 8 tablas con FK a `users`, todas
`ON DELETE CASCADE`): `place_claims` · `place_lists` · `polls` (y con ellas `poll_options` y
`poll_votes`) · `subscriptions` · `chat_conversations` · `chat_quota_grants` ·
`chat_usage_monthly` · `premium_interest`. **El catálogo no depende de `users`** y queda intacto.

**Verificar por conteo, igual que el paso 4 — todas en 0:** `users` · `session` · `account` ·
`subscriptions` · `place_claims` · `place_lists` · `place_list_items` · `polls` · `poll_options` ·
`poll_votes` · `chat_conversations` · `chat_messages` · `premium_interest` ·
`place_owner_content` · `place_photos`. **Y re-verificar que el catálogo no se movió**: `places`
y `place_tags where source='admin'` tienen que seguir en los números del paso 4.

**El punto de no retorno es la primera escritura de un usuario real en Neon** — una cuenta, un
favorito, un voto. Desde ese instante el dev deja de poder pisar prod, todo cambio de schema va
por migración, y la regla de backup cambia de dueño: **antes de correr cualquier script contra
Neon (`curar`, `import-overture`, `zones:*`) hay que dumpear Neon, no el dev.**

---

## Env vars — qué viaja a Vercel y qué no

| Var | ¿Va? | Nota |
|---|---|---|
| `DATABASE_URL` | ✅ | endpoint **pooled** de Neon |
| `BETTER_AUTH_SECRET` | ✅ | **nuevo**, generado para prod |
| `BETTER_AUTH_URL` | ✅ | `https://adondesalimos.com.ar` |
| `NEXT_PUBLIC_APP_URL` | ✅ | mismo valor; única var que llega al browser |
| `ADMIN_EMAIL` | ✅ | sin esto `/admin` es 404 para todos |
| `RESEND_API_KEY` · `RESEND_FROM_EMAIL` | ✅ | dominio **ya verificado** en Resend; `no-reply@adondesalimos.com.ar` (decisión 19) |
| `GOOGLE_PLACES_API_KEY` | ✅ | server-only, restringida por API (decisión 16) |
| `ANTHROPIC_API_KEY` | ✅ | server-only |
| `R2_ACCOUNT_ID` · `R2_ACCESS_KEY_ID` · `R2_SECRET_ACCESS_KEY` · `R2_BUCKET` · `R2_PUBLIC_URL` | ✅ | server-only, sin cambios |
| `TRUSTED_IP_HEADER` | ✅ | `x-real-ip` (decisión 13) |
| `MP_ACCESS_TOKEN` · `MP_WEBHOOK_SECRET` · `NEXT_PUBLIC_MP_PUBLIC_KEY` | ❌ | **esto es lo que apaga el cobro** (decisión 5) |
| `GOOGLE_CLIENT_ID` · `GOOGLE_CLIENT_SECRET` | ❌ | F2, con el botón de OAuth |
| `DISABLE_RATE_LIMIT` | ❌ | jamás en prod (decisión 14) |

---

## El premium apagado — copy, schema y superficies

Decidido con Fer el 2026-07-31. Es lo primero que conviene implementar, **antes de migrar a
Neon**: agrega una tabla, y así el dump que se restaura ya la trae en vez de tener que correr
`db:migrate` contra Neon aparte.

### Cómo sabe el panel que el cobro está apagado

Por la **ausencia de `NEXT_PUBLIC_MP_PUBLIC_KEY`** — exactamente la misma señal que ya usa
`checkout-modal.tsx`. **No se agrega un flag en `app_settings`**: sería una segunda fuente de
verdad sobre lo mismo, y prenderla sin la key devolvería al usuario al mensaje roto. La presencia
de la key **es** el interruptor.

**En dev no cambia nada.** El `.env` local tiene las tres vars de MP con valor, así que el
checkout de dev sigue funcionando igual que hoy: el panel muestra el botón "Suscribirme por
$X/mes" y el Brick monta normal. El interruptor es por entorno, sin flags ni ramas de código.

⚠️ **Consecuencia para el QA (DEPLOY-10/15/16):** el mensaje de beta **no se puede ver en dev**
sin apagar la var. Para verificarlo hay que vaciar `NEXT_PUBLIC_MP_PUBLIC_KEY` en `.env`,
**reiniciar el dev server** (las `NEXT_PUBLIC_` se inlinean en el build del bundle de cliente, no
se leen en caliente) y restaurarla al terminar. Dejar dev sin la key es lo que después hace creer
que "el cobro se rompió".

### El copy (variante elegida: directa y honesta)

Dice primero lo importante —que no se puede pagar— y recién después vende, así nadie se queda
pensando si el botón está roto. Reemplaza al pitch + botón "Suscribirme por $X/mes" del estado free.

**B2C** (`/cuenta`):

> **Todavía no abrimos los pagos.**
> Estamos en beta. El premium está por salir: votaciones ilimitadas, historial y que la IA te arme
> la shortlist. Dejanos la señal y te escribimos apenas se pueda.
> `[ Avisame cuando abra ]`

**B2B** (`/mi-negocio/[placeId]`) — mismo esqueleto, con el pitch del plan del lugar que el panel
ya tiene escrito:

> **Todavía no abrimos los pagos.**
> Estamos en beta. El plan del lugar está por salir: descripción, carta, novedades, hasta 15 fotos
> y el destaque en las búsquedas. Dejanos la señal y te escribimos apenas se pueda.
> `[ Avisame cuando abra ]`

**Después del click** (estado confirmado, el botón no vuelve):

> ✓ Listo, anotado. Te escribimos a **<email de la cuenta>** apenas abramos los pagos.

El aviso es una **promesa real y manual**: el día que se prenda el cobro, Fer le escribe a esa
lista. No se automatiza nada — no hay cron y no hace falta.

### Schema — `premium_interest` (migración aditiva)

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid pk | |
| `user_id` | uuid not null → `users.id` (cascade) | requiere sesión: es una señal de mayor intención **y** deja el mail para avisar |
| `place_id` | uuid nullable → `places.id` (cascade) | **`null` = B2C, con valor = B2B** — el mismo criterio que ya usa `subscriptions` (no se inventa un enum de tipo) |
| `created_at` | timestamp | |

⚠️ **El dedupe necesita índices únicos PARCIALES, no un `unique(user_id, place_id)`**: en Postgres
`NULL ≠ NULL`, así que un unique común dejaría entrar N filas B2C del mismo usuario y el conteo se
inflaría con dobles clicks. Van dos:
- `unique (user_id) where place_id is null` — un solo interés B2C por persona.
- `unique (user_id, place_id) where place_id is not null` — uno por lugar.

Con eso, "cuántos lo pidieron" es un `count(*)` honesto y el segundo click es idempotente.

### Dónde se ve el número

En **`/admin` → tab Suscripciones**, que hoy está vacía justamente porque no hay suscripciones: es
donde ya vas a mirar "quién paga". Muestra **el conteo y la lista de mails**. La lista no es
decoración — es a quién le escribís el día que abrís; sin ella el contador es un número sin acción.

## Fases

| Fase | Qué | Código |
|---|---|---|
| **F0** | Neon: crear, restaurar, verificar por conteo, bajar el cap del chat | ninguno |
| **F1** | Los 4 cambios chicos de abajo + proyecto en Vercel + DNS + QA en prod + sacar el `noindex` | sí, acotado |
| **F2** | Rate-limit a Upstash Free (decisión 12) · botón de Google OAuth (gatillo cumplido por el lanzamiento) | sí |
| **F3** | Vercel Pro + encender el cobro. **Gateada** por la decisión 18 | no (env vars) |

**Los cuatro cambios de código de F1**, todos chicos. **El (2) va primero y antes de F0**: agrega
una tabla, así el dump que viaja a Neon ya la trae y se evita un `db:migrate` suelto contra prod.

1. `app/robots.ts` — `noindex` temporal (decisión 9).
2. `SuscripcionPanel` + tabla `premium_interest` + endpoint + el conteo en `/admin` — todo el detalle en § El premium apagado (decisión 6). ⚠️ Es migración: `npm run backup:db` antes.
3. `app/api/chat/route.ts` — declarar `export const maxDuration`: el chat es SSE con rondas de tool y puede tardar decenas de segundos; el default de la plataforma lo cortaría a mitad de respuesta. Verificar el default y el máximo vigentes de Hobby al deployar.
4. `.env.example` — sumar `TRUSTED_IP_HEADER` y `NEXT_PUBLIC_APP_URL`, que hoy se usan en código y no están documentados.

---

## Criterios de done (DoD)

- [ ] `https://adondesalimos.com.ar` sirve la home, con TLS válido y sin warning de dominio.
- [ ] El backup del dev existe y es previo a todo (`npm run backup:check` en verde).
- [ ] Conteos en Neon == conteos en dev para `places`, `place_tags source='admin'`, `place_zones`, `zones`, `app_settings`, `occasion_chips`.
- [ ] Una búsqueda con zona + tag devuelve los mismos resultados en prod que en dev.
- [ ] La ficha de un lugar carga, y el bloque de Google se pide desde el cliente (no en el render).
- [ ] Un usuario nuevo se registra y **recibe el mail de verificación** desde `no-reply@adondesalimos.com.ar` (el dominio ya está verificado, decisión 19: acá se confirma que también sale bien desde Vercel).
- [ ] `/admin` responde solo al `ADMIN_EMAIL` y es 404 para el resto.
- [ ] El chat contesta, descuenta cupo, y el tablero de `/admin` muestra el costo con los tokens de caché.
- [ ] `ai.chat_monthly_cap = 500` en Neon.
- [ ] En `/cuenta` y en `/mi-negocio/[placeId]`, el tab de Suscripción muestra el mensaje de beta —no *"Configuración de pago incompleta"*— y el click queda registrado.
- [ ] Clickear dos veces "Avisame cuando abra" deja **una** fila, no dos (índices únicos parciales).
- [ ] `/admin` → Suscripciones muestra el conteo de interesados y sus mails.
- [ ] Ninguna variable server-only aparece en el bundle del browser (grep sobre `.next/static`).
- [ ] `robots.txt` sirve el `noindex` en el deploy inicial, y deja de servirlo después del QA.
- [ ] Ningún secreto quedó commiteado: `.env` sigue gitignoreado y las vars viven solo en Vercel.

## QA manual (IDs propuestos)

| ID | Caso | Criterio |
|----|------|----------|
| DEPLOY-01 | Home en el dominio real | Carga, chips visibles, TLS válido |
| DEPLOY-02 | Búsqueda zona + tag, mismo caso que en dev | Mismo conteo y mismos lugares |
| DEPLOY-03 | Scroll infinito de resultados | Página 2 llega sin error de conexión |
| DEPLOY-04 | Ficha de un lugar con `google_place_id` | Bloque de Google aparece pedido desde el cliente |
| DEPLOY-05 | Registro de un usuario nuevo | Llega el mail de verificación y el link funciona |
| DEPLOY-06 | Login y sesión | La cookie sobrevive a recargar y a navegar |
| DEPLOY-07 | Guardar un favorito | Persiste tras recargar |
| DEPLOY-08 | Crear una votación y votar desde otro dispositivo | Voto cuenta una vez, resultados en vivo |
| DEPLOY-09 | Chat: 3 mensajes de trial | Responde, descuenta, y al cuarto muestra el gate |
| DEPLOY-10 | Tab Suscripción con el cobro apagado | Mensaje de beta, sin copy de desarrollador, click registrado |
| DEPLOY-11 | `/admin` con cuenta que no es admin | 404 |
| DEPLOY-12 | `robots.txt` | `noindex` presente antes del QA, ausente después |
| DEPLOY-13 | Primera visita tras >5 min de inactividad | Carga igual (cold start de Neon), sin error |
| DEPLOY-14 | Bundle del browser | Cero ocurrencias de las keys server-only |
| DEPLOY-15 | Tab Suscripción en `/mi-negocio/[placeId]` (B2B) | Mismo mensaje de beta, con el pitch del plan del lugar |
| DEPLOY-16 | Doble click en "Avisame cuando abra" | Una sola fila; la segunda vez ya muestra el estado confirmado |
| DEPLOY-17 | `/admin` → Suscripciones | Conteo y mails de los interesados, coincide con la base |

---

## v2 (fuera de scope)

- Slug SEO en la URL de la ficha (ya en el BACKLOG) — pega justo cuando se prenda la indexación.
- Sitemap.
- Entorno de staging y preview deployments con base propia.
- Alertas de caída / uptime.
- El copy del kill switch del chat ("volvé más tarde") sugiere una espera corta y el tope es
  mensual: con el cap en 500 llegar se vuelve plausible. Es un string, puerta de ida y vuelta.
