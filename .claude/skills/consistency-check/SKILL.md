---
name: consistency-check
description: Audita coherencia de memoria y docs vs el código/git Y vs los DATOS del runtime (app_settings, tags, chips, curaduría, gates de specs cumplidos). Detecta referencias muertas, entradas RESUELTO archivables, drift de MEMORY.md, wikilinks rotos, desalineación README↔Estado de specs y deuda de backup. Reporta, NO borra ni escribe en la base. Skill local. Invocar como /consistency-check.
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

### (d2) BACKLOG `## Hecho` ↔ specs en `done/`
El log `## Hecho` de `docs/product/BACKLOG.md` es la tercera representación de "cerrado"
(además de la lista de tareas de arriba y de `SPECS_ARCHIVO`), y la que más fácil se olvida
al cerrar (drift real en specs 1-5). Cruzá:
- **Cada spec en `docs/specs/done/` tiene su entrada en `## Hecho`** — si falta, es **ALTO**
  (se cerró sin registrarlo en el log). Los stubs (`— movido`) no cuentan como specs.
- El ítem de la **lista de tareas** de ese spec está `[x]` (no `[ ]`) — desajuste = **ALTO**.
Acción sugerida: agregar la entrada faltante al tope del log (ver `/close-spec` paso 7).

### (e) Anchors rotos en cross-links de docs — OPCIONAL
Links `FILE.md#slug`: verificá que el `{#slug}` exista en el destino. Reportá como **INFO**.
Si genera muchos falsos, **omití este check**.

### (f) Docs y reglas vs los DATOS del runtime — el drift que más duele

**Por qué existe este check.** Los checks (a)-(e) cruzan docs contra **código**. Pero en este
proyecto media docena de reglas vivas no están en el código: están en `app_settings` y en la
propia data, justamente para poder cambiarlas sin deploy. Eso es una decisión buena con un
costo: **el doc y la verdad se separan sin que nadie toque un archivo**. Ya pasó dos veces:

- El BACKLOG cerraba el A/B con *"revertido a Haiku"* y el runtime ya corría Sonnet 5
  (reconciliado el 2026-07-27).
- `lib/db/taxonomy.ts` dice que `abierto-ahora` **no puede evaluarse contra `place_tags`**… y la
  corrida de CURADURIA le puso el tag a **20 lugares**. El comentario tenía razón, el dato lo
  contradijo, y se descubrió **dos días después**, de casualidad, al escribir un spec.

Es **read-only**: solo `SELECT`. Comando base:

```
docker exec adondesalimos_db psql -U adondesalimos -d adondesalimos -c "<SELECT>"
```

