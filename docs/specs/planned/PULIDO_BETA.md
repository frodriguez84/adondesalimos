# Spec: Pulido de UX/UI para la beta — auditoría de recorridos en mobile + app instalable

**Estado:** 🔵 Planned — en diseño
**Prioridad:** Alta — es lo último que separa la app de usuarios reales. Después del lanzamiento
cada hallazgo cuesta más: lo encuentra un usuario en vez de nosotros, y en una beta el usuario que
se traba no vuelve a probar.
**Gate:** Ninguno.
**Bloquea:** Nada formalmente. **Se recomienda cerrarlo antes de `DEPLOY` F0** — ver decisión 12.
**Depende de:** `docs/specs/active/DEPLOY.md` (el lanzamiento que lo motiva) ·
`docs/specs/done/PULIDO.md` (la pasada anterior, que fue por hallazgos y no por recorridos) ·
`docs/specs/done/HOME_IDENTIDAD.md` (paleta, wordmark, logomark) ·
`docs/qa/PLAN-QA-INTEGRAL-2.md` (el método de QA en vivo que se reusa)

---

## Problema

La app está entera —14 specs cerrados, 645 tests, cero features en cola— y **nunca la recorrió
nadie de punta a punta con ojos de usuario nuevo, desde un celular.**

Lo que sí se hizo, y por qué no alcanza:

- **`PULIDO` (2026-07-27) fue por hallazgos**: 4 tracks puntuales del backlog (filtro fantasma,
  header de marca, resize de fotos, INT-05/INT-14) + `/admin` en tabs. Arregló cosas que ya
  estaban anotadas; no salió a buscar.
- **El QA integral #2 (42 casos) verificó que las cosas *funcionen***, cruzando rol × feature. Un
  caso que pasa dice "el botón hace lo que promete", no "esto se entiende" ni "esto no da vergüenza
  en un celular de 390 px".

Son dos preguntas distintas y la segunda no tiene dueño. **La beta es en su gran mayoría mobile**
(decisión de Fer, 2026-08-03) y el catálogo se usa parado en la calle un viernes a la noche, no
sentado frente a un monitor.

Y hay un agujero concreto además de la pasada: **la app no es instalable**. No existe
`app/manifest.ts` — solo `favicon.ico` y `app/icon.png`. Para una app de salir de noche, que se
guarde en la pantalla de inicio del celular es más valioso que cualquier pulido de una pantalla.

## Objetivo

Que un usuario nuevo, sin cuenta, desde un celular, complete los **6 recorridos reales** de la app
sin trabarse — y que la app se pueda instalar en la pantalla de inicio con la marca puesta.

El spec se cierra en **cuatro fases con un corte deliberado entre ver y arreglar** (decisión 2):
auditar → triar → arreglar solo lo bloqueante → app instalable.

## Qué NO es esta feature

- **No es un rediseño.** La identidad ya está decidida (`HOME_IDENTIDAD`: paleta naranja `#FF8A00`
  / fondo azulado, wordmark, hero). Acá no se cambian paleta, tipografía ni layout general.
- **No es una splash screen propia.** Ver decisión 8 — está descartada con motivo, para que no
  vuelva a proponerse en tres semanas.
- **No audita `/admin`.** No es superficie de usuario: es la consola de Fer, y ya se reestructuró
  en `PULIDO`. Tampoco `/legales` (texto legal, no recorrido).
- **No es QA funcional.** Que las cosas funcionen ya lo cubrió el QA integral #2. Acá se mira
  claridad, jerarquía, densidad, tamaños de toque, estados vacíos/de carga/de error y copy.
- **No arregla todo lo que encuentre.** Solo lo BLOQUEANTE (decisión 5). El resto va al backlog
  con su ID, y lo decide Fer.
- **No toca curaduría ni datos del catálogo.** Si un recorrido se ve pobre por falta de tags, eso
  es el ítem #3 de la cola post-v2, no esto.

## Los 6 recorridos

Cada uno se audita **de punta a punta y en una sola sesión**, como lo haría una persona: no se
saltean pantallas ni se entra por URL directa salvo que el usuario real también lo haga.

