# Spec: Navegación «atrás» en móvil

**Estado:** ✅ Implementado (2026-08-14)
**Prioridad:** Media-Alta — hay un bug **medido** que rompe el loop viral: quien abre un link
compartido y toca «Volver» se va de la app (ver Problema, hallazgo 3)
**Gate:** Ninguno
**Bloquea:** nada
**Depende de:** [`BUSQUEDA`](../done/BUSQUEDA.md) (decisiones 12 y 29 — esta última se
**enmienda** acá), [`FICHA`](../done/FICHA.md) (§ Diseño, botón Volver)

---

## Problema

Recorriendo *home → ficha → otra → otra*, el botón físico del celular deshace **paso por paso**.
Lo esperable es subir por la **jerarquía** (ficha → home), no por el **historial**. En una PWA
—y esta lo es: `display: 'standalone'`, o sea **sin barra de navegador**— el botón físico **es**
el history del browser: no hay API para «subir un nivel». La única palanca es **qué navegación
mete una entrada al stack**.

### Lo medido (2026-08-14, Playwright contra el dev server, viewport 390×844)

**Eje A — estados de la misma pantalla** (todo pasa en `/`, el mismo listado):

| Acción | Δ `history.length` |
|---|---|
| Tocar zonas *dentro* del sheet | 0 |
| Confirmar «Ver 1.094 lugares» (zona) | **+1** |
| Tocar un chip de ocasión (prender) | **+1** |
| Tocar el mismo chip (apagar) | **+1** ← y la URL vuelve a ser **idéntica** |
| Aplicar el sheet de Filtros | **+1** (`search-shell.tsx:399`) |
| «Limpiar búsqueda» | **+1** (`search-shell.tsx:137`) |
| Buscar por texto · aceptar sugerencia · quitar una píldora | 0 (ya son `replace`) |
| Toggle mapa/lista · scroll infinito | 0 (no navegan) |

**Eje B — pantallas de verdad:**

| Acción | Δ |
|---|---|
| Card → ficha | +1 |
| Ficha → back → otra ficha | **0** — el `push` trunca el forward |

**Recorrido real** (`home → zona → chip → chip → destildar chip → ficha`): `history.length`
2 → 6 más la ficha. **5 backs hasta la home, y 4 de los 5 son la misma pantalla de búsqueda.**

### Los tres hallazgos que ordenan el diseño

1. **El eje B no es el problema.** `ficha → back → otra ficha` **no crece nunca**. Lo que infla
   el stack es el eje A, sin cambiar de pantalla. El planteo original apuntaba a las pantallas;
   la medición dice que son los filtros.
2. **El «atrás que no hace nada visible» ya pasa hoy, y no lo causa ninguna intercepción: lo
   causa el `push` del chip.** Verificado back por back: el back #1 devuelve
   `?z=palermo-soho&t=bar,cerveceria`, el #2 rebota a un estado que el usuario **ya había
   descartado** (el chip que apagó) y el #3 devuelve **la misma URL que el #1**. Prender y apagar
   un chip deja **dos** entradas para un estado que no cambió.
3. 🔴 **En entrada fría, el «Volver» de la ficha te saca de la app.** Medido: pestaña limpia →
   `/lugar/<id>` → tocar Volver → `about:blank`. Es exactamente el caso del link de WhatsApp, que
   es el loop viral del producto: quien recibe un lugar **no tiene camino hacia adentro**. Y en
   `standalone` no hay barra de URL que le dé una salida.

**Contexto que también salió de la medición:** la ficha es la **única** pantalla con «volver»
cronológico (`router.back()`). Las otras 13 —chat, mis-lugares, votación, cuenta, legales,
mi-negocio, registrar-negocio, reclamar, admin, 404…— ya usan `<Link href="/">`, o sea **ya son
jerárquicas**. El chat incluso usa el **mismo ícono y el mismo `aria-label="Volver"`** para la
otra semántica: la misma affordance, dos comportamientos.

