# Spec: Ficha del lugar (`/lugar/[id]`) + Google en vivo

**Estado:** 🔵 Planned — diseño completo, listo para implementar
**Prioridad:** Alta — es el destino de toda búsqueda: sin ficha, la app encuentra lugares y no te deja decidir
**Gate:** Ninguno de negocio. Requisito operativo: cuenta de Google Cloud con Places API (New) habilitada y `GOOGLE_PLACES_API_KEY` (las fases 1 y 3-parcial se pueden verificar sin ella)
**Bloquea:** Auth/reclamo de negocio (spec 5) monta sus fotos y su descripción sobre esta pantalla
**Depende de:** [CATALOGO](CATALOGO.md) (schema, `google_place_id`, helper de visibilidad) · [ZONAS](ZONAS.md) (`place_zones` para la zona primaria) · [BUSQUEDA](BUSQUEDA.md) (navega hacia acá) · `docs/product/IDEAS.md` § Reviews y ficha de lugar, § Arquitectura de datos, § ToS de Google · `docs/product/investigacion-google-places-2026-07-19.md`

---

## Problema

La búsqueda encuentra lugares, pero tocar una card no lleva a ningún lado. Falta la pantalla
donde el usuario **decide si va**: horarios, cómo llegar, teléfono, qué onda tiene el lugar.

Y es el primer punto donde entra **Google en vivo**, que es la parte cara y la parte
legalmente restringida del producto: el catálogo propio no tiene horarios (Overture no los
trae) y el ToS prohíbe cachearlos. Toda la arquitectura híbrida decidida en el volcado
—catálogo propio gratis, Google solo acá— **se materializa o se rompe en este spec**.

## Objetivo

1. Pantalla `/lugar/[id]` completa y útil **sin depender de Google**: nombre, dirección,
   zona, teléfono, redes, sitio web, rango de precios, tags propios y "cómo llegar".
2. **Matching Overture↔Google**: resolver y persistir `google_place_id` a costo **cero**
   (Text Search Essentials *IDs Only* = $0), con estados de match y política de reintento.
3. **Enriquecimiento en vivo**: horarios, rating y foto de Google al abrir la ficha, con
   **cero persistencia** (ni DB, ni caché de Next, ni memoria).
4. **Presupuesto acotado y verificable**: topes mensuales por SKU editables en DB, de modo
   que un pico de tráfico degrade el enriquecimiento en vez de disparar la factura.
5. **Atribución correcta** a Google (logo sobre datos, crédito al autor en la foto) y slot
   de fotos de dueño listo para el spec 5.

## Qué NO es esta feature

- **Reseñas / rating propio**: fuera, ya decidido. Tampoco se piden los `reviews` de Google
  (son tier *Enterprise + Atmosphere*, $25/1.000, y arrastran obligaciones de atribución
  extra: aviso de orden y filtrado).
- **Rating de Google en las cards de resultados**: prohibido persistirlo y carísimo pedirlo
  por card. El rating vive **solo acá**, en vivo. (Ya cerrado en CATALOGO y BUSQUEDA.)
- **Carga de fotos, descripción, carta y novedades del dueño** (spec 5): esta ficha **deja
  el hueco** y crea la tabla `place_photos` vacía, pero no construye el flujo de subida.
- **Reclamo de la ficha** (spec 5): el botón "¿Sos el dueño?" **no entra** en v1 de este
  spec — sin flujo detrás sería una promesa vacía.
- **Filtro / badge "Abierto ahora" en resultados**: sigue fuera (BACKLOG). Acá sí se muestra
  el estado abierto/cerrado **de la ficha abierta**, porque viene en la misma request que
  ya se está pagando y no requiere persistir nada.
- **Pantalla `/admin`**: no se construye. Corregir un match errado se hace por `UPDATE`
  documentado — mismo criterio que el umbral de confidence de CATALOGO, que también espera
  a que exista `/admin`.
- **Cachear cualquier dato de Google** que no sea `place_id`. No es un olvido de performance:
  es la prohibición del ToS (§3.2.3(b) + §14.3, leídos textual en IDEAS.md).
- **Slug SEO-friendly** en la URL: la ruta `/lugar/[id]` ya la fijó BUSQUEDA. → BACKLOG.

