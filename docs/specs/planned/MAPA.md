# Spec: MAPA — «dónde estoy» y que el mapa entre en la pantalla

**Estado:** 🔵 Planned — en diseño (escrito 2026-08-08)
**Prioridad:** Media — es la **Tanda D** del feedback de los primeros usuarios reales y el último
ítem abierto de ese lote (`FB-04`). Feature chica, pero toca el único archivo de la app que mueve
una cámara sola, y ahí está todo el riesgo. Va junto con `PBETA-R1-06` porque son el mismo archivo,
la misma pantalla y la misma sesión (mismo criterio con el que `ADMIN_USUARIOS` juntó `FB-01` con
`FB-03`).
**Gate:** ninguno.
**Bloquea:** nada. **Con esto el feedback de los primeros usuarios queda cubierto entero.**
**Depende de:** BUSQUEDA (decisiones 7 · 12 · 17 · 21 — el mapa, la URL como estado y el permiso
de ubicación con toque explícito), PULIDO_BETA (`PBETA-R1-06`), `lib/geo/amba.ts` (el rectángulo
de AMBA, dueño único).

---

## Problema

Dos reportes distintos sobre la misma pantalla:

1. **`FB-04` — no hay forma de verse en el mapa.** Un usuario pidió *"un botón para que se centre
   en donde está el usuario"*. Hoy `components/search/map-view.tsx:93` agrega solo
   `NavigationControl` (zoom); no hay `GeolocateControl`. Las `coords` llegan al componente
   (`:55`) pero **solo alimentan la clave del fetch**: no dibujan al usuario ni mueven la cámara.
   La mitad del trabajo ya existe —`pedirUbicacion` en `search-shell.tsx:133` pide el permiso y el
   toggle «Cerca de mí» filtra por 2 km— pero *filtrar por donde estás* y *verte en el mapa* son
   dos cosas distintas, y la segunda no está.
2. **`PBETA-R1-06` — el mapa no entra en la pantalla.** En mobile se ve el **67%** y el bloque de
   búsqueda no se colapsa en modo mapa, así que hay que scrollear la página — que es justo el
   gesto que se pelea con el arrastre del mapa.

Y hay un tercer problema que no reportó nadie y que aparece al implementar el primero: el efecto
de resultados hace `fitBounds` sobre los pins cada vez que cambian (`:200-204`). Un "centrarme"
sin coordinar con eso queda **pisado por el próximo re-fetch**, y la feature se siente rota.

## Objetivo

Que el mapa sea **la pantalla** mientras estás en modo mapa, y que puedas verte en él con un toque
sin que la app te robe la cámara después.

## Qué NO es esta feature

- **No re-litiga la decisión 17 de BUSQUEDA.** El permiso de ubicación se sigue pidiendo **solo
  con un toque explícito**, nunca al entrar ni por un `gps=1` en el link. El control elegido
  (decisión 4) la cumple por construcción.
- **No cambia el filtro «Cerca de mí»** ni el radio de 2 km ni el motor de búsqueda. Verse en el
  mapa es un gesto de **cámara**, no un filtro (decisión 5).
- **No toca la URL ni `SearchParams`.** La vista sigue siendo estado de UI que no viaja
  (`search-shell.tsx:88-90`), y la posición del dispositivo nunca viajó en un link.
- **No dibuja rastro, brújula ni seguimiento continuo.** Un toque = un centrado (decisión 6).
- **No mete los otros `PBETA` de R1 abiertos** (R1-02, R1-03, R1-04, R1-05, R1-07, R1-08): son de
  otras pantallas. El agrupamiento acá se justifica **solo** por ser el mismo archivo.
- **No es el mapa a pantalla completa** al estilo Google Maps (evaluado y descartado, decisión 8).

## Evidencia medida

En vivo, Playwright sobre `https://adondesalimos.ngrok.app/?z=palermo-soho` → botón «Mapa»,
viewport 390×844, 2026-08-08. Reproduce el hallazgo de la auditoría al píxel:

