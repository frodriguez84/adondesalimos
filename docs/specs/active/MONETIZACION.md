# Spec: Monetización (MercadoPago)

**Estado:** 🟢 Parcial — F1 (Instrumentación + precios) ✅ Implementado (2026-07-24); F2 (cobro MP) · F3 (destaque) · F4 (desglose) pendientes. QA: `docs/qa/AnalisisQA.md` § MONETIZACION F1
**Prioridad:** Alta — spec 7: es el modelo de negocio entero. Enciende el premium B2C que VOTACION dejó modelado y apagado, y el plan pago B2B que AUTH dejó gateado a mano. Sin esto, `users.plan` y `owner_plan` se cambian con UPDATE y no entra un peso
**Gate:** Ninguno técnico. Operativo: crear la aplicación en MercadoPago (credenciales + webhook en el panel) y los usuarios de prueba del sandbox antes del QA de cobro
**Bloquea:** spec 8 (Chat IA — decidido que va después de que la monetización exista para solventar el costo de la API)
**Depende de:** AUTH (`owner_plan`, gating server-side de fotos/campos, teaser, `/cuenta`, `/mi-negocio`, `/admin`, `esDuenoDe`) · VOTACION (`users.plan`, `esPremium`, gates apagados) · BUSQUEDA (`construirWhere`/`clavesDeOrden`, `place_impressions_daily`, los 3 slots de destacados previstos) · FICHA (`detail_views`, acciones de la ficha) · código MercadoPago de StressPlan (ver § Reuso)

---

## Problema

- El premium B2C y el plan pago B2B están **modelados, gateados server-side y apagados**: hoy
  la única forma de que alguien pague es que el admin corra un `UPDATE` a mano. No hay
  checkout, no hay suscripción, no hay cobro recurrente.
- Las dos features que **venden** el plan B2B no existen: el destaque en búsqueda (BUSQUEDA
  dejó los 3 slots previstos, nadie los llena) y el desglose de estadísticas (AUTH dejó el
  teaser "tu ficha tuvo N visitas" — el número sin el desglose es el anzuelo, pero el
  desglose que convierte no está).
- Peor: **el desglose necesita datos que hoy no se registran**. `place_impressions_daily`
  acumula impresiones y aperturas de ficha, pero los taps (teléfono / cómo llegar / redes) y
  "qué filtros te encontraron" no se instrumentan. Ese histórico no se reconstruye: cada
  semana sin instrumentar es una semana menos de argumento de venta.
- Los costos son en USD y los precios en ARS: un precio que no se puede ajustar sin deploy
  se licúa en meses (riesgo estructural ya identificado en IDEAS; StressPlan lo sufre hoy).

## Objetivo

1. **Cobro con MercadoPago**: suscripción mensual B2B (ARS 15.000, **por lugar**) y premium
   B2C (ARS 7.000), con Checkout Bricks embebido, webhook firmado, estados de suscripción,
   idempotencia y reconciliación activa. Reuso de la integración probada de StressPlan.
2. **Automatizar `users.plan` y `places.owner_plan`** sin tocar el gating existente: los
   flags siguen siendo la única fuente del gate; la suscripción pasa a ser quien los mueve.
3. **Destaque B2B en búsqueda**: máx 3 por resultado, etiqueta visible, solo si matchea los
   filtros, posición rotativa entre suscriptos — sobre los slots que BUSQUEDA dejó previstos.
4. **Desglose de estadísticas** sobre el teaser de AUTH: vistas · impresiones · taps por tipo
   · qué filtros lo encontraron · comparación vs mes anterior · transparencia del destaque
   ("destacada en X de las Y búsquedas donde apareció"). Con la instrumentación nueva que lo
   alimenta, desde la primera fase.
5. **Tab de suscripción** en `/cuenta` (B2C) y en `/mi-negocio/[placeId]` (B2B).
6. **Precio en DB editable desde `/admin` desde el día 1**, con historial de cambios y el
   monto de cada suscripción congelado en su fila.

## Incógnitas resueltas (verificado en el código de StressPlan, 2026-07-24)

Las dos que IDEAS § Reuso dejó anotadas para resolver mirando código, no de memoria:

- **(a) ¿Bricks o Checkout?** Las suscripciones de StressPlan usan **Checkout Bricks (Card
  Payment Brick, embebido) + `POST /preapproval`**: el brick tokeniza la tarjeta en el sitio
  (`components/shared/CheckoutModal.tsx`), el token viaja a `POST /api/billing/checkout` y el
  backend crea el preapproval con `status:'authorized'` síncrono. El usuario **nunca sale de
  la app**. El redirect de Checkout Pro (`preference` + `init_point`) existe en StressPlan
  solo para el flujo à la carte de pagos únicos, que acá no existe. → Se adopta **Bricks**.
- **(b) ¿Usuarios de sandbox?** **Sí, hacen falta** usuario vendedor y comprador de prueba.
  Lecciones documentadas de StressPlan (`LECCIONES_APRENDIDAS.md` § MP sandbox): pagar
  **siempre con el comprador test**, nunca con la cuenta vendedor; con credenciales `APP_USR`
  usar el flujo de producción (forzar sandbox hace fallar el pago sin crear payment); el error
  `CC_VAL_433` tras muchos intentos es el antifraude de MP, no un bug. Tarjetas de prueba:
  Mastercard `5031 7557 3453 0604` / Visa `4509 9535 6623 3704`, titular `APRO`.