## Decisiones cerradas

Las 1-6 vienen de `IDEAS.md` y de los specs 1-3 (no se reabren); las 7-24 son diseño de
**este** spec.

| # | Decisión |
|---|----------|
| 1 | Principio de la ficha: **"simple no es pobre"** — info suficiente para decidir, sin ruido |
| 2 | La ficha muestra teléfono, dirección, horarios, link, rango de precios, redes sociales, tags propios y **"cómo llegar"** |
| 3 | **Fotos: prioridad dueño → fallback Google.** Las de dueño son propias y gratis; las de Google se pagan por request y no se pueden persistir (ni el `photo name`) |
| 4 | De Google **solo se persiste `place_id`**, sin límite temporal. Horarios, rating, nombre y fotos: prohibido |
| 5 | Atribución obligatoria: **logo de Google** al mostrar sus datos sin un mapa de Google en pantalla; **crédito al autor** en la foto + acceso al original vía `googleMapsUri`. *"Powered by Google" NO es el wording* |
| 6 | El acceso al lugar pasa por el **helper de visibilidad de CATALOGO** (única puerta al catálogo publicado) |
| 7 | **Matching por Text Search (New) *Essentials — IDs Only*: `fieldMask: places.id` y nada más ⇒ SKU 635D-A9DD-C520 = $0, gratis ilimitado.** Pedir un solo campo de más (`displayName` es Pro, `location` en Text Search es Pro) convierte el matching gratis en $32/1.000 |
| 8 | **El matching es a ciegas**: con IDs-Only no se puede comparar nombre ni distancia de la respuesta. Las salvaguardas van **en la entrada**, no en la salida: `textQuery` = `"<name>, <address>, <locality>"` + **`locationRestriction`** (rectángulo ~±300 m sobre el lat/lng propio de Overture, cerca real, no bias) + `maxResultCount: 1`. Si Google devuelve algo, está a 300 m y matcheó el texto |
| 9 | **Matching perezoso, no batch**: se resuelve la primera vez que alguien abre la ficha y se persiste para siempre. Resolver los ~27.000 del catálogo por adelantado es trabajo para lugares que nadie visita; solo ~3.000 fichas/mes se abren |
| 10 | **Estados de match** en `places.google_match_status`: `pending` (nunca se intentó) · `matched` (auto) · `manual` (lo fijó un humano — el resolver **nunca** lo pisa) · `not_found` (Google no devolvió nada; reintenta pasados `google.match_retry_days` = 30) · `blocked` (match malo o el lugar no está en Google; **no reintentar nunca**) |
| 11 | **Una sola llamada de datos por ficha: Place Details (New) con field mask *Enterprise*** ($20/1.000, 1.000 gratis/mes). El field mask se factura **una vez, al tier más alto pedido** ⇒ una vez que se paga Enterprise, agregar campos Enterprise es gratis. Mask: `id,regularOpeningHours,currentOpeningHours,rating,userRatingCount,priceLevel,googleMapsUri,photos` |
| 12 | **Nunca `Enterprise + Atmosphere`** ($25/1.000): sin `reviews`, sin `editorialSummary`, sin atributos de ambiente. El ambiente es **tag propio** — es el diferencial de la app, no se compra |
| 13 | Teléfono, dirección, website y redes se toman de **Overture** (86% teléfono · 98% redes), no de Google, aunque vinieran gratis en el mismo mask: son datos propios, se pueden persistir y funcionan aunque Google falle |
| 14 | **UNA sola foto de Google por ficha** (la primera de `photos`). Es la restricción derivada del presupuesto ya validado: 3.000 fichas/mes × 1 foto ⇒ Details $40 + Photos $14 = **$54/mes** — exactamente la línea de IDEAS § costos. Con 3 fotos serían ~$82 y el presupuesto queda roto. La galería de varias fotos es **solo** para fotos de dueño |
| 15 | **La foto se sirve con `skipHttpRedirect=true`**: el server pide el media endpoint, recibe el `photoUri` efímero de `googleusercontent` y lo pone en el `<img src>`. Así la API key **nunca** llega al browser, el `photo name` **nunca** se persiste ni se expone, y no hay proxy de imágenes propio |
| 16 | **El bloque de Google se pide desde el cliente**, vía `GET /api/lugar/[id]/google`, **no** en el render del server component. Motivo de costo, no de UX: los crawlers (Google, previews de WhatsApp — y compartir la ficha por WhatsApp es el loop viral del producto) dispararían llamadas Enterprise sobre fichas que ningún humano abrió. 27.000 fichas crawleadas = ~$520. `robots.txt` bloquea `/api/` |
| 17 | **Cero caché de datos de Google**, en ningún nivel: `fetch(..., { cache: 'no-store' })`, ruta dinámica, sin `revalidate`, sin caché en memoria ni TTL de 60 s. Un usuario que refresca tres veces paga tres requests: es el costo de la disciplina y se acepta. Único dedupe permitido: `React.cache()` dentro de un mismo render (es una request lógica, no caché entre requests) |
| 18 | **Un único módulo habla con Google**: `lib/google/places.ts` (server-only). Ningún componente ni route handler arma requests a Google por su cuenta. La API key vive solo ahí |
| 19 | **Topes mensuales por SKU** en `app_settings` (`google.details_monthly_cap` = 5.000 · `google.photos_monthly_cap` = 5.000), contados en `google_api_usage`. Superado el tope, **se deja de llamar a Google y la ficha degrada al modo sin Google** — nunca se corta la pantalla ni se dispara la factura. Mismo patrón editable-sin-deploy que umbral, precios y cupos |
| 20 | **Degradación honesta**: si Google falla, tarda o está sin cuota, la ficha **igual se muestra entera** con datos propios y el bloque muestra "No tenemos los horarios en este momento" — nunca un error, nunca un skeleton eterno. Timeout de 2,5 s |
| 21 | **Rango de precios**: primero el **tag propio** de la faceta Precio (`precio-1..4`, cortes en `app_settings.pricing.band_limits`); si el lugar no lo tiene, **fallback al `priceLevel` de Google** mostrado en vivo y atribuido. Sale gratis: ya viene en la request que se está pagando |
| 22 | **"Cómo llegar" = deep link, no API**: `https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>` + `&destination_place_id=<google_place_id>` cuando existe. Usa lat/lng propios ⇒ **costo cero** y funciona aunque el enriquecimiento esté caído |
| 23 | **Lugar no publicado ⇒ 404**, con el helper de visibilidad. Y **no se llama a Google** para un lugar no publicado (ni para uno inexistente): el gasto se autoriza después de la visibilidad, nunca antes |
| 24 | **Aperturas de ficha**: columna `detail_views` en `place_impressions_daily` (la tabla que ya crea BUSQUEDA). Es la métrica que vende el B2B ("cuánta gente vio tu ficha"), no se puede reconstruir a posteriori y cuesta una columna. Agregado por día, sin datos por usuario, sin cookies |