| # | Recorrido | Rutas | Por qué está |
|---|-----------|-------|--------------|
| R1 | **Descubrir** — llego, elijo zona, veo resultados, abro una ficha | `/` → `/lugar/[id]` | El camino principal. Si esto no cierra, no hay producto. |
| R2 | **Me invitaron a votar** — abro un link de votación sin cuenta y sin saber qué es la app | `/votacion/[token]` | **El más importante y el menos mirado.** Es el loop viral: la mayoría de los primeros usuarios va a entrar por acá, no por la home. Un desconocido tiene que entender qué es esto en 5 segundos. |
| R3 | **Guardar** — toco guardar, me topa el muro de cuenta, me registro, vuelvo | card/ficha → `/registro` → `/mis-lugares` | Es el primer momento en que la app **pide algo**. Es donde se pierde gente. |
| R4 | **Armar una votación** — elijo lugares, la creo, la comparto | `/votacion/nueva` → `/mis-votaciones` | El lado emisor de R2. |
| R5 | **Chat + premium apagado** — pruebo la IA, gasto la probadita, choco el gate | `/chat` → `/cuenta` | Copy nuevo y sin rodar ("en camino", `DEPLOY` decisión 6). Es la superficie donde la app promete más. |
| R6 | **Soy dueño** — reclamo mi lugar y lo edito | `/registrar-negocio` · `/reclamar/[placeId]` → `/mi-negocio/[placeId]` | El lado B2B. Menos volumen, pero cada uno vale mucho más. |

## Decisiones cerradas

| # | Decisión |
|---|----------|
| 1 | **Se audita por recorridos, no por pantallas ni por componentes.** Una pantalla aislada siempre se ve bien; lo que rompe es la transición, el estado en el que llegás y lo que esperabas encontrar. Es la diferencia con `PULIDO`, que fue por hallazgos sueltos. |
| 2 | **Ver y arreglar son fases separadas (F1 y F3), y no se mezclan.** Arreglar mientras se audita contamina las dos cosas: se pierde el hilo del recorrido y se cambia código que después nadie triò. **F1 no toca una línea de código.** |
| 3 | **Viewport de referencia: 390×844** (el que ya usa el QA de este proyecto, `BACKLOG` § QA integral). Además se verifica que **nada rompa a 360 px** de ancho, que es el piso de Android. Desktop se mira de reojo: que no esté roto, no que esté pulido. |
| 4 | **La auditoría corre en vivo contra `https://adondesalimos.ngrok.app` con Playwright**, no leyendo código. Un hallazgo de UX que no se vio en pantalla no es un hallazgo — es una hipótesis. La lectura de código sirve para **explicar** un hallazgo, no para encontrarlo. |
| 5 | **Tres severidades, y solo una es bloqueante:** **BLOQUEANTE** (rompe el recorrido, miente, o deja al usuario sin saber qué hacer) · **MOLESTO** (se entiende pero irrita) · **COSMÉTICO**. **Solo BLOQUEANTE se arregla en F3.** El resto va al `BACKLOG` con su ID y lo decide Fer, sin discutirlo en el momento. Es lo que evita que una pasada de UX se vuelva infinita. |
| 6 | **El triaje lo hace Fer, no la sesión** (F2). Un hallazgo de UX es subjetivo por definición: la sesión propone severidad, Fer la confirma o la baja. Es la misma razón por la que la autoría de specs no se automatiza (`CLAUDE.md` § *Loops con corte verificable*). |
| 7 | **Todo hallazgo necesita evidencia**: ruta, viewport, qué se esperaba, qué pasó, y un screenshot o snapshot. Sin eso no entra a la lista. Un hallazgo sin evidencia envejece mal y la sesión que lo implemente va a tener que re-encontrarlo (lección del 2026-08-03: *un hallazgo de QA describe el código del día que se escribió*). |
| 8 | **NO va splash screen propia.** En una app nativa el splash lo dibuja el SO tapando la carga del proceso; en la web ese hueco no existe y ponerlo lo **crea**. La home es la búsqueda: meter un logo entre el usuario y los lugares es cobrarle atención sin darle nada, y empeora el LCP. (`logo_2.png` pesa además **1,4 MB**.) La marca al entrar ya está resuelta por el hero del estado vacío (`HOME_IDENTIDAD`). Lo que sí se hace es la decisión 9, que es el mismo objetivo sin el peaje. |
| 9 | **La app se vuelve instalable (`app/manifest.ts`), y de ahí sale el splash gratis.** Con manifest, Android dibuja un splash con el ícono y el color de marca **sin costar un milisegundo de render** y solo para quien la instaló — que es el único lugar donde un splash está tapando una carga real. Además habilita "agregar a la pantalla de inicio" y abrir sin barra del navegador. |
| 10 | **iOS recibe ícono y modo standalone, pero NO splash.** Safari ignora los íconos del manifest para la pantalla de inicio (necesita `apple-touch-icon`) y su splash exige una imagen de arranque **por cada tamaño de pantalla**: una cola de mantenimiento permanente a cambio de un cuarto de segundo. Se hace lo que se sostiene solo. |
| 11 | **Los íconos salen de `logo_2.png` redimensionado** (192 y 512 px, más `apple-touch-icon` 180). El original de 1,4 MB **no se sirve nunca tal cual**. `theme_color` y `background_color` salen de la paleta real de `HOME_IDENTIDAD`, no de valores nuevos. |
| 12 | **Este spec va antes de `DEPLOY` F0.** No es orden por gusto: F0 restaura un dump en Neon y **el valor del dump es que esté fresco**. Si esta pasada toca algo que vive en la base (copy en `app_settings`, chips, un tag), el dump queda viejo y F0 se hace dos veces. F0 es reversible y barato, pero repetirlo es trabajo de gusto. |
| 13 | **La auditoría no deja basura en la base.** Las votaciones, reclamos, favoritos y filas de `premium_interest` que se creen en F1 se **borran al terminar o se anotan** con su `id`, porque el dump de F0 sale inmediatamente después. Mismo criterio que el bloque F del QA integral #2 (*dejar la base como estaba*), con el agregado de la decisión 20 de `DEPLOY` (*dejarla lista para producción* es otra cosa y tiene otro dueño). |
| 14 | **Se usan las cuentas de prueba que ya existen** (`docs/qa/DATOS_QA.local.md`). R2 y R3 necesitan además el estado *sin cuenta*: ventana limpia, sin sesión ni cookie de voto. |

