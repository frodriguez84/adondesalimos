# Spec: Home + Identidad — estado vacío con onda + paleta real

**Estado:** ✅ Implementado (2026-07-23)
**Prioridad:** Alta — un link de votación compartido (el loop viral de VOTACION) hoy abre en
la paleta placeholder de dev (ámbar/negro de StressPlan) y con un `h1` de texto pelado: parece
un proyecto a medio hacer. Es la primera impresión de todo el que llega por un link compartido.
**Gate:** Ninguno.
**Bloquea:** nada.
**Depende de:** `docs/product/IDENTIDAD.md` (fuente de verdad del diseño), BUSQUEDA (home =
search, el estado vacío ya renderiza distinto), VOTACION (el link compartido que se quiere pulir).

---

## Problema

Dos cosas heredadas del scaffold conviven hoy y se ven amateur:

1. **Paleta placeholder.** La app corre con la paleta provisoria copiada de StressPlan
   (fondo `#0F0F0F` + ámbar `#F59E0B`). La identidad real ya está diseñada y fijada en
   `docs/product/IDENTIDAD.md` (naranja `#FF8A00`, fondo azulado `#0D0D1F`, rosa/violeta/
   turquesa/amarillo de categorías) pero **nunca se aplicó al código**.
2. **Home sin marca ni onda.** El home es un `h1` de texto (`¿A dónde salimos?`) y, en la
   primera visita (sin búsqueda), no tiene ningún gancho: no comunica qué es la app ni invita
   a arrancar. No hay logo.