## Qué NO es esta feature

- **Chat IA / wizard / cupo de mensajes** (spec 8, decidido 2026-07-22). Este spec cobra; el
  spec 8 construye lo que el premium hace con la IA. El botón "IA arma shortlist" sigue no-op.
- **Descuento escalonado multi-local** (idea 2026-07-24): fuera de v1, ya en BACKLOG. El
  modelo por-lugar lo permite sumar después sin romperse.
- **Pagos únicos / à la carte / Checkout Pro**: no hay nada que vender por unidad. Solo
  suscripciones.
- **Trials, plan anual, tier superior B2C**: no decididos, no entran. El enum de estados no
  modela `trialing`.
- **Subir el precio a suscriptores existentes** (ajuste por inflación automático): v2. MP no
  tiene un camino confirmado para actualizar el monto de un preapproval vivo (StressPlan lo
  tiene abierto en `MP_INFLATION_PRICING`, sin resolver). Acá: el cambio de precio aplica a
  altas nuevas; las filas existentes conservan su monto congelado. → BACKLOG.
- **Facturación / comprobantes AFIP**: fuera de v1. Se cobra por MP y el comprobante es el de
  MP. → BACKLOG.
- **Panel de sync manual de MP en `/admin`** (StressPlan lo tiene): la reconciliación acá es
  automática (lazy); si hace falta un botón manual se agrega después. `/admin` solo suma
  Precios y la lista read-only de suscripciones.
- **Re-decidir pricing o qué incluye cada plan**: decidido en IDEAS § Monetización
  (2026-07-19, validado). Este spec lo implementa, no lo reabre.

## Decisiones cerradas

Las 1-8 vienen de IDEAS.md y de los specs 5-6 (no se reabren); las 9-31 son diseño de
**este** spec.

