# Spec: Pulido UX/UI + reestructura de /admin

**Estado:** ✅ Implementado (2026-07-27)
**Prioridad:** Media — #4 de la cola post-spec-8, sin gate de negocio
**Gate:** Ninguno
**Bloquea:** nada
**Depende de:** BUSQUEDA (`done/BUSQUEDA.md`), HOME_IDENTIDAD (`done/HOME_IDENTIDAD.md`),
AUTH F3 (`done/AUTH.md`), CHAT_IA (`done/CHAT_IA.md`), MONETIZACION F4 (`done/MONETIZACION.md`),
COSTOS_ADMIN (`done/COSTOS_ADMIN.md` — código de `/admin` que este spec reestructura)

---

## Problema

Dos frentes que llegan juntos a la cola por venir del mismo QA integral (2026-07-26):

**A) Pulido UX/UI** — el QA integral (`docs/qa/AnalisisQA.md` § *QA integral*) y trabajo
previo dejaron 4 hallazgos concretos sin resolver, cada uno con recomendación ya escrita en
`docs/product/BACKLOG.md`:
1. Filtro fantasma: un tag activo con 0 lugares no tiene chip removible.
2. El wordmark de marca vive solo en el Home; el resto de la app no tiene presencia de marca.
3. Las fotos del dueño se suben tal cual (hasta 5 MB), sin redimensionar en el browser.
4. INT-05: el chat premium no cuenta impresiones para las estadísticas del dueño (B2B).
5. INT-14: el route de contenido del dueño valida la forma del payload antes que el ownership.

**B) `/admin` está apilado** — hoy es una sola page (`app/admin/page.tsx`) con 5 secciones
apiladas verticalmente (Precios → Suscripciones → Costos → Sugeridor de precio → Cola de
aprobación) en `max-w-2xl`. Desde que `COSTOS_ADMIN` sumó el tablero de costos (2026-07-26),
la página quedó larga de leer de punta a punta.

## Objetivo

- Resolver los 5 hallazgos de pulido de arriba.
- Reestructurar `/admin` en tabs, sin tocar el modelo de datos ni el gate de acceso.

## Qué NO es esta feature

- No es un rediseño de ninguna feature entera — es pulido sobre lo que ya existe.
- No toca los candados de costo de Google/chat (`lib/google/places.ts`, `lib/ai/`) ni el motor
  de búsqueda (`lib/search/query.ts`), salvo el hook puntual de impresiones del chat (decisión 6).
- No incluye auditoría formal de accesibilidad/performance (Lighthouse, umbrales numéricos) —
  decisión explícita de Fer (2026-07-27): foco acotado a los tracks ya identificados arriba.
  Si en el futuro se quiere ese criterio medible, es un track/spec aparte.
- No agrega rotación de chips, favoritos, ni ningún ítem de "Mejoras futuras" del backlog que
  no esté listado en el Objetivo.
- No incluye producción — sigue fuera de la cola (decisión de Fer, `IDEAS.md`).

## Decisiones cerradas