## Fases

| Fase | Qué | Código |
|---|---|---|
| **F1 — Auditoría** | Los 6 recorridos en vivo, mobile, con evidencia. Sale la lista de hallazgos con IDs y severidad propuesta. | **ninguno** |
| **F2 — Triaje** | Fer confirma o baja cada severidad. Lo no bloqueante se muda al `BACKLOG`. | ninguno |
| **F3 — Fix** | Solo los BLOQUEANTE, y re-verificación en vivo de cada uno. | sí, acotado |
| **F4 — App instalable** | `app/manifest.ts` + íconos + `theme_color`. **No depende de F1**: se puede hacer en paralelo o primero. | sí, chico |

## Implementación — F4 (lo único con alcance ya cerrado)

- **`app/manifest.ts`** (nuevo, `MetadataRoute.Manifest` de Next): `name` / `short_name`,
  `start_url: '/'`, `display: 'standalone'`, `background_color` + `theme_color` de la paleta de
  `HOME_IDENTIDAD`, e `icons` de 192 y 512 px (incluir un `purpose: 'maskable'`).
- **Íconos** derivados de `docs/product/assets/logo_2.png`, redimensionados. Van a `app/` o
  `public/` según lo que ya use el proyecto para `icon.png` — **no se estrena una convención**.
- **`apple-touch-icon` 180 px** (decisión 10) y `themeColor` en el `viewport` de `app/layout.tsx`,
  que hoy no lo declara.
- **Verificación**: el navegador ofrece instalar en Android, y el ícono correcto aparece en la
  pantalla de inicio en iOS. Se prueba por ngrok (HTTPS, requisito de PWA).

## Criterios de done (DoD)