| # | Decisión |
|---|----------|
| 1 | **Precios de lanzamiento: B2B ARS 15.000/mes por lugar · B2C ARS 7.000/mes** (IDEAS § Precios, decidido 2026-07-19). Revisables — por eso viven en DB (decisión 5) |
| 2 | **La suscripción B2B es POR LUGAR, no por cuenta** (IDEAS, 2026-07-24). Un dueño con 3 locales paga 3; puede tener A en pago y B/C en free. En datos: `subscriptions.place_id` **nullable** — `null` = premium B2C del usuario; con valor = B2B de ese lugar. `user_id` (quién paga) siempre. Un usuario puede tener 1 fila B2C + N filas B2B |
| 3 | **Qué incluye cada plan: la tabla de IDEAS § "Qué incluye cada plan" es normativa** y ya está implementada del lado del gating (AUTH: 3 vs 15 fotos, campos pagos; VOTACION: 1 activa vs ilimitadas + historial). Este spec no agrega ni quita features de plan |
| 4 | **Regla de destacados** (IDEAS, decidida 2026-07-19): máx **3** por resultado, arriba, **etiqueta visible**, **solo si matchean los filtros** (se compra orden, no relevancia), y la posición **rota** entre los suscriptos que matchean. Fricción comercial asumida: un pagador puede no verse destacado en una búsqueda concreta — se compensa con transparencia en el panel |
| 5 | **El precio vive en `app_settings` y se edita desde `/admin` desde el día 1** (IDEAS § riesgo estructural): claves `billing.precio_b2b_ars` y `billing.precio_b2c_ars`, seed con los valores de la decisión 1. Ni env var ni hardcode. Se lee en cada request (patrón del umbral de confidence) |
| 6 | **Medio de pago: MercadoPago, reutilizando la integración de StressPlan** (IDEAS, verificado en código). No se reinventa: se portan módulos concretos (ver § Reuso) |
| 7 | **Ocultar ≠ borrar, en los dos ejes** (AUTH dec. 18, VOTACION § notas): bajar de plan oculta lo gateado sin borrar nada. Este spec extiende esa regla al cobro: vencer/cancelar mueve el flag y nada más |
| 8 | **`users.plan` y `places.owner_plan` siguen siendo LA fuente del gating.** Los helpers (`esPremium`, `resolverContenidoDueno`, cap de fotos, gates de votación) **no se tocan** — se consultan server-side en cada request a propósito (bajar el plan es inmediato, no espera refresh de sesión). La suscripción es quien **mueve** esos flags: los sincroniza en activación, caída y reactivación. Nadie más los escribe (se retira el "UPDATE documentado") |
| 9 | **Modalidad: Checkout Bricks (Card Payment Brick) + `POST /preapproval`** (incógnita (a) resuelta — patrón StressPlan verificado). El brick tokeniza en el sitio con `NEXT_PUBLIC_MP_PUBLIC_KEY`; el token viaja a nuestro endpoint; el server crea el preapproval con `status:'authorized'` y **activa el plan en la respuesta del POST** (no espera webhook). Sin SDK npm: `fetch` directo a `api.mercadopago.com` con Bearer (como StressPlan) |
| 10 | **Preapproval SIN plan pre-creado en MP** (divergencia explícita con StressPlan, que usa `preapproval_plan_id` por tier): acá el preapproval se crea con `auto_recurring { frequency: 1, frequency_type: 'months', transaction_amount: <precio vigente en DB>, currency_id: 'ARS' }`. Motivo: el precio vive en DB (decisión 5) y un plan en MP sería una **segunda fuente de verdad** a sincronizar a mano — exactamente el problema de 3 capas que StressPlan documenta en `PRICING_GRID.md` (el monto del Brick debe coincidir con el del plan o el usuario ve un número y MP cobra otro). Sin plan, hay una sola fuente y cero env de plan IDs. **Fallback documentado**: si el QA en sandbox demuestra que Bricks + preapproval sin plan no funciona, se cae al patrón con plan de StressPlan y el precio de DB queda como fuente de display + control — anotarlo como nota de implementación, no rediseñar en silencio |
| 11 | **Un solo módulo habla con MercadoPago: `lib/billing/mercadopago.ts`, server-only** — mismo criterio que `lib/google/places.ts` (Google) y `lib/storage/r2.ts` (R2). `MP_ACCESS_TOKEN` y `MP_WEBHOOK_SECRET` solo se leen ahí; jamás llegan al bundle. La única clave pública es `NEXT_PUBLIC_MP_PUBLIC_KEY` (es pública por diseño, la necesita el brick) |
| 12 | **Tabla `subscriptions`** (nombres MP nativos, sin el alias `stripe_*` legacy de StressPlan ni columna `billing_provider` — acá MP es el único proveedor): una fila por suscripción, `mp_preapproval_id` unique, `amount_ars` **congelado al contratar**, período vigente, `cancel_at_period_end`. Índices únicos parciales: una B2C viva por usuario, una B2B viva por lugar (ver § Modelo de datos) |
| 13 | **Estados: `active` · `past_due` · `canceled`** (enum propio, sin `trialing`). Mapeo desde el preapproval de MP: `authorized → active` · `pending → past_due` · `paused`/`cancelled → canceled` (+ flags abajo). El estado en DB **siempre se escribe desde un `GET /preapproval/{id}` fresco**, nunca desde el payload del webhook (GET defensivo, patrón StressPlan) |
| 14 | **Pago fallido en la renovación ⇒ `past_due` y el acceso se CONSERVA** mientras MP reintenta (2-3 reintentos internos, la app no programa cobros). Se baja a `free` solo cuando el preapproval pasa a `paused`/`cancelled`, o cuando el período venció y pasó la **gracia de 3 días** sin reconciliar un pago (patrón `expiry.ts` de StressPlan). Cortar el acceso al primer rechazo castigaría una tarjeta sin fondos un viernes — el costo de 3 días de gracia es cero |
| 15 | **Cancelación diferida simulada** (MP no tiene cancelación a fecha futura): al cancelar, se cancela **ya** el preapproval en MP (`PUT /preapproval/{id} {status:'cancelled'}`) pero en DB queda `cancel_at_period_end=true` con `current_period_end` intacto — el acceso sigue hasta el fin del período pagado. Reactivar antes de vencer **no existe** (un preapproval cancelado no se descancela): se ofrece un checkout nuevo cuando venza. Mutua exclusión con la decisión 14: una sub cancelada no recibe cobros ⇒ nunca cae en `past_due` |
| 16 | **Webhook `POST /api/webhooks/mercadopago`: SOLO topics de suscripción y SOLO firmados.** Validación HMAC-SHA256 del `x-signature` con `MP_WEBHOOK_SECRET` (manifest oficial `id:{data.id};request-id:{x-request-id};ts:{ts};`, comparación timing-safe — portar `validateWebhookSignature` de StressPlan). Firma ausente o inválida ⇒ **401**. El camino IPN legacy sin firma de StressPlan (`?topic=&id=`) **no se porta**: existía para merchant_order/payment del à la carte, que acá no hay. Topics procesados: `subscription_preapproval` (alta/estado) y `subscription_authorized_payment` (renovación). Respuestas: 200 = procesado o nada que hacer; 500 = error transitorio (MP reintenta; el handler es idempotente); 404 de MP al hacer el GET defensivo ⇒ 200 (data de prueba/borrada) |
| 17 | **Idempotencia en tres capas** (patrón StressPlan): (1) el GET defensivo hace inocuo reprocesar cualquier webhook; (2) cada renovación registra su `authorized_payment_id` en `subscription_payments` con UNIQUE — y el guard se registra **solo al aprobar**, nunca al rechazar, porque MP reusa el mismo id en el reintento (lección OBS-002: *"el guard va donde se aplica el efecto, no donde llega el evento"*); (3) todo read-modify-write sobre `subscriptions` va con `FOR UPDATE` (mismo criterio que el cap de fotos de AUTH F3) |
| 18 | **Reconciliación activa obligatoria — los webhooks de MP NO son confiables** (BUG-020 de StressPlan: 2 de 8 pagos aprobados sin notificar; no es opcional). Lazy check (patrón de expiración lazy de VOTACION): al renderizar los tabs de suscripción y en los puntos de gate billing-relevantes, si `current_period_end + gracia < now()` con estado `active`/`past_due`, se reconcilia contra `GET /preapproval/{id}` y se aplica lo que MP diga (extender período o bajar a free). Sin cron: el proyecto no tiene y este spec no lo agrega |
| 19 | **Bajar de plan = mover el flag, nada más.** B2C a `free`: no crea votaciones nuevas si ya tiene una activa, pierde historial e "IA arma shortlist" (gates existentes); **las votaciones ya abiertas siguen su curso** (son dato, la cancha ya está armada). B2B a `free`: campos pagos y fotos 4-15 se ocultan sin borrarse (ya implementado, AUTH), el destaque cesa al instante (el candidato se elige por flag en cada búsqueda), el desglose vuelve al teaser. Re-suscribir reactiva todo tal cual estaba — ocultar ≠ borrar es lo que hace la reactivación gratis |
| 20 | **Rotación del destaque: menor-mostrado-primero, con contador en DB — justa y verificable.** Candidatos = lugares con `owner_plan='paid'` ∩ `publishedWhere` ∩ **el `where` completo de la búsqueda** (vía `construirWhere` — la regla "solo si matchea" sale gratis y no se reimplementa). Orden: `featured_impressions` del día ascendente (el que menos veces salió destacado hoy va primero), desempate determinista por `md5(place_id || current_date)` (estable dentro del día, baraja entre días). Se toman hasta 3. Cada servida suma +1 a `featured_impressions` en `place_impressions_daily` (columna nueva), en el mismo batch `after()` de las impresiones. **Auto-balancea** (el rezagado se adelanta solo) y es **auditable desde los datos**: la transparencia del panel ("destacada en X de las Y búsquedas donde apareció") sale de `featured_impressions / impressions` — el mismo contador que decide es el que reporta. Alternativa descartada: rotación por bucket de tiempo `hash(place_id, hora)` — sin estado, pero no es proporcional cuando los conjuntos de candidatos difieren por búsqueda (el que matchea búsquedas raras saldría siempre o nunca) y no deja rastro auditable |
| 21 | **El destaque va solo en la lista y solo en la primera página** (sin cursor). El bloque de hasta 3 se sirve **arriba** del orden orgánico, que no se toca (BUSQUEDA dec. 16 dejó los slots previstos). Dedupe dentro de la página servida: si un destacado también cae en los 20 orgánicos de esa página, se quita de la parte orgánica (no aparece dos veces en pantalla). **El mapa no destaca** (los pins siguen siendo el encabezado orgánico — decisión 32 de BUSQUEDA intacta) y **"Ver N lugares" cuenta orgánico** (el destaque no infla el conteo). Card destacada = `PlaceCard` + badge "Destacado" con estilo propio — la misma card, no una segunda versión |
| 22 | **Instrumentación nueva, agregada pura — sin `user_id`, sin cookies, sin IP** (invariante de `place_impressions_daily` que vende el B2B): **(a)** `place_taps_daily(place_id, date, kind, count)` con `kind ∈ telefono · como_llegar · website · redes · menu` — el cliente dispara `navigator.sendBeacon` a `POST /api/lugar/[id]/tap` al tocar la acción (best-effort: un tap perdido no rompe nada, patrón `registrarImpresiones` que nunca tira); **(b)** `place_tag_impressions_daily(place_id, date, tag_id, count)` — "qué filtros te encontraron": por cada búsqueda servida con filtros de tags activos (incluye los expandidos por chips de Ocasión), los lugares servidos suman +1 en cada tag activo, en el mismo `after()` del batch de impresiones. El **texto libre no se registra** (cardinalidad + privacidad); zona/GPS tampoco (la zona del lugar es fija — no informa). Cardinalidad acotada: 20 lugares × ~3 tags por búsqueda |
| 23 | **La instrumentación entra en la PRIMERA fase, antes que el cobro.** El desglose se vende con histórico ("tu ficha tuvo 400 visitas, 37 taps al teléfono, te encontraron por *bar* y *música en vivo*") y ese dato no se reconstruye: cada semana de demora es histórico perdido. Mismo argumento con el que BUSQUEDA instrumentó impresiones el día 1 |
| 24 | **Desglose (solo `owner_plan='paid'`, gate server-side en la query del panel):** vistas de ficha (`detail_views`) · impresiones en búsqueda · taps por tipo · top de filtros que lo encontraron · **comparación vs mes anterior** (mes calendario, mismo criterio que el teaser) · transparencia del destaque ("destacada en X de las Y búsquedas donde apareció", decisión 20). Free sigue viendo **solo** el teaser de AUTH (el número pelado) — el teaser es el motor de conversión y no se enriquece |
| 25 | **Historial de precios: sí, genérico y barato** — tabla `app_settings_history(key, value, changed_by, changed_at)`, una fila por cada cambio hecho desde `/admin` (INSERT en el mismo PATCH). Cubre "¿qué precio regía en marzo?" para cualquier setting, no solo billing. **Lo operativo** — qué paga cada suscripto — no depende del historial: está congelado en `subscriptions.amount_ars` (decisión 12). Cambiar el precio afecta solo altas nuevas |
| 26 | **`/admin` suma dos secciones, nada más**: **Precios** (editar los 2 valores, con el historial visible) y **Suscripciones** (lista read-only: quién, qué lugar o B2C, estado, monto, período). Gate `ADMIN_EMAIL` existente. El resto del admin sigue en BACKLOG |
| 27 | **El checkout valida el monto esperado**: el cliente manda el `amount` que el brick mostró; si difiere del precio vigente en DB al momento del POST (cambió entre render y submit), el server rechaza con "el precio cambió, actualizá la página" — nunca cobrar un monto distinto del que el usuario vio |
| 28 | **Reclamo revocado o cuenta eliminada con suscripción B2B activa ⇒ cancelar el preapproval en MP (best-effort) + `owner_plan='free'`.** No se le puede seguir cobrando por un lugar que ya no controla. Se engancha en la revocación del admin (AUTH-13) y en el hook `beforeDelete` de better-auth que AUTH F2 ya dejó (que además cancela las B2C del usuario). Si el `PUT` a MP falla, la reconciliación lazy termina el trabajo — y el flag baja igual, ya |
| 29 | **Rate limit con el helper existente** (`lib/middleware/rate-limit.ts`, memoria de proceso): `POST /api/billing/checkout` **5/h por IP** (un humano no contrata 5 veces por hora; corta el brute-force de tokens) · `POST /api/lugar/[id]/tap` **60/h por IP** (generoso; corta el inflado burdo de stats). El **webhook no lleva rate limit**: está firmado (401 barato sin firma) y limitar los reintentos legítimos de MP sería un gol en contra |
| 30 | **Env nuevas (server-only salvo la pública):** `MP_ACCESS_TOKEN` · `MP_WEBHOOK_SECRET` (secreto dedicado del panel de MP, ≠ access token) · `NEXT_PUBLIC_MP_PUBLIC_KEY`. **Sin** env de plan IDs (decisión 10) ni de montos (decisión 5). El webhook se configura en el panel de MP apuntando a `/api/webhooks/mercadopago` (en dev, la URL de ngrok ya existente) |
| 31 | **QA de cobro contra sandbox con usuarios de prueba** (incógnita (b) resuelta): crear **vendedor y comprador de prueba** en MP; pagar siempre con el comprador test; tarjetas de prueba con titular `APRO`; `CC_VAL_433` tras muchos intentos = antifraude de MP, no bug. **Nunca completar un pago real, ni en QA.** Las lecciones sandbox de StressPlan aplican tal cual |

