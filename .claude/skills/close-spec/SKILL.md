---
name: close-spec
description: Orquesta el checklist de cierre de spec de CLAUDE.md (gate+QA vía /qa-spec → SPECS_ARCHIVO → Estado → git mv → README → BACKLOG → stub → lecciones). Pre-flight idempotente; HALT si QA no está APROBADO. Invocar como /close-spec docs/specs/active/FOO.md.
---

# /close-spec — cierre de un spec (checklist de CLAUDE.md)

Ejecutás el checklist obligatorio de `CLAUDE.md` § "Ciclo de vida de specs" para un spec
implementado. Sos el orquestador: hacés lo mecánico, redactás borradores para lo de
contenido, y **frenás** si el QA no aprueba.

## Input
`$ARGUMENTS` = ruta al spec (ej. `docs/specs/active/FOO.md`). Si no se pasó, pedila.

## Pre-flight: idempotencia (antes de tocar NADA)
Detectá si el spec ya está cerrado:
- está en `docs/specs/done/`, **y**
- su primera línea es `**Estado:** ✅ Implementado`, **y**
- su fila en `docs/specs/README.md` está en la tabla ⚫ Done.

Si los tres → reportá **"ya cerrado, no-op"** y **PARÁ**. No intentes `git mv` (fallaría).
Si está a medias (ej. en `done/` pero README sin actualizar) → reportá la inconsistencia y
ofrecé completar solo los pasos faltantes (no rehagas los ya hechos).

## Dos "parciales" — son ORTOGONALES, no los confundas
- **Cierre total vs parcial (FASES del spec):** ¿se implementaron todas las fases o solo
  algunas (§X ✅ / §Y pendiente)? → decide **git mv** (paso 5) y **stub** (paso 8). Parcial
  (fases) = el spec QUEDA en `active/`.
- **Veredicto QA (APROBADO / PARCIAL — pendiente en vivo / BLOQUEADO):** resultado de
  `/qa-spec` → decide **HALT** (pasos 1-2).
- Independientes (2×2): un cierre **total** puede tener QA **PARCIAL** (→ HALT hasta QA en
  vivo; una vez APROBADO sí git mv); un cierre **parcial** puede tener QA **APROBADO** de su
  fase (→ no HALT, pero **NO** git mv).

## Antes de empezar
Decidí total vs parcial (fases) leyendo el spec. Mostrá el plan (qué pasos vas a tocar)
antes de modificar archivos.

## Pasos (mapea al checklist de CLAUDE.md)

### 1+2. QA + gate técnico — UNA sola corrida de /qa-spec
Corré `/qa-spec <ruta spec>` (`.claude/skills/qa-spec/SKILL.md`) **una vez**. Eso cubre el
gate técnico (typecheck + tests + build) **y** la QA con IDs — pasos 1 y 2 de CLAUDE.md
juntos. **No corras el gate por separado acá** (evita el doble build, que es lento).
- **HALT** según veredicto:
  - **BLOQUEADO** (gate rojo o FAIL normativo) → no se cierra (SDD: QA bloqueado = no PR).
    Listá los FAIL.
  - **PARCIAL — pendiente QA en vivo** → falta verificación en vivo; no marques done hasta
    correrla. Ofrecé hacerla o pará.

### 3. Resumen condensado → SPECS_ARCHIVO.md
Sección nueva `## <Título> {#slug}` + **Spec:** (link) + **Qué hace:** + **Alcance:** +
**QA:** (link a la sección de AnalisisQA). No copiar prompts/schemas largos. Mostrá el
borrador antes de insertar. Si `docs/archive/SPECS_ARCHIVO.md` no existe todavía, crealo
con un encabezado y esta primera sección.

### 4. Estado en el spec
Primera línea: `**Estado:** ✅ Implementado (YYYY-MM-DD)` (total) o
`**Estado:** Parcial — §X ✅; §Y pendiente` (parcial por fases).

### 5. Mover el spec — solo cierre TOTAL (fases)
`git mv docs/specs/active/FOO.md docs/specs/done/FOO.md` (o desde `planned/` si nunca pasó
por `active/`). **Parcial (fases) → omitir; queda en `active/`.**

### 6. Manifiesto README.md
`docs/specs/README.md`: mover la fila a la tabla correcta — 🟢 Activo / 🔵 Planned / ⚫ Done.
Total → ⚫ Done. Parcial (fases) → queda en 🟢 con nota de fase.

### 7. Cola de trabajo BACKLOG.md — DOS lugares, no uno
`docs/product/BACKLOG.md` tiene **dos** representaciones de "hecho" y hay que tocar las dos
(olvidarse del log es drift real que ya pasó en specs 1-5):
- **(a)** La **lista de tareas** de arriba: tildar el ítem `[x]` con fecha y link al resumen.
- **(b)** El log cronológico **`## Hecho`**: agregar una entrada nueva **al tope** (va de más
  nuevo a más viejo) con el detalle por fase, el QA de cierre y el link a `SPECS_ARCHIVO`.

### 8. Stub de redirect — solo si moviste el archivo (cierre total)
Ruta vieja: stub ~5 líneas `# NAME — movido` + flechas a `done/`, `SPECS_ARCHIVO` (§slug) y
la sección de QA.

### 9. Lecciones (si aplica)
Problemas no obvios / causas raíz → `docs/operations/LECCIONES_APRENDIDAS.md` (crealo si no
existe). Si no hubo, decilo explícitamente y salteá.

## Cierre
- Resumí qué pasos se hicieron y cuáles se saltaron (con motivo).
- Listá archivos modificados/movidos.
- **NO commitees.** Mostrá el set de cambios; el usuario confirma el commit (commit en
  `ask`; push nunca sin pedido explícito).

## Reglas duras
- **Pre-flight no-op** si ya está cerrado (no intentar git mv que falla).
- **Gate técnico corre UNA vez** (dentro de /qa-spec), nunca duplicado.
- **HALT** lo decide el veredicto QA; **git mv** lo decide total/parcial (fases) — separados.
- Borradores de contenido (pasos 3, 9) se muestran antes de insertar.
- No saltear pasos en silencio: si uno no aplica, decilo.