## Objetivo

Que el botón físico se comporte solo, **sin interceptarlo**: que filtrar no apile y que ninguna
pantalla de la app tenga como única salida irse de la app.

## Qué NO es esta feature

- **No es interceptar `popstate`** (decisión 7). Se evaluó y se descartó, con el porqué escrito.
- No toca la URL como estado ni el deep link compartible (BUSQUEDA decisión 12, intacta).
- No toca lo que ya es `replace`: texto, sugerencias, quitar píldora.
- No toca la vista mapa/lista ni el scroll infinito — no navegan.
- No agrega breadcrumbs, tab bar ni un modelo de navegación nuevo.
- No rediseña el header de ninguna pantalla.

## Decisiones cerradas

| # | Decisión |
|---|----------|
| 1 | **El eje A no apila.** Chip de ocasión, confirmar zona («Ver N lugares»), aplicar el sheet de Filtros y «Limpiar búsqueda» pasan a **`replace`**. Filtrar deja de meter entradas: son estados de la misma pantalla, no pantallas |
| 2 | **Enmienda a la decisión 29 de `BUSQUEDA`** («confirmar un sheet hace `push`»). Aquella resolvía *cuánto* inundaba el historial cada toque suelto; la medición del 2026-08-14 muestra que incluso una tanda por gesto deja 4 de 5 backs en la misma pantalla, y que el toggle-off apila un estado **idéntico** al anterior. Se enmienda con el número a la vista, no se re-litiga a ciegas |
| 3 | **Deshacer un filtro es trabajo de la UI visible, no del back.** Ya hay **tres** affordances en pantalla, verificadas en el snapshot: el chip queda `[pressed]` y se toca de nuevo, la píldora «Quitar Bar ×», y «Limpiar búsqueda». El back era la cuarta, la invisible y la cara |
| 4 | **La URL sigue siendo el estado y sigue siendo compartible.** `replace` **escribe la URL igual**: lo único que cambia es que no deja entrada. BUSQUEDA decisión 12 queda intacta — es la restricción que no se toca |
| 5 | **El «Volver» de la ficha es híbrido:** si hay historia propia en la pestaña → `router.back()` (vuelve al listado **con los filtros puestos**, que es lo correcto y hoy ya funciona); si **no** la hay → sube a la home. Arregla el hallazgo 3 sin perder el contexto de búsqueda, que es lo que se perdería subiendo siempre |
| 6 | **«Hay historia propia» se detecta con un marcador propio.** `history.state` de Next **no sirve** (medido: solo trae `__NA` y `__PRIVATE_NEXTJS_INTERNALS_TREE` — internals privados, frágiles) y `document.referrer` **tampoco** (medido: `""` en entrada fría, y no cambia en navegación client-side). Guardia doble: flag por pestaña **y** `history.length > 1`, porque el `sessionStorage` se **clona** al abrir una pestaña nueva desde un link y el flag solo podría venir mentido |
| 7 | **No se intercepta `popstate`.** Con el eje A en `replace` el stack de una sesión de exploración queda en 2-3 entradas y el back físico se comporta solo: no hace falta. E interceptarlo es el riesgo caro —tocar atrás, no ver nada, tocar de nuevo y **irse de la app**—, que en `standalone` no tiene escape. Queda escrito para que una sesión futura no lo re-abra sin datos nuevos |
| 8 | **Subir en frío es `push`** (un `<Link href="/">`), igual que las otras 13 pantallas, no `replace`. No atrapa: el back físico devuelve a la ficha y el siguiente sale de la app, que es el contrato normal del browser |
| 9 | **Una regla, un dueño: `lib/navegacion/volver.ts`.** La decisión «¿back o subo?» es una función **pura** (`decidirVolver({ navegoEnLaApp, historyLength }) → 'atras' \| 'subir'`), testeable sin browser, más el marcador de navegación en un client component del layout. Nadie vuelve a llamar `router.back()` suelto: hoy hay un solo llamador (`components/lugar/ficha-actions.tsx:40`) y así se queda |
| 10 | **`aria-label="Volver"` pasa a tener una sola semántica**: siempre lleva a una pantalla de la app. Hoy el mismo rótulo hace dos cosas distintas según la pantalla |

