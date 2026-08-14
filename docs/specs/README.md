# Specs — manifiesto

Contratos de implementación. **No mezclar** con referencia (`../reference/`), ops
(`../operations/`) ni backlog (`../product/BACKLOG.md`).

**Regla de trabajo al implementar o cerrar un spec:** checklist en [`CLAUDE.md`](../../CLAUDE.md)
§ *Ciclo de vida de specs*. Formato del spec: [`../AGENTES.md`](../AGENTES.md).

| Estado | Significado |
|--------|-------------|
| 🟢 **Activo** | Normativo hoy — leer antes de tocar el código |
| 🔵 **Planned** | Decisiones cerradas — en cola de implementación |
| ⚫ **Done** | Implementado — resumen en [`../archive/SPECS_ARCHIVO.md`](../archive/SPECS_ARCHIVO.md) |

Un spec nuevo nace en `planned/` (usar [`/new-spec`](../../.claude/skills/new-spec/SKILL.md)).
Paths viejos tras un `git mv` llevan un stub con redirect.

---

## 🟢 Activos (`active/`)

| Spec | Qué es | Estado |
|------|--------|--------|
| [ABIERTO_AHORA](active/ABIERTO_AHORA.md) | Mini-spec — el chip «Para ahora»: filtra por la franja horaria actual (TZ AR) con los tags de Momento curados, y retira el tag `abierto-ahora` que miente. | **Parcial** — F1 ✅ 2026-07-30 · F2 (abierto **real** desde horarios de dueño) escrita y **gateada** en ≥ 50 lugares con horarios propios (hoy 1) |
| [DEPLOY](active/DEPLOY.md) | Poner la app en `adondesalimos.com.ar` con Neon (São Paulo) + Vercel Hobby, **US$0/mes**, con el cobro apagado (Hobby prohíbe el uso comercial) y el premium anunciado como "en camino" midiendo interés. Incluye la migración de datos —catálogo, zonas y la curaduría que **no están en el seed**— y su punto de no retorno. 4 fases; F3 (encender el cobro + Pro) gateada por interés medido. | **Parcial** — § *El premium apagado* ✅ 2026-08-01 (primer tramo de código de F1) · F0, el resto de F1, F2 y F3 pendientes |

## 🔵 Planned (`planned/`)

| Spec | Qué es | Estado |
|------|--------|--------|
| [HOME_ENTRADAS](planned/HOME_ENTRADAS.md) | Mini-spec — `PBETA-R1-05`: que desde la home se descubra que hay votaciones y chat IA. Dos líneas de texto en el hero del estado vacío (el bloque que ya se colapsa al buscar), landing sin login para `/votacion/nueva` con el patrón de `/chat`, y el menú de cuenta abierto también para anónimos. | 🔵 Planned — decisiones cerradas con Fer el 2026-08-14, sin código |

_(El resto de la carpeta son stubs de redirect de specs ya movidos: la cola de v2 está completa,
PULIDO_BETA pasó a `active/` el 2026-08-03 al arrancar su F1 y CURADURIA_POR_NOMBRE se escribió e
implementó el 2026-08-08, sin escala en `active/`.)_

Los cuatro specs de **v2** —escritos en la sesión de autoría del 2026-07-29, en el orden de
implementación decidido por Fer (momentum → impacto, IDEAS § Estado de la conversación
2026-07-27)— salieron todos de esta tabla: ABIERTO_AHORA a 🟢 Activos (F1 cerrada, F2 gateada) y
FAVORITOS, SUGERIR_EN_VOTACION y CHIPS_ROTACION a ⚫ Done. **La cola de v2 está completa.**

## ⚫ Done (`done/`)