| Bloque | Alto | | Medición | Valor |
|---|---|---|---|---|
| Selector de zona | 46 px | | `window.innerHeight` | 844 px |
| Buscador | 44 px | | `document.body.scrollHeight` | 1.127 px |
| Chips de Ocasión | **124 px** (3 filas de `h-9`) | | Overflow de página | **283 px** |
| Fila Filtros / Lista-Mapa | 38 px | | Mapa (`h-[70vh]`) | 589 px, arranca en y=449 |
| Chips activos | 32 px | | **Visible del mapa** | **395 px = 67%** |
| **Bloque de búsqueda (con gaps)** | **332 px** | | | |

Dato que acota el problema de la cámara: **`serializeApiParams` mete `lat`/`lng` solo cuando `gps`
está prendido** (`lib/search/params.ts:131`). Con la búsqueda por zona, que lleguen coordenadas
**no** dispara un re-fetch. El conflicto real es más chico de lo que parecía: son dos casos, no
todos.

## Decisiones cerradas

| # | Decisión |
|---|----------|
| 1 | **El gesto de cámara del usuario gana, hasta que cambie la búsqueda.** Un `useRef` marca que la cámara es del usuario; mientras esté marcado, el `fitBounds` automático **se saltea**. El marcador se limpia cuando cambia `serializeSearchParams(params)` —o sea zona, tags o texto— y **no** cuando cambian las coordenadas. Consecuencia buscada: centrarse con «Cerca de mí» prendido **no** se pisa (las coords re-fetchean pero no son un cambio de búsqueda), y cambiar de zona **sí** vuelve a encuadrar los pins, que es lo que uno espera. Descartado "el `fitBounds` manda siempre" (deja roto justo el caso que se pidió) y "gana hasta que arrastres" (cambiar de zona te deja mirando el barrio viejo). |
| 2 | **Qué marca la cámara como del usuario:** `dragstart`, `zoomstart` y `rotatestart` **con `e.originalEvent`** (los movimientos programáticos no lo traen, así que el propio `fitBounds` no se auto-marca), el `easeTo` de abrir un cluster (`:154-161` — es consecuencia de un toque, aunque MapLibre no lo marque) y el evento `geolocate` del control. Se escribe en el código **por qué** la lista es esa: es el tipo de detalle que se pierde y después nadie sabe si falta un evento o sobra. |
| 3 | **El `fitBounds` no se toca por fuera de la decisión 1.** Mismo `padding: 48`, mismo `maxZoom: 15`, misma `duration: 0`. Lo único que cambia es **cuándo** corre. Cualquier otro retoque de encuadre es otro spec. |
| 4 | **`GeolocateControl` nativo de MapLibre, no un botón propio.** `maplibre-gl` 5.24 ya está instalado y el mapa **ya** carga controles con el look default (`NavigationControl` en `top-right`): sumar otro de la misma familia es más coherente, no menos. Regala punto azul, círculo de precisión y —lo que importa— **pide el permiso al tocarlo**, así que la decisión 17 se cumple sin discutirla de nuevo. Es la regla de *buscar primero lo que ya existe* (CLAUDE.md § Convenciones): un botón propio serían ~60 líneas para volver a dibujar el punto azul y los estados de permiso. |
| 5 | **El control NO se cablea a las `coords` del shell.** Verse en el mapa es un gesto de cámara; «Cerca de mí» es un filtro. Cada uno con su responsabilidad: cero estado compartido nuevo y ningún gesto de cámara que dispare un re-fetch (que es justo lo que la decisión 1 tiene que esquivar). Si el permiso ya se dio por «Cerca de mí», el browser **no vuelve a preguntar** — el costo de mantenerlos separados es nulo. |
| 6 | **Un toque = un centrado** (`trackUserLocation: false`), con `showUserLocation` y `showAccuracyCircle` prendidos y `fitBoundsOptions: { maxZoom: 15 }` (el mismo tope que el `fitBounds` de los pins, para que un toque no te deje en zoom de calle). Sin seguimiento continuo: gasta batería y pelea con el arrastre. |
| 7 | **El control se rotula en castellano rioplatense: «Dónde estoy».** MapLibre lo dibuja con `title`/`aria-label` en inglés; se pisan después de `addControl`. No es cosmético — el CLAUDE.md manda que **toda** la UI vaya en rioplatense, y un tooltip en inglés en la pantalla principal es el tipo de cosa que se cuela por venir de una librería. |
| 8 | **`PBETA-R1-06` se resuelve colapsando, no con pantalla completa.** En modo mapa se esconde **el buscador de texto** (nadie tipea el nombre de un bar mirando pins) y los chips de Ocasión pasan a **una fila que scrollea en horizontal**. Quedan a la vista los cuatro gestos que cambian resultados: selector de zona, chips de Ocasión (todos, scrolleando), Filtros y los chips activos. Descartado el `fixed inset-0` estilo Google Maps: da 844 px pero saca al mapa del flujo del `<main>` y obliga a revisar z-index contra los sheets, la mini-card del pin y el footer — mucho más costo del que paga el spec. Descartado también esconder los chips: son el atajo principal para cambiar lo que se ve, y +48 px de mapa no valen dejar al usuario mirando pins que solo puede cambiar abriendo un sheet. |
| 9 | **El mapa deja de tener alto fijo: `h-[70vh]` → `flex-1 min-h-0`.** El `<main>` de `app/page.tsx` **ya** es `flex min-h-screen flex-col` y `SearchShell` devuelve un fragmento, así que el contenedor del mapa **ya es un flex item de `main`** (verificado en vivo). Con `flex-1` llena exactamente lo que queda **sin números mágicos** y en cualquier viewport, en vez de un `70vh` que en un teléfono corto se sigue cortando. Piso `min-h-[20rem]` para que en landscape no colapse a nada (ahí la página vuelve a scrollear, degradación aceptada). El esqueleto de carga (`search-shell.tsx:32`) cambia igual, para que el mapa no salte al montarse. |
| 10 | **`min-h-screen` → `min-h-dvh` en el `<main>` de la home.** `screen` es `100vh` y en mobile ignora la barra del navegador, así que el `flex-1` de la decisión 9 mediría de más justo donde duele. `h-dvh` ya se usa en el proyecto (`app/chat/chat-client.tsx:403`), no es una unidad nueva. **Radio de explosión:** es una `min-height` y afecta también al modo lista — puerta de ida y vuelta, una palabra. |
| 11 | **Centrarse fuera de AMBA avisa, no bloquea.** Si la posición cae fuera de `AMBA_BBOX` (`lib/geo/amba.ts`, dueño único, sin imports → se puede importar desde el cliente sin arrastrar nada), el mapa **igual** te lleva ahí (pediste verte, no buscar) y se muestra el aviso de la § Copy. Sin eso, el que abre desde Córdoba o de vacaciones ve un mapa vacío y cree que la app se rompió. |
| 12 | **Los errores de ubicación se muestran con el overlay que el mapa ya tiene** (`:209-219`, la píldora `bg-card/95` de "Cargando el mapa…"), no con un toast nuevo. Un patrón de aviso por pantalla. |

