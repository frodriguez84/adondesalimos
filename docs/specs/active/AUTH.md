# Spec: Auth + roles + reclamo de negocio

**Estado:** 🟢 Parcial — F1 ✅ Auth base (2026-07-20) · F2 ✅ Reclamo + alta + cola (2026-07-21) · F3 ✅ Panel + contenido (2026-07-21); F4 pendiente
**Prioridad:** Alta — habilita al dueño, que es la pata B2B del modelo. Sin este spec no hay spec 6 (Votación necesita usuarios) ni spec 7 (Monetización necesita dueños)
**Gate:** Ninguno
**Bloquea:** spec 6 (Votación en grupo) · spec 7 (Monetización)
**Depende de:** CATALOGO (`publish_override`, `source='owner'`, helper de visibilidad) · ZONAS (asignación por geometría) · FICHA (`place_photos`, huecos de dueño, `detail_views`) · patrón better-auth/Resend/rate-limit de StressPlan

---

## Problema

- El catálogo es 100% Overture: nadie corrige un teléfono errado, no hay fotos propias (la
  ficha muestra **una** de Google, pagada por request) y los lugares reales que quedaron
  bajo el umbral de confidence son invisibles sin remedio.
- FICHA dejó a propósito el botón "¿Sos el dueño?" **afuera** — sin flujo detrás era una
  promesa vacía. Los enganches están (`place_photos` vacía, huecos en el layout,
  `detail_views` acumulando) pero nada los usa.
- Cada ficha reclamada mejora el catálogo **gratis** (razón de negocio ya validada del free
  generoso). Hoy no existe la puerta por la que ese dueño pueda entrar.

## Objetivo

1. **Auth con better-auth** (patrón StressPlan): registro único, email verificado
   obligatorio, consumidor por default. El que solo busca sigue navegando anónimo.
2. **Reclamo / alta de negocio**: dos entradas, un flujo — "¿Es tu negocio? Reclamalo"
   (lugar existente) y "Registrá tu negocio" (lugar nuevo) → cola de aprobación manual en
   `/admin` → aprobado ⇒ `publish_override = true` (sobrescribe el umbral de confidence) +
   el usuario gana el rol dueño **para ese lugar**.
3. **Panel "Mi negocio"**: editar contacto, tags, fotos (a R2) y horarios propios (free);
   descripción / carta / novedad modelados y gateados por plan (el cobro es del spec 7).
4. **La ficha consume lo del dueño**: fotos (prioridad ya implementada), contenido en los
   huecos previstos, horarios propios antes que Google, botón "¿Sos el dueño?" activo.
5. **`/admin` nace** — mínimo: la cola de aprobación. Nada más.
6. **Teaser de estadísticas**: "tu ficha tuvo N visitas este mes" desde `detail_views`.

## Qué NO es esta feature

- **Cobro, suscripción, destaque, desglose de estadísticas** (spec 7). Acá el plan del
  lugar es un flag manual (`owner_plan`) y la estadística es solo el teaser.
- **Votación / grupos** (spec 6). Este spec solo deja usuarios autenticados.
- **Carga de lugares por consumidores** — fuera de v1 (decidido en IDEAS § Fuentes).
- **Verificación automatizada de dueños** — v2; en v1 la verificación ES la aprobación
  manual (❓ abierto en IDEAS, no bloquea).
- **`/admin` completo** (umbral, precios, cupos, stats de la app): sigue en BACKLOG. Acá
  nace la ruta con la cola de aprobación y nada más.
- **Sugerencia de tags nuevos por el dueño** (cocinas de nicho, opción C de IDEAS): v2 —
  el dueño de v1 tilda de la taxonomía existente. → BACKLOG.
- **Editar nombre, dirección o ubicación de un lugar reclamado**: correcciones vía admin.
  Motivo: son la identidad del lugar publicado (vandalismo/abuso post-aprobación) y mover
  el pin obliga a re-asignar zonas. El alta nueva sí los carga, una vez.
- **Filtro "Abierto ahora" en búsqueda**: sigue en BACKLOG. Este spec solo empieza a
  acumular la masa de horarios propios que lo destraba.
