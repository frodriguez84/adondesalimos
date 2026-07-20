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

| Spec | Cuándo leerlo |
|------|----------------|
| _(vacío)_ | |

## 🔵 Planned (`planned/`)

| Spec | Gate / nota |
|------|----------------|
| [BUSQUEDA](planned/BUSQUEDA.md) | Spec 3 — home/búsqueda en 3 fases (motor+lista · selectores · chips+mapa). Depende de CATALOGO y ZONAS; bloquea Ficha, Votación y Monetización |
| [FICHA](planned/FICHA.md) | Spec 4 — `/lugar/[id]` en 3 fases; **primer uso de Google en vivo** (matching IDs-Only $0, Details Enterprise, 1 foto, cero caché). Depende de CATALOGO, ZONAS y BUSQUEDA; bloquea Auth/reclamo |

## ⚫ Done (`done/`)

| Spec | Resumen en SPECS_ARCHIVO |
|------|---------------------------|
| [CATALOGO](done/CATALOGO.md) | Spec 1 — catálogo, taxonomía e import de Overture. [Resumen](../archive/SPECS_ARCHIVO.md#catalogo) · ✅ 2026-07-20 |
| [ZONAS](done/ZONAS.md) | Spec 2 — 46 zonas de AMBA (GeoJSON versionados, sin PostGIS), primaria + buffer 400 m. [Resumen](../archive/SPECS_ARCHIVO.md#zonas) · ✅ 2026-07-20 |