Si el contenedor **no está corriendo**, este check se **saltea y se reporta como INFO** ("no
verificado: base no disponible"). Nunca se inventan hallazgos ni se asume que el doc está bien.

| # | Qué se cruza | Contra | Severidad |
|---|--------------|--------|-----------|
| f1 | `app_settings['ai.chat_model']` | `CLAUDE.md` § Modelo del chat IA · memoria `chat-modelo-sonnet` · BACKLOG | **ALTO** si difiere |
| f2 | `catalog.confidence_threshold` | `DEFAULT_CONFIDENCE_THRESHOLD` (fallback en `visibility.ts`) y todo número citado en docs | **ALTO** si un doc afirma otro valor como vigente |
| f3 | `billing.precio_b2c_ars` · `precio_b2b_ars` · `pricing.band_limits` | `COSTOS-IA-Y-PRECIO-PREMIUM.md` · BACKLOG · specs | **ALTO** si difiere |
| f4 | `google.*_monthly_cap` · `ai.chat_monthly_cap` · `ai.chat_quota_*` · `curation.zone_quota` | los specs que los fijaron (FICHA, CHAT_IA, CURADURIA) | **ALTO** si difiere |
| f5 | Claves que el código lee (`getSetting`) y **no existen** en la tabla, o filas que ningún doc/código menciona | `lib/**` + docs | **ALTO** / INFO respectivamente |
| f6 | **Tag `active=true` con 0 lugares publicados** | — | INFO (candidato de curaduría) |
| f7 | **Retiros de tags: base vs declaración.** `select slug from tags where active = false` | **`TAGS_RETIRADOS`** (`lib/db/taxonomy.ts`) — el dueño único del hecho | **ALTO** en los dos sentidos: (a) un slug **declarado** que en la base está `active = true` ⇒ el retiro se perdió (reset de base) → correr **`npm run db:retiros`**; (b) un tag inactivo **no declarado** ⇒ o es curaduría a mano (INFO) o una decisión que no sobrevive a un reset → declararla. Hoy la lista es `abierto-ahora` (ABIERTO_AHORA decisión 10, 20 filas de `place_tags` que **deben** seguir ahí) |
| f8 | **Tags que el código declara no evaluables** (comentarios de `taxonomy.ts`) pero **tienen filas** | `lib/db/taxonomy.ts` | **ALTO** — es el caso que se escapó |
| f9 | **Chips de Ocasión vivos** (los que devuelven > 0) — medilo con **`getOccasionChips`** (`tsx`), NO con SQL crudo: el "AND entre facetas" escrito de forma genérica es **20× más lento** (7,4 s vs 370 ms, medido en `lib/search/chips.ts`) | el "N/9" que cita el BACKLOG | **ALTO** si difiere |
| f10 | **Canario de la curaduría**: `count(*) from place_tags where source='admin'` | el ~3.967 de `CLAUDE.md` § Notas importantes | **ALTO si BAJÓ** (posible pérdida de datos → correr `npm run backup:db` YA) · INFO si subió (actualizar el número) |
| f11 | **Gates numéricos de specs ya cumplidos** — por cada spec en `planned/`/`active/` con un `**Gate:**` numérico y su consulta escrita adentro, correrla | el estado que declara el spec | **ALTO si el gate YA SE CUMPLE** (hay trabajo desbloqueado y nadie lo sabe). Hoy aplica a **ABIERTO_AHORA F2**: ≥ 50 publicados con `place_owner_content.opening_hours` no nulo |

**Criterio de severidad (importante para no generar ruido):** un número de doc distinto del
runtime **no es ALTO por sí solo** — los docs son point-in-time y la data crece. Es **ALTO**
cuando (a) el doc presenta el valor como **vigente**, (b) la diferencia **cambia una decisión**
(un gate que se abrió, un modelo distinto del que se cree que corre), o (c) el dato **bajó**
donde solo debería crecer (f10).

### (g) Deuda de backup

Corré `npm run backup:check` (no toca la base, solo mira `backups/`). Si sale distinto de 0,
reportalo como **ALTO** cuando haya migraciones sin commitear o cambios de datos recientes
(curaduría, admin, dueños), **INFO** en cualquier otro caso. Lo que protege ese dump no está en
git ni en el seed: recuperarlo es re-correr la curaduría (~US$17) o un restore.

## Output
Reporte por check (a, b, c, d, d2, e, f, g); cada hallazgo con: **severidad** (ALTO/INFO), qué,
dónde (archivo:línea, o la query y su resultado para los de (f)) y acción sugerida. Cierre:
- **Veredicto: CERO DRIFT** (nada ALTO) o **N hallazgos** (X ALTO, Y INFO).
- Si hay hallazgos, **proponé** correcciones pero **no las apliques sin OK**.

## Reglas duras
- **No borrar ni editar** memoria/docs automáticamente — solo reportar y proponer.
- **La base es READ-ONLY: solo `SELECT`.** Ningún `UPDATE`/`DELETE`/`INSERT`/DDL, ni "para
  arreglar el drift". Este skill audita; corregir es una tarea aparte y con OK de Fer.
- Si el contenedor de Postgres no corre, el check (f) se **saltea con INFO** — no se asume que
  el doc está bien ni se reporta como si se hubiera verificado.
- **Local únicamente** (memoria fuera del repo; nunca /schedule cloud).
- Check (a) acotado a señales confiables; nombres de función sueltos no son ALTO.
- Wikilinks rotos y anchors = INFO, no error.
- Un número de doc desactualizado no es ALTO por sí solo — ver el criterio de severidad de (f).
- Stop-condition para /loop: **cero hallazgos ALTO**.
- Verificá existencia real (Grep/Glob/git/`SELECT`), no asumas.