- **"Mi cuenta" con pagos**: la pantalla nace mínima (datos, contraseña, eliminar cuenta);
  el tab de suscripción es del spec 7.

## Decisiones cerradas

Las 1-7 vienen de IDEAS.md y de los specs 1-4 (no se reabren); las 8-25 son diseño de
**este** spec.

| # | Decisión |
|---|----------|
| 1 | **Tres roles conceptuales**: consumidor · dueño · admin. **Registro único sin elección de rol** — todos nacen consumidores; el rol dueño **se gana** con la acción de reclamar/registrar un negocio y conserva el rol consumidor (IDEAS § Usuarios y roles) |
| 2 | **El que solo busca navega anónimo.** Login únicamente para reclamar/cargar (y a futuro votar/premium). La home/búsqueda no cambia su funcionamiento |
| 3 | **Reclamo aprobado ⇒ `publish_override = true`**: la ficha queda publicada aunque su confidence no pase el umbral — la aprobación manual es mejor señal que el score (IDEAS, ya testeado a nivel query en CAT-06) |
| 4 | **Aprobación manual del admin en `/admin`** para ambas entradas del flujo dueño (v1; automatizar es v2) |
| 5 | **Free del dueño generoso a propósito** (IDEAS § planes): editar datos + tags de las 7 facetas + hasta **3 fotos** + horarios propios. Pago (ARS 15.000/mes, spec 7): hasta **15 fotos** + descripción larga + link a carta + novedad. Este spec construye todo y gatea por plan |
| 6 | **Auth = better-auth replicando StressPlan** (`lib/auth/index.ts` de allá): drizzleAdapter, `emailAndPassword`, mails por **Resend**, Google OAuth **condicional por env** (sin las vars, el botón no aparece). Versión ^1.6.x |
| 7 | **Email verificado obligatorio** (anti-abuso decidido en IDEAS). **Divergencia explícita con StressPlan**: allá `requireEmailVerification` quedó en `false` (BUG-E2E-003, decisión pendiente); acá va **`true`** — sin verificar no hay login. Se replican también sus cicatrices: mapeo de errores a español, bloqueo de emails desechables, no loguear URLs con token (AUD-03) |
| 8 | **Sin sistema de roles en DB**: admin = comparación con `ADMIN_EMAIL` (patrón StressPlan, un solo admin real); dueño = **derivado** de tener reclamo aprobado sobre un lugar. Sin columna `role` no hay elección de rol posible — el registro único queda garantizado por construcción |
| 9 | **Sin `middleware.ts` global**: la sesión se verifica **en cada route handler** (`auth.api.getSession`, regla de seguridad global) y las páginas protegidas (`/mi-negocio`, `/admin`, `/cuenta`) redirigen a login desde el server component |
| 10 | **Tabla `place_claims`** — el reclamo y la propiedad son la misma fila: quién, qué lugar, tipo (`claim`·`new`), estado (`pending`·`approved`·`rejected`), datos del solicitante para verificar, y la decisión del admin. **Única aprobada por lugar** (índice único parcial). La revocación existe: admin vuelve una aprobada a `rejected` y `publish_override` a `false` |
| 11 | **"Registrá tu negocio" arranca BUSCANDO en el catálogo completo** — visible **e invisible** — por nombre+zona. Si el lugar existe, la entrada se convierte en reclamo (evita duplicados **y** resuelve el caso del lugar real bajo umbral, cuya ficha pública no existe y por lo tanto no tiene botón "¿Sos el dueño?"). Si no existe, sigue al alta nueva |
| 12 | **Alta nueva** = crear `places` con `source='owner'`, invisible (`publish_override=false`, confidence null — CATALOGO dec. 13: solo publica con override) + claim `new` pendiente. El rechazo deja el lugar invisible, no lo borra. **lat/lng por pin en mapa MapLibre** (sin geocoder pago) y **zona asignada al guardar** con la geometría existente de ZONAS (turf) |
| 13 | **Lo que edita el dueño NUNCA va a las columnas base de `places`**: el re-import de Overture las pisa (CATALOGO dec. 17 solo preserva `google_place_id`, `publish_override` y tags no-import). Va a la tabla 1-a-1 **`place_owner_content`** y la ficha resuelve `COALESCE(dueño → base)`. Regla uniforme para ambos `source` (en `'owner'` las base se llenan una vez, al alta) |
| 14 | **El re-import no toca las tags de un lugar con reclamo aprobado.** Sin esto, un tag de import que el dueño borró reaparece en el siguiente import. El dueño aprobado es mejor fuente que Overture para SU lugar |
| 15 | **Tags del dueño** = `place_tags` con `source='owner'` (la columna ya existe, CATALOGO dec. 14), tildando de la taxonomía de las 7 facetas. Cambios post-aprobación aplican al instante, sin cola: el riesgo "se auto-tilda todas las vibras" queda aceptado como en IDEAS, con la revocación como remedio (si hace falta moderación fina, v2) |
| 16 | **Fotos en Cloudflare R2** (decidido 2026-07-20; Cloudflare ya está en el stack, S3-compatible, egress gratis). **Un solo módulo server-only habla con R2** (`lib/storage/r2.ts` — mismo criterio que `lib/google/places.ts`); credenciales solo por env. Validación en el endpoint: jpeg/png/webp, ≤ 5 MB. `place_photos` queda como la dejó FICHA (`url` = URL pública de R2) |
| 17 | **Los caps de fotos se aplican desde el día 1** (3 free / 15 pago) y los campos pagos nacen **bloqueados** en free. Principio de Fer ya decidido: *"subir un cupo es un regalo; bajarlo es una traición"* — regalar todo hasta el spec 7 y después recortar es la traición exacta |
| 18 | **`places.owner_plan`** enum `'free'`·`'paid'` not null default `'free'`, **por lugar** (el destaque y las stats del spec 7 son por ficha). Hasta el spec 7 se cambia a mano (UPDATE documentado — mismo criterio que el umbral pre-`/admin`). El contenido pago **se muestra solo mientras `owner_plan='paid'`**: si deja de pagar se oculta, no se borra |
| 19 | **Huecos en la ficha** (colapso limpio si no hay dato, patrón FICHA): **descripción** debajo de "Qué vas a encontrar" · **carta/menú** como acción junto al website · **novedad** como banner corto bajo el header (ej. "happy hour 18-20"). Solo con `owner_plan='paid'` |
| 20 | **Horarios propios** (free; decidido 2026-07-20 que entran acá, última fase): `opening_hours` jsonb en `place_owner_content` — por día, lista de rangos `hh:mm` que pueden cruzar medianoche (`20:00–02:00`, es una app de salidas). La ficha **prioriza dueño → Google** (mismo patrón que fotos) y calcula abierto/cerrado con TZ `America/Argentina/Buenos_Aires`. Bonus de costo: horario propio ⇒ el bloque de Google pierde su campo principal para ese lugar |
| 21 | **Botón "¿Sos el dueño?"**: discreto, al pie de la ficha (zona de atribución), **solo si el lugar no tiene reclamo aprobado**. Sin sesión ⇒ login y vuelta al flujo |
| 22 | **`/admin` nace con SOLO la cola**: claims pendientes con datos del solicitante + lugar + decisión aprobar/rechazar (con motivo). Aprobar ⇒ `publish_override=true` + mail; rechazar ⇒ mail con motivo. Idempotente ante doble click. El resto del admin sigue en BACKLOG |
| 23 | **Rate limit con el helper propio ya existente** (`lib/middleware/`, memoria de proceso — NO se importa el de StressPlan con advisory locks: acá no hay cupos pagos que serializar): POST de claims/alta **3/día por IP**, upload de fotos **30/h por IP**, POST del catch-all de auth **20/h por IP** |
| 24 | **Teaser de estadísticas** en el panel: `SUM(detail_views)` del mes calendario corriente desde `place_impressions_daily`. **Solo el número** — el desglose y la comparación contra el mes anterior son el motor de conversión del plan pago (IDEAS) y llegan con el spec 7 |
| 25 | **Mails transaccionales** (Resend, patrón StressPlan): verificación de email · reset de password · reclamo aprobado · reclamo rechazado. Nada más en v1 |

