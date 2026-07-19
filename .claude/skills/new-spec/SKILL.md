---
name: new-spec
description: Scaffold de un spec nuevo en docs/specs/planned/ usando la plantilla de docs/AGENTES.md (única fuente de verdad del formato). Crea el esqueleto para completar (autoría manual) y lo registra en el manifiesto. Invocar como /new-spec <NOMBRE>.
---

# /new-spec — scaffold de spec nuevo

Creás el ESQUELETO de un spec en `docs/specs/planned/`. NO diseñás el contenido — la
autoría/criterio es manual (ver `CLAUDE.md` § "Loops con corte verificable": autoría de spec
no se automatiza).

## Input
`$ARGUMENTS` = nombre (ej. `EXPORT_CSV` o "Exportar a CSV"). Derivá `SLUG` UPPER_SNAKE.
Si no se pasó, pedilo.

## Procedimiento
1. Verificá que NO exista `docs/specs/{planned,active,done}/<SLUG>.md` (no pisar).
2. **Leé la plantilla de `docs/AGENTES.md` § "Plantilla mínima"** — es la única fuente de
   verdad del formato. No la hardcodees de memoria; copiala desde ahí (si AGENTES.md cambia,
   /new-spec sigue alineado solo).
3. Creá `docs/specs/planned/<SLUG>.md` con esa plantilla; completá solo el título y lo obvio,
   el resto queda como `<...>` para el humano.
4. Agregá la fila al manifiesto `docs/specs/README.md`, tabla 🔵 Planned.
5. NO mover a active/ ni implementar. Avisá que queda en planned/ para diseño.

## Reglas
- Formato = `docs/AGENTES.md` (no reinventar ni hardcodear el template acá).
- Va en `planned/` (cola), no en `active/`.
- No improvisar contenido — esqueleto para completar.
- Registrar en README (🔵 Planned).