Los dos ítems están en `docs/product/BACKLOG.md` § Mejoras futuras ("Identidad visual: aplicar
logo y paleta" y "Home: landing o buscador + pulido"). El propio backlog recomienda hacerlos
**juntos, como una sola pasada visual coherente** — este spec los ejecuta juntos.

## Objetivo

Que el home (y por transitividad toda la app, que usa tokens) se vea como un producto
terminado en la identidad real:

- **Paleta real aplicada** vía tokens de `globals.css` + los tres focos fuera de los tokens.
- **Wordmark real** en el header (pin + texto), en lugar del `h1` de texto.
- **Estado vacío = mini-landing**: hero con headline rotativo rioplatense + frase de valor,
  que se colapsa apenas hay búsqueda. Los chips de Ocasión (ya en el shell) son el gancho.

## Qué NO es esta feature

- **No es un rediseño.** Cambios quirúrgicos: swap de tokens, un componente de wordmark, un
  hero condicional. No se reestructura el `SearchShell` ni el flujo de búsqueda.
- **No es una route de landing aparte.** El estado vacío del home **es** la landing (decisión
  cerrada en el BACKLOG: buscador de una, sin landing separada). Una landing de marketing
  completa queda para cuando se vaya a prod/SEO — no se decide acá.
- **No mapea cada faceta de la taxonomía a un color de categoría.** Las 4 categorías
  (rosa/violeta/turquesa/amarillo) se registran como tokens disponibles y se usan donde es
  natural y de bajo riesgo (pins → rosa, gradiente de marca). Cablear color por faceta es
  curaduría/UX aparte → queda anotado en BACKLOG.
- **No toca los 4 colores del logo de Google** (`ficha-google.tsx`): son marca de Google y
  condición de la atribución de FICHA.
- **No crea un asset raster nuevo** del wordmark (el `logo-identidad.png` es el board completo,
  no un wordmark aislado). El wordmark se arma con texto estilado + un pin SVG inline.
- **No anima la rotación del headline** (nada de carrusel/interval): una sola elección al montar.

## Decisiones cerradas

| # | Decisión |
|---|----------|
| 1 | **Paleta y wordmark van juntos**, en una sola pasada. Es la recomendación del BACKLOG: una pasada visual coherente, no dos cambios sueltos que drifteen. |
| 2 | **Swap de paleta = tokens de `globals.css`** (drop-in): `--primary`/`--accent`/`--ring` ámbar `#F59E0B` → naranja `#FF8A00` (mismo contraste, 8.12 vs 8.93 sobre el fondo). Fondo `#0F0F0F` → `#0D0D1F`. `--primary-foreground`/`--accent-foreground` `#0F0F0F` → `#0D0D1F`. |
| 3 | **Neutros con tinte azulado leve** (divergencia explícita de IDENTIDAD, que solo fija el fondo): `--card`/`--popover` `#1A1A1A` → `#1A1A2E`; `--secondary`/`--muted`/`--border`/`--input` `#2A2A2A` → `#2A2A3E`. Motivo: un card gris puro sobre fondo azulado se ve sucio. `--foreground` `#F5F5F5` y `--muted-foreground` `#888888` no cambian (grises, contraste ya medido y neutral). |
| 4 | **Colores de categoría como tokens nuevos** en `@theme`: `--color-rosa #FF2D75`, `--color-violeta #7B3FFF`, `--color-turquesa #00D4C4`, `--color-amarillo #FFD400`. Quedan disponibles; su cableado por faceta es trabajo aparte. |
| 5 | **Los tres focos fuera de los tokens** (IDENTIDAD § "los tres focos"): (a) `lib/email/index.ts` — hex a mano: bg `#0F0F0F`→`#0D0D1F`, card `#1A1A1A`→`#1A1A2E`, borde/box `#2A2A2A`→`#2A2A3E`, **CTA `#F59E0B`→`#FF8A00` (color plano, no gradiente — Outlook los ignora)**, texto sobre CTA `#0F0F0F`→`#0D0D1F`. (b) pins `#e11d48` → rosa `#FF2D75` en `map-view.tsx` (2) y `pin-picker.tsx` (1). (c) logo de Google en `ficha-google.tsx` → **NO SE TOCA**. |
| 6 | **Wordmark = texto estilado + pin SVG inline** (`components/shared/wordmark.tsx`, server component). Pin: teardrop SVG con gradiente rosa→naranja→amarillo y centro calado (sobrevive a cualquier tamaño, a diferencia del gradiente sobre texto fino). Texto: "¿A dónde salimos?" con "salimos?" en naranja sólido (variante monocroma que pide IDENTIDAD para 28-32 px). El gradiente sobre texto se reserva al hero grande. |
| 7 | **Header = wordmark siempre visible** (reemplaza el `h1`), con el `AccountMenu` al lado. La tagline y el hero solo aparecen en el estado vacío. |
| 8 | **Estado vacío (`!tieneBusqueda(params)`) = hero**: headline rotativo (gradiente de marca, tamaño grande) + frase de valor. Se renderiza en `page.tsx` (server) entre el header y el `SearchShell`, condicional a `!tieneBusqueda`. Se colapsa (no se renderiza) apenas hay búsqueda. |
| 9 | ~~**Headline rotativo = aleatorio por visita, resuelto client-side** (`'use client'`). SSR renderiza siempre la primera frase; un `useEffect` elige una al azar tras montar.~~ **Superada por 9-ter el 2026-08-21** — se deja escrita porque el porqué del cambio no se entiende sin ella. |
| 9-bis | ⚠️ **Enmienda del 2026-08-21 — el headline rota sobre OCASIONES, no sobre sinónimos.** Las tres originales eran *"¿Qué sale?" · "¿Qué pinta?" · "¿Qué hacemos?"* (el *"¿Qué se te antoja?"* ya estaba descartado por sonar a doblaje). El problema no era la voz, que estaba bien: eran **tres formas de decir exactamente lo mismo**, o sea que la rotación pagaba código y compraba variedad en la única dimensión que no informa nada — y con la marca siendo también una pregunta, el que entraba leía cuatro preguntas y ninguna respuesta. Las cuatro nuevas son **"¿Birra con amigos?" · "¿Cena tranqui?" · "¿Salir a bailar?" · "¿Sala de escape?"** (elegidas por Fer): mismo registro rioplatense, pero **cada una le hace de anticipo a un chip de Ocasión que está unos centímetros más abajo en la misma pantalla**. La función la carga la bajada (ver `HOME_ENTRADAS`), así que el H1 no tiene que explicar nada. |
| 9-ter | ⚠️ **El sorteo se mudó al SERVER el 2026-08-21, y con eso muere el `'use client'` de la decisión 9.** Lo reportó Fer probando las frases nuevas con F5: *«cuando aparece "¿Birra con amigos?" pega un salto y aparece otro»*. La causa era estructural y estaba desde el día 1 — el HTML servido traía siempre `FRASES[0]` y el `useEffect` sorteaba recién al montar, así que **3 de cada 4 recargas mostraban el reemplazo en vivo**. Con las frases viejas (todas cortas, del mismo largo, una línea) era un parpadeo sutil; con las de 9-bis, que varían de ancho y una parte en dos líneas a 360 px, el reemplazo **mueve el layout**. O sea: el cambio de copy no introdujo el defecto, **lo hizo visible**. Ahora el componente elige al renderizar, no lleva `useState` ni `useEffect`, y el HTML llega con la frase final. Verificado: 10 pedidos ⇒ 4 frases distintas en el HTML servido, `MutationObserver` sobre el `<h1>` ⇒ **cero mutaciones tras montar**, consola sin warnings. |
| 9-quater | ⚠️ **Dos cosas que un cambio futuro va a romper, y ninguna tira error.** (a) **La lección AUTH F4 no se está violando: se está leyendo bien.** Esa lección es sobre un componente **cliente que también renderiza en el server** —los dos lados calculan y pueden discrepar—; acá hay **un solo render** y no existen dos resultados que puedan no coincidir. Volver a poner `'use client'` con el sorteo adentro reabre el salto. (b) **Esto depende de que la home siga siendo dinámica**, y hoy lo es porque `app/page.tsx` lee `headers()` para la sesión: si se volviera estática o con ISR, el `Math.random()` se evaluaría **una sola vez** —en el build o en la revalidación— y la frase quedaría congelada para todos hasta el próximo deploy. **La rotación simplemente dejaría de rotar, sin avisar.** Corolario que deja de valer: el orden del array ya **no** privilegia al índice 0 (antes era lo único que veían Google y el que rebotaba); igual se conserva a `escape-room` último, porque sigue siendo la ocasión más flaca —**34 lugares en toda el AMBA**, y su chip (*Jugar*) ni siquiera es `in_home`—. **Regla para tocar la lista: que cada frase pueda señalar un chip que exista y catálogo que lo respalde.** El H1 se banca la más angosta porque **no linkea a un resultado filtrado**, así que no promete un número. Medido a 360 px: *"¿Birra con amigos?"* parte en dos líneas y las otras tres entran en una; el buscador queda en 462 de 800 px, holgado arriba del pliegue — el wrap es cosmético. |
| 10 | **El "hint de cómo funciona" NO se duplica.** El `SearchShell` ya muestra "Elegí zona para arrancar / Decinos por dónde andás y te tiramos la posta" cuando no hay resultado — ese es el hint funcional. El hero aporta marca + mood (headline + frase de valor), no repite "elegí zona". |
| 11 | **Copy 100% rioplatense** (CLAUDE.md § Idioma): voseo, nada de español neutro. |
| 12 | **Cuarto foco fuera de tokens, hallado en QA (2026-07-23):** la estrella del rating en `ficha-google.tsx` usaba `text-amber-500` (= el ámbar viejo `#F59E0B`, único resto literal de la paleta anterior en la app fuera de los tres focos). No era decisión del spec, era leftover de StressPlan. Se pasa al amarillo de marca vía el token nuevo `text-amarillo` (`#FFD400`, "amarillo · destacados"). Es nuestro glyph del rating, no el logo de Google (los 4 colores del logo siguen intactos). Verificado en vivo: la estrella computa `rgb(255,212,0)`. |
| 13 | **Favicon / app-icon (agregado 2026-07-23, cierra el 404 de `favicon.ico`).** Fer generó el logomark aislado con transparencia real (`docs/product/assets/logo_2.png`, RGBA 1024×1024). Se recortó al pin (`app/icon.png`, 512×512, convención de Next) + `app/favicon.ico` (PNG 64×64 embebido). Verificado en vivo: `/icon.png` y `/favicon.ico` dan 200. **No** reemplaza el pin SVG del wordmark del header (a 24-28 px los íconos internos del logomark colapsan; ahí el SVG simple es mejor). Hero y header de marca global quedan para el mini-spec aparte. |

## Criterios de done (DoD)

- [ ] `globals.css`: tokens swapeados (naranja, fondo azulado, neutros con tinte) + tokens de
      categoría en `@theme`. Ningún `#F59E0B` ni `#0F0F0F` en las variables `:root`.
- [ ] Los tres focos: email con hex nuevos y CTA plano; pins en rosa `#FF2D75`; logo de Google
      intacto (`#4285F4`/`#34A853`/`#FBBC05`/`#EA4335` sin tocar).
- [ ] `components/shared/wordmark.tsx`: pin SVG con gradiente + texto; en el header reemplaza al
      `h1`. Legible y crisp a tamaño header (~24-28 px).
- [ ] `components/shared/rotating-headline.tsx`: SSR estable (primera frase), pick aleatorio
      tras montar, sin warning de hydration.
- [ ] Hero visible solo en el estado vacío; colapsa con búsqueda activa. No rompe el layout con
      resultados ni el `/votacion/[token]`.
- [ ] Contraste WCAG respetado (IDENTIDAD): texto oscuro sobre naranja/amarillo/turquesa/rosa;
      violeta solo como fondo con texto blanco. El texto del hero sobre `#0D0D1F` cumple AA.
- [ ] Verificación técnica: `typecheck` + `tests` verdes + `build` (con el dev server parado).
- [ ] QA en vivo (Playwright/MCP sobre ngrok): screenshots del home vacío, home con búsqueda y
      un `/votacion/[token]` en la paleta nueva. La evidencia visual la da el QA en vivo, no el
      checker read-only (lección BUSQUEDA).

## QA manual (IDs propuestos)

| ID | Caso | Criterio |
|----|------|----------|
| HOME_IDENTIDAD-01 | Home vacío (`/`) | Wordmark con pin en naranja/gradiente; hero con headline rioplatense + frase de valor; fondo azulado; chips de Ocasión visibles. |
| HOME_IDENTIDAD-02 | Home con búsqueda (`/?z=...`) | El hero se colapsa; el header mantiene el wordmark; la lista/mapa se ven en la paleta nueva; acción primaria naranja. |
| HOME_IDENTIDAD-03 | `/votacion/[token]` compartido | Se ve en la paleta nueva (fondo azulado, naranja de acción), sin restos de ámbar. |
| HOME_IDENTIDAD-04 | Rotación del headline | Recargar varias veces muestra distintas frases; sin warning de hydration en consola. ⚠️ Desde la enmienda 9-bis las frases son cuatro ocasiones, y el HTML servido trae **siempre** la primera. |
| HOME_IDENTIDAD-05 | Pins del mapa | Los pins y clusters se ven rosa `#FF2D75`, no el rojo `#e11d48` viejo. |
| HOME_IDENTIDAD-06 | Contraste | Texto sobre botones naranjas es oscuro y legible; nada de texto blanco sobre naranja/amarillo. |
