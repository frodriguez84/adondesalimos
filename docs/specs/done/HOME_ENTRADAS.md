# Spec: HOME_ENTRADAS — que desde la home se pueda descubrir que la app hace algo más que buscar

**Estado:** ✅ Implementado (2026-08-14)
**Prioridad:** Media — `PBETA-R1-05`, el hallazgo abierto más caro de los 33: la home es la
pantalla más vista y hoy un usuario puede usar la app entera creyendo que es un buscador de bares.
No es bloqueante porque nada está roto: está **escondido**.
**Gate:** ninguno.
**Bloquea:** nada.
**Depende de:** HOME_IDENTIDAD (el hero del estado vacío, que es donde se apoya todo esto),
BUSQUEDA (decisión 2 — la primera visita no lista nada hasta elegir zona, que es lo que le deja
lugar al hero), CHAT_IA (decisión 20 — la landing sin login de `/chat`, el patrón que la decisión 3
reusa), VOTACION (decisión 1 — el creador siempre tiene cuenta), AUTH (decisión 9 — sesión
verificada inline en el server component).

---

## Problema

`PBETA-R1-05`: la home entera tiene **dos** links —`/login` y `/legales`—. No hay ninguna
referencia a votaciones, a `/chat`, a lo guardado ni a dar de alta un negocio.

Al leer el código, el hallazgo es más chico y más preciso de lo que dice su título. Lo que falta
no es navegación: es **anuncio para el que no tiene sesión**.

| | Sin sesión | Con sesión |
|---|---|---|
| Votaciones · chat · guardados · negocio | **nada** | los 7 items, en `AccountMenu` |
| `/chat` | landing propia con CTA a ingresar (no redirige) | funciona |
| `/votacion/nueva` | **redirige a `/login`** | funciona |

O sea que hay dos agujeros distintos:

1. **El anónimo no se entera de nada.** `components/shared/account-menu.tsx:47-55`: sin sesión el
   componente entero se reduce a un `<Link href="/login">Ingresar</Link>`. Las siete rutas viven
   en la rama de abajo, la que solo se renderiza con `user`.
2. **El que sí tiene sesión las tiene detrás de una inicial redonda** (`account-menu.tsx:66-77`)
   que no se lee como menú: es un avatar, y los avatares no prometen navegación.

**La tensión, que es el punto.** El QA elogió lo que la home ya tiene: *«el headline y la bajada
dicen exactamente lo que hace la app y están en criollo»*. Sumar links es fácil; sumarlos sin
convertir la home en un menú es el trabajo. Por eso todo lo que entra acá vive **dentro del bloque
del hero, el que ya se colapsa apenas hay búsqueda** (`app/page.tsx:118-127`): cuando el usuario
está buscando —el 90% del uso— la home no cambia ni un píxel.

### `PBETA-R2-03` ya está arreglado — no entra acá

El pedido original juntaba `R1-05` con `R2-03` («el espejo: invitados que llegan a votar y no se
enteran de que hay un buscador»). **`R2-03` era BLOQUEANTE y se arregló en F3.** Está en el código:
`app/votacion/[token]/page.tsx:104-125` muestra **«Te invitó Pepe»** (o «Tu votación» si sos el
creador) y **«Elegí a dónde ir: votás sin crear cuenta. Esto es ¿A dónde salimos?, la app para
decidir la salida con el grupo.»** Quién invitó ✔, qué es la app ✔. Por eso `R2-03` **no figura**
entre los 33 pendientes del BACKLOG: la lista salta de `R2-02` a `R2-04`.

Lo que sigue flojo de esa punta no es el anuncio sino **la calidad de la salida hacia el buscador**:
el link «Inicio» mide 35×20 y no dice adónde va, y el del pie está a 990 px de scroll. Eso ya tiene
ID propio y sigue abierto —**`PBETA-R2-05`**, un pase mecánico de tamaños de toque— y ahí va.

## Objetivo

