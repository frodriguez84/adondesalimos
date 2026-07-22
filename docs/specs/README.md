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

| Spec | Qué cubre |
|------|-----------|
| [AUTH](active/AUTH.md) | Spec 5 — auth (better-auth, patrón StressPlan), reclamo/alta de negocio con cola en `/admin`, panel "Mi negocio" (fotos a R2, contenido, horarios propios), teaser de stats. **En curso** — F1 (auth base) ✅ · F2 (reclamo + alta + cola) ✅ · F3 (panel + contenido) ✅ 2026-07-21; F4 (horarios propios) pendiente |

## 🔵 Planned (`planned/`)

_(ninguno — el próximo a implementar sale del BACKLOG o de `active/`)_

## ⚫ Done (`done/`)

| Spec | Resumen en SPECS_ARCHIVO |
|------|---------------------------|
| [CATALOGO](done/CATALOGO.md) | Spec 1 — catálogo, taxonomía e import de Overture. [Resumen](../archive/SPECS_ARCHIVO.md#catalogo) · ✅ 2026-07-20 |
| [ZONAS](done/ZONAS.md) | Spec 2 — 46 zonas de AMBA (GeoJSON versionados, sin PostGIS), primaria + buffer 400 m. [Resumen](../archive/SPECS_ARCHIVO.md#zonas) · ✅ 2026-07-20 |
| [BUSQUEDA](done/BUSQUEDA.md) | Spec 3 — home/búsqueda en 3 fases (motor+lista · selectores · chips+mapa). [Resumen](../archive/SPECS_ARCHIVO.md#busqueda) · ✅ 2026-07-20 |
| [FICHA](done/FICHA.md) | Spec 4 — `/lugar/[id]` en 3 fases; primer uso de Google en vivo (matching IDs-Only $0, Details Enterprise, 1 foto, cero caché). [Resumen](../archive/SPECS_ARCHIVO.md#ficha) · ✅ 2026-07-20 |