### Modelo de datos (migración sobre AUTH + VOTACION + BUSQUEDA)

**`subscriptions`** — una fila por suscripción.

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | uuid pk | |
| `user_id` | fk → `users` on delete cascade, not null | quién paga, siempre |
| `place_id` | fk → `places` on delete cascade, **nullable** | `null` = B2C premium; con valor = B2B de ese lugar (decisión 2) |
| `status` | pgEnum `'active'` · `'past_due'` · `'canceled'` not null | decisión 13 |
| `mp_preapproval_id` | text unique not null | id del preapproval en MP |
| `mp_payer_email` | text | el que pagó (puede diferir del email de la cuenta) |
| `amount_ars` | integer not null | **congelado al contratar** (decisión 25) |
| `current_period_start` · `current_period_end` | timestamp not null | período vigente |
| `cancel_at_period_end` | boolean not null default false | decisión 15 |
| `canceled_at` | timestamp nullable | |
| `created_at` · `updated_at` | timestamp not null | |

Índices únicos **parciales**: `(user_id) WHERE place_id IS NULL AND status <> 'canceled'`
(una B2C viva por usuario) · `(place_id) WHERE place_id IS NOT NULL AND status <> 'canceled'`
(una B2B viva por lugar). Las canceladas quedan como historial; re-suscribir crea fila nueva.