| # | Decisión |
|---|----------|
| 1 | **Un solo mini-spec** cubre pulido UX + reestructura de `/admin` (Fer, 2026-07-27): mismo QA integral de origen, y la reestructura de `/admin` es acotada — no amerita spec propio. |
| 2 | **`/admin`: tabs client-side sobre una sola ruta**, no rutas anidadas ni anchors (Fer, 2026-07-27). `app/admin/page.tsx` sigue siendo el único server component: mismo gate `sesionAdmin(await headers())` → `notFound()`, mismo `Promise.all` de las 9 queries que ya corre. Se agrega un componente cliente nuevo (`app/admin/tabs.tsx` o similar) que recibe esos datos ya resueltos como props y arma la navegación por tabs — sin fetch propio, sin duplicar el gate. Elegido sobre rutas anidadas porque esas exigirían repetir el gate en 4 archivos nuevos (riesgo de dejar uno sin proteger — señalado en el handoff de la sesión); sobre anchors porque no resuelve "todo se carga siempre" ni ayuda a leer una sección por vez. |
| 3 | **Orden de tabs: Cola de aprobación → Precios → Suscripciones → Costos** (Fer, 2026-07-27). El Sugeridor de precio queda agrupado **dentro** de la tab Costos, tal como ya vive pegado en el código actual (`app/admin/page.tsx:77-85`, ambos dentro de la sección de costos). Cola primero por ser la tarea operativa más frecuente. |
| 4 | **Sin criterio numérico de a11y/performance** (Fer, 2026-07-27). El DoD de este spec es la lista cerrada de 6 ítems de abajo, no una auditoría abierta. |
| 5 | **Filtro fantasma — arreglo robusto, no el débil** (recomendación ya escrita en `BACKLOG.md`, adoptada). `ChipsActivos` (`components/search/search-shell.tsx:339-378`) dibuja un chip removible para **todo** slug presente en `params.tags`, aunque `etiquetaDeTag` devuelva `null` (tag sin label porque el catálogo lo esconde por 0 lugares) — cae a un label de fallback (slug legible) en vez de `continue`-ar. La alternativa débil (alinear `filtrosDeTags` con el catálogo) se descarta: resuelve el 0 resultados pero deja el badge fantasma. |
| 6 | **INT-05 — sí contar impresiones del chat** (Fer, 2026-07-27). Se agrega `registrarImpresiones(ids)` al cierre del turno en `lib/ai/chat.ts`, con el mismo patrón `after()`-agregado-puro que `app/api/search/route.ts:52`. El conjunto a contar es **`lugares.map(l => l.id)`** (los efectivamente citados/mostrados como card al final del turno, `lib/ai/chat.ts:166,178`), **no** `idsNuevos` (que incluye resultados de tool-call que el modelo pidió pero no llegó a mostrar) — mismo criterio que la búsqueda: solo cuenta lo que el usuario vio. |
| 7 | **INT-14 — mover el chequeo de ownership antes de la validación de forma** (Fer, 2026-07-27). Hoy `verificarDueno` es interno a `lib/negocio/acciones.ts:33` y se llama recién dentro de `guardarContenido`, después de que el route (`app/api/mi-negocio/[placeId]/content/route.ts:47`) ya corrió `contenidoSchema.safeParse`. Se exporta `verificarDueno` (o un wrapper) y el route lo llama **antes** del `safeParse`, devolviendo 403 para un no-dueño sin importar la forma del payload. |
| 8 | **Resize de fotos del dueño en el browser** (recomendación ya escrita en `BACKLOG.md`, adoptada). En `app/mi-negocio/[placeId]/fotos-editor.tsx`, antes del `fetch` a `/api/mi-negocio/[placeId]/photos` (línea 49), la imagen se redimensiona vía `canvas.toBlob('image/webp')` con tope ~1600px de lado mayor. El límite de 5 MB y la validación server-side (`route.ts` de photos) quedan intactos — el cliente no es boundary de seguridad, solo optimizador. |
| 9 | **Header de marca — dónde sí y dónde no** (Fer a confirmar en implementación si hace falta afinar; base: recomendación de `BACKLOG.md`). Se suma `Wordmark` (`components/shared/wordmark.tsx`, ya existe) en un header compartido para las páginas sin marca propia hoy: ficha (`app/lugar/[id]`), `/cuenta`, `/votacion/[token]`, Mi negocio (`app/mi-negocio/[placeId]`). No se toca la ficha (ya tiene su barra volver/compartir) ni votación (ya tiene "VOTACIÓN / Inicio") más allá de sumar el wordmark donde falte — se reusa el componente y los tokens existentes, sin hardcodear color ni gradiente en controles (regla de `IDENTIDAD.md`). |

## Criterios de done (DoD)

- [ ] Filtro fantasma: un tag en la URL sin label del catálogo dibuja un chip removible (fallback a slug legible); sacar el chip navega sin ese tag. Test de regresión: tag en URL sin lugares ⇒ chip presente.
- [ ] Header de marca (`Wordmark`) presente en ficha, `/cuenta`, `/votacion/[token]` y Mi negocio, sin romper los headers propios de cada página.
- [ ] Subida de fotos del dueño redimensiona en el browser (`toBlob('image/webp')`, tope ~1600px) antes del POST; el límite de 5 MB y la validación server-side no cambian.
- [ ] El chat premium suma impresiones (`registrarImpresiones`) de los lugares mostrados en cada turno, mismo patrón agregado que búsqueda/ficha (sin `user_id`).
- [ ] `PATCH /api/mi-negocio/[placeId]/content` responde 403 a un no-dueño con payload inválido (no 400).
- [ ] `/admin` reestructurado en tabs client-side, orden Cola → Precios → Suscripciones → Costos (Sugeridor agrupado en Costos); gate `sesionAdmin` sigue viviendo solo en `app/admin/page.tsx`; los dos patrones existentes (client con `router.refresh()` para Precios/Cola, server read-only para Suscripciones/Costos) se mantienen sin cambios internos.
- [ ] typecheck + tests + build verdes (build con el dev server parado).

## QA manual (IDs propuestos)

| ID | Caso | Criterio |
|----|------|----------|
| PULIDO-01 | `/?t=<tag-sin-lugares>` | Aparece chip removible; sacarlo navega a `/` sin el tag |
| PULIDO-02 | Navegar ficha → `/cuenta` → `/votacion/[token]` → Mi negocio sin loguearse en cada una | Wordmark visible en las 4, headers propios de ficha/votación intactos |
| PULIDO-03 | Subir foto de celular (~4 MB) en Mi negocio | Upload manda un archivo bajo ~300 KB; foto se ve bien en la ficha |
| PULIDO-04 | Chat premium: pedir un lugar, recibir cards | `place_impressions_daily.impressions` del lugar mostrado sube en +1 |
| PULIDO-05 | `PATCH /content` como no-dueño con payload roto | Responde 403 `NO_AUTORIZADO`, no 400 |
| PULIDO-06 | `/admin` como admin | Tabs en orden Cola/Precios/Suscripciones/Costos; cada acción (aprobar cola, editar precio) sigue funcionando igual que antes |
| PULIDO-07 | `/admin` como no-admin (o anónimo) | 404, gate intacto |
