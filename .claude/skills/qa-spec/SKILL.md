---
name: qa-spec
description: Verifica la implementación de un spec contra su DoD/criterios con un agente checker independiente (Explore read-only, haiku, maker≠checker). Devuelve PASS/FAIL por criterio con IDs trazables y escribe la sección en docs/qa/AnalisisQA.md. Invocar como /qa-spec docs/specs/active/FOO.md.
---

# /qa-spec — QA de un spec contra su DoD

Verificás un spec implementado contra sus criterios de aceptación, actuando como
**checker independiente** (no como quien lo implementó). El árbitro es el spec.

## Input
`$ARGUMENTS` = ruta al spec (ej. `docs/specs/active/FOO.md`).
Si no se pasó, pedila antes de seguir.

## Procedimiento

### 0. Chequeo previo de estado
- Si el spec está en `docs/specs/planned/` o su primera línea NO indica implementación
  (sin `**Estado:** ✅/Parcial`), **avisá y frená**: no tiene sentido escupir una tabla
  toda roja sobre algo no implementado. Preguntá si igual querés un gap-check.
- Si está en `active/` (parcial) o `done/`, seguí.

### 1. Leer el spec y extraer criterios verificables
- Leé el spec completo. Identificá los criterios: sección DoD / "Definición de
  hecho" / criterios de aceptación / fases (§). Si no hay DoD explícito, derivá un
  criterio por cada requisito normativo ("debe/tiene que…").
- **IDs trazables:** prefijo `<SLUG>-QA-NN` (SLUG = nombre corto del spec en mayúsculas).
- **Default: re-verificar el DoD COMPLETO** (no append-only). Si el spec ya tiene IDs en
  `docs/qa/AnalisisQA.md`, re-verificá cada criterio existente con su **ID estable**
  (mismo ID, resultado actualizado) — así cazás regresiones, no solo huecos. Los
  criterios **nuevos** continúan la numeración (no reinician en 01).
- Modo **incremental** (solo criterios nuevos) = caso especial, únicamente si se pide
  explícitamente.

### 2. Verificación técnica (gate base)
Corré y registrá: `npx tsc --noEmit`, `npx vitest run`, `npm run build`.
Si alguno falla, el QA arranca BLOQUEADO — anotalo, no lo escondas.

### 3. Verificación independiente por criterio (maker≠checker, haiku)
Por cada criterio (o en lotes), lanzá un subagente checker **subagent_type Explore
(read-only) con model haiku** (el checker no debe poder escribir — refuerza
maker≠checker y evita efectos secundarios; usá general-purpose SOLO como excepción
justificada). Instrucción al checker:
- "Verificá SOLO si el código implementa este criterio: <criterio>. Buscá en el
  repo la evidencia concreta (archivo:línea). Devolvé veredicto PASS/FAIL/PARCIAL,
  evidencia (rutas+líneas) y qué falta si no es PASS. No asumas: sin evidencia = FAIL."
- Pasale solo el criterio y el extracto relevante del spec, NO tu opinión de si
  está hecho.
- Criterios de **comportamiento en vivo** (IA/chat, prompts, flujos de UI): marcalos
  "requiere QA en vivo"; no los declares PASS por lectura de código — anotá el
  procedimiento de verificación manual.

### 4. Agregar y reportar
- Tabla `| ID | Criterio | Resultado | Evidencia / Gap |`.
- **Veredicto global (3 estados):**
  - **APROBADO** — todos los criterios PASS *y* sin criterios en vivo pendientes de verificar.
  - **PARCIAL — pendiente QA en vivo** — el código pasa, pero hay criterios en vivo no
    verificados (Playwright/entorno real). **NO marcar APROBADO sin esa verificación.**
  - **BLOQUEADO** — ≥1 FAIL en criterio normativo (o gate técnico rojo).
- Regla SDD: **QA bloqueado = no PR.**

### 5. Escribir en docs/qa/AnalisisQA.md
- Si el archivo no existe todavía, crealo con un encabezado `# QA — <PROJECT_NAME>`.
- Sección NUEVA al final (no condensar ni borrar secciones históricas). **Header propio
  de QA automático** (distinto del `## QA manual — …` de QA a mano):
  ```
  ## QA /qa-spec — <Nombre del spec> (<fecha>)
  **Veredicto:** <APROBADO | PARCIAL — pendiente QA en vivo | BLOQUEADO>
  **Verificación técnica:** typecheck <estado> · tests <N/N> · build <estado>
  **Método:** checker independiente (Explore/haiku) vs DoD de `<ruta spec>`. <nota in-vivo>

  | ID | Criterio | Resultado | Evidencia / Gap |
  |----|----------|-----------|-----------------|
  ```
- Fecha: la de hoy (del sistema). No la inventes.

## Reglas duras
- **No auto-aprobar.** Criterio sin evidencia = FAIL.
- **Nunca APROBADO** si quedan criterios en vivo sin verificar → PARCIAL.
- **No borrar** secciones históricas de AnalisisQA.md. Default = re-verificar DoD
  completo con IDs estables; numeración nueva solo para criterios nuevos.
- Si el spec tiene fases, verificá solo las que dicen estar implementadas.
- Checker = Explore read-only (maker≠checker).