Que alguien que entra por primera vez, sin cuenta, se entere en la primera pantalla de que la app
**decide en grupo** y de que **hay una IA** — sin que la home deje de ser una búsqueda.

## Qué NO es esta feature

- **No es un menú de navegación en la home.** Si el resultado se lee como una lista de secciones,
  salió mal: el hero es una oferta con un motivo antes de cada puerta, no un índice.
- **No anuncia «Mis lugares» ni «Registrá tu negocio»** (decisión 2). Siguen solo en el menú.
- **No es una tab bar** ni ningún patrón de navegación global (evaluado y descartado, decisión 1).
- **No toca `SearchShell`, el motor de búsqueda, los chips ni la URL.** Todo lo nuevo vive arriba
  del shell, en el bloque que ya se colapsa.
- **No toca el estado con búsqueda activa**: con `tieneBusqueda(params) === true` la home queda
  exactamente igual que hoy.
- **No arregla `PBETA-R2-05`** (los toques de la votación) ni `R2-02` (`og:image`): son otros IDs.
- **No cambia el gate de sesión de `/votacion/nueva`.** Armar una votación **sigue requiriendo
  cuenta** (decisión 1 de VOTACION). Lo único que cambia es qué ve el que no la tiene.

## Decisiones cerradas

| # | Decisión |
|---|----------|
| 1 | **Las entradas van como texto en el hero del estado vacío**, no como tarjetas, no como tab bar. Motivo: el bloque `!tieneBusqueda` ya es una mini-landing y **ya se colapsa solo** al buscar, así que el costo en la pantalla de trabajo es cero. Descartadas: dos tarjetas bajo el buscador (empujan la búsqueda abajo del pliegue en 390 px) y la tab bar (cambio estructural, 56 px en **todas** las pantallas y pelea con el mapa a pantalla completa, que se acaba de ganar en MAPA). |
| 2 | **Se anuncian dos, y solo dos: votaciones y chat IA.** Votaciones porque es lo que diferencia a la app de un buscador y es el motor del loop viral; chat porque es la venta del premium y `/chat` ya sabe recibir anónimos. **Quedan afuera** «Mis lugares» (sin sesión y sin nada guardado lleva a una pantalla vacía: es una feature de vuelta, no de primera visita) y «Registrá tu negocio» (le habla a otro rol; en el hero es ruido para el 99%). Los dos siguen en el menú. |
| 3 | **Cada puerta es una línea completa, y la línea entera es el link** — una por renglón, no las dos inline en el mismo párrafo. Motivo: es la forma de que el área de toque llegue a **44 px** sin inventar un componente. Dos links inline en un párrafo que se parte en dos líneas a 360 px terminan apilados y con las áreas de toque solapadas, que es justo el bug que `R1-08` y `R2-05` vienen a cerrar. |
| 4 | **`/votacion/nueva` sin sesión deja de redirigir: muestra una landing con el mismo patrón que `/chat`** (explicación corta + CTA a `/login?callbackUrl=/votacion/nueva`). Motivo: anunciar algo y que la puerta sea un formulario de login sin contexto es peor que no anunciarlo, y el patrón ya existe y ya está justificado (CHAT_IA, decisión 20: *«conviene venderla antes de pedir cuenta»*). **No se reimplementa la pantalla**: se reusa la forma de `app/chat/page.tsx:37-52`. El gate real no se toca — sigue siendo server-side en `crearVotacion`. |
| 5 | **El menú de cuenta se abre también sin sesión**, con los items públicos: *Armar votación · Chat IA · Ingresar*. Arregla de paso el segundo agujero (con sesión hay 7 rutas detrás de un avatar). |
| 6 | **Sin sesión, el control del header pasa de «Ingresar» a un ícono de menú (☰), e «Ingresar» pasa a ser el primer item del menú, resaltado.** No conviven los dos controles: en 390 px el header ya lleva el wordmark, y con sesión el patrón ya es *un solo control a la derecha* — romper la simetría por una pantalla no se paga. **Costo aceptado y declarado:** ingresar deja de estar a un toque. Se acepta porque la app es usable entera sin cuenta (buscar, la ficha y votar no la piden) y las dos pantallas que sí la piden traen su propio CTA de ingresar. |
| 7 | **El copy es puerta de ida y vuelta y no se sobre-especea.** Va una propuesta abajo; ajustarla en la implementación o después de verla en pantalla no reabre el spec. Lo que **sí** es normativo: rioplatense, el motivo antes de la puerta, y ninguna línea que se lea como el nombre de una sección. |

