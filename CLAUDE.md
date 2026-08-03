# A Dónde Salimos — Prompt Maestro para Claude Code

> Las reglas **globales** (SDD, selección de modelo, git, registro obligatorio, seguridad,
> hábitos de sesión) están en `~/.claude/CLAUDE.md` y NO se repiten acá. Este archivo lleva
> solo lo específico de **este** proyecto. Si algo ya está en el global, referencialo — no
> lo dupliques (la duplicación es lo que después driftea).

## Idioma

**Responder siempre en español**, en todo momento — texto al usuario, mensajes de commit,
comentarios de PR, resúmenes de specs. Si una herramienta o el código está en inglés, está
bien citarlo tal cual, pero el texto propio va en español de principio a fin.

**El copy de cara al usuario va en argentino rioplatense** (voseo, "¿qué sale?" / "¿qué
pinta?"), **nunca español neutro**. Aplica a toda la UI: botones, mensajes de error, mails,
estados vacíos, headlines. El "antojar" y compañía suenan a doblaje — no van. (Esto es voz de
producto; el texto interno de docs/comentarios sigue la regla de arriba, español a secas.)

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

Next.js App Router. Cada carpeta clave, qué vive ahí:

```
app/
  page.tsx            home = búsqueda (server component, lee searchParams)
  layout.tsx          root layout (tema ámbar único, sin toggle)
  legales/            atribución de fuentes (Overture + Google)
  lugar/[id]/         ficha del lugar (FICHA) — server component + generateMetadata
  mis-lugares/        lo guardado (FAVORITOS F2) — server + client, patrón de /mis-votaciones
  api/
    search/           motor de búsqueda, count, pins (BUSQUEDA)
    lugar/[id]/google endpoint de Google en vivo (FICHA F2 — pendiente)
    favoritos/        guardar / sacar / estado por lote de un lugar (FAVORITOS)
    listas/           crear / renombrar / borrar listas (FAVORITOS F2)
components/
  ui/                 primitivos (button, bottom-sheet, filter-chip, search-input)
  shared/             place-card (card del listado; slot `accion` para guardar)
  search/             shell de búsqueda, sheets, mapa MapLibre, chips
  lugar/              acciones de la ficha (volver/compartir/guardar — cliente)
  favoritos/          botón de guardar (cliente, estado optimista + sheet de destino)
lib/
  db/                 schema Drizzle, index (pool), visibility (única puerta al
                      catálogo publicado), settings (app_settings en runtime),
                      taxonomy, chips
  search/             motor (query), params, card helpers, impresiones, catálogo
  lugar/              ficha: query (getPlaceDetail) + ficha.ts (helpers puros)
  favoritos/          planes (dueño único del cupo de listas), acciones, query,
                      validacion
  google/             settings.ts (claves de cuota); places.ts server-only → F2
  zones/              geometría (turf, sin PostGIS)
  middleware/         rate-limit por IP (memoria de proceso)
drizzle/              migraciones generadas + snapshots (0000..0011)
scripts/              seed, import-overture, zones:build/load/assign
data/zones/           46 GeoJSON versionados (fuente de verdad de las zonas)
docs/                 specs/, qa/, product/, operations/, archive/ (ver docs/README.md)
```

---

## Variables de entorno

El valor real vive en `.env` (gitignoreado). `.env.example` lleva solo el nombre y el
propósito, nunca un secret real.

```env
# Postgres en Docker Desktop. Puerto 5439 (no el 5432 default) para no chocar con otros.
DATABASE_URL=postgresql://...@localhost:5439/adondesalimos

# Google Places API (New) — la usa la Ficha (spec 4, F2/F3) para horarios/rating/foto en
# vivo. Key SERVER-ONLY: solo la lee lib/google/places.ts, nunca llega al bundle del
# browser. Restringida a "Places API (New)" en Google Cloud Console.
GOOGLE_PLACES_API_KEY=

# Opcionales de operación:
# DISABLE_RATE_LIMIT=true      apaga el rate limit (dev)
# TRUSTED_IP_HEADER=...         header del que sale la IP real detrás de proxy
```

---

## Lógica de negocio crítica

Reglas que un agente **debe** conocer y que no son obvias del código. El detalle vive en
el spec citado — acá va el invariante, no la explicación entera.

### Visibilidad del catálogo (CATALOGO)
`publicado ⇔ operating_status='open' AND (confidence >= umbral OR publish_override)`. Fuente
**única**: `lib/db/visibility.ts` (`isPlacePublished` / `publishedWhere`). El umbral se lee de
`app_settings` en runtime — un UPDATE cambia el catálogo sin redeploy. Nadie reimplementa la
regla. `operating_status` hoy no filtra nada (Overture lo entrega NULL en todo AMBA → default
`'open'`); no asumir que oculta cerrados. Ver `docs/qa/AnalisisQA.md` § CATALOGO H-2.

### Disciplina de costos de Google (FICHA) — donde $0 se vuelve $32/1.000
- **Solo se persiste `google_place_id`.** Horarios, rating, nombre y fotos de Google:
  **prohibido guardarlos y cachearlos** (ToS, no performance). Cero caché en todo nivel
  (`cache:'no-store'`, ruta dinámica); único dedupe permitido: `React.cache` dentro de un render.
- **Matching gratis**: Text Search *IDs-Only*, `fieldMask: places.id` y **nada más** (un campo
  de más ⇒ $32/1.000). **Place Details Enterprise**, nunca *Atmosphere* (sin `reviews`/
  `editorialSummary`). **Una sola foto** por ficha.
- **Un solo módulo habla con Google**: `lib/google/places.ts` (server-only, F2). La key vive
  solo ahí. El bloque de Google se pide **desde el cliente**, no en el render (los crawlers no
  deben gastar); `robots.txt` bloquea `/api/`.
- **Topes por SKU** en `app_settings` (`google.details_monthly_cap`/`photos_monthly_cap`,
  contados en `google_api_usage`): superado el tope, la ficha **degrada** al modo sin Google
  en vez de disparar la factura. Bajar un tope a 0 apaga el SKU sin deploy.
- Presupuesto validado: ~3.000 fichas/mes × 1 foto ⇒ **~$54/mes**. Decisiones 7-22 del spec
  FICHA son la línea entre gratis y pago — hay tests que fallan si el field mask trae un campo
  de más. No relajarlos.

### Contenido del dueño y planes (AUTH F3)
- **Lo que edita el dueño NUNCA va a las columnas base de `places`**: el re-import de Overture
  las pisa. Va a `place_owner_content` (1-a-1, todo nullable) y la ficha resuelve
  `COALESCE(dueño → base)` con `resolverContenidoDueno` (`lib/negocio/contenido.ts`), que es la
  fuente única de esa regla.
- **El contenido se aplica solo mientras el lugar tenga reclamo aprobado.** Revocar o eliminar
  la cuenta devuelve la ficha a Overture sin borrar la fila. Ocultar ≠ borrar, en los dos ejes:
  también el contenido pago se oculta al volver a `owner_plan='free'`.
- **`places.owner_plan`** (`'free'`|`'paid'`, por lugar) gatea 3 fotos vs 15 y los 3 campos
  pagos (`description`, `menu_url`, `news`). **Se aplica server-side desde el día 1**: "subir un
  cupo es un regalo; bajarlo es una traición". Hasta el spec 7 se cambia con un `UPDATE`
  documentado — no hay automatización y no debe agregarse acá.
- **Un solo módulo habla con R2**: `lib/storage/r2.ts` (server-only, mismo criterio que
  `lib/google/places.ts`). El browser sube a `/api/mi-negocio/[placeId]/photos`, nunca a R2.
  **La fila de `place_photos` se inserta DESPUÉS del PUT exitoso** — nunca una URL huérfana en
  la base; un objeto huérfano en R2 sí es aceptable.

### Métricas agregadas (BUSQUEDA + FICHA)
`place_impressions_daily` cuenta `impressions` (búsqueda) y `detail_views` (aperturas de ficha)
por lugar y día. **Agregado puro**: sin `user_id`, sin cookies, sin IP. Es el histórico que
vende el B2B (spec 7) y no se puede reconstruir después.

### Prompt caching de Anthropic — el mínimo es una trampa silenciosa
Los dos prompts que se repiten entre llamadas se cachean con `cache_control`: el del chat
(`lib/ai/prompts.ts`, 8.776 tokens de prefijo) y el del sugeridor de curaduría
(`lib/curation/sugeridor.ts`, **1.260**). **Por debajo del mínimo cacheable el caching no cachea y
NO avisa** (`cache_creation_input_tokens: 0`, sin error). El mínimo **depende del modelo**: Sonnet 5
= 1.024 · Haiku 4.5 = 4.096. Consecuencia concreta: **bajar `ai.curation_model` a Haiku apagaría el
caching del sugeridor en silencio** (ese texto le da 958 tokens, ni cerca de 4.096). Si recortás un
prompt o cambiás de modelo, re-medí con `count_tokens` (es gratis). Y `input_tokens` es el remanente
**no** cacheado: todo costo se calcula con `calcularCostoUsd` pasándole también los tokens de caché
(read 0,1× · write 1,25×) — omitirlos **subestima**. Ver `docs/operations/LECCIONES_APRENDIDAS.md`.

### Modelo del chat IA (CHAT_IA)
El default vigente es **Sonnet 5** (`claude-sonnet-5`), no Haiku — decidido con el A/B del
2026-07-26: Haiku narraba el retry de la tool y deslizaba la voz al reintentar tras una búsqueda
vacía (instrucción negativa poco confiable en modelo chico); Sonnet lo arregla a ~3× el costo/token,
aceptado como prioridad de voz/producto. El model id vive en `app_settings` (`ai.chat_model`): el
swap es un UPDATE sin deploy. El seed de `lib/ai/settings.ts` sigue en Haiku (fallback) — **manda el
runtime**. El porqué entero está en el spec (decisión 3) y en `docs/product/BACKLOG.md`.

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

Cicatrices reales — gotchas que sorprenden:

- **El dev server lo levanta el usuario**, nunca Claude: `npm run dev` en el **puerto 5178**.
  Se accede por `https://adondesalimos.ngrok.app`, no `localhost`. El MCP de Playwright
  (`.mcp.json`, gitignoreado) verifica el render en vivo que el checker read-only no ve.
- **`next build` con el dev server levantado comparten `.next` y el build puede romper**
  (lección BUSQUEDA). Si solo se tocó `docs/`, reconfirmar typecheck + tests alcanza; el build
  se corre con el server parado. Por eso el build suele quedar pendiente al cerrar una fase.
- **Postgres en el puerto 5439** (no el 5432 default), en Docker Desktop. Las migraciones se
  aplican con `npm run db:migrate` (aditivo, seguro) y `npm run db:seed` es idempotente.
- **Las listas de Overture (`phones`/`websites`/`socials`) son `jsonb`**, no columnas array:
  cruzan el driver de DuckDB serializadas a JSON (lección CATALOGO). En la ficha llegan como
  `string[] | null` — coercionar a `[]`.
- **`lucide-react` (v1.16) NO tiene íconos de marca** (Instagram/Facebook/Twitter): se
  removieron. Las redes de la ficha se rotulan con texto vía `clasificarRed`. Ver BACKLOG.
- **`operating_status` viene `'open'` para todos**: no filtra lugares cerrados todavía (H-2).
- **Una votación tiene DOS techos de opciones y son dos constantes distintas**
  (`lib/votaciones/constantes.ts`): `MAX_OPCIONES = 5` es lo que el **creador** puede poner al
  armar (lo importan `/votacion/nueva` y el chat IA) y `MAX_OPCIONES_TOTAL = 8` es hasta dónde
  crece con lo que suma el grupo (SUGERIR_EN_VOTACION). Pisar la primera con la segunda rompe el
  alta y el chat.
- **`occasion_chips.in_home` ya NO significa "candidato a la home"**, significa "candidato **por
  defecto**" (CHIPS_ROTACION, decisión 11). Una regla de `app_settings['chips.schedule']` puede
  adelantar a la home cualquier chip **vivo**, tenga `in_home` o no. Y el orden de los 4 no es el
  de la columna `sort` a toda hora: depende del día y la hora en AR. Un setting ausente o inválido
  degrada al orden por `sort` **en silencio** — si la home "no rota", mirá primero
  `select value from app_settings where key='chips.schedule'`, no el código.
- **Un chip vivo puede no verse por dos motivos más, y ninguno está en `occasion_chips`.** (a) Su
  regla tiene `solo: [...]` ⇒ fuera de esa ventana **no aparece en ningún lado**, tampoco detrás de
  "Ver más" (hoy: `after-office`, L-V 17-21). (b) Devuelve menos de `PISO_HOME` (**20**) lugares en
  AMBA ⇒ no entra a los 4 de la home, ni siquiera forzado por la regla, pero **sí** sigue en "Ver
  más" (hoy: `salida-con-chongo`, 1 lugar). El `> 0` de la decisión 25 es el piso de "Ver más", no
  el de la home. Dueños: `lib/search/rotacion.ts` (ventana) y `lib/search/chips.ts` (piso).
- **Commits que solo tocan `docs/` usan `spec(...)`/`docs:`, nunca `feat`** (ver arriba
  § Prefijos de commit). Un `feat` implica que hay código.
- **⚠️ La curaduría vive SOLO en el Postgres de dev — no viaja en git.** Los ~3.967 tags
  `place_tags source='admin'` cargados por CURADURIA (spec 9, corrida Sonnet + bulk-accept de
  Fer, 2026-07-27) son **datos**, no código: no están en migraciones ni en el seed. Un reset o
  recreación de la base (`db:migrate` sobre una base limpia, borrar el volumen de Docker, montar
  otra máquina) **los pierde** y el seed NO los regenera. Recuperarlos = re-correr
  `npm run curar` sobre las 46 zonas (~US$17 con Sonnet) **o** restaurar un dump. Antes de
  cualquier operación destructiva sobre la base, **hacer `pg_dump` primero**. Mismo criterio para
  cualquier dato de admin/dueño/votación que no nazca del seed. Ver `docs/qa/AnalisisQA.md`
  § CURADURIA F3 → *Cierre de la cola*. **Los retiros de tags, en cambio, ya están declarados en
  código** (`TAGS_RETIRADOS` en `lib/db/taxonomy.ts`): sobre una base nueva se re-aplican con
  `npm run db:retiros` (idempotente, no toca `place_tags`).

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
| `chore:` | Tooling / infra / mantenimiento que no es feature de producto (scripts de dev, backup, config, npm scripts, reglas de trabajo) | `scripts/`, `package.json`, `.gitignore`, `CLAUDE.md`… |

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
| 7 | Cola de trabajo | `docs/product/BACKLOG.md` — **los dos**: tildar el ítem de la lista `[x]` con fecha **y** agregar la entrada al log `## Hecho` (al tope) |
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
6. **Retro de 3 líneas al cerrar la sesión** en `docs/operations/RETRO.md` (arriba de todo,
   más reciente primero): *qué salió bien · qué frenó · qué cambiar*. El método que se mejora
   solo le gana al método fijo: cada sesión deja al sistema un poco mejor que la anterior. Es el
   loop que cierra las encuestas de fin de sesión (antes se perdían con el chat).

### Las 3 preguntas de cierre (y por qué son así)

Fer pregunta al final de cada sesión si hay algo que mejorar del método. **"¿Qué mejorarías?" a
secas no sirve: presupone que hay algo, y un casillero vacío pide ser llenado** — el riesgo real es
que la sesión invente una mejora plausible para cumplir el ritual, y una mejora inventada es peor
que ninguna (ensucia el RETRO y agrega reglas que nadie necesitaba). Así que se cierra con estas
tres, y **"nada" es una respuesta válida y esperable en las tres**:

1. **¿Hubo fricción real?** Algo que costó tiempo, que salió mal, o donde la sesión **adivinó en vez
   de saber** — con el **momento concreto**: qué archivo, qué comando, qué decisión.
2. **¿Algo del método estorbó o no se pagó?** Una regla, un doc o un paso del checklist que costó
   más de lo que aportó. **Restar cuenta igual que sumar.**
3. **Si de eso sale UNA sola cosa para cambiar: cuál, y qué cuesta.** Si ninguna vale el cambio,
   decirlo y no cambiar nada.

**Cómo detectar una respuesta inflada:** si un hallazgo no señala un archivo, un comando o una
decisión puntual de **esta** sesión, probablemente se generó para llenar el hueco. La pregunta 2
existe para corregir el sesgo aditivo (agregar redes suena a mejora, sacar suena a aflojar) y la 3
para forzar triaje. **Calibración: lo normal es cero o un hallazgo por sesión**; tres es raro y solo
se justifica cuando se estrenan patrones nuevos (pasó el 2026-07-30, primera sesión de código de v2).

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

## Paralelismo y orquestación — cuándo sugerir fan-out

**Regla de iniciativa (pedido de Fer, 2026-07-27): el humano no tiene por qué saber cuándo
conviene paralelizar — eso lo sugiere Claude, y Fer decide sí/no.** Ante una tarea "fan-out",
Claude **propone explícitamente** correrla con subagentes en paralelo o un workflow, con una
línea de costo/beneficio, ANTES de arrancar en secuencia. No la lanza sin OK (mismo criterio
que git): sugiere, Fer aprueba.

**Qué es fan-out (sugerir):** repetición independiente sobre muchos ítems (curar/procesar N
zonas o N lugares), auditoría multi-archivo (los specs contra el código), scaffoldear varios
specs de una, cazar un bug con varios verificadores adversariales, generar y comparar N enfoques
de diseño. **Qué NO lo es (secuencial y directo):** una edición de 1-2 archivos, una pregunta,
un fix puntual. Ante la duda, si el trabajo es "lo mismo × N ítems independientes", se sugiere.

---

## Redes de seguridad — mantenimiento (correr, no olvidar)

Activos de seguridad del proyecto. Toda sesión debe saber que existen y cuándo usarlos:

- **Backup de la base** — `scripts/backup-db.sh` (`npm run backup:db`, requiere Git Bash). Hace
  `pg_dump` del Postgres de dev a `backups/` (gitignoreado — es data). **Correlo ANTES de
  cualquier operación destructiva sobre la base** (`db:migrate` sobre base limpia, borrar el
  volumen de Docker, cambiar de máquina) — la curaduría (~3.967 tags) NO está en git ni en el
  seed (ver § Notas importantes). Restore: `gunzip -c backups/<archivo>.sql.gz | docker exec -i
  adondesalimos_db psql -U adondesalimos -d adondesalimos`.
- **Deuda de backup, visible** — `scripts/backup-check.sh` (`npm run backup:check`, `[días]`
  opcional, default 7). **No** hace el dump y no toca la base: mira `backups/` y avisa si el
  último es viejo o no existe (exit 1 + el comando para arreglarlo). Existe porque el backup es
  manual y "me olvidé de correrlo" y "perdí la curaduría" son el mismo evento con dos meses de
  distancia. Lo llaman solos: el **hook pre-commit** cuando el commit toca `drizzle/` (una
  migración nueva es la señal más temprana de que alguien va a correr `db:migrate`) — **avisa, no
  bloquea** — y **`/consistency-check`** (check g).
- **Auditoría de coherencia docs ↔ código ↔ DATOS** — `/consistency-check` (skill local).
  Además de los cruces contra el código, su **check (f)** cruza los docs contra el **runtime**
  (`app_settings`, tags, chips, curaduría) con `SELECT` únicamente. Cubre el drift que no se ve en
  ningún archivo: el modelo que realmente corre, precios y topes, tags retirados con filas, el
  **canario de la curaduría** (si `place_tags source='admin'` **bajó** de ~3.967 es posible pérdida
  de datos → backup ya) y los **gates numéricos de specs que ya se cumplieron** sin que nadie se
  entere. Correlo después de una corrida de curaduría, un cambio en `app_settings` o al retomar el
  proyecto tras un parate.
- **Borrado real de las fotos de un lugar** — `scripts/borrar-fotos.ts` (`npm run fotos:borrar --
  <placeId>`). ⚠️ **Puerta de ida: el objeto de R2 no vuelve.** Es para el caso de **abuso** (se
  hizo pasar por dueño, subió fotos ofensivas); revocar un reclamo por corrección **oculta y no
  borra**, y ese sigue siendo el default. Existe como script y **no** como botón de `/admin` a
  propósito: la única acción irreversible del producto no va en el camino de un click. Pide escribir
  el nombre del lugar para confirmar. La regla vive en `borrarFotosDeLugar` (`lib/negocio/acciones.ts`),
  de la que también depende el borrado de cuenta — no escribir una segunda.
- **Termómetro de calidad de búsqueda del chat** — `scripts/eval-chat.ts` (`npm run eval:chat`).
  Corre casos reales contra prompt+tool+motor+Sonnet, imprime los tool-inputs y **chequea que no
  vuelva la trampa de `precio` ni el sobre-filtrado de escape-room**. **Cuesta tokens reales
  (Sonnet).** Correlo después de tocar `lib/ai/prompts.ts` o cuando cambie la densidad del
  catálogo (curaduría nueva).

---

## Reversibilidad — calibrá el cuidado al radio de explosión

**"Infalible" no es "nunca falla": es "cada error, chico y visible".** El cuidado que merece
una decisión se calibra por si es **reversible**, no por su tamaño aparente:

- **Puerta de ida y vuelta** (reversible: un prompt, un copy, un color, una feature detrás de
  flag, un setting de `app_settings`) → decidir rápido, iterar, NO sobre-especear. La ceremonia
  de más acá cuesta velocidad gratis.
- **Puerta de ida** (difícil de revertir: un schema que ya tiene data real, un precio, una URL
  pública/SEO, borrar o pisar datos, un re-import que pisa columnas) → frenar, especear en serio,
  **backup primero** (`npm run backup:db`), confirmar con Fer.

El error a evitar es tratar todo con el mismo ritual. Antes de una tarea con efecto en la base,
en producción o de cara al usuario: nombrar en una línea si es de ida o de ida y vuelta, y actuar
en consecuencia. (Esta misma regla aplica a editar el CLAUDE.md **global** vs el del proyecto: el
global toca todos los proyectos → radio grande; ante la duda, cambio acá y se promueve después.)

## Una regla, un dueño

**Cada regla de negocio vive en un solo módulo, y nadie la reimplementa.** Es el invariante que
hace que un agente pueda mantener este código sin romperlo: si el vocabulario y las reglas viven
en un único lugar, una sesión no puede divergir en silencio. Ya es así y hay que defenderlo:
`lib/db/visibility.ts` (qué se publica), `lib/google/places.ts` (única puerta a Google),
`lib/storage/r2.ts` (única a R2), `lib/ai/cupo.ts` (cupo), `lib/ai/settings.ts` (claves de
runtime), `lib/negocio/contenido.ts` (COALESCE dueño→base), `lib/favoritos/planes.ts` (cuántas
listas puede tener alguien y cuáles ve — bajar de plan **oculta, no borra**),
`lib/search/rotacion.ts` (qué chips van primero según el reloj), `lib/negocio/horarios.ts`
(`partesEnAR`: el día y la hora en AR se computan **una vez**, no por feature) y `lib/geo/amba.ts`
(el rectángulo de AMBA: qué se importa y hasta dónde llega el pin de un alta — **sin imports**, para
que el script de import no arrastre `lib/claims`).

- Antes de escribir una regla, **buscá si ya tiene dueño** — se reusa o se extiende, no se clona.
- Si aparece una **segunda implementación** de la misma regla, no es un detalle: es el cleanup de
  **máxima prioridad** (se unifica hacia el dueño único), porque dos copias driftean y la que
  quede desactualizada miente. Señalarlo apenas se ve, aunque el arreglo vaya como paso aparte.

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
| Retro por sesión (qué mejorar del método) | `docs/operations/RETRO.md` |
