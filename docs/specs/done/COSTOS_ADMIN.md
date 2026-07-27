# Spec: COSTOS_ADMIN — observabilidad de costos + sugeridor de precio en `/admin`

**Estado:** ✅ Implementado (2026-07-26)
**Prioridad:** Alta — #3 de la cola post-spec-8 (IDEAS § Estado de la conversación). El gasto
real de las APIs pagas hoy solo se ve por SQL, y el precio ARS del premium puede quedar por
debajo del piso sin que nadie lo note (el costo es USD, el ingreso ARS se licúa).
**Gate:** Ninguno.
**Bloquea:** nada.
**Depende de:** CHAT_IA (`chat_messages.tokens_*`, `ai_api_usage`, claves `ai.*`), FICHA
(`google_api_usage`, claves `google.*_monthly_cap`), MONETIZACION (`billing.precio_b2c_ars`,
patrón de `/admin`), `docs/product/COSTOS-IA-Y-PRECIO-PREMIUM.md` (modelo de costos y regla
del dólar), BACKLOG § sugeridor de precio (2026-07-26).

---

## Problema

Dos frentes de gasto en USD que hoy solo se ven por SQL contra el Postgres de Docker:

1. **Chat IA (Anthropic).** El costo real es por **tokens**, no por request. Vive en
   `chat_messages` (`tokens_in`/`tokens_out`/`model_used`, solo filas assistant). La tabla
   `ai_api_usage(month, sku, count)` cuenta **requests** (existe para el tope mensual
   `ai.chat_monthly_cap`) — no sirve para el costo en $. Con el default en Sonnet 5 (~3×
   Haiku por mensaje) mirar el gasto dejó de ser opcional.
2. **Google Places (FICHA).** `google_api_usage(month, sku, count)` cuenta requests de
   `details`/`photos` contra los topes de `app_settings`. Superado el tope la ficha degrada
   (bien), pero nadie ve venir el 80% — se entera cuando ya degradó.

Y el tercer problema, silencioso: **el precio ARS del premium está clavado y el costo es
USD.** La regla de piso (`precio_ARS ≥ dólar_oficial × 3`, disparador dólar ~2.333) está
escrita en el doc de costos pero nadie la evalúa — depende de que Fer se acuerde de mirar
dolarito.ar y hacer la cuenta.

## Objetivo

Una sección **"Costos"** nueva en `/admin` (misma page, mismo gate por `ADMIN_EMAIL`),
read-only, que muestre de un vistazo:

- **Chat IA en USD del mes**, desglosado por modelo (tokens in/out × precios), con el mes
  anterior al lado.
- **Google por SKU** (`details`/`photos`): requests del mes vs su cap, % de consumo, costo
  estimado en USD, alerta visual al acercarse al tope. Mes anterior al lado.
- **Cupo del chat**: requests del mes (`ai_api_usage`) vs `ai.chat_monthly_cap`, mismo
  tratamiento de alerta.
- **Sugeridor de precio premium**: cotización del dólar oficial (cacheada, degradable) +
  evaluación de la regla de piso; si el piso alcanza o supera el precio actual, banner con el
  precio sugerido. **Solo sugerencia** — el precio se cambia a mano en la sección Precios que
  ya existe.

## Qué NO es esta feature

- **No toca los candados de costo.** Cero cambios en field masks, `no-store`, topes,
  `lib/google/places.ts` ni el motor del chat. El tablero **lee** agregados y presenta.
- **No agrega tablas ni rollups.** La suma directa sobre `chat_messages` alcanza en v1 (el
  volumen es bajo); si algún día duele, el rollup mensual va al BACKLOG — no acá.
- **No automatiza el cambio de precio.** El sugeridor sugiere; `editarPrecio` (allowlist +
  historial) sigue siendo el único camino de escritura, manual, en la sección Precios.
- **No manda alertas por mail/push.** La alerta es visual en `/admin`; notificaciones
  activas quedan fuera de v1.
- **No es una página nueva.** Secciones dentro de `app/admin/page.tsx` (server component,
  `force-dynamic`, gate `sesionAdmin → notFound()` intactos).
- **No factura con exactitud contable.** Es una **estimación operativa**: reproduce la
  aritmética de precios públicos (con sus tiers gratis) para decidir, no para conciliar la
  factura de Google/Anthropic centavo a centavo.