### Copy propuesto (decisión 7 — ajustable)

```
¿Qué sale?
Bares, restos, shows y birras cerca tuyo. Decidí sin dar mil vueltas.

¿Van varios? Armá una votación y que elija el grupo  →
¿No sabés qué pinta? Contale a la IA                 →
```

Cada uno de los dos últimos renglones es un `<Link>` de bloque, alto de toque ≥ 44 px, en el
mismo bloque `!tieneBusqueda(params)` que el headline y la bajada.

## Criterios de done (DoD)

- [ ] En `/` **sin sesión y sin búsqueda**, el volcado de `a[href]` incluye una entrada a la
      votación y una a `/chat`, además de `/legales` y del control de cuenta.
- [ ] Las dos entradas nuevas viven dentro del bloque `!tieneBusqueda(params)` de
      [`app/page.tsx`](../../app/page.tsx): con una búsqueda activa (`/?z=palermo-soho`) **no se
      renderizan**, y el DOM de esa pantalla no cambia respecto de hoy.
- [ ] Las dos entradas miden **≥ 44 px de alto** de área de toque a 390 px y a 360 px, medido con
      `getBoundingClientRect()`.
- [ ] `/votacion/nueva` sin sesión responde **200 con la landing**, no un redirect a `/login`, y la
      landing tiene un CTA a `/login?callbackUrl=/votacion/nueva`.
- [ ] `/votacion/nueva` **con** sesión sigue funcionando igual que hoy (el gate «1 activa» sigue
      siendo server-side en `crearVotacion`; esta pantalla no lo pre-chequea).
- [ ] El header sin sesión muestra un control de menú con `aria-haspopup="menu"` que abre
      *Armar votación · Chat IA · Ingresar*.
- [ ] Ningún string de la UI nueva está en español neutro (voseo en las tres líneas).
- [ ] `npm run typecheck` y `npm test` en verde; `next build` con el dev server parado.

## QA manual (IDs propuestos)

| ID | Caso | Criterio |
|----|------|----------|
| ENTR-01 | `/` sin sesión, 390×844 | Se ven las dos líneas nuevas en la primera pantalla, sin scrollear |
| ENTR-02 | `/` sin sesión → volcado de `a[href]` | Aparecen la entrada a la votación y `/chat` |
| ENTR-03 | `/?z=palermo-soho` (búsqueda activa) | Las dos líneas **no** están en el DOM |
| ENTR-04 | Medición de toques a 390 px y 360 px | Las dos entradas ≥ 44 px de alto |
| ENTR-05 | Tocar «Armá una votación» sin sesión | Llega a una landing que explica qué es, **no** a `/login` pelado |
| ENTR-06 | Esa landing → CTA ingresar | Va a `/login?callbackUrl=/votacion/nueva` y, tras loguearse, cae en `/votacion/nueva` |
| ENTR-07 | Tocar «Contale a la IA» sin sesión | Llega a la landing de `/chat` que ya existe (no se creó una segunda) |
| ENTR-08 | `/votacion/nueva` con sesión | Se arma una votación igual que antes; el gate «1 activa» sigue devolviendo 409 |
| ENTR-09 | Header sin sesión | El control ☰ abre menú con *Armar votación · Chat IA · Ingresar* |
| ENTR-10 | Header con sesión | El menú sigue con los 7 items de hoy, sin cambios |
| ENTR-11 | Copy | Las tres líneas están en rioplatense (voseo), ninguna se lee como nombre de sección |
