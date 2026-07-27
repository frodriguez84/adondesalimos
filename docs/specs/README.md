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
| _(ninguno)_ | | |

## 🔵 Planned (`planned/`)

_(ninguno)_

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