**`subscription_payments`** — guard de idempotencia de renovaciones + historial de cobros.

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | uuid pk | |
| `subscription_id` | fk → `subscriptions` on delete cascade, not null | |
| `mp_authorized_payment_id` | text **unique** not null | el guard (decisión 17); se inserta **solo al aprobar** |
| `amount_ars` | integer not null | |
| `period_start` · `period_end` | timestamp not null | el período que este pago extendió |
| `created_at` | timestamp not null | |

**`place_taps_daily`** — pk (`place_id`, `date`, `kind`) · `kind` pgEnum (`telefono` ·
`como_llegar` · `website` · `redes` · `menu`) · `count` int. Upsert `+1` (decisión 22).

**`place_tag_impressions_daily`** — pk (`place_id`, `date`, `tag_id`) · fk a `tags` ·
`count` int. Upsert `+N` en el batch de impresiones (decisión 22).

**`place_impressions_daily`** — columna nueva: `featured_impressions` int not null default 0
(decisión 20). Aditivo, sin backfill (antes del destaque el valor real es 0).

**`app_settings_history`** — `id` serial pk · `key` text · `value` jsonb · `changed_by` text
(email admin) · `changed_at` timestamp (decisión 25).

**`app_settings`** — seed de `billing.precio_b2b_ars = 15000` y `billing.precio_b2c_ars = 7000`
(idempotente: no pisa un valor ya editado — mismo criterio que el seed de chips).

### Rutas