## Decisiones cerradas

| # | Decisión |
|---|----------|
| 1 | **Mini-spec, no spec formal** (Fer, 2026-07-26). Read-only sobre agregados existentes, sin schema nuevo ni migraciones. El slot de spec 9 formal queda libre para curaduría (#5 de la cola). |
| 2 | **Extraer el cálculo de costo del chat a un helper puro exportado.** Hoy los precios (Haiku $1/$5, Sonnet 5 $3/$15 por millón in/out) viven **inline** en `logChatCall` (`lib/ai/logging.ts:9-42`) — `calcularCosto` como función **no existe** (el handoff del triaje lo asumía mal). Se extraen `PRECIOS_POR_MODELO` + `calcularCostoUsd(model, tokensIn, tokensOut)` como export puro del mismo módulo; `logChatCall` pasa a usarlo (cambio quirúrgico, misma salida). Fuente única: el tablero importa de ahí, no duplica precios. |
| 3 | **El costo del chat se deriva de `chat_messages`, nunca de `ai_api_usage`.** Σ `calcularCostoUsd(model_used, tokens_in, tokens_out)` sobre filas assistant (`model_used IS NOT NULL`) agrupadas por mes y modelo. `ai_api_usage` cuenta requests y solo alimenta el bloque de cupo. |
| 4 | **Precios de Anthropic: se mantienen $3/$15 para Sonnet 5** aunque rige un precio intro de $2/$10 hasta el 2026-08-31 (verificado contra el skill `claude-api`, no de memoria). Hasta septiembre el tablero sobreestima levemente el gasto de Sonnet: conservador a propósito, y exacto desde sept. El costo del caché de prompt (0,1×) no se estima — `cache_read_tokens` no se persiste en `chat_messages` (solo se loguea por consola). |
| 5 | **Costo Google = `max(0, count − 1.000) × precio/1.000` por SKU.** Precios del spec FICHA (decisiones 11 y 14): `details` (Place Details Enterprise) **$20/1.000**, `photos` **$7/1.000**, ambos con **1.000 gratis/mes**. Cuenta verificada contra FICHA: 3.000 fichas ⇒ $40 + $14 = $54/mes. Los precios van como constantes junto a las de Anthropic (decisión 2), comentadas con su fuente. |
| 6 | **Umbrales de alerta: amarillo al 80%, rojo al 100%** (Fer, 2026-07-26). Aplica a `details` y `photos` vs sus caps de `app_settings` y al cupo del chat vs `ai.chat_monthly_cap`. Al 100% el sistema ya degrada solo (topes existentes) — el rojo informa, no corta nada. Cap en 0 = SKU apagado a mano: se muestra "apagado", sin alerta. |
| 7 | **Comparación vs mes anterior en los tres bloques.** Para `google_api_usage`/`ai_api_usage` es trivial (clave `month` `YYYY-MM`: mes actual y anterior por string). Para `chat_messages` se filtra `created_at` con el patrón `MES_ACTUAL`/`MES_ANTERIOR` + `filter (where ...)` ya probado en `lib/negocio/query.ts:344-382` — mismo molde, no una segunda versión. |
| 8 | **El sugeridor de dólar entra en este tablero** (Fer, 2026-07-26 — absorbe el ítem del BACKLOG). La referencia de producto es **dolarito.ar, dólar OFICIAL** (doc de costos § fuente de verdad). Técnicamente se consume una fuente pública con API estable que publique el oficial (dolarito.ar no documenta API pública; se resuelve en implementación — candidata: dolarapi.com, valor oficial). Si el valor difiere del que muestra dolarito.ar, manda dolarito: es la referencia que usa Fer, la fuente técnica es solo el transporte. |
| 9 | **Cotización cacheada y degradable, nunca bloquea `/admin`** (consideraciones ya escritas en el BACKLOG). Cache server-side de ~1 h; timeout corto en el fetch; si la fuente cae se muestra el último valor conocido con su fecha ("cotización del DD/MM"), y si nunca hubo valor, el bloque dice que no pudo consultar — el resto del tablero renderiza igual. |
| 10 | **Regla de piso, evaluada — no aplicada**: `piso_ARS = dólar_oficial × 3` (doc de costos § regla operable). Si `precio_b2c_ars < piso` ⇒ banner de alerta con el precio sugerido (piso redondeado al millar hacia arriba) y link/referencia a la sección Precios para el cambio manual. Si cubre, una línea verde con el margen actual (ej. "cubre 1,5× el piso"). El disparador nominal (dólar ~2.333) no se hardcodea: se evalúa siempre contra el precio vigente de `app_settings`. |
| 11 | **UI = nuevas `<section>` en `page.tsx`, server components read-only** estilo `suscripciones.tsx` (sin `'use client'`: no hay interacción en v1). Datos cargados en el `Promise.all` existente de la page. Formateo `Intl.NumberFormat` es-AR (USD con decimales, ARS sin). Copy en rioplatense. |
| 12 | **Los agregados viven en un módulo nuevo `lib/admin/costos.ts`** (server-only): `getCostosChat()`, `getUsoGoogle()`, `getCupoChat()`, `getSugerenciaPrecio()`. La page los llama; nada de SQL inline en componentes. Tests unitarios para la aritmética pura (costo por modelo, tier gratis de Google, regla de piso, redondeo). |

## Criterios de done (DoD)

- [ ] `calcularCostoUsd` + tabla de precios exportadas de `lib/ai/logging.ts`; `logChatCall`
      la reusa sin cambio de comportamiento (mismo JSON logueado). Tests del helper: costo por
      modelo, modelo desconocido (fallback), tokens null/0.
- [ ] `lib/admin/costos.ts` con los agregados de los cuatro bloques + tests de la aritmética
      pura (tier gratis Google, % de cap, regla de piso, redondeo al millar).
- [ ] Sección "Costos" en `/admin`: chat USD por modelo (mes actual y anterior), Google por
      SKU (count, % del cap, USD estimado, mes anterior), cupo chat vs `ai.chat_monthly_cap`.
- [ ] Alertas visuales: amarillo ≥80%, rojo ≥100%, "apagado" si cap = 0.
- [ ] Sugeridor: cotización oficial con cache ~1 h + degradación (último valor conocido con
      fecha; nunca rompe la page); banner con precio sugerido cuando `precio_b2c < dólar × 3`;
      línea de margen cuando cubre.
- [ ] Los candados de costo intactos: cero cambios en `lib/google/places.ts`, field masks,
      motor del chat y topes (los tests de FICHA que vigilan el field mask siguen verdes).
- [ ] Verificación técnica: `typecheck` + `tests` verdes + `build` (dev server parado).
- [ ] QA en vivo sobre ngrok (gate admin + render de la sección con datos reales del Postgres
      local; UPDATEs revertibles para forzar los estados de alerta).

## QA manual (IDs propuestos)

| ID | Caso | Criterio |
|----|------|----------|
| COSTOS_ADMIN-01 | Costo chat del mes | El USD por modelo coincide con la suma manual por SQL (`tokens_in`/`out` × precios) para el mes actual; el mes anterior aparece al lado. |
| COSTOS_ADMIN-02 | Google por SKU | `details` y `photos` muestran count del mes, % del cap y USD estimado con el tier gratis descontado (count ≤ 1.000 ⇒ $0). |
| COSTOS_ADMIN-03 | Alerta 80% | Con un UPDATE revertible que ponga `count` ≥ 80% del cap, el SKU se pinta amarillo; ≥100% rojo; cap = 0 muestra "apagado" sin alerta. |
| COSTOS_ADMIN-04 | Cupo chat | El bloque muestra `ai_api_usage` del mes vs `ai.chat_monthly_cap` con el mismo esquema de alerta. |
| COSTOS_ADMIN-05 | Sugeridor — cubre | Con el dólar actual (~1.520) y precio 7.000, muestra la línea de margen (sin banner de alerta). |
| COSTOS_ADMIN-06 | Sugeridor — piso tocado | Bajando `billing.precio_b2c_ars` por UPDATE revertible (o simulando dólar alto), aparece el banner con el precio sugerido redondeado al millar. |
| COSTOS_ADMIN-07 | Fuente de dólar caída | Con la fuente inaccesible (o forzando el fallo), la page renderiza entera y el bloque muestra el último valor conocido con fecha, o el estado "no pudimos consultar". |
| COSTOS_ADMIN-08 | Gate | Sin sesión admin, `/admin` sigue dando 404; nada del tablero se filtra a usuarios no admin. |