## Alcance del código

**`components/search/map-view.tsx`** — el archivo del spec.
- `addControl(new maplibregl.GeolocateControl({…}), 'top-right')` después del `NavigationControl`
  (queda debajo), con las opciones de la decisión 6 y el rótulo de la decisión 7.
- `camaraDelUsuario = React.useRef(false)`: lo marcan los eventos de la decisión 2; lo limpia un
  efecto sobre `serializeSearchParams(params)` (decisión 1).
- El efecto de pins (`:179-203`) suma **una** guarda: si `camaraDelUsuario.current`, no llama a
  `fitBounds` (los pins se dibujan igual — `setData` corre siempre).
- Suscripción a `geolocate` (marca la cámara + chequeo de `AMBA_BBOX`, decisión 11) y a `error`
  (aviso de la § Copy).
- El contenedor pasa de `h-[70vh]` a `flex-1 min-h-0 min-h-[20rem]` (decisión 9).

**`components/search/search-shell.tsx`**
- `const modoMapa = vista === 'mapa'`: el bloque del buscador (y su dropdown de sugerencias) no se
  renderiza en modo mapa; `OccasionChipsRow` recibe `compacto={modoMapa}`.
- El esqueleto de `next/dynamic` (`:32`) pasa a `flex-1 min-h-0 min-h-[20rem]`.
- **No cambia** `pedirUbicacion` ni el estado `coords` (decisión 5).