| Ruta | Qué |
|------|-----|
| `app/api/billing/checkout` | `POST` — sesión inline; body `{ tipo: 'b2c' } \| { tipo: 'b2b', placeId }` + `token` del brick + `amount` esperado (decisión 27). B2B valida ownership (`esDuenoDe`) y reclamo aprobado. Crea el preapproval (decisión 10), y si vuelve `authorized`: fila en `subscriptions` + flag arriba, 201 con el plan ya activo. Rate limit 5/h/IP |
| `app/api/billing/cancel` | `POST` — sesión inline; `{ placeId? }` (sin placeId = la B2C). Cancela en MP + `cancel_at_period_end=true` (decisión 15) |
| `app/api/webhooks/mercadopago` | `POST` — firma HMAC obligatoria (401 sin ella), topics `subscription_preapproval` y `subscription_authorized_payment`, GET defensivo, idempotente (decisiones 16-17) |
| `app/api/lugar/[id]/tap` | `POST` — beacon `{ kind }`; upsert agregado; nunca tira; rate limit 60/h/IP (decisión 22) |
| `app/api/admin/settings` | `PATCH` — gate `ADMIN_EMAIL`; edita settings de billing + INSERT en `app_settings_history` (decisiones 25-26) |
| `/cuenta` — tab **Suscripción** | estado actual (free/premium, período, `past_due` con aviso), botón suscribirse (abre el brick) o cancelar. Lazy check al render (decisión 18) |
| `/mi-negocio/[placeId]` — tab **Suscripción** | ídem por lugar (B2B). El editor ya muestra los campos pagos bloqueados en free — el tab es donde se desbloquean |
| `/mi-negocio/[placeId]` — estadísticas | free: teaser actual sin cambios · paid: desglose completo (decisión 24) |
| `/admin` | secciones **Precios** (+ historial) y **Suscripciones** (read-only) (decisión 26) |
| Búsqueda (`/` + `/api/search`) | bloque de hasta 3 destacados arriba de la primera página (decisiones 20-21); `lib/search/query.ts` gana `buscarDestacados` reusando `construirWhere` |
| Ficha (`/lugar/[id]`) | las acciones (teléfono · cómo llegar · website · redes · carta) disparan el beacon de tap. Ningún otro cambio |

**Componentes**: `components/billing/checkout-modal.tsx` (port del `CheckoutModal` de
StressPlan: carga dinámica del SDK v2, Card Payment Brick, máquina de estados, errores en
español vía port de `mp-errors.ts`). El monto que muestra el brick sale del server (DB).

### Reuso desde StressPlan (puerto, no import)

Se **porta y adapta** (nombres/estilo del proyecto, sin el legacy Stripe ni el flujo à la
carte); la lógica probada no se reescribe de cero:

| De StressPlan | A acá | Qué se toma |
|---------------|-------|-------------|
| `lib/billing/mercadopago.ts` | `lib/billing/mercadopago.ts` | cliente fetch, `createPreapproval` (adaptado a sin-plan, dec. 10), `cancelPreapproval`, `getPreapproval`, **`validateWebhookSignature` + manifest tal cual** |
| `lib/billing/subscriptionRenewal.ts` | `lib/billing/renovacion.ts` | renovación idempotente (guard UNIQUE solo-al-aprobar, `FOR UPDATE`) |
| `lib/billing/expiry.ts` | `lib/billing/vencimiento.ts` | lazy check + gracia 3 días + reconciliación `GET /preapproval` |
| `lib/billing/mp-errors.ts` | `lib/billing/mp-errors.ts` | mapeo de errores MP a mensajes (re-traducir al rioplatense) |
| `app/api/webhooks/mercadopago/route.ts` | ídem | estructura del handler **sin** la rama IPN legacy ni merchant_order/payment |
| `components/shared/CheckoutModal.tsx` | `components/billing/checkout-modal.tsx` | SDK loader + brick + estados |
| `next.config.ts` (CSP) | nota de implementación | la lista completa de dominios que el brick necesita (`sdk.mercadopago.com`, `api-static`, `secure-fields.mercadopago.com`, `*.mercadopago.com`, `http2.mlstatic.com`, `mercadolibre.com/.com.ar`) — hoy el proyecto no manda CSP; si se agrega, sin esa lista el modal abre vacío |
| `docs/operations/LECCIONES_APRENDIDAS.md` § MP | § Incógnitas + decisión 31 | sandbox, comprador test, `CC_VAL_433` |

**No se porta**: `alacarte.ts`, `checkoutAccreditation.ts`, `analysis_checkouts`, panel de
sync manual, columnas `stripe_*`, `billing_provider`, plan IDs por env, rama IPN sin firma.

### Fases

| Fase | Alcance | Verificable con |
|------|---------|-----------------|
| **1 — Instrumentación + precios** ✅ | Migración completa (todas las tablas/columnas de § Modelo) · taps con beacon en la ficha · tags por búsqueda en el `after()` · seed de precios · `/admin` Precios con historial | Tocar "cómo llegar" suma en `place_taps_daily`; una búsqueda filtrada suma en `place_tag_impressions_daily`; editar el precio en `/admin` queda en el historial y rige sin deploy — **implementada 2026-07-24** (`drizzle/0008`, `lib/billing/settings.ts`, `lib/search/impressions.ts`, `components/lugar/tap-link.tsx`, `app/api/lugar/[id]/tap`, `app/api/admin/settings`, `app/admin/precios-client.tsx`) |
| **2 — Cobro (MP)** | `lib/billing/*` portado · checkout Bricks · `POST checkout`/`cancel` · webhook firmado · renovación idempotente · lazy check · tabs de suscripción en `/cuenta` y `/mi-negocio/[placeId]` · sync de flags · hooks de revocación/borrado · `/admin` Suscripciones | Sandbox end-to-end: comprador test paga B2C ⇒ `users.plan='premium'` al toque y los gates de VOTACION abren; paga B2B de un lugar ⇒ campos pagos editables en ese lugar y **no** en otro del mismo dueño; cancelar mantiene acceso hasta fin de período |
| **3 — Destaque** | `buscarDestacados` (candidatos + rotación + contador) · bloque en la primera página con badge · dedupe · `featured_impressions` | Dos lugares pagos que matchean la misma búsqueda alternan el orden del bloque entre búsquedas; el orgánico de abajo no cambia; el badge se ve; bajar un plan lo saca al instante |
| **4 — Desglose** | Sección de estadísticas paga en el panel (vistas · impresiones · taps · top filtros · vs mes anterior · destacada X de Y) gateada server-side | Un lugar `paid` ve el desglose con los datos acumulados desde F1; volver a `free` lo devuelve al teaser exacto de AUTH |