### Modelo de datos (migración sobre CATALOGO + BUSQUEDA)

Nada de esto persiste contenido de Google: son `place_id`, metadatos propios de matching y
contadores propios de uso.

**`places`** — columnas nuevas:

| Columna | Tipo | Notas |
|---------|------|-------|
| `google_match_status` | pgEnum `pending·matched·manual·not_found·blocked` not null default `'pending'` | decisión 10 |
| `google_matched_at` | timestamp nullable | último intento (éxito o `not_found`); base del reintento a 30 días |

`google_place_id` ya existe (CATALOGO), vacía hasta acá. Índice parcial sobre
`google_match_status` para las consultas de estado.

**`place_photos`** (creada **vacía**; la llena el spec 5) — `id` uuid pk · `place_id` fk →
`places` on delete cascade · `url` text not null · `sort` int not null default 0 ·
`created_at` timestamp. Se crea ahora por el mismo criterio con el que CATALOGO creó
`google_place_id` y `publish_override` vacías: la **prioridad dueño → Google es lógica de
esta ficha** y tiene que poder testearse insertando una fila a mano.

**`google_api_usage`** — pk compuesta (`month` text `YYYY-MM`, `sku` text `'details'|'photos'`)
· `count` int not null default 0. Se incrementa **antes** de llamar (contar de menos por una
excepción es peor que contar de más).

**`place_impressions_daily`** — se agrega `detail_views` int not null default 0.