### Modelo de datos (migración sobre CATALOGO + FICHA)

**Tablas de better-auth** (las genera el adapter, nombres estándar): `users` · `session` ·
`account` · `verification`. Sin columna `role` (decisión 8).

**`place_claims`**

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | uuid pk | |
| `place_id` | fk → `places` on delete cascade, not null | el alta crea el lugar primero |
| `user_id` | fk → `users` on delete cascade, not null | |
| `kind` | pgEnum `'claim'` · `'new'` | por cuál entrada llegó |
| `status` | pgEnum `'pending'` · `'approved'` · `'rejected'` not null default `'pending'` | |
| `applicant_name` · `applicant_phone` · `applicant_role` · `comment` | text | lo que el admin usa para verificar (vínculo con el negocio, etc.) |
| `decided_at` | timestamp nullable | |
| `decided_by` | text nullable | email del admin |
| `admin_notes` | text nullable | motivo de rechazo / notas |
| `created_at` | timestamp not null | |

Índice único parcial: `(place_id) WHERE status = 'approved'` — un dueño por lugar.
Índice por `user_id` (el panel lista "mis lugares").

**`place_owner_content`** — 1-a-1 con `places` (`place_id` pk/fk). Todo nullable: cada campo
sobrescribe la base solo si está cargado.

