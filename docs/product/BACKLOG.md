# Backlog — A Dónde Salimos

Cola de trabajo. Una línea por ítem + link al spec cuando exista. El **detalle de diseño**
vive en `docs/specs/`, no acá.

Convención: `- [ ]` pendiente · `- [x]` hecho (con fecha) · `→ spec:` link si tiene spec.

---

## Próximo

Volcado de producto **completo** (tanda 5, 2026-07-19). Cola de specs en orden — el detalle
del porqué de este orden está en `docs/product/IDEAS.md` § Estado de la conversación.

- [ ] **Paso 0 — scaffold de Next.js** (no es un spec; hoy no hay `package.json`)
- [x] **Catálogo + import de Overture** — schema, tags semilla, `confidence`/`operating_status`, atribución → spec: `docs/specs/done/CATALOGO.md`. **Cerrado ✅ 2026-07-20** (siembra 96 tags). [Resumen](../archive/SPECS_ARCHIVO.md#catalogo)
- [x] **Zonas** — 46 polígonos (los 4 de Palermo particionados a mano), zona primaria + buffer 400 m → spec: `docs/specs/done/ZONAS.md`. **Cerrado ✅ 2026-07-20**. [Resumen](../archive/SPECS_ARCHIVO.md#zonas)
- [x] **Búsqueda + filtros** — home/search, motor en Postgres, chips de Ocasión en DB, mapa MapLibre → spec: `docs/specs/done/BUSQUEDA.md`. **Las 3 fases cerradas ✅ 2026-07-20**. [Resumen](../archive/SPECS_ARCHIVO.md#busqueda)
- [x] **Ficha** — `/lugar/[id]`, primer uso de Google en vivo → spec: `docs/specs/done/FICHA.md`. **Las 3 fases cerradas ✅ 2026-07-20** (F1 ficha propia · F2 Google en vivo · F3 foto/atribución). [Resumen](../archive/SPECS_ARCHIVO.md#ficha)
- [x] **Auth + roles + reclamo de negocio** — better-auth (patrón StressPlan), reclamo/alta con cola en `/admin`, panel "Mi negocio", fotos a R2, horarios propios → spec: `docs/specs/done/AUTH.md`. **Las 4 fases cerradas ✅ 2026-07-22** (F1 auth base · F2 reclamo + alta + cola · F3 panel + contenido · F4 horarios propios). [Resumen](../archive/SPECS_ARCHIVO.md#auth)
  - [ ] **Botón de Google OAuth (F1, diferido)** — la config de better-auth ya lo soporta condicional por env (`GOOGLE_CLIENT_*`); falta la UI del botón + exponer el flag al cliente. Se difirió a pedido (2026-07-20): foco en email/password robusto primero. Sin creds no se testea. **Único DoD de AUTH sin cerrar** (deferral aceptado, ver spec § DoD). **Ratificado diferido (Fer, 2026-07-27):** el que se loguea hoy es mayormente dueño de negocio (se registra por email igual) + admin; el consumidor que gana con OAuth casi no se loguea. Backend ya listo → agregarlo después cuesta lo mismo. **Gatillo: funnel real de signups (premium/chat) o lanzamiento público.**
- [x] **Votación en grupo** — el loop viral: shortlist de 2-5 lugares, voto anónimo por cookie, resultados en vivo, cierre/desempate del creador, expiración lazy 72 h; premium modelado y apagado → spec: `docs/specs/done/VOTACION.md`. **Las 3 fases cerradas ✅ 2026-07-22** (F1 crear+gate · F2 votar+vivo · F3 cierre+panel). [Resumen](../archive/SPECS_ARCHIVO.md#votacion)
- [x] **Monetización (MercadoPago)** — mucho reuso de StressPlan. **Enciende el premium que VOTACION dejó modelado** (`users.plan`) y el `owner_plan` de AUTH → spec: `docs/specs/done/MONETIZACION.md`. **Las 4 fases cerradas ✅ 2026-07-25** (F1 instrumentación + precios · F2 cobro MP · F3 destaque · F4 desglose). [Resumen](../archive/SPECS_ARCHIVO.md#monetizacion)
- [x] **Chat IA "armá tu salida"** — chat premium (`/chat`) que traduce lenguaje natural a lugares reales del catálogo; **enciende el botón "la IA arma la shortlist" de VOTACION**. Tool-use con doble candado de grounding, cupo mensual + tope global que degrada, modelo en `app_settings` → spec: `docs/specs/done/CHAT_IA.md`. **Las 3 fases cerradas ✅ 2026-07-26** (F1 motor/cupo/endpoint · F2 UI `/chat` · F3 modo shortlist en VOTACION). [Resumen](../archive/SPECS_ARCHIVO.md#chat_ia)

### Cola de v2 — post-cierre de los 9 specs numerados

Orden decidido por Fer el 2026-07-27 (momentum → impacto). Los 4 specs se **escribieron** el
2026-07-29 (sesión de autoría). El detalle de cada uno está en § Mejoras futuras, con link al spec.

- [x] **1 · Alias POIs + CABA sistemáticos** — **no es spec**, tarea de datos (`lib/zones/canon.ts`
      § ALIASES). **Cerrado ✅ 2026-08-01**: 78 → **135 alias** (CABA completo + 48 hitos), todo
      validado con turf y arbitrado por el catálogo. QA `ALIAS-01..12`.
- [x] **2 · Abierto ahora** → spec: `docs/specs/active/ABIERTO_AHORA.md` — **F1 ✅ 2026-07-30**
      (chip «Para ahora»). La **F2** (abierto real desde horarios de dueño) sigue **gateada** en
      ≥ 50 publicados con horarios propios (hoy **1**), así que el spec queda en `active/` y no
      cuenta como pendiente de la cola. Gate técnico verde y **QA en vivo ✅ APROBADO** (2026-07-30,
      `AHORA-01..10`); AHORA-02 (madrugada) y AHORA-03 (domingo) quedaron cubiertos por test y por
      dato, sin verificar en pantalla — ver abajo.
  - [ ] **Mirar la franja de madrugada en pantalla (AHORA-02), sin falsear nada** — el único caso
        del QA con verificación pendiente: entre las **00:00 y las 05:59** AR, abrir la home y
        confirmar que «Para ahora» aplica `trasnoche` **y** `hasta-tarde` (los dos en la URL) y que
        el resultado es la **unión** (~176 en AMBA), no la intersección. **No requiere trabajo, solo
        el horario**: Fer lo mira una noche que le toque programar a esa hora (decidido 2026-07-30,
        para no mover el reloj del sistema). No bloquea nada — está cubierto por test unitario y por
        dato. AHORA-03 (domingo) queda sin verificar en pantalla **a propósito**: `franjaActual` no
        lee el día de la semana, así que no hay nada que el domingo pueda cambiar.
- [x] **3 · Favoritos / listas** ✅ **2026-07-31** → spec: `docs/specs/done/FAVORITOS.md` — la
      apuesta grande (retención + gancho premium sin costo marginal). **Cerrado entero**: F1
      (2026-07-30) + F2 (2026-07-31, `/mis-lugares`, crear/renombrar/borrar listas, sheet de
      destino y botón en el chat IA).
- [x] **4 · Sugerir lugar en una votación** ✅ **2026-07-31** → spec:
      `docs/specs/done/SUGERIR_EN_VOTACION.md` — extiende VOTACION y **revierte su decisión 2**
      (anotado en su tabla). Cerrado entero en una sesión, sin fases.
- [x] **5 · Rotación de chips por día/hora** ✅ **2026-07-31** → spec:
      `docs/specs/done/CHIPS_ROTACION.md` — mini-spec cerrado en una sesión corta, sin migración.
      **Con esto la cola de v2 queda completa** (los 5 ítems).

### Cola post-v2 — decidida por Fer el 2026-07-31

Con los 5 ítems de v2 cerrados y `docs/specs/planned/` vacío, Fer eligió el orden mirando cuatro
caminos (deuda · curaduría · deploy · specs nuevos). **Ninguno de los dos primeros necesita spec**:
son trabajo acotado con criterio de "listo" objetivo.

- [x] **1 · Pase de deuda técnica** ✅ **2026-07-31** (sesión Opus, sin spec). (a) y (c)
      implementados; **(b) resultó no ser un bug** — ver la entrada corregida en § Mejoras futuras
      y `docs/qa/AnalisisQA.md` § *Pase de deuda técnica* (9 IDs `DEUDA-NN`). Los tres ítems
      elegidos, todos con su detalle en § Mejoras futuras: **(a)** el tablero de `/admin`
      subestima el costo del chat porque `chat_messages` no persiste los tokens de caché —
      2 columnas nuevas + `lib/ai/chat.ts` + `lib/admin/costos.ts`, **migración sobre tabla con
      datos reales ⇒ `npm run backup:db` antes**; **(b)** el `EXISTS` con `${places.id}` sin
      calificar en `lib/search/query.ts`, que hoy funciona **por descarte** y devolvería cero en
      silencio si `place_tags`/`place_zones` ganaran un `id` (ya pasó en `lib/claims/query.ts`,
      hallazgo H-1 de AUTH F2); **(c)** el bbox de AMBA escrito dos veces.
> **⚠️ Orden invertido el 2026-07-31 (decisión de Fer, con datos).** El ítem de curaduría era el
> #2 y pasó **después** del deploy. El motivo, medido en la sesión de deuda: la curaduría con IA
> **no arregla ninguno de los dos problemas que la justificaban**, y el que sí arregla ya está
> cubierto. Detalle abajo.

- [x] **1.5 · Pulido de UX/UI para la beta** ✅ **CERRADO 2026-08-03** → spec:
      `docs/specs/done/PULIDO_BETA.md` · [Resumen](../archive/SPECS_ARCHIVO.md#pulido_beta) —
      **escrito ✅ 2026-08-03** (sesión Opus, sin código) ·
      **F1 (auditoría) ✅ 2026-08-03**: los 6 recorridos en vivo a 390×844 + control a 360 px (cero
      desbordes), **43 hallazgos** con evidencia en `docs/qa/AnalisisQA.md` § *PULIDO_BETA F1*.
      Incluye el premium "en camino" con el cobro realmente apagado. La base quedó como estaba, así
      que **el dump de `DEPLOY` F0 puede salir ya**.
      **F2 (triaje) + F3 (fix) ✅ 2026-08-03**: Fer confirmó los **10 BLOQUEANTE** (ninguno bajó) y
      los 10 están **arreglados y re-verificados en vivo**, cada uno en su recorrido completo —
      `docs/qa/AnalisisQA.md` § *PULIDO_BETA F2 (triaje) + F3 (fix)*. Los **33 no bloqueantes** están
      acá abajo en § Mejoras futuras, uno por línea con su ID. La base volvió a los conteos del
      arranque.
      **F4 (app instalable) — código hecho 2026-08-03**: `app/manifest.ts` + `public/icons/` (192,
      512 y maskable) + `app/apple-icon.png` (180) + `themeColor` en el `viewport`. Los **8 criterios
      de instalabilidad de Chrome** medidos en vivo por ngrok; **el service worker NO es requisito**
      (se chequeó en la doc antes de dar el DoD por cumplido — sigue siendo v2). `theme_color` y
      `background_color` = `#0D0D1F`, el `--background` de `globals.css`. **Fer la instaló de verdad
      en su Android** y abre con el splash del manifest, que es la decisión 9 funcionando. **iOS
      (PBETA-07) queda sin probar** por falta de un iPhone. Gate completo: typecheck + 645 tests +
      `build` verde con el server parado.
      **En el mismo tramo se cubrió el alta nueva end-to-end**, que era el hueco de F1 y F3 (nunca
      se pudo por `requireEmailVerification`): la pantalla "Revisá tu mail", el mail de Resend, el
      aterrizaje **con sesión ya iniciada** en `/`, y sobre todo que **el arreglo de PBETA-R3-03
      sobrevive a una cuenta nueva** —la base confirma el guardado en el mismo segundo de la
      verificación— y **no sobrevive** si el link del mail abre otra pestaña ⇒ hallazgo nuevo
      **PBETA-R3-07**, acá abajo. QA: `docs/qa/AnalisisQA.md` § *PULIDO_BETA F4*.
      **Se intercala antes del deploy por pedido de Fer**: *"ya que la vamos a lanzar en modo beta,
      debería estar óptima para los usuarios"*. Va **antes de `DEPLOY` F0** y el motivo es concreto
      (decisión 12 del spec): F0 restaura un dump en Neon y **el valor del dump es que esté
      fresco** — si esta pasada toca algo que vive en la base, F0 se hace dos veces.
      **No es repetir `PULIDO`** (2026-07-27): esa pasada fue **por hallazgos** (4 tracks ya
      anotados + `/admin` en tabs) y el QA integral #2 verificó que las cosas **funcionen**.
      Ninguna de las dos preguntó *"¿esto se entiende desde un celular si es la primera vez que lo
      ves?"*, que es la única que importa para una beta mobile.
      **Lo que lo estructura:** se audita por **recorridos** (6, no pantallas sueltas: lo que rompe
      es la transición y el estado en el que llegás), a **390×844**, **en vivo con Playwright** (un
      hallazgo de UX que no se vio en pantalla es una hipótesis), y **ver y arreglar son fases
      separadas** — F1 no toca una línea de código. Tres severidades y **solo BLOQUEANTE se
      arregla**; el resto lo tría Fer y cae acá. Es lo que evita que una pasada de UX se vuelva
      infinita.
      **El recorrido que más pesa es R2** (*me invitaron a votar*): es el loop viral, por ahí van a
      entrar los primeros usuarios y es el que menos se miró con ojos frescos.
      **Splash screen: DESCARTADA con motivo** (decisión 8, para que no vuelva en tres semanas). En
      la web el splash **crea** el hueco que en una app nativa tapa, y la home es la búsqueda:
      empeora el LCP a cambio de nada (`logo_2.png` pesa 1,4 MB). **Lo que sí va (decisión 9): la
      app instalable** — hoy **no existe `app/manifest.ts`**, solo `favicon.ico` e `icon.png`. Con
      manifest, Android dibuja el splash con el ícono y el color de marca **gratis** y solo para
      quien la instaló, más "agregar a la pantalla de inicio". iOS recibe ícono y standalone pero
      **no** splash: su startup image es una por tamaño de pantalla, cola de mantenimiento
      permanente por un cuarto de segundo (decisión 10).
- [ ] **2 · Hosting/prod (Neon + Vercel)** → spec: `docs/specs/active/DEPLOY.md` — **decisiones
      cerradas ✅ 2026-07-31** (sesión Fable de definiciones, sin código) · **primer tramo de código
      ✅ 2026-08-01** (el premium apagado; el spec pasó a `active/`) · **F0 ✅ 2026-08-03** (la base
      ya vive en Neon — ver abajo) · **F1 ✅ 2026-08-07: LA APP ESTÁ EN LÍNEA** en
      `https://adondesalimos.com.ar`. Vercel Hobby con las funciones en `gru1` declarado en
      `vercel.json`, DNS en Cloudflare DNS-only, Email Routing con `contacto@adondesalimos.com.ar`,
      bucket de R2 aparte para producción, y el aviso «Estamos en beta» en las 3 superficies. QA
      `DEPLOY-01..21`: **20 PASS + 1 con salvedad**. **Faltan F2** (rate-limit a Upstash + botón de
      Google OAuth) **y F3** (Vercel Pro + encender el cobro, gateada por la decisión 18).
      Lo que se resolvió, con los porqués completos en el spec:
      - **El dominio no había que decidirlo: `adondesalimos.com.ar` ya está registrado** (zona
        vacía en Cloudflare, mismo patrón que turnia). La puerta de ida ya estaba cruzada. Libres
        al 2026-07-31: `adondesalimos.com` y `.app`; tomados `quesale.com.ar`, `quepinta.com.ar`,
        `salimos.com.ar`. No se compran defensivos (decisión 2 del spec).
      - **US$0/mes fijos**: Neon Free (la base pesa **48 MB**, el 10% de los 0,5 GB) en São Paulo
        + Vercel **Hobby** + Upstash Free + R2 + Resend. El único costo variable es Anthropic, con
        techo duro de ~US$20/mes bajando `ai.chat_monthly_cap` a 500 con un UPDATE.
      - **El cobro sale APAGADO, y no por preferencia**: Vercel Hobby prohíbe el uso comercial, y
        cobrar exige Pro (US$20/mes ≈ **7 premium solo para empatar**). Además el día 1 no hay a
        quién cobrarle. El premium se anuncia como "en camino" y **se mide el interés** — ese
        contador es el disparador de los US$20, en vez de una corazonada.
      - **4 fases**: F0 Neon (cero código, reversible) · F1 deploy + 4 cambios chicos · F2 Upstash
        + Google OAuth · F3 (gateada) Pro + cobro.
      - **Por dónde se empieza (decidido con Fer): por el mensaje de premium apagado, ANTES de
        migrar a Neon.** No es una preferencia de orden: ese cambio agrega la tabla
        `premium_interest`, así que hacerlo primero deja el dump que viaja a Neon ya completo, en
        vez de tener que correr un `db:migrate` suelto contra prod. El copy, el schema (con el
        gotcha de los índices únicos **parciales** — `NULL ≠ NULL` en Postgres) y el conteo en
        `/admin` están cerrados en el spec § *El premium apagado*. **Ese tramo ya está
        implementado ✅ 2026-08-01** (migración `0014`, QA DEPLOY-10/15/16/17 ✅) — lo que seguía era
        **F0: crear Neon y restaurar el dump**, que ya trae la tabla.
      - [x] **F0 ✅ EJECUTADA ENTERA 2026-08-03** (sesión Opus, cero código). La base de producción
        existe: Neon Free en **`aws-sa-east-1`**, **PostgreSQL 16.14** (la misma versión que el
        Docker de dev, elegida por paridad cuando la consola ofrecía hasta la 18), catálogo completo
        restaurado y **verificado por conteo Y por checksum** — 13 tablas con los mismos números y
        6 conjuntos con `md5` idéntico, incluido el canario de curaduría en **3.967**. Cuentas de
        prueba borradas (**24 tablas en 0**) y `ai.chat_monthly_cap = 500`. **El Postgres de dev
        quedó intacto**, así que F0 sigue siendo deshacible borrando el proyecto de Neon.
        QA: `docs/qa/AnalisisQA.md` § *DEPLOY F0* (`DEPLOY-F0-01..12`). **Lo que sigue es F1**:
        `noindex` + `maxDuration` + `.env.example` + **el aviso de beta** + proyecto en Vercel + DNS.
      - [ ] **Aviso «Estamos en beta» — 5º cambio de F1** (pedido de Fer, 2026-08-03; decisión 21
        del spec, con copy y números). Nace de *"por si los usuarios dicen che, esto no busca bien"*.
        **⚠️ Encuadre corregido en la conversación: no nos cubre legalmente de nada** (no se vende
        ni se cobra, y los datos ya están atribuidos), así que escrito como letra chica defensiva es
        **peor** que no ponerlo. Lo que sí hace es evitar que el usuario concluya que la app está
        rota cuando el motor anda bien y lo que falta es **cobertura**. Los números que lo sustentan,
        medidos: sobre 18.993 publicados, `tipo` **100%** y `cocina` **38%** (los deduce Overture de
        la categoría — 11.837 son "restaurante" a secas), pero `momento` **6%** y `ambiente` **5%**,
        porque **no existen en ningún dato público** y salen enteros de la curaduría, que llegó a
        1.202 lugares. En concreto: `aire-libre` = **157** lugares en todo AMBA, `japonesa-sushi` =
        451, `desayuno` = 272. **El que filtra y ve poco tiene razón.** Tres superficies: `/legales`,
        footer y —la que importa— **el renglón en resultados vacíos/flacos**, porque nadie lee un
        banner de home y la frustración aparece mirando 3 resultados. QA `DEPLOY-18/19/20`.
        **Y se conecta con el #3 de esta cola** (curaduría de cobertura): el aviso describe un estado
        que este mismo lanzamiento viene a destrabar, así que puede decirlo sin sonar a excusa.
      - [ ] **Canal de contacto: `contacto@adondesalimos.com.ar` por Cloudflare Email Routing** (decisión
        22, 2026-08-03). Salió de escribir el aviso: el copy invitaba a "avisanos" y **no había
        dónde** — Resend solo envía, y quien conteste `no-reply@` escribe al vacío. Gratis, cero
        código, y **se hace en la misma visita al panel de DNS que Vercel**: ese es el argumento, no
        la feature. El apex no tiene MX (los de Resend cuelgan de `send.`) ⇒ sin conflicto, pero
        ⚠️ **no tocar `send.*` ni `resend._domainkey.*`** al agregarlos. Es solo reenvío: llega al
        Gmail de Fer pero se responde desde su dirección. **Se descartó el formulario in-app**: sin
        usuarios es infraestructura para cero mensajes, y cuando el volumen moleste se va a saber
        además qué tipo de mensajes llegan, que es lo que define cómo se diseña. QA `DEPLOY-21`.
      - [x] **Prerrequisito de F0 — QA integral #2 — ✅ EJECUTADO ENTERO 2026-08-02.**
        **APROBADO CON HALLAZGOS: 42 casos, 39 ✅ + 3 documentados, cero bloqueantes.** El bloque F
        cerró **en verde con diff = 0** en las 13 tablas, el canario de curaduría volvió exacto a
        **3.967** y el dump quedó en `backups/adondesalimos_2026-08-02_211243.sql.gz`. **⇒ F0 está
        desbloqueado: ese es el archivo que se restaura en Neon.** Los 3 hallazgos son 🟢 solo
        código (viajan con el próximo push, no necesitan migración) y están abajo. Único caso no
        corrido: `INT2-37` (madrugada), declarado suelto desde el diseño. Detalle:
        `docs/qa/AnalisisQA.md` §§ *QA integral #2 — sesión 1 / 2 / 3*.
        → plan: `docs/qa/PLAN-QA-INTEGRAL-2.md`. Las 7 features que entraron después del QA
        integral del 2026-07-26 (favoritos · sugerir · rotación de chips · «Para ahora» · historial
        de `/mis-votaciones` · premium apagado · 135 alias) tienen QA contra su propio spec y
        **ninguna se cruzó con las demás**. ~39 casos `INT2-NN` en 3 sesiones de ejecución.
        **El orden no se puede invertir**: QA → limpieza verificada **por conteo** (bloque F del
        plan) → `backup:db` → dump a Neon. Ya pasó dos veces que el QA dejó filas en el dump
        (`premium_interest` de DEPLOY, 20 votaciones del historial), y las de `premium_interest`
        **disparan el gatillo de prender el cobro**. **F0 no arranca hasta que el bloque F cierre
        en verde.** El plan deja 4 decisiones abiertas para Fer (§ 12).
- [ ] **3 · Curaduría de datos — la cobertura, guiada por uso real.** Era el #2. Sigue siendo
      cierto que **Precio tiene ~0 filas** (1 sola, cargada a mano) y que **Actividad está pegada
      al Tipo**.
      - 📊 **La medición completa está en
        [`docs/product/cobertura-tags-2026-08-01.md`](cobertura-tags-2026-08-01.md)** (2026-08-01):
        cobertura por faceta sobre los 18.993 publicados (Ambiente **5,0%** · Momento **6,1%** ·
        Precio **0,0%**), qué rindió la curaduría, el **69% de tags sin cita textual**, la segunda
        opinión de dos LLMs externos y **las decisiones, ya tomadas** (§ 5). **Leerlo antes de
        tocar esto.**
      - ✅ **OSM/Overpass, medido (2026-08-01) — y NO va spec.** 16.949 POI en AMBA, solo 15,5% con
        `opening_hours`. Cruzando por nombre + ≤200 m: matchea 18,2–25,8% y **ganan ≥1 tag
        6,7–9,0% del catálogo** (Ambiente 5,0% → 9,3–10,6% · Momento 6,1% → 9,6–10,9% · **Precio
        sigue en 0**). El **techo está medido en ~11%**: ya capturamos el 78–82% de lo que OSM
        tiene, así que un matcheo mejor suma ~2 puntos, no un orden de magnitud. Y rinde al revés
        de lo que el producto necesita: café 22,1%, **bar 5,9%, boliche 1,7%**. Sumale que ODbL es
        **share-alike sobre bases derivadas**, no solo atribución: un 40% habría justificado abrir
        esa pregunta sobre el catálogo, un 9% no. Queda anotado como **pre-relleno de la cola** de
        curaduría cuando se cure por uso real. **Las reglas por nombre** (`rooftop`→terraza) que
        proponían las dos respuestas: **2,2% del catálogo** y con precisión dudosa ("Quinta X" es
        un salón de fiestas).
      Lo que cambió es **cómo** se arregla, medido el 2026-07-31:
      - **`npm run curar` NO puede llenar Precio.** `FACETAS_SUGERIBLES`
        (`lib/curation/facetas.ts`) es `['ambiente','momento','actividad']`: Precio quedó fuera
        por decisión del spec CURADURIA ("campo manual opcional en la cola, no algo que el LLM
        proponga"). Re-correr cuesta plata y da **cero** filas de Precio.
      - **Para Actividad la curaduría es floja**: sobre 1.202 lugares procesados produjo 373 tags
        de Actividad (0,3 por lugar), contra 1.297 de Ambiente y 2.296 de Momento. Y los 3.142 de
        Actividad que existen vienen del `tag-map` del import, que **por diseño** solo mapea
        categorías que *son* la actividad (`bowling_alley`, `escape_room`…). O sea: Actividad
        espeja al Tipo **estructuralmente**, no por falta de cobertura.
      - **Ambiente/Momento sí las llena bien** — y es exactamente lo que la corrida de julio ya
        cubrió.
      - **Costo de "curar todo": ~US$145–215** (14.458 lugares elegibles sin curar, de 15.660;
        solo 1.202 curados = 7,7%. A US$0,010–0,015 por lugar, extrapolado de la corrida real de
        US$17,62). **Descartado**: sin usuarios no se sabe cuáles de los 15.660 importan.
      - **El plan nuevo**: deployar primero y dejar que `place_tag_impressions_daily` (ya existe y
        ya cuenta) diga qué lugares la gente **ve**; curar esos ~200, no los 14.458. Y Precio
        dejarlo a los **dueños**, que son los únicos con incentivo de mantenerlo al día — un
        precio inferido de una carta vieja no es un dato ralo, es un dato que miente.
      - **Prerrequisito de cualquier corrida futura**: el filtro de skip (ver § Mejoras futuras),
        o se paga dos veces por los mismos lugares.
      - **Los ~2.746 tags sin cita se quedan** (decidido 2026-08-01). El cruce con OSM funcionó
        como muestra independiente de 273 comparaciones: los tags **sin** cita coinciden **92%** y
        los que **sí** la tienen, 84%. La hipótesis "el LLM sin evidencia inventa" no se sostiene,
        y validar 100 a mano no cambiaría ninguna decisión. **Lo que sí hay que revisar a mano son
        ~400**: `hasta-tarde` (173) + `trasnoche` (44), donde el acuerdo con OSM se cae a 29–50%, y
        `happy-hour` (189, 89% sin cita), que ninguna fuente estructurada puede arbitrar y es la
        afirmación más falsable de todas.
      - **Ocultar el filtro de Precio** mientras tenga menos de N lugares etiquetados — mismo
        criterio que CHIPS_ROTACION, que ya apaga los chips sin lugares vivos. Decidido el
        2026-08-01: con OSM descartado como fuente de precio y el estimador sin priorizar, "se
        llena solo" dejó de ser un plan, y un filtro que vacía la pantalla es peor que uno que no
        está. Es chico y reversible.
      - **El score de completitud NO se implementa** (decidido 2026-08-01, lo proponía la respuesta
        1): ya hay una regla que reordena la búsqueda por plata (MONETIZACION F3) y tiene dueño. Un
        segundo criterio sin jerarquía explícita vuelve el orden impredecible. Si algún día entra,
        entra como desempate **dentro** del mismo nivel de destaque.
- [ ] **~~3~~ · Hosting/prod (Neon + Vercel)** — **ahora es el #2** (ver arriba, ya con spec).
      La prioridad "bajísima" se fijó el 2026-07-27 con 5 ítems de v2 por delante, y hoy no hay
      ninguno. Es lo único que separa "todo implementado" de "usable", y **desbloquea el backlog
      que hoy no se puede trabajar por falta de usuarios reales**: afinar las reglas de
      CHIPS_ROTACION con `place_tag_impressions_daily`, el gatillo del botón de Google OAuth
      ("funnel real de signups o lanzamiento público") y medir qué chip funciona.

- [x] **4 · Pulido de UI — cuatro hallazgos de Fer** (anotados 2026-08-01, usando la app).
      **Cerrado entero el 2026-08-01** (sesión A: a·b·c; sesión B: d — ver § Hecho). Los
      cuatro verificados contra el código antes de escribirlos. **Se agrupan en dos sesiones**: los
      tres primeros son mecánicos y sin decisiones abiertas; el cuarto no es solo visual.
      - **Sesión A — pulido, sin decisiones (a · b · c): HECHA ✅ 2026-08-01** (ver § Hecho).
      - **(a) ✅ El wordmark real en las pantallas de auth.** No falta marca: `app/(auth)/layout.tsx`
        ya envuelve las cuatro (login · registro · recuperar · restablecer) y muestra "¿A dónde
        salimos?" **como texto plano**. Falta que sea el wordmark de identidad —pin con gradiente +
        tipografía— que el resto de la app usa vía `<BrandHeader />`
        (`components/shared/wordmark.tsx`). **Un swap en un solo archivo arregla las cuatro
        pantallas.** Es incoherencia de identidad, no ausencia.
      - **(b) ✅ Falta `← Volver` en `/mis-lugares` y `/mis-votaciones`.** El patrón es idéntico en 8
        pantallas (`app/cuenta/cuenta-client.tsx`) y justo en esas dos no está. Dos detalles al
        hacerlo: en `/mis-votaciones` el header ya lo ocupa el botón "Armar votación" (hay que
        decidir si el Volver va arriba del título o comparte fila), y `/mis-lugares` arma todo
        desde el client component, así que el header vive ahí y no en la `page.tsx`. **De paso: esas
        dos tampoco usan `<BrandHeader />`** y `/cuenta` sí — es el mismo problema que (a), por eso
        van juntos.
      - **(c) ✅ "Qué se encuentra en tu lugar" es un muro de tags.**
        `app/mi-negocio/[placeId]/editor-client.tsx` mapea **todas las facetas con todos sus tags,
        planos**: son ~96 y Cocina sola tiene 46, dentro de un formulario que además sigue con
        Horarios abajo. **Fix propuesto**: cada faceta en un `<details>` plegado con el contador de
        elegidos en el título ("Cocina · 3 elegidos"). Sin librería nueva ni rediseño. El buscador
        de tags es la alternativa cara: probar primero lo plegable y medir si alcanza.
      - **Sesión B — HECHA ✅ 2026-08-01** (ver § Hecho; QA `docs/qa/AnalisisQA.md` § *Pulido de
        UI, sesión B*, PULIDO-D-01..11).
      - **(d) ✅ `/mis-votaciones` crece sin techo, y no es solo visual.** `misVotaciones`
        (`lib/votaciones/query.ts`) **no tiene `LIMIT`**: trae todas las votaciones del usuario y
        después todas las opciones de todas. El plan free ve solo la activa, así que **el que sufre
        es premium** — justo a quien se le vendió el historial. Y cada card es pesada porque incluye
        los controles de cerrar/cancelar, que **solo tienen sentido en la activa**. **Recomendación**:
        activa arriba con la card completa, historial abajo en filas compactas (nombre · ganador ·
        fecha) paginado o con "ver más" — arregla el largo y el costo de la query de una sola vez.
      - **Las 5 decisiones, cerradas por Fer el 2026-08-01** (queda escribir el spec e implementar):
        1. **Cuánto historial**: 20 de entrada + botón "Ver más" con cursor por `createdAt`. **Sin
           scroll infinito** — un panel al que no se le puede llegar al final es peor que uno largo.
        2. **Qué dice una fila del historial** — *acá está la trampa que el hallazgo no vio*:
           "nombre · ganador · fecha" suena a `polls`, pero **ninguno de los dos nombres está ahí**.
           El título, cuando el creador no puso uno, se arma con los nombres de las opciones
           (`mis-votaciones-client.tsx`, `titulo = votacion.title || opciones.map(name).join(' · ')`)
           y del ganador `polls` solo guarda `winnerPlaceId`. O sea que "no traigas las opciones de
           las cerradas" **no es gratis**. Decidido: **join a `places` por `winnerPlaceId`** (una
           fila por votación) para el nombre del ganador, y las **primeras 2 opciones + "…"** para
           las que no tienen título — mantiene reconocible la votación, que es para lo que sirve.
        3. **Qué entra al historial**: cerradas y expiradas **sí**, canceladas **no** (hoy entra
           todo). Una cancelada no tiene nada que contar; si alguna vez se quieren ver, va como
           filtro, nunca como default.
        4. **"La activa" son varias**: premium **no tiene tope de activas** (`acciones.ts` solo
           bloquea al free), así que el bloque de arriba es un **grupo de N cards completas** —
           cerrar, cancelar, copiar link— y **no lleva `LIMIT`**: son pocas por definición. El
           `LIMIT` y el "Ver más" son **solo del historial**.
        5. **El free no ve teaser del historial** — queda como está hoy. Un teaser en gris de lo que
           no podés abrir molesta más de lo que convierte. Decisión de monetización, de Fer.

- [ ] **5 · Feedback de los primeros usuarios reales — triado ✅ 2026-08-08.** Los 10 ítems que
      trajeron los hermanos de Fer el día del lanzamiento, clasificados **contra el código** y
      agrupados en 4 tandas (detalle completo abajo, IDs `FB-01..FB-10b`): **Tanda A** — 2 bugs
      (`FB-08` la votación trata al creador como invitado · `FB-09` el sheet no se arrastra) + 3
      roces chicos + `FB-02`, todo sin spec; **Tanda B** — `FB-10`, la puerta de entrada de la
      curaduría por nombre, **que es lo que destraba el ítem 3 de esta misma cola**, junto con
      `FB-10b` (un bug que encontró el triaje: guardar en la curaduría **borra el precio** del
      lugar); **Tanda C** — los dos de `/admin`; **Tanda D** — `FB-04`.
      **Fer aprobó arrancar por la Tanda A (2026-08-08)**; B y C esperan a que las pida.
      ✅ **Tanda A cerrada el 2026-08-08** (los 6 ítems tildados abajo + `PBETA-R2-09`). Quedan B, C y `FB-04`.
      ✅ **Tanda B cerrada el 2026-08-08**: [`CURADURIA_POR_NOMBRE`](../specs/done/CURADURIA_POR_NOMBRE.md)
      escrito e implementado el mismo día (`FB-10` + `FB-10b`). Quedan **C** y `FB-04`.
      ✅ **Tanda C cerrada el 2026-08-08**: [`ADMIN_USUARIOS`](../specs/done/ADMIN_USUARIOS.md)
      escrito e implementado el mismo día (`FB-01` + `FB-03` en un solo spec: misma pantalla, misma
      tanda, mismo criterio de privacidad). **Solo queda `FB-04`** (Tanda D).
      ✅ **Tanda D cerrada el 2026-08-08**: [`MAPA`](../specs/done/MAPA.md) escrito e implementado
      el mismo día (`FB-04` + `PBETA-R1-06`, misma pantalla y mismo archivo). **Con esto el feedback
      de los primeros usuarios queda cubierto entero** — las 4 tandas, los 10 ítems.
      ➕ **Apareció un ítem 11 el 2026-08-08, de otro origen** (un conocido, no los hermanos):
      `FB-11`, Play Protect bloqueando la instalación de la PWA. Está abajo en § *Feedback
      posterior* — **no es de los 10** y no altera el conteo del lote original.

- [x] **6 · Corregir datos base de un lugar cuando Overture quedó viejo** ✅ **CERRADO 2026-08-09** → spec:
      [`docs/specs/done/CORRECCION_DATOS.md`](../specs/done/CORRECCION_DATOS.md) · [Resumen](../archive/SPECS_ARCHIVO.md#correccion_datos) —
      **escrito e implementado el mismo día** (autoría con Opus + implementación en una sesión). Hallazgo del
      2026-08-08. Fer buscó «Matienzo» y la ficha
      (`7dbf6b2c-4b2a-4605-a425-df3ca24ce520`) mostraba **la sede vieja**: la base guardaba
      `address: 'Pringles 1249'` con `lat/lng: -34.5973, -58.4263` (`source: overture`,
      `confidence: 0.77`), y el sitio oficial del club dice **Av. Juan B. Justo 2959**
      (verificado el mismo día contra `ccmatienzo.com.ar`). El lugar **se mudó** y la foto de
      Overture (release `2026-06-17.0`) tiene la dirección anterior. Prueba de que es eso y no
      otra cosa: la **Accademia della Pizza que hoy ocupa Pringles 1249 no está en el catálogo**
      —hay 6 sucursales cargadas y ninguna en esa dirección—. El catálogo tiene al inquilino viejo
      y le falta el nuevo.
      ⚠️ **No es solo el texto: las coordenadas también son las viejas.** El pin del mapa apunta a
      Pringles y el orden por distancia de «Cerca de mí» se calcula desde ahí. Pega en la
      búsqueda, no solo en la ficha.
      🚧 **Y hoy no hay forma de arreglarlo**, que es el hallazgo de verdad:
      `place_owner_content` —la única puerta para pisar datos de Overture— tiene `phone`,
      `website`, `socials`, `openingHours`, `description` y `menuUrl`, y **no** `address`, `lat`,
      `lng` ni `name`. **Ni el dueño con reclamo aprobado puede corregir su propia dirección**, y
      un `UPDATE` a mano sobre `places` lo pisa el próximo re-import.
      ✅ **Decidido con Fer el 2026-08-08 — cómo se ataca:** la corrección se escribe **en
      `places`** y **al re-import se le enseña a no pisar lo corregido** (una marca de "esto lo
      editó un humano"). Se descartó guardarla en `place_owner_content`: la ficha la vería pero
      **el mapa y la búsqueda no** —`lib/search/query.ts` no llama a `resolverContenidoDueno`,
      lee `places` directo—, así que habría que tocar el motor y la asignación de zonas, que es
      el módulo más sensible de la app. Con la marca, el costo se muda al script de import, que
      corre pocas veces. También se descartó el parche a mano (`UPDATE` en dev + Neon): arregla un
      caso, se pierde en silencio en el próximo import y no escala.
      👤 **Las dos superficies, con reglas distintas** (decidido con Fer el mismo día): **admin
      edita directo** —es el árbitro y hoy no tiene ninguna forma de tocar esto— y **la corrección
      del dueño pasa por aprobación**. El porqué no es burocracia: `description` o `menu_url` solo
      tocan la ficha de quien los escribe, pero **el pin mueve al lugar en la búsqueda de todos**
      (la zona sale de la geometría, la distancia de `lat/lng`), y correr el pin a una zona de más
      tráfico es el incentivo clásico de spam en un directorio. La cola de reclamos ya existe.
      ✅ **Las 6 preguntas abiertas quedaron resueltas en el spec** (2026-08-09), y dos de ellas
      cambiaron de forma al verificarlas contra el código:
      - **La marca va por CAMPO** (`places.locked_fields`, `text[]`), no por lugar: un flag por
        lugar convertiría cada corrección en un opt-out permanente del catálogo. Precedente en el
        repo: `google_match_status = 'manual'`, que ya significa *"lo fijó un humano, el
        automatismo no lo pisa"*.
      - **El pin re-asigna la zona en el acto**, en la misma transacción, con
        `asignarZonasDeLugar` — cuyo docstring **ya dice** que sirve para *"el alta o edición"*: la
        edición nunca había llegado. Cero código nuevo de geometría.
      - **Si Overture se pone al día no pasa nada automático**: el import lo reporta y un humano
        suelta el campo con un click. La marca no vence por tiempo.
      - **El dueño propone solo dirección + pin**; `name` es de admin (es la clave del buscador y
        del matching con Google, y renombrar una ficha ajena es el vector de secuestro de listado).
      - **Superficie:** las correcciones pendientes van a la **cola de aprobación que ya existe** y
        el buscador + editor + bitácora a una **7ª tab «Lugares»**, reusando
        `buscarLugaresPorNombre` tal cual (que **omite `publishedWhere`** a propósito — justo lo
        que hace falta acá).
      - **La dirección de Google: SÍ, y el costo marginal es US$0** — verificado contra la doc, que
        era el punto que nadie había chequeado. `formattedAddress` es del SKU *Place Details
        **Essentials*** y Google factura *«at the highest SKU applicable to your request»*; el mask
        de hoy **ya mezcla tres tiers** (`photos` IDs-Only · `googleMapsUri` Pro · el resto
        Enterprise) y se cobra una sola vez a Enterprise. Con esto la **decisión 11 de FICHA queda
        confirmada contra la doc**, no solo asumida. Se muestra **solo en el editor de admin**,
        como señal y **sin botón de copiar**: escribir ese string en `places.address` sería
        persistir contenido de Google.
      🆕 **Y el spec encontró algo que no estaba en el reporte y es peor:** ese lugar tiene
      `google_match_status = 'matched'` con un `google_place_id` resuelto el 2026-08-09. El
      matching usa `locationRestriction` de **±300 m del pin propio** ⇒ ese id apunta a lo que hay
      en **Pringles 1249**, así que la ficha puede estar mostrando horarios, rating y foto **de
      otro negocio**. Corregir el pin sin invalidar el match dejaría el problema peor. El spec lo
      resuelve en su decisión 9 (reset a `pending`, salvo `manual`), y el re-match sale **$0**
      porque es Text Search IDs-Only.
      ✅ **Cerrado el 2026-08-09, y el hallazgo del párrafo de arriba se confirmó ejecutándolo:**
      antes de corregir, «Google dice» devolvía **`Pringles 1210`** —ni siquiera nuestro 1249, sino
      otro número de la misma cuadra— y al mover el pin el `google_place_id` **cambió**
      (`ChIJyVx_WKjLvJUR…` → `ChIJU7cbTnrKvJUR…`), o sea que la ficha **venía mostrando datos de otro
      local**. Matienzo quedó en `Av. Juan B. Justo 2959` / `-34,597471, -58,448610`, con
      `locked_fields = {address,lat,lng}`, zonas recalculadas (`zones:assign` después no cambia ni
      una fila) y el match re-resuelto contra el negocio real. La dirección se verificó con Overpass
      (OSM tiene el nodo del club en la sede nueva). **Estimación acertada:** una sesión, como
      `ADMIN_USUARIOS`.

- [x] **6.5 · Matienzo corregido EN PRODUCCIÓN** ✅ **2026-08-10**. La corrección hecha en dev el
      09/08 nunca había llegado a Neon (el dump que fundó prod es del 03/08 y **las correcciones son
      datos, no código**): producción seguía con `Pringles 1249`, el pin viejo y el
      `google_place_id` que apunta a **otro negocio** — la ficha mostraba horarios y foto de un local
      ajeno, en vivo. Lo destapó una diferencia de **1** entre el conteo de Palermo Soho en prod
      (1.095) y en dev (1.094). Se corrigió por la UI de `/admin` → Lugares, que de paso fue el
      end-to-end de CORRECCION_DATOS en producción: `locked_fields = {address,lat,lng}`, bitácora con
      fuente citada, zonas re-asignadas (se fue `palermo-soho`) y el match re-resuelto al negocio real
      (`ChIJU7cbTnrKvJUR…`, el mismo id que dev) a costo **$0**. Detalle en `docs/qa/AnalisisQA.md`
      § *QA en vivo — ORDEN_ORGANICO en producción*.
      ⚠️ **De paso se descubrió que Neon estaba dos migraciones atrás**: faltaba la `0016` de
      CORRECCION_DATOS, con su código ya deployado ⇒ `/admin` → Lugares estaba **roto en producción**
      y nadie lo había notado. Aplicadas `0016` + `0017` el 2026-08-10, con backup previo
      (`backups/NEON_prod_2026-08-10_161723.sql.gz`, el primero de prod). Lección registrada.
      🆕 **Y el mismo QA encontró un cuarto caso, del deploy de ese mismo día:** `salida-con-chongo`
      tenía en Neon los **tags viejos** (el código de `c8aac77` viajó, la fila no), así que en
      producción el chip devolvía **1 lugar en vez de 35** — el bug reportado, vivo. Sincronizado con
      un SQL dirigido; los 17 chips quedaron con `diff` vacío entre dev y prod. La causa de fondo
      —que `sembrarChips` no puede re-sincronizar los tags de un chip existente— quedó como deuda en
      § *Deuda técnica señalada, no tocada*. Se hizo además la **auditoría completa de drift**
      (conteo de las 37 tablas + `app_settings` clave por clave): todo lo de catálogo y config
      coincide; las 22 tablas que difieren son transaccionales y deben diferir.
- [x] **7 · Lista de `search.cadenas` completada: 22 → 43** ✅ **2026-08-10**. Se corrió
      `npm run cadenas:proponer` y, antes de decidir a ojo, **se midió**: los 28 candidatos
      **comparten cada uno un dominio web propio y dominante** (`lo de carlitos` 19/19 en
      `lodecarlitos.com`, `rincon norteno` 10/10, `la fabrica` 12/14). O sea que **no había
      homónimos**: la sospecha era mía y el dato la descartó, y la pregunta dejó de ser "¿es
      cadena?" para ser "¿la despriorizo?" — que es la decisión 5 del spec.
      **Fer aceptó 21** (grupos A y B): las 16 de fast food genérico (`mccafe`, `la continental`,
      `la farola express`, `taco box`, `sushiclub`, `betos`, `el noble`, `deniro`, `green eat`,
      `dean & dennys`, `wendy's`, `sensu`, `delicity`, `romario`, `pizza lo+hot`, `tomasso pizzas`)
      y las 5 cafeterías de cadena (`tienda de cafe`, `tea connection`, `le ble`, `nucha`,
      `croque madame`) — estas porque **sus pares ya estaban** (The Coffee Store, Le Pain Quotidien,
      Brioche Dorée): dejarlas afuera les daba mejor trato por accidente de cuándo se armó la lista.
      **Quedan 7 afuera, ahora declaradas en código** (`EXCLUIDAS_A_PROPOSITO` en
      `lib/search/cadenas.ts`, para que la próxima corrida no las re-proponga como novedad y alguien
      las sume sin saber que ya se decidió): `tostado cafe club` y `cervelar` porque **la decisión 15
      del spec las nombra** entre las cadenas chicas que sí son un buen plan; `cinemark hoyts
      argentina` porque son **cines** y no gastronomía; y `lo de carlitos`, `mi gusto`, `la fabrica`
      y `rincon norteno` porque **no está claro que sean fast food genérico** y nadie tenía criterio
      firme. *Lo de Carlitos* quedó #20 en «Quilmes · Cenar afuera», así que hay un caso real a mano
      para decidirlo cuando se quiera.
      **Aplicado en las DOS bases** (dev y Neon) con un `UPDATE` generado **desde el propio
      `DEFAULT_CADENAS`**, para que código y datos no puedan divergir. Verificado en producción:
      *La Farola Express*, que estaba 14ª en «Quilmes · Cenar afuera», salió del top 20; el conteo
      quedó en 361, igual que antes — orden, no filtro.


### 🆕 Feedback de los primeros usuarios reales (2026-08-07) — **TRIADO 2026-08-08**

**Origen:** los hermanos de Fer, a quienes les compartió la app el día del lanzamiento (DEPLOY F1).
**Es el primer feedback de gente que no construyó esto**, y es exactamente lo que el spec DEPLOY
venía a destrabar (*"empezar a acumular los datos de uso"*).

**Método del triaje:** cada ítem se clasificó **leyendo el módulo dueño de esa regla**, no el
reporte — la lección de `zona-no-adyacente-no-era-bug`. Rindió: **2 de los 10 no son lo que
parecían** (el 2 es la decisión 18 funcionando; el 5 ya está implementado, pero en otro lado), y
**el triaje encontró un bug que nadie reportó** (el precio que se borra, ver FB-10b).

⚠️ **Son 10 ítems, no 11.** El handoff de la sesión de triaje decía 11; el archivo siempre tuvo 10
y no falta ninguno. Corregido acá para que la próxima sesión no busque un ítem fantasma.

**Categorías:** 🔴 BUG · 🟠 COBERTURA de datos · 🔵 DECISIÓN ya tomada (falta explicarla o
revisarla) · 🟢 FEATURE nueva. **Ninguno de los 10 resultó 🟠 cobertura de datos** — el que más se
le parecía (FB-10, "un bar con juegos figura solo como Bar") es cobertura *sin puerta de entrada*,
que es una feature de admin, no un problema del catálogo.

#### Tanda A — bugs y roces de una tarde (sin spec, costo bajo; solo FB-07 espera a Fer)

- [x] **FB-08 · 🔴 BUG — la votación le habla al creador como si fuera un invitado.** ✅ **Hecho 2026-08-08** (QA `FB-08-01..03`). *El más claro
      de la lista y el más barato.* **`esCreador` ya está calculado 14 líneas más arriba del bug**:
      `app/votacion/[token]/page.tsx:95` lo resuelve con `esCreadorDeVotacion` y se lo pasa al
      cliente para la moderación (decisión 8 de VOTACION) — pero el eyebrow (`:109`, *"Te invitó
      Fernando"*) y el footer (`:145`, *"Armá tu propia votación"*) no lo consultan. **Fix: dos
      condicionales en un solo archivo, con el dato ya en mano.** Impacto alto: el link de la
      votación es la superficie más compartida del producto.
  - [ ] **Fuera de scope de FB-08, encontrado al verificarlo (2026-08-08)** — la bajada de la
        votación (*"Elegí a dónde ir: votás sin crear cuenta. Esto es ¿A dónde salimos?, la app
        para decidir la salida con el grupo"*, `app/votacion/[token]/page.tsx:117-120`) también le
        explica el producto al creador, que ya lo conoce. **No se tocó**: el triaje acotó FB-08 al
        eyebrow y al footer. Es 1 condicional más en el mismo archivo si Fer lo quiere.
- [x] **FB-09 · 🔴 BUG de affordance — el sheet no se arrastra para cerrar, pero dibuja la barrita
      que lo promete.** ✅ **Hecho 2026-08-08** (QA `FB-09-01..06`; cierra `PBETA-R2-09`). `components/ui/bottom-sheet.tsx:41` renderiza el handle
      (`h-1 w-10 rounded-full`) y **no hay un solo handler de touch/pointer** en el componente: la
      promesa visual existe sin el comportamiento, que es literalmente lo que se reportó (*"parece
      que se pudiera bajar y no responde"*). **Un arreglo, siete pantallas**: `BottomSheet` es el
      dueño único y lo usan filtros, zonas, el historial del chat, "Sumá un lugar" de la votación,
      el checkout y el sheet de guardar. **Cierra de paso `PBETA-R2-09`** (el sheet "Sumá un lugar"
      sin forma visible de cerrarse) de los 33 no bloqueantes.
- [x] **FB-05 · 🟢 FEATURE chica — limpiar la búsqueda desde la home.** ✅ **Hecho 2026-08-08** (QA `FB-05-01..03`). ⚠️ *No es un gap del spec:*
      BUSQUEDA sí pide *"Limpiar todo"* y **está implementado** — en
      `components/search/filters-sheet.tsx:67`, dentro del sheet, y limpia **solo los tags**. Lo que
      no existe es volver al home limpio (zona + tags + `q` + gps de una). Hoy: sacar chip por chip
      en `ChipsActivos` o recargar. **Las dos piezas ya están**: `tieneBusqueda(params)`
      (`lib/search/params`) dice cuándo mostrarlo y `navegar(…, 'push')` lo aplica ⇒ ~10 líneas en
      `search-shell.tsx`.
- [x] **FB-06 · 🟢 FEATURE chica — el "ojito" en los campos de contraseña.** ✅ **Hecho 2026-08-08** (QA `FB-06-01..03`). Verificado: **8 campos
      en 5 archivos** (`login`, `registro` ×2, `restablecer` ×2, `cuenta` ×3) y **ninguno** tiene
      toggle. No hay un `Input` compartido en `components/ui/`, así que el trabajo real es crear
      `components/ui/password-input.tsx` (dueño único) y reemplazar los 8. **El detalle que lo puede
      romper**: conviven dos formas de conexión —`{...register('password')}` de react-hook-form y
      controlado con `value`/`onChange`— así que el componente necesita `forwardRef` + spread de
      props para servir a las dos.
- [x] **FB-07 · 🔵 DECISIÓN de copy — "Señal" no gusta, y de paso hay una inconsistencia.** ✅ **Hecho 2026-08-08** (QA `FB-07-01..03`). El
      hallazgo 5 del QA de DEPLOY F1 tenía razón en que son **tres** superficies, pero el reparto es
      2+1: `components/billing/suscripcion-panel.tsx:198` es **un solo dueño de copy que sirve a dos
      pantallas** (`/cuenta` y `/mi-negocio/[placeId]`) y `app/chat/chat-client.tsx:184-185` **tiene
      su propia copia**. Y no dicen lo mismo: el panel remata con el botón **«Avisame cuando abra»**
      y el chat con **«Dejar la señal»**. ⚠️ **Al cambiar la frase, unificar**: dos copias de un
      mismo copy driftean igual que dos copias de una regla.
      ✅ **DECIDIDO POR FER (2026-08-08): se unifica todo en «Avisame cuando abra»** — la frase que
      el panel ya usa y que ya pasó el QA de DEPLOY (`DEPLOY-10`/`DEPLOY-16`). "Señal" desaparece de
      la UI: el chat pierde su copia propia (CTA y cuerpo) y el remate pasa a **«Te avisamos apenas
      se pueda»**. La palabra puede seguir viva en nombres internos (`premium_interest`,
      `lib/billing/interes.ts`, comentarios) — lo que se cambia es **lo que el usuario lee**.

#### Tanda B — el de mayor valor: la curaduría necesita una puerta

📄 **Los dos ítems de abajo ya tienen spec escrito (2026-08-08):**
[`docs/specs/planned/CURADURIA_POR_NOMBRE.md`](../specs/planned/CURADURIA_POR_NOMBRE.md).
**El spec NO es la implementación** — los dos siguen sin hacer. Las 3 decisiones que faltaban están
cerradas ahí: (1) el buscador **no** pasa por `publishedWhere` —divergencia deliberada y declarada,
etiquetando con `isPlacePublished` en vez de reimplementar la regla—; (2) después de guardar en
modo por-nombre **se queda en el lugar** recargado del server con "Guardado ✓" (no hay "próximo"
sin cola, y limpiar de golpe repetiría el silencio que escondió a FB-10b); (3) el fix del precio
vale para **los dos** caminos. Orden: FB-10b primero (el piso), FB-10 después (la puerta).
⚠️ `npm run backup:db` antes de implementar y antes del QA — se escribe en `place_tags`.

- [x] **FB-10 · ✅ HECHO 2026-08-08 · 🟢 FEATURE (puerta de entrada, no mecanismo) — etiquetar un
      lugar buscándolo por nombre.** Confirmado que **el mecanismo está entero y no hay que tocarlo**:
      `guardarCuraduria(placeId, tags, precio)` (`lib/curation/acciones.ts:37`) **es agnóstico de la
      cola** —recibe un `placeId`, no depende de que haya sugerencias pendientes—, el endpoint
      `POST /api/admin/curaduria/[placeId]` ya existe con su gate de admin, y `RevisorLugar` ya
      contempla el caso sin cola (`Evidencia` renderiza *"Sin sugerencias pendientes con evidencia
      para este lugar"*). **Lo que falta es exactamente:**
      1. una hermana de `proximoLugarDeZona` (`lib/curation/query.ts:107`, hoy el **único** armador
         de `LugarEnCola`, y arranca de `place_tag_suggestions`) que arme el mismo objeto para un
         `placeId` arbitrario con `sugerencias: []` — reusa el mismo `Promise.all` sin la primera
         query;
      2. un buscador por nombre (endpoint + input). **Antes de escribir un `LIKE`**: el motor ya
         resuelve búsqueda por nombre con tolerancia a typos y acentos (`params.q`, decisión 15 de
         BUSQUEDA) — se mira `lib/search/query.ts` primero. ⚠️ Pero este buscador **no debe pasar
         por `publishedWhere`**: un lugar despublicado es justamente uno de los que hay que curar.
         Es una divergencia deliberada del dueño único de visibilidad y **hay que declararla en el
         spec**, no aplicarla en silencio;
      3. `RevisorLugar.onResuelto()` hoy llama a `traerProximo(zonaActiva)` — en modo por-nombre no
         hay zona y hay que decidir qué pasa después de guardar.
      **Destraba la curaduría de cobertura (#3 de la cola post-v2), que está gateada esperando esto.**
      ✅ **Implementado** en [`CURADURIA_POR_NOMBRE`](../specs/done/CURADURIA_POR_NOMBRE.md)
      ([resumen](../archive/SPECS_ARCHIVO.md#curaduria_por_nombre)): los 3 puntos salieron tal cual
      —`lugarParaCurar` reusa el armador, el buscador consume `lib/search/nombre.ts` (nada de `LIKE`)
      y **omite** el predicado de publicado usando `isPlacePublished` solo para etiquetar, y tras
      guardar se queda en el lugar releyéndolo del server. **La curaduría de cobertura ya no está
      gateada.**
- [x] **FB-10b · ✅ HECHO 2026-08-08 · 🔴 BUG encontrado durante el triaje (nadie lo reportó) —
      guardar en la curaduría BORRA el precio del lugar.** `guardarCuraduria` borra todas las `place_tags` con
      `source='admin'` de `FACETAS_EDITABLES`, que **incluye `precio`**
      (`lib/curation/acciones.ts:24`), y las re-inserta desde lo que manda el cliente. Pero
      `RevisorLugar` inicializa `const [precio, setPrecio] = useState<string|null>(null)`
      (`app/admin/curaduria-client.tsx:169`) — **siempre en "No sé", aunque el lugar ya tenga precio
      curado**, porque `LugarEnCola` ni siquiera trae ese dato. Guardar un lugar ya curado le borra
      el precio. **Hoy casi no muerde** (la faceta Precio tiene ~1 lugar en 18.993 y la cola quedó
      vacía tras CURADURIA F3), **pero FB-10 lo convierte en el camino principal**: "busco un bar,
      corrijo un tag, guardo" pasa a ser el gesto más común y se lleva el precio puesto. **Va en la
      misma tanda que FB-10, no después**: `LugarEnCola` tiene que traer el precio asignado y el
      editor inicializar el estado con él.
      ✅ **Arreglado** así: `LugarEnCola.precioSlug` se lee de `place_tags` ∩ faceta `precio` **sin
      filtrar por `source`** (un precio de dueño o de import también tiene que verse) y el editor
      arranca con él, por los **dos** caminos. Verificado con `SELECT` antes/después, no por
      pantalla — el bug era invisible justamente por eso (`CURNOM-10`..`CURNOM-14`).

#### Tanda C — operar la beta sin `psql` (los dos son `/admin`)

> ✅ **Los dos cerrados el 2026-08-08** en [`ADMIN_USUARIOS`](../specs/done/ADMIN_USUARIOS.md)
> (uno solo y no dos, porque comparten pantalla, tanda y el criterio de privacidad de su decisión 9).
> Resumen: [`SPECS_ARCHIVO § admin_usuarios`](../archive/SPECS_ARCHIVO.md#admin_usuarios).

- [x] **FB-01 · 🟢 FEATURE — sección de usuarios en `/admin` con premium a mano.** ✅ **2026-08-08**
      en [`ADMIN_USUARIOS`](../specs/done/ADMIN_USUARIOS.md)
      ([resumen](../archive/SPECS_ARCHIVO.md#admin_usuarios)): sexta tab **Usuarios**, cortesía B2C y
      B2B con motivo obligatorio y bitácora `plan_grants`. **Lo que se decidió sobre la duda de abajo:**
      el dueño de "otorgar cortesía" son `otorgarCortesia`/`revocarCortesia` **dentro** de
      `subscriptions.ts`, delegando el flag en `activarFlagDelPlan`/`bajarFlagDelPlan`. Verificado que
      **no existe**: `app/admin/tabs.tsx` tiene 5 tabs (Cola · Precios · Suscripciones · Costos ·
      Curaduría) y ninguna es de usuarios. **Lo que sí existe y hay que respetar**:
      `lib/billing/subscriptions.ts` se declara **dueño único** de `users.plan` y
      `places.owner_plan` (*"nadie más escribe los flags — se retiró el UPDATE documentado de
      AUTH/VOTACION"*), así que un botón que haga `UPDATE users SET plan='premium'` por su cuenta
      sería la segunda implementación de la regla. **La buena noticia es que el producto ya tiene el
      caso previsto**: `components/billing/suscripcion-panel.tsx:58-62` define el copy del **premium
      de cortesía** (*"Te activamos el Premium nosotros: no vence ni se cobra"*) y lo muestra cuando
      el plan es premium y no hay fila de suscripción. **Y se verificó que es estable aun con el
      cobro prendido**: `bajarFlagDelPlan` se llama **siempre desde una fila de `subscriptions`**
      (`vencimiento.ts:32` sobre la fila fresca, `webhook.ts:66` sobre la suscripción) ⇒ un usuario
      premium **sin** suscripción no lo toca nadie y no lo van a bajar a free por sorpresa. **Lo que
      falta decidir en el spec: quién es el dueño de "otorgar cortesía"** — se extiende
      `subscriptions.ts` con una función explícita, no se escribe el flag desde la ruta de admin.
- [x] **FB-03 · 🟢 FEATURE chica — copiar todos los mails de Suscripciones juntos.** ✅ **2026-08-08**
      en [`ADMIN_USUARIOS`](../specs/done/ADMIN_USUARIOS.md), decisión 12. **El gotcha se resolvió no
      mintiendo**: el botón rotula **«Copiar los N mails»** con la N de lo que copia de verdad, y el
      texto de arriba sigue explicando el total cuando difiere. Se descartó el endpoint que trajera la
      lista completa: hoy el total es de un dígito y, cuando no lo sea, el arreglo es **subir el tope**,
      no agregar una superficie de admin que devuelva PII ilimitada. Diagnóstico original:
      `app/admin/suscripciones.tsx` es server component y lista los mails en `<li>` de a uno; hace
      falta un botón cliente. ⚠️ **El gotcha**: `getInteresadosAdmin()` viene **topeado en 200** y
      el conteo real sale de `contarInteresados()` (por eso existen los dos, INT2-28) ⇒ "copiar
      todos" copiaría *los 200 más nuevos*, no todos. Hay que elegir: copiar los visibles **diciendo
      cuántos son**, o un endpoint que traiga la lista completa. Con el volumen de hoy da igual;
      escrito para que no sorprenda después.

#### Salidos de ADMIN_USUARIOS (2026-08-08) — dos frases que quedaron mintiendo

- [ ] **🔵 DOCS/COPY — «al bajar de plan se ocultan las fotos 4-15» no es cierto, y está en tres
      lugares.** La ficha publica **una sola** foto de dueño (`app/lugar/[id]/page.tsx` ⇒
      `ownerPhotos[0]`), así que `CAP_FOTOS` (3 free / 15 pago) gatea la **subida**, no la exhibición:
      revocar el plan de un lugar con 6 fotos no oculta ninguna (sí baja el cupo del panel a «6 de 3»
      y bloquea agregar). Hay que corregir: **(a)** la decisión 19 de
      [`MONETIZACION`](../specs/done/MONETIZACION.md), **(b)** el DoD y el copy de
      [`ADMIN_USUARIOS`](../specs/done/ADMIN_USUARIOS.md). El copy **que ve el admin** ya quedó
      corregido con OK de Fer (`app/admin/usuarios-client.tsx`, `textoConfirmacion`: ahora dice que
      el cupo baja a 3 y que **las que ya subió quedan**) — era lo único que le prometía al usuario
      algo que no ocurre. **Sigue abierta la decisión de fondo**: ¿se corrige la frase también en los
      specs, o se implementa el ocultamiento que prometía (que la ficha respete `CAP_FOTOS` al
      mostrar)? Lo verificado sí es real para los **3 campos pagos** y para las listas de favoritos.
- [ ] **🟢 CHICO — el comentario de `userPlanEnum` en `lib/db/schema.ts` quedó viejo.** Dice *"hasta
      el spec 7 solo cambia con un UPDATE a mano"*; desde MONETIZACION el `UPDATE` está prohibido y
      desde ADMIN_USUARIOS se cambia desde `/admin`. Señalado y no tocado por ser fuera de scope.
      `CLAUDE.md` § *Contenido del dueño y planes* ya quedó corregido.

#### Tanda D — decidir antes de tocar

- [x] **FB-02 · 🔵 DECISIÓN ya tomada (decisión 18 de BUSQUEDA) — los chips que "se prenden de a
      varios" NO son un bug.** ✅ **Hecho 2026-08-08** (QA `FB-02-01..05`). ⚠️ **Salió en dos vueltas:** el primer toggle (subconjunto) hacía que tocar un chip *tapado* apagara los dos y prendiera un tercero — lo cazó Fer probándolo. La regla final: **tapado ⇒ se promueve** (ver el comentario de `occasion-chips.tsx`). Mecanismo verificado en `components/search/occasion-chips.tsx:34`: un
      chip se marca aplicado cuando **todos** sus tags están puestos (`tags.every(...)`). «Primera
      cita» = `[bar, cafe, restaurante, tranqui, romantico]` **contiene** a «Cenar afuera» =
      `[restaurante]` y a «Un café» = `[cafe]` ⇒ los tres se prenden **por subconjunto**. La prueba
      de que el mecanismo es ese y no otro: «Tomar algo» = `[bar, cerveceria]` **no** se prende,
      porque le falta `cerveceria`. Es la decisión 18 funcionando: *tocar un chip aplica sus tags a
      la vista, no es un modo opaco*.
      **Pero el reporte igual señala algo real, y es peor que lo confuso**: tocar «Un café» —que se
      ve prendido— **saca** el tag `cafe` y deja «Primera cita» mutilada sin explicar nada.
      ⚠️ **Lo que pide Fer ("que un chip prenda solo ese") choca de frente con la decisión 18**: para
      que un chip tenga identidad propia, el chip —y no sus tags sueltos— tiene que vivir en la URL
      (`?chip=primera-cita`). Eso es **un cambio del modelo de estado de la búsqueda**, no un fix de
      UI, y toca el invariante de la decisión 12 (la URL es el estado).
      ✅ **DECIDIDO POR FER (2026-08-08): la regla es "si toco 1, se prende 1; si toco más, se van
      prendiendo más", sin tocar la URL.** ⚠️ Eso **no** es el marcado exacto de una línea que se
      había propuesto: con igualdad estricta, tocar «Cenar afuera» **y** «Un café» dejaría apagados
      a los dos (`[restaurante, cafe]` no iguala a ninguno de los dos chips). La regla que sí cumple
      lo pedido es **subconjunto maximal**: un chip se prende si sus tags ⊆ activos **y ningún otro
      chip prendido lo contiene estrictamente**. Verificado contra los tres casos: «Primera cita»
      sola ⇒ tapa a «Cenar afuera» y «Un café» y queda **solo ella**; «Cenar afuera» + «Un café» ⇒
      **prenden los dos** (ninguno contiene al otro); «Primera cita» + «Tomar algo» ⇒ **prenden los
      dos** (`cerveceria` los hace incomparables). Son ~6 líneas en `occasion-chips.tsx`, no una, y
      sigue sin tocar `SearchParams` ni la decisión 18.
      🔎 **Lo único a resolver al implementar**: hoy `estaAplicado` decide **dos** cosas — cómo se
      pinta el chip y qué hace el toque. Si se usa "maximal" para las dos, tocar «Cenar afuera»
      mientras está tapada por «Primera cita» no hace **nada** (botón muerto). Separarlas —pintar
      por maximal, **togglear por subconjunto**— hace que ese toque **saque** `restaurante` y
      despinte «Primera cita», que es coherente con "los tags son la verdad". **Elegir a conciencia
      y dejarlo escrito en el código**, no que salga solo.
- [x] **FB-04 · 🟢 FEATURE chica — botón de "centrarme" en el mapa.** ✅ **Hecho el 2026-08-08**
      con [`MAPA`](../specs/done/MAPA.md) ([resumen](../archive/SPECS_ARCHIVO.md#mapa)). Verificado
      en su momento:
      `components/search/map-view.tsx:93` agrega `NavigationControl` (zoom) y **no** hay
      `GeolocateControl`; `coords` llega al componente pero **solo alimenta la clave del fetch**
      (`:55`), no dibuja al usuario ni centra. Dos cosas a resolver: (a) el efecto de resultados hace
      `fitBounds` sobre los pins en cada cambio (`:200-204`), así que un "centrarme" queda **pisado
      por el próximo re-fetch** si no se coordina; (b) la decisión 17 de BUSQUEDA exige que el
      permiso de ubicación se pida **solo con un toque explícito** — el `GeolocateControl` nativo de
      MapLibre lo cumple (pide al tocarlo), así que la decisión no se viola si se usa ese.
      📝 **Spec escrito el 2026-08-08 → [`MAPA`](../specs/planned/MAPA.md)** (junto con
      `PBETA-R1-06`). Las tres decisiones quedaron cerradas ahí: (1) el gesto de cámara del usuario
      gana hasta que cambie la **búsqueda** —no las coordenadas—, (2) `GeolocateControl` nativo
      desacoplado del toggle «Cerca de mí», (3) en modo mapa se colapsa el buscador y los chips
      pasan a una fila scrolleable. **Las tres se implementaron tal cual.** El `GeolocateControl`
      nativo con `trackUserLocation: false`, un `useRef` que marca la cámara del usuario —limpiado por
      la clave **sin** coordenadas— y el bloque de búsqueda colapsado. QA: 12 criterios de DoD por
      checkers independientes + los 14 casos `MAPA-01..14` en vivo, con `MAPA-04` y `MAPA-07`
      **parciales declarados** (el re-fetch por coords no se puede provocar desde la UI: las
      coordenadas se piden una sola vez).

**Prioridad — aprobada por Fer el 2026-08-08:** arranca la **Tanda A completa** (FB-05, FB-06,
FB-07, FB-08, FB-09), sin spec. **FB-02 se suma a esa tanda** porque su decisión ya está tomada y
el costo quedó en ~6 líneas. **Tandas B, C y FB-04 quedan en cola sin fecha** — B es la que destraba
el ítem 3 de la cola post-v2 (curaduría de cobertura) y **amerita spec**; C también (FB-01 tiene que
decidir el dueño de "otorgar cortesía"). **Ninguna de las dos se abre hasta que Fer lo pida.**

### 🆕 Feedback posterior (fuera del lote de los 10)

- [x] **🔴 BUG — apagar un chip apaga otro y prende dos que nadie tocó** ✅ **Resuelto 2026-08-09**
      (QA `CHIP-01..12`, ver el cierre al final del ítem). Reportado por Fer,
      2026-08-09, usando la app. **Repro exacto, determinista:** tocar «Tomar algo» → tocar
      «Primera cita» (los dos quedan prendidos, correcto) → **apagar «Tomar algo»** ⇒ se apaga
      **«Primera cita»** y se prenden solos **«Cenar afuera»** y **«Un café»**.
      **Causa raíz, ya trazada contra el código** (`components/search/occasion-chips.tsx`, la rama
      "se ve prendido ⇒ apagarlo"): **apagar un chip saca TODOS sus tags, incluidos los que otro
      chip prendido está usando.** Con los tags reales — `tomar-algo = {bar, cerveceria}` ·
      `primera-cita = {bar, cafe, restaurante, romantico, tranqui}` · `cenar-afuera = {restaurante}`
      · `un-cafe = {cafe}` — apagar «Tomar algo» se lleva **`bar`**, que era también de «Primera
      cita»: sin él, «Primera cita» deja de estar completo y se apaga; y al apagarse deja de **tapar**
      a «Cenar afuera» y «Un café», cuyos tags siguen puestos, así que se pintan. Los tres cambios
      son consecuencia de un solo toque que pedía apagar **uno**.
      ⚠️ **Se dispara fácil: `bar` está en 7 de los 17 chips activos.** Cualquier combinación que lo
      toque lo reproduce.
      **No es un caso nuevo, es el mismo hueco por el otro camino.** El docstring del componente ya
      declara conocido que la **promoción** de un chip tapado "no trata de salvar a un tercer chip
      prendido que compartía tags" (decidido con Fer el 2026-08-08, FB-02). Eso se aceptó para un
      camino raro; acá está en el camino de **apagar**, que es el más común, y el efecto es peor:
      no solo se apaga un chip que nadie tocó, además **se prenden dos**.
      💡 **Arreglo candidato (a validar en la sesión que lo tome):** al apagar, sacar solo los tags
      que **no** pertenezcan a otro chip que siga pintado — `sacar = chip.tags − ⋃ tags(otros
      pintados)`. Con el repro: sacar `{bar, cerveceria} − {bar, cafe, restaurante, romantico,
      tranqui}` = **`{cerveceria}`**, y queda exactamente «Primera cita» prendido. Es la misma
      cortesía que la promoción ya hace en el otro sentido. **Falta decidir** qué pasa con un tag
      suelto que quedó de un chip y ya no lo representa (hoy queda visible y removible en
      `ChipsActivos`, que puede seguir siendo la respuesta correcta).
      🧪 **Y el QA que corresponde NO es clickear combinaciones a mano.** El pintado y el toggle son
      **funciones puras de `(chips, tags)`** que hoy viven dentro del componente: extrayéndolas a un
      módulo (`lib/search/` o al lado) se verifican las **17×17 = 289** combinaciones en un test, con
      un invariante que se escribe en una línea — **«tocar un chip cambia el estado pintado de ese
      chip y de ningún otro»** (con la excepción declarada del chip tapado, que se promueve). El caso
      de Fer lo viola tres veces en un solo toque. Eso convierte "hay comportamientos raros" en algo
      que el CI caza para siempre, que es justo lo que no pasó con FB-02.
      **Tamaño:** chico el fix, medio el QA exhaustivo. Sesión propia.

      ✅ **Cómo se cerró** (2026-08-09, sesión Opus). El arreglo candidato se validó y quedó tal
      cual: apagar saca `chip.tags − ⋃ tags(otros pintados)` — en el repro se va solo `cerveceria`
      y queda exactamente «Primera cita». Lo que **no** estaba previsto: el pintado y el toggle se
      extrajeron a **`lib/search/pintado.ts`** (dueño único, funciones puras, sin base ni DOM) y
      `occasion-chips.tsx` quedó de presentación — sin eso no había test posible. Las 289
      combinaciones se verifican en `lib/search/__tests__/pintado.test.ts` contra **seis**
      invariantes (nadie se prende de prepo · el toque hace lo que el chip muestra · apagar no
      apaga a otro · promover apaga solo a los que tapaban · prender no saca tags · ningún botón
      muerto), con los chips del **seed**, sin base. QA en `docs/qa/AnalisisQA.md` § *Bug de chips*:
      **APROBADO**, typecheck · **699/699** tests · QA en vivo del repro y de las dos regresiones de
      FB-02. **Las dos decisiones abiertas las cerró Fer:** el tag suelto **queda como está** (con el
      fix ya solo lo genera la promoción, y limpiarlo borraría un filtro que el usuario ve puesto), y
      el caso nuevo que destapó el barrido va al BACKLOG sin tocarse — es el ítem que sigue.

- [x] **🟠 Al prender un chip, la unión de tags puede completar a un tercero** — ✅ **Cerrado como
      decisión, 2026-08-10: NO se arregla.** Destapado por el barrido de las 289 el 2026-08-09,
      **no** por un usuario. «Cumpleaños» + «Tomar algo» completa a **«Salida con amigos»**
      (`bar, cerveceria, grupos-grandes`): se prende sin que nadie lo toque y, como **contiene** a
      «Tomar algo», deja tapado —visualmente apagado— al chip que se acaba de tocar. **12 de 289**
      combinaciones (6 pares, en los dos órdenes), **1** con el tocado tapado.
      **Por qué no era el mismo hueco que el 🔴 de arriba:** al apagar hay elección (qué tags sacar)
      y por eso se pudo arreglar; al prender no la hay —sumar los tags del chip es lo que lo
      prende— y ese tercer chip queda **genuinamente entero**. Mientras los tags sean el estado
      (decisión 18) y el pintado se derive de ellos, esconderlo pediría romper uno de los dos chips
      que el usuario sí quiere. Es una propiedad de la regla, no un descuido.

      ✅ **Cómo se decidió** (2026-08-10, sesión Fable de triaje — sin código). Se evaluaron cuatro
      opciones y ganó **no arreglar y documentar**, con el mismo criterio que el "bug de zonas" que
      era la decisión 5 tal como se especificó: costo cero, riesgo cero, y el comportamiento ya
      contenido por tests.

      **El dato que cerró la discusión** (medido sobre el seed, 2026-08-10): **"tapado" es la
      mecánica normal del pintado maximal, no la anomalía.** Con **un solo chip tocado**, 7 de los
      17 estados limpios ya dejan algún chip tapado (8 en total): `salida-con-amigos` y
      `after-office` tapan a `tomar-algo` · `primera-cita` tapa a `cenar-afuera` y `un-cafe` ·
      `cumpleanos` y `cena-familiar` tapan a `cenar-afuera` · `plan-tranqui` y `merienda` tapan a
      `un-cafe`.

      **Por qué se descartó cada alternativa:**
      - **Tercer estado visual para el chip tapado** — no señalizaría los 12 casos raros, pintaría
        el **camino feliz**: tocar «Primera cita» mostraría dos chips en estado intermedio, que es
        literalmente el reporte de FB-02 (*"se prenden de a varios"*) ya arreglado el 2026-08-08.
        Y distinguir "tapado normal" de "tapé al que acabás de tocar" exige saber **qué tocó el
        usuario** — o sea, exige la opción de abajo. No es una opción independiente.
      - **Que la URL lleve también qué chips tocó el usuario (`?c=` además de `?t=`)** — es el
        arreglo de verdad y el más caro: toca las decisiones **12 y 18**, el back y el link
        compartido, agrega a una URL pública un parámetro **puramente cosmético** (el server no lo
        usa: no cambia ni un resultado) y obliga a resolver tres reconciliaciones (`c` vs `t`
        contradictorios · link viejo sin `c` · tag sacado a mano en `ChipsActivos`). Desproporcionado
        para 12/289. El atajo "recordar el último chip tocado solo en memoria" es peor que ambas:
        rompe la decisión 12 —dos personas con la misma URL verían distinto, y recargar cambiaría
        el pintado—.
      - **Retocar los tags de los chips que colisionan** — inviable y al revés: `tomar-algo`
        (`{bar, cerveceria}`) está contenido **estructuralmente** en `salida-con-amigos` y en
        `after-office` sin que ninguna unión intervenga, así que romperlo exige sacarle `bar` o
        `cerveceria` a alguno — cambiar **qué lugares devuelve** un chip para arreglar cómo se ve un
        botón. Y la curaduría edita `occasion_chips` **sin deploy**: cualquier arreglo por tags se
        vuelve a romper solo en la próxima corrida.

      **Qué queda vivo, en concreto.** `al-aire-libre` es el disparador más común (8 de los 12
      casos), no `cumpleanos`. **En 11 de los 12 la UI no miente**: el chip que se prende de más
      tiene sus tags efectivamente puestos, así que la lista que se ve es la suya. **El único feo
      tiene salida en un toque**: en `cumpleanos` + «Tomar algo», volver a tocarlo lo promueve y
      queda solo él — no hay estado inalcanzable.

      🛡️ **Contenido en dos capas, y la curaduría no puede crear un caso nuevo en silencio por
      ninguna.** `lib/search/__tests__/pintado.test.ts` verifica que el que se prende de más esté
      **contenido en la unión** (la excepción se demuestra, no se tolera) e **inventaría por
      nombre** el único caso con el tocado tapado. Como esa red corre sobre el **seed** y no sobre
      la base, el otro flanco lo cubre `chips.integration.test.ts`, que compara código contra base:
      editar `occasion_chips` sin tocar el seed falla ahí.
      ♻️ **Disparador de reapertura** (escrito para no re-derivar el análisis): si un usuario real lo
      reporta, o si la curaduría hace que los dos chips de un caso caigan juntos entre los **4 de la
      home**, se reabre y se va **directo a `?c=`** — las otras dos alternativas ya están evaluadas
      y descartadas.
      📏 **El segundo disparador, MEDIDO el 2026-08-10** (se escribió como condición a futuro y nunca
      se había verificado contra la portada real): **está a 0, y el fix del piso por zona no lo
      movió**. Los 12 casos son estas secuencias, y **ninguna es alcanzable tocando solo la
      portada** — ni sin zona ni en ninguna de las 46 zonas, porque **los 12 necesitan al menos un
      chip que hoy vive detrás de "Ver más"** (`cumpleanos`, `al-aire-libre`, `plan-tranqui`,
      `primera-cita`, `after-office`, `salida-con-chongo`; ninguno es `in_home`):
      `cumpleanos ↔ tomar-algo ⇒ salida-con-amigos` · `cumpleanos ↔ after-office ⇒ salida-con-amigos`
      · `cumpleanos ↔ al-aire-libre ⇒ salida-con-amigos` · `al-aire-libre ↔ {salida-con-chongo,
      primera-cita, plan-tranqui} ⇒ tomar-algo` (y sus simétricas). O sea el caso pide abrir "Ver
      más" **y** tocar dos chips específicos: la decisión de no ir a `?c=` sigue en pie, ahora con
      número en vez de con criterio.
      ⚠️ **Cómo NO medirlo** (se hizo mal primero y daba 6 zonas expuestas): contar los pares cuya
      **unión de tags completa** a un tercer chip sobreestima, porque un tercero contenido en el que
      se tocó queda **tapado** por el maximal y no se ve prendido — que es la mecánica normal, no la
      anomalía. Hay que simular la secuencia real (`tagsAlTocar` y después `chipsPintados`) y contar
      solo lo que **queda pintado** sin haberse tocado. Es la misma cuenta que el barrido de
      `pintado.test.ts`: si da distinto de **12**, la medición está mal, no el código.

- [x] **🟠 `salida-con-chongo` devuelve 1 solo lugar en todo AMBA — redefinirlo (opción C, decidido
      con Fer el 2026-08-10).** Reportado por Fer usando la app: *"queda medio feo que alguien lo
      toque y le devuelva 1 solo lugar; pensaría que esto no funciona o es una porquería"*.
      **La sospecha inicial —que lo angostaba `wine-bar`— quedó refutada por los datos: sin
      `wine-bar` el chip daría 0.** Ese único lugar **es** un wine bar; `wine-bar` está en la misma
      faceta que `bar` y entra por **OR**, así que solo puede sumar.
      **Causa real: el AND entre tres facetas**, con dos casi vacías. `(bar OR wine-bar)` **AND**
      `romantico` **AND** `hasta-tarde` ⇒ embudo **2.806 → 12 → 1**. `romantico` tiene **71**
      lugares sobre 18.993 publicados (**0,4%**) y `hasta-tarde` **173** (0,9%). Y no es del tag:
      **la faceta Ambiente entera está al 1%** — su tag más poblado es `wifi-trabajar` con 201.
      Cualquier chip que cruce Ambiente con Momento va a dar números de un dígito.

      **Lo decidido — opción C, "ambiente ancho":**
      `(bar | wine-bar)` **AND** `(romantico | speakeasy | con-vista | terraza-rooftop | bar-notable)`
      ⇒ **35 lugares** en AMBA (de 1). Saca la faceta **Momento**, que era la que lo mataba, y
      amplía `romantico` a sus ambientes hermanos — lo que un chongo busca es un lugar **lindo**, no
      uno que cierre tarde.
      **Medido el 2026-08-10 contra la base de dev** (18.993 publicados, umbral 0.5): hoy **1** ·
      sin `hasta-tarde` **12** · sin `romantico` **56** · **C 35** · solo `(bar|wine)` **2.806**.
      **Ninguna definición que conserve las tres facetas supera 6.**
      **Por qué C y no la de 56** (`(bar|wine) + hasta-tarde`): da más, pero deja el chip como "un
      bar abierto hasta tarde" — indistinguible de `tomar-algo` (`bar, cerveceria`) y sin lo que lo
      hacía distinto. C conserva el significado, que es lo que un chip de ocasión vende.

      **Alcance del trabajo** (sesión Opus corta, no es spec — es curaduría de un chip):
      1. `lib/db/chips.ts` — los tags de `salida-con-chongo`.
      2. **Reseed dirigido**: editar el seed NO alcanza, `occasion_chips` vive en la base
         (`chips.integration.test.ts` compara código contra base y va a fallar hasta sincronizar).
      3. Re-correr **`pintado.test.ts`**: cambiar los tags de un chip puede mover el inventario de
         los 12 casos de la rama `prender` (el ítem cerrado arriba). Si aparece uno nuevo, el test
         lo dice por nombre — es la red funcionando, no una regresión.
      4. **Dos docs quedan desactualizados y hay que tocarlos**: el docstring de `PISO_HOME` en
         `lib/search/chips.ts` dice *"no hay ningún chip entre 2 y 37"* — con C el chip cae en **35**,
         justo en esa franja, y **vuelve a la home** (sort 1); y `CLAUDE.md` § *Notas importantes*
         cita a `salida-con-chongo` con "1 lugar" como ejemplo del piso.
      ⚠️ **Antes de decidir si vuelve a la home, mirar el ítem de abajo**: con 35 en AMBA da 3-6 por
      zona, o sea queda igual de expuesto que `salida-con-amigos`. Dejarlo en "Ver más"
      (`in_home = false`) hasta que eso se resuelva es una salida válida — y con CHIPS_ROTACION,
      `in_home` ya no es "candidato a la home" sino "candidato **por defecto**", así que una regla de
      `chips.schedule` podría adelantarlo igual.

      ✅ **HECHO el 2026-08-10.** Los tags quedaron en `lib/db/chips.ts` y se sincronizó la base con
      un reseed dirigido (borrar los `chip_tags` de **ese** chip —nunca la fila de `occasion_chips`,
      que se llevaría puesto su `active`— y correr `npm run db:seed`, que al ver 0 filas inserta los
      nuevos). **Verificado contra la base: 35 en AMBA**, de 1.
      **Se quedó en "Ver más" (`inHome: false`)**, decidido con Fer: pasa `PISO_HOME` pero el dato
      que faltaba lo desaconseja — esos 35 dan **0 en 18 de las 46 zonas** y el techo por zona es
      **6** (Retiro 6 · Palermo Soho 5 · Monserrat 5 · el resto 1-4), o sea el problema reportado
      vuelve por la ventana en cuanto el usuario elige zona. Vuelve a la home cuando se resuelva el
      ítem 🔵 de abajo; es un flag del seed, sale gratis.
      **Redes:** `pintado.test.ts` 12/12 — **ningún caso nuevo** en la rama `prender`, o sea el
      inventario de chips que se prenden de más no se movió — y `chips.integration.test.ts` 16/16
      (código vs base, la prueba de que el reseed funcionó). Suite completa 699/699 + typecheck.
      **Efecto lateral en los docs, ya aplicado:** con `salida-con-chongo` en 35, **ningún chip queda
      hoy en la franja "más de 0 pero menos de `PISO_HOME`"** (medido: o dan 0 —`plan-tranqui`— o
      dan 35+). El piso se quedó **sin caso vivo**; se actualizó su docstring en `lib/search/chips.ts`
      y el bullet de `CLAUDE.md` que lo citaba con "1 lugar".

- [x] **🔵 → ✅ HECHO el 2026-08-10 (`fix(BUSQUEDA)`, NO spec) — el piso de los chips se medía en
      AMBA, pero el usuario busca por zona.** Destapado el 2026-08-10 investigando el chip de arriba;
      **no** es de ese chip. **El diseño cerrado está al final del ítem**; lo de acá abajo es el
      análisis que llevó a él.
      `PISO_HOME = 20` (`lib/search/chips.ts`) existe para que un chip flaco no ocupe la portada, y
      su propio docstring dice que *"el problema real es la división por zona"* — pero **cuenta sin
      zona**. Resultado, medido el 2026-08-10:

      **La matriz completa — 16 chips vivos × 46 zonas activas, medida el 2026-08-10** con el mismo
      criterio que usa el motor (`place_zones` cualquiera, no la primaria, y `zones.active`). Los 5
      que pueden ocupar la home están arriba de la línea:

      | Chip | AMBA | zonas en **0** | mejor zona | mediana por zona | zonas con ≥ 20 |
      |------|-----:|-----:|-----:|-----:|-----:|
      | `salida-con-amigos` (home, sort 0) | 38 | **16** | **3** | 1 | **0** |
      | `salir-a-bailar` (home, sort 2) | 586 | 0 | 93 | 10,5 | 16 |
      | `after-office` (home, sort 3) | 171 | 0 | **13** | 5 | **0** |
      | `tomar-algo` (home, sort 9) | 3.219 | 0 | 269 | 77 | 46 |
      | `cenar-afuera` (home, sort 10) | 11.438 | 0 | 901 | 257,5 | 46 |
      | — | | | | | |
      | `salida-con-chongo` | 35 | 18 | 6 | 1 | 0 |
      | `primera-cita` | 187 | 1 | 22 | 5 | 1 |
      | `cumpleanos` | 246 | 0 | 31 | 7 | 3 |
      | `cena-familiar` | 107 | 2 | 7 | 3 | 0 |
      | `merienda` | 176 | 1 | 24 | 4 | 1 |
      | `un-cafe` | 2.058 | 0 | 307 | 40,5 | 39 |
      | `musica-en-vivo` | 1.023 | 0 | 76 | 25,5 | 31 |
      | `teatro-y-cultura` | 603 | 0 | 117 | 11 | 13 |
      | `catas-y-vinos` | 229 | 2 | 26 | 5 | 2 |
      | `jugar` | 226 | 0 | 18 | 6 | 0 |
      | `al-aire-libre` | 101 | 3 | 6 | 2 | 0 |
      | `plan-tranqui` | 0 | 46 | 0 | 0 | 0 |

      ⚠️ **El hallazgo que reordena la decisión: `PISO_HOME` aplicado por zona vaciaría la home de
      chips de ocasión.** Mirar la última columna de los candidatos: `salida-con-amigos` llega a 20
      en **cero** zonas (su mejor es **3**) y `after-office` también en **cero** (mejor **13**). O sea
      la salida que parecía obvia —*contar con la zona activa y aplicar el mismo piso de 20*—
      dejaría la portada, en casi toda zona, con `salir-a-bailar` + los genéricos V1 (`tomar-algo`,
      `cenar-afuera`, `un-café`), que son **Tipo puro**: la home perdería justo lo que un chip de
      *ocasión* aporta. **Cualquier opción que se elija tiene que decir qué pasa con esto** — un piso
      por zona distinto del de AMBA, un orden por conteo en vez de un corte, o aceptar la home
      genérica.
      ⚠️ **Y el peor no es el que motivó todo esto**: `salida-con-amigos` está **primero** en la home
      (sort 0) y es **peor por zona que `salida-con-chongo`**, al que se acaba de sacar de la home
      por flaco (mejor zona 3 vs 6; 16 zonas en 0 vs 18, pero con la mitad de techo). Las 16 donde
      da **0** incluyen las más obvias para salir: **Retiro-Microcentro, Recoleta,
      Monserrat-Congreso, Puerto Madero, Las Cañitas, La Boca-Barracas**, más Olivos-Vicente López,
      Martínez-Acassuso, San Isidro-zona norte (Escobar, Monte Grande), Saavedra, San Justo, Moreno,
      Ituza-ingó, Adrogué-Burzaco y Lomas de Zamora-Banfield.
      💡 **Dato de contexto para elegir:** el problema **no** es transversal al catálogo. Los
      chips genéricos aguantan cualquier zona (`cenar-afuera` mediana **257**, `tomar-algo` **77**);
      los que se caen son los de **ocasión con faceta Ambiente o Momento**, que es la misma escasez
      de curaduría que ya arregló `salida-con-chongo` por definición. **Redefinir
      `salida-con-amigos` —como se hizo con chongo— puede ser más barato que cambiar el piso**, y
      es la opción que **no** estaba en la lista de abajo.

      O sea el síntoma que reportó Fer —*"toco un chip y no hay nada, esto no anda"*— **ya está
      pasando desde la portada, con otro chip**, y subir el piso no lo arregla porque el piso mide
      el catálogo entero. Es la decisión **25** (*el conteo es del catálogo, no del contexto*) y la
      **23** (*el vacío rescata*) chocando en la práctica.
      **Lo que hoy sí cubre:** el estado vacío de `search-shell.tsx` (*"No encontramos nada con eso —
      Sacá alguno de los chips de arriba o ampliá la zona"* + nota de beta) no es una pantalla
      muerta. **Lo que no cubre: 1 resultado**, que no dispara ese copy y deja una lista raquítica
      sin ninguna explicación — que es exactamente lo que vio Fer.
      **Opciones a evaluar en el spec** (ninguna decidida): contar los chips **con la zona activa**
      (el mismo trabajo que ya hace el botón "Ver N lugares", pero cambia la decisión 25 — y ojo con
      el hallazgo de arriba: con el mismo piso de 20 vacía la home) · mostrar el conteo en el propio
      chip · subir el piso · extender el copy de rescate a "muy pocos resultados", no solo a cero ·
      **redefinir los chips flacos uno por uno** (lo que se le hizo a `salida-con-chongo`: no toca
      código de la home, solo `lib/db/chips.ts` + reseed dirigido) · **ordenar por conteo en la zona
      en vez de cortar por un piso** (la home siempre llena sus 4, con los mejores que haya ahí).
      **Decidido con Fer el 2026-08-10: anotar con los números medidos y no escribir el spec
      todavía** — mismo criterio que el `?c=` del ítem de arriba. **La medición ya está hecha**
      (matriz completa arriba, sesión Opus del 2026-08-10), así que la sesión que lo tome arranca
      decidiendo, no midiendo. El SQL que la produjo no quedó versionado — es una consulta de
      análisis, no una red; para rehacerla: por cada chip activo, AND entre facetas de sus
      `chip_tags`, cruzado con `place_zones` × `zones.active`.

      ---

      ✅ **DECIDIDO con Fer el 2026-08-10 (sesión Opus, sobre la matriz de arriba — se decidió, no se
      volvió a medir). Reemplaza el "no escribir el spec todavía" del párrafo anterior.**

      **Qué se hace: el conteo del chip pasa a ser contextual, y el piso deja de ser uno solo — son
      dos, según haya zona o no.**

      | Estado de la home | Gate para los 4 de la portada | Gate para "Ver más" |
      |---|---|---|
      | **Sin zona** (primera visita, y modo GPS) | `count(AMBA) >= PISO_HOME` (**20**, como hoy) | `count(AMBA) > 0` (como hoy) |
      | **Con zona elegida** | `count(zona) >= PISO_ZONA` (**3**, nuevo) | `count(zona) > 0` |

      **Por qué dos pisos y no uno.** Los dos gates responden preguntas distintas y por eso no pueden
      compartir número. Sin zona, el conteo mide una **propiedad del catálogo**: *¿este chip tiene
      espalda para ser un atajo de la portada?* — 20 es el umbral correcto para eso y no se toca. Con
      zona, mide una **propiedad del contexto**: *¿este atajo devuelve algo acá?* — y ahí 20 es
      absurdo, porque ningún chip de ocasión llega a 20 en ninguna zona.

      **Cómo responde el hallazgo 1** (⚠️ el que reordenaba la decisión): el hallazgo no dice *"no
      apliques piso por zona"*, dice *"no apliques **20** por zona"*. Con **3**, la portada conserva
      sus chips de ocasión: `after-office` (mediana por zona **5**, mejor **13**) sobrevive en la
      mayoría de las zonas y `salir-a-bailar` (mediana **10,5**) en casi todas. La home genérica de
      solo-Tipo que el hallazgo advertía **no ocurre**.

      **Cómo responde el hallazgo 2** (`salida-con-amigos`, `sort` 0, peor que el chip que se acaba de
      sacar): **se resuelve solo, sin tocarle los tags**. Con mediana **1** y mejor zona **3**, se cae
      de la portada exactamente en las zonas donde miente (las 16 en 0 y todas las de 1-2) y se queda
      donde tiene algo. Redefinirlo por curaduría —la opción barata, precedente de `salida-con-chongo`—
      **deja de ser necesaria para cerrar este ítem**; queda como mejora independiente y no
      bloqueante, porque 38 en todo AMBA sigue siendo flaco para el `sort` 0.

      **Por qué NO se ordena por conteo en la zona** (la opción `f` de la lista de arriba, evaluada y
      descartada): los candidatos a home son **6 para 4 lugares**, y ordenados por conteo dan siempre
      `cenar-afuera` (901) · `tomar-algo` (269) · `un-café` · `salir-a-bailar`. O sea `salida-con-amigos`
      y `after-office` quedarían afuera **en toda zona y siempre** — es el hallazgo 1 pero permanente
      en vez de ocasional. El `sort` es intención de curaduría (los de ocasión primero) y ordenar por
      volumen la pisa.

      **Por qué el gate con zona no es `> 0` a secas** (evaluado y descartado): lo que Fer reportó no
      fue 0 resultados, fue **1**. Con `> 0`, `salida-con-amigos` —mediana **1** por zona— seguiría
      **primero** en la portada devolviendo un solo lugar en media AMBA, que es literalmente el
      síntoma original. **3 es el mínimo que no se lee como "esto está roto"**; subirlo a 5 es cambiar
      una constante si con el uso real se ve que hace falta.

      **Enmienda explícita a la decisión 25 de BUSQUEDA** (*"el conteo es del catálogo, no del
      contexto"*): pasa a ser **"el conteo es del catálogo mientras no haya contexto; cuando lo hay,
      es del contexto"**. La decisión 25 se escribió para que un chip no desapareciera por una
      búsqueda en curso; lo que la práctica mostró es que el atajo que miente es peor que el atajo que
      no está. La decisión **23** (*el vacío rescata*) sigue cubriendo el caso de 0, ahora como red y
      no como plan A.

      **Dos detalles que la implementación tiene que llevar sí o sí** (destapados leyendo el código,
      no estaban en el análisis original):
      1. **Un chip pintado se muestra SIEMPRE, exento del gate contextual.** Si tocás
         «Salida con amigos» en Palermo y después cambiás la zona a Retiro, con el gate a secas el
         chip se iría de la fila **con sus tags todavía aplicados**: perdés el toggle para apagarlo
         (quedan removibles en `ChipsActivos`, pero el `aria-pressed` desaparecido es una regresión
         del pintado). El dueño de qué se pinta es `lib/search/pintado.ts` — la excepción se coordina
         con él, no se reimplementa.
      2. **En modo GPS el conteo sigue siendo el de AMBA.** Las coordenadas no viajan en la URL (son
         del dispositivo que mira, no del que compartió el link, `params.ts`), así que el server no
         tiene contexto geográfico que aplicar. Es la fila "sin zona" de la tabla, y es correcto:
         mejor el gate del catálogo que uno inventado.

      **El contexto son las zonas, no la búsqueda entera**: `q` (texto libre) y los tags ya activos
      **no** entran en el conteo del chip. Cruzar el chip con los tags activos lo convertiría en un
      refinamiento de la búsqueda en curso, que es otra feature; acá se arregla "la home pide zona
      primero".

      **Alcance del trabajo — es un `fix`, no un spec.** Puerta de ida y vuelta: no hay migración ni
      dato, revertir es revertir un commit.
      1. `lib/search/chips.ts` — `getOccasionChips(now, zones = [])`, pasar `zones` a los
         `countPlaces` (los 17 ya corren en paralelo: **no suma round-trips** y las queries quedan más
         chicas), `PISO_ZONA = 3` con su docstring, y el gate según `zones.length`.
      2. `app/page.tsx:52` — pasarle `params.zones`. **Es el único caller.** La home es server
         component y ya se re-renderiza en cada navegación: elegir zona *es* una navegación, así que
         el recuento ocurre sin agregar nada.
      3. `lib/search/pintado.ts` + `components/search/occasion-chips.tsx` — el detalle 1 de arriba.
      4. `lib/search/__tests__/chips.integration.test.ts` — los tests ya pasan `now`, así que el
         parámetro opcional no rompe ninguno. Casos nuevos: con zona donde un chip da 0 no aparece ·
         con zona donde da 1-2 no está en la portada pero sí en "Ver más" · sin zona el
         comportamiento es idéntico al de hoy · un chip pintado se muestra aunque dé 0 en la zona.
         Correr también `pintado.test.ts` (toca su terreno).
      5. **Docs a actualizar en el mismo commit**: el docstring de `PISO_HOME` en `lib/search/chips.ts`
         (hoy dice que el piso "se cuenta sin zona" como limitación abierta) y el bullet de
         `CLAUDE.md` § *Notas importantes* que describe el piso — el `(b)` de ese bullet cambia de
         forma con esto.
      6. **Queda desbloqueado, como decisión aparte**: `salida-con-chongo` puede volver a
         `inHome: true` (`lib/db/chips.ts`) — con el gate contextual, sus 18 zonas en 0 dejan de ser
         un problema. **No se hace junto con el fix**: con 6 candidatos para 4 lugares ya hay cola, y
         su techo por zona es 6, así que entraría a la portada en pocas zonas. Evaluarlo después de
         ver el fix andando.

      ---

      ✅ **IMPLEMENTADO el 2026-08-10** (sesión Opus). Los 6 puntos del alcance, hechos tal cual,
      con **una divergencia de forma** sobre el punto 3, explicada abajo.
      **Código**: `getOccasionChips(now, zones = [], tagsActivos = [])` (`lib/search/chips.ts`) —
      `zones` entra en los 17 `countPlaces` que ya corrían en paralelo, `PISO_ZONA = 3` con su
      docstring, y `const piso = conZona ? PISO_ZONA : PISO_HOME` aplicado tanto al corte de la
      portada como —vía `count > 0`— al de "Ver más". `app/page.tsx` (único caller) le pasa
      `params.zones` y `params.tags`.
      **Divergencia sobre el punto 3**: la exención del chip pintado **no se pudo hacer en el
      cliente**. El gate corre en el server y **filtra la lista antes de que viaje**, así que un
      chip exento tiene que sobrevivir ahí o `occasion-chips.tsx` no lo tiene para dibujar. Por eso
      `chips.ts` **importa `chipsPintados` de `pintado.ts`** —lo consulta, no lo reimplementa, que
      es lo que el detalle 1 pedía— y para eso `getOccasionChips` recibe también `tagsActivos`. Los
      dos archivos del punto 3 se tocaron igual, pero solo en sus docstrings (`pintado.ts` decía
      *"esto corre en el cliente"* y ahora corre en los dos lados). **La exención está atada a que
      haya zona**: sin zona no exenta a nadie, para que el comportamiento de la primera visita sea
      idéntico al de antes.
      **Verificado en la base real** (`retiro-microcentro`, una de las 16 zonas donde
      `salida-con-amigos` da 0): sin zona la home no cambia —`salida-con-amigos(38)`,
      `salir-a-bailar(586)`, `tomar-algo(3.219)`, `cenar-afuera(11.438)`—; con Retiro
      `salida-con-amigos` **desaparece de los dos lados** y `un-cafe(307)` ocupa su lugar; y con sus
      tags puestos vuelve a la portada con `count 0`, conservando el toggle. Los conteos que viajan
      al cliente son los de la zona (57 / 248 / 901), no los de AMBA.
      **Tests**: 5 casos nuevos en `chips.integration.test.ts` (los 4 del punto 4 + que sin zona los
      tags activos no cambien nada). Buscan su caso en la base en vez de hardcodearlo —la curaduría
      lo mueve— y exigen `count(AMBA) > 0` para que `plan-tranqui`, que da 0 en todos lados, no los
      haga pasar sin probar nada. Suite completa verde sin tocar ningún test existente;
      `pintado.test.ts` sigue con sus 12 casos, el inventario de las 289 combinaciones no se movió.
      **Docs**: docstrings de `PISO_HOME` (la limitación que declaraba abierta queda cerrada),
      `PISO_ZONA`, el encabezado de `chips.ts` con la enmienda a la decisión 25, `pintado.ts`,
      `occasion-chips.tsx` y el bullet del piso en `CLAUDE.md` § *Notas importantes*.
      **Queda abierto, chico y aparte** (además del punto 6): el chip **«Para ahora»** sigue
      contándose en AMBA aunque haya zona — el alcance decía "los 17" y ese es el 18°, con su propia
      decisión 9 en ABIERTO_AHORA. Es el mismo gate y el mismo riesgo (prometer una franja que en
      esa zona da 0); pasarle `zones` es una palabra, pero es decisión de ese spec, no de este fix.

- [ ] **FB-11 · ⚠️ EXTERNO — Google Play Protect bloquea la instalación de la PWA.** Reportado el
      **2026-08-08** por un conocido de Fer (origen distinto al lote de los hermanos): al instalar
      sale *«Se bloqueó la app no segura — Esta app se diseñó para una versión anterior de Android,
      por lo que no incluye las protecciones de la privacidad más recientes»*. **No entra en las 4
      categorías del triaje** (🔴 bug · 🟠 cobertura · 🔵 decisión · 🟢 feature): no es código
      nuestro.
      **Verificado el mismo día contra producción** (no contra el reporte): `manifest.webmanifest`
      devuelve 200 con `application/manifest+json`, los 3 íconos y HTTPS con HSTS; el nombre del
      diálogo —«A dónde salimos»— es exactamente el `short_name` de `app/manifest.ts:20` y el ícono
      es nuestro maskable ⇒ **lo bloqueado es nuestra PWA**, en el paso de instalarse.
      **Mecanismo:** Chrome no instala el sitio — le pide un **WebAPK** al servidor de minting de
      Google, que lo genera y lo firma; el cartel es el que tira Android cuando un APK declara un
      `targetSdkVersion` viejo. **Ese campo vive en un APK que nosotros no construimos**: no hay
      nada en el manifest, los íconos ni los headers que lo determine, así que **no hay fix de
      código** que se pueda intentar.
      ⚠️ **El usuario confirmó que usó Chrome**, así que **se cae la hipótesis benigna** (un
      navegador que arma su propio APK viejo en vez de pedir el WebAPK). Si es reproducible, le
      pasa a **todo el que tenga esa versión de Android**, no a ese teléfono.
      📊 **Los datos llegaron el 2026-08-08 y dan vuelta la hipótesis.** El que no puede
      instalar está en **Android 16**; Fer, que **sí la tiene instalada**, está en **Android 12 con
      Chrome 150.0.787**. O sea: no es un teléfono que se quedó atrás, es un Android **nuevo**
      rechazando el APK que Google genera por nosotros. Encaja con el mecanismo —cada versión de
      Android sube el piso de `targetSdkVersion` que acepta instalar—, así que la pregunta ya no es
      "qué le pasa a ese teléfono" sino **¿le pasa a todos los Android 16?**: si es que sí, el
      problema **crece solo** a medida que la gente actualiza. **Sigue siendo 1 contra 1**, y el lado
      de Fer tiene un agujero **confirmado con fecha**: su `chrome://webapks` muestra el WebAPK genuino de
      Google (`org.chromium.webapk.a15ecbb8378979587_v2`, `Owning Browser: com.android.chrome`) con
      **`Shell APK version: 189`** y **`Last Update Completion Time` en epoch cero**: *nunca se
      actualizó* desde que lo instaló. El chequeo del 07/08 dio `Succeeded` sin cambiar nada porque
      **un WebAPK solo se re-genera si cambia el manifest**, y no lo tocamos — o sea que su teléfono
      **no está probando el APK que Google emite hoy**. La forma barata de mirarlo es el botón
      **`Update`** de esa misma pantalla —fuerza el re-minting sin desinstalar—, no reinstalar. (Nadie
      sabe acá a qué fecha corresponde el shell 189 ni cuál es el actual: el valor del experimento es
      **medir** el número de hoy, no interpretar el viejo.)
      ❌ **Vía descartada el 2026-08-08 — "actualizar el `targetSdkVersion`"** (la sugerencia que
      circula para este cartel). **No aplica y no hay dónde aplicarla**: `grep` de `bubblewrap` /
      `targetSdk` / `trusted web` / `assetlinks` sobre `app/`, `lib/`, `scripts/`, `public/` y
      `package.json` devuelve **cero**, y no hay `android/`, ni `twa/`, ni gradle. Ese consejo es para
      quien **empaqueta** su app (TWA/Bubblewrap) y tiene ese archivo; acá el APK es el **WebAPK que
      firma Google**. Aplicarlo exigiría convertirse primero en eso —y **ni siquiera arreglaría lo
      roto**: seguiría fallando instalar desde el navegador; sería reemplazar esa vía por la Play
      Store, que es otra decisión y más cara. **No volver a proponerla sin datos nuevos.**
      🔎 **Lo que falta ahora**, de más barato a más caro: (1) `chrome://webapks` en los dos
      teléfonos —la única mirada directa al APK que Google emitió—; (2) desinstalar y reinstalar en el
      de Fer, para forzar un WebAPK generado **hoy**; (3) **un segundo Android 15/16**, que es lo que
      convierte la anécdota en un patrón. Un diagnóstico más, de último recurso: apagar Play Protect
      un minuto confirma que el bloqueo es suyo — **no es algo para pedirle a un usuario común**.
      ✅ **Decisión de Fer (2026-08-08): queda acá, no se hace nada.** Es **un** usuario y **no
      bloquea el uso de la app** —anda en el navegador; lo bloqueado es el atajo instalado—. Se cierra
      la investigación con lo aprendido escrito. **Lo que la reabriría:** un segundo caso en Android
      15/16. Si eso pasa, empezar por las pruebas de abajo, no por proponer un APK propio.
      ⚖️ **Qué decide cada resultado:** si le pasa **solo a él**, queda anotado y no se toca nada; si
      le pasa a **todo Android 16**, la Play Store (TWA) pasa de "puerta de ida que no hace falta" a
      opción real —y aun así habría que medir cuánta gente de la beta está en Android 16 antes de
      pagarla. **Nadie verificó desde acá el estado del servidor de minting de Google**: si es
      sistemático, es un problema de ellos que se arregla de su lado.
      **Impacto acotado**: la app **anda igual en el navegador** — el bloqueo es del atajo
      instalado, no del sitio. Pero pega en el embudo de instalación de la beta.
      🚫 **Qué NO hacer sin decidirlo antes:** (a) tocar `app/manifest.ts` "por las dudas" — un
      manifest no tiene campo de `targetSdk`, no hay nada que subir ahí; (b) publicar un APK propio
      (TWA en Play Store) como reacción: es **puerta de ida** —cuenta de desarrollador, US$25,
      políticas de Play y una segunda superficie que mantener— y hoy no hay evidencia de que haga
      falta. **Sin decidir qué se hace hasta tener la versión de Android.**

---

## Mejoras futuras (fuera de v1)

### Deuda técnica señalada, no tocada

- [x] **`sembrarChips` ya re-sincroniza los tags de un chip que existe** ✅ **2026-08-10** — `scripts/seed-chips.ts` (extraído de `seed.ts` para poder testearlo, mismo criterio que `scripts/overture/upsert.ts`) borra los tags que sobran e inserta los que faltan, y **solo escribe si hay diferencia**: un re-seed sobre una base al día informa «tags al día» y no toca una fila. Cubierto por `scripts/__tests__/seed-chips.integration.test.ts` (7 casos), incluido el que reproduce el bug: *redefinir los tags de un chip que ya existe los reemplaza de verdad* — verificado por mutación, devolverle el `if (n === 0)` lo hace fallar. `active` sigue sin tocarse: es curaduría. 
      <details><summary>Por qué existía la deuda (registro)</summary>

      **`sembrarChips` no podía re-sincronizar los tags de un chip que ya existe — y por eso una
      redefinición se olvida** (destapado por el QA en producción del 2026-08-10). `scripts/seed.ts`
      hace `if (n === 0)` antes de insertar en `chip_tags`: si el chip ya tiene tags, **los deja como
      están**. La fila del chip sí se upsertea (`name`, `in_home`, `sort`), así que un re-seed deja el
      chip **medio actualizado**, que es peor que no actualizarlo: sale de la home pero sigue
      ofreciendo la combinación vieja detrás de «Ver más».
      **No es teórico, ya costó:** `c8aac77` redefinió `salida-con-chongo` (de 1 lugar a 35) y su
      propio mensaje dice *"la base se sincronizó con un reseed dirigido"* — un SQL a mano, en dev.
      A producción nunca llegó: durante todo el día, tocar ese chip en `adondesalimos.com.ar`
      devolvía **una sola card**. Se corrigió a mano otra vez, en Neon.
      **El arreglo:** que `sembrarChips` sincronice los `chip_tags` del chip (borrar los que sobran e
      insertar los que faltan, o `delete` + `insert` dentro de una transacción por chip) en vez de
      saltearlos. Con eso, redefinir un chip vuelve a ser *editar `lib/db/chips.ts` + correr el
      seed*, que es lo que cualquiera espera y lo que el docstring del seed ya promete
      ("idempotente"). Cuidado con no pisar `active`, que es curaduría y el seed **no** debe tocar —
      mismo criterio que ya aplica a los tags.
      **Costo:** chico, ~15 líneas en `scripts/seed.ts` + un test de integración que redefina un chip
      y re-siembre. **Valor:** cierra el único camino de sincronización de catálogo que hoy es manual.

      </details>

- [ ] **Unificar el tercer llamador del match por nombre** (visto el 2026-08-08 implementando
      `CURADURIA_POR_NOMBRE`). Ahora que `lib/search/nombre.ts` es el dueño único de
      `normalizado`/`simKey`/`coincideNombre`, queda **una copia inline** en `lib/claims/query.ts:69`
      (`immutable_unaccent(lower(...))` + `word_similarity` escritos a mano) que puede consumirlo.
      Es exactamente el caso de *"una regla, un dueño"*: dos copias driftean y la desactualizada
      miente. **No es urgente** —hoy las dos hacen lo mismo— pero es un cambio de 5 líneas y va como
      paso aparte, no colado en otra tarea.

- [ ] **Los botones de zoom del mapa siguen en inglés** (visto el 2026-08-08 implementando `MAPA`).
      El `NavigationControl` de MapLibre rotula «Zoom in» / «Zoom out» en `title` y `aria-label`, y el
      CLAUDE.md manda que **toda** la UI vaya en rioplatense. Es deuda **anterior** a `MAPA` —ese
      control ya estaba— y por eso no se tocó ahí. El arreglo son **dos líneas** en el `locale` del
      `Map` (`components/search/map-view.tsx:134`), al lado de las del control de ubicación que sí se
      tradujeron: `'NavigationControl.ZoomIn'` y `'NavigationControl.ZoomOut'`.

### Los 33 hallazgos no bloqueantes de `PULIDO_BETA` F1 (triados por Fer el 2026-08-03)

De los 43 hallazgos de la auditoría de los 6 recorridos en mobile, **10 se confirmaron BLOQUEANTE y
se arreglaron** en F3; estos 33 los bajó el triaje y **no se tocan hasta que Fer los priorice**
(decisión 5 del spec: solo BLOQUEANTE se arregla, el resto cae acá). El detalle completo de cada uno
—ruta, viewport, esperado, observado y evidencia— está en `docs/qa/AnalisisQA.md` § *PULIDO_BETA F1*;
acá va la línea con su ID para poder elegir sin releer la auditoría entera.

**R1 · Descubrir**
- [x] **PBETA-R1-02** (MOLESTO) — Palermo Soho abre con Burger King y Subway: el listado no prioriza nada. Es orden, no curaduría.
      ✅ **Hecho el 2026-08-10** con [`ORDEN_ORGANICO`](../specs/done/ORDEN_ORGANICO.md)
      ([resumen](../archive/SPECS_ARCHIVO.md#orden_organico) · QA APROBADO, 11/11 + 10/10 en vivo).
      El orden pasó a `dueño > banda > confidence > nombre`, con la banda combinando **es cadena**
      (`search.cadenas`, editable sin deploy) y **está curado** (`place_tags source='admin'`), en
      esa precedencia. Medido en vivo: *Palermo Soho · Cenar afuera* abre con los siete lugares que
      el spec puso en su *Objetivo*, *Un café* con Mulata Café en vez de Starbucks, y **29 de las 46
      zonas cambiaron de #1 sin que ninguna perdiera un lugar** (`countPlaces` intacto, `diff` vacío
      de `cobertura-chips`). Detalle en § *Hecho*.
      **`PBETA-R1-03` y `PBETA-R1-04` quedaron fuera a propósito** (decidido con Fer): son la misma
      pantalla pero son UI y no tocan el motor — van juntos en otro pase, y con el orden arreglado
      el techo del scroll de `R1-04` deja de ser arbitrario.
- [ ] **PBETA-R1-03** (MOLESTO) — el chip dice una zona y 3 de 8 cards dicen otra; el buffer de 400 m (decisión 5 de `ZONAS`, ya arbitrado) no se explica en pantalla.
- [ ] **PBETA-R1-04** (MOLESTO) — el conteo vive solo en el botón del sheet y desaparece al entrar; scroll infinito sin techo (280 cards / 36.207 px sin final).
- [ ] **PBETA-R1-05** (MOLESTO) — la home tiene 2 links (`/login`, `/legales`): nada anuncia votaciones ni chat. Espejo de R2-03.
- [x] **PBETA-R1-06** (MOLESTO) — el mapa ocupa el 67% del viewport y el bloque de búsqueda no colapsa en modo mapa. ✅ **Hecho el 2026-08-08** con [`MAPA`](../specs/done/MAPA.md) ([resumen](../archive/SPECS_ARCHIVO.md#mapa)), junto con `FB-04` (mismo archivo, misma pantalla). Medido en vivo antes y después a 390×844: **67% → 100%** y `document.body.scrollHeight` 1.127 → **844 = `innerHeight`**. El bloque de búsqueda pasó de 332 a 188 px (el buscador se esconde y los chips van de 3 filas a 1 que scrollea, 124 → 42 px). En 390×667 el mapa entra entero pero la página gana 60 px de scroll por el piso `min-h-80`: degradación declarada en la decisión 9.
- [ ] **PBETA-R1-07** (MOLESTO) — «Cerrado ahora» no dice cuándo abre, y en la lista de horarios el día de hoy no se distingue.
- [ ] **PBETA-R1-08** (COSMÉTICO) — toques de la ficha en 36–40 px (Guardar 36×36), abajo de los 44.

**R2 · Me invitaron a votar**
- [ ] **PBETA-R2-02** (MOLESTO) — el link compartido no lleva `og:image` y la home no declara ninguna `og:`/`twitter:`.
- [ ] **PBETA-R2-04** (MOLESTO) — sin título propio, el H1 es la lista de nombres concatenada (3 líneas a 390 px, 4 a 360).
- [ ] **PBETA-R2-05** (MOLESTO) — los toques principales miden menos de 44 px («Votar» 63×34, «Inicio» 35×20).
- [ ] **PBETA-R2-06** (MOLESTO) — no se dice hasta cuándo se puede votar, y las votaciones vencen solas a las 72 h.
- [ ] **PBETA-R2-07** (MOLESTO) — «Podés cambiar tu voto» aparece **después** de votar, cuando ya no hace falta.
- [x] **PBETA-R2-09** (MOLESTO) — el sheet «Sumá un lugar» no tiene forma visible de cerrarse. ✅ **Hecho 2026-08-08** con `FB-09`: el handle es un `<button aria-label="Cerrar">` y además se arrastra.
- [ ] **PBETA-R2-11** (MOLESTO) — el bloque de voto queda visualmente fuera de la card del lugar.
- [ ] **PBETA-R2-12** (MOLESTO) — los resultados se ven antes de votar (puede ser deliberado: «resultados en vivo» de `VOTACION`).
- [ ] **PBETA-R2-10** (COSMÉTICO) — el subtítulo del sheet se alinea a la derecha del título, no debajo.
- [ ] **PBETA-R2-13** (COSMÉTICO) — el H1 no se actualiza cuando alguien suma un lugar (se corrige al recargar).

**R3 · Guardar**
- [ ] **PBETA-R3-04** (MOLESTO) — guardar no dice dónde quedó ni cómo volver a encontrarlo (no hay toast ni link a `/mis-lugares`).
- [ ] **PBETA-R3-05** (COSMÉTICO) — en `/mis-lugares` el título aparece dos veces (la lista default se llama igual que la página).
- [ ] **PBETA-R3-06** (COSMÉTICO) — la card de un lugar guardado pierde los tags que sí muestra en el listado.
- [ ] **PBETA-R3-07** (MOLESTO propuesto — **hallazgo nuevo del alta end-to-end, F4, sin triar por
      Fer todavía**) — en un **alta nueva** el guardado pendiente se pierde si el link del mail abre
      otra pestaña. El pendiente vive en `sessionStorage`, que es **por pestaña**: en la misma
      funciona (medido: la fila de `place_list_items` entra en el mismo segundo de la verificación),
      pero el cliente de correo casi siempre abre otra pestaña/app/navegador y ahí arranca vacío —
      aterrizás logueado en la home, sin el lugar y sin explicación.
      **El arreglo obvio no sirve:** `localStorage` cruzaría pestañas del mismo navegador pero no el
      webview del mail, y rompe la razón de elegir `sessionStorage` (que el pendiente muera con la
      pestaña en vez de quedar colgado). Es una decisión de diseño, no un typo.
      **De paso, contribuye:** «Registrate» en `/login` va a `/registro` pelado, sin arrastrar
      `callbackUrl` ni `motivo`. Evidencia y las dos ramas medidas: `docs/qa/AnalisisQA.md` §
      *PULIDO_BETA F4*.

**R4 · Armar una votación**
- [ ] **PBETA-R4-02** (MOLESTO) — nada empuja a ponerle título, y sin título el invitado ve el H1 feo de R2-04. La falla se origina acá y se paga allá.
- [ ] **PBETA-R4-03** (MOLESTO) — «Cerrar» y «Cancelar votación» juntos, sin decir qué hace cada uno (la confirmación posterior sí está bien).
- [ ] **PBETA-R4-04** (MOLESTO) — el botón de crear queda enterrado abajo de los resultados de búsqueda (y = 1.480 px).
- [ ] **PBETA-R4-05** (COSMÉTICO) — el link a compartir se muestra cortado y no se puede leer entero.
- [ ] **PBETA-R4-06** (COSMÉTICO) — `/votacion/nueva`, `/registrar-negocio` y `/reclamar/[placeId]` no llevan el wordmark arriba (3 de 3 pantallas de flujo).

**R5 · Chat + premium apagado**
- [ ] **PBETA-R5-01 (causa raíz)** — **el síntoma está tapado, el diagnóstico no se hizo.** Las 4 sugerencias ya no caen sobre tags flacos, pero sigue sin saberse **por qué** el motor devolvió Palermo Soho para «una birra con amigos por Villa Crespo» y afirmó que el barrio no tiene carga (tiene 207 lugares con `bar`). Los tool-inputs no se persisten: se diagnostica con `npm run eval:chat`, **que cuesta tokens reales de Sonnet**. Decisión de Fer del 2026-08-03: primero el síntoma, la causa cuando se justifique el gasto.
- [ ] **PBETA-R5-02** (MOLESTO) — el header del chat se parte en dos líneas con el badge largo, y come alto en todos los mensajes.
- [ ] **PBETA-R5-03** (MOLESTO) — el gate no dice el precio ni que el cupo se renueva el 1º del mes.
- [ ] **PBETA-R5-05** (MOLESTO) — con el cobro apagado, «Contenido destacado» sigue diciendo «Activá el plan acá arriba», donde ya no hay nada que activar. **Es el hermano de R5-04**, que sí se arregló: mismo patrón (copy escrito para el mundo con cobro prendido), pero acá el dueño ya está adentro del panel y no se pierde.

**R6 · Soy dueño**
- [ ] **PBETA-R6-01** (MOLESTO) — un reclamo enviado es invisible: `/mi-negocio` dice «Todavía no tenés lugares» e invita a mandarlo otra vez.
- [ ] **PBETA-R6-02** (MOLESTO) — el panel de un lugar con reclamo pendiente da 404. **Mejoró solo** con el `app/not-found.tsx` de R2-01 (ya no es la pantalla cruda de Next); lo que falta es el mensaje bueno («en revisión»).
- [ ] **PBETA-R6-03** (MOLESTO) — el panel del dueño mide 2.941 px, «Guardar cambios» no queda fijo y las fotos van **debajo** del botón.
- [ ] **PBETA-R6-04** (MOLESTO) — «¿No está en la lista? Registralo vos» usa el lenguaje visual de los estados vacíos y se lee como cartel, no como botón.
- [ ] **PBETA-R6-05** (COSMÉTICO) — el buscador de negocios trae ruido (5 de 8 resultados ajenos) y corta las direcciones, que es el dato que distingue dos locales del mismo nombre.

- [x] **El contador de interés premium se congela en 200** — hallazgo de `INT2-28` (QA integral #2,
      sesión 2, 2026-08-02). **Resuelto ✅ 2026-08-03**: `contarInteresados()` cableada en
      `app/admin/page.tsx` y el número del panel sale de ahí, no de `interesados.length`. La lista
      **sigue topeada** en 200 a propósito (son los mails a los que se les escribe, no un dataset);
      cuando el total la supera, el panel lo dice: *"Abajo, los 200 más nuevos."*
      _(Detalle original:)_ el tab Suscripciones mostraba `interesados.length` y esa lista viene de
      `getInteresadosAdmin(limite = 200)`. `contarInteresados()` existía **para exactamente este
      problema** —su docstring dice *"el conteo, sin el techo del límite de la lista"*— y no estaba
      cableada: solo la usaba un test. Con 3 filas no se notaba; a 201 interesados el tablero
      subestimaba **el dato que dispara el cobro**.
- [x] **El contador de interés no desagrega B2C de B2B** — decisión de producto, no bug (`INT2-28`).
      **Resuelto ✅ 2026-08-03**: `contarInteresados()` devuelve `{ b2c, b2b, total }` en una sola
      query (`count(*) filter`) y el panel muestra los dos ejes debajo del total.
      **Lo que decidió la discusión**: el gate de la decisión 18 de `DEPLOY` es literalmente **por
      eje** (*"≥10 clicks de usuarios distintos **o** el primer dueño que pida el plan B2B"*), así
      que el número agregado no podía responder la única pregunta para la que existe — un "10" puede
      ser 10 B2C o 7 B2C + 3 B2B, y el disparador B2B es **1**, el número más fácil de perder dentro
      de un total. **Los umbrales NO se hardcodearon**: el spec dice que esos números se ajustan.
      _(Detalle original:)_ la lista ya distinguía por fila (`· Premium (B2C)` vs el nombre del
      lugar); el número grande sumaba dos ejes con precios distintos ($7.000 B2C · $15.000 B2B).
- [x] **El chat no alimenta `place_tag_impressions_daily`** — hallazgo de `INT2-29`.
      **Resuelto ✅ 2026-08-03**: el chat registra los tags, en la **misma tabla y sin columna
      `source`** (los dos consumidores —panel del dueño y curaduría por uso— quieren lo mismo:
      demanda; separarlos era especular, y era la última ventana barata para hacerlo porque después
      de F0 la tabla tiene datos reales).
      ⚠️ **La trampa que casi escribe datos mal, anotada para el que lo lea después:** el set de
      grounding es `seenPrevios ∪ idsNuevos`, así que un lugar citado puede venir de una búsqueda de
      **dos turnos atrás**, con otros tags, y en un mismo turno puede haber varias llamadas a la tool
      con tags distintos. La atribución quedó **por llamada**: de cada `buscar_lugares` se registran
      solo sus ids que además fueron citados; un citado que no salió de ninguna llamada de este turno
      no se atribuye a nada. `ejecutarBuscarLugares` devuelve ahora los slugs ya normalizados para
      que nadie re-parsee el input crudo del modelo.
      **Segundo punto, decidido que SÍ está bien así:** buscar dentro del armado de una votación
      suma `impressions` al dueño. Es una persona real mirando ese lugar para decidir si va —
      exactamente lo que la métrica dice contar; que la pantalla sea privada no la hace menos vista.
      Además esas dos pantallas llaman `/api/search?q=…` **solo con texto libre**, así que los tags
      nunca se registraban ahí (el BACKLOG original lo planteaba como si fueran las dos cosas).
- [ ] **Acoplamiento latente: el cursor del historial y la precisión de `created_at`** — no es un bug
      hoy y **no hay que arreglarlo**; se anota para que nadie lo descubra a los golpes. El cursor de
      `historialDeVotaciones` viaja como epoch en **milisegundos** y `created_at` en Postgres guarda
      **microsegundos**; hoy no puede fallar porque la app inserta `createdAt: ahora`, un `Date` de
      JS (`lib/votaciones/acciones.ts:112`). Se materializaría si alguna vez se insertaran votaciones
      **por SQL o script** (backfill, import, seed) y dos cayeran en el mismo milisegundo en el borde
      de página: la segunda se saltea. Lo encontró la propia siembra del QA (`INT2-25`).
- [x] **🔴 El editor del dueño borra los tags de la curaduría** — **Resuelto ✅ 2026-08-02**, antes
      de ejecutar el QA integral #2 (opción A de Fer: § 10 bis manda arreglar un 🔴 antes de seguir).
      El `delete` de `guardarContenido` ahora borra todo lo que no es curaduría **más** la curaduría
      que el dueño destildó, y el `insert` lleva `onConflictDoNothing`: una fila `admin` que
      sobrevive **conserva su `source`**. Las de `import` tildadas siguen pasando a `owner`
      (decisión 14 intacta, y así el re-import no se lleva lo que el dueño confirmó).
      **Regla de producto cerrada:** el dueño gana sobre lo que él tildó · la curaduría sobrevive en
      lo que él no tocó · **destildar sí borra** (una pantalla que dice "guardamos" y no guarda
      mentiría sobre en qué búsquedas aparece su lugar). Test en `panel.integration.test.ts`;
      619/619 verdes. Verificado en vivo como `INT2-40`.
      **Dos correcciones al diagnóstico original**, halladas al ir al código: (a) el editor precarga
      como tildados **todos** los `place_tags` sin distinguir `source`, así que guardar sin tocar no
      los borraba — los reescribía como `owner`, que es una pérdida igual de real pero **invisible**
      (rompe el canario y, con la decisión 12.3, deja que una revocación apague trabajo de la casa);
      (b) **no le pasó a nadie todavía**: cero lugares con sugerencias aceptadas sin tags `admin`, el
      canario intacto en 3.967/1.202. No hubo nada que restaurar. Es solo código ⇒ **no bloquea el
      dump a Neon**. Queda abierto, como decisión de UI y no de datos: **el editor no distingue los
      tags de curaduría de los propios** — verificado en vivo, aparecen tildados e iguales.
      _(Detalle original del hallazgo, para contexto:)_ `guardarContenido`
      hace `tx.delete(placeTags).where(eq(placeTags.placeId, placeId))` **sin filtrar por `source`**
      (`lib/negocio/acciones.ts:117`) y reemplaza el set entero por lo tildado en el formulario. El
      docstring contempla borrar los de `import` (decisión 14: para SU lugar el dueño es mejor
      fuente que Overture) — **pero la curaduría no existía cuando se escribió esa regla**: AUTH F3
      es del 2026-07-21 y CURADURIA del 2026-07-27. Hoy hay **3.967 tags `source='admin'` sobre
      1.202 lugares** que **no están en git ni en el seed** (§ Notas importantes de `CLAUDE.md`):
      recuperarlos es re-correr `npm run curar` (~US$17) o restaurar un dump.
      **Por qué urge antes del deploy:** el objetivo declarado del lanzamiento es conseguir dueños
      que reclamen su lugar, y el plan de curaduría #3 es curar *"los ~200 que la gente más ve"* —
      que son exactamente los que más chance tienen de ser reclamados. La colisión es estructural,
      no accidental. Y el dueño los borra **sin enterarse**: es un click en "Guardar" de un
      formulario que él cree que solo edita su teléfono (verificar además si el editor le muestra
      los tags de curaduría ya tildados).
      **Fix propuesto** (chico y quirúrgico): que el `delete` preserve `source='admin'`. La regla de
      producto detrás, para decidir: **el dueño gana sobre lo que él tildó** (es su lugar), **la
      curaduría sobrevive en lo que él no tocó** (es trabajo de la casa, pago, y no está en git).
      Es **código ⇒ sesión aparte**. Se verifica como `INT2-40` en
      `docs/qa/PLAN-QA-INTEGRAL-2.md`, y bloquea la decisión 12.3 de ese plan (que los tags del
      dueño dejen de aplicarse al revocar un reclamo **no se puede implementar antes**: hoy no hay
      a qué volver).
- [x] **Revocar un reclamo no apaga los tags ni las fotos del dueño** (hallazgos 2026-08-02,
      `INT2-33` del QA integral #2, sesión 3). **Resuelto ✅ 2026-08-03**, los dos huecos, con la
      decisión de fallback que faltaba tomada por Fer: **(a) re-derivar los `import` desde Overture
      al revocar**.
      - **Tags:** `revertirTagsAOverture` (`lib/claims/ownership.ts`) borra las `owner` y repone las
        que Overture da por `places.overture_category`, **dentro de la TX** de `decidirClaim`. La
        curaduría (`admin`) no se toca —`onConflictDoNothing`, conserva su `source`—. El mapa se
        mudó a **`lib/overture/tag-map.ts`** (dos consumidores; `scripts → lib`, nunca al revés).
      - **Fotos:** se gatean por reclamo aprobado en **los dos** lugares que deciden sobre fotos —
        `getPlaceDetail` y el `tieneFotoDueno` de `getPlaceForEnrichment`—. Las filas de
        `place_photos` y los objetos en R2 **no se tocan**: ocultar ≠ borrar.
      - ⚠️ **La trampa del ítem de AUTH F3 era real y se cayó en ella**: con solo el primero gateado,
        la ficha revocada quedó con **cero** fotos (ni la del ex-dueño ni la de Google), verificado
        en vivo. Lo detectó **este BACKLOG**, no los tests. Ver `docs/qa/AnalisisQA.md` § *Fixes del
        QA integral #2*.
      _(Detalle original del hallazgo, para contexto:)_ Al revocar, el contenido de texto **sí**
      volvía a Overture (teléfono, web, socials, horarios — verificado en vivo), pero quedaban dos
      huecos:
      - **Los tags `source='owner'` siguen aplicándose.** Es la **decisión 12.3 del plan de QA**, que
        resulta **no implementada**: `decidirClaim` no toca `place_tags`
        ([acciones.ts:238-267](../../lib/claims/acciones.ts#L238)) y **ningún** lector de tags filtra
        por `source` ni por dueño aprobado — búsqueda, ficha, chat y votaciones filtran solo por
        `tags.active`. En vivo: con el reclamo revocado, Kansas seguía saliendo **primero** en
        `?z=las-canitas&t=musica-en-vivo`. Importa porque **los tags deciden en qué búsquedas
        aparece el lugar**, y se revoca justamente cuando alguien no era quien decía ser.
        ⚠️ **El bloqueo cambió de forma, no desapareció.** El fix de `INT2-40` —el editor preserva
        la curaduría, commit `1139f3b`— **ya está**, así que ese no es el impedimento. Lo que queda
        es que el editor **sigue borrando los `import` a propósito** (decisión 14: para su lugar el
        dueño es mejor fuente que Overture), así que un lugar **sin curaduría** cuyo dueño guardó
        alguna vez **se queda sin ningún tag** al revocar. Medido el 2026-08-02: **Kansas tiene 5
        tags y los 5 son `owner`** ⇒ apagarlos lo saca de toda búsqueda por tag. **Hay que decidir
        el fallback antes de implementar:** (a) re-derivar los `import` desde Overture al revocar,
        (b) degradar los `owner` a `import` en vez de apagarlos, o (c) aceptar que el lugar quede
        sin tags. Hoy afecta a **1 lugar** (el único con claim aprobado); escala cuando haya dueños
        de verdad.
      - **Las fotos del dueño siguen visibles.** Este el plan lo daba por hecho y no ocurre:
        `fotosDeDueno` ([query.ts:230](../../lib/lugar/query.ts#L230)) no recibe `reclamado`, a
        diferencia del contenido ([:149](../../lib/lugar/query.ts#L149)) y los horarios
        ([:157](../../lib/lugar/query.ts#L157)), que sí lo usan. **Fix simétrico y chico**: pasarle
        `reclamado`, igual que a los otros dos. **No depende del otro ítem** — se puede hacer solo.
      - ⚠️ **Trampa de lectura, anotada para el que lo arregle:**
        [acciones.ts:158](../../lib/claims/acciones.ts#L158) dice *"un `source='owner'` vuelve a ser
        invisible por la regla normal"* y **no habla de tags**: se refiere a `places.source` (el
        **lugar** dado de alta por un dueño). `place_tags.source` es otro enum. Dos columnas
        distintas con el mismo nombre y el mismo valor; leído rápido, el docstring parece garantizar
        algo que el código no hace.
      🟢 Solo código ⇒ puede ir **después** del deploy.
- [x] **`/cuenta` ofrece "Cancelar suscripción" a un premium que no tiene suscripción** (hallazgo
      2026-08-02, `INT2-32`). **Resuelto ✅ 2026-08-03** con la opción (a) **reforzada**: con
      `activo && status === null` no se pinta el botón **y** va un copy que explica que es de
      cortesía (*"Te activamos el Premium nosotros: no vence ni se cobra…"*). El BACKLOG proponía
      (a) *o* (b) como excluyentes y no lo son: sacar el botón sin decir nada deja al premium con un
      panel mudo —ni renovación ni acción—, que es la otra mitad del mismo problema.
      **No hizo falta ninguna query nueva**: el discriminador ya estaba en `EstadoSuscripcion`
      (`activo` sale del flag, `status` de la fila viva). Y **cubre los dos ejes de una**, porque el
      panel es compartido: el caso B2B es incluso más probable, ya que `places.owner_plan` se cambia
      con un `UPDATE` documentado hasta el spec 7. **Queda fuera**: `POST /api/billing/cancel` sigue
      devolviendo 404 para un premium de cortesía — ya no hay botón que lo dispare, pero si alguna
      otra superficie ofrece cancelar, el mismo choque vuelve.
      _(Detalle original:)_ **el estado va a existir en producción**: con el cobro apagado, un
      `UPDATE` a mano de Fer es el único camino a premium (beta tester, regalo, dueño que lo pidió),
      y ese usuario **no tiene fila en `subscriptions`**. Hoy `/cuenta` le muestra "Premium" +
      *"$ 7.000 por mes."* **sin fecha de renovación** —la única señal, ilegible para el usuario— y
      el botón de cancelar igual. Al tocarlo: **404** + *"No tenés una suscripción activa para
      cancelar."*, que contradice al badge de dos líneas arriba. No rompe nada.
      **Decisión de producto:** (a) no ofrecer cancelar sin fila viva, o (b) un copy que explique
      que es un premium de cortesía y no hay nada que cancelar. Recomendación: **(a)** — el botón
      que no puede cumplir es peor que su ausencia. 🟢 Solo código.
- [x] **RESUELTO — el dump lleva las 4 cuentas de prueba a producción, y ahora hay un paso que las
      borra** (planteado y decidido el 2026-08-02, tras el bloque F del QA integral #2).
      **Lo destapó una pregunta de Fer:** *"antes del restore a Neon no va a pasar ningún usuario…
      o sea la tabla `users` se crea vacía, ¿a eso te referías?"*. **No**: `pg_dump` copia schema
      **y** datos. El dump trae **4 `users`**, sus **4 `account`** (hashes de contraseña) y **11
      `session`**, más el rastro que cuelga de ellos por cascada — incluidas las 3 `subscriptions`
      de sandbox de MP, una `active` hasta el 2026-08-24, que eran lo único que este ítem anotaba
      al principio. Lo que lo vuelve serio es otra cosa: **`frodriguez.este@gmail.com` es
      `ADMIN_EMAIL`**, así que la cuenta admin de producción arrancaría con la contraseña de dev
      (y `pepe`/`juan`/`hugo` con `12345678`, escrita en `docs/qa/DATOS_QA.local.md`).
      **Por qué no lo agarró el QA:** el bloque F tenía como criterio *dejar la base como estaba
      antes del QA*, que **no es lo mismo** que *dejarla lista para producción*. El segundo criterio
      no tenía dueño; ahora lo tiene el **paso 5 de F0** (`docs/specs/active/DEPLOY.md`, decisión
      20), con el SQL y la verificación por conteo escritos.
      **Decidido:** se limpia **en Neon, después del restore** —no antes del dump— así el Postgres
      de dev queda usable con sus cuentas de prueba y el paso sigue siendo reversible. `/admin` no
      se pierde: el gate es por email. ⚠️ **Ojo al implementarlo:** `session` y `account` **no
      tienen FK a `users`** (better-auth las creó sin foreign key) ⇒ **no cascadean** y necesitan su
      propio `DELETE`; lo mismo `place_owner_content` y `place_photos`, que cuelgan de `place_id`.
- [x] **Un chip de la home con un tag de Precio nunca se ve** (hallazgo 2026-08-02, `INT2-01` del QA
      integral #2). **Resuelto ✅ 2026-08-03**: se le sacó `precio-2` a **los dos** chips que lo
      tenían. `salida-con-amigos` pasó de **0 a 38** lugares y vuelve a la home; `primera-cita`, de
      **1 a 187** detrás de "ver más".
      **Lo que cambió al medirlo contra la base** (y no al leer el hallazgo): eran **dos** chips, no
      uno — y ese "1" de `primera-cita` era, literalmente, el único lugar de toda la faceta Precio.
      **"Esperar datos de Precio" no era una opción real**: OSM ya se midió y da cero para Precio, y
      la curaduría IA tampoco lo asigna (3.967 tags `admin` y un solo `precio-2`). Un chip
      permanentemente muerto en `sort` 0 es peor que uno flaco.
      ⚠️ **Costo escondido, para el próximo que cambie un chip:** editar `lib/db/chips.ts` **no
      alcanza**. El seed inserta `chip_tags` solo si el chip no tiene ninguno
      (`scripts/seed.ts:194`), así que `db:seed` **no actualiza los tags de un chip existente** —
      hubo que borrar las 2 filas a mano (con `npm run backup:db` antes). El test
      `chips.integration.test.ts` compara código contra base, así que los dos tienen que moverse
      juntos: es la red que avisa si te olvidás de una mitad.
      **Regla general, ahora escrita en el docstring de `CHIPS_OBJETIVO`:** un chip que incluya un
      tag de la faceta Precio está apagado de hecho mientras esa faceta siga vacía.
      **Efecto colateral registrado:** al medir los 9 objetivo se actualizó el docstring, que seguía
      diciendo *"8 devuelven 0"* y *"el único vivo es `salir-a-bailar`"* — quedó viejo con la
      curaduría. Hoy son **8 de 9 vivos** (el único en 0 es `plan-tranqui`).

- [x] **Un chip de horario acotado sale a toda hora: falta "solo en esta ventana"** (observación de
      Fer, 2026-08-03: *"after office debería salir de lunes a viernes nada más, y desde las 17"*).
      **Resuelto ✅ 2026-08-03**: se eligió el `solo: [...]` dentro de la regla (la otra opción era
      una ventana por chip, que pedía migración). `chipsFueraDeVentana` (`lib\search\rotacion.ts`) y
      un corte en `lib\search\chips.ts` **antes** de repartir home/resto — por eso un chip fuera de
      ventana tampoco entra por el `primero` de otra regla. Fuera de hora **no se ve en ningún
      lado**, tampoco detrás de "Ver más": «solo aparece dentro de su ventana» es literal.
      **Tres cosas que salieron del código y no del ítem:** (1) `solo` se evalúa mirando **todas**
      las reglas, no la primera que matchea como `primero` — es un permiso, no un orden, y si ganara
      la primera, una regla ajena que cubre esa hora decidiría sobre un chip que ni nombra; (2) por
      eso mismo `primero` pasó a ser opcional (una regla puede solo restringir, sin cambiarle el
      orden a la home) y `chipsPrimero` ahora saltea las reglas sin `primero`, o poner una ventana
      arriba de todo apagaría en silencio el adelanto de una regla posterior; (3) la home sigue
      llenando sus 4 sin after-office (quedan 5 candidatos `in_home` sobre el piso), verificado a
      mano y con el test de "no deja huecos".
      **Solo `after-office` lleva ventana**: `salir-a-bailar` está en la home a toda hora igual que
      antes — nadie lo pidió y sacarlo es una decisión de producto, no un arreglo. Es agregarle
      `"solo": ["salir-a-bailar"]` a su regla con un UPDATE, sin deploy.
      **No es un bug de la regla**: `chips.schedule` ya tiene `after-office` en `dias: [0,1,2,3,4]`
      = **lunes a viernes** (la convención del proyecto es `0 = lunes`, no la de JS —
      `lib/search/rotacion.ts:23`) con ventana 17:00–21:00. El problema es lo que la feature **no
      sabe hacer**: una regla solo **adelanta** (`primero`), y `after-office` tiene `in_home = true`,
      así que igual está entre los 4 de la home **a toda hora, todos los días** — domingo 11 AM
      incluido. El propio comentario de `rotacion.ts:41` lo dice: *"ya están entre los 4 de la home a
      toda hora"*.
      **Qué falta:** la capacidad inversa — que un chip **solo** aparezca dentro de su ventana. Se
      puede resolver con un `solo: [...]` en la regla (mismo `app_settings`, sin deploy y sin
      migración) o con una ventana por chip. Toca `lib/search/rotacion.ts` (validación + una función
      nueva) y el corte de `lib/search/chips.ts`. **Puerta de ida y vuelta.**
      ⚠️ Al implementarlo: verificar que la home siga llenando sus 4 con el chip fuera de ventana
      (hoy hay margen — 8 de los 9 objetivo están vivos), y que un chip restringido no pueda entrar
      por la puerta de atrás del `primero` de otra regla.
- [x] **La home no tiene piso de resultados: un chip con 1 lugar ocupa un lugar de los 4**
      (observación de Fer, 2026-08-03, sobre `salida-con-chongo`).
      **Resuelto ✅ 2026-08-03**: `PISO_HOME = 20` en `lib\search\chips.ts`, aplicado también a los
      chips **forzados** por `chips.schedule` (mismo criterio: adelantar a un chip flaco no le da
      espalda). "Ver más" sigue pidiendo `> 0`, así que `salida-con-chongo` no desaparece: baja de
      la portada. **Por qué 20 y no 10:** sobre los 18.993 publicados no hay ningún chip entre 2 y
      37, así que hoy los dos hacen exactamente lo mismo — entre dos números equivalentes gana el
      más exigente, porque el problema real es la división por zona. Es una constante: bajarlo es
      una línea.
      **La home hoy, verificada a las 5 horas de prueba:** `salida-con-amigos`(38) ·
      `salir-a-bailar`(586) · `tomar-algo`(3.219) · `cenar-afuera`(11.438), con `after-office`(171)
      entrando primero L-V 17-21 y `merienda`(176) el finde 16-19. La decisión 25 esconde el chip que
      da **0**, no el que da **1** — y `salida-con-chongo` da exactamente 1 con `sort` 1, o sea es el
      **segundo** de la portada. En una zona concreta eso es 0 casi siempre, y el usuario termina en
      la pantalla de "sin resultados" por haber tocado un atajo de la home.
      **Medido el 2026-08-03** (18.993 publicados): hoy `bar|wine-bar ∧ romantico ∧ hasta-tarde` = 1
      · sin `hasta-tarde` = 12 · sin `romantico` = 56 · **el tag `romantico` entero = 71**.
      **O sea aflojar la combinación no lo salva: el techo es el tag.** Eso es curaduría, no código.
      **Lo que sí es código y es la regla general:** un piso para entrar a la home, distinto del
      `> 0` que habilita "ver más". Una línea en `lib/search/chips.ts:112` + elegir el número; con lo
      medido, un piso de 10 o 20 deja afuera solo a chongo y no toca a ningún otro. **Puerta de ida y
      vuelta.** Decidir también si un chip **forzado por `chips.schedule`** respeta el piso (debería:
      mismo criterio).
- [ ] **Combos / "armame un plan" — se prueba desde el chat, no con un chip** (idea de Fer,
      2026-08-03: *elegir "ir a comer y después a bailar", "teatro y después cenar"*).
      **Por qué la idea es buena:** un combo **no sufre** lo que mata a los chips. Un chip es un AND
      de filtros y por eso se queda sin resultados; un combo son **dos búsquedas separadas**, cada
      una tan densa como ya es (11.438 restaurantes y 586 boliches, no la intersección de nada). Es
      un problema de **secuencia y cercanía**, no de escasez de tags.
      ⚠️ **La trampa estructural: un chip NO puede expresar un combo.** Todo el mecanismo del chip es
      "aplicar tags a la URL" (`lib/search/chips.ts:14-15`); un combo necesita dos resultados y una
      relación entre ellos ("que estén cerca"), que no entra en un query string de tags. La pregunta
      no es *qué chip* sino **qué superficie**, y ahí el costo real no es el motor: es decidir si un
      "plan" es una entidad nueva o es **una votación con paradas** — ya existe una entidad que
      modela "un grupo eligiendo una salida".
      **Primer paso decidido por Fer (barato, sin superficie nueva):** cambiar una de las 4
      sugerencias del chat (`app/chat/chat-client.tsx:77-82`) por una de plan, y medir ahí. Doble
      beneficio: se prueba la capacidad **y** se le enseña al usuario otra forma de preguntarle a la
      IA — *"la gente no sabe mucho cómo hablarle a la IA ni de prompting"*. Sale
      `Algo tranqui con mi vieja en Palermo`; entra una de plan. Las otras 3 quedan igual.
      **Primer paso hecho ✅ 2026-08-03** (el ítem sigue abierto: falta la superficie). Entró
      `Armame un plan: cenar y después bailar en Palermo`.
      **Probado en vivo, y la duda se despejó sola: el modelo encadena sin que nadie se lo enseñe.**
      Sonnet hizo las **dos** búsquedas (restaurantes en Palermo + boliches en Palermo), las tituló
      *"Para cenar"* / *"Para bailar después"* y cerró con la relación entre las dos —*"si cenás en
      Soho, te conviene bailar en Kika o Buda Bar para no cruzar todo Palermo"*—, que es exactamente
      la parte de "cercanía" que se creía que iba a faltar. El `prompts.ts:65` que empuja a no
      repetir búsqueda no estorbó: dice *"volvé a buscar solo si cambiás algo de verdad"*, y un
      combo cambia el tipo de lugar. **Entonces NO se toca el prefijo cacheado** — la decisión
      aparte que este ítem reservaba (instruir al modelo sobre planes, con su `npm run eval:chat`)
      **queda sin necesidad de tomarse**. Lo que falta sigue siendo la superficie, no la capacidad.
      **Copy propuesto** (para no re-derivarlo): `Armame un plan: cenar y después bailar en Palermo`.
      Enseña la fórmula "armame un plan", que es lo que se quiere que la gente copie, y deja la zona
      al final como las otras tres. La redacción original de Fer era *"…cenar en Palermo y después
      bailar **cerca**"*; se corrió el "cerca" porque el motor no tiene distancia entre lugares y el
      modelo lo va a resolver como "misma zona" igual — la palabra promete algo que no existe. Es
      copy: puerta de ida y vuelta, decidilo al implementarlo si te suena mejor la otra.
      ⚠️ **Verificar en vivo antes de darlo por probado:** el prompt **no sabe de planes** y encima
      empuja levemente en contra (`prompts.ts:65`: *"si la primera búsqueda ya te trajo suficientes,
      con eso alcanza"*). Cambiar de restaurante a boliche sí es "cambiar algo de verdad", así que
      debería encadenar — pero si no lo hace, la sugerencia falla justo en lo primero que toca un
      usuario nuevo. **Si hay que instruirlo en el prompt es una decisión aparte**: toca el prefijo
      cacheado (8.776 tokens) y obliga a `npm run eval:chat`, que cuesta tokens reales.
      Dato para el que lo toque: la sugerencia que sale es **el ejemplo textual de `prompts.ts:82`** y
      un caso de `eval-chat.ts` — el ejemplo sigue en el prompt, pero están apareadas por diseño.
      **Lo que le falta al motor para hacerlo en serio** (recién si prende): un "cerca de" —distancia
      entre dos lugares—, acotado porque ya hay coords y turf. Los combos curados a mano ("Plan
      clásico de Palermo") son la versión cara y van al final, no al principio.

- [ ] **💸 `npm run curar` re-cobra por los lugares ya curados — filtro de skip** (hallazgo
      2026-07-31, al preguntarse si había que re-correr la curaduría). `seleccionarLugaresDeZona`
      (`lib/curation/seleccion.ts`) **no excluye lo que ya tiene sugerencias**: ordena por
      (tiene contacto, `confidence` desc) y corta en `curation.zone_quota`. Es determinista, así
      que una segunda corrida elige **los mismos 40 lugares por zona** y los vuelve a mandar al
      LLM. Los datos están a salvo (`guardarSugerencias` solo inserta filas nuevas, decisión 8),
      **la plata no**: re-correr hoy = ~US$17 para regenerar lo que ya existe. También hace que
      subir la cuota sea caro de gusto — pagás de nuevo los primeros 40 de cada zona para llegar
      a los nuevos. **Fix**: un `NOT EXISTS` contra `place_tag_suggestions` en el `where` de la
      selección (~5 líneas), con test. **Prerrequisito de cualquier corrida futura** — anotado y
      no implementado el 2026-07-31 porque no hay ninguna corrida planeada (ver § Cola post-v2 #3).

- [ ] **Revisar el costo del prompt caching del chat cuando haya tráfico real** (2026-07-31, al
      medir el costo con los tokens de caché ya persistidos). La escritura del prefijo (8.776
      tokens de system) es el **74%** del costo de una llamada en frío: US$ 0,0326 de US$ 0,0440.
      **Hoy no se toca nada** — el caché es por prefijo y por modelo, lo comparten todos los
      usuarios y **cada lectura refresca el TTL gratis**, así que el write se paga una vez por
      período frío y a volumen desaparece solo. El régimen caro es el tráfico **ralo**, que es
      justo cuando el costo absoluto son centavos. Con usuarios reales, mirar la proporción
      `cache_creation` vs `cache_read` en `/admin` y recién ahí decidir entre tres palancas:
      **(a)** nada, si el caché vive caliente; **(b)** TTL de 1 h (write a 2× en vez de 1,25× —
      conviene solo con tráfico a baches, huecos > 5 min y ≥3 llamadas por hora), un parámetro,
      puerta de ida y vuelta; **(c)** recortar el prefijo, que ahorra lineal pero toca la voz del
      producto. **Descartado con números:** usar un modelo barato en el primer mensaje y caro
      después **no** ahorra —los cachés son por modelo, así que se pagarían dos writes (US$ 0,0439
      vs US$ 0,0329)— y pone el modelo más débil en el mensaje que más define la voz (idea de Fer,
      analizada y descartada el 2026-07-31). Ver `docs/operations/LECCIONES_APRENDIDAS.md`.

- [x] **El tablero de costos de `/admin` subestima el gasto del chat: no cuenta los tokens de
      caché** (hallazgo 2026-07-29). **Resuelto ✅ 2026-07-31** (pase de deuda): migración `0013`
      con `cache_read_tokens`/`cache_creation_tokens` en `chat_messages` (aditiva, nullable),
      escritas en `lib/ai/chat.ts` —que ahora acumula **también** el de creación, antes solo el
      read— y cobradas en `lib/admin/costos.ts` vía `costoDePeriodo` → `calcularCostoUsd` con los
      4 números. El tablero muestra «Tokens (in / out / caché)». Escribe **hacia adelante**: las
      filas viejas quedan en `null` (= 0), así que el histórico vale lo mismo que antes y el
      número nunca baja. Ver `docs/qa/AnalisisQA.md` § *Pase de deuda técnica*, DEUDA-01..06.
      El diagnóstico original, para referencia: La API
      reporta `input_tokens` como el remanente **no** cacheado — el total de entrada es
      `input + cache_read + cache_creation` — y `chat_messages` solo persiste `tokens_in`/
      `tokens_out`. Como los reads se cobran a 0,1×, el costo mostrado en `/admin` queda por
      **debajo** del real. El log por llamada ya quedó arreglado (`logChatCall` ahora pasa
      `cacheReadTokens` a `calcularCostoUsd`), pero el tablero lee de la base y ahí el dato no
      existe. **Fix: dos columnas nuevas en `chat_messages`** (`cache_read_tokens`,
      `cache_creation_tokens`) + escribirlas en `lib/ai/chat.ts` (que ya las tiene a mano, línea
      122) + pasarlas en `lib/admin/costos.ts`. Es aditivo, pero es **migración sobre una tabla
      con datos reales** → correr `npm run backup:db` antes. Las filas viejas quedan en `null`,
      que `calcularCostoUsd` ya trata como 0.

- [x] **💵 /admin — sugeridor de precio premium según el dólar (idea Fer, 2026-07-26).**
      → **Implementado como parte del mini-spec `COSTOS_ADMIN` ✅ 2026-07-26** (decisiones
      8-10 del spec): cotización oficial cacheada + regla de piso + banner solo-sugerencia.
      [Resumen](../archive/SPECS_ARCHIVO.md#costos_admin)
      Banner/widget en `/admin` que consulte **`dolarito.ar` (dólar OFICIAL)** y, cuando el dólar
      supere un umbral, sugiera el nuevo precio ARS del plan premium según la **regla de piso**
      (`precio_ARS ≥ dólar × 3`, ver `docs/product/COSTOS-IA-Y-PRECIO-PREMIUM.md`). Objetivo: que el
      precio no quede por debajo del costo (API Claude se paga en USD, el peso se devalúa). Disparador
      hoy: dólar ~2.333 → ARS 7.000 toca el piso. **Consideraciones de implementación:** cachear la
      cotización (no pegarle a dolarito.ar en cada render), degradar si la fuente cae (mostrar último
      valor conocido, nunca bloquear `/admin`), y que sea **sugerencia** — el precio lo cambia Fer a
      mano, no automático. Ver análisis completo en `COSTOS-IA-Y-PRECIO-PREMIUM.md`.
- [x] **🧪 Test de integración del cupo borra el contador real del tope global (hallazgo del
      tablero de costos, 2026-07-26).** **Resuelto ✅ 2026-07-27** (batch limpieza post-CURADURIA):
      `snapshotUsoGlobal()` en `beforeAll` + `restaurarUsoGlobal()` en `afterAll` — la suite deja
      la fila del mes real exactamente como la encontró (no sirve mes sintético: `reservarCupo`
      escribe siempre `current_date`). Verificado: centinela 99 en `ai_api_usage`, corrida la suite,
      quedó en 99; antes lo borraba. `lib/ai/__tests__/cupo.integration.test.ts:64` hace
      `db.delete(aiApiUsage)` de la fila del **mes calendario real** como setup/cleanup: cada
      corrida de la suite contra el Postgres de dev resetea el contador del kill switch
      (CHAT_IA decisión 15). Lo expuso el tablero de COSTOS_ADMIN en su primer render (cupo
      0/5.000 con 20 mensajes reales del mes). Fix chico: guardar y restaurar el valor previo,
      o testear contra un mes sintético. Ver `docs/qa/AnalisisQA.md` § QA manual COSTOS_ADMIN
      → Observación.
- [x] **🎯 SESIÓN DEDICADA — Chat IA: calidad de búsqueda y voz (tuning de prompt, F1).**
      **Cerrada ✅ 2026-07-27** (Sonnet 5 adoptado + fix de la trampa de `precio` + guard de multi-búsqueda,
      verificado por eval y en vivo — ver sub-ítems). Los 3 criterios (no narrar · voz · no sobre-filtrar)
      se cumplen; no queda defecto abierto. El tuning fino de voz es iterable siempre, pero sin issue pendiente.
      Descubierto en el QA en vivo de F2 (2026-07-26, Fer testeando). Eran comportamientos del
      **modelo**, no de la UI ni del motor. Se trató en sesión propia con contexto limpio, por ser iterativo.

      **Síntomas observados:**
      1. **Sobre-filtrado que pierde resultados reales (el más grave).** "Lugares para ir con
         hermanos y primos… una sala de escape… en Caballito/Almagro/Boedo" → el chat dijo "no hay
         escape rooms". **Pero SÍ hay** (Caballito 3, Almagro-Boedo 1, publicadas y bien tagueadas:
         `club-de-juegos`+`escape-room`). **Causa raíz** (diagnosticada en DB, no adivinada): el
         modelo sumó un tag de ambiente (`grupos-grandes`, por "hermanos y primos") al `escape-room`;
         como entre facetas es **AND** y **ninguna escape room tiene tags de ambiente**, dio 0. El
         motor hizo lo correcto; el modelo pidió mal. Se agrava porque la guía "CÓMO ELEGIR LOS TAGS"
         del system prompt **no menciona escape rooms/juegos** → el modelo queda sin andarivel.
      2. **Narra su uso de tools** ("Uh, me tiró resultados de Palermo… Probemos de nuevo"), contra
         la guía del prompt.
      3. **Slang no rioplatense** ("te late") y **frases inventadas** ("te doy un toque ahí") —
         mitigado ya (ver sub-items) pero no 100% en modelo chico.

      **Plan (idea de Fer, 2026-07-26):** ANTES de evaluar cambiar de modelo, **revisar cómo se
      estructuran los prompts en StressPlan** (usa el mismo Haiku 4.5 y NO tiene estos problemas) y
      portar esa estructura al chat. Recién si con esa estructura sigue fallando, evaluar **Sonnet 5**
      (swap por `app_settings`, decisión 3 del spec, sin deploy). Fixes concretos candidatos: guía de
      escape-room/juegos en el prompt; regla fuerte de "si nombran una actividad puntual, filtrá por
      ESE tag + zona y NO sumes ambiente"; considerar loguear el input de la tool (`buscar_lugares`)
      para debug basado en evidencia, no en conjeturas.
      - [x] **Voz/slang** (2026-07-25/26): reforzado el system prompt para evitar "boludo" y slang
        no rioplatense. Se **quitó** la mención de "te late" del prompt (priming: nombrar la palabra
        prohibida la inducía) y se pasó a **lista blanca positiva** de muletillas porteñas + regla de
        no inventar modismos ("te doy un toque ahí"). "che" sí, "boludo" no. `lib/ai/prompts.ts` § TONO.
        **Ojo (Haiku):** la instrucción negativa no es 100% confiable en un modelo chico; si la voz
        importa mucho, evaluar Sonnet 5 (swap por `app_settings`, decisión 3, sin deploy).
      - [x] **Concatenación entre rondas de tool** (2026-07-26): el texto de cada ronda se pegaba al
        de la anterior sin separador. Se inserta `\n\n` antes del primer texto de una ronda posterior
        en `lib/ai/chat.ts`. Verificado en vivo: párrafos separados.
      - [x] **Sobre-filtrado — estructura de prompt portada de StressPlan** (2026-07-26): la estructura
        que StressPlan usa con el MISMO Haiku 4.5 es **pares contrastivos ✗/✓ por cada regla dura** +
        imperativos en mayúscula + bloque de recencia al final. Portado a `lib/ai/prompts.ts`: (a) el
        bullet de `tags` explicita la trampa del AND; (b) se sumó juegos/escape-room a la guía de TIPO
        y ACTIVIDAD (antes no existían → el modelo improvisaba); (c) **REGLA CLAVE** nueva con el ✗/✓
        exacto del caso escape-room + `grupos-grandes` ("hermanos y primos" = quiénes van, no una vibra
        a filtrar); (d) búsqueda vacía → **reintento en silencio** aflojando ambiente antes de decir "no
        hay", sin narrar el intento fallido (ataca también el síntoma #2); (e) bloque **ÚLTIMO CHEQUEO
        ANTES DE BUSCAR** al final (recencia). Además, log `chat_tool_call` en `lib/ai/chat.ts` (input
        de la tool + nº de resultados, sin PII) para debug basado en evidencia. Typecheck + tests
        verdes. **Verificado en vivo (2026-07-26, Playwright/ngrok):** el repro exacto ("sala de escape
        con hermanos y primos por Caballito/Almagro/Boedo") que antes daba 0 ahora devuelve las 4
        escape rooms reales (Caballito ×3, Almagro/Boedo ×1) con sus cards. El sobre-filtrado quedó
        resuelto sin cambiar de modelo → **NO hizo falta Sonnet 5** para este síntoma.
      - [x] **A/B de modelo Haiku 4.5 vs Sonnet 5 — narración de tools y voz** (2026-07-26): variable
        controlada = solo el modelo (swap por `app_settings`, MISMO prompt en ambos). 3 casos idénticos
        en conversaciones frescas, verificados en vivo (Playwright/ngrok, cuenta premium con cupo 30).
        **Resultado:**
        - **Caso narración** ("Somos como 20… cumpleaños en Palermo"): **Haiku NARRA el retry**
          ("parecería que no hay lugares tagueados para grupos grandes… Pero te hago una búsqueda más
          abierta…"). **Sonnet NO narra**: tira las 5 opciones directo y cierra con "así te afino la
          búsqueda".
        - **Caso voz** ("che, ¿me tirás algo tranqui para charlar por Villa Crespo?"): **Haiku vuelve a
          narrar** ("Uh, con ese filtro no salió nada. Probemos sin 'tranqui'…"). **Sonnet hace un pivot
          elegante** sin exponer el mecanismo ("No hay mucho bar puramente en Villa Crespo, pero sí
          buenos cafés para charlar tranqui…") + voz más rica ("piolas", "ahí nomás", "¿Te sirve?").
        - **Regresión escape-room** (no debía romperse): **ambos ✅** devuelven las 4 salas reales sin
          narrar (la búsqueda acierta al primer tiro → no hay retry que narrar).
        **Diagnóstico:** la narración se dispara SOLO cuando la 1ª búsqueda vuelve vacía y el modelo
        reintenta; la instrucción negativa "reintentá en silencio" (✗/✓ del prompt) **no es confiable en
        Haiku** — es el límite que la decisión 3 del spec previó. Sonnet respeta la instrucción y además
        maneja la voz sin desliz. **Costo:** Sonnet ≈ **3×** por token (Haiku $1/$5, Sonnet $3/$15 in/out
        por millón, `lib/ai/logging.ts`); el system prompt cacheado abarata el input, el delta lo domina
        el output. **Recomendación:** Sonnet mejora claramente los DOS síntomas abiertos (no-narración +
        voz) sin romper la regresión; si la voz/prolijidad es prioridad de producto, el swap lo justifica
        (se cambia con un UPDATE, sin deploy). Alternativa si se quiere seguir en Haiku por costo: NO hay
        palanca de prompt confiable para la narración en modelo chico — quedaría suprimir el retry
        automático (menos cobertura de sobre-filtrado) o tolerar la narración.
        **DECISIÓN DE FER (posterior al test):** se adoptó **Sonnet 5** como default del chat — el swap
        se aplicó en `app_settings` (`ai.chat_model = "claude-sonnet-5"`, confirmado en runtime el
        2026-07-27). La voz/prolijidad se priorizó sobre el costo. La línea previa ("revertido a Haiku
        tras el test") describía el estado inmediato del A/B, no la decisión final. Registrado también en
        `CLAUDE.md` § Modelo del chat IA y en la memoria [[chat-modelo-sonnet]].
      - [x] **Tuning sobre Sonnet 5 + fix de la trampa de `precio`** (sesión dedicada, 2026-07-27):
        con el default ya en Sonnet 5, se corrió un banco de eval (reusa prompt+tool+motor reales, imprime
        los tool-inputs que elige el modelo + nº de resultados + texto — la evidencia que pedía este ítem,
        sin gastar cupo) sobre 6 casos. **Confirmado:** los 3 criterios de la sesión (no narrar el mecanismo ·
        voz rioplatense sin slang inventado · no sobre-filtrar) **se cumplen con Sonnet + el prompt** en los 6
        casos — el síntoma de narración/voz quedó cerrado por la decisión Sonnet. **Hallazgo nuevo con
        evidencia (no cubierto por el A/B):** la faceta `precio` está **muerta** en el catálogo
        (`precio-1=0, precio-2=1, precio-3=0, precio-4=0` en toda la base), pero el prompt **empujaba**
        `precio-1/2` para "barato/económico" → por el AND entre facetas, cualquier consulta con "barato" caía
        a 0 y forzaba un retry (misma clase de sobre-filtrado que escape-room, en la frase más común que existe).
        **Fix (`lib/ai/prompts.ts`):** (a) la guía de PRECIO ahora dice explícito que no se filtra por precio
        (faceta sin cargar) y que "barato" se maneja en el texto, no como filtro; (b) el ejemplo "parrilla barata"
        se corrigió para NO mandar `precio-1`; (c) bullet en ÚLTIMO CHEQUEO: sacar cualquier `precio-*` antes de
        buscar. **Verificado (eval):** "parrilla barata" y "algo barato" pasaron de 2 rondas (precio→0 + retry) a
        **1 ronda** limpia; escape-room/grupos/tranqui sin regresión. **Guard extra (caso 6):** el modelo partía
        `[bar,cerveceria]` en 3 búsquedas aunque la 1ª ya alcanzaba (mismo faceta = ya suman OR); se agregó una
        línea en CÓMO REFINAR que lo baja de 3 a 1-2 búsquedas (mejora soft de latencia/costo, sin tocar
        correctitud). **Verificado en vivo** (Playwright/ngrok, cuenta premium): "parrilla barata en Caballito"
        (4 cards, texto maneja el precio con gracia, sin narrar) y regresión escape-room (3 salas, tags
        `Club de juegos`+`Escape room`, sin ambiente, sin narrar). typecheck + tests `lib/ai` (19/19) verdes.
        **Nota:** el motor NO se tocó — el arreglo es que el modelo pida bien (prompt), como manda la sesión.
- [ ] **Chat IA — copy del gate premium sin cupo acoplado a la fecha de reset (F2, nota 2026-07-25).**
      El banner "Se renueva el 1º del mes que viene" es **correcto hoy**: el cupo se cuenta por mes
      calendario (`chat_usage_monthly` keyed por `YYYY-MM`, `lib/ai/cupo.ts`), reset el 1º —
      **desacoplado** de la fecha de cobro de MercadoPago (que cae cualquier día). Riesgo latente: si
      el reset dejara de ser calendario, el copy mentiría. Opción de robustez: wording sin fecha dura
      (p.ej. "el mes que viene tenés tus mensajes de nuevo"). No urge; es solo si se quiere desacoplar
      el texto de la implementación.
- [x] **NO ES BUG — "búsqueda por zona trae lugares de zonas no adyacentes"** (investigado
      2026-07-26; ver `docs/qa/AnalisisQA.md` § Investigación — zona no adyacente, IDs
      ZON-BUG-01..05). **La data, los scripts y el motor son correctos.** El síntoma es la
      **decisión 5 de ZONAS (buffer de búsqueda de 400 m) funcionando como se especificó.**

      **El diagnóstico previo estaba errado en dos premisas, ambas refutadas midiendo:**
      (1) suponía `la-boca-barracas` = La Boca + Barracas; en realidad son **4 barrios**
      (+ Nueva Pompeya + Parque Patricios, `scripts/zones/composicion.ts:48`), que **sí**
      lindan con Boedo y con Parque Chacabuco (dentro de caballito, `composicion.ts:51`) — el
      bbox de ~12 km "sospechoso" es correcto. (2) llamaba "geométricamente imposibles" a
      asignaciones que están **todas dentro de los 400 m** del borde de su zona.

      **Evidencia dura:** auditadas **12.122/12.122** filas no-primarias de `place_zones`, todas
      ≤400 m del borde exacto de su zona (**cero** violaciones). "Parrilla el Nuevo Miguelito"
      (primaria Caballito) está a 98 m de almagro-boedo y 241 m de la-boca-barracas — esquina
      real, no imposible.

      **Por qué se percibe como error (producto, no bug):** las zonas chicas de CABA tienen un
      buffer proporcionalmente enorme (almagro-boedo: 6,66 km² exacta → 12,05 km² con buffer,
      **+81 %**), así que ~45 % de los resultados tienen primaria en una zona **adyacente** y la
      card muestra esa primaria. **Decisión de Fer 2026-07-26: documentar y no tocar** (el
      comportamiento es el especificado). **Lever si molesta en uso real** → siguiente ítem.
- [ ] **Producto — revisar el buffer de búsqueda de zonas (decisión 5 de ZONAS)** — abierto
      2026-07-26 a partir de la investigación de arriba. Con 400 m fijos, casi la mitad del área
      de búsqueda de una zona chica de CABA es el anillo de afuera ⇒ mucha "fuga" a zonas
      adyacentes. Levers medidos: **bajar `BUFFER_M`** (`scripts/zones/load.ts:23`) — con ~150 m,
      `z=almagro-boedo t=escape-room` daría **1** y las parrillas foráneas caerían ~70 %; o
      **filtrar solo por primaria** (cero fuga, pierde el descubrimiento de borde de la decisión
      5); o **mantener el buffer y arreglar la card** (etiquetar el match de borde). Cambia una
      decisión de un spec cerrado (ZONAS done): es decisión de producto, no urge.
- [x] **El chat IA no cuenta impresiones/vistas para las estadísticas del dueño** (QA integral
      INT-05, 2026-07-26). **Resuelto ✅ 2026-07-27** en el mini-spec `PULIDO`: `lib/ai/chat.ts`
      llama `registrarImpresiones` sobre los lugares efectivamente citados al final de cada
      turno, mismo patrón agregado que búsqueda/ficha. [Resumen](../archive/SPECS_ARCHIVO.md#pulido)
- [x] **`/api/mi-negocio/[placeId]/content` valida la forma antes de chequear ownership** (QA
      integral INT-14, 2026-07-26). **Resuelto ✅ 2026-07-27** en el mini-spec `PULIDO`:
      `verificarDueno` exportado de `lib/negocio/acciones.ts` y llamado en el route ANTES del
      `safeParse` — un no-dueño recibe 403 sin importar la forma del payload.
      [Resumen](../archive/SPECS_ARCHIVO.md#pulido)
- [ ] **Filtro "Abierto ahora"** — el tag existe en la taxonomía pero no se muestra en v1:
      el catálogo no tiene horarios (Overture no trae; Google no deja cachear). Se activa
      cuando haya masa de horarios propios de dueños. Decidido en el spec BUSQUEDA (2026-07-19).
      → **spec: `docs/specs/planned/ABIERTO_AHORA.md`** (escrito 2026-07-29). Scope decidido por
      Fer: **F1 = chip «Para ahora»** por franja horaria sobre los tags de Momento curados (~670
      lugares, costo $0, no promete "abierto") + **retirar el tag `abierto-ahora`**, que la
      curaduría le puso a 20 lugares y **miente por construcción** (estático para un concepto que
      depende de la hora). **F2 = abierto real** desde horarios de dueño, escrita y **gateada** en
      ≥ 50 publicados con horarios cargados (hoy: **1**). Google en vivo descartado: ~US$0,64 por
      página de 20, no cacheable.
      > **F1 implementada ✅ 2026-07-30** (`lib/search/ahora.ts` + `lib/search/chips.ts`; el tag
      > quedó `active=false` con sus 20 filas de `place_tags` intactas). Este ítem queda abierto
      > **solo por la F2**: reabrirlo cuando la consulta del gate dé ≥ 50 —
      > `select count(*) from place_owner_content oc join places p on p.id = oc.place_id where
      > oc.opening_hours is not null` cruzado con `publishedWhere`— y ahí decidir exacto puro vs
      > híbrido (decisión 13). Spec en `docs/specs/active/ABIERTO_AHORA.md`.
- [x] **Favoritos / listas guardadas** — free: 1 lista ("Mis lugares") · premium: listas
      múltiples con nombre. Decidido fuera de v1 el 2026-07-19 (tanda 5) para no agrandar
      el alcance. Ver `docs/product/IDEAS.md` § Monetización. **Implementado entero: F1
      2026-07-30 + F2 2026-07-31.**
      → **spec: `docs/specs/done/FAVORITOS.md`** (escrito 2026-07-29). Dos tablas nuevas, gate
      server-side desde el día 1, bajar de plan **oculta y no borra**, botón como *slot* en
      `PlaceCard` (que sigue siendo presentación pura), página `/mis-lugares`, y la métrica
      agregada `saves` se **empieza a contar ya** porque el unsave borra la fila y el histórico no
      se reconstruye. 2 fases.
- [x] **Rotación de los chips de Ocasión de la home** por día/hora (martes 18h → "After office")
      ✅ **2026-07-31** → spec: `docs/specs/done/CHIPS_ROTACION.md` ·
      [Resumen](../archive/SPECS_ARCHIVO.md#chips_rotacion). Reglas en `app_settings`
      (`chips.schedule`) — cero migración, se cambian con un UPDATE; degradan al orden por `sort`
      si el setting es inválido (la home no puede romperse por un UPDATE mal tipeado). Arranca con
      **3** reglas de sentido común —la tercera se agregó al implementar, porque las dos originales
      nombraban chips que ya estaban en la home a toda hora—; **afinarlas con datos de uso reales
      (`place_tag_impressions_daily`) sigue siendo el v2 y no se hizo acá**.
- [x] **Sugerir lugar en una votación** (que los votantes agreguen opciones) ✅ **2026-07-31**
      → spec: `docs/specs/done/SUGERIR_EN_VOTACION.md` · [Resumen](../archive/SPECS_ARCHIVO.md#sugerir_en_votacion).
      Entregado tal cual se decidió: sugiere **cualquiera con el link** (sin cuenta), techo total de
      **8**, **2** por dispositivo, el creador quita sugerencias (nunca sus originales) y puede
      apagar las de su votación. **Nunca texto libre**: solo `place_id` publicado, validado
      server-side. La reversión de la decisión 2 de VOTACION quedó anotada en su tabla.
- [ ] **Descuento escalonado multi-local en el plan de dueño (B2B)** — base por lugar
      (2do local -X%, 3ro -Y%, etc.) para el dueño de varios locales. Puerta abierta el
      2026-07-24; el modelo por-lugar del spec 7 lo permite sumar después sin romperse. Ver
      `docs/product/IDEAS.md` § Monetización (B2B).
- [ ] **Carga de lugares por consumidores** — requiere sistema de moderación/reportes.
- [ ] **Verificación automatizada de dueños** — en v1 la aprobación es manual en `/admin`.
- [ ] **Refresh anual del `google_place_id`** — Google recomienda refrescarlo a los 12 meses
      y vía Place Details *IDs Only* es gratis. Decidido fuera de v1 en el spec FICHA
      (2026-07-19): con el catálogo recién nacido no hay IDs viejos que refrescar.
- [ ] **Batch de matching Overture↔Google** — precalentar `google_place_id` de todo el
      catálogo en vez de resolverlo perezosamente al abrir cada ficha. Cuesta $0 (IDs Only)
      pero son ~27.000 requests para lugares que quizá nadie visite. Ver spec FICHA.
- [ ] **Slug SEO en la URL de la ficha** — hoy `/lugar/[id]` con uuid (fijado en BUSQUEDA).
      Un `/lugar/nombre-zona-xxxx` ayuda al descubrimiento orgánico.
- [ ] **`/admin` para corregir matches de Google** — en v1 se corrige por `UPDATE`
      documentado, igual que el umbral de confidence.
- [x] **Identidad visual: aplicar el logo y la paleta definitivos** (2026-07-21). **Hecho ✅
      2026-07-23** en el mini-spec HOME_IDENTIDAD ([resumen](../archive/SPECS_ARCHIVO.md#home_identidad)).
      Ya están
      diseñados y fijados en **`docs/product/IDENTIDAD.md`** (hex, significado del logo,
      contrastes WCAG medidos y jerarquía propuesta). Se aplican como tarea propia, no
      mezclados con un spec. La UI usa tokens (`globals.css`), así que el grueso es cambiar
      variables — pero hay **tres focos fuera de los tokens**: `lib/email/index.ts` (hex
      hardcodeado, y el CTA debe ser color plano: Outlook ignora gradientes), los pins del
      mapa en `map-view.tsx` / `pin-picker.tsx` (`#e11d48`), y los 4 colores del logo de
      Google en `ficha-google.tsx`, que **no se tocan**. Falta además una **versión monocroma
      del wordmark** (el gradiente no sobrevive a 28-32 px ni al mail) y sumar el logo a la
      home, que hoy es un `h1` de texto.
- [x] **Home: ¿landing o buscador de una? + pulido del estado vacío** (duda de UI/UX,
      2026-07-23). **Hecho ✅ 2026-07-23** en el mini-spec HOME_IDENTIDAD
      ([resumen](../archive/SPECS_ARCHIVO.md#home_identidad)): buscador de una confirmado, estado
      vacío convertido en mini-landing (hero + headline rotativo). **Track de UX, NO un spec de
      features — separado de Monetización.**

      **La duda.** Al entrar a `adondesalimos.com.ar`, ¿el usuario cae directo al buscador o
      hay una landing? Hoy es buscador de una (BUSQUEDA decisión 1: *home = search*).

      **Recomendación (Claude, a validar con Fer): mantener buscador de una, sin landing
      separada.** Razones: (1) la promesa es velocidad —una landing con hero/CTA mete un click
      entre el usuario y lo que vino a hacer; (2) el punto de entrada **viral no es el home**
      sino `/votacion/[token]` y las fichas compartidas, así que el home casi nunca es la
      primera impresión del que llega nuevo. **La vuelta:** el **estado vacío** del home
      (primera visita, `tieneBusqueda` = false) hace de **mini-landing** — hero cálido, frase de
      valor, los **chips de Ocasión como gancho**, un hint de cómo funciona; se colapsa apenas
      se busca. Ya calza con la arquitectura (el home renderiza distinto sin búsqueda). Una
      landing de marketing completa queda para cuando se vaya a prod/SEO — anotada como opción,
      no decidida.

      **Voz del hero (importante, corregido por Fer 2026-07-23): argentino rioplatense, NO
      neutro.** El "¿Qué se te antoja?" que se había propuesto **no se usa acá** — suena a
      doblaje. Las que van: **"¿Qué sale?"**, **"¿Qué pinta?"** o simplemente **"¿Qué
      hacemos?"**. Idea linda: **rotar las tres** como headline del hero (aleatorio o por
      día/hora), le da vida. (Distinto de rotar los *chips* mismos, que es otro ítem de abajo.)
      Regla general que sale de esto: **todo el copy de la app va en argentino rioplatense,
      evitar el español neutro** — principio de voz, no solo para este texto.

      **Pulido (para que no parezca amateur, acotado, NO rediseño).** Foco en ese estado vacío
      + **aplicar la identidad visual ya definida** (`docs/product/IDENTIDAD.md` + la pieza
      original `docs/product/assets/logo-identidad.png`, ver ítem de identidad arriba). Concreto:
      - **Sumar el logo a la home** — hoy es un `h1` de texto pelado; va el wordmark real (pin +
        "¿A DÓNDE SALIMOS?"). OJO: hace falta la **versión monocroma del wordmark** para el
        header chico (el gradiente colapsa a 28-32 px) — ver aviso en `IDENTIDAD.md`.
      - **Swap de paleta**: lo que corre hoy (negro `#0F0F0F` + ámbar `#F59E0B`) es **placeholder
        de dev copiado de StressPlan**. La paleta real es la de `IDENTIDAD.md`: acción primaria
        **naranja `#FF8A00`** (reemplaza al ámbar, mismo contraste ⇒ casi solo swap de variables
        en `globals.css`), fondo **`#0D0D1F`** (azulado), y rosa/violeta/turquesa/amarillo para
        categorías. Los tres focos fuera de los tokens (mails, pins del mapa, logo de Google que
        NO se toca) están listados en `IDENTIDAD.md`.
      - Jerarquía tipográfica del hero, chips como protagonistas, spacing.

      Se solapa con la tarea de identidad — conviene hacerlos **juntos como una sola pasada**:
      el mini-spec sería *"home + identidad"* (estado vacío con onda + logo + swap de paleta).
- [x] **Header de marca global — llevar el wordmark fuera del Home** (UX/marca, 2026-07-23,
      surgido en la QA de HOME_IDENTIDAD). **Resuelto ✅ 2026-07-27** en el mini-spec `PULIDO`:
      `components/shared/brand-header.tsx` (nuevo) suma el `Wordmark` en ficha, `/cuenta`,
      `/mi-negocio` (lista y editor) y `/votacion/[token]`, arriba del header propio de cada
      página, sin recolorear controles. [Resumen](../archive/SPECS_ARCHIVO.md#pulido)
- [x] **`EXISTS` con `${places.id}` sin calificar en `lib/search/query.ts`** (AUTH F2,
      2026-07-21). **Cerrado ✅ 2026-07-31 sin refactor: no era un bug.** La premisa —"Drizzle
      renderiza `"id"` sin el nombre de la tabla dentro de un subquery"— estaba mal generalizada.
      Medido sobre drizzle-orm 0.45.2: Drizzle omite la tabla **solo en la lista de SELECT**, y
      ahí vivía el H-1 real de `lib/claims/query.ts` (el flag `reclamado` era un campo del
      SELECT). Los `EXISTS` de `filtrosDeTags`/`filtroDeZonas` están en el **WHERE** y salen
      calificados (`pt.place_id = "places"."id"`): seguirían andando aunque `place_tags`/
      `place_zones` ganaran un `id`. No se pasó a `leftJoin` — habría tocado el camino crítico de
      la búsqueda para arreglar nada. Quedó el riesgo real nombrado en comentario (*no mover esos
      fragmentos a una posición de SELECT*) y corregida la afirmación general en
      `lib/claims/query.ts`. Ver `docs/qa/AnalisisQA.md` § *Pase de deuda técnica*, DEUDA-07/08 y H-1.
- [x] **Las fotos del dueño no se ocultan al revocar el reclamo** (AUTH F3, 2026-07-21).
      **Resuelto ✅ 2026-08-03** junto con `INT2-33` (ver arriba): se gatean **los dos** lugares que
      deciden sobre fotos, que es exactamente lo que este ítem advertía. **Ocultar, no borrar** —
      las filas y los objetos en R2 quedan intactos.
      **Lo que este ítem proponía y NO se hizo** (sigue abierto abajo, como ítem propio): que el
      admin pueda además **borrar** las fotos cuando revoca por abuso.
      _(Detalle original, para contexto:)_
      🔸 **Tiene una decisión de producto abierta adelante — ver `docs/product/IDEAS.md`
      § Usuarios y roles.** No implementar hasta que esté resuelta.

      **Estado hoy.** AUTH-13 pide "contenido de dueño oculto". El contenido de
      `place_owner_content` ya se oculta (el COALESCE está condicionado a tener claim
      aprobado), pero `place_photos` sigue mostrándose: `fotosDeDueno` lee por `place_id` y no
      pregunta si hay dueño. **Decisión consciente, no bug** — ver `docs/qa/AnalisisQA.md` §
      AUTH F3, H-2.

      **Alcance real.** Solo afecta a lugares `source='overture'` con confidence sobre el
      umbral: siguen publicados por la regla normal y conservan las fotos del ex-dueño. Un
      `source='owner'` revocado pierde el `publish_override` y su ficha da 404, así que no lo
      ve nadie. **Hoy no hay dueños reales ⇒ exposición cero.**

      **Trampa técnica: hay que tocar DOS lugares o ninguno.** Deciden sobre fotos
      `fotoPrincipal` (`lib/lugar/ficha.ts`) y el chequeo `tieneFotoDueno` de
      `getPlaceForEnrichment` (`lib/lugar/matching.ts`). Si se gatea solo el primero, la ficha
      cae a Google pero el endpoint de enriquecimiento **sigue viendo las filas** en
      `place_photos`, cree que hay foto de dueño y no le pide la foto a Google ⇒ la ficha
      queda **sin ninguna foto**. Peor que ahora. Media corrección rompe más de lo que arregla.

      **Recomendación: hacerlo depender del motivo de la revocación, no revocar y listo.**
      Hoy `decidirClaim` trata igual dos casos que no lo son: revocar **por abuso** (se hizo
      pasar por dueño, subió fotos ofensivas) donde las fotos tienen que desaparecer ya, y
      revocar **por corrección** (el local cambió de manos, se equivocó el admin) donde las
      fotos son una contribución real al catálogo y borrarlas es tirar el valor que el free
      generoso vino a comprar. Lo más barato que resuelve las dos: **un checkbox "quitar las
      fotos" en el rechazo de `/admin`**, default apagado, que borra filas + objetos de R2
      reusando `limpiarFotosDeUsuario`. Evita la trampa de arriba por completo —no gatea nada,
      borra— y le da al admin la única información que el código no puede deducir: por qué
      revocó.
- [x] **Revocar por abuso debería poder borrar las fotos, no solo ocultarlas** (desprendido del
      ítem de arriba al resolverlo, 2026-08-03). **Resuelto ✅ 2026-08-03, pero NO como decía este
      ítem: la capacidad sí, el botón no.** Quedó `borrarFotosDeLugar(placeId)` en
      `lib/negocio/acciones.ts` (y `limpiarFotosDeUsuario` ahora **delega** en ella, en vez de tener
      su propia copia de la regla) + el script `npm run fotos:borrar -- <placeId>`, que lista las
      fotos, avisa que borra filas **y** objetos de R2, y exige que el operador **escriba el nombre
      del lugar** para confirmar. Sin `--force`, sin y/n.
      **Por qué no el checkbox que este ítem proponía:** es la única acción irreversible del
      producto (el objeto de R2 no vuelve) y no tiene por qué estar a un click en `/admin`, donde un
      mis-click destruye las fotos de un dueño legítimo. El argumento a favor del checkbox era *"le
      da al admin la información que el código no puede deducir: por qué revocó"* — pero eso **ya se
      persiste**: el rechazo tiene textarea obligatoria y se guarda en `place_claims.admin_notes`.
      La limpieza puede ocurrir después sin perder información.
      ⚠️ **Dos correcciones a la propuesta original, verificadas en el código:** (1)
      `limpiarFotosDeUsuario` **no servía "tal cual"** — es por **usuario** (borra las fotos de
      *todos* sus lugares) y revocar es por **lugar**; reusarla habría borrado fotos de lugares con
      el reclamo todavía aprobado. (2) Borrar el objeto **no es un botón de olvido**: se sube con
      `immutable, max-age=31536000`, así que lo que el CDN ya cacheó sigue sirviéndose. La clave sí
      lleva un uuid, o sea la URL no es adivinable — el expuesto es quien ya la tenía.
- [ ] **Reordenar las fotos del panel** (AUTH F3, 2026-07-21). `place_photos.sort` existe y
      la ficha usa la primera como portada, pero el editor no deja arrastrar: hoy el orden es
      el de subida y para cambiar la portada hay que borrar y volver a subir. Drag & drop o
      un botón "poner de portada".
- [x] **Las fotos se guardan tal cual las sube el dueño** (AUTH F3, 2026-07-21; encuadre
      corregido el mismo día). **Resuelto ✅ 2026-07-27** en el mini-spec `PULIDO`:
      `app/mi-negocio/[placeId]/fotos-editor.tsx` redimensiona en el browser antes de subir
      (canvas → `toBlob('image/webp')`, tope 1600 px de lado mayor) — verificado en vivo: JPEG
      de 267 KB / 3000×2000 → webp de 17,5 KB. Límite de 5 MB y validación server-side sin
      cambios (el cliente no es boundary de seguridad). [Resumen](../archive/SPECS_ARCHIVO.md#pulido)
- [x] **El bbox de AMBA está escrito dos veces** (AUTH F2, 2026-07-21). **Resuelto ✅ 2026-07-31**
      (pase de deuda): el dueño único es **`lib/geo/amba.ts`**, un módulo sin ningún import —
      así el script de import no arrastra `lib/claims`, que era la restricción que tenía frenado
      el cambio. `scripts/import-overture.ts` y `lib/claims/validacion.ts` lo consumen; el test
      de validación importa del dueño nuevo. Ampliar la cobertura ahora se toca en un solo lado.
- [ ] **Medir la tasa de falsos positivos del matching a ciegas** (FICHA F2, 2026-07-20).
      Primer caso real: "Club Milanesa @ Av. Libertador 3883" matcheó a "El Club de la Milanesa
      – Paseo de la Infanta" (~160 m, misma marca), mientras esa dirección exacta en Google es
      "Williamsburg Infanta". Es el riesgo que la **decisión 8** aceptó (IDs-Only $0 ⇒ sin nombre
      ni distancia para comparar; salvaguardas solo de entrada, ±300 m). **Riesgo aceptado por
      Fer (2026-07-20): no se toca nada del código por ahora.** Antes de decidir si se achica el
      radio, hacer el spot-check de FICHA-03 (10 fichas) para saber si la tasa es 1% o 20%.
      Opciones si molesta: radio menor (pierde matches con pin corrido), Text Search Pro para
      verificar nombre/distancia (rompe el modelo $0, $32/1.000), o corrección manual
      (`google_match_status='blocked'|'manual'`, la red actual). Ver `docs/qa/AnalisisQA.md`
      § FICHA F2 (FICHA-03) y `docs/operations/LECCIONES_APRENDIDAS.md`.
- [ ] **Nombres imperfectos de Overture en la ficha** (FICHA F2, 2026-07-20). La ficha muestra
      "Club Milanesa" y el nombre real es "El Club de la Milanesa". El nombre sale **siempre de
      Overture, nunca de Google** — por ToS (no se persiste el nombre de Google), costo
      (`displayName` es tier Pro, ni se pide) y diseño (decisión 13). Se corrige con curaduría
      o con el reclamo del dueño (spec 5), no trayendo el nombre de Google. Calidad de dato de
      origen, no bug.
- [ ] **Horario de cierre del día en la ficha ("cierra 0:30")** (FICHA F2, 2026-07-20). El
      bloque de Google muestra abierto/cerrado (`openNow`) + la semana completa
      (`weekdayDescriptions`), no la hora de cierre de hoy que dibuja el mockup. Derivarla
      exige la zona horaria del lugar y parsear `periods`/`nextCloseTime` — no entró en F2
      porque `openNow` + la semana ya cumplen el criterio FICHA-07. Cosmético.
- [ ] **Íconos de marca en las redes de la ficha** (FICHA F1, 2026-07-20). Las redes se
      muestran como chips de texto ("Instagram", "Facebook", "X", "TikTok") porque
      `lucide-react` removió los íconos de marca. Cuando se quiera el ícono, traerlos como
      SVG propios o de otra librería. `clasificarRed` ya devuelve la plataforma; solo falta
      el mapeo a ícono. Cosmético, no bloquea.

- [ ] **`operating_status` no filtra nada todavía** — Overture entrega el campo NULL en el
      100% de los 26.057 lugares de AMBA, y el import los persiste como `'open'`. El filtro
      está implementado y testeado, pero hoy no descarta a nadie. Búsqueda **no debe asumir**
      que ya oculta lugares cerrados; revisar cuando Overture empiece a poblarlo o cuando
      entren lugares de dueño (spec 5). Ver `docs/qa/AnalisisQA.md` § CATALOGO, hallazgo H-2.
- [ ] **Zonas faltantes del conurbano — 2.200 lugares (8,4%) sin zona** (ZONAS, 2026-07-20).
      El canon de 46 no incluye partidos densos y céntricos: José C. Paz (153 lugares),
      Gregorio de Laferrere (147), General Rodríguez (131), González Catán (113),
      Hurlingham (101), Ezeiza (84), Isidro Casanova (84), Longchamps (83), Guernica,
      Grand Bourg, San Vicente, Marcos Paz. **El spec anticipaba que los sin zona serían
      "minoría en los bordes del bbox"; no es así — están en el medio del conurbano.**
      No es un bug de implementación: es un hueco del canon. Decidir si se agregan zonas
      (deja de ser 46 y hay que actualizar el spec) o si se acepta que esos lugares solo
      aparezcan por texto y GPS. Ver `data/zones/README.md` § Cobertura real.
      **No bloquea BÚSQUEDA** (spec 3): el selector lee la tabla `zones`, así que agregar
      zonas después no toca código de Búsqueda — se re-corre `zones:build` + `load` +
      `assign` y listo. Conviene decidirlo **con el buscador andando**, para saber si el
      8,4% molesta en la práctica o es invisible.
- [ ] **Villa Lugano, Villa Soldati y Villa Riachuelo cuelgan de `flores-floresta`**
      (ZONAS, 2026-07-20). El canon no tiene una zona del sur de CABA, así que esos tres
      barrios quedan en una zona cuyo nombre no los menciona. Es el reparto más discutible
      del mapa de CABA; dejarlos sin zona hubiera sido peor. Candidato a zona propia.
- [ ] **Afinar el polígono de Las Cañitas** (ZONAS, 2026-07-20). Es algo más ancho que la
      franja gastronómica de Báez e incluye parte del Campo de Polo y los cuarteles: 52
      lugares publicados por km² contra ~315 de Palermo Soho. Nombre y ubicación correctos,
      precisión mejorable. Curaduría, no código.
- [ ] **Volver a ARBA para los partidos si arreglan el servidor** (ZONAS, 2026-07-20).
      `limite-partidos-pba.zip` es CC BY 4.0 —licencia estándar y trazable, mejor que los
      TyC propios del IGN— pero hoy el servidor entrega 97.071 bytes de los 7.796.169
      declarados, de forma determinística. Se usó IGN como fallback.
- [ ] **La faceta Precio está vacía: 0 filas en `place_tags`** (BUSQUEDA, 2026-07-20). Los 4
      tags `precio-1..4` existen y no los usa ningún lugar. No es un bug del import: Overture
      no trae precio y `places` no tiene columna de la que derivarlo. Google sí expone
      `price_level`, pero es dato de Google — mostrable en vivo en la ficha, **no persistible
      ni filtrable** (ToS). Se llena solo con curaduría o con dueños (spec 5). Hasta entonces
      el filtro de Precio se muestra pero cualquier combinación que lo use da cero.
      **Decidido en F2 (2026-07-20): se oculta** — decisión 27 del spec, un tag con cero
      lugares no se lista y una faceta que queda vacía tampoco. Reaparece sola cuando haya
      datos, sin deploy. Lo que sigue abierto es **cargar los precios**, que es curaduría.
- [ ] **Actividad está pegada a un solo Tipo: cruzar las dos facetas da casi siempre cero**
      (BUSQUEDA, 2026-07-20). 12 de 13 tags de Actividad conviven con exactamente un Tipo
      (`musica-en-vivo` solo con `teatro-espacio-cultural`, `dj` solo con `boliche`…), porque
      `lib/overture/tag-map.ts` mapea cada categoría de Overture a un Tipo y una Actividad
      a la vez. No es un bug del motor de búsqueda: la semántica AND funciona, los datos no la
      acompañan. Se despega con curaduría o dueños, o revisando el tag-map para asignar
      Actividad por otros criterios además de la categoría.
- [ ] **Cobertura rala de Ambiente (0,9%) y Momento (0,6%)** (BUSQUEDA, 2026-07-20). El import
      de Overture casi no las llena — la decisión 20 del spec lo anticipaba, la magnitud no.
      Son el diferencial del producto y hoy están casi vacías: es la carga de curaduría más
      grande pendiente. Ver la medición en el spec BUSQUEDA § *Medición de cobertura*.
- [x] **`zone_aliases` tiene 4 filas: el autocompletar por alias casi no tiene con qué**
      (BUSQUEDA, 2026-07-20). **Resuelto ✅ 2026-07-27** (batch limpieza): se cargaron **74 alias
      nuevos** (78 en total) barrio/localidad → zona, **validados por dato** (query de coordenadas
      contra `place_zones`, no a ojo — corrigió varias corazonadas: Turdera es Temperley no Lomas,
      Villa Bosch es Caseros no San Martín, La Paternal es Villa del Parque no Chacarita). Fer los
      revisó/aprobó por región; Gerli→Lanús (empate 14/14) y Florida descartado (colisión con la
      peatonal). Se cruzó con la propuesta de 2 IAs externas. Quedaron **fuera**: localidades del
      conurbano profundo sin cobertura de zona (González Catán, Longchamps, Hudson…), y los hitos/
      POIs (ver ítem nuevo abajo). En `lib/zones/canon.ts` § ALIASES.
- [x] **Alias de hitos/POIs (Movistar Arena, Unicenter, DOT, La Rural, Puerto de Frutos…)**
      (batch limpieza, 2026-07-27). **Resuelto ✅ 2026-08-01**: **48 hitos** cargados. El método
      tuvo que cambiar sobre la marcha porque **el catálogo no sirve como fuente de hitos** —de 30
      probados, solo 5 tenían respaldo (Movistar Arena: **0 lugares**), ya que Overture trae
      gastronomía y un hito aparece solo si hay bares con su nombre. Así que las coordenadas
      salieron de **3 agentes independientes** y entra solo lo que ≥ 2 corroboran **con la misma
      zona** por point-in-polygon; el catálogo quedó de **árbitro** en los 7 conflictos, y **en 3
      le ganó a los agentes** (Distrito Arcos es palermo-soho, no Hollywood). Campo de Polo quedó
      afuera: lo parten dos zonas. Ver QA `ALIAS-04..07`.
- [x] **Alias de CABA sistemáticos desde el GeoJSON oficial de BA Data** (idea de Fer, 2026-07-27).
      **Resuelto ✅ 2026-08-01**: el cruce por solapamiento con turf dio que los **48 barrios ya
      estaban cubiertos en un 79 %** —30 matchean por nombre de zona y 8 eran alias— y faltaban
      **8**, todos con 100,0 % de solapamiento (Agronomía, Villa Real, San Cristóbal, Parque
      Chacabuco, Mataderos, Villa Lugano, Villa Soldati, Villa Riachuelo). La idea rindió menos en
      volumen y más en **certeza**: ahora hay un test que afirma que los 47 barrios oficiales
      resuelven, y cazó que `Villa Gral. Mitre` no resolvía. La atribución de BA Data **ya estaba**
      en `/legales` desde el spec ZONAS: no hizo falta sumar nada. Ver QA `ALIAS-01..03, 09, 12`.
- [ ] **Sugerencias del campo de texto sin trgm** (BUSQUEDA, 2026-07-20). F2 matchea tags y
      zonas con substring sin acentos sobre el catálogo en memoria (~150 items), en vez del
      trgm que pedía la decisión 14 — evita un fetch por tecla y a esa escala el trigrama no
      cambia lo que el usuario ve. Si el catálogo de tags crece un orden de magnitud, mover a
      un endpoint con `word_similarity`, que es lo que ya usa la búsqueda por nombre de lugar.
- [~] **Chips de Ocasión objetivo — 7/9 prendidos** (BUSQUEDA F3 → CURADURIA F3 → batch limpieza,
      2026-07-27). La curaduría prendió `cumpleanos` (0→42 zonas), `after-office` (0→10),
      `salida-con-chongo` (0→2) y `primera-cita` (0→1); con `salir-a-bailar` (ya vivo) fueron **5/9**.
      El batch de limpieza (sacar el tag de Cocina que ANDeaba) prendió `merienda` (0→45) y
      `cena-familiar` (0→44) → **7/9**. Los **2 restantes en 0 no son curables** por
      Ambiente/Momento/Actividad — dependen de facetas que el batch no toca: `salida-con-amigos`
      (`precio-2`, Precio, 1 lugar) y `plan-tranqui` (`juegos-de-mesa`, Actividad, 2 lugares).
      Ver `docs/qa/AnalisisQA.md` § *CURADURIA F3* (decisión 12: documentado, no bloquea).
- [x] **Refinar la semilla de 2 chips donde la Cocina ANDea en vez de sumar** (hallazgo CURADURIA
      F3, 2026-07-27). **Resuelto ✅ 2026-07-27** (batch limpieza): en `lib/db/chips.ts` se sacó
      `pasteleria` de `merienda` (→ `cafe`+`merienda`) y `bodegon` de `cena-familiar` (→
      `restaurante`+`kids-friendly`+`cena`). Reseed dirigido (DELETE `chip_tags` de los 2 chips +
      `db:seed`, porque `sembrarChips` no reescribe tags de un chip existente). Cobertura: ambos
      pasaron de 0 a **45/46 y 44/46 zonas** → chips vivos **5/9 → 7/9**. Comentario stale de
      `pasteleria` en `taxonomy.ts` corregido. `pasteleria` queda en la taxonomía (tag válido, no
      lo usa ningún chip).
- [ ] **"Cenar afuera" devuelve 11.438 lugares en AMBA** (BUSQUEDA F3, 2026-07-20). Es el
      riesgo "devuelve 8.000 lugares" que IDEAS ya anotaba. En una zona concreta da 262-527,
      que es como se usa de verdad (la home pide zona primero), así que no bloquea. Se afina
      partiéndolo por Cocina cuando esa faceta tenga curaduría (hoy 37,7%).
- [ ] **Tocar un chip sin zona elegida busca en AMBA entera** (BUSQUEDA F3, 2026-07-20).
      `tieneBusqueda` se satisface con tags solos, así que un chip sin zona dispara una
      búsqueda de 18.993 paginada de a 20. No rompe nada y el resultado es honesto, pero
      contradice el espíritu de la decisión 2 ("zona es el gesto default"). Decidir si el chip
      abre el selector de zona en vez de buscar.
- [x] **Filtro fantasma: un tag activo con 0 lugares queda inquitable y cero-ea la búsqueda**
      (BUSQUEDA, observado 2026-07-23 durante la QA de HOME_IDENTIDAD). **Resuelto ✅ 2026-07-27**
      en el mini-spec `PULIDO`, con el arreglo robusto recomendado: `ChipsActivos`
      (`components/search/search-shell.tsx`) dibuja un chip removible para todo slug de
      `params.tags` aunque el catálogo no le dé label (fallback al slug legible en vez de
      `continue`). Verificado en vivo con `/?t=fiesta-tematica`. Sin test de regresión propio —
      el proyecto no tiene infraestructura de tests de componentes (todos los tests son sobre
      `lib/`); queda cubierto por el QA en vivo. [Resumen](../archive/SPECS_ARCHIVO.md#pulido)
- [ ] **Sobreconteo de impresiones con `gps=1` + zonas en la URL** (BUSQUEDA F3, 2026-07-20).
      El server renderiza por zona (no tiene coordenadas) y el cliente reemplaza al obtener
      permiso: esos 20 lugares suman impresión habiéndose visto un instante. Caso de borde de
      una métrica agregada; se arregla no registrando en el server cuando `params.gps` está
      prendido y todavía no hay coordenadas.
- [x] **RESUELTO (no era bug) — "el filtro de zona no restringe al cruzarlo con una actividad"**
      (observado 2026-07-20; verificado 2026-07-26, `docs/qa/AnalisisQA.md` ZON-BUG-05). Repro
      `/?z=almagro-boedo&t=escape-room` daba 3, no 1: *Club del Escape Palermo* y *Escape Juniors
      Caballito* además del de Almagro. La afirmación "están a mucho más de 400 m" era una
      **estimación visual, no medida** — al medir, Palermo está a **186 m** y Caballito a **359 m**
      del borde de almagro-boedo, o sea **dentro del buffer de 400 m** (decisión 5). El AND entre
      facetas es correcto; el buffer los explica. Mismo fenómeno que el ítem de arriba.
- [ ] **Regla compuesta de rescate de la cola** (confidence bajo + teléfono + redes ⇒ real) —
      quedó 💡 sin decidir. Hay 7.064 lugares bajo el umbral esperando; con el corte en la
      query, probarla es gratis.
- [x] **🌐 Hosting/prod = Neon + Vercel** (decidido por Fer 2026-07-27; ya corre turnia.com.ar con
      ese stack). **El checklist (a)-(d) se resolvió entero el 2026-07-31 y vive ahora en
      `docs/specs/planned/DEPLOY.md`** — no duplicar acá. En una línea cada uno: **(a)** migración
      por `pg_dump`/restore, con orden y punto de no retorno declarados (la curaduría no está en el
      seed); **(b)** Upstash Free, **después** del primer deploy, y el rate-limit sale degradado a
      propósito; **(c)** endpoint *pooled* con el `postgres-js` que ya está —`lib/db/index.ts` ya
      hace `prepare:false, max:1` en prod—, **sin** cambiar de driver, y las migraciones por el
      *direct*; **(d)** tabla de qué env var viaja y cuál no, donde las tres de MercadoPago **no
      viajan** y eso es exactamente lo que apaga el cobro. Los scripts offline siguen corriendo
      local contra Neon. Sin cron (expiración de votaciones lazy 72 h).

- [ ] **Rate-limit compartido en Upstash — F2 de DEPLOY** (decisión 12 del spec, 2026-07-31). El
      primer deploy sale con el contador **en memoria del proceso**, que en serverless se fragmenta:
      el límite se afloja tantas veces como instancias haya vivas. Se aceptó a propósito para no
      meter un proveedor nuevo en el mismo paso donde ya cambian base, hosting y dominio. **Dónde
      duele mientras tanto**: no en `/api/search` (raspar el catálogo es molesto, no caro) sino en
      **reclamos/altas** —3 por día por IP se vuelven 3 × instancias— porque cada fila la mira un
      humano en `/admin`. Upstash Free alcanza de sobra: 500.000 comandos/mes ≈ 8.000 requests/día
      a ~2 comandos cada uno. Trabajo: reescribir `lib/middleware/rate-limit.ts` (que ya es dueño
      único) contra Redis + adaptar sus tests. **Disparador para adelantarlo: el primer pico de
      altas basura en la cola de `/admin`.**

- [ ] **El copy del kill switch del chat promete una espera corta y el tope es mensual**
      (2026-07-31, al decidir bajar `ai.chat_monthly_cap` a 500 para el lanzamiento). Al llegar al
      tope, el usuario ve *"El chat está descansando un rato / Volvé más tarde y seguimos"*
      (`app/chat/chat-client.tsx`, y el 503 de `app/api/chat/route.ts`). Con el cap en 5.000 llegar
      era casi imposible; con 500 se vuelve plausible, y si se agota un día 5 el "más tarde" son 25
      días. No miente, pero promete implícitamente algo corto. Es un string —puerta de ida y
      vuelta—, así que no se tocó: se anota y se decide con el consumo real a la vista.

- [ ] **Dominios defensivos: `adondesalimos.com` y `.app` están libres** (verificado 2026-07-31 por
      RDAP). No se compran ahora (decisión 2 de DEPLOY): la audiencia es AMBA y tipea `.com.ar`, y
      es puerta de ida y vuelta. Reabrir si aparece intención de marca o tráfico de afuera. Dato
      para no repetir la búsqueda: `quesale.com.ar`, `quepinta.com.ar`, `salimos.com.ar` y
      `quesale.com` están **todos tomados**.

## Hecho

- [x] **`PBETA-R1-02` — que la primera pantalla no abra con Burger King** (2026-08-10, sesión
      Opus; spec escrito y ratificado por Fer esa misma mañana). Cerrado entero con
      [`ORDEN_ORGANICO`](../specs/done/ORDEN_ORGANICO.md)
      ([resumen](../archive/SPECS_ARCHIVO.md#orden_organico) ·
      [QA](../qa/AnalisisQA.md) § *QA /qa-spec — ORDEN_ORGANICO*, **APROBADO**, 11/11 checkers +
      10/10 casos en vivo · typecheck · **728/728** tests · build verde).
      **Qué cambió:** el orden orgánico pasó de `dueño > confidence > nombre` a
      `dueño > banda > confidence > nombre`. La banda es un entero 0-3 que combina **es cadena**
      (`search.cadenas` en `app_settings`, dueño único `lib/search/cadenas.ts`) y **está curado**
      (`place_tags source='admin'`), con la precedencia **cadena antes que curado**.
      **El efecto, medido en vivo sobre el catálogo real:** *Palermo Soho · Cenar afuera* pasó de
      `1 Burger King · 2 Subway · … · 10 McDonald's` a los siete lugares que el spec había puesto
      en su sección *Objetivo*, **en ese orden**; *Un café* abre con Mulata Café, Maricafe y Full
      City en vez de Starbucks. **29 de las 46 zonas cambiaron de #1 y ninguna perdió un lugar.**
      **Las tres cosas que valen más que el diff:**
      1. **La precedencia no era cuestión de gusto y estaba medida en el spec.** La curaduría curó
         **85 McDonald's y 41 Starbucks**, así que «curado primero» habría puesto Starbucks 2º y 3º
         en «Un café» — el spec lo anticipó, lo dejó como caso ORD-03 y el test lo defiende: la
         mutación que invierte la precedencia rompe 2 tests.
      2. **Orden y filtro se mantuvieron separados de verdad, no de palabra.** `construirWhere` no
         se tocó, y se verificó corriendo `cobertura-chips` con el `query.ts` de HEAD y con el
         nuevo: **`diff` vacío, byte a byte**. Ese es el DoD que protege el piso de los chips
         (`PISO_HOME` 20 / `PISO_ZONA` 3), que si se movía vaciaba la home sin que nadie tocara un
         chip.
      3. **El cursor no necesitó una línea de código.** `clavesDeOrden` ya era fuente única del
         orden y el keyset la reusa, así que la banda entró como una clave más (`'b'`) y
         `searchPins` heredó el orden solo. La decisión 11 del spec lo predijo; el test lo
         confirmó (45 fixtures, 3 páginas, 45 ids distintos, con 15 que comparten nombre para
         forzar el empate hasta el `id`).
      **Lo que quedó abierto y es decisión de producto, no deuda:** el detector a ≥ 8 locales
      encuentra **49 nombres**, no los 19 del anexo (esos ya eran un recorte humano), y la lista
      inicial de 22 deja afuera cadenas reales que sí se ven en la app —`tea connection`,
      `green eat`, `el noble`, `sushiclub`, `wendy's`, `mccafe`, `la continental`,
      `la farola express` (esta última salió 14ª en *Quilmes · Cenar afuera*)—. Sumarlas es
      `npm run cadenas:proponer` + un `UPDATE`, sin deploy. Ver *Cola siguiente*.
      **`PBETA-R1-03` y `PBETA-R1-04` siguen abiertos a propósito**: son la misma pantalla pero son
      UI y no tocan el motor. Con el orden arreglado, ponerle techo al scroll (`R1-04`) deja de ser
      arbitrario.

- [x] **🔴 Bug de chips — apagar uno apagaba otro y prendía dos que nadie tocó** (2026-08-09,
      sesión Opus; reportado por Fer usando la app el mismo día). **El fix es una línea de idea:**
      apagar saca `chip.tags − ⋃ tags(otros pintados)` en vez de todos los tags del chip, así un
      tag que otro chip pintado está usando no se lo lleva el que se apaga. En el repro se va solo
      `cerveceria` y queda exactamente «Primera cita» prendido. QA en `docs/qa/AnalisisQA.md`
      § *Bug de chips*: **APROBADO** (`CHIP-01..12`), typecheck · **699/699** tests · QA en vivo del
      repro y de las dos regresiones de FB-02.
      **Lo que vale más que el fix:**
      1. **El QA fue extraer para poder testear.** El pintado y el toggle eran funciones puras
         `(chips, tags)` **adentro de un componente cliente**: nadie las podía llamar, y por eso
         FB-02 salió en dos vueltas y esto llegó por un reporte clickeando. Ahora son
         `lib/search/pintado.ts` —dueño único, sin base ni DOM— y `occasion-chips.tsx` es
         presentación. Las **17 × 17 = 289** combinaciones se verifican contra seis invariantes con
         los chips del **seed**, sin base.
      2. **El test se escribió antes del fix y encontró más de lo reportado.** Falló donde tenía que
         fallar y, además, destapó **12 casos en la rama `prender`** que nadie había visto: la unión
         de tags puede completar a un tercer chip («Cumpleaños» + «Tomar algo» prende «Salida con
         amigos») y en 1 de esos casos deja tapado al chip recién tocado. **No se arregló**: es
         inherente a derivar el pintado de los tags, así que quedó como ítem propio — pero
         **contenido por el test**, que exige que el que se prende de más esté contenido en la
         unión e inventaría el caso conocido por nombre. **El 2026-08-10 se cerró como decisión
         tomada: no se arregla** (§ *Feedback posterior*, con las cuatro opciones evaluadas y el
         disparador de reapertura).
      3. **Un invariante barato pagó el fix mismo:** «ningún toque es un botón muerto» es la
         verificación de que el propio arreglo no podía dejar un chip que no se apaga cuando todos
         sus tags los sostiene otro.

- [x] **Ítem 6 de la cola post-v2 — `CORRECCION_DATOS`, escrito e implementado el mismo día**
      (2026-08-09, sesión Opus): ahora un dato base mal **se puede arreglar**, la corrección
      **sobrevive al re-import** y queda registrado quién la hizo y con qué fuente. Resumen en
      [`SPECS_ARCHIVO § correccion_datos`](../archive/SPECS_ARCHIVO.md#correccion_datos) · QA en
      `docs/qa/AnalisisQA.md` § *QA /qa-spec — CORRECCION_DATOS*: **APROBADO** (los 26 casos
      `CORR-01..26` + 16 criterios de DoD por 3 checkers independientes), typecheck · **687/687**
      tests · build en verde. **Qué quedó construido:** `places.locked_fields` (`text[]`) y la tabla
      `place_data_edits` (bitácora **y** cola, con índice único parcial de una pendiente por lugar) ·
      `lib/negocio/correcciones.ts` como **dueño único**, que en **una transacción** escribe los
      valores, **une** la marca, deja bitácora, re-asigna `place_zones` desde el pin nuevo e invalida
      el match con Google · el `set` del upsert extraído a `scripts/overture/upsert.ts` con
      `CASE … = ANY(places.locked_fields)`, testeable contra la base **sin S3** · 7ª tab **«Lugares»**
      en `/admin` (buscador que reusa `buscarLugaresPorNombre` sin moverlo, editor con el `pin-picker`
      del alta, bitácora, «Soltar» por campo) · las propuestas de dueño en la **misma cola** que los
      reclamos · sección «Dónde estás» en `/mi-negocio/[placeId]` · `formattedAddress` en el field
      mask, **US$0 marginal**.
      **Tres cosas que valen más que el feature:**
      1. **La ficha de Matienzo venía mostrando datos de otro local, y se comprobó ejecutándolo.**
         El spec lo había *deducido* leyendo la base; el QA en vivo lo mostró: antes de corregir,
         «Google dice» devolvía `Pringles 1210` —ni siquiera nuestro 1249— porque el match se
         resuelve a **±300 m del pin propio**, y al mover el pin el `google_place_id` **cambió**. Por
         eso la decisión 9 (invalidar el match al mover el pin) no era una precaución: era el bug.
      2. **Dos textos de cara al usuario salían en inglés con los tests en verde.** Un `PATCH` sin
         `fuente` devolvía el `"Invalid input: expected string…"` crudo de zod. Los tests pasaban
         porque verifican el **código** de error, no el mensaje — el QA en vivo es el que lee el
         texto. Vale como patrón: si un endpoint devuelve `error.message` al usuario, ese mensaje es
         copy y tiene que estar en la regla del rioplatense.
      3. **`asignarZonasDeLugar` esperaba desde AUTH.** Su docstring decía que servía para *"el alta
         **o edición** de un lugar"* y la edición nunca había existido; ya aceptaba `tx`. Cero código
         de geometría nuevo. Buscar antes de escribir pagó exactamente lo que la regla del CLAUDE.md
         promete.

- [x] **Tanda D del feedback — `MAPA`, escrito ayer e implementado hoy; con esto el feedback de los
      primeros usuarios queda cubierto entero** (2026-08-08, sesión Opus): `FB-04` (verte en el mapa)
      + `PBETA-R1-06` (que el mapa entre en la pantalla), juntos por ser el mismo archivo y la misma
      pantalla. Resumen en [`SPECS_ARCHIVO § mapa`](../archive/SPECS_ARCHIVO.md#mapa) · QA en
      `docs/qa/AnalisisQA.md` § *QA /qa-spec — MAPA*: **APROBADO** (12 criterios de DoD por 3
      checkers independientes + los 14 casos `MAPA-01..14` en vivo), typecheck · 663/663 tests ·
      build en verde. **Qué quedó construido:** el `GeolocateControl` nativo de MapLibre (un toque =
      un centrado, permiso solo al tocarlo) · un `useRef` que marca la cámara del usuario y saltea el
      `fitBounds` de los pins, limpiado por la clave de búsqueda **sin coordenadas** · el mapa sin
      alto fijo con el buscador colapsado y los chips en una fila · aviso propio al caer fuera de
      `AMBA_BBOX`. Sin migración, sin endpoint y **sin una línea de `lib/`**.
      **Tres cosas que valen más que el feature:**
      1. **El mapa colapsaba a 0 px con los 663 tests en verde.** Sacar el alto fijo dejó al
         `height: 100%` del div interno sin un alto **declarado** contra el cual resolver: el canvas
         quedaba desbordado y **los controles no recibían el toque**, o sea que la feature nueva no
         se podía usar. Lo cazó un `elementFromPoint` sobre el botón en el QA en vivo, no la vista.
      2. **Los rótulos de MapLibre se traducen con `locale` del `Map`**, no editando el DOM después
         de `addControl`: el botón se arma de forma asíncrona y se re-rotula en cada cambio de
         estado. (Los del zoom siguen en inglés — anotado abajo.)
      3. **En Chromium ≥ 121, `scrollbar-width`/`scrollbar-color` anulan los `::-webkit-scrollbar`.**
         Declarar las dos cosas juntas devuelve la barra del sistema apenas teñida, flechitas
         incluidas. Apareció al pedido de Fer de que la barra de los chips no pareciera de Windows.

- [x] **Tanda C del feedback — `ADMIN_USUARIOS`, escrito ayer e implementado hoy** (2026-08-08,
      sesión Opus): `FB-01` + `FB-03`, los dos de `/admin`. Resumen en
      [`SPECS_ARCHIVO § admin_usuarios`](../archive/SPECS_ARCHIVO.md#admin_usuarios) · QA en
      `docs/qa/AnalisisQA.md` § *QA /qa-spec — ADMIN_USUARIOS*: **APROBADO** (17 criterios de DoD por
      5 checkers independientes + los 20 casos ADMU en vivo), typecheck · 663/663 tests · build en
      verde. **Qué quedó construido:** tabla `plan_grants` append-only (migración `0015`, aditiva) ·
      `otorgarCortesia`/`revocarCortesia` en `lib/billing/subscriptions.ts` —flag y bitácora en una
      sola transacción, con el flag leído `for('update')`, que es lo que hace que dos POST
      **concurrentes** dejen una sola fila— · 3 lecturas en `lib/billing/admin.ts` · 2 endpoints · la
      sexta tab, sin mover las otras cinco · el botón de copiar mails · 12 tests nuevos.
      **Tres cosas que valen más que el feature:**
      **(1)** el criterio central del DoD estaba escrito como **grep**, y por eso encontró deuda que
      esta feature no causó: `lib/billing/baja.ts` escribía `owner_plan` por fuera del dueño único
      desde MONETIZACION F2 — dos copias idénticas de una regla, que ningún test podía distinguir
      porque el drift no existe hasta que una cambia. Fer decidió unificarlo en el momento, en
      **commit aparte** por ser camino de cobro: `bajarFlagDeLugar(tx, placeId, now)` (la bajada del
      eje B2B **sin eje completo**, que es lo que `cancelarSuscripcionDeLugar` necesita porque baja el
      flag incluso sin fila viva). Ahora el grep devuelve **solo** `subscriptions.ts`.
      **(2)** *«revocar oculta las fotos 4-15»* era **folclore**: la ficha publica una sola foto de
      dueño, así que `CAP_FOTOS` gatea la **subida**, no la exhibición. Lo daban por hecho este spec
      **y** la decisión 19 de MONETIZACION, y está en el copy que ve el admin. El "oculta, no borra"
      real se verificó sobre los **campos pagos** y sobre las listas de favoritos, con `SELECT`
      antes/después. **Corregir esa frase donde aparezca queda pendiente** (ver abajo).
      **(3)** `ADMU-19` (un interesado sin mail) es **irreproducible por diseño**: `user_id` es
      `NOT NULL` con FK `ON DELETE CASCADE` y `users.email` es `NOT NULL`. El filtro queda como
      defensa y el caso queda escrito para que nadie lo persiga de nuevo.
      Las dos lecciones quedaron en `docs/operations/LECCIONES_APRENDIDAS.md`.

- [x] **Spec de la Tanda C escrito** (2026-08-08, sesión Fable, autoría de spec — **no hay código**):
      [`docs/specs/planned/ADMIN_USUARIOS.md`](../specs/planned/ADMIN_USUARIOS.md), que cubre `FB-01`
      + `FB-03`. **Los dos ítems siguen abiertos**: lo hecho es la decisión, no la implementación.
      **Un solo spec y no dos** (decisión 1): `FB-03` no ameritaba spec propio, pero su tope de 200
      sí ameritaba quedar escrito. Lo que cerró: **(a)** la cortesía se otorga extendiendo a
      `lib/billing/subscriptions.ts` —el dueño único— y **delegando la escritura del flag en
      `activarFlagDelPlan`/`bajarFlagDelPlan`, que no se tocan**; **(b)** **sí se puede revocar**, y
      lo que lo destrabó fue leer el copy vigente: `suscripcion-panel.tsx:154` ya dice *«Si lo querés
      dar de baja, escribinos y lo sacamos»* — el producto ya lo había prometido, y como revocar
      **oculta y no borra** (favoritos y contenido pago), es puerta de ida y vuelta; **(c)** van los
      **dos ejes**, porque `owner_plan` es justo el `UPDATE` a mano que el CLAUDE.md todavía
      documenta, y B2B se otorga desde el usuario sobre sus lugares con reclamo aprobado, sin UI
      nueva; **(d)** auditoría en una tabla nueva `plan_grants` append-only que es **bitácora, no
      fuente de verdad del estado** — columnas en `users`/`places` guardarían solo el último estado
      y tocarían tablas con datos reales. Y una regla que salió escribiéndolo: **la cortesía solo
      aplica a ejes sin suscripción viva**, porque el discriminante "esto es cortesía" ya existe en
      producción (`estado.status === null`) y permitir la excepción obligaría a inventar un segundo
      que driftearía. Única migración: la tabla nueva.

- [x] **Tanda B del feedback — `CURADURIA_POR_NOMBRE`, escrito ayer e implementado hoy** (2026-08-08,
      sesión Opus). Cierra `FB-10` (la puerta: buscar un lugar por nombre en `/admin` → Curaduría y
      curarlo con el editor de siempre) y `FB-10b` (el 🔴 bug de que guardar borraba el precio), en
      ese orden invertido: **primero el piso**, porque el bug ya existía en la cola por zona y valía
      arreglarlo aunque la puerta se frenara. QA `docs/qa/AnalisisQA.md` § *CURADURIA_POR_NOMBRE*:
      **16/16 casos en vivo** (`CURNOM-01`..`CURNOM-16`) + **14/14 criterios de código** por 3
      checkers independientes; typecheck, 651 tests y build en verde.
      [Resumen](../archive/SPECS_ARCHIVO.md#curaduria_por_nombre).
      Tres cosas que solo se vieron implementando: (1) **la `key` de React era parte de la lógica** —
      recargar el mismo `placeId` no remonta `RevisorLugar`, así que sin un contador de recarga el
      editor mostraría lo tipeado en vez de lo persistido (el spec lo anticipó y se implementó de
      entrada); (2) `LugarEnCola.zonaSlug` tuvo que pasar a **nullable**, porque por nombre se llega
      a lugares sin zona primaria y la cola por zona nunca podía tenerlo así; (3) **el QA del precio
      tenía que ser por `SELECT`**, no por captura: la pantalla mostraba «No sé» con total
      naturalidad mientras la fila desaparecía. La base quedó como estaba (canario: 3.967 tags
      `source='admin'` antes y después) y el backup previo es
      `backups/adondesalimos_2026-08-08_151629.sql.gz`. **Destraba la curaduría de cobertura.**

- [x] **Spec de la Tanda B escrito** (2026-08-08, sesión Fable, autoría de spec — **no hay código**):
      [`docs/specs/planned/CURADURIA_POR_NOMBRE.md`](../specs/planned/CURADURIA_POR_NOMBRE.md), que cubre
      `FB-10` + `FB-10b`. **Los dos ítems siguen abiertos**: lo hecho es la decisión, no la
      implementación. Cerró las 3 preguntas que el triaje dejó abiertas (visibilidad divergente
      declarada, qué pasa después de guardar sin cola, y el precio en los dos caminos) y sumó una
      que apareció escribiéndolo: el match por nombre **tiene dueño** (`word_similarity` +
      `immutable_unaccent` en `lib/search/query.ts`) pero sus helpers son privados ⇒ se extraen a
      `lib/search/nombre.ts` en vez de clonar un `LIKE`. Sin migración.

- [x] **Tanda A del feedback de los primeros usuarios reales** (2026-08-08, sesión Opus, sin spec).
      Los 6 ítems que Fer aprobó del triaje: `FB-02`, `FB-05`, `FB-06`, `FB-07`, `FB-08`, `FB-09`.
      QA `docs/qa/AnalisisQA.md` § *Feedback … Tanda A* (`FB-02-01`…`FB-09-06`, 20 criterios, todos
      PASS). Dos cosas que solo se vieron **implementando**, no triando: (1) en `FB-02`, pintar y
      togglear **no pueden usar el mismo criterio** —maximal para pintar, subconjunto para
      togglear— o un chip tapado queda como botón muerto; está escrito en el comentario de
      `occasion-chips.tsx`. (2) en `FB-09`, el `touchend` de un arrastre corto sobre el handle
      dispara igual un `click`, así que sin un guard el sheet cerraba justo cuando el gesto decía
      "volvé". El handle pasó a ser un `<button aria-label="Cerrar">` (accesible, y cierra con tap):
      eso es lo que cierra `PBETA-R2-09`. `FB-06` dejó `components/ui/password-input.tsx` como
      **dueño único del ojito** — ya no queda un solo `type="password"` suelto en el repo.

- [x] **La base de producción existe: el catálogo entero vive en Neon** (2026-08-03, sesión Opus,
      `DEPLOY` **F0**, cero código). QA `docs/qa/AnalisisQA.md` § *DEPLOY F0* (`DEPLOY-F0-01..12`).
      Neon Free en **`aws-sa-east-1`** con **PostgreSQL 16.14** — la misma versión exacta del Docker
      de dev, elegida a propósito cuando la consola ofrecía hasta la 18: no hay nada que ganar
      divergiendo de collation y planner entre dev y prod. Neon Auth apagado (ya hay Better Auth).
      Restore por el endpoint **direct** con `--single-transaction` + `ON_ERROR_STOP=1`, y
      **verificación por conteo Y por checksum**: 13 tablas con los mismos números (canario de
      curaduría **3.967**) y `md5(string_agg(...))` idéntico en 6 conjuntos. Ese segundo chequeo
      no lo pedía el spec y es el que cierra el agujero: **un conteo igual con contenido distinto
      pasa el paso 4**. Cuentas de prueba borradas (**24 tablas en 0**) y `ai.chat_monthly_cap` a
      **500**. **Dev quedó intacto** ⇒ F0 sigue siendo deshacible borrando el proyecto de Neon.
      **Tres cosas que el spec no tenía bien y que ahora sí:**
      **(a)** El SQL del paso 5 **no corría**: `delete from session where user_id not in (select id
      from users)` tira `operator does not exist: text = uuid`. Falta `::text`. Se descubrió
      ejecutándolo, y la transacción abortó entera — nada quedó a medias.
      **(b)** Y la causa de que `session`/`account` no cascadeen **no era** que "better-auth las creó
      sin foreign key" por descuido: **`users.id` es `uuid` y sus `user_id` son `text`**, así que la
      FK era **imposible**. Importa porque la versión vieja invita a "arreglar" el schema agregando
      una FK que no puede existir.
      **(c)** **`scripts/backup-db.sh` no producía un dump restaurable en Neon**: hacía `pg_dump` sin
      `--no-owner --no-acl`, así que traía **62 `OWNER TO adondesalimos`**, un rol que en Neon no
      existe. El paso 3 del spec asumía que el archivo del paso 1 ya los traía. Para F0 se restauró
      un segundo dump del mismo instante con los flags, y **el script se arregló** (única línea de
      código de la sesión, decidida aparte porque F0 era cero código: el problema no era de F0 sino
      de cualquier restore fuera del contenedor de dev). Los dumps nuevos salen con **0 `OWNER TO`**;
      ⚠️ los anteriores al 2026-08-03 no, y hay que regenerarlos para usarlos afuera.
      **Y una decisión de Fer que el spec no contemplaba: la telemetría de dev no viaja.**
      `place_impressions_daily` (2.193 filas, **16.220 impresiones** de QA nuestro) y
      `place_tag_impressions_daily` (2.001) son exactamente la señal que este deploy viene a
      empezar a acumular limpia — afinar `chips.schedule`, la curaduría guiada por uso, y el
      histórico que vende el B2B. Y `ai_api_usage` / `google_api_usage` **son los contadores de los
      kill switches**: producción habría arrancado con 5/500 del cap del chat y 24 `details` + 14
      `photos` de Google ya gastados en dev. Las cuatro en 0.

- [x] **La app se puede instalar, y el alta nueva se vio por primera vez** (2026-08-03, sesión Opus,
      `PULIDO_BETA` F4 → **spec CERRADO**). [Resumen](../archive/SPECS_ARCHIVO.md#pulido_beta) ·
      QA `docs/qa/AnalisisQA.md` § *PULIDO_BETA F4* y § *QA /qa-spec — PULIDO_BETA*.
      **F4**: `app/manifest.ts` + `public/icons/` (192, 512, maskable) + `app/apple-icon.png` (180) +
      `themeColor` en el `viewport`. Fer la **instaló de verdad en su Android** y abre con el splash
      que dibuja el SO — la decisión 9 funcionando (*el splash sale gratis del manifest*, sin costar
      un ms de render y solo para quien la instaló).
      **Post-cierre, el mismo día — el wordmark en el splash.** Al instalarla, Fer vio que el splash
      sale **solo con el pin**, sin el nombre. Se había dicho que Android lo pinta desde `name`; su
      captura demuestra que **no**. **El manifest no tiene ningún campo de texto para el splash** —
      Chrome lo compone con `background_color` + un ícono— así que la única forma de que se lea es
      que esté **dentro del PNG**. **Se intentó dos veces y no se puede — cerrado, no volver a
      abrirlo.** (1) Un ícono extra de **1024**, suponiendo que "Chrome elige el más grande": falso,
      la doc dice *el más cercano a la resolución del dispositivo*; sin texto. (2) El wordmark en
      **`icon-512.png`**: reinstaló y **tampoco**. Por descarte el splash usa el **`maskable`**, que
      es **el mismo archivo del ícono del launcher** — no hay forma de darle texto a uno sin
      dárselo al otro. Era viable (el maskable con wordmark entra en la zona segura, se verificó),
      pero **Fer decidió que no**: el ícono de la pantalla de inicio se ve todos los días y el splash
      dura menos de un segundo. **Todo revertido**: `icon-512.png` volvió a la versión limpia y el de
      1024 se borró; el manifest quedó con sus 3 íconos y con el porqué escrito arriba de `icons`.
      **Tres cosas que no eran obvias y por eso se registran:**
      **(a)** El **service worker NO es requisito** para instalar. Se chequeó contra la doc de Chrome
      **antes** de dar el DoD por cumplido, porque si lo fuera el criterio era imposible sin meter un
      SW, que el spec puso en v2. La lista real es manifest + HTTPS + íconos 192/512 + `start_url` +
      `display`, y nada más.
      **(b)** Los íconos del manifest **no pueden vivir en `app/`**: esa carpeta solo sirve los
      *nombres de convención* de Next (`icon`, `favicon`, `apple-icon`), que se inyectan solos con URL
      hasheada. Un ícono referenciado por URL fija desde el manifest necesita `public/`. El
      `apple-icon` sí es convención y por eso se quedó en `app/`, al lado de `icon.png`.
      **(c)** **Better Auth no persiste el token de verificación de email** (lo firma con el secret):
      la tabla `verification` queda en **0** y el link del mail **no se puede reconstruir desde la
      base**. Para un QA de alta nueva hay que pedirle el link a quien recibe el mail — el atajo no
      existe.
      **El alta nueva end-to-end**, que F1 y F3 nunca pudieron ver (`requireEmailVerification` hace
      imposible el login sin un inbox real): Fer puso su mail. Lo bueno — **el arreglo de PBETA-R3-03
      sobrevive a una cuenta nueva**: la fila de `place_list_items` entra en el **mismo segundo** que
      la verificación, y aterrizás en la home **ya logueado**, no a pie. Lo malo → **PBETA-R3-07**
      (arriba, sin triar): si el link del mail abre otra pestaña, `sessionStorage` arranca vacío y el
      guardado que motivó el registro se pierde.
      **Cerrado con un pendiente anotado**: **PBETA-07 (iOS)** quedó sin verificar por falta de un
      iPhone. Decisión de Fer, con el precedente de `AUTH` (que cerró con el botón de OAuth
      diferido): el riesgo es casi nulo —el `apple-touch-icon` es convención de Next, servido y
      linkeado, sin lógica propia— y dejarlo abierto frenaba `DEPLOY` F0 sin bajar el riesgo.
      La base volvió a los conteos del arranque: el alta creó **5 filas reales** (`users`, `account`,
      `session`, `place_lists`, `place_list_items`), anotadas con su `id` y borradas a mano porque
      **`account` y `session` no cascadean** desde `users`.
- [x] **Los 10 bloqueantes de la beta, triados y arreglados** (2026-08-03, sesión Opus,
      `PULIDO_BETA` F2+F3). Fer confirmó los 10 —**ninguno bajó de severidad**— y acotó dos:
      R2-03 (nombre del creador **y** qué es la app) y **R5-01, donde eligió tapar el síntoma sin
      diagnosticar la causa** para no gastar tokens de Sonnet; la causa quedó como ítem propio.
      **Lo que cambió de forma al implementarlo, que es lo que vale registrar:**
      **(a)** el arreglo de "guardar a través del login" **no podía vivir en el botón de guardar**.
      Con scroll infinito, al volver del login la card muchas veces no está montada y el arreglo
      habría fallado en silencio justo en las listas largas — terminó en el layout raíz, sin leer la
      sesión, usando el **401 como señal** de "todavía no se logueó" para no consumir el pendiente.
      **(b)** El copy nuevo de la votación cerrada **iba a mentir de otra forma**: la expiración
      perezosa persiste `status='closed'` también en la que venció sola, así que "la cerró quien la
      armó" habría salido en las dos. Se deriva de las fechas (`closed_at < expires_at`) y se
      verificaron las dos ramas forzando el dato en la base y restaurándolo.
      **(c)** Las 4 sugerencias del chat no se eligieron a ojo: se **midió la densidad** de cada tag
      antes de escribirlas y ahí apareció el porqué del hallazgo — `romantico` tiene **71** lugares
      en todo AMBA y `wifi-trabajar` **218**, así que dos de las cuatro viejas colgaban de tags que
      casi no están curados. La regla quedó escrita en el docstring para la próxima.
      El único ítem que sobrevive del lote es F4 (la app instalable).

- [x] **Los chips de la home aprendieron a callarse, y el chat ya sabía armar planes** (2026-08-03,
      sesión Opus). Las 3 observaciones de Fer sobre la home y el chat, en un lote. **645/645 tests**
      (628 + 17 nuevos), typecheck limpio. Ninguna tocaba `drizzle/`: cero migraciones, todo
      `app_settings` y constantes ⇒ nada bloqueaba `DEPLOY` F0.
      **La ventana horaria (`solo`) fue la única con diseño de verdad**, y lo interesante no fue
      elegir la forma sino descubrir que **`solo` no puede compartir la semántica de `primero`**: el
      "gana la primera regla que matchea" (decisión 2 de CHIPS_ROTACION) es correcto para un orden y
      **veneno** para un permiso — con esa regla, una ventana puesta arriba de todo apagaba en
      silencio el adelanto de las reglas de abajo, y una regla ajena vigente decidía sobre un chip
      que ni nombraba. Terminaron siendo dos semánticas distintas en el mismo array de reglas, cada
      una documentada al lado de la otra.
      **El piso de resultados y la sugerencia del chat fueron una línea cada uno** — y en los dos
      casos el trabajo real fue el que ya estaba hecho: los números estaban medidos en la cola (por
      eso `20` se justifica en dos renglones) y la sugerencia solo había que **probarla**.
      **La única sorpresa vino de ahí:** el chat encadena las dos búsquedas de un combo por su
      cuenta, con cercanía incluida. Se reservaba una decisión aparte por si no lo hacía (tocar el
      prefijo cacheado de 8.776 tokens + `npm run eval:chat`, que cuesta tokens reales): **no hizo
      falta**. Probar antes de instruir se pagó solo.
- [x] **Los 5 temas abiertos que dejó el QA integral #2, decididos e implementados** (2026-08-03,
      sesión Opus de decisión). No eran bugs: eran decisiones de producto que nadie había tomado.
      Ninguno bloqueaba `DEPLOY` F0. **625/625 tests, typecheck limpio.** Uno por uno arriba
      (`INT2-32`, `INT2-28`, `INT2-29`, `INT2-01` y el de las fotos al revocar por abuso).
      **Dos se decidieron distinto a lo que proponía la cola, y en los dos casos el motivo salió de
      leer el código en vez del ítem:** el checkbox de "quitar las fotos" en `/admin` se cambió por
      un script (`limpiarFotosDeUsuario` no servía "tal cual" —es por usuario, no por lugar— y el
      *por qué* de la revocación **ya** se persiste en `admin_notes`, que era el único argumento
      para ponerlo a un click); y el chip de Precio resultaron ser **dos** chips, no uno.
      **El método que funcionó** (vale repetirlo en la próxima sesión de decisión): verificar cada
      hallazgo contra el código **antes** de repetir su recomendación. De los 5, **3 cambiaron de
      forma** al hacerlo. Un hallazgo de QA envejece: describe el código del día que se escribió.
      **Lo que se decidió NO hacer, para que no vuelva en tres semanas:** no se agrega columna
      `source` a `place_tag_impressions_daily` (los dos consumidores quieren demanda, no origen);
      no se dejan de contar las impresiones de la búsqueda dentro de una votación (una vista privada
      es una vista); no se hardcodean en el código los umbrales de la decisión 18; y no va checkbox
      de borrado en `/admin`.
      **Fan-out:** 4 subagentes `implementador` en paralelo sobre archivos disjuntos + el chip
      (único con escritura en la base) en la sesión principal, después de `npm run backup:db`
      (`backups/adondesalimos_2026-08-02_224123.sql.gz`).
- [x] **Los 3 fixes de código del QA integral #2, aplicados en lote** (2026-08-03, sesión Opus).
      `INT2-33` (tags **y** fotos al revocar) + `INT2-28` (el contador topeado). **622/622 tests**
      (619 + 3 nuevos), typecheck limpio, verificado en vivo sobre Kansas y con la base restaurada
      al estado exacto previo. Ninguno tenía migración ⇒ ninguno bloqueaba `DEPLOY` F0, y por eso
      se hicieron **después** del informe: un informe con el código cambiando debajo no describe
      ninguna versión del producto.
      **La decisión que faltaba la tomó Fer**: al revocar, los tags del dueño se van y **se
      re-derivan los `import` desde Overture** (opción a). Salió barata porque
      `places.overture_category` está persistida — es un lookup local, no un re-import. El mapa se
      mudó a `lib/overture/tag-map.ts` (`scripts → lib`, nunca al revés).
      **Lo que casi se rompe, y quién lo evitó:** el fix de las fotos estaba **mal** en su primera
      versión —gateaba `getPlaceDetail` y no el `tieneFotoDueno` del enriquecimiento, con lo que la
      ficha revocada quedaba **sin ninguna foto**, ni la del ex-dueño ni la de Google— y los 622
      tests lo daban por bueno. Lo frenó **un ítem de este BACKLOG escrito el 2026-07-21**, que ya
      tenía la trampa nombrada con las dos funciones. Primera vez que la cola **evita** un bug en
      vez de solo describirlo. Detalle en `docs/qa/AnalisisQA.md` § *Fixes del QA integral #2*.
- [x] **QA integral #2 — ejecutado entero, y F0 desbloqueado** (2026-08-02, 3 sesiones Opus).
      **42 casos `INT2-NN`, 39 ✅ + 3 hallazgos documentados, cero bloqueantes, cero datos
      perdidos.** Cubrió los cruces entre las 7 features que entraron después del QA integral de
      julio, que tenían QA contra su propio spec y **nunca se habían cruzado entre sí**. Sesión 1
      (A+B: caminos end-to-end y gates, 21 PASS) · sesión 2 (C+E: cruces rol × feature y
      sensibilidad al reloj, 7 PASS + 3 ⚠️) · sesión 3 (D+F: transiciones de estado, el pago real
      y la limpieza). **El bloque F cerró en verde**: snapshot ANTES == DESPUÉS con **diff = 0** en
      las 13 tablas, canario de curaduría de vuelta en **3.967** exacto, los 3 `delete` de
      agregados diarios corridos (−201 impresiones, −133 de tags) y los acumuladores mensuales
      conservados (decisión 2 del plan). **El dump que viaja a Neon es
      `backups/adondesalimos_2026-08-02_211243.sql.gz`.**
      **Lo que encontró la sesión 3** (todo 🟢 solo código, sin migración ⇒ puede ir después del
      deploy): revocar un reclamo **no apaga los tags ni las fotos del dueño** (`INT2-33`) y
      `/cuenta` **ofrece cancelar a un premium sin suscripción** (`INT2-32`). Los tres ítems están
      arriba, en la cola. **Lo que confirmó que funciona:** bajar de premium **oculta sin borrar**
      en los dos ejes (`INT2-30`), un solo pago prende **las tres** superficies premium
      (`INT2-31`), la cancelación es **diferida** de verdad (`INT2-41`), el destaque en búsqueda se
      **apaga al instante** (`INT2-34`) y el tope global del chat **degrada sin cobrar el intento**
      (`INT2-35`). Y se corrió al fin `INT2-13`, que había quedado diferido dos veces por
      configuración de entorno.
      **Lección de método, tercera consecutiva:** el instrumento fabricó síntomas las tres
      sesiones (el editor · los microsegundos de `now()` · esta vez, aserciones con `includes`
      sobre substrings que dos valores comparten). Las tres veces lo frenó la misma regla —§ 10.3
      del plan, *explicar el síntoma en el código antes de escribir un ❌*—. Detalle en
      `docs/qa/AnalisisQA.md` y en `docs/operations/RETRO.md`.

- [x] **Alias de zonas: CABA sistemático + hitos/POIs** (2026-08-01, sesión Opus). Los **dos**
      ítems de alias de § *Mejoras futuras*, cerrados juntos: **78 → 135 alias**. (1) **CABA**: el
      cruce por solapamiento de polígonos (turf) del GeoJSON de BA Data contra las 21 zonas mostró
      que 38 de los 48 barrios ya estaban cubiertos y agregó los **8** que faltaban, todos con
      100,0 % de solapamiento. (2) **Hitos**: **48**, y acá el método tuvo que cambiar sobre la
      marcha — se midió primero que **el catálogo no sirve como fuente de hitos** (5 de 30
      probados; Movistar Arena tiene **0 lugares**), así que las coordenadas salieron de **3
      agentes independientes con lentes distintas** y entra solo lo que **≥ 2 corroboran cayendo en
      la misma zona** por point-in-polygon. De 105 propuestas sobrevivieron 42; los 7 conflictos
      los arbitró el catálogo por dirección y **en 3 el dato le ganó a los agentes** (Distrito
      Arcos es `palermo-soho`, no Hollywood ni Belgrano). Campo de Polo y Ezeiza quedaron afuera a
      propósito: uno lo parten dos zonas, el otro cae fuera de las 46. **La trampa que el ítem no
      decía, medida**: `ALIASES` también viaja dentro del prefijo cacheado del chat, que pasó de
      **8.777 a 9.726 tokens (+10,8 %)** — US$3,56 por cada 1.000 conversaciones nuevas. Tres tests
      nuevos afirman la **propiedad** (todo alias apunta a un slug vivo, sin duplicados, y los 47
      barrios oficiales resuelven); el tercero cazó `Villa Gral. Mitre`. Typecheck limpio, **618
      tests**, build ✅. Cero fuentes nuevas (no se usó OSM) y la atribución de BA Data ya estaba.
      QA `ALIAS-01..12`.
- [x] **Pulido de UI — sesión B: el historial de `/mis-votaciones` (d)** (2026-08-01, sesión Opus).
      `misVotaciones` (una query sin `LIMIT` que traía **todas** las votaciones del creador y después
      **todas** las opciones de todas, con su `GROUP BY` sobre `poll_votes`) se parte en dos lecturas
      con pesos distintos: **`votacionesActivas`** —card completa, sin tope, porque premium no tiene
      tope de activas— y **`historialDeVotaciones`** —filas compactas, 20 + `Ver más` con cursor
      keyset `(created_at, id)`—. El historial **no cuenta votos**: ahí estaba el costo. La decisión
      2 era la que movía el código y se cumplió tal cual: el ganador sale de un **join a `places` por
      `winner_place_id`** (una fila por votación) y el título de las sin título, de las **2 primeras
      opciones + "…"**, pedidas **solo** para esas. Canceladas afuera (decisión 3); el free sigue sin
      teaser (decisión 5) y para él el historial ni se consulta. Endpoint nuevo
      `GET /api/votaciones/historial` con el **mismo gate server-side** que la pantalla (401 anónimo
      · 403 free): un "Ver más" abierto no puede ser la puerta de atrás del plan. QA en vivo con 22
      terminadas sembradas y **borradas al terminar** (11 IDs, `PULIDO-D-01..11`), 615 tests verdes
      (6 nuevos en `historial.integration.test.ts`), `tsc --noEmit` limpio.
- [x] **Pulido de UI — sesión A: los tres mecánicos (a · b · c)** (2026-08-01, sesión Opus).
      **(a)** `app/(auth)/layout.tsx` cambia el texto plano "¿A dónde salimos?" por `<BrandHeader />`:
      un swap en un archivo arregla las cuatro pantallas (login · registro · recuperar ·
      restablecer), verificadas una por una en vivo. **(b)** `/mis-lugares` y `/mis-votaciones`
      suman marca + `← Volver`. **Decisión de layout**: en las dos, el renglón del título ya lo
      ocupa un CTA primario ("Nueva lista" / "Armar votación"), así que el Volver va **arriba del
      título, compartiendo fila con el `<BrandHeader />`** — mismo markup de link que `/cuenta`,
      distinta ubicación, y las dos hermanas quedan idénticas entre sí. **(c)** Cada faceta del
      editor del dueño (`app/mi-negocio/[placeId]/editor-client.tsx`) pasa a un `<details>` plegado
      con el contador de elegidos en el título ("Cocina · 2 elegidos", nada si es 0): el muro de
      ~96 tags queda en **6 renglones** y Horarios entra en la misma pantalla. Acordeón nativo, el
      mismo patrón que `SemanaAcordeon` de la ficha; sin librería nueva y sin buscador de tags —
      medir primero si lo plegable alcanza. QA en vivo: las 4 de auth, las 2 de Volver, y el editor
      (desplegar Cocina con sus 46 tags, tildar/destildar y ver el contador seguir) — sin guardar,
      la base quedó intacta. 609 tests verdes, `tsc --noEmit` limpio. **Queda abierto el (d)**
      (`/mis-votaciones` sin `LIMIT`): necesita decisión de producto, es la sesión B.
- [x] **Enriquecimiento del catálogo — OSM/Overpass medido, y la decisión de NO hacerlo**
      (2026-08-01, sesión Opus): se midió la hipótesis que había quedado abierta antes de escribir
      ninguna línea de spec, que era exactamente la corrección de rumbo pedida. **16.949 POI de OSM
      en AMBA** (menos que nuestros 18.993) y solo **15,5% con `opening_hours`**. Cruzados por
      nombre normalizado + ≤200 m: matchean 18,2% (estricto) a 25,8% (con fuzzy), mediana **10 m**,
      y **ganan ≥1 tag 1.267–1.703 lugares = 6,7–9,0% del catálogo**. En cobertura: Ambiente 5,0%
      → 9,3–10,6% · Momento 6,1% → 9,6–10,9% · **Precio sigue en 0,0%**. El **techo también está
      medido** (contando desde OSM: 1.374 POI con horarios y 1.591 con datos de ambiente en
      categorías que llevamos): ya se captura el 78–82%, así que un matcheo mejor da ~2 puntos, no
      un orden de magnitud. **Decidido: no va spec** — el número no paga el import + parser +
      atribución, y menos con ODbL siendo **share-alike sobre bases derivadas** y el catálogo
      siendo el activo del producto. De yapa, OSM sirvió de **árbitro independiente de la
      curaduría** (273 comparaciones): los tags **sin cita coinciden 92%** contra 84% de los que sí
      la tienen ⇒ **no se borran**; lo que se revisa a mano son ~400 (`hasta-tarde`, `trasnoche`,
      `happy-hour`). También quedaron decididos el filtro de Precio (se oculta mientras esté vacío)
      y el score de completitud (no se implementa: gana el destaque pago). Todo en
      [`docs/product/cobertura-tags-2026-08-01.md`](cobertura-tags-2026-08-01.md) § 4 y § 5. **Cero
      código**: los scripts de la medición son de un solo uso y quedaron en el scratchpad.
- [x] **DEPLOY — el premium apagado, primer tramo de código de F1** (2026-08-01, sesión Opus):
      el estado free del tab de Suscripción deja de ofrecer un pago que no se puede cobrar y pasa
      a **medir el interés** (decisión 6). Tabla `premium_interest` (migración `0014`, aditiva,
      backup previo `adondesalimos_2026-08-01_111256.sql.gz`) con los **dos únicos parciales** que
      el spec anticipó: `unique(user_id) where place_id is null` y `unique(user_id, place_id)
      where place_id is not null` — un unique común dejaría entrar N filas B2C del mismo usuario
      porque en Postgres `NULL ≠ NULL`, y el contador es justo el número que dispara prender el
      cobro y pagar Vercel Pro (decisión 18). `POST /api/billing/interes` (rate limit propio 10/h
      → sesión → zod → dominio), `lib/billing/interes.ts` como dueño de la regla —dedupe por
      `onConflictDoNothing`, y el B2B gateado por `esDuenoDe` para que nadie infle el interés de un
      lugar ajeno— y `lib/billing/apagado.ts` como **dueño único del interruptor**: el cobro está
      apagado ⇔ falta `NEXT_PUBLIC_MP_PUBLIC_KEY`, sin flag en `app_settings` que sería una segunda
      fuente de verdad. `/admin` → Suscripciones muestra el conteo **y los mails** (a quién se le
      escribe el día que se abra). QA en vivo DEPLOY-10/15/16/17 ✅ + 2 casos extra (el confirmado
      sobrevive al reload; un suscripto activo no ve la beta). Las filas del QA se borraron: el
      dump de dev es el que se restaura en Neon y arrancar prod con el contador en 2 corrompe la
      señal. **Sigue F0** (crear Neon y restaurar el dump, que ya trae la tabla).

- [x] **Pase de deuda técnica — el tablero de `/admin` deja de subestimar el chat, y un bug del
      backlog que no existía** (2026-07-31, sesión Opus): los tres ítems del #1 de la cola
      post-v2, sin spec porque el criterio de "listo" era objetivo. **(a)** `chat_messages` gana
      `cache_read_tokens`/`cache_creation_tokens` (migración `0013`, aditiva, backup previo
      hecho): `lib/ai/chat.ts` acumula y persiste los 4 números —antes ni siquiera acumulaba el
      de creación— y `lib/admin/costos.ts` los cobra vía `costoDePeriodo`. Escribe hacia
      adelante: el histórico vale lo mismo que antes, el número solo puede subir. **(c)** el bbox
      de AMBA pasa a tener dueño único en `lib/geo/amba.ts` (módulo sin imports, que era la
      restricción que lo tenía frenado). **(b) no se implementó porque no era un bug**: la
      premisa del backlog (Drizzle no califica `${places.id}` en un subquery) estaba mal
      generalizada — Drizzle omite la tabla **solo en la lista de SELECT**, que es donde vivía el
      H-1 real de claims; los `EXISTS` del motor están en el WHERE y salen calificados. Se
      prefirió no tocar el camino crítico de la búsqueda para arreglar nada, y dejar medido el
      porqué. **QA**: 9 IDs `DEUDA-NN`, 604/604 tests, typecheck ✅. **La lección** (medir el SQL
      generado antes de creerle a un diagnóstico heredado) quedó en `LECCIONES_APRENDIDAS.md`.
- [x] **CHIPS_ROTACION — los chips de la home rotan por día y hora → spec CERRADO ENTERO y con
      esto la cola de v2 completa** (2026-07-31, sesión Opus): el orden de los chips de Ocasión
      deja de ser una foto fija (`sort`) y pasa a depender del reloj de AR, con reglas que se
      editan con un `UPDATE` sin deploy (`app_settings` → `chips.schedule`). Entregado:
      `lib/search/rotacion.ts` como **dueño único** (puro, sin base, reusando `partesEnAR` y los
      helpers de hora de `horarios.ts`), el enganche en `lib/search/chips.ts` justo antes del
      corte `home`/`resto` —leído **en paralelo** con los conteos—, las 3 reglas semilla en el
      seed con `onConflictDoNothing`, y **58 tests nuevos** (600/600 verdes, typecheck ✅).
      Sin migración, sin endpoint, sin UI de admin y cero cambios en el componente cliente, el
      motor y `lib/db/chips.ts`: esto reordena, nada más. **QA**: 10 criterios de DoD con checkers
      independientes + los 11 casos ROT-NN, 8 de ellos en pantalla. **Lo que el spec no había
      previsto y hubo que decidir con Fer (decisión 11)**: describía una home que ya no existía
      —medido al arrancar, los dos chips de las reglas semilla **ya estaban entre los 4 de la home
      a toda hora**, así que aplicarlas no habría movido un pixel—, de modo que una regla ahora
      puede adelantar **cualquier chip vivo**, tenga `in_home` o no. `in_home` pasó a significar
      "candidato por defecto". Truco de QA que conviene reusar: para verificar la rotación **no se
      movió el reloj del sistema** sino la regla (un `UPDATE` que matchea la hora actual), que de
      paso es exactamente lo que verifica ROT-09. **Sigue pendiente el v2**: afinar las reglas con
      `place_tag_impressions_daily` — hoy son sentido común declarado, no curaduría con evidencia.

- [x] **SUGERIR_EN_VOTACION — que el grupo sume lugares a la cancha → spec CERRADO ENTERO**
      (2026-07-31, sesión Opus): el link de una votación deja de circular solo para **votar** y
      empieza a circular para **participar**. Cualquiera que lo recibe suma un lugar del catálogo
      **sin cuenta** (cookie `voter_id`, la misma del voto), la opción es votable al instante y el
      creador puede quitar lo que no va. **Revierte la decisión 2 de VOTACION**, anotado en su
      tabla para que nadie lea el spec cerrado y lo tome como vigente. Entregado: migración
      aditiva `0012` (enum `poll_option_origin`, `origin`/`suggested_by`/`created_at` en
      `poll_options`, `allow_suggestions` en `polls`, **sin backfill**), `sugerirOpcion` /
      `quitarOpcion` / `cambiarSugerencias` con **todos** los gates en el dominio y el techo
      contado bajo `FOR UPDATE`, dos endpoints nuevos con el patrón fino del voto, rate limit
      propio, el sheet de sumar reusando `/api/search` tal cual, el badge "Lo sumó alguien del
      grupo" y el interruptor del creador (alta + `/mis-votaciones`). **542/542 tests** (19
      nuevos, incluido el de dos sugerencias concurrentes con una sola vacante), typecheck y
      **build** verdes. **QA en vivo**: los 15 IDs del spec
      PASS. Dos cosas que el spec no decía y hubo que decidir: el techo de 8 es una constante
      **nueva** (`MAX_OPCIONES_TOTAL`) porque `MAX_OPCIONES = 5` ya existía y es otra cosa —el
      rango del creador, que usan el alta y el chat—, y el polling pasó a traer la cancha entera
      porque ahora crece con la pantalla abierta. Un bug propio cazado por un test: el cierre
      perezoso hecho **dentro** de la transacción se lo llevaba el `ROLLBACK`.

- [x] **FAVORITOS F2 — ver y organizar lo guardado → spec CERRADO ENTERO** (2026-07-31, sesión
      Opus): la fase que hacía usable lo que F1 dejó como infraestructura. Entregado:
      **`/mis-lugares`** (server + client, patrón de `/mis-votaciones`) con las listas visibles y
      sus lugares —más recientes primero, el despublicado atenuado y sin link—, **crear /
      renombrar / borrar listas** (`crearLista`/`renombrarLista`/`borrarLista` +
      `POST /api/listas` y `PATCH|DELETE /api/listas/[id]`), el **sheet de destino** cuando hay más
      de una lista (card, ficha **y chat**), el **botón de guardar en el chat IA** con estado por
      lote (`GET /api/favoritos?ids=`, una request por tanda de cards, no una por card) y el link
      en el `AccountMenu`. **Sin migración**: el schema de F1 alcanzó. **523/523 tests** (10
      nuevos), typecheck y build verdes, y **QA en vivo con Playwright**: 18 IDs PASS —los cuatro
      que F1 había diferido (FAV-04/05/10/12) reusados, no renumerados— y cero bugs. Lo que hubo
      que decidir en el camino: **la default ocupa un lugar del cupo aunque todavía no exista**
      (si no, un free gastaba su única lista en una con nombre y el tap quedaba sin destino), y
      **borrar una lista sí borra sus ítems** —eso no contradice "ocultar ≠ borrar", que prohíbe
      borrar por un **cambio de plan**, no por un pedido explícito del usuario.

- [x] **FAVORITOS F1 — guardar lugares** (2026-07-30, sesión Opus): el #3 de la cola de v2 y la
      apuesta grande (retención + gancho premium **sin costo marginal**: el chat cuesta tokens por
      mensaje, una lista más cuesta una fila). Entregado: `place_lists` + `place_list_items` +
      columna `saves` (migración aditiva `0011`, backup previo), `lib/favoritos/` completo
      (`planes.ts` como **dueño único del cupo**, `acciones.ts` con todos los gates, `query.ts`,
      `validacion.ts`), `POST|DELETE /api/favoritos` con rate limit propio, botón de guardar en la
      card del listado y en la ficha, y la métrica agregada `saves`. **513/513 tests** (15 nuevos)
      y **QA en vivo con Playwright**: 12 IDs PASS, 4 diferidos a F2, cero bugs. Las tres preguntas
      abiertas del pre-vuelo (P1 motor, P2 superficies, P3 claves de `app_settings`) se cerraron
      con Fer **antes** de escribir código y quedaron registradas en el spec. Lo más caro
      verificado en vivo: bajar de plan **oculta y no borra** (FAV-06/07), y las cards de la
      página 2 del scroll nacen con su estado. Faltaba F2 (`/mis-lugares`, crear/renombrar/borrar
      listas, sheet) y el `build`: los dos se cerraron el 2026-07-31 — ver la entrada de arriba.

- [x] **QA en vivo de ABIERTO_AHORA F1 → veredicto APROBADO** (2026-07-30, sesión Opus, MCP de
      Playwright a `https://adondesalimos.ngrok.app`, mobile 390×844, Palermo Soho): el recorrido
      que faltaba para cerrar el veredicto. **8 de los 10 casos verificados en pantalla** más el
      copy y el layout. Se aprovechó el cruce de franja de las 20:00 en vez de tocar el reloj: a
      las 19:39 el chip aplicaba `merienda` (20 → 5 cards) y a las 20:00:57 el **mismo** chip
      aplicaba `cena` (35 lugares), así que el **borde de la decisión 3 quedó verificado en vivo**.
      También: atrás en un paso, doble toque, link `t=cena` abierto en franja merienda (devuelve
      cena, chip inactivo), Momento con **8** tags sin el retirado, ficha de La Continental con sus
      8 tags activos y la novena fila `active=f` intacta en la base, y **cero** ocurrencias de
      "abierto" en la home (con «Ver más» abierto). Bonus: el browser corría con el reloj
      desfasado (marcaba `desayuno`) y el chip aplicó igual la franja del **server** — la decisión
      10 verificada sin proponérselo. **Quedaron sin verificar en pantalla** AHORA-02 (madrugada
      02:00) y AHORA-03 (domingo al mediodía): exigen mover el reloj —`Set-Date` pide admin— o la
      **fecha** del sistema, y Fer decidió no hacerlo (la madrugada se mira una noche que le toque
      programar a esa hora). Los dos siguen cubiertos por test unitario y por dato, y la limitación
      está escrita en el QA, no tapada. Un hallazgo, sin acción: `AHORA-OBS-1` — el «Abierto ahora»
      que sí aparece en la ficha es el bloque en vivo de **Google**, fuente exacta, no el tag
      retirado; importa porque es el rótulo que la decisión 13 quiere para el chip en F2.
- [x] **Los retiros de tags pasaron a estar declarados en código** (2026-07-30, sale de la retro de
      la sesión de ABIERTO_AHORA F1): `TAGS_RETIRADOS` en `lib/db/taxonomy.ts` (slug + motivo, dueño
      único del hecho) + `npm run db:retiros` (`scripts/retiros.ts`, idempotente, **no toca**
      `place_tags`). **Por qué:** el seed no pisa `active` a propósito —apagar un tag a mano es
      curaduría y debe sobrevivir a un reseed— pero eso hacía que un retiro **decidido en un spec**
      se perdiera al recrear la base, y el tag volvía a ser elegible para el sugeridor de curaduría,
      que es exactamente el bug que originó el retiro. Verificado en las tres ramas: idempotente (0
      cambios), aplicar de verdad (se reactivó `abierto-ahora` a mano y el script lo retiró) y el
      aviso de drift inverso (un tag inactivo no declarado). Reemplaza 3 de los 5 lugares que
      avisaban del riesgo por escrito. El **check f7** de `/consistency-check` ahora cruza base ↔
      declaración en los dos sentidos. Lección en `LECCIONES_APRENDIDAS.md`: *si una decisión no está
      declarada en código, no es una decisión — es el estado actual de una base.*
- [x] **ABIERTO_AHORA F1 — el chip «Para ahora»** (2026-07-30, sesión Opus): el **#2 de la cola de
      v2** y el primero de v2 con código. `lib/search/ahora.ts` (nuevo, dueño único de hora →
      tags: las 5 franjas de la decisión 3, reusando `partesEnAR`) + `getOccasionChips(now)` que lo
      antepone a la home si su `countPlaces` da > 0. **Cero cambios** en el motor, en los params y
      en `occasion-chips.tsx`: el chip viaja con la forma de un chip normal y escribe `?t=cena`
      como cualquier otro (decisión 5), así que la URL sigue siendo el estado y un link compartido
      significa lo mismo mañana. La home pasó a **1 + 4** chips (el de franja no descuenta de los 4
      de Ocasión). **El tag `abierto-ahora` quedó retirado** (`active = false`, con `backup:db`
      antes): desaparece del sheet (Momento 9 → 8), de las cards, de la ficha y del sugeridor de
      curaduría, sus **20** filas de `place_tags` intactas y `?t=abierto-ahora` sigue funcionando.
      Conteos por franja sin drift respecto del spec (cena 670 · almuerzo 605 · desayuno 272 ·
      merienda 251 · madrugada 176). Typecheck ✅ · **497 tests** ✅ (+29) · build ✅ (server parado).
      QA: `AnalisisQA.md` § *QA /qa-spec — ABIERTO_AHORA F1*. El spec pasó a `active/` porque la
      **F2 sigue gateada**. Sin PR todavía.
- [x] **Los 4 specs de v2 escritos** (2026-07-29, sesión de autoría): `ABIERTO_AHORA`,
      `FAVORITOS`, `SUGERIR_EN_VOTACION` y `CHIPS_ROTACION`, todos en `docs/specs/planned/` y en el
      manifiesto. **Solo autoría — cero código.** Las tres decisiones de fondo las resolvió Fer con
      la evidencia medida a la vista: (1) *Abierto ahora* = **franja horaria** sobre tags curados
      (F1, ~670 lugares) y **abierto real gateado** (F2), porque la fuente exacta tiene **1** lugar
      cargado y Google en vivo sale ~US$0,64 por página; (2) en una votación puede sugerir
      **cualquiera con el link** (techo 8, 2 por dispositivo, el creador moderá); (3) la rotación de
      chips vive en **`app_settings`**, no en una tabla nueva. Hallazgo con evidencia: el tag
      `abierto-ahora` que la curaduría le puso a **20 lugares** *miente por construcción* (estático
      para un concepto que depende de la hora) → el spec lo retira con `active=false`. Confirmado
      que los **alias POIs/CABA no necesitan spec** (tarea de datos). Cola de v2 agregada arriba.
- [x] **Batch de limpieza post-CURADURIA — 3 fixes chicos** (2026-07-27, sesión Opus): (1) **test
      de cupo** — dejó de borrar la fila real de `ai_api_usage` del mes en curso; ahora snapshot en
      `beforeAll` + restore en `afterAll` (verificado con centinela 99). (2) **2 chips que ANDeaban
      Cocina** — se sacó `pasteleria` de `merienda` y `bodegon` de `cena-familiar` + reseed dirigido;
      chips vivos **5/9 → 7/9** (`merienda` 0→45 zonas, `cena-familiar` 0→44). (3) **alias de
      barrios** — **74 nuevos** (78 total) barrio/localidad → zona, validados por dato (query de
      coordenadas contra `place_zones`; corrigió varias corazonadas y descartó localidades sin
      cobertura), aprobados por Fer región por región. Verificado end-to-end en `sugerir()`.
      Typecheck + 468 tests verdes. Build queda pendiente (server levantado). Registrado en QA
      (`AnalisisQA.md`). Sin PR todavía.
- [x] **Spec 9 CURADURIA — cerrado entero (F1 + F2 + F3)** (2026-07-27): el #5 de la cola
      post-spec-8. **F1**: migración `place_tag_suggestions` (evidencia + URL + estado, unique
      `(place_id,tag_id)`), settings `curation.zone_quota`/`ai.curation_model`, selección por zona
      (publicados · Tipo relevante a chips · sin reclamo aprobado · orden contacto→confidence),
      fetch educado del sitio propio (**cero Google**, fijado por test), sugeridor LLM con
      **evidencia citada** (tool-use forzado) y upsert que no pisa lo revisado; script
      `npm run curar <zona>...` con reporte de tokens/US$. **F2**: quinta tab "Curaduría" tras el
      gate `sesionAdmin`, cola one-at-a-time por zona con evidencia visible, aceptar/corregir
      (`source='admin'`) / rechazar, Precio opcional, teclado-first (Enter/R). Piloto (Villa Crespo
      + Quilmes) **aprobado por Fer** (decisión 11). **F3 — corrida completa autónoma** (decisión
      13): `guardarSugerencias` auto-aplica lo **con evidencia** a `place_tags` (`admin`+`accepted`,
      aditivo y protegido por `.returning()`), lo **sin evidencia** queda `pending`. Las 46 zonas
      con **Sonnet 5** por tandas: **~1.840 lugares, 1.149 tags auto-aplicados, 2.811 pending,
      US$17,62**. Cobertura: **5/9 chips objetivo prendidos** (de 1/9; `cumpleanos` 0→42 zonas),
      **46/46 zonas** con ≥1 chip; los 4 en 0 = dato base no curable (decisión 12). QA: 2 checkers
      (F1/F2) + verificación en vivo + F3 verificada en DB + cobertura medida; typecheck/468 tests
      verdes (build pendiente por server levantado). Spec en `docs/specs/done/CURADURIA.md` ·
      [Resumen](../archive/SPECS_ARCHIVO.md#curaduria) · QA: `docs/qa/AnalisisQA.md` § *CURADURIA*
- [x] **Mini-spec PULIDO — pulido UX/UI + reestructura de /admin** (2026-07-27): el #4 de la
      cola post-spec-8, alcance cerrado con Fer → spec → implementación → QA → cierre en una
      sesión. Dos frentes sobre hallazgos del QA integral: (a) **pulido UX** — filtro fantasma
      (`ChipsActivos` dibuja chip removible con fallback de label), header de marca
      (`BrandHeader`/`Wordmark` en ficha, `/cuenta`, `/mi-negocio` lista+editor, `/votacion/[token]`),
      resize de fotos del dueño a webp ≤1600px en el browser (267 KB → 17,5 KB verificado en
      vivo), INT-05 (el chat ahora cuenta impresiones de los lugares citados) e INT-14
      (ownership antes que validación de forma en `/content`, 403 no 400); (b) **`/admin` en
      tabs** — client-side sobre una sola ruta, gate único en `page.tsx`, orden Cola → Precios →
      Suscripciones → Costos (Sugeridor agrupado en Costos). QA: 6 criterios de código PASS
      (checkers independientes) + 7/7 en vivo (Playwright + UPDATEs revertidos) +
      typecheck/460 tests/build verdes. [Resumen](../archive/SPECS_ARCHIVO.md#pulido) · QA:
      `docs/qa/AnalisisQA.md` § *PULIDO*
- [x] **Mini-spec COSTOS_ADMIN — tablero de costos en /admin + sugeridor de precio** (2026-07-26):
      el #3 de la cola post-spec-8, spec → implementación → QA → cierre en una sesión (Fable
      orquestando + subagente implementador). Sección "Costos" read-only: chat IA en USD del mes
      por modelo (Σ tokens de `chat_messages` × precios extraídos como `calcularCostoUsd`), Google
      por SKU vs cap con alerta (80% amarillo / 100% rojo / cap=0 apagado), vs mes anterior, cupo
      del chat. Absorbe el sugeridor de precio del BACKLOG: dólar oficial (dolarapi, cache ~1 h,
      degradable) + piso `≥ dólar × 3` con banner solo-sugerencia. QA: 6 criterios de código PASS
      (3 checkers) + 7/8 en vivo (Playwright + UPDATEs revertidos) + typecheck/460 tests/build
      verdes. **Bonus:** el primer render del tablero expuso que el test de integración del cupo
      borra la fila real de `ai_api_usage` (ítem nuevo en Mejoras futuras).
      [Resumen](../archive/SPECS_ARCHIVO.md#costos_admin) · QA: `docs/qa/AnalisisQA.md`
      § *COSTOS_ADMIN*
- [x] **Investigación "zona no adyacente" → NO ERA BUG** (2026-07-26): lo priorizado #1 del triaje
      resultó **no ser un bug**. `place_zones` es geométricamente correcta (auditadas 12.122/12.122
      filas no-primarias, **todas** ≤400 m del borde de su zona); scripts (`build`/`load`/`assign`) y
      motor de búsqueda correctos. El síntoma es la **decisión 5 de ZONAS (buffer 400 m) como se
      especificó** — el diagnóstico previo asumía mal que `la-boca-barracas` eran 2 barrios (son 4,
      lindan con Boedo/Caballito) y que las asignaciones eran "imposibles" (son de borde: 98 m/241 m).
      De paso quedó **resuelto** el ítem viejo `[QA — sin verificar]` del escape-room (Palermo a 186 m,
      Caballito a 359 m — dentro del buffer). **Decisión de Fer: documentar y no tocar.** Abierto el
      ítem de producto "revisar el buffer de zonas" por si molesta en uso real. QA: `docs/qa/AnalisisQA.md`
      § *Investigación — zona no adyacente* (ZON-BUG-01..05). Solo docs, sin cambio de código.
- [x] **Spec 8 CHAT_IA — F3 (Modo shortlist en VOTACION) — CIERRA EL SPEC 8** (2026-07-26): la última
      pieza del chat premium, puro **cableado** (sin motor nuevo). Enciende el botón "Que la IA arme la
      shortlist" que VOTACION dejó no-op (decisión 18): `/votacion/nueva` navega a `/chat?modo=shortlist`
      (gate premium intacto, `{esPremium && …}`); el chat crea la conversación en ese modo (manda `modo`
      solo en el primer mensaje, el endpoint lo ignora si ya hay id) y la directiva 2-5 del prompt
      SHORTLIST ya existía (F1); cada respuesta con 2-5 lugares muestra **"Usar esta shortlist"** →
      guarda la lista en `sessionStorage` (`SHORTLIST_STORAGE_KEY`, nueva constante) y vuelve a
      `/votacion/nueva`, que la **precarga** como opciones. El traspaso es cosmético — los ids se
      revalidan `isPlacePublished` al crear (doble red, VOTACION d.12). Al retomar un hilo shortlist del
      historial, el botón respeta el `modo` **persistido** de la conversación, no solo la URL. Archivos:
      `app/chat/{page,chat-client}.tsx`, `app/votacion/nueva/nueva-client.tsx`, `lib/votaciones/constantes.ts`.
      **QA:** typecheck · 441 tests · build verdes; checkers independientes (Explore/haiku) todos PASS +
      **en vivo (Playwright/ngrok):** CHAT-13 (premium: botón → shortlist de 4 lugares reales → precarga →
      votación creada) y CHAT-15 (free no ve el botón). Veredicto **APROBADO** — `docs/qa/AnalisisQA.md`
      § *QA /qa-spec — CHAT_IA (spec completo, 3 fases)*. [Resumen](../archive/SPECS_ARCHIVO.md#chat_ia)
- [x] **Spec 7 MONETIZACION — F4 (Desglose de estadísticas) — CIERRA EL SPEC 7** (2026-07-25): la
      segunda feature que **vende** el B2B, montada sobre el teaser que AUTH dejó ("N visitas este
      mes"). `desgloseEstadisticas` (`lib/negocio/query.ts`) **gateado server-side por
      `owner_plan='paid'`**: con `free` devuelve `null` y el dueño se queda con el teaser pelado
      (sin enriquecerlo, dec.24). Con `paid`: vistas de ficha e impresiones **vs mes anterior**
      (mismo criterio de mes calendario que `visitasDelMes`, que quedó intacto), taps por tipo (los
      5 kinds, 0 incluido), top de filtros que lo encontraron (nombres de tags), y la transparencia
      del destaque "**destacada en X de las Y búsquedas**" (`featured_impressions / impressions`,
      dec.20). Presentacional en `components/negocio/desglose-panel.tsx`. **Sin migración**: reusa las
      3 tablas agregadas de F1. **QA en vivo** MONE-15 ✅ (paid ve el desglose completo; volver a
      `free` devuelve el teaser exacto, ocultar ≠ borrar) + test del gate server-side + checker
      independiente. **427 tests verdes** (3 nuevos). [QA](../qa/AnalisisQA.md) § F4. Con F4 quedan
      **las 4 fases del spec 7 cerradas** — el modelo de negocio entero está encendido.
- [x] **Spec 7 MONETIZACION — F3 (Destaque en búsqueda)** (2026-07-25): la primera de las dos
      features que **venden** el plan B2B. `buscarDestacados` reusa `construirWhere` (candidatos =
      `owner_plan='paid'` ∩ el where completo → "solo si matchea" sale gratis) y rota por
      `featured_impressions` ascendente con desempate `md5(place_id‖fecha)` (menor-mostrado-primero,
      auto-balanceado, sin migración: la columna ya la creó F1). Bloque de hasta 3 con badge
      "Destacado" arriba de la primera página (lista, no mapa), dedupe contra el orgánico;
      `registrarDestacados` cuelga del mismo `after()` de las impresiones. **Divergencia explícita**:
      los destacados suman a `impressions` además de `featured_impressions` para que el ratio
      "destacada en X de Y" de F4 no dé `X>Y`. **QA en vivo**: MONE-09/10/11/12 ✅ + invariantes
      (mapa no destaca, "Ver N" no infla). **423 tests verdes** (5 nuevos). [QA](../qa/AnalisisQA.md) § F3.
- [x] **Spec 7 MONETIZACION — F2 (Cobro con MercadoPago)** (2026-07-24): enciende el premium
      B2C y el plan B2B por lugar sin tocar los helpers de gating — la suscripción solo **mueve**
      `users.plan` / `places.owner_plan` (decisión 8). `lib/billing/*` portado de StressPlan
      (cliente `fetch` server-only, **preapproval SIN plan** dec.10, `validateWebhookSignature`
      tal cual, renovación idempotente con guard UNIQUE + `FOR UPDATE`, lazy check + gracia 3d).
      Endpoints `checkout`/`cancel`/`webhook` (firma 401, GET defensivo, idempotente); Checkout
      Bricks sobre `BottomSheet`; tabs de suscripción en `/cuenta` (B2C) y `/mi-negocio/[placeId]`
      (B2B); hooks de revocación (AUTH-13) y `beforeDelete` que cancelan el preapproval (dec.28);
      `/admin` con Suscripciones read-only. **QA en vivo (sandbox)**: MONE-01/02/03/04/17/18 ✅;
      MONE-05/06/07/08 por tests de integración/unit. **418 tests verdes**. Hallazgo del QA en
      vivo: el mensaje de tarjeta rechazada filtraba lenguaje de sandbox ("titular APRO") —
      corregido a copy de producción con test que lo blinda. [QA](../qa/AnalisisQA.md) § F2.
- [x] **Spec 7 MONETIZACION — F1 (Instrumentación + precios)** (2026-07-24): la primera fase,
      antes que el cobro, porque instrumenta histórico que no se reconstruye. **Migración completa**
      del § Modelo de una (criterio AUTH F3): `subscriptions` + `subscription_payments` (nacen sin
      uso, se llenan en F2), `place_taps_daily`, `place_tag_impressions_daily`, `featured_impressions`
      en `place_impressions_daily`, `app_settings_history` (`drizzle/0008`). **Taps**: `<TapLink>`
      (beacon `sendBeacon`, best-effort) en los 7 anchors de la ficha → `POST /api/lugar/[id]/tap`
      (rate limit 60/h) → upsert agregado por `(place, día, kind)`. **Tags por búsqueda**:
      `registrarTagsDeBusqueda` en el mismo `after()` del batch de impresiones (search route + home);
      el texto libre y la zona no se registran. **Instrumentación agregada pura** — sin user_id,
      cookie ni IP (test de columnas en las dos tablas). **Precios en DB**: `lib/billing/settings.ts`
      (getters runtime + `editarPrecio` transaccional con historial), `PATCH /api/admin/settings`
      (gate `ADMIN_EMAIL`), sección Precios editable + historial en `/admin`; seed idempotente
      `billing.precio_b2b_ars=15000` / `billing.precio_b2c_ars=7000`. `.env.example` con las 3 env
      de MP. QA de cierre: typecheck + **393 tests** + build verde (server parado), QA MONE-13/14/16
      + migración/seed/env en `docs/qa/AnalisisQA.md`. Pendiente: F2 cobro · F3 destaque · F4 desglose
- [x] **Mini-spec HOME_IDENTIDAD — home + identidad** (2026-07-23): se aplicó la identidad real y
      se le dio onda al home para que un link compartido no parezca a medio hacer. **Paleta** por
      tokens (`globals.css`): naranja `#FF8A00` (reemplaza el ámbar), fondo azulado `#0D0D1F`,
      neutros con tinte azul y tokens de categoría (rosa/violeta/turquesa/amarillo). **Tres focos
      fuera de tokens** + un 4º hallado en QA: email (CTA plano), pins del mapa a rosa `#FF2D75`,
      logo de Google **intacto**, y la estrella del rating de `text-amber-500` → `text-amarillo`.
      **Wordmark** (`components/shared/wordmark.tsx`, pin SVG con gradiente + texto) reemplaza el
      `h1`. **Estado vacío = mini-landing**: hero con headline rotativo rioplatense
      (`rotating-headline.tsx`, client-side para evitar hydration mismatch) que colapsa con
      búsqueda. **Favicon/app-icon** del logomark aislado con transparencia real
      (`docs/product/assets/logo_2.png` → `app/icon.png` + `app/favicon.ico`), cierra el 404.
      QA de cierre: typecheck + **381 tests** + build verde (server parado) + `/qa-spec`
      **APROBADO** (11 criterios, 3 checkers independientes) + QA en vivo con Playwright
      (home vacío/con búsqueda, votación, rotación sin warnings, pins rosa, ficha, favicon 200).
      Cierra los ítems de BACKLOG "identidad visual" y "home: pulido". Dejó anotados como tracks
      aparte: header de marca global y el filtro fantasma de tags con 0 lugares.
      [Resumen](../archive/SPECS_ARCHIVO.md#home_identidad)
- [x] **Spec 6 — VOTACION · las 3 fases + cierre del spec** (2026-07-22): votación en grupo, el
      loop viral. **F1** schema (`polls`/`poll_options`/`poll_votes` + `users.plan`), gate "1
      activa" server-side con `FOR UPDATE` del usuario, token aleatorio, `/votacion/nueva` con
      búsqueda embebida, rate limit propio. **F2** `/votacion/[token]` pública (server-render sin
      Google, OG estático), voto anónimo por cookie `voter_id` httpOnly (identidad por
      dispositivo, no IP), upsert `(poll_id, voter_token)`, conteo en vivo por polling,
      expiración lazy sin cron. **F3** `PATCH` cerrar (elegir ganador)/cancelar solo del creador,
      `/mis-votaciones` (free = activa · premium = historial, gate en la query), botón "IA arma
      shortlist" gateado y no-op. QA de cierre: typecheck + **381 tests** (50 nuevos) +
      `/qa-spec` **APROBADO** (VOT-01..15, 3 checkers independientes) + QA en vivo con Playwright
      (voto/conteo/sin-Google/solo-lectura) + `next build` verde (server parado). Premium modelado
      y **apagado** (lo enciende el spec 7). Spec movido a `done/`.
      [Resumen](../archive/SPECS_ARCHIVO.md#votacion)
- [x] **Spec 5 — AUTH · las 4 fases + cierre del spec** (F1 2026-07-20 · F2/F3 2026-07-21 · F4
      2026-07-22): auth con better-auth y reclamo de negocio. **F1** auth base (email+password,
      `requireEmailVerification: true`, Resend, `/cuenta`, rate limit, sin columna `role`).
      **F2** `place_claims` (un dueño por lugar), `/registrar-negocio` (búsqueda del catálogo
      completo + alta con pin MapLibre + zona por turf), `/reclamar/[id]`, `/admin` con la cola,
      aprobar/rechazar/revocar + `publish_override` + mails. **F3** `place_owner_content`
      (COALESCE dueño → base), tags `source='owner'`, fotos a R2 (`lib/storage/r2.ts`, caps con
      `FOR UPDATE`), `owner_plan` + gating server-side, huecos en la ficha, teaser de stats.
      **F4** horarios propios (`lib/negocio/horarios.ts`, editor semanal, prioridad dueño →
      Google, abierto/cerrado en TZ AR con cruce de medianoche; sin migración, field mask de
      Google intacto). QA de cierre: typecheck + **331 tests** + build verde + escaneo de
      secretos (0 fugas) + QA en vivo con Playwright — `/qa-spec` **APROBADO** (ver
      `docs/qa/AnalisisQA.md` § AUTH F2/F3/F4 y § QA /qa-spec — AUTH). **Único DoD diferido:**
      UI del botón de Google OAuth (deferral aceptado de F1). Spec movido a `done/`. [Resumen](../archive/SPECS_ARCHIVO.md#auth)
- [x] **Spec 4 — FICHA · Fase 3 + cierre del spec** (2026-07-20): foto de Google y atribución.
      `parseFotoCandidata` (una sola foto) + `fetchFotoUri` (media endpoint con
      `skipHttpRedirect=true` ⇒ `photoUri` efímero, la key nunca sale al browser) en
      `lib/google/places.ts`; `enrichment.ts` con el paso de foto (**cuota `photos` antes del
      media call**, y **foto de dueño ⇒ cero request a Google** vía `EXISTS` server-side en
      `getPlaceForEnrichment`); `ficha-google.tsx` reescrito como **shell de un solo fetch**
      (foto + header como `children` + datos ⇒ un único Place Details por apertura); crédito al
      autor sobre la foto + link al original + **logo de Google** sobre los datos. QA de fase:
      typecheck + **217 tests** + QA en vivo con Playwright (FICHA-10 prioridad de foto y
      FICHA-11 atribución) — ver `docs/qa/AnalisisQA.md` § FICHA F3. **Las 3 fases cerradas ⇒
      spec movido a `done/`.** Build final pendiente de correr con el dev server parado.
- [x] **Spec 4 — FICHA · Fase 2** (2026-07-20): enriquecimiento en vivo de Google.
      `lib/google/places.ts` (módulo único, server-only, key solo ahí) con los field masks
      testeados (`places.id` en el resolver = $0; Enterprise sin Atmosphere en Details),
      `lib/google/usage.ts` (contadores por SKU con tope editable en `app_settings`),
      `lib/lugar/enrichment.ts` (orquestación **pura** del gasto: estados de match, reintento,
      corte por cuota antes de llamar), `GET /api/lugar/[id]/google` (rate limit propio, 204
      en todo camino sin datos, se pide desde el cliente) y `app/robots.ts` bloqueando `/api/`.
      QA de fase: typecheck + 204 tests + `npm run build` verde (key con 0 ocurrencias en
      `.next/static`) + QA en vivo con Playwright — ver `docs/qa/AnalisisQA.md` § FICHA F2.
      **F3 pendiente** (spec sigue en `active/`). La QA en vivo dejó un miss de matching
      documentado (FICHA-03, riesgo aceptado por Fer).
- [x] **Spec 4 — FICHA · Fase 1** (2026-07-20): `/lugar/[id]` renderiza la ficha completa
      con datos propios (Overture + ZONAS), **sin ninguna llamada a Google** — cierra el 404
      al tocar una card. Migración 0003 con el modelo de datos completo del spec
      (`google_match_status`/`matched_at`, `place_photos`, `google_api_usage`, `detail_views`,
      3 claves `google.*`), `getPlaceDetail` con gate de visibilidad, helpers puros
      (`lib/lugar/ficha.ts`), `generateMetadata` con OG solo-propio y `detail_views` en
      `after()`. QA de fase: typecheck + 165 tests + smoke en vivo — ver `docs/qa/AnalisisQA.md`
      § FICHA F1. **F2 y F3 pendientes** (spec sigue en `active/`).
- [x] **Spec 3 — BUSQUEDA** (2026-07-20): home/search en 3 fases — motor en Postgres
      (`unaccent`+`pg_trgm`, cursor keyset), selectores de zona y filtros con contador en vivo,
      chips de Ocasión en DB (17 sembrados), vista mapa MapLibre con tope de 200 pins e
      impresiones agregadas por día. QA APROBADO 12/12 (BUSQ-QA-09 verificado en vivo con
      Playwright) — ver [SPECS_ARCHIVO](../archive/SPECS_ARCHIVO.md#busqueda).
- [x] **Spec 2 — ZONAS** (2026-07-20): 46 zonas de AMBA como GeoJSON versionados (CABA de
      BA Data, conurbano del IGN, cero OSM), `zones`/`zone_aliases`/`place_zones`, y la
      asignación precomputada con turf sin PostGIS. 23.857 lugares con zona (91,6%).
      QA APROBADO — ver [SPECS_ARCHIVO](../archive/SPECS_ARCHIVO.md#zonas).
- [x] **Spec 1 — CATALOGO** (2026-07-20): schema del catálogo, taxonomía de 105 tags,
      import de Overture (26.057 lugares), helper de visibilidad y `/legales`.
      QA APROBADO — ver [SPECS_ARCHIVO](../archive/SPECS_ARCHIVO.md#catalogo).