**`app_settings`** — 3 claves nuevas: `google.details_monthly_cap` = `5000` ·
`google.photos_monthly_cap` = `5000` · `google.match_retry_days` = `30`.

### Diseño de la pantalla (mobile-first)

```
┌──────────────────────────────────────┐
│  [ ← ]                        [ ⤴ ]  │  volver · compartir (Web Share API)
│ ┌──────────────────────────────────┐ │
│ │  FOTO                            │ │  dueño → Google → placeholder de marca
│ │  (una sola; sin foto = bloque    │ │  (nunca una imagen rota)
│ │   con tokens, no un hueco)       │ │
│ │            foto: <autor> · Google│ │  crédito obligatorio, sobre la foto
│ └──────────────────────────────────┘ │
│                                      │
│  La Fábrica del Taco          ★ 4,3  │  rating: en vivo, con logo de Google
│  Restaurante · Mexicana     (128)    │  chips de Tipo/Cocina (tags propios)
│  Villa Crespo · $$                   │  zona primaria · precio (tag o Google)
│                                      │
│  ● Abierto · cierra 0:30             │  de currentOpeningHours
│  ▸ Ver horarios de la semana         │  acordeón, regularOpeningHours
│                                      │
│  Gorriti 5548, Villa Crespo          │
│  11 4832-1234 · lafabrica.com.ar     │  Overture (propio)
│  [ig] [fb]                           │  Overture (propio, 98% cobertura)
│                                      │
│  QUÉ VAS A ENCONTRAR                 │  ← el diferencial: Actividad/Ambiente/
│  Música en vivo · Tranqui · Terraza  │    Momento. Google no tiene esto
│  Pet friendly · Grupos grandes       │
│                                      │
│  ─ Datos de horarios, calificación   │  atribución al pie + link a /legales
│    y foto: Google                    │
├──────────────────────────────────────┤
│  [  CÓMO LLEGAR  ]  [ ☎ ]  [ 🌐 ]   │  barra fija abajo; primario ámbar
└──────────────────────────────────────┘
```

- **Orden deliberado**: lo propio y siempre disponible (nombre, tags, zona, dirección,
  contacto) manda el layout; lo de Google (foto, rating, horarios) se **encastra** en huecos
  que colapsan limpio si no llega. Nunca al revés.
- **"Qué vas a encontrar"** es la sección que justifica la app frente a Google Maps. Si el
  lugar no tiene tags de Actividad/Ambiente todavía (el import de Overture casi no las
  llena), la sección **no se renderiza** — un bloque vacío sería peor que su ausencia.
- Estados de carga del bloque Google: skeleton de dos líneas, nunca spinner de pantalla.
- Copy canchero rioplatense, cero emojis (decisión de marca ya cerrada).

### Camino de la request

```
GET /lugar/[id]                       server component, datos propios
  └─ visibilidad (helper CATALOGO) ── no publicado ⇒ notFound()
  └─ +1 detail_views                  (batch/dia, sin cookies)
  └─ generateMetadata: nombre · zona · tags PROPIOS
     (jamás datos de Google: el OG se cachea en terceros = persistencia)

  cliente monta ─► GET /api/lugar/[id]/google
                     1. rate limit por IP
                     2. visibilidad otra vez (nunca gastar en oculto)
                     3. status = blocked            ⇒ 204, sin llamada
                        status = not_found reciente ⇒ 204, sin llamada
                        google_place_id vacío       ⇒ resolver (Text Search IDs-Only, $0)
                                                        └ 0 resultados ⇒ not_found + 204
                     4. cuota details agotada       ⇒ 204, sin llamada
                     5. Place Details Enterprise (no-store, timeout 2,5 s)
                     6. photos[0] + cuota photos ok ⇒ media?skipHttpRedirect=true ⇒ photoUri
                     7. responde { horarios, rating, priceLevel, photoUri, autor,
                                   googleMapsUri }  — nada se guarda
```

`204 No Content` en todos los caminos sin datos: para el cliente son el mismo caso —
"no hay enriquecimiento" — y no hay que distinguir fallas de ausencias en la UI.

### Fases

