# A Dónde Salimos — Prompt Maestro para Claude Code

> Las reglas **globales** (SDD, selección de modelo, git, registro obligatorio, seguridad,
> hábitos de sesión) están en `~/.claude/CLAUDE.md` y NO se repiten acá. Este archivo lleva
> solo lo específico de **este** proyecto. Si algo ya está en el global, referencialo — no
> lo dupliques (la duplicación es lo que después driftea).

## Idioma

**Responder siempre en español**, en todo momento — texto al usuario, mensajes de commit,
comentarios de PR, resúmenes de specs. Si una herramienta o el código está en inglés, está
bien citarlo tal cual, pero el texto propio va en español de principio a fin.

## Contexto del producto

App para decidir a dónde salir (bares, restaurantes, planes). _(one-liner provisorio — se refina con el volcado de ideas de producto)_

<!-- TODO: ampliar cuando el producto tome forma — flujo principal, para quién es, qué lo
     hace distinto. Mantener 2-4 párrafos; el detalle fino va en docs/reference/. -->

---

## Stack tecnológico

Next.js + TypeScript + Drizzle ORM + **Postgres en Docker Desktop** (decidido) + Tailwind CSS + Vitest — mismo stack que StressPlan. <!-- TODO: auth / pagos / hosting sin decidir todavía -->

<!-- TODO: desglosar frontend / backend / BD / auth / pagos / deploy a medida que se decida.
     Anotar acá solo lo que un agente necesita para NO leer el código: versiones mayores,
     drivers, gotchas de infra (puertos, flags de conexión). -->

---

## Estructura de carpetas

<!-- TODO: pegar el árbol real cuando exista el scaffold. Anotar al lado de cada carpeta
     clave qué vive ahí, para que un agente ubique sin explorar. -->

```
(sin scaffold todavía — TODO: pegar el árbol real cuando se cree el proyecto Next.js)
```

---

## Variables de entorno

<!-- TODO: documentar cada var con un comentario de para qué es. Nunca pegar valores reales
     de secrets — solo el nombre y el propósito. -->

```env
# (completar a medida que se agreguen)
```

---

## Lógica de negocio crítica

<!-- TODO — SE LLENA CON EL PRIMER FEATURE REAL, NO AHORA.
     Acá va la lógica que un agente DEBE conocer y que no es obvia del código: reglas de
     negocio, límites por plan, invariantes del dominio, funciones puras centrales. Cada
     entrada trazable a un spec en docs/specs/. Vacío hasta que exista el primer feature. -->

_(vacío — se llena con el primer feature)_

---

## Convenciones de código

### Regla base — el código acumulado es contexto obligatorio

Cada spec implementado deja código. **Ese código es entrada obligatoria del siguiente
spec**, no un detalle que se descubre al final.

Antes de implementar un spec nuevo:

1. **Buscar primero lo que ya existe** — tipos, helpers, componentes, queries, patrones de
   validación. Si algo parecido ya está resuelto, se reusa o se extiende; no se escribe una
   segunda versión.
2. **Respetar el estilo y las abstracciones vigentes** aunque hoy se harían distinto. La
   coherencia del conjunto vale más que la elegancia de una pieza suelta.
3. **Si hace falta divergir de un patrón existente, decirlo explícitamente** y por qué —
   no divergir en silencio.
4. **Si aparece duplicación real**, señalarla y proponer la unificación como paso aparte;
   no refactorizar de prepo en medio de otra tarea (ver regla global de cambios quirúrgicos).

**Por qué**: implementar spec por spec sin mirar lo acumulado termina en tres
implementaciones distintas de la misma cosa, cada una correcta contra su propio spec y
todas juntas imposibles de mantener.

_(El resto de las convenciones — naming, estructura de archivos, tests — se fijan cuando
exista el scaffold.)_

<!-- TODO: ajustar a medida que se fijen. Semillas típicas:
     - Tipado estricto; prohibido el escape del sistema de tipos sin type guard.
     - Validar el body de toda API/boundary público antes de procesar.
     - Formato de respuesta consistente { data, error }.
     - Componentes de servidor por defecto; cliente solo cuando hace falta.
     - Manejo de errores: try/catch en toda llamada a IA/BD/externa; nunca el error crudo al usuario. -->

---

## Notas importantes para Claude Code

<!-- TODO — SE LLENA CON CICATRICES REALES, NO AHORA.
     Acá van los gotchas que sorprenden: puertos no estándar, código muerto que no hay que
     tocar, config de infra contraintuitiva, "esto se hace así por X razón". Se gana con el
     uso; sembrarlo vacío lo envenena. -->

_(vacío — se llena con el uso)_

---

## Ciclo de vida de specs (regla de trabajo)

Manifiesto completo: `docs/specs/README.md`. Formato: `docs/AGENTES.md`. **Cada spec vive en
una sola carpeta según su estado.**

| Carpeta | Cuándo usar |
|---------|-------------|
| `docs/specs/planned/` | Decisiones cerradas — en cola, aún sin código (o con gate de negocio) |
| `docs/specs/active/` | **Normativo hoy** — leer antes de tocar el feature. Incluye specs parciales |
| `docs/specs/done/` | **Cerrado** — resumen operativo en `docs/archive/SPECS_ARCHIVO.md` |

### Prefijos de commit — escribir el spec ≠ implementarlo