**`components/search/occasion-chips.tsx`**
- Prop nueva `compacto?: boolean`, **solo presentacional**: cambia `flex flex-wrap` por
  `flex-nowrap overflow-x-auto` con `shrink-0` en los botones. La lógica de pintado/toggle
  (subconjunto maximal, `FB-02`) **no se toca**.

**`app/page.tsx`**
- `min-h-screen` → `min-h-dvh` (decisión 10). Una palabra.

Sin migración, sin endpoint nuevo, sin cambios en `lib/`.

## Copy (rioplatense)

| Situación | Texto |
|---|---|
| Rótulo del control (`title` + `aria-label`) | **Dónde estoy** |
| Permiso denegado o error de geolocalización | **No pudimos ubicarte. Fijate que le hayas dado permiso al navegador.** |
| La posición cae fuera de AMBA | **Por ahora andamos solo por Buenos Aires y alrededores.** |

## Edge cases

- **Permiso ya denegado de antes**: MapLibre deshabilita el botón solo; el aviso sale igual por el
  evento `error`. No se insiste ni se vuelve a pedir.
- **Sin contexto seguro** (http): `navigator.geolocation` no existe. Producción y ngrok son https;
  el control se dibuja y el error cae en el mismo aviso.
- **`gps=1` sin coordenadas**: el mapa **ni se renderiza** (el shell muestra "Necesitamos saber
  dónde estás", `search-shell.tsx:286`). No hay caso.
- **Volver a «Lista» y entrar de nuevo a «Mapa»**: `MapView` se desmonta, así que el encuadre y el
  marcador de cámara nacen de cero. Correcto: entrar al mapa es una vista nueva.
- **0 pins**: el `fitBounds` ya no corre (`:199`); centrarse funciona igual y el aviso de "No hay
  nada para mostrar acá" sigue arriba.
- **Muchos chips activos en modo mapa**: envuelven a 2-3 líneas y el mapa se achica solo por el
  `flex-1`. No hay overflow de página: se auto-corrige.

## Criterios de done (DoD)

- [ ] Existe un control de ubicación en el mapa y **es el `GeolocateControl` de MapLibre**, no uno
      propio (verificable por `grep GeolocateControl components/search/map-view.tsx`).
- [ ] El permiso de ubicación **no** se pide al entrar al mapa: solo al tocar el control
      (decisión 17 de BUSQUEDA intacta).
- [ ] Tocar el control centra el mapa en el usuario, con punto azul y círculo de precisión, y el
      zoom no pasa de 15.
- [ ] Su rótulo accesible dice «Dónde estoy» — no queda texto en inglés en la pantalla.
- [ ] Con «Cerca de mí» prendido, centrarse y esperar el re-fetch **deja la cámara donde el usuario
      la puso** (decisión 1).
- [ ] Cambiar de zona o de filtros **sí** vuelve a encuadrar los pins, aunque antes te hayas
      centrado.
- [ ] `fitBounds` conserva `padding: 48`, `maxZoom: 15` y `duration: 0`: el único cambio es la
      guarda (decisión 3).
- [ ] `lib/search/params.ts` y `lib/search/query.ts` no tienen cambios; la URL no gana parámetros.
- [ ] En 390×844 y en modo mapa: el buscador no se ve, los chips de Ocasión están en **una** fila
      scrolleable, y el selector de zona, Filtros y los chips activos siguen a la vista.
- [ ] En 390×844 el mapa se ve **entero sin scrollear** (100%, contra el 67% de hoy) y
      `document.body.scrollHeight <= window.innerHeight`.
- [ ] Volver a «Lista» devuelve el buscador y los chips en varias filas, sin gesto nuevo que
      aprender.
- [ ] typecheck + tests + build verdes (el build con el dev server parado).

## QA manual (IDs propuestos)

| ID | Caso | Criterio |
|----|------|----------|
| MAPA-01 | Entrar a `/?z=palermo-soho` → «Mapa» sin tocar nada | No aparece ningún prompt de ubicación del browser |
| MAPA-02 | Tocar «Dónde estoy» la primera vez | Sale el prompt del browser; al aceptar, el mapa centra en el usuario con punto azul y círculo de precisión |
| MAPA-03 | Rechazar el permiso | Sale «No pudimos ubicarte. Fijate que le hayas dado permiso al navegador.»; el mapa sigue usable |
| MAPA-04 | Con «Cerca de mí» prendido: centrarse y esperar a que entren los pins nuevos | La cámara queda donde la dejó el usuario; no vuelve a encuadrar los pins |
| MAPA-05 | Centrarse y después cambiar de zona desde el sheet | El mapa **sí** encuadra los pins de la zona nueva |
| MAPA-06 | Centrarse, arrastrar el mapa y sacar un chip activo | Encuadra los pins (sacar un chip es cambio de búsqueda) |
| MAPA-07 | Abrir un cluster y después esperar un re-fetch por coords | El zoom del cluster no se pierde |
| MAPA-08 | Inspeccionar el rótulo del control (`aria-label`/`title`) | Dice «Dónde estoy»; no queda texto en inglés |
| MAPA-09 | Simular una posición fuera de AMBA (DevTools → Sensors) | El mapa te lleva ahí y avisa «Por ahora andamos solo por Buenos Aires y alrededores.» |
| MAPA-10 | 390×844, modo mapa: medir | El mapa se ve entero y `scrollHeight <= innerHeight` |
| MAPA-11 | 390×844, modo mapa: mirar los controles | Sin buscador; chips de Ocasión en una fila que scrollea con el dedo; zona, Filtros y chips activos visibles |
| MAPA-12 | Volver a «Lista» | Vuelven el buscador y los chips en varias filas; la lista queda como siempre |
| MAPA-13 | Modo mapa con 4-5 chips activos | Los chips envuelven, el mapa se achica solo y la página no gana scroll |
| MAPA-14 | 390×667 (teléfono corto) | El mapa sigue entrando entero, sin recortarse |

## v2 (fuera de scope)

- **Mapa a pantalla completa** (`fixed inset-0` con controles flotando): el patrón de Google Maps.
  Descartado por costo/beneficio (decisión 8), no por malo — si el mapa se usa mucho, es el paso
  siguiente natural.
- **"Buscar en esta zona"** al arrastrar el mapa: convertir el viewport en criterio de búsqueda.
  Es un cambio del modelo de estado (la decisión 12 de BUSQUEDA dice que la URL es el estado), no
  un detalle del mapa.
- **Seguimiento continuo** (`trackUserLocation: true`) para caminar mirando el mapa.

## Esfuerzo

**Una sesión.** Un control nuevo, un `ref` con su guarda, dos props presentacionales y un cambio de
alto. Todo el riesgo está concentrado en la decisión 1 — el resto es CSS.
