# Spec: CURADURIA_POR_NOMBRE — curar un lugar buscándolo por nombre (FB-10 + FB-10b)

**Estado:** 🔵 Planned — en diseño
**Prioridad:** Alta — es la **Tanda B** del feedback de los primeros usuarios reales y **destraba
el ítem 3 de la cola post-v2** (curaduría de cobertura), hoy gateado esperando exactamente esta
puerta de entrada. Además arregla un 🔴 bug de pérdida de datos (`FB-10b`) que hoy casi no muerde
y que esta misma feature convierte en el camino principal.
**Gate:** Ninguno — el mecanismo de guardado ya existe entero (CURADURIA F2).
**Bloquea:** la curaduría de cobertura (#3 de la cola post-v2) y, en general, cualquier corrección
puntual del catálogo que hoy exige `psql`.
**Depende de:** [CURADURIA](../done/CURADURIA.md) (spec 9 — `place_tag_suggestions`, la tab de
`/admin`, `guardarCuraduria`) · [BUSQUEDA](../done/BUSQUEDA.md) (decisión 15 — match por nombre
con `word_similarity` + `immutable_unaccent`) · [CATALOGO](../done/CATALOGO.md) (taxonomía,
`place_tags.source`) · `lib/db/visibility.ts` (dueño único de qué se publica).

---

## Problema

Hoy **la única puerta de entrada a la curaduría es la cola por zona**, y la cola solo tiene lo que
dejó el batch: `proximoLugarDeZona` (`lib/curation/query.ts:107`) arranca de
`place_tag_suggestions where status='pending'`. Tras la corrida autónoma de CURADURIA F3 esa cola
quedó **prácticamente vacía** ⇒ hoy `/admin` → Curaduría no ofrece ningún camino para tocar un
lugar concreto.

Eso deja dos agujeros:

1. **El reportado (`FB-10`).** Un usuario real avisó que *"un bar con juegos figura solo como
   Bar"*. Es cierto y es corregible en 10 segundos — pero **no hay dónde hacerlo**: para etiquetar
   ese lugar hay que abrir `psql` y escribir un INSERT a mano. El mecanismo está entero
   (`guardarCuraduria(placeId, tags, precio)` es **agnóstico de la cola**: recibe un `placeId`, no
   le importa si hay sugerencias pendientes) y el endpoint `POST /api/admin/curaduria/[placeId]`
   ya existe con su gate de admin. **Lo único que falta es cómo llegar a un lugar sin pasar por
   la cola.**

2. **El que encontró el triaje y nadie reportó (`FB-10b`, 🔴 bug de pérdida de datos).**
   `guardarCuraduria` borra todas las `place_tags` con `source='admin'` de `FACETAS_EDITABLES`,
   que **incluye `precio`** (`lib/curation/acciones.ts:24`), y reinserta lo que mandó el cliente.
   Pero el editor nace en *"No sé"* — `const [precio, setPrecio] = useState<string | null>(null)`
   (`app/admin/curaduria-client.tsx:171`) — **porque `LugarEnCola` ni siquiera trae ese dato**
   (`lib/curation/query.ts:60`). Resultado: **guardar un lugar ya curado le borra el precio**, en
   silencio. El bug **ya existe hoy** en el camino por zona; hoy casi no muerde (la faceta Precio
   tiene ~1 lugar en 18.993 y la cola quedó vacía), pero `FB-10` convierte *"busco un bar, corrijo
   un tag, guardo"* en el gesto más común del producto de admin — y ese gesto se lleva el precio
   puesto.

Por eso los dos van **en la misma tanda y en este orden**, no uno después del otro: abrir la
puerta sin arreglar el piso es agrandar un bug de pérdida de datos.

## Objetivo

Que desde `/admin` → **Curaduría** se pueda **buscar un lugar por nombre y editarle los tags con
el mismo editor de siempre**, sin pasar por la cola de sugerencias y sin `psql`; y que **guardar
nunca pierda el precio que el lugar ya tenía**, por ninguno de los dos caminos.

Concretamente:

- Un buscador por nombre en la tab Curaduría → elegís un resultado → se abre `RevisorLugar` con
  el vocabulario completo de las 3 facetas sugeribles y el Precio, pre-tildado con lo que el
  lugar **realmente tiene**. Guardar usa el endpoint que ya existe.
- El buscador **encuentra también lugares despublicados**, que son justamente los que más hay que
  mirar (decisión 1).
- `LugarEnCola` gana el precio asignado y el editor arranca con él, para los **dos** armadores
  (por zona y por nombre).

## Qué NO es esta feature

- **No es un mecanismo de guardado nuevo.** `guardarCuraduria`, `rechazarLugar`, el endpoint
  `POST /api/admin/curaduria/[placeId]`, su gate de admin y `lib/curation/validacion.ts` **no se
  tocan**. Ni siquiera `FACETAS_EDITABLES`: que `precio` esté ahí es correcto (por eso el editor
  puede editarlo); el bug está en que el estado del cliente nacía mintiendo.
- **No es la curaduría de cobertura.** Este spec entrega *la puerta*; decidir qué lugares curar y
  con qué criterio es el ítem 3 de la cola post-v2, que arranca cuando esto exista.
- **No agrega sugerencias del LLM.** En modo por-nombre no hay batch ni evidencia:
  `sugerencias: []` y `Evidencia` ya renderiza el caso (*"Sin sugerencias pendientes con evidencia
  para este lugar"*). Correr el batch sobre un lugar suelto queda fuera de scope.
- **No toca `place_tag_suggestions`** más de lo que ya hace `guardarCuraduria` (que resuelve las
  `pending` del lugar — en modo por-nombre normalmente no hay ninguna, y si hay, se resuelven
  igual, que es lo correcto).
- **No es un buscador de admin general.** Devuelve lo mínimo para elegir un lugar y curarlo; no es
  un CRUD de `places`, no edita nombre/dirección/`operating_status`/`publish_override`.
- **No toca el motor de búsqueda del producto** ni su comportamiento: la decisión 4 extrae dos
  helpers **sin cambiar una línea de lógica**, para no clonarlos.
- **No cambia el flujo por zona.** La cola sigue igual, teclado-first y con su "siguiente".

## Decisiones cerradas

| # | Decisión |
|---|----------|
| 1 | **Divergencia deliberada y declarada del dueño único de visibilidad: el buscador de admin NO filtra por `publishedWhere`.** Un lugar despublicado (confidence bajo, `operating_status` raro) es **exactamente** uno de los que hay que curar — filtrarlo dejaría fuera del alcance justo el catálogo que peor está. **Cómo se declara sin clonar la regla invertida:** el predicado simplemente **se omite** (no se escribe ningún `NOT publishedWhere` ni una condición espejo en `lib/curation/query.ts`), y para que el admin sepa qué está tocando, cada resultado trae un flag `publicado` calculado **consumiendo la fuente única**: `isPlacePublished(fila, await getConfidenceThreshold())`. O sea: `lib/db/visibility.ts` sigue siendo el único que sabe qué significa "publicado"; acá se lo **consulta para etiquetar**, nunca se lo reimplementa para filtrar. La divergencia va comentada en el módulo, citando esta decisión |
| 2 | **Después de guardar en modo por-nombre se queda en el lugar, recargándolo desde el server, con un cartel de "Guardado ✓" y el buscador arriba con el término intacto.** No hay "próximo" porque no hay cola (`onResuelto()` hoy llama `traerProximo(zonaActiva)` y sin zona no hay nada que traer). Se descartó *"volver al buscador con el campo limpio"*: el gesto de FB-10 es puntual y a menudo iterativo (tildo, guardo, veo que faltaba uno), y limpiar de golpe deja al admin **sin confirmación de que se guardó** — que es exactamente el silencio que hizo invisible a FB-10b. Re-leer del server tiene además un beneficio de verdad: lo que se ve es **lo persistido**, no lo tipeado, así que el propio flujo verifica el fix del precio en cada uso. ⚠️ **Detalle que lo puede romper:** `RevisorLugar` se monta con `key={lugar.id}` y su estado (`elegidos`, `precio`) es `useState` inicializado del prop — recargar el **mismo** id no remonta y el editor seguiría mostrando lo tipeado. En modo por-nombre la key tiene que incluir un contador de recarga (algo como `id + ':' + revision`) para que el editor refleje lo que quedó en la base, incluidos los slugs que el server descartó por inválidos |
| 3 | **`FB-10b` — `LugarEnCola` trae el precio asignado y el editor arranca con él, en los DOS caminos.** `LugarEnCola` gana `precioSlug: string \| null` y `useState<string \| null>(lugar.precioSlug)` reemplaza al `useState(null)` de `curaduria-client.tsx:171`. El precio se lee de `place_tags` ∩ faceta `precio` **sin filtrar por `source`**: si lo puso un dueño o vino del import, el editor igual debe mostrarlo — mostrar "No sé" sobre un precio existente es la mentira que causa el borrado. Si por lo que fuese hubiera más de uno, gana el de menor `tags.sort` (determinista, sin sorpresas). El fix se aplica en `proximoLugarDeZona` **también**: el bug es del camino que ya existe, no del nuevo. **No se toca `guardarCuraduria`**: su borrar-y-reinsertar es correcto y es lo que hace que "destildar" funcione; lo que estaba roto era el estado inicial |
| 4 | **El match por nombre tiene un dueño y se reusa, no se clona.** `lib/search/query.ts` ya resuelve nombre con tolerancia a typos y acentos (`word_similarity` sobre `immutable_unaccent(lower(...))`, decisión 15 de BUSQUEDA, con índice GIN) — pero sus helpers `normalizado`/`simKey` son privados del módulo. Se **extraen tal cual** a `lib/search/nombre.ts` (dueño único del match por nombre de lugar) y `query.ts` pasa a importarlos; la curaduría consume el mismo módulo. Es refactor de extracción **sin cambio de comportamiento** — los tests del motor son la red. ⚠️ Prohibido escribir un `LIKE '%…%'` nuevo acá: sería una segunda implementación de la regla, y peor (sin acentos ni typos) |
| 5 | **El buscador es una extensión del endpoint que ya existe: `GET /api/admin/curaduria?q=<texto>`**, mismo archivo y mismo gate `sesionAdmin` inline (`app/api/admin/curaduria/route.ts`), que hoy ya ramifica por `?zona=`. No se crea una ruta nueva ni un gate nuevo. Sin rate limit: es admin gateado, no superficie pública — `lib/middleware/rate-limit.ts` es para endpoints abiertos y meterlo acá sería ruido |
| 6 | **Mínimo 2 caracteres y tope de 10 resultados.** El piso de 2 es el mismo criterio que ya usan `parseSearchParams` y `sugerir` (con una letra el resultado es la lista entera y no ayuda a nadie); con menos de 2 el endpoint devuelve lista vacía, no error. Orden: `word_similarity` desc, desempate por nombre asc (estable entre recargas). Cada resultado trae `id`, `name`, `address`, la **zona primaria** (sin ella, cinco "Los Inmortales" son indistinguibles) y el flag `publicado` de la decisión 1 |
| 7 | **El buscador vive arriba del selector de zonas, en la pantalla raíz de la tab Curaduría, y NO adentro del flujo por zona.** La cola por zona es teclado-first y su valor es la velocidad de tildado (decisión 9 de CURADURIA): meterle un input de texto en el medio es ruido. En modo por-nombre el buscador queda visible arriba del lugar abierto, para saltar al siguiente sin volver atrás. El handler global de teclas ya ignora `INPUT`/`TEXTAREA` (`curaduria-client.tsx:215`), así que **Enter dentro del buscador busca y no guarda** — hay que verificarlo, no asumirlo (`CURNOM-09`) |
| 8 | **Sin migración y sin schema nuevo.** Todo sale de tablas que ya existen. Un spec que no toca `drizzle/` es un spec barato de revertir |
| 9 | **⚠️ `npm run backup:db` antes de implementar y antes del QA.** Este spec escribe en `place_tags`, donde viven los **~3.967 tags `source='admin'` de la curaduría** — que **NO están en git, ni en las migraciones, ni en el seed** (CLAUDE.md § Notas importantes) y cuya reposición cuesta ~US$17 de Sonnet re-corriendo `npm run curar` sobre las 46 zonas. Y el borrado que hace `guardarCuraduria` es **puerta de ida**. Esto es lo que califica a FB-10b como bug serio y no como detalle cosmético: no rompe una pantalla, borra datos caros que nadie va a extrañar hasta que los busque |

## Alcance del código (lo que se toca, y nada más)

| Archivo | Qué cambia |
|---------|-----------|
| `lib/search/nombre.ts` | **Nuevo.** `normalizado` + `simKey` extraídos de `query.ts` tal cual (decisión 4) |
| `lib/search/query.ts` | Importa de `nombre.ts` en vez de definirlos. Sin cambio de comportamiento |
| `lib/curation/query.ts` | `LugarEnCola` gana `precioSlug` (decisión 3) · nueva `buscarLugaresPorNombre(q)` (decisiones 1/4/6) · nueva `lugarParaCurar(placeId)`, hermana de `proximoLugarDeZona` que arma el mismo `LugarEnCola` con `sugerencias: []` reusando el mismo `Promise.all` sin la primera query · `proximoLugarDeZona` también trae el precio |
| `app/api/admin/curaduria/route.ts` | Ramas nuevas `?q=` (buscar) y `?placeId=` (abrir un lugar), mismo gate (decisión 5) |
| `app/admin/curaduria-client.tsx` | Buscador + modo por-nombre (decisiones 2/7) · `useState(lugar.precioSlug)` (decisión 3) · `onResuelto` deja de asumir zona |

Sin cambios en: `lib/curation/acciones.ts`, `lib/curation/validacion.ts`, `lib/curation/facetas.ts`,
`app/api/admin/curaduria/[placeId]/route.ts`, `lib/db/visibility.ts`, `drizzle/`.

## Orden de implementación (un solo tramo, dos pasos)

Sin fases formales: es una sola tanda. Pero el orden importa.

1. **Primero `FB-10b`** (el piso): `precioSlug` en `LugarEnCola` + el `useState` del editor + su
   test. Es chico y **arregla el camino que ya existe hoy**, así que vale aunque lo de abajo se
   frene.
2. **Después `FB-10`** (la puerta): extracción de `lib/search/nombre.ts`, las dos queries nuevas,
   las ramas del endpoint y el tercer modo del cliente.

## Copy (rioplatense)

- Buscador: placeholder **«Buscá un lugar por nombre»**; ayuda debajo: *«Para corregirle los tags
  a un lugar puntual, sin pasar por la cola.»*
- Sin resultados: **«No encontramos ningún lugar con ese nombre.»**
- Con menos de 2 letras: no se muestra nada (ni error ni lista).
- Chip en un resultado despublicado: **«despublicado»**, con `title` *«No aparece en la búsqueda:
  confianza baja o marcado como cerrado.»*
- Tras guardar: **«Guardado ✓»**, junto al nombre del lugar.

## Criterios de done (DoD)

- [ ] `lib/search/nombre.ts` existe y es el **único** lugar donde se define el match por nombre;
      `lib/search/query.ts` lo importa y los tests del motor siguen verdes sin cambios
- [ ] `grep` de `LIKE`/`ilike` en `lib/curation/` da cero: el buscador usa `word_similarity`
      (decisión 4)
- [ ] `buscarLugaresPorNombre` **no** llama a `publishedWhere`/`publishedSql` y **sí** usa
      `isPlacePublished` para el flag `publicado` (decisión 1) — verificable por lectura del módulo
      o por test
- [ ] Un lugar **despublicado** aparece en los resultados del buscador de admin, marcado como tal,
      y se puede curar; **el mismo lugar sigue sin aparecer en la búsqueda pública**
- [ ] `GET /api/admin/curaduria?q=…` responde 403 sin sesión de admin (mismo gate que las ramas
      existentes); con `q` de menos de 2 caracteres devuelve lista vacía y 200
- [ ] Elegir un resultado abre `RevisorLugar` con las 3 facetas completas, `sugerencias: []` y el
      texto *"Sin sugerencias pendientes con evidencia para este lugar"*
- [ ] Guardar desde el modo por-nombre escribe `place_tags` con `source='admin'` usando el
      endpoint existente (sin código de guardado nuevo)
- [ ] Tras guardar, la pantalla **se queda en el lugar**, muestra "Guardado ✓" y el editor refleja
      **lo persistido** (remount forzado, decisión 2)
- [ ] **FB-10b:** un lugar con precio asignado abre con ese precio pre-seleccionado —y no en
      "No sé"— **por los dos caminos** (cola por zona y por nombre)
- [ ] **FB-10b:** guardar un lugar ya curado **sin tocar el Precio** deja su fila de precio intacta
      en `place_tags` (verificado con un `SELECT` antes/después, no solo por pantalla)
- [ ] Un precio de `source='owner'` o `'import'` se muestra pre-seleccionado y **no se duplica ni
      se pierde** al guardar (la PK es `(place_id, tag_id)` y `guardarCuraduria` solo borra
      `source='admin'`)
- [ ] `Enter` dentro del buscador busca; no dispara "Guardar y seguir" (decisión 7)
- [ ] El flujo por zona sigue funcionando igual: elegir zona → próximo lugar → guardar → siguiente
- [ ] Test que cubra el fix del precio (el armador devuelve el precio asignado) y test que cubra
      que el buscador no filtra por publicado
- [ ] `npm run backup:db` corrido antes del QA (decisión 9) y typecheck + tests + build en verde
      (build con el dev server parado)

## QA manual (IDs propuestos)

| ID | Caso | Criterio |
|----|------|----------|
| CURNOM-01 | `/admin` → Curaduría, buscar un lugar por nombre exacto | Aparece en los resultados con dirección y zona |
| CURNOM-02 | Buscar con typo y sin acentos (ej. *"parrila el juanca"*) | Encuentra igual — misma tolerancia que la búsqueda pública |
| CURNOM-03 | Escribir 1 sola letra | No se muestra nada; sin error en consola ni 400 |
| CURNOM-04 | Buscar un nombre inexistente | «No encontramos ningún lugar con ese nombre.» |
| CURNOM-05 | Buscar un lugar **despublicado** (confidence bajo) | Aparece, marcado «despublicado», y se puede abrir y curar |
| CURNOM-06 | El mismo lugar de CURNOM-05 en la búsqueda pública | Sigue sin aparecer — la divergencia es solo del buscador de admin |
| CURNOM-07 | Abrir un resultado | `RevisorLugar` con las 3 facetas, sin evidencia, con lo ya asignado pre-tildado |
| CURNOM-08 | Tildar un tag y guardar | «Guardado ✓», se queda en el lugar, el tag se ve en la ficha y filtra en la búsqueda |
| CURNOM-09 | Escribir en el buscador y apretar Enter | Busca; **no** guarda el lugar abierto |
| CURNOM-10 | **FB-10b** — abrir por nombre un lugar con precio asignado | El chip de precio arranca **seleccionado**, no en «No sé» |
| CURNOM-11 | **FB-10b** — abrir el mismo lugar desde la cola **por zona** | Idem: el precio arranca seleccionado (el fix vale para los dos caminos) |
| CURNOM-12 | **FB-10b** — `SELECT` de `place_tags` (faceta precio) → guardar sin tocar el precio → `SELECT` de nuevo | La fila de precio está intacta; antes de este spec desaparecía |
| CURNOM-13 | Cambiar el precio a otro valor y guardar | Queda el nuevo, uno solo, `source='admin'` |
| CURNOM-14 | Poner el precio en «No sé» y guardar | La fila `source='admin'` de precio se borra (borrar sigue siendo posible: es una acción explícita, no un efecto colateral) |
| CURNOM-15 | Flujo por zona completo (con la cola cargada) | Elegir zona → próximo → guardar → siguiente, sin regresión |
| CURNOM-16 | `GET /api/admin/curaduria?q=bar` sin sesión de admin | 403, mismo shape de error que las ramas existentes |

## Esfuerzo estimado

Una sesión. El grueso es UI (el tercer modo del cliente); el backend son dos queries nuevas en un
módulo que ya existe, una extracción de dos helpers y cero migraciones.

## Relación con otros specs

- **Destraba** la *curaduría de cobertura* (#3 de la cola post-v2, `docs/product/BACKLOG.md`), que
  está gateada esperando esta puerta de entrada.
- **Amend operativo de CURADURIA (spec 9), decisión 9:** la cola sigue siendo *por zona*; este spec
  agrega un segundo camino de entrada al **mismo** editor, sin tocar el mecanismo de guardado.
- **Consume** la decisión 15 de BUSQUEDA (match por nombre) y **diverge deliberadamente** de
  `lib/db/visibility.ts` en el sentido de la decisión 1 — declarado acá y comentado en el módulo.