| Fase | Alcance | Verificable con |
|------|---------|-----------------|
| **1 — Ficha propia** | `/lugar/[id]` completa con datos de CATALOGO+ZONAS, 404 por visibilidad, deep link "cómo llegar", contacto/redes, tags, `detail_views`, metadata OG, `place_photos` vacía y prioridad de foto (dueño → placeholder) | Sin API key de Google |
| **2 — Google en vivo** | Migración de match, `lib/google/places.ts`, resolver IDs-Only, `/api/lugar/[id]/google` con rate limit + cuotas, horarios + rating + `priceLevel`, degradación y timeout | API key + `google_api_usage` |
| **3 — Foto y atribución** | Foto de Google (`skipHttpRedirect`), crédito al autor, link al original, logo de Google, prioridad dueño→Google end-to-end, línea en `/legales` | API key + fila manual en `place_photos` |

## Criterios de done (DoD)

- [ ] `/lugar/[id]` de un lugar publicado renderiza nombre, dirección, zona primaria,
      teléfono, redes, sitio web y tags propios **con la API de Google apagada** (sin
      `GOOGLE_PLACES_API_KEY` la pantalla se ve entera y sin errores)
- [ ] Lugar no publicado (bajo umbral, `operating_status != 'open'`, o inexistente) ⇒
      `notFound()`, **y cero requests a Google** (verificado en el contador `google_api_usage`)
- [ ] Migración limpia: `google_match_status` + `google_matched_at` en `places`, tabla
      `place_photos`, tabla `google_api_usage`, `detail_views` en `place_impressions_daily`
      y las 3 claves nuevas de `app_settings`
- [ ] El resolver de matching usa **`fieldMask: places.id`** y `locationRestriction`
      (test unitario sobre el body de la request: si el mask trae cualquier otro campo,
      el test falla — es la diferencia entre $0 y $32/1.000)
- [ ] Match resuelto se persiste en `google_place_id` con status `matched`; la segunda
      apertura de la misma ficha **no** vuelve a llamar a Text Search
- [ ] Estados respetados: `blocked` y `manual` nunca disparan resolver; `not_found`
      reintenta recién pasados `google.match_retry_days`
- [ ] La request de Place Details usa exactamente el field mask de la decisión 11 (test
      sobre el header `X-Goog-FieldMask`); **no** incluye `reviews`, `editorialSummary`
      ni atributos de ambiente
- [ ] `google_api_usage` se incrementa por SKU y, superado el tope de `app_settings`, el
      endpoint responde `204` **sin llamar a Google**; bajar el tope a 0 apaga el
      enriquecimiento en vivo, sin redeploy y sin romper la ficha (test)
- [ ] Se muestra **una sola** foto de Google por ficha (test: un lugar con 10 `photos` en la
      respuesta genera exactamente 1 request de foto)
- [ ] Si existe al menos una fila en `place_photos` para el lugar, se muestran **las del
      dueño** y **no** se pide ninguna foto a Google (contador de `photos` no se mueve)
- [ ] Ningún dato de Google se persiste ni se cachea: grep del repo sin `revalidate` ni
      caché sobre las llamadas de `lib/google/places.ts`; todas con `cache: 'no-store'`;
      no existen columnas de horarios/rating/nombre/foto de Google en el schema
- [ ] La API key no aparece en ningún bundle de cliente (`lib/google/places.ts` es
      server-only; verificado sobre el output del build)
- [ ] `/api/lugar/[id]/google` tiene rate limit por IP y `robots.txt` bloquea `/api/`
- [ ] Atribución: logo de Google visible junto a los datos en vivo, crédito al autor sobre
      la foto con link al original, y línea de Google en `/legales`
- [ ] Timeout de 2,5 s: con Google mockeado lento, la ficha queda usable y el bloque cae al
      estado vacío honesto
- [ ] `detail_views` incrementa una vez por apertura de ficha publicada
- [ ] `npx tsc --noEmit` · `npm test` · `npm run build` verdes

## QA manual (IDs propuestos)

