# Formato de specs — A Dónde Salimos

**Fuente de verdad del formato de spec y de las convenciones de autoría.** El `CLAUDE.md`
global (genérico a todos los proyectos) referencia este archivo. El *ciclo de vida* (cómo se
**cierra** un spec) vive en [`../CLAUDE.md`](../CLAUDE.md) § "Ciclo de vida de specs"; acá va
el **formato** y la autoría. El scaffold lo automatiza [`/new-spec`](../.claude/skills/new-spec/SKILL.md).

## Dónde vive un spec
- `docs/specs/planned/` — decisión cerrada, en cola (o gateada). Sin código.
- `docs/specs/active/` — normativo hoy (leer antes de tocar el feature). Incluye specs parciales.
- `docs/specs/done/` — cerrado. Resumen operativo en `docs/archive/SPECS_ARCHIVO.md`.

Manifiesto: [`specs/README.md`](specs/README.md). Un spec nuevo nace en `planned/`.

## Header obligatorio
```
# Spec: <Título>

**Estado:** <🔵 Planned — en diseño | Parcial — §X ✅; §Y pendiente | ✅ Implementado (YYYY-MM-DD)>
**Prioridad:** <Alta/Media/Baja — por qué>
**Gate:** <Ninguno | condición de negocio que lo destraba>
**Bloquea:** <nada | qué>
**Depende de:** <specs/archivos>
```

## Cuerpo (secciones estándar)
- `## Problema` — qué duele hoy.
- `## Objetivo` — qué logra.
- `## Qué NO es esta feature` — fuera de scope explícito.
- `## Decisiones cerradas` — tabla numerada de decisiones de diseño.
- `## Criterios de done (DoD)` — checklist de criterios **verificables** (los verifica `/qa-spec`).
- `## QA manual (IDs propuestos)` — tabla `| ID | Caso | Criterio |`, prefijo `<SLUG>-NN`.

Opcionales según el spec: Implementación, Edge cases, Wireframes, Esfuerzo, Relación con
otros specs, v2 (fuera de scope).

## Plantilla mínima (la usa `/new-spec`)
```
# Spec: <Título>

**Estado:** 🔵 Planned — en diseño
**Prioridad:** <Alta/Media/Baja — por qué>
**Gate:** <Ninguno | condición de negocio>
**Bloquea:** <nada | qué>
**Depende de:** <specs/archivos>

---

## Problema
<qué duele hoy>

## Objetivo
<qué logra>

## Qué NO es esta feature
- <fuera de scope>

## Decisiones cerradas
| # | Decisión |
|---|----------|
| 1 | <...> |

## Criterios de done (DoD)
- [ ] <criterio verificable>

## QA manual (IDs propuestos)
| ID | Caso | Criterio |
|----|------|----------|
| <SLUG>-01 | <...> | <...> |
```

## Convenciones de IDs de QA
- Prefijo `<SLUG>-NN` (SLUG = nombre corto del spec en mayúsculas), ej. `DASH-MG-01`.
- Resultados en `docs/qa/AnalisisQA.md`: header `## QA manual — …` (a mano) o
  `## QA /qa-spec — …` (automático, [`/qa-spec`](../.claude/skills/qa-spec/SKILL.md)). No
  reiniciar numeración existente.

## Cierre
Checklist de cierre (9 pasos) en [`../CLAUDE.md`](../CLAUDE.md) § "Ciclo de vida de specs".
Lo orquesta [`/close-spec`](../.claude/skills/close-spec/SKILL.md).