Los commits `5ddf904` ("Spec 3 BUSQUEDA: home/search en 3 fases…") y `6628757` ("Spec 4
FICHA…") **solo tocan `docs/`**: son de autoría del spec. Leídos en `git log` parecen
implementaciones, y una sesión que arranca mirando el log arranca creyendo que el feature ya
existe. Pasó de verdad al empezar BÚSQUEDA. Desde 2026-07-20:

| Prefijo | Qué es | Toca |
|---------|--------|------|
| `spec(NOMBRE):` | Se escribió o corrigió un spec. **No hay código** | solo `docs/` |
| `feat(NOMBRE):` | Implementación. Si el spec tiene fases, nombrar la fase (`F1 —`) | `lib/`, `app/`, `drizzle/`… |
| `docs:` | Documentación que no es un spec (backlog, lecciones, archivo) | solo `docs/` |
| `fix(NOMBRE):` | Corrección sobre un feature ya implementado | código |

**Regla:** si el commit no toca código, no puede empezar con `feat`.

### Al empezar a implementar
1. Leer el spec. Si está en `planned/` y el trabajo toma más de una sesión, **moverlo a
   `active/`** (`git mv`) y actualizar `docs/specs/README.md`.
2. Implementar contra el DoD — no improvisar fuera de scope sin anotar en `BACKLOG.md`.
3. Si el spec tiene fases, cerrar **fase por fase**; no mover a `done/` hasta que esté completo.

### Al cerrar (checklist obligatorio — lo orquesta `/close-spec`)

| # | Qué | Dónde |
|---|-----|-------|
| 1 | Código + verificación técnica | typecheck · tests · build |
| 2 | QA con IDs trazables | `docs/qa/AnalisisQA.md` — sección nueva, IDs `FEATURE-NN`, ✅/❌. No condensar histórico |
| 3 | Resumen condensado | `docs/archive/SPECS_ARCHIVO.md` — anchor `{#slug}`, rutas, archivos clave, link al spec y al QA |
| 4 | Estado en el spec | Primera línea: `**Estado:** ✅ Implementado (YYYY-MM-DD)` o `Parcial — §X ✅; §Y pendiente` |
| 5 | Mover el spec | 100% cerrado → `git mv active/FOO.md done/`. Parcial → queda en `active/` |
| 6 | Manifiesto | `docs/specs/README.md` — mover fila a la tabla correcta |
| 7 | Cola de trabajo | `docs/product/BACKLOG.md` — ítem ✅ con fecha |
| 8 | Stub de redirect | Si moviste el archivo: stub de 5 líneas en la ruta vieja |
| 9 | Lecciones (si aplica) | `docs/operations/LECCIONES_APRENDIDAS.md` |

**El spec es el árbitro. QA bloqueado = no PR.**

---

## Continuidad entre sesiones

El volcado de ideas de producto lleva varias tandas de conversación. Estas reglas aplican a
**toda** sesión de este proyecto (no dependen de ningún prompt inicial):

1. **Aviso a ~70% de contexto consumido**: avisar al usuario sin que lo pida, con una línea
   directa — cuánto queda y qué conviene hacer. No esperar al límite: el handoff necesita
   contexto para escribirse bien.
2. **La fuente de verdad del traspaso es `docs/product/IDEAS.md`**, NO un resumen del chat.
   Mantenerlo al día **durante** la conversación, no al final — si la sesión se corta de
   golpe, lo que está en el archivo es lo que sobrevive.
3. **Al avisar del límite, generar de una** (sin que lo pidan) el prompt de continuación
   para la sesión nueva, en un bloque para copiar, que incluya:
   - qué se decidió en esta tanda (y qué quedó explícitamente sin decidir)
   - en qué tema estábamos cuando se cortó y cuál era la pregunta abierta
   - qué archivos leer primero y en qué orden
   - qué NO hacer todavía (ej. "no escribas specs, seguimos en volcado")
   - el modelo que corresponde para esa sesión
4. **`IDEAS.md` termina con una sección `## Estado de la conversación`**: temas cerrados,
   tema en curso, preguntas abiertas y próximo paso. Actualizarla al cierre de cada tanda.
   Es lo primero que lee la sesión siguiente.
5. **Antes de cerrar una tanda, aplicar el registro obligatorio** (regla global): si algo se
   decidió, se escribe. Si no está escrito, no existió.

---

## Loops con corte verificable (stop-conditions)

Solo automatizar (`/loop`) loops cuyo criterio de "listo" sea **objetivo**. Lo subjetivo
(autoría de spec, decisiones de producto/pricing) queda **manual**.

| Loop | Corte verificable |
|------|-------------------|
| **Fix → re-verify** (tras gaps de QA) | typecheck + tests verdes **y** `/qa-spec` = APROBADO (PARCIAL en vivo NO cierra) |
| **Coherencia memoria/docs** | `/consistency-check` = cero hallazgos ALTO |

**NO automatizar:** autoría/diseño de specs; decisiones de producto; cualquier loop sin
criterio objetivo.

Skills que dan el criterio: `/qa-spec`, `/close-spec`, `/consistency-check`, `/check` y el
hook pre-commit (`.claude/hooks/pre-commit-gate.sh`).

---

## Documentación — dónde está cada cosa

| Necesitás… | Leé… |
|------------|------|
| Implementar features / convenciones | Este archivo (`CLAUDE.md`) |
| Reglas globales (SDD, git, modelo) | `~/.claude/CLAUDE.md` |
| Regla de trabajo specs | `docs/specs/README.md` |
| Formato de spec / autoría | `docs/AGENTES.md` |
| Índice de docs por rol | `docs/README.md` |
| Specs implementados (resumen) | `docs/archive/SPECS_ARCHIVO.md` (cuando exista) |
| QA + IDs trazables | `docs/qa/AnalisisQA.md` (cuando exista) |
| Pendientes | `docs/product/BACKLOG.md` |