## Criterios de done (DoD)

- [ ] Tocar un chip de ocasión **no** aumenta `history.length` (medido antes/después en vivo).
- [ ] Confirmar zona con «Ver N lugares» **no** aumenta `history.length`.
- [ ] Aplicar el sheet de Filtros **no** aumenta `history.length`.
- [ ] «Limpiar búsqueda» **no** aumenta `history.length`.
- [ ] La URL sigue reflejando zona/tags/q/gps y un deep link pegado en otra pestaña abre el
      mismo resultado (BUSQUEDA decisión 12 sin regresión).
- [ ] Desde una ficha abierta desde el listado: **un** back devuelve al listado **con los filtros
      aplicados**, y el **segundo** devuelve a la home.
- [ ] Con la ficha abierta en frío (pestaña nueva, sin historia previa), «Volver» lleva a la home
      y **no** deja `about:blank` ni sale de la app.
- [ ] `grep -rn "router.back()" app/ components/` devuelve **solo** el llamador que pasa por
      `lib/navegacion/volver.ts`.
- [ ] Tests unitarios de `decidirVolver` cubriendo: navegó / no navegó / flag clonado con
      `historyLength = 1`.
- [ ] La decisión 29 de `BUSQUEDA` queda con la nota de enmienda apuntando a este spec.

## QA manual (IDs propuestos)

| ID | Caso | Criterio |
|----|------|----------|
| NAV-01 | Tocar 3 chips seguidos en el listado | `history.length` **no** cambia entre el primero y el tercero; la URL sí acumula los tags |
| NAV-02 | Prender y apagar el mismo chip | El estado no queda duplicado en el stack; un back sale del listado, no rebota a un estado descartado |
| NAV-03 | Elegir zona con «Ver N lugares» | El listado carga con la zona y `history.length` no cambia |
| NAV-04 | Aplicar 2 filtros desde el sheet | Igual que NAV-03 |
| NAV-05 | «Limpiar búsqueda» | Vuelve al listado sin filtros y sin sumar entrada |
| NAV-06 | `home → zona → 2 chips → ficha` y volver con el botón **físico** | **2 backs** para salir del recorrido (eran 5): el primero devuelve el listado con los filtros puestos y el segundo sale del stack de la app. Precisión medida al implementar: la home limpia **no** es una entrada aparte —el listado filtrado la reemplaza, que es exactamente lo que busca la decisión 1—, así que ese segundo back es «estoy en la primera pantalla, atrás sale», el contrato normal del browser. A la home limpia se vuelve con «Limpiar búsqueda» (decisión 3) |
| NAV-07 | Ficha abierta desde el listado, botón «Volver» de la app | Vuelve al listado con los filtros, igual que hoy |
| NAV-08 | 🔴 Ficha abierta **en frío** (pestaña nueva / link de WhatsApp), botón «Volver» | Lleva a la home. **No** `about:blank`, **no** salir de la app |
| NAV-09 | Ficha en frío: «Volver» → home → botón físico | Devuelve a la ficha (no atrapa); el siguiente sale de la app. **Y tocar «Volver» de nuevo ahí vuelve a subir a la home**: medido al implementar, un marcador booleano («hubo alguna navegación») se prende con la subida misma y reabría el `about:blank` del hallazgo 3 tres toques más tarde. Por eso el marcador guarda la **pantalla de entrada** de la pestaña y no un booleano |
| NAV-10 | Deep link con filtros (`/?z=…&t=…`) abierto en pestaña nueva | Mismo resultado que en la sesión original |
| NAV-11 | PWA instalada (standalone), recorrido de NAV-06 | Mismo comportamiento, sin barra de navegador |