| Spec | Resumen en SPECS_ARCHIVO |
|------|---------------------------|
| [CATALOGO](done/CATALOGO.md) | Spec 1 — catálogo, taxonomía e import de Overture. [Resumen](../archive/SPECS_ARCHIVO.md#catalogo) · ✅ 2026-07-20 |
| [ZONAS](done/ZONAS.md) | Spec 2 — 46 zonas de AMBA (GeoJSON versionados, sin PostGIS), primaria + buffer 400 m. [Resumen](../archive/SPECS_ARCHIVO.md#zonas) · ✅ 2026-07-20 |
| [BUSQUEDA](done/BUSQUEDA.md) | Spec 3 — home/búsqueda en 3 fases (motor+lista · selectores · chips+mapa). [Resumen](../archive/SPECS_ARCHIVO.md#busqueda) · ✅ 2026-07-20 |
| [FICHA](done/FICHA.md) | Spec 4 — `/lugar/[id]` en 3 fases; primer uso de Google en vivo (matching IDs-Only $0, Details Enterprise, 1 foto, cero caché). [Resumen](../archive/SPECS_ARCHIVO.md#ficha) · ✅ 2026-07-20 |
| [AUTH](done/AUTH.md) | Spec 5 — auth (better-auth), reclamo/alta con cola en `/admin`, panel "Mi negocio" (fotos a R2, contenido, horarios propios), teaser. 4 fases. [Resumen](../archive/SPECS_ARCHIVO.md#auth) · ✅ 2026-07-22 |
| [VOTACION](done/VOTACION.md) | Spec 6 — votación en grupo (el loop viral): shortlist de 2-5 lugares, voto anónimo por cookie, resultados en vivo, cierre/desempate del creador, expiración lazy 72 h; premium modelado y apagado. 3 fases. [Resumen](../archive/SPECS_ARCHIVO.md#votacion) · ✅ 2026-07-22 |
| [HOME_IDENTIDAD](done/HOME_IDENTIDAD.md) | Mini-spec — home + identidad: paleta real (naranja `#FF8A00` / fondo azulado), wordmark en el header, estado vacío con hero + headline rotativo, y favicon del logomark. [Resumen](../archive/SPECS_ARCHIVO.md#home_identidad) · ✅ 2026-07-23 |
| [MONETIZACION](done/MONETIZACION.md) | Spec 7 — MercadoPago (4 fases): instrumentación + precios en DB · cobro (Bricks, webhook, suscripciones por lugar) · destaque en búsqueda · desglose de estadísticas pago. Enciende `users.plan` (B2C) y `owner_plan` (B2B). [Resumen](../archive/SPECS_ARCHIVO.md#monetizacion) · ✅ 2026-07-25 |
| [CHAT_IA](done/CHAT_IA.md) | Spec 8 — chat con IA "armá tu salida" (`/chat`) premium + enciende el botón "la IA arma la shortlist" de VOTACION. 3 fases: motor/cupo/endpoint · UI `/chat` · modo shortlist. Tool-use sobre el motor con doble candado de grounding; modelo en `app_settings` (Sonnet 5); cupo 30/mes + probadita 3; topes por SKU que degradan. [Resumen](../archive/SPECS_ARCHIVO.md#chat_ia) · ✅ 2026-07-26 |
| [COSTOS_ADMIN](done/COSTOS_ADMIN.md) | Mini-spec — tablero de costos en `/admin`: chat IA en USD por tokens/modelo, Google por SKU vs cap (alerta 80/100%/apagado), vs mes anterior, cupo del chat; + sugeridor de precio premium según el dólar oficial (piso ≥ dólar × 3, solo sugerencia). Read-only, sin schema nuevo. [Resumen](../archive/SPECS_ARCHIVO.md#costos_admin) · ✅ 2026-07-26 |
| [PULIDO](done/PULIDO.md) | Mini-spec — pulido UX/UI (filtro fantasma, header de marca, resize de fotos, INT-05/INT-14) + reestructura de `/admin` en tabs. [Resumen](../archive/SPECS_ARCHIVO.md#pulido) · ✅ 2026-07-27 |
| [SUGERIR_EN_VOTACION](done/SUGERIR_EN_VOTACION.md) | Que cualquiera con el link sume lugares del catálogo a una votación abierta (techo total 8, 2 por dispositivo, el creador modera). **Revierte la decisión 2 de VOTACION.** Sin texto libre: solo `placeId` publicado. [Resumen](../archive/SPECS_ARCHIVO.md#sugerir_en_votacion) · ✅ 2026-07-31 |
| [CHIPS_ROTACION](done/CHIPS_ROTACION.md) | Mini-spec — los chips de Ocasión de la home se reordenan por día/hora (TZ AR) con reglas en `app_settings` (`chips.schedule`), degradando al orden por `sort` si el setting es inválido. Una regla puede traer un chip sin `in_home`. [Resumen](../archive/SPECS_ARCHIVO.md#chips_rotacion) · ✅ 2026-07-31 |
| [FAVORITOS](done/FAVORITOS.md) | Guardar lugares y listas (`place_lists` + `place_list_items`): free 1 lista · premium N, gate server-side día 1; botón en card, ficha y chat, página `/mis-lugares` con crear/renombrar/borrar, sheet de destino y métrica `saves` agregada. 2 fases. [Resumen](../archive/SPECS_ARCHIVO.md#favoritos) · ✅ 2026-07-31 |
| [PULIDO_BETA](done/PULIDO_BETA.md) | Pulido de UX/UI para la beta: los **6 recorridos reales** auditados en mobile (390×844) con ver y arreglar en fases separadas —43 hallazgos, los 10 BLOQUEANTE arreglados y re-verificados en vivo, 33 al backlog— + la app **instalable** (`manifest.ts`, de donde sale el splash gratis; splash propia descartada con motivo). Incluye el **alta nueva end-to-end**, el recorrido que nunca se había podido ver. [Resumen](../archive/SPECS_ARCHIVO.md#pulido_beta) · ✅ 2026-08-03 (único DoD sin verificar: PBETA-07, iOS) |
| [CURADURIA](done/CURADURIA.md) | Spec 9 — curaduría asistida de Ambiente/Momento/Actividad: batch offline con LLM que sugiere tags **con evidencia citada** + cola en `/admin`. Corrida completa autónoma con Sonnet (auto-apply de lo evidenciado): ~1.840 lugares, 1.149 tags, 5/9 chips prendidos. [Resumen](../archive/SPECS_ARCHIVO.md#curaduria) · ✅ 2026-07-27 |
| [CURADURIA_POR_NOMBRE](done/CURADURIA_POR_NOMBRE.md) | **Tanda B del feedback real** (`FB-10` + `FB-10b`): buscar un lugar **por nombre** en `/admin` → Curaduría y curarlo con el editor de siempre, sin cola ni `psql` (el buscador **no** filtra por publicado: consulta `isPlacePublished` para etiquetar, no para filtrar); + el 🔴 bug de que **guardar borraba el precio**. Sin migración ni código de guardado nuevo. **Destraba la curaduría de cobertura.** [Resumen](../archive/SPECS_ARCHIVO.md#curaduria_por_nombre) · ✅ 2026-08-08 |
| [ADMIN_USUARIOS](done/ADMIN_USUARIOS.md) | **Tanda C del feedback real** (`FB-01` + `FB-03`): tab **Usuarios** en `/admin` con el **premium de cortesía** —dar y sacar, B2C y B2B— extendiendo a `lib/billing/subscriptions.ts` (su dueño único), con motivo obligatorio y bitácora `plan_grants` append-only que **no** es fuente de verdad del estado; + el botón de copiar los mails de Interés. Saca de `psql` las dos operaciones de la beta. De paso unificó la 2ª copia de la escritura del flag que quedaba en `baja.ts`. [Resumen](../archive/SPECS_ARCHIVO.md#admin_usuarios) · ✅ 2026-08-08 |
| [MAPA](done/MAPA.md) | **Tanda D del feedback real** (`FB-04` + `PBETA-R1-06`), la que cierra el feedback entero: el `GeolocateControl` nativo de MapLibre para verte en el mapa (permiso solo al tocarlo, decisión 17 intacta) **sin que el `fitBounds` de los pins te robe la cámara** —el gesto del usuario gana hasta que cambie la búsqueda, no las coordenadas—; + el mapa entra entero en mobile (**67% → 100%**, `scrollHeight` = `innerHeight`) colapsando el buscador y pasando los chips a una fila scrolleable con barra propia. Sin migración, sin cambios en `lib/`. [Resumen](../archive/SPECS_ARCHIVO.md#mapa) · ✅ 2026-08-08 |
| [CORRECCION_DATOS](done/CORRECCION_DATOS.md) | **Ítem 6 de la cola post-v2** — corregir los datos base cuando Overture quedó viejo (el caso Matienzo: se mudó y el catálogo tenía la sede vieja, o sea el pin equivocado). La corrección se escribe en `places` y el re-import la respeta **campo por campo** (`places.locked_fields`, `text[]`); dueño único `lib/negocio/correcciones.ts`, que en **una transacción** escribe, une la marca, deja bitácora, re-asigna zonas e **invalida el match con Google** (que apuntaba al negocio de la dirección vieja — confirmado en vivo). Admin edita directo desde la **7ª tab «Lugares»**, el dueño **propone** por la cola que ya existía. Suma `formattedAddress` al field mask, costo marginal **US$0**. [Resumen](../archive/SPECS_ARCHIVO.md#correccion_datos) · ✅ 2026-08-09 |
| [ORDEN_ORGANICO](done/ORDEN_ORGANICO.md) | **`PBETA-R1-02`** — que la primera pantalla no abra con Burger King. **Enmienda la decisión 16 de BUSQUEDA**: el orden orgánico pasa a `dueño > banda > confidence > nombre`, donde la banda (0-3) combina **es cadena** (lista en `app_settings`, editable sin deploy, dueño único `lib/search/cadenas.ts`) y **está curado** (`place_tags source='admin'`), con la precedencia **cadena antes que curado** — medida, porque la curaduría curó 85 McDonald's y 41 Starbucks. Es **orden, no filtro**: `countPlaces` y el piso de los chips no se mueven (verificado con `diff` vacío de `cobertura-chips`). Una sola migración, y es un índice parcial. 29 de las 46 zonas cambiaron de #1. [Resumen](../archive/SPECS_ARCHIVO.md#orden_organico) · ✅ 2026-08-10 |

---

## Al cerrar un spec — checklist obligatorio (lo orquesta `/close-spec`)

| # | Qué | Dónde |
|---|-----|-------|
| 1 | Código + verificación técnica | typecheck · tests · build |
| 2 | QA con IDs trazables | `docs/qa/AnalisisQA.md` — sección nueva, IDs `FEATURE-NN`, ✅/❌. No condensar histórico |
| 3 | Resumen condensado | `docs/archive/SPECS_ARCHIVO.md` — anchor `{#slug}`, rutas, archivos clave, link al spec y al QA |
| 4 | Estado en el spec | Primera línea: `**Estado:** ✅ Implementado (YYYY-MM-DD)` o `Parcial — §X ✅; §Y pendiente` |
| 5 | Mover el spec | 100% cerrado → `git mv active/FOO.md done/`. Parcial → queda en `active/` |
| 6 | Manifiesto | `docs/specs/README.md` — mover fila a la tabla correcta |
| 7 | Cola de trabajo | `docs/product/BACKLOG.md` — **los dos**: tildar el ítem de la lista `[x]` con fecha **y** agregar la entrada al log `## Hecho` (al tope) |
| 8 | Stub de redirect | Si moviste el archivo: stub de 5 líneas en la ruta vieja |
| 9 | Lecciones (si aplica) | `docs/operations/LECCIONES_APRENDIDAS.md` |

**El spec es el árbitro. QA bloqueado = no PR.**

> Vivía en `CLAUDE.md` hasta el 2026-08-08; se mudó acá —el doc de la regla de trabajo de specs—
> para bajarle peso al archivo que se carga en toda sesión. **Sigue siendo obligatorio**: allá quedó
> la orden de correr `/close-spec`, que es lo que orquesta estos 9 pasos.