| ID | Caso | Criterio |
|----|------|----------|
| FICHA-01 | Ficha sin Google | Con la key vacía, abrir un lugar conocido de Palermo: nombre, dirección, teléfono, redes y tags correctos; sin errores en consola; el bloque de horarios/rating no aparece o dice el mensaje vacío |
| FICHA-02 | Visibilidad | Lugar con confidence 0.3 y sin override ⇒ 404. Poner `publish_override=true` ⇒ abre. `operating_status='closed'` ⇒ 404 aun con override |
| FICHA-03 | Matching correcto | Abrir 10 fichas de lugares reales y verificar en Google Maps que el `google_place_id` persistido corresponde al lugar (no al de al lado). Anotar los fallos: es la métrica de calidad del matching a ciegas |
| FICHA-04 | Matching gratis | Tras las 10 aperturas, la consola de facturación de Google muestra los eventos en el SKU **635D-A9DD-C520 (Text Search Essentials — IDs Only, $0)** y **ninguno** en Text Search Pro |
| FICHA-05 | Sin match | Un lugar que no existe en Google queda `not_found`; reabrir la ficha ese mismo día no genera request nueva; la ficha se ve completa igual |
| FICHA-06 | Corrección manual | `UPDATE` pegando un `google_place_id` correcto + `google_match_status='manual'`: la ficha muestra los datos del lugar correcto y el resolver no lo vuelve a tocar |
| FICHA-07 | Horarios en vivo | Los horarios y el estado abierto/cerrado coinciden con lo que muestra Google Maps para ese lugar en ese momento |
| FICHA-08 | Un solo SKU pago | Abrir 20 fichas: facturación muestra 20 eventos Place Details **Enterprise** y 20 de **Photos**, y **cero** en Enterprise + Atmosphere |
| FICHA-09 | Costo por ficha | Regla de tres contra el presupuesto: 20 fichas ⇒ ≤ 40 eventos pagos totales. Si el número es mayor, algo está pidiendo de más |
| FICHA-10 | Prioridad de foto | Insertar 2 filas en `place_photos` a mano ⇒ la ficha muestra esas fotos y el contador de `photos` de Google **no se mueve**. Borrarlas ⇒ vuelve la de Google |
| FICHA-11 | Atribución | Logo de Google junto a rating/horarios; nombre del autor sobre la foto con link al original; `/legales` con la línea de Google |
| FICHA-12 | Tope de cuota | `UPDATE app_settings SET value='0' WHERE key='google.details_monthly_cap'` ⇒ las fichas siguen abriendo, sin bloque de Google y **sin requests**; restaurar el tope lo revive |
| FICHA-13 | Degradación | Cortar la red / key inválida: la ficha carga completa, el bloque muestra el mensaje honesto, no hay spinner colgado ni pantalla de error |
| FICHA-14 | Cómo llegar | El botón abre Google Maps con la ruta al lugar correcto, en mobile y en desktop, **también** con el enriquecimiento caído |
| FICHA-15 | Crawler no gasta | `curl` con User-Agent de WhatsApp/Googlebot sobre `/lugar/[id]`: el preview OG trae nombre y zona, y los contadores de `google_api_usage` quedan **iguales** |
| FICHA-16 | Key no expuesta | Buscar la API key en el HTML servido y en los chunks JS del build: cero coincidencias |

## Relación con otros specs

- **CATALOGO (spec 1)**: llena `google_place_id`, que allá nace vacío. Usa el helper de
  visibilidad sin modificarlo y suma la línea de Google a `/legales`.
- **ZONAS (spec 2)**: lee la zona primaria de `place_zones` para el encabezado.
- **BUSQUEDA (spec 3)**: recibe la navegación desde card y mini-card del mapa; agrega
  `detail_views` a `place_impressions_daily`. La card **sigue sin** foto ni rating de Google.
- **Auth/reclamo (spec 5)**: llena `place_photos` (esta ficha ya prioriza sus fotos sin
  cambios), agrega descripción/carta/novedad en los huecos previstos, activa el botón
  "¿Sos el dueño?" y consume `detail_views` en el panel del dueño.
- **Monetización (spec 7)**: el desglose fino de estadísticas de ficha para el plan pago
  sale de `detail_views`.
- **Mejora futura (BACKLOG)**: refresh anual del `place_id` (Google lo recomienda a los 12
  meses y vía Details IDs-Only es **gratis**) · batch de matching para precalentar el
  catálogo · slug SEO en la URL · `/admin` para corregir matches sin SQL.
