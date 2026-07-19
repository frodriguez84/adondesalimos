---
name: consistency-check
description: Audita coherencia de memoria y docs vs el código/git. Detecta referencias muertas (acotado, con severidad), entradas RESUELTO archivables, drift de MEMORY.md, wikilinks rotos y desalineación README↔Estado de specs. Reporta, NO borra. Skill local. Invocar como /consistency-check.
---

# /consistency-check — coherencia memoria + docs

Cruzás la memoria del proyecto y la documentación contra el estado real del código/git.
**Reportás drift; no borrás nada** (borrar memoria/docs se revisa a mano). Local; opcional
en /loop hasta cero drift.

## Alcance
- Memoria: `C:\Users\usuario\.claude\projects\c--Fer-A-Donde-Salimos\memory\` (MEMORY.md + archivos). **Fuera del repo** — por eso es
  skill LOCAL, no /schedule cloud (un agente cloud no ve esa carpeta).
- Docs del repo: `docs/specs/`, `docs/qa/`, `docs/archive/`, `docs/product/`.

## Checks

### (a) Referencias muertas en memoria — ACOTADO (anti-ruido)
Las memorias son point-in-time: no toda ref vieja es drift. Extraé SOLO señales confiables
y verificá que existan hoy (Grep/Glob/git):
- **Rutas** que empiecen con carpetas reales de código del proyecto (ej. `lib/`, `app/`,
  `components/`, `src/`).
- **Env vars**: un token `UPPER_SNAKE_CASE` cuenta como env-var SOLO si es key real en
  `.env` / `.env.example` **o** se usa en el código como variable de entorno. Si no aparece
  en ninguno, es casi seguro un **nombre de spec/regla** → no lo trates como ref de código
  (a lo sumo cruzá nombres de spec contra `docs/specs/`).
- **[[wikilinks]]** a otras memorias (ver también check c).
- Nombres de función sueltos → **baja confianza**: salteá o marcá INFO, nunca ALTO.

**Severidad:**
- **ALTO** — la memoria presenta la ref como **actual/accionable** y ya no existe → drift real.
- **INFO** — mención **histórica/point-in-time** → contexto viejo, no necesariamente drift.

### (b) Entradas RESUELTO archivables
Buscá en memoria entradas resueltas/cerradas (`✅ RESUELTO`, "resuelto", "ya no aplica").
Listalas como candidatas a archivar/condensar (no las borres).

### (c) Drift del índice MEMORY.md + wikilinks
- Cruzá `MEMORY.md` (índice) vs los `.md` reales: archivos sin línea en el índice; líneas
  que apuntan a archivos inexistentes; descripción del índice desfasada del cuerpo.
- **[[wikilinks]] rotos**: reportá como **INFO**, no error — un wikilink sin destino es
  válido por diseño (marca algo a escribir).

### (d) README de specs ↔ Estado real
Cruzá `docs/specs/README.md` (tablas 🟢/🔵/⚫) vs cada spec: la primera línea `**Estado:**`
vs la tabla donde figura; specs en `active/`/`done/`/`planned/` ausentes del manifiesto (o al
revés); specs `✅ Implementado` pero aún en 🟢 sin nota de fase.

### (e) Anchors rotos en cross-links de docs — OPCIONAL
Links `FILE.md#slug`: verificá que el `{#slug}` exista en el destino. Reportá como **INFO**.
Si genera muchos falsos, **omití este check**.

## Output
Reporte por check (a–e); cada hallazgo con: **severidad** (ALTO/INFO), qué, dónde
(archivo:línea) y acción sugerida. Cierre:
- **Veredicto: CERO DRIFT** (nada ALTO) o **N hallazgos** (X ALTO, Y INFO).
- Si hay hallazgos, **proponé** correcciones pero **no las apliques sin OK**.

## Reglas duras
- **No borrar ni editar** memoria/docs automáticamente — solo reportar y proponer.
- **Local únicamente** (memoria fuera del repo; nunca /schedule cloud).
- Check (a) acotado a señales confiables; nombres de función sueltos no son ALTO.
- Wikilinks rotos y anchors = INFO, no error.
- Stop-condition para /loop: **cero hallazgos ALTO**.
- Verificá existencia real (Grep/Glob/git), no asumas.