## Edge cases

- **Webhook llega antes que la respuesta del POST de checkout** (race real): ambos caminos
  upsertean con `FOR UPDATE` + GET defensivo ⇒ el segundo en llegar no pisa nada distinto.
- **MP nunca notifica una renovación** (BUG-020): el lazy check reconcilia al abrir el tab o
  el punto de gate; con gracia vencida y MP diciendo `cancelled`, baja el flag ahí mismo.
- **Preapproval vuelve `pending` en el checkout** (pago no aprobado en el acto): no se activa
  nada; el brick muestra el error mapeado. Si MP lo autoriza después, el webhook de
  `subscription_preapproval` lo activa por el camino normal.
- **Doble click / ya suscripto**: el índice único parcial rechaza la segunda fila viva; el
  endpoint responde 4xx claro ("ya tenés una suscripción activa").
- **El precio cambia entre render y submit**: decisión 27 — 4xx, "el precio cambió".
- **`past_due` y el destaque**: el flag sigue `paid` durante los reintentos (decisión 14) ⇒
  sigue destacando. Correcto: todavía no cayó.
- **Bajó el plan B2B con la ficha llena**: contenido pago oculto, no borrado (regla vigente);
  las fotos 4-15 dejan de mostrarse; re-suscribir lo trae todo de vuelta (decisión 19).
- **Revocación del reclamo con sub activa**: decisión 28 — cancelar preapproval best-effort,
  flag abajo ya. Si MP no responde, la reconciliación lazy cierra el ciclo.
- **Menos de 3 pagos matchean la búsqueda**: se muestran los que haya (0, 1 o 2) — el bloque
  no se rellena con no-pagos jamás.
- **Un destacado también está en los 20 orgánicos de la página**: dedupe (decisión 21); en
  páginas siguientes puede reaparecer en su posición orgánica — aceptado, raro e inocuo.
- **Tap repetido / bot**: agregado + rate limit 60/h/IP; el inflado fino no se persigue en v1
  (el dato es para el dueño, no facturable por tap).
- **Usuario elimina la cuenta con subs activas**: `beforeDelete` cancela preapprovals
  (best-effort) antes del cascade; las filas de `subscriptions` caen con el usuario, los
  agregados de stats (sin user_id) quedan.

## Criterios de done (DoD)

- [x] Migración aditiva verde: `subscriptions`, `subscription_payments`, `place_taps_daily`,
      `place_tag_impressions_daily`, `featured_impressions`, `app_settings_history`, seed de
      precios idempotente — **F1** (`drizzle/0008_short_talisman.sql`)
- [x] Instrumentación: tocar teléfono / cómo llegar / redes / website / carta en la ficha suma
      en `place_taps_daily`; una búsqueda con tags activos suma en `place_tag_impressions_daily`
      para los lugares servidos; **ninguna de las dos guarda user_id, cookie ni IP** (test) — **F1**
- [x] Precio editable desde `/admin` sin deploy; el cambio queda en `app_settings_history` con
      quién y cuándo; el checkout siguiente usa el precio nuevo y las suscripciones existentes
      conservan su `amount_ars` — **F1** (`amount_ars` congelado se prueba en F2, cuando haya subs)
- [ ] Checkout B2C en sandbox end-to-end: comprador test paga con el brick ⇒ 201 con
      `users.plan='premium'` inmediato ⇒ crear 2ª votación activa funciona y el historial
      aparece (gates de VOTACION abren sin tocar sus helpers)
- [ ] Checkout B2B por lugar: paga el lugar A ⇒ `owner_plan='paid'` en A (campos pagos
      editables, 15 fotos) y el lugar B del mismo dueño sigue `free`
- [ ] Webhook: request sin firma o con firma inválida ⇒ 401 y no toca la DB; replay del mismo
      `authorized_payment_id` aprobado no duplica el pago ni extiende el período dos veces
      (test con el guard UNIQUE)
- [ ] Renovación rechazada ⇒ `past_due` y el acceso se conserva; `paused`/`cancelled` del
      preapproval ⇒ flag a `free`; el contenido pago se oculta sin borrarse
- [ ] Cancelación diferida: cancelar deja acceso hasta `current_period_end`; pasado el fin +
      gracia, el lazy check baja el flag **sin que haya llegado ningún webhook** (test
      adelantando fechas)
- [ ] Destaque: con ≥4 lugares `paid` que matchean, el bloque muestra exactamente 3 con badge
      "Destacado", arriba, solo en la primera página; la rotación alterna entre búsquedas
      (menor `featured_impressions` primero, test); un lugar `paid` que NO matchea los filtros
      no aparece; el orden orgánico y "Ver N" no cambian; los pins del mapa tampoco