- [ ] Los **6 recorridos** tienen sección propia en `docs/qa/AnalisisQA.md` con IDs
      `PBETA-R<n>-NN`, recorridos en vivo a 390×844.
- [ ] **Todo hallazgo** trae ruta, viewport, esperado, observado, severidad y evidencia
      (screenshot o snapshot) — decisión 7.
- [ ] **Cada hallazgo tiene un destino explícito**: arreglado en F3, mudado al `BACKLOG` con su ID,
      o descartado con motivo escrito. Ninguno queda sin destino.
- [ ] **Cero hallazgos BLOQUEANTE abiertos** al cerrar el spec.
- [ ] Cada BLOQUEANTE arreglado se **re-verificó en vivo** en su recorrido completo, no en la
      pantalla suelta.
- [ ] **Nada rompe a 360 px** de ancho en los 6 recorridos (decisión 3).
- [ ] `app/manifest.ts` existe y la app **se ofrece para instalar** en Android por HTTPS; el ícono
      correcto aparece en la pantalla de inicio en iOS.
- [ ] `theme_color` / `background_color` coinciden con la paleta de `HOME_IDENTIDAD` — no hay
      colores nuevos.
- [ ] **La base quedó como estaba**: lo creado durante la auditoría, borrado o anotado con su `id`
      (decisión 13).
- [ ] typecheck + tests + build verdes (build con el dev server parado).

## QA manual (IDs propuestos)

⚠️ **Dos numeraciones distintas, no las mezcles.** Los **hallazgos** de F1 son el entregable, no la
verificación, y se numeran por recorrido: **`PBETA-R<n>-NN`** (`PBETA-R2-03` = tercer hallazgo del
recorrido "me invitaron a votar"). Los de abajo, **`PBETA-NN`**, son los que verifican que el
**spec** se cumplió.

| ID | Caso | Criterio |
|----|------|----------|
| PBETA-01 | Los 6 recorridos, a 390×844 | Cada uno tiene su sección con IDs y evidencia en `AnalisisQA.md` |
| PBETA-02 | Un hallazgo tomado al azar de cada recorrido | Tiene los 6 campos de la decisión 7 |
| PBETA-03 | La lista completa de hallazgos | Ninguno sin destino (arreglado / backlog / descartado con motivo) |
| PBETA-04 | Los BLOQUEANTE arreglados | Re-verificados en vivo, en el recorrido completo |
| PBETA-05 | Los 6 recorridos a 360 px | Sin desbordes horizontales ni texto cortado |
| PBETA-06 | Android por ngrok | El navegador ofrece instalar; el splash usa el ícono y el color de marca |
| PBETA-07 | iOS por ngrok | "Agregar a pantalla de inicio" muestra el ícono correcto; abre en standalone |
| PBETA-08 | `manifest.ts` vs `HOME_IDENTIDAD` | `theme_color` y `background_color` son los de la paleta, no valores nuevos |
| PBETA-09 | La base, al cerrar F1 | Los conteos vuelven a los previos, o lo creado está anotado con su `id` |
| PBETA-10 | `docs/product/assets/logo_2.png` | No se sirve el original de 1,4 MB en ninguna ruta |

## Relación con otros specs

- **`DEPLOY`** — va antes de F0 (decisión 12). F4 podría vivir en F1 de `DEPLOY`; se pone acá
  porque es de cara al usuario y ya está decidido, y `DEPLOY` F1 tiene sus 4 cambios cerrados.
- **`PULIDO`** — la pasada anterior. No se re-audita lo que arregló, pero sí se verifica en su
  recorrido si aparece de paso.
- **`ABIERTO_AHORA` F2** y la **curaduría de cobertura** siguen gateadas por datos reales; si un
  recorrido se ve pobre por falta de tags, el hallazgo va ahí y no acá.

## v2 (fuera de scope)

- Service worker / uso offline. El manifest hace la app instalable; **offline es otra cosa** y sin
  usuarios no se sabe qué valdría la pena cachear.
- Notificaciones push.
- Rediseño de identidad o de layout.
- Auditoría de accesibilidad formal (WCAG). Los tamaños de toque y el contraste se miran de paso
  en F1; una auditoría a11y completa es un spec propio.