| Campo | Tipo | Plan |
|-------|------|------|
| `phone` · `website` | text | free |
| `socials` | jsonb (`string[]`) | free |
| `opening_hours` | jsonb (semanal, rangos que cruzan medianoche) | free |
| `description` | text | pago |
| `menu_url` | text | pago |
| `news` | text (corto, una línea) | pago |
| `updated_at` | timestamp | |

**`places`** — columna nueva: `owner_plan` pgEnum `'free'`·`'paid'` not null default `'free'`.

**`place_photos`** — sin cambios de schema (la creó FICHA); este spec la llena.

**Env nuevas** (`.env.example`): `BETTER_AUTH_SECRET` · `BETTER_AUTH_URL` · `ADMIN_EMAIL` ·
`RESEND_API_KEY` · `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (opcionales) ·
`R2_ACCOUNT_ID` · `R2_ACCESS_KEY_ID` · `R2_SECRET_ACCESS_KEY` · `R2_BUCKET` ·
`R2_PUBLIC_URL`. Todas server-only.

### Rutas

| Ruta | Qué |
|------|-----|
| `app/(auth)/login` · `registro` · `recuperar` · `restablecer` | pantallas de auth (tokens del tema, mobile-first) |
| `app/cuenta` | mínima: nombre, email, cambio de contraseña, eliminar cuenta |
| `app/registrar-negocio` | entrada única del flujo dueño: busca en catálogo completo → reclamo o alta (decisión 11) |
| `app/reclamar/[placeId]` | formulario de reclamo (llega desde la ficha o desde la búsqueda del flujo) |
| `app/mi-negocio` | lista de mis lugares (claims aprobados) |
| `app/mi-negocio/[placeId]` | editor: datos · tags · fotos · horarios · campos pagos · teaser |
| `app/admin` | cola de aprobación (gate `ADMIN_EMAIL`) |
| `app/api/auth/[...all]` | catch-all better-auth (+ bloqueo de emails desechables) |
| `app/api/claims` | POST crear reclamo/alta (rate limit) |
| `app/api/admin/claims/[id]` | PATCH aprobar/rechazar (gate admin) |
| `app/api/mi-negocio/[placeId]/content` | PATCH `place_owner_content` (valida ownership + plan por campo) |
| `app/api/mi-negocio/[placeId]/photos` | POST upload a R2 (valida tipo/tamaño/cap) · DELETE |
| La home | gana solo una **entrada de cuenta en el header** (menú: Mi negocio · Mi cuenta · salir); ningún otro cambio |

**Ficha** (cambios sobre lo implementado): botón "¿Sos el dueño?" (decisión 21) · huecos
pagos (decisión 19) · `COALESCE` de contacto/redes con `place_owner_content` · horarios
dueño → Google (decisión 20). La prioridad de fotos dueño → Google **ya funciona** (FICHA
F1/F3) — no se toca.

### Fases

| Fase | Alcance | Verificable con |
|------|---------|-----------------|
| **1 — Auth base** ✅ | better-auth + tablas + pantallas login/registro/recuperar/restablecer + verificación obligatoria + `/cuenta` mínima + entrada en el header + rate limit de auth | Registro end-to-end con mail real (Resend), sin roles todavía |
| **2 — Reclamo + alta + cola** ✅ | `place_claims`, botón en la ficha, `registrar-negocio` (búsqueda en catálogo completo + alta con pin + zona automática), `/admin` con la cola, aprobar/rechazar + `publish_override` + mails | Un lugar con confidence bajo el umbral aparece publicado tras aprobar |
| **3 — Panel + contenido** ✅ | `place_owner_content`, editor de datos/tags, fotos a R2 con caps, `owner_plan` + gating, huecos en la ficha, teaser de stats | Ficha mostrando contenido de dueño; 4ª foto free rechazada |
| **4 — Horarios propios** | Editor semanal (rangos que cruzan medianoche), prioridad dueño → Google en la ficha, abierto/cerrado con TZ AR | Ficha con horarios propios y estado correcto un día de semana vs trasnoche |

### Notas de implementación — F2 (2026-07-21)

Lo que el spec no fijaba y quedó decidido al implementar:

- **La revocación es rechazar un aprobado**, no una acción aparte: `PATCH` con
  `{accion:'reject', motivo}` sobre un claim `approved` lo pasa a `rejected` y baja
  `publish_override`. Un solo camino de código para el rechazo y para AUTH-13.
- **`/admin` responde 404 a los no-admin**, no 403: la ruta no existe para quien no es el
  admin. Los endpoints sí devuelven 403 (el cliente necesita distinguir).
- **La búsqueda de `/registrar-negocio` es server-side por `?q=`**, sin endpoint nuevo: el
  resultado es una lista, no algo interactivo. La tabla de Rutas no lista un endpoint y no
  hizo falta.
- **`/mi-negocio` no entra en F2** (es F3, "Panel + contenido"). La puerta al alta de un
  lugar nuevo es la entrada **"Registrá tu negocio"** del menú de cuenta — sin ella el flujo
  solo sería alcanzable escribiendo la URL.
- **El edge case "eliminar cuenta de un dueño"** se cierra con el hook `beforeDelete` de
  better-auth, que baja `publish_override` de los lugares con claim aprobado del usuario
  antes de que el cascade borre la fila. El resto del edge case (contenido de dueño, fotos
  de R2) es F3.
- **El alta carga teléfono y sitio en las columnas base** de `places` (decisión 13: en
  `source='owner'` las base se llenan una vez, al alta).

### Notas de implementación — F3 (2026-07-21)

Lo que el spec no fijaba y quedó decidido al implementar:

- **El contenido del dueño se aplica solo mientras el lugar tenga reclamo aprobado.** El
  COALESCE de `getPlaceDetail` está condicionado a `reclamado`. Es lo que hace que revocar
  (AUTH-13) y eliminar la cuenta devuelvan la ficha a Overture: sin esto, el teléfono de un
  ex-dueño quedaba publicado para siempre. **La fila no se borra** — se deja de aplicar,
  mismo criterio que el contenido pago cuando se cae el plan.
- **Las fotos NO se ocultan al revocar** (decisión consciente, ver QA § AUTH F3 H-2):
  gatearlas obligaría a tocar la prioridad dueño → Google de FICHA, que está fuera de
  alcance. Revocar devuelve los datos a Overture pero deja las fotos. → BACKLOG.
- **Tags y contenido viajan en el mismo `PATCH`**: el editor es un formulario, no dos. La
  tabla de Rutas no lista un endpoint de tags y no hizo falta.
- **Guardar tags reemplaza el set completo del lugar con `source='owner'`**, incluidas las
  que venían de `import`: para SU lugar el dueño aprobado es mejor fuente que Overture
  (decisión 14) y el re-import ya no las toca.
- **El cap de fotos se chequea dos veces**: una barata antes de subir (para no gastar un PUT
  que va a rebotar) y otra dentro de la transacción con la fila del lugar tomada `FOR
  UPDATE`. Sin ese lock, dos uploads simultáneos con 2 fotos cargadas dejaban 4 en un plan
  de 3.
- **`opening_hours` se creó con la tabla pero nadie la lee ni la escribe**: crear la tabla
  entera de una vez es más barato que un `ALTER` después. La usa F4.
- **`PATCH .../content` no lleva rate limit propio**: exige sesión y solo puede tocar un
  lugar que ya es del usuario. El cupo de la decisión 23 cubre lo abierto (auth, claims,
  fotos).
- **"Mi negocio" se muestra a todo el que tenga sesión**, no solo a dueños: preguntar por
  claims aprobados sería una query en el header de cada página, y la pantalla vacía ya
  resuelve el caso mandando al alta.
- **El cliente de R2 es `@aws-sdk/client-s3`** (R2 es S3-compatible), instanciado perezoso y
  memoizado: sin fotos en juego la app nunca lo crea.

## Edge cases

- **Dos reclamos sobre el mismo lugar**: el índice único parcial solo limita aprobados; el
  segundo queda `pending` y el admin lo resuelve viendo ambos.
- **Reclamo sobre lugar invisible (bajo umbral)**: es EL caso de negocio (rescata lugares
  reales) — entra por `registrar-negocio` porque su ficha pública no existe (decisión 11).
- **Eliminar cuenta de un dueño**: sus claims caen (cascade) ⇒ el lugar pierde la
  condición de reclamado: `publish_override` vuelve a `false`, el contenido de dueño deja
  de mostrarse y las fotos se borran de R2 (best effort). Un lugar `source='overture'` con
  buen confidence sigue publicado por la regla normal; uno `source='owner'` queda invisible.
- **Upload que falla a mitad**: la fila de `place_photos` se inserta **después** del PUT a
  R2 exitoso — nunca una URL huérfana en DB. Un objeto huérfano en R2 es aceptable.
- **Horario que cruza medianoche**: `20:00–02:00` pertenece al día en que abre; el cálculo
  de "abierto ahora" a la 01:30 debe mirar también el día anterior.
- **Aprobación concurrente / doble click**: PATCH idempotente — aprobar algo ya aprobado
  no duplica ni re-manda el mail.
- **`ADMIN_EMAIL` sin setear**: `/admin` y sus endpoints devuelven 404/403 para todos —
  nunca un admin abierto por default.

## Criterios de done (DoD)

- [ ] Registro con email+password crea usuario; el mail de verificación llega (Resend) y
      **sin verificar no hay login** (`requireEmailVerification: true`)
- [ ] Google OAuth funciona con las env vars presentes; sin ellas el botón no se renderiza
- [ ] Todo route handler nuevo (`claims`, `mi-negocio`, `admin`) verifica sesión inline con
      `getSession`; `/admin` + sus endpoints rechazan a cualquier no-admin (`ADMIN_EMAIL`)
- [ ] Reclamo end-to-end: usuario verificado reclama desde la ficha → aparece en la cola →
      aprobar pone `publish_override=true` y manda mail → un lugar con confidence 0.3 pasa
      a verse en búsqueda y ficha → el botón "¿Sos el dueño?" desaparece de esa ficha
- [ ] "Registrá tu negocio" busca en el catálogo **completo** (visibles e invisibles) antes
      de ofrecer el alta; el alta crea `source='owner'` invisible con zona asignada por la
      geometría de ZONAS; rechazar lo deja invisible
- [x] Fotos: upload a R2 solo jpeg/png/webp ≤ 5 MB; la 4ª foto con `owner_plan='free'`
      responde 4xx; la ficha muestra las del dueño y **no** pide la foto de Google
      (comportamiento ya implementado en FICHA, verificado de punta a punta con fotos reales)
      — F3, QA AUTH-07/AUTH-21/AUTH-22
- [x] Campos pagos: con `free` el editor los muestra bloqueados y el PATCH los rechaza
      server-side; con `paid` se editan y la ficha los muestra en los huecos; volver a
      `free` los oculta sin borrarlos — F3, QA AUTH-08
- [x] Re-correr el import de Overture no pisa **nada** editado por el dueño (contenido en
      `place_owner_content` intacto, tags de lugares reclamados sin tocar — test) — F3
- [x] Teaser del panel = `SUM(detail_views)` del mes corriente, solo el número — F3, QA AUTH-10
- [ ] Horarios propios: la ficha los prioriza sobre Google y el estado abierto/cerrado es
      correcto en TZ AR, incluido un rango que cruza medianoche
- [x] Rate limit activo en POST claims (3/día/IP), upload (30/h/IP) y auth (20/h/IP) — el de
      upload entró con F3
- [x] Ningún secreto nuevo llega al bundle del browser (R2, Resend, `ADMIN_EMAIL`,
      `BETTER_AUTH_SECRET`); `.env.example` actualizado con nombre y propósito — F3 sumó las
      5 de R2
- [ ] `typecheck` + tests + `build` verdes (build con el dev server parado)

## QA manual (IDs propuestos)

| ID | Caso | Criterio |
|----|------|----------|
| AUTH-01 | Registro + verificación | Registro → mail → link → login OK. Login **antes** de verificar: rechazado con mensaje claro en español |
| AUTH-02 | Reclamo feliz | Reclamar un lugar publicado → cola → aprobar → mail recibido, botón "¿Sos el dueño?" desaparece, el lugar aparece en `/mi-negocio` |
| AUTH-03 | Override del umbral | Lugar con confidence 0.3 invisible → reclamo aprobado → aparece en búsqueda y ficha (y CAT-06 sigue verde) |
| AUTH-04 | Alta nueva | "Registrá tu negocio" con un nombre inexistente → form con pin → lugar invisible → aprobar → publicado con la zona correcta en la card |
| AUTH-05 | Duplicado evitado | "Registrá tu negocio" con el nombre de un lugar existente **invisible** → lo ofrece para reclamar, no crea otro |
| AUTH-06 | Rechazo | Claim rechazado con motivo → mail con el motivo → el lugar sigue exactamente como estaba |
| AUTH-07 | Cap de fotos free | Subir 3 fotos OK; la 4ª rechazada; la ficha muestra las 3 y el contador de fotos de Google no se mueve |
| AUTH-08 | Gating por plan | `free`: descripción/carta/novedad bloqueadas (UI y PATCH). `UPDATE owner_plan='paid'` → editables y visibles en la ficha. Volver a `free` → se ocultan, no se borran |
| AUTH-09 | Import no pisa | Editar teléfono y borrar un tag como dueño → re-correr import → ambos cambios sobreviven |
| AUTH-10 | Teaser | Abrir la ficha N veces → el panel muestra el acumulado del mes; el 1° del mes siguiente arranca de cero |
| AUTH-11 | Horarios propios | Cargar horarios (uno cruzando medianoche) → la ficha los muestra en lugar de los de Google y el estado abierto/cerrado es correcto |
| AUTH-12 | Permisos | Usuario sin claim no accede al editor de un lugar ajeno (403/404); no-admin no ve `/admin` ni puede aprobar por API |
| AUTH-13 | Revocación | Admin revoca un reclamo aprobado → `publish_override=false`, contenido de dueño oculto; lugar `source='owner'` vuelve a invisible |

## Relación con otros specs

- **CATALOGO**: opera `publish_override` (la columna esperaba esto desde el día 1) y crea
  lugares `source='owner'`. La regla de visibilidad **no se toca** — este spec solo mueve
  sus entradas. Suma la excepción del import para lugares reclamados (decisión 14).
- **ZONAS**: el alta nueva reusa la asignación por geometría (turf) al guardar el pin.
- **FICHA**: llena `place_photos` (la prioridad dueño → Google ya está implementada),
  activa el botón "¿Sos el dueño?", ocupa los huecos previstos y antepone los horarios
  propios al bloque de Google.
- **Spec 6 (Votación)**: consume los usuarios autenticados que este spec crea.
- **Spec 7 (Monetización)**: automatiza `owner_plan` con MercadoPago, agrega destaque y el
  desglose de estadísticas sobre el teaser, y suma el tab de suscripción en `/cuenta` y en
  el panel. Los límites free/pago ya quedan enforced desde acá (decisión 17).