- [ ] Desglose: con `owner_plan='paid'` el panel muestra vistas · impresiones · taps por tipo ·
      top filtros · vs mes anterior · "destacada en X de Y"; con `free` responde exactamente el
      teaser de AUTH (gate en la query, test)
- [ ] `MP_ACCESS_TOKEN` y `MP_WEBHOOK_SECRET` solo se leen en `lib/billing/mercadopago.ts` y
      no llegan al bundle del browser (mismo test-criterio que Google/R2); `.env.example`
      actualizado
- [ ] Rate limit activo en checkout (5/h/IP) y tap (60/h/IP); el webhook responde 401 sin
      firma sin consumir cupo de nada
- [ ] `typecheck` + tests + `build` verdes (build con el dev server parado)

## QA manual (IDs propuestos)

| ID | Caso | Criterio |
|----|------|----------|
| MONE-01 | Checkout B2C feliz | Comprador test paga premium con el brick sin salir del sitio → `/cuenta` muestra premium con período; crear 2ª votación activa e historial funcionan al instante |
| MONE-02 | Checkout B2B feliz | Dueño paga la suscripción del lugar A → campos pagos y 15 fotos editables en A; lugar B del mismo dueño sigue free |
| MONE-03 | Por lugar, no por cuenta | El mismo dueño con A pago y B free: la ficha de A muestra descripción/carta/novedad; la de B no |
| MONE-04 | Pago rechazado en alta | Tarjeta de rechazo del sandbox → error claro en español en el brick, no se crea suscripción, el plan sigue free |
| MONE-05 | Renovación fallida | Simular `subscription_authorized_payment` rejected → `past_due`, acceso intacto; luego `cancelled` → flag free y contenido pago oculto |
| MONE-06 | Idempotencia webhook | Reenviar el mismo webhook aprobado (replay) → 200, sin pago duplicado ni período doble |
| MONE-07 | Firma inválida | POST al webhook sin `x-signature` o con firma corrupta → 401, DB intacta |
| MONE-08 | Cancelación diferida | Cancelar premium → sigue premium hasta fin de período (aviso visible); tras vencer + gracia, free sin webhook (lazy) |
| MONE-09 | Destaque básico | Búsqueda que matchean 4+ lugares pagos → exactamente 3 arriba con badge, orgánico intacto debajo, no en el mapa |
| MONE-10 | Solo si matchea | Un lugar pago que no cumple los filtros activos no aparece destacado en esa búsqueda |
| MONE-11 | Rotación | Repetir la misma búsqueda varias veces → los destacados alternan (menor-mostrado-primero); `featured_impressions` crece coherente |
| MONE-12 | Destaque cae con el plan | `owner_plan` vuelve a free (cancelación efectiva) → desaparece del bloque en la búsqueda siguiente |
| MONE-13 | Taps | Tocar teléfono / cómo llegar / redes en la ficha → `place_taps_daily` suma por tipo; sin user_id/IP/cookie |
| MONE-14 | Qué filtros te encontraron | Buscar con "bar" + un chip → los lugares servidos suman en los tags activos; el texto libre no se registra |
| MONE-15 | Desglose gated | Panel de un lugar paid muestra el desglose completo (incl. vs mes anterior y "destacada X de Y"); volver a free devuelve el teaser pelado |
| MONE-16 | Precio en DB | Cambiar `billing.precio_b2c_ars` en `/admin` → el brick siguiente muestra el nuevo monto sin deploy; el historial registra el cambio; un premium existente conserva su `amount_ars` |
| MONE-17 | Precio cambió mid-checkout | Editar el precio con un brick abierto → el submit responde "el precio cambió", no cobra el monto viejo |
| MONE-18 | Revocación con sub | Admin revoca el reclamo de un lugar pago → preapproval cancelado (o reconciliado después), `owner_plan` free ya |

## Relación con otros specs

- **AUTH (spec 5)**: automatiza el `owner_plan` que dejó gateado a mano; el desglose crece
  sobre su teaser; los tabs viven en sus pantallas (`/cuenta`, `/mi-negocio/[placeId]`);
  extiende su hook `beforeDelete` y la revocación (decisión 28). El gating de fotos/campos
  **no se toca**.
- **VOTACION (spec 6)**: enciende el premium que dejó modelado (`users.plan`, `esPremium`);
  los gates (1 activa · historial · botón IA) abren solos al mover el flag. La tabla
  `user_subscriptions` alternativa de su decisión 17 queda superada por `subscriptions` con
  `place_id` nullable.
- **BUSQUEDA (spec 3)**: el destaque se inserta arriba del orden orgánico previsto (dec. 16
  de allá), reusando `construirWhere` (el "solo si matchea" es la misma query). Suma la
  columna `featured_impressions` a su tabla de impresiones y el registro de tags por búsqueda
  a su `after()`.
- **FICHA (spec 4)**: las acciones ganan el beacon de taps. Cero cambios en el flujo Google.
- **Spec 8 (Chat IA)**: se financia con esto (gate de negocio declarado). El cupo de mensajes
  y el modelo `cupo_del_plan` vs `otorgados_este_mes` (IDEAS) son de allá; acá solo queda
  `users.plan` moviéndose solo.
- **StressPlan**: fuente del port (§ Reuso). Su spec `MP_INFLATION_PRICING` (subir el monto a
  preapprovals vivos) sigue sin resolver allá — acá quedó explícitamente fuera (v2).
