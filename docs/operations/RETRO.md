# RETRO — A Dónde Salimos

Retro corta por sesión: **qué salió bien · qué frenó · qué cambiar.** El método que se mejora
solo le gana al método fijo — cada sesión deja al sistema un poco mejor que la anterior. Es el
loop que cierra las encuestas de fin de sesión (antes se perdían con el chat).

**Formato:** una entrada por sesión, **más reciente arriba**. Tres bullets, corto. Si un "qué
cambiar" se implementó, se dice dónde (commit, archivo). No es un diario largo — son 3 líneas.

**De dónde sale el contenido:** las 3 preguntas de cierre de `CLAUDE.md` § *Continuidad entre
sesiones*. **Una sesión sin hallazgos se escribe igual, diciendo que no hubo** — es lo normal, y
llenar el hueco con una mejora inventada agrega reglas que nadie necesitaba.

---

## 2026-08-03 · PULIDO_BETA F2+F3 — triaje de los 10 y fix — Opus

- **Qué salió bien:** **leer el código de los 10 antes de presentar el triaje**. Convirtió el costo
  de cada arreglo en un dato («1 línea, `zone-sheet.tsx:209`») en vez de una estimación, y con eso
  Fer confirmó los 10 en tres bloques sin repreguntar. Segundo acierto: **medir la base antes de
  escribir copy**. Las 4 sugerencias del chat no se eligieron por gusto — al contar los tags apareció
  que `romantico` tiene 71 lugares en todo AMBA y `wifi-trabajar` 218, o sea que dos de las cuatro
  viejas estaban rotas por el mismo motivo que la que se auditó, no solo la de Villa Crespo.
- **Qué frenó:** nada del método. Lo único que costó turnos fue propio del trabajo: **dos arreglos
  cambiaron de forma al implementarlos** (el reanudador del guardado no podía vivir en el botón por
  el scroll infinito; el copy de "cerró vs venció" no se podía leer del estado por la expiración
  perezosa). La lección del click sintético, generalizada en la sesión anterior, **se pagó de una**:
  todo se tocó con `element.click()` desde el primer turno y no se perdió ninguno.
- **Qué cambiar:** **nada.** El corte de F1 (ver) y F3 (arreglar) hizo que esta sesión empezara con
  43 hallazgos con evidencia y cero ambigüedad sobre qué tocar — no hubo una sola decisión de
  producto improvisada. Y el «un hallazgo se verifica por su consecuencia, no por el resultado de la
  herramienta» ya está escrito; se aplicó tal cual (fila en la base para R3-03, `navigator.share`
  instrumentado para R4-01) y alcanzó.

---

## 2026-08-03 · PULIDO_BETA F1 — auditoría de los 6 recorridos en mobile — Opus

- **Qué salió bien:** **arrancar por R2 y escribir cada sección apenas terminaba el recorrido**, en
  vez de acumular y volcar al final. La consigna lo pedía y se pagó sola: cuando R2 quedó escrito
  (13 hallazgos), el resto de la sesión ya no tenía nada crítico que perder. Segundo acierto:
  **verificar contra la base antes de escribir un hallazgo**. Dos veces evitó anotar algo falso —
  el «guardar no guarda» era el click sintético de Playwright, y el `#FF2D75` de los clusters del
  mapa que parecía fuera de paleta está declarado como `--color-rosa` en `globals.css`. Y en R5, al
  revés: chequear Villa Crespo (**1.169 lugares, 244 con tag bar**) convirtió «la IA no encontró
  nada» en un BLOQUEANTE con evidencia.
- **Qué frenó:** **el click sintético de Playwright no dispara los handlers de esta app**, y la
  lección escrita en `PULIDO` decía «el form del chat», así que la sesión la leyó como un caso
  particular de `<form>`. No lo es: falló igual en el botón de guardar de una card, en «+» de la
  votación y en «Es mío». Se perdieron ~4 turnos y estuvo a un paso de un BLOQUEANTE falso. Segundo
  freno, menor: el heredoc `<< 'EOF'` para anexar al QA se rompió al primer intento (lo que
  `CLAUDE.md` ya avisa para los commits) — el camino que funciona es escribir al scratchpad con
  Write y `cat >>`.
- **Qué cambiar (una sola):** **generalizar la lección del click en `LECCIONES_APRENDIDAS.md`**: no
  es «el form del chat», es «en QA en vivo, cualquier control de esta app se toca con
  `element.click()` vía `evaluate`; `browser_click` reporta éxito sin disparar nada». Cuesta editar
  un párrafo y evita que la próxima sesión de QA pierda lo mismo o anote un bug inexistente. Lo que
  **no** hace falta cambiar: el formato de hallazgo de la decisión 7 (6 campos) se llenó 41 veces
  sin fricción, y el corte «ver y arreglar en fases separadas» hizo exactamente lo que promete —
  hubo tres cosas que gritaban para arreglar en el momento y ninguna se tocó.

---

## 2026-08-03 · Ventana horaria + piso de la home + sugerencia de plan en el chat — Opus

- **Qué salió bien:** **la cola llegó con los números ya medidos, y eso convirtió dos decisiones en
  dos renglones.** Elegir `PISO_HOME = 20` no requirió tocar la base: el ítem ya decía que entre 2 y
  37 no hay ningún chip, así que 10 y 20 son hoy el mismo filtro y la elección se argumenta sola. Un
  ítem de backlog con la medición adentro se implementa; uno con la intuición adentro se re-investiga.
- **Qué frenó:** nada del método. Lo único que costó pensar fue propio del problema: **`solo` no
  podía heredar el "gana la primera regla" de `primero`** — ese criterio es correcto para un orden y
  veneno para un permiso, y con él una ventana puesta arriba apagaba en silencio el adelanto de las
  reglas de abajo. Salieron dos semánticas en el mismo array, documentadas una al lado de la otra.
- **Qué cambiar:** nada. Al contrario, se confirmó una regla que ya está escrita: el prompt reservaba
  una decisión aparte (tocar el prefijo cacheado de 8.776 tokens + `eval:chat`, tokens reales) **por
  si** el modelo no encadenaba las dos búsquedas de un combo. Probarlo primero costó un mensaje de
  cupo y la decisión no hizo falta: encadena solo, con cercanía incluida. **Probar antes de instruir**
  ya vale como default.

## 2026-08-03 · Los 5 temas abiertos del QA integral #2 — sesión de decisión — Opus

- **Qué salió bien:** **verificar cada hallazgo contra el código antes de repetir su
  recomendación.** El prompt lo pedía explícitamente y pagó: **3 de 5 cambiaron de forma**. El
  checkbox de borrar fotos se convirtió en un script (la función que iba a reusar era por *usuario*,
  no por *lugar*, y el argumento que lo justificaba ya estaba resuelto por `admin_notes`); el chip de
  Precio resultaron ser dos; y la mitad del hallazgo del chat directamente no ocurría. **Un hallazgo
  de QA describe el código del día que se escribió** — tratarlo como estado actual es lo que hace
  que una sesión implemente la solución de un problema que ya cambió.
- **Qué frenó:** nada del método. Lo único caro fue el chip: editar `lib/db/chips.ts` no alcanzaba
  porque `db:seed` no actualiza los tags de un chip existente, y eso no estaba escrito en ningún
  lado — se descubrió leyendo `scripts/seed.ts:194`. Ya quedó anotado en el BACKLOG y en el QA.
- **Qué cambiar:** nada nuevo. La única regla que se sumó vive donde tiene que vivir (el docstring
  de `CHIPS_OBJETIVO`: un chip con tag de Precio está apagado de hecho), no en un doc más. El
  fan-out de 4 `implementador` en paralelo sobre archivos disjuntos funcionó sin fricción; el único
  ruido fueron los avisos de "hay trabajo ajeno en el working tree", que es cada agente viendo a los
  otros — esperable y no vale una regla.

## 2026-08-03 · Fixes de código del QA integral #2 (INT2-33 + INT2-28) — Opus

- **Qué salió bien:** **el BACKLOG evitó un bug en vez de solo describirlo.** El fix de las fotos
  estaba mal en su primera versión —gateaba `getPlaceDetail` y dejaba el `tieneFotoDueno` del
  enriquecimiento leyendo `place_photos`, así que la ficha revocada quedaba **sin ninguna foto**— y
  los 622 tests lo daban por bueno. Lo frenó un ítem escrito el 2026-07-21 que ya tenía la trampa
  nombrada con las dos funciones: *"hay que tocar DOS lugares o ninguno"*. Es la primera vez que la
  cola paga como red de seguridad y no como lista de pendientes.
- **Qué frenó:** nada del método. La única fricción real fue **de secuencia y estaba prevista en el
  prompt**: leer el ítem viejo del BACKLOG *antes* de escribir el fix habría ahorrado una pasada de
  Playwright (se verificó en vivo el fix incompleto, se vio 0 imágenes, y recién ahí apareció el
  ítem). El orden de lectura que el prompt fijaba —QA, BACKLOG, código— era el correcto; lo que
  fallé fue leer del BACKLOG **solo los 3 ítems nuevos**, no lo que ya había sobre el mismo archivo.
- **Qué cambiar:** una, chica y ya aplicada acá: **al arreglar un archivo, buscar en el BACKLOG por
  el nombre de la función que se toca, no solo por el ID del hallazgo.** `grep tieneFotoDueno` sobre
  `docs/` devolvía la trampa entera en una línea. Es la versión "cola de trabajo" de la regla que ya
  existe para el código (*buscar primero lo que ya existe*), y no necesita regla nueva en `CLAUDE.md`:
  cabe como hábito en el paso 1 del ciclo de fixes. _(Lo demás no califica: la decisión 12.3 se
  resolvió en un turno porque el prompt traía las tres opciones medidas — eso funcionó.)_

## 2026-08-02 · QA integral #2, sesión 3 (bloques D+F) — Opus

- **Qué salió bien:** **el backup previo al QA se usó como segunda fuente de verdad, no solo como
  póliza.** Extraerle los conteos al `.sql.gz` de las 14:17 confirmó el snapshot ANTES uno a uno, y
  además desmintió dos cosas que la sesión traía escritas: que la lista de pepe tenía un item
  preexistente (no: `place_list_items` era 0, el item lo había sembrado el QA) y que
  `hugo.chat_trial_used = 2` había que revertirlo (no: ya era 2). Sin eso, la limpieza habría
  dejado una fila de más y corregido un contador que estaba bien. **El dump no es solo para
  restaurar: es el único registro no editable de cómo estaba el mundo antes.**
- **Qué frenó:** el instrumento otra vez, y por tercera sesión consecutiva — pero con una forma
  nueva. En `INT2-33` la ficha revocada daba **tres** síntomas y **dos eran míos**: buscar el
  substring `kansasgrillandbar.com.ar` matchea igual la web del dueño (`https://…`) que la de
  Overture (`http://www.…`), y buscar `"Cerrado ahora"` daba `true` con un texto que pinta Google,
  no el dueño. Los dos habrían entrado como ❌ contra un comportamiento que funciona bien. La regla
  del § 10.3 los frenó, igual que en las sesiones 1 y 2.
- **Qué cambiar:** una sola, y es hermana de la de la sesión 2. Aquella dijo *"si sembrás por SQL,
  imitá a la app"*; esta agrega el lado de la lectura: **cuando lo que se prueba es "el valor A fue
  reemplazado por B", comparar exacto, nunca `includes`** — porque A y B casi siempre se parecen
  (es el mismo negocio, el mismo teléfono, la misma web) y el substring no discrimina. Ya está
  escrita en `docs/qa/AnalisisQA.md` § *Nota de método* de esta sesión; si hay un QA #3, va al § 10
  del plan junto a las otras dos. _(Lo demás no califica: el `admin_notes` pisado es un cuarto caso
  del patrón que el § 10 ya cubre —capturar valores viejos—, no una regla nueva.)_

## 2026-08-02 · QA integral #2, sesión 2 (bloques C+E) — Opus

- **Qué salió bien:** dos costumbres pagaron solas. **Sembrar el caso duro a propósito** —hacer que
  las votaciones 20 y 21 compartieran `created_at` exacto para que el corte de página cayera justo
  en el empate— convirtió INT2-25 de "mirar 22 títulos" en una prueba del desempate por `id`. Y los
  **controles negativos**: la regla del sábado alcanzó al domingo (INT2-38), pero recién con la misma
  regla puesta en viernes —y Merienda desapareciendo— quedó probado que la causa era el cruce de
  medianoche y no una coincidencia. Un ✅ sin control negativo es media evidencia.
- **Qué frenó:** el instrumento, otra vez. INT2-25 salteó una fila y tenía todo para ser un ❌
  grande contra una promesa explícita del docstring. La causa raíz era real —el cursor viaja en
  milisegundos, `created_at` guarda microsegundos— pero **el sub-milisegundo lo había puesto mi
  siembra**: usé `now()` de Postgres y la app inserta un `Date` de JS. Las 7 votaciones reales de la
  base tienen los microsegundos en cero. Se corrigió la siembra y el caso pasó limpio. Segunda
  sesión consecutiva en que el instrumento fabrica un hallazgo.
- **Qué cambiar:** una sola, y es la generalización de lo anterior: **cuando el QA siembra por SQL
  crudo, la siembra tiene que reproducir la precisión y los defaults que produce la app** — si no,
  se prueba un escenario que en producción no existe. Va al § 10 del plan junto a la regla de
  capturar valores viejos. _(Lo demás no califica: el enunciado viejo de INT2-29 y el gate de ≥50 de
  INT2-26 son correcciones de doc, ya hechas en el QA, no cambios de método.)_

## 2026-08-02 · QA integral #2, sesión 1 (bloques A+B) — Opus

- **Qué salió bien:** arreglar el 🔴 antes de ejecutar (§ 10 bis) obligó a ir al código, y ahí el
  diagnóstico heredado del BACKLOG resultó **sobre-declarado**: el editor precarga tildados *todos*
  los `place_tags` sin distinguir `source`, así que guardar sin tocar no borraba la curaduría — la
  reescribía como `owner`. Pérdida igual de real pero invisible, y con un fix distinto al propuesto.
  Dos `SELECT` más mostraron que **todavía no le había pasado a nadie** (cero lugares afectados): no
  hubo nada que restaurar. Corolario: *un hallazgo escrito ayer merece la misma verificación que un
  síntoma de hoy* — la regla del § 10.3 vale también para lo que ya está anotado en un doc propio.
- **Qué frenó:** poco. Un caso (INT2-13) no era corrible en la configuración de la sesión y el plan
  se contradecía consigo mismo (§ 4 vs § 11); se detectó recién con el panel en pantalla. Corregido
  en el plan. Y el snapshot por conteo del § 9 **no ve un UPDATE que pisa contenido sin cambiar el
  número de filas**: `place_owner_content` de Kansas quedó sobrescrito y solo se recupera del backup
  — quedó anotado a mano en el QA porque el criterio de "listo" del bloque F no lo detecta.
- **Qué cambiar:** una sola cosa, y es barata: **capturar el contenido de las filas que un caso va a
  pisar, no solo el conteo**. Un `SELECT` antes del primer `UPDATE` de setup habría evitado depender
  del `.sql.gz`. No amerita regla nueva en `CLAUDE.md`; sí una línea en el § 9 del plan para las
  sesiones 2 y 3, donde las transiciones pisan bastante más que esta.

## 2026-08-02 · Diseño del QA integral #2 — Opus

- **Qué salió bien:** ir al código a explicar cada "definir expectativa" antes de dejarlo abierto.
  Tres de las cuatro decisiones que iban a quedar pendientes ya estaban resueltas en el código con
  su porqué escrito (el `200` vacío de `GET /api/favoritos`, el `404 SIN_SUSCRIPCION` de cancelar),
  así que se cerraron sin trabajo. Y la cuarta, tirando del mismo hilo, destapó el hallazgo caro
  del día: **`guardarContenido` borra los tags de la curaduría** (`tx.delete(placeTags)` sin filtrar
  por `source`, `lib/negocio/acciones.ts:117`) — 3.967 tags sobre 1.202 lugares que no están en git.
  Confirmado con dos `SELECT`, sin ejecutar un solo caso de QA. También pagó bien el fan-out de
  lectura (3 Explore en paralelo) reservándome el contexto para lo que no se delega: decidir qué
  cruces se descartan y por qué.
- **Qué frenó:** un subagente devolvió `place_favorites`, `poll_lists` y `detail_views` como nombres
  de tabla; **ninguno existe** (son `place_lists`/`place_list_items`, y `detail_views` es una
  *columna* de `place_impressions_daily`). Iban derecho al `DELETE` de la limpieza — o sea, habrían
  fallado justo en el paso que protege el dump que viaja a Neon. Un haiku leyendo specs devuelve
  nombres **plausibles del dominio**, no verificados contra el código, y en prosa se leen igual de
  bien que los correctos.
- **Qué cambiar:** cuando un subagente devuelva **identificadores que después se van a ejecutar**
  (tablas, columnas, endpoints, flags, env vars), verificarlos contra el código antes de escribirlos
  — solo lo ejecutable, no todo el output. Cuesta un grep. Es el complemento del hallazgo del
  2026-08-01: allá el instrumento mentía sobre la pantalla, acá sobre el esquema. Si se repite,
  sube a `CLAUDE.md` § *Paralelismo y orquestación*.

---

## 2026-08-01 · Alias de zonas (CABA sistemático + hitos) — Opus

- **Qué salió bien:** medir antes de proponer. El pedido daba por hecho que los hitos se validaban
  "mismo criterio data-backed que los barrios", y **el catálogo no da para eso**: 5 de 30 probados,
  con Movistar Arena en 0 lugares. Haber corrido esa medición **antes** de preguntarle a Fer
  convirtió una pregunta abierta ("¿te parece paralelizar?") en una decisión con números. Y el
  fan-out adversarial pagó de una forma que no esperaba: no solo aportó cobertura, **detectó
  errores** — los 7 desacuerdos entre agentes fueron exactamente los 7 casos que necesitaban
  arbitraje, y en 3 los dos agentes estaban equivocados.
- **Qué frenó:** **el QA en vivo se auto-engañó y casi ensucia el backlog.** Tipeando con Playwright
  sin hacer click en el campo, el desplegable no aparecía con una zona aplicada, y eso se reportó
  como hallazgo ("el autocompletar no anda en la pantalla de resultados") — incluso con un ítem
  escrito en `BACKLOG.md`. Era falso: el dropdown depende de `enfocado`, que se prende en `onFocus`,
  y Playwright no generaba ese evento porque el input ya era el `activeElement`. Con click explícito
  anda perfecto. Lo que lo cazó fue ir al código a explicar el síntoma **antes** de opinar sobre él;
  si la explicación hubiera quedado en "será deliberado", el ítem falso se quedaba.
- **Qué cambiar:** una sola, chica y concreta: **en QA con Playwright, click en el input antes de
  tipear**. Quedó escrito en `LECCIONES_APRENDIDAS.md` y en la sección de QA, porque es de las que
  se repiten. (El aviso de que `ALIASES` se paga en el prefijo del chat quedó en
  `lib/zones/canon.ts`, arriba de la lista, no en un doc que hay que acordarse de abrir.)

---

## 2026-08-01 · Pulido de UI, sesión B (el historial de /mis-votaciones) — Opus

- **Qué salió bien:** el bloque de las 5 decisiones en el BACKLOG funcionó como spec sin serlo, y
  la decisión 2 justificó sola el haberlo escrito: *"nombre · ganador · fecha suena a `polls`, pero
  ninguno de los dos nombres está ahí"*. Esa trampa —la que convierte "no traigas las opciones de
  las cerradas" en un cambio de queries y no en un `LIMIT`— estaba nombrada **antes** de abrir el
  archivo, con la decisión ya tomada (join por `winnerPlaceId` + 2 opciones y "…"). Implementar fue
  ejecutar. Y el pedido decía "empezá por acá", que era cierto.
- **Qué frenó:** nada de método. El único gasto real fue **sembrar 20 votaciones en la base de dev
  para poder ver el "Ver más" en pantalla** (la primera página se ve con los datos reales, la
  segunda no) — con su borrado verificado al terminar. Es el mismo costo que el QA de DEPLOY pagó
  con `premium_interest`, y en los dos casos la deuda no fue sembrar sino acordarse de limpiar.
- **Qué cambiar:** nada. La receta de "sembrar con marca en el token, verificar el conteo antes y
  después, borrarlo en la misma sesión" ya quedó escrita **dos veces** en `AnalisisQA.md` §
  *Notas de operación*; hacerla regla en `CLAUDE.md` sería una tercera copia de algo que hasta ahora
  se cumplió solo.

---

## 2026-08-01 · Pulido de UI, sesión A (a · b · c) — Opus

- **Qué salió bien:** el triaje que separó los cuatro hallazgos en "mecánicos" y "necesita decisión
  de producto" hizo que esta sesión no tuviera ni una pregunta abierta: los tres ítems ya venían con
  el archivo y el patrón a reusar señalados, así que fueron tres ediciones y el QA. El backlog venía
  escrito con las rutas verificadas contra el código, y ninguna estaba desactualizada. La única
  decisión que quedaba (dónde poner el `← Volver` cuando el renglón del título ya tiene un CTA) el
  propio ítem la anticipaba y pedía explicitarla.
- **Qué frenó:** nada de método. Lo único perdido fueron dos minutos por asumir `npm run typecheck`
  cuando el proyecto nunca tuvo ese script — el hook, `/check` y `/qa-spec` usan `npx tsc --noEmit`
  y son consistentes entre sí. El error fue mío, no del método; no hay nada que agregar.
- **Qué cambiar:** nada. Agregar un alias `typecheck` a `package.json` para tapar un reflejo mío
  sería sumar una segunda forma de invocar lo mismo, justo lo que la regla de *una regla, un dueño*
  desaconseja.

---

## 2026-08-01 · Enriquecimiento del catálogo — medir OSM antes de especear (Opus)

- **Qué salió bien:** el orden del pedido —**medir primero, decidir después, y recién ahí escribir
  spec si el número lo banca**— hizo todo el trabajo. Dos LLMs externos coincidían en que OSM era
  la vía, y coincidían bien: los tags mapean 1:1, es gratis, no es scraping. Lo que ninguno podía
  saber sin medir es que **OSM en AMBA tiene 16.949 lugares y solo 15,5% con horarios**, así que el
  rinde real es 6,7–9,0% del catálogo, con techo medido en ~11%. Sin ese número se escribía un spec
  entero para duplicar una faceta de 5% a 10%. **Un `SELECT` y un cruce mataron dos sesiones de
  trabajo bien intencionado.** De yapa, el cruce rindió algo que no estaba en el plan: OSM funcionó
  como **árbitro independiente** de la curaduría (273 comparaciones, gratis, sin humano) y contestó
  la pregunta de los tags sin cita —92% de acuerdo, mejor que los que sí tienen cita— que iba a
  costar una tarde de validación manual.
- **Qué frenó:** la bajada de Overpass, ~40 minutos y dos corridas perdidas. La primera por un
  detalle del motor (`~"^(a|b|c)$"` hace 504 en tiles densos; la unión con `=` exacto tarda 17 s) y
  la segunda, peor, por un **mirror que devuelve 200 con la base vacía** y contaminó los 64 tiles,
  cacheados en disco como buenos. Se descubrió porque el total era absurdo, no porque el código
  avisara. Está escrito en `LECCIONES_APRENDIDAS.md` § *Un `200 OK` no dice que la respuesta sea
  buena*.
- **Qué cambiar:** nada del método. La única regla nueva que salió es la de la lección (validar el
  payload y no el status cuando la fuente es externa) y ya está escrita donde va. El checklist de
  esta sesión —medición → decisión → registro— se pagó solo.

## 2026-08-01 · DEPLOY — el premium apagado (primer tramo de código de F1) (Opus)

- **Qué salió bien:** el spec traía el gotcha ya resuelto (índices únicos **parciales** porque
  `NULL ≠ NULL`), así que lo único que hubo que hacer fue **verificar el SQL generado** por
  Drizzle antes de aplicarlo — salió con los dos `WHERE` correctos. Escribir esa decisión en el
  spec convirtió un bug sutil de contador inflado en un chequeo de treinta segundos. También pagó
  el precedente: `subscriptions` ya usaba `place_id` nullable como discriminador B2C/B2B, y
  copiarlo evitó inventar un enum de tipo.
- **Qué frenó:** el QA del interruptor **no se puede hacer solo** — el mensaje de beta solo se ve
  con `NEXT_PUBLIC_MP_PUBLIC_KEY` apagada, y como se inlinea en el bundle hay que editar `.env` y
  reiniciar el server, dos cosas que hace Fer. Fueron dos idas y vueltas (apagar, verificar,
  restaurar, re-verificar). Es el costo correcto de haber elegido la env var como único
  interruptor: la alternativa (un flag en `app_settings`) daba un QA cómodo y una segunda fuente
  de verdad sobre lo mismo. **No cambiar nada acá.**
- **Qué cambiar:** una sola cosa, y ya está hecha: **el QA de una feature que escribe en la base
  tiene que limpiar sus filas**. Las 2 de `premium_interest` sobrevivían al dump que se restaura
  en Neon en F0, y prod arrancaba con el contador en 2 — justo el número que decide un gasto de
  US$20/mes (decisión 18). Quedó anotado en `docs/qa/AnalisisQA.md` § *DEPLOY (el premium
  apagado)* → *Notas de operación*, para la próxima corrida de este QA.

---

## 2026-07-31 · Definiciones de deploy — spec DEPLOY escrito, cero código (Fable)

- **Qué salió bien:** medir antes de deliberar. La sesión entró con "el dominio es la puerta de ida
  que bloquea todo" y en tres comandos de DNS quedó claro que `adondesalimos.com.ar` ya estaba
  registrado (zona vacía en Cloudflare, calcada de turnia) — la decisión más pesada de la agenda no
  existía. Mismo patrón con el resto: el tamaño de la base (48 MB), el `prepare:false` que
  `lib/db/index.ts` ya tenía para prod y el kill switch del chat ya probado salieron de mirar, no
  de suponer, y cada uno borró trabajo del plan.
- **Qué frenó:** nada del método. Sí una **omisión mía en la primera vuelta de opciones**: presenté
  "lanzar sin cobro" sin explicar qué ve un usuario que quiere pagar, y Fer tuvo que preguntarlo
  —dos veces, una por el checkout y otra por el tope del chat—. Tenía razón en las dos: la respuesta
  era un `"Configuración de pago incompleta."` que grita que la app está rota. De esa pregunta salió
  la mejor decisión de la sesión (anunciar el premium y **contar** quién lo pide, que convierte el
  apagado en una métrica). Una opción que apaga algo de cara al usuario no está completa sin decir
  qué se ve en su lugar.
- **Qué cambiar:** nada de proceso. Lo de arriba no es una regla nueva, es aplicar la que ya existe
  (`CLAUDE.md` § Recomendación fundada) a un caso que no había aparecido: cuando una opción **apaga**
  una superficie, describir la degradación es parte de la opción, no una aclaración posterior.

## 2026-07-31 · Pase de deuda técnica — (a) y (c) hechos, (b) no era un bug (Opus)

- **Qué salió bien:** el prompt pedía "decilo y justificá" si al mirarlo el fix salía distinto de lo
  planeado, y eso fue exactamente lo que pasó con el ítem (b): dos scripts de diez líneas
  (`toSQL()` + conteos contra la verdad en SQL) mostraron que la premisa heredada del backlog era
  falsa y que refactorizar el motor de búsqueda no arreglaba nada. Sin ese permiso explícito, lo
  más probable era entregar el refactor pedido, con test de regresión y todo.
- **Qué frenó:** nada bloqueante. Dos tropezones míos de un minuto, los dos en scripts descartables:
  `parseSearchParams` toma `t`/`z`, no `tags`/`zones` (el conteo dio el total y por un segundo
  pareció que los filtros no se aplicaban), y la primera anotación de tipo del helper `suma` en
  `costos.ts` era demasiado estrecha (`typeof chatMessages.tokensIn` fija el **nombre** de la
  columna; va `AnyColumn`).
- **Qué cambiar:** apareció recién al final, y es uno solo: **el BACKLOG acumula diagnósticos que
  nadie volvió a medir, y esta sesión encontró tres.** El ítem (b) (un bug que no existía), mi
  propia afirmación sobre el caching escrita *durante* esta sesión (el caché no es por
  conversación — la desarmó una pregunta de Fer una hora después de commitearla), y el ítem #2 de
  la cola, que pedía curaduría para llenar Precio cuando el sugeridor **no puede** llenar Precio
  por decisión de su propio spec. Los tres se cayeron con una medición de diez minutos. **El
  cambio propuesto: antes de agarrar un ítem del backlog, verificar su premisa contra el código o
  la base — no releerlo.** No hace falta una regla nueva: es la lección de esta sesión aplicada a
  la cola, y por eso quedó escrita en `LECCIONES_APRENDIDAS.md` en vez de en el CLAUDE.md.
  (Calibración: tres hallazgos es raro y el CLAUDE.md avisa que suele ser inflado. Acá no lo es —
  los tres cambiaron una decisión concreta y uno ahorró ~US$200.)

---

## 2026-07-31 · CHIPS_ROTACION — los chips de la home rotan por reloj (Opus)

- **Qué salió bien:** **el prompt de arranque no traía la respuesta, traía la pregunta**: avisaba
  que el § Problema del spec ya no describía la home real y exigía consultarlo con Fer **antes** de
  escribir código. Esa consulta (decisión 11) es la diferencia entre entregar la feature y entregar
  un no-op que pasa el QA. También pagó bien el truco de QA: para verificar la rotación se movió
  **la regla**, no el reloj del sistema — y eso de paso *es* ROT-09.
- **Qué frenó:** nada bloqueante. Lo único: el checker independiente encontró que dos casos del DoD
  («martes 15:00», «sábado 15:00») estaban cubiertos por instantes *parecidos* (10:00 y 15:59) pero
  no por el que el criterio nombra. Un minuto de arreglo, y es exactamente para lo que existe el
  maker≠checker.
- **Qué cambiar:** una sola cosa, ya escrita en `LECCIONES_APRENDIDAS.md`: **antes de implementar,
  re-medir contra la base los números con los que el spec se justificó**, y sospechar de todo ID de
  QA que ya pasaría con el código viejo. Es una query, no una regla nueva del método.

## 2026-07-31 · SUGERIR_EN_VOTACION — que el grupo sume lugares (Opus)

- **Qué salió bien:** **el prompt de arranque traía las tres cosas que el spec ya no decía bien**
  (`MAX_OPCIONES` existe y vale 5, FAVORITOS está en `done/`, la migración es la 0012) y ninguna
  costó un minuto de descubrimiento. La más cara era la primera: pisar `MAX_OPCIONES` habría roto
  el alta y el chat en silencio, y en cambio quedaron dos constantes con el porqué escrito. Los 15
  IDs de QA del spec eran ejecutables tal cual: se corrieron todos en vivo sin traducirlos.
- **Qué frenó:** un bug propio — el cierre perezoso de la votación vencida metido **dentro** de la
  transacción, donde el `ROLLBACK` del error de negocio se lo llevaba puesto. Lo cazó un test que
  además del `code` devuelto chequeaba el `status` en la base; sin esa línea pasaba igual. Está en
  `LECCIONES_APRENDIDAS.md` (el efecto que tiene que sobrevivir va fuera de la transacción que va a
  fallar).
- **Qué cambiar:** nada del método. Una nota al CLAUDE.md del proyecto (los dos techos de opciones)
  porque es un gotcha que sorprende, no una regla nueva de trabajo.

## 2026-07-31 · FAVORITOS F2 — ver y organizar lo guardado (Opus)

- **Qué salió bien:** **el handoff de F1 se leyó como una spec y alcanzó.** Las cicatrices que traía
  anotadas (el param `z`, la sesión de Playwright logueada como `pepe` y no como Fer, el server que
  lo levanta Fer) evitaron exactamente las tres pérdidas de tiempo de la sesión anterior — ninguna
  se repitió. Y el pre-vuelo de F1 dejó el terreno tan cerrado que F2 no tuvo que decidir nada de
  producto: las 16 decisiones alcanzaron para todo salvo dos huecos concretos que aparecieron al
  codear (la default ocupando cupo, y el `listId` al sacar desde una lista).
- **Qué frenó:** nada material. Lo único: un checker de `/qa-spec` marcó PARCIAL un criterio que
  estaba bien (dijo que faltaba esconder "renombrar/borrar" a los free, cuando un free **no ve**
  ninguna lista no-default y esos botones nunca se renderizan). Costó un chequeo en vivo
  descartarlo. Es el precio correcto de tener un checker que no confía: prefiero un falso positivo
  barato que un gap que pasa.
- **Qué cambiar:** nada. La regla de "el QA en vivo encuentra lo que los tests no" volvió a pagarse
  (523 tests verdes y el sheet igual había que verlo abrirse en las tres superficies), y el resto
  del método funcionó sin fricción. No hay una sola cosa que valga el cambio esta vez.

## 2026-07-30 (c) · FAVORITOS F1 — guardar lugares (Opus)

- **Qué salió bien:** **el pre-vuelo se pagó solo, y encontró más de lo que había escrito.** Las
  tres preguntas abiertas (P1/P2/P3) se cerraron con Fer en el primer turno, antes de una línea de
  código, y ninguna se re-litigó después. Pero lo que más valió fue leer los archivos que el
  pre-vuelo citaba: `SearchShell` y `ResultsList` son componentes **cliente**, dato que el
  pre-vuelo no tenía y que hacía que la opción (b) de P1 —tocar el motor y pasarle un `userId`— no
  resolviera nada, porque el estado igual tenía que viajar serializado. La pregunta estaba bien
  planteada; una de sus dos opciones era peor de lo que parecía en el papel, y eso solo se ve
  abriendo el archivo.
- **Qué frenó:** perdí tres navegaciones probando `?zones=palermo` y `?zones=villa-crespo` cuando
  el query param se llama **`z`** (`lib/search/params.ts:92`). La home no falla con un param
  desconocido: muestra "Elegí zona para arrancar", que es indistinguible de "no hay resultados", así
  que el primer intento parecía un bug de mi cambio. Es la trampa del QA en vivo sobre una URL
  armada a mano: el deep link es un contrato y no está anotado en ningún lado que se lea antes.
- **Qué cambiar:** nada de método. La única cosa concreta —el mapa de query params de la home— no
  justifica un doc nuevo: se resuelve mirando `serializeSearchParams` antes de tipear una URL, y ya
  quedó anotado acá para la próxima sesión que haga QA en vivo de búsqueda.

## 2026-07-30 (b) · QA en vivo de ABIERTO_AHORA F1 → APROBADO (Opus)

- **Qué salió bien:** **el reloj más barato es el que ya va a cambiar solo.** La sesión arrancó
  19:39 AR (franja `merienda`) y en vez de falsear la hora esperó 13 minutos al cruce natural de
  las 20:00: salió `cena` **y** el borde 19:59→20:00 de la decisión 3 verificado en pantalla, que
  era más de lo que pedía el caso. Verificar contra el estado real gana al estado simulado cuando
  el estado real está a minutos de distancia — conviene mirar el reloj antes de decidir cómo
  falsearlo. Bonus regalado: el browser de Playwright corría **desfasado** (marcaba `desayuno`) y
  el chip aplicó igual la franja del server, o sea la decisión 10 quedó probada sin proponérselo.
- **Qué frenó:** ofrecí un menú de opciones donde una **no era ejecutable por mí**. Le propuse a
  Fer mover el reloj del sistema sin haber verificado antes que podía hacerlo: `Set-Date` pide
  privilegios de admin y falló, después el `Start-Process -Verb RunAs` disparó un cartel de UAC que
  yo no expliqué de antemano — Fer tuvo que frenar la sesión para preguntar qué era eso. Dos turnos
  perdidos y, peor, una decisión que él tomó creyendo que la opción estaba disponible. (El handoff
  de la sesión anterior también daba por hecho que el reloj se podía mover; el supuesto venía de
  arriba, pero verificarlo era mío.)
- **Qué cambiar (una sola):** **antes de ofrecer una opción que depende de una capacidad no
  probada** —elevación, credenciales, red, una API paga— gastar **un** comando en confirmar que
  existe, y avisar en la misma línea si va a abrir un diálogo del sistema. Cuesta un tool call y
  evita que el usuario elija entre opciones que no son reales. No se agrega regla nueva a
  `CLAUDE.md`: es un caso concreto de *pensar antes de codificar* (§ 1 del global, "si hay
  incertidumbre, preguntar") y de la regla de opciones con recomendación, que ya existen.

---

## 2026-07-30 · ABIERTO_AHORA F1 — el chip «Para ahora» (Opus)

- **Qué salió bien:** el spec escrito **eligiendo la forma para que no tocara nada** se pagó solo.
  "El chip se inyecta con la forma de un chip" (decisión 5) hizo que la implementación fueran 70
  líneas nuevas y un cambio de 10 en `chips.ts`, con **cero** cambios en el motor, en los params y
  en el componente — y eso es verificable por `git diff`, así que el DoD se auto-chequea. Un spec
  que además decide *dónde no tocar* deja un DoD que un checker puede probar sin criterio propio.
- **Qué frenó:** dos fricciones de entorno conocidas, ninguna del trabajo. (1) El heredoc
  `<< 'EOF'` para anexar la sección de QA se rompió en Git Bash; funcionó pasar el texto por
  archivo, que es exactamente lo que la regla de commits multilínea del CLAUDE.md global ya manda
  hacer. (2) El `next build` no se pudo correr durante la sesión (dev server levantado, comparten
  `.next`) — y era la tercera sesión seguida que iba a cerrar con el build en deuda.
- **Qué salió de la retro (hecho en la misma sesión):** de los tres puntos que marqué al cerrar, el
  que tenía arreglo salió al toque — **los retiros de tags pasaron a estar declarados en código**
  (`TAGS_RETIRADOS` + `npm run db:retiros`) en vez de vivir en cinco documentos avisando del riesgo.
  Los otros dos son de método y quedan como regla: (a) si el cambio **se ve en pantalla** y el spec
  no lo decidió, una línea con mi recomendación **antes** de escribirlo —lo de "1 + 4 chips" lo
  resolví sola y te lo conté después—; (b) chequear al **arrancar** si el MCP de Playwright está
  cargado, porque esta sesión shippeó un cambio de UI sin ver un píxel y con tu server levantado
  todo el tiempo.
- **Qué cambiar (hecho esta sesión):** en vez de anotar el build como pendiente, **pedí la ventana**
  ("¿parás el dev server dos minutos?") — Fer lo bajó y el build cerró verde en la misma sesión. Es
  el mismo movimiento que el `backup:check` hizo con el backup: convertir una deuda silenciosa en un
  pedido explícito. **Adoptarlo como default de cierre.** Y extender la regla del scratchpad a
  **todo** texto largo que va a un archivo por shell (no solo mensajes de commit): `Write` +
  `cat >>`, nunca heredoc.

## 2026-07-29 · Autoría de los 4 specs de v2 (Opus, sesión pedida para Fable)

- **Qué salió bien:** medir la base **antes** de preguntar cambió la decisión central. "Abierto
  ahora" parecía un mini-spec de un chip; los conteos (tag curado en 20 lugares · horarios de dueño
  en **1** · Google ~US$0,64 por página) mostraron que el tag *miente por construcción* y
  convirtieron la pregunta en una decisión de producto con números. Sin esa medición el spec habría
  salido plausible y equivocado.
- **Qué frenó:** presenté 3 decisiones como un menú de opciones equivalentes, sin marcar cuál
  recomendaba — Fer canceló el `AskUserQuestion` y lo pidió explícito. **Lección:** el criterio lo
  aporto yo, el sí/no lo aporta él (mismo reparto que la regla de fan-out); un menú neutro le
  devuelve el trabajo. Guardado en memoria (`recomendar-siempre-en-las-opciones`).
- **Qué cambiar (hecho esta sesión):** las dos redes que faltaban, contra el drift **docs vs
  DATOS** — que es el que ya se comió dos incidentes. (1) `/consistency-check` gana el **check
  (f)**: cruza docs/reglas contra el runtime (`app_settings`, tags activos en 0, tags retirados con
  filas, tags que el código declara no evaluables **pero tienen filas**, **canario de la curaduría**
  si `source='admin'` bajó de 3.967, y **gates de specs ya cumplidos**), read-only, más el check (g)
  de deuda de backup. (2) `scripts/backup-check.sh` + `npm run backup:check`, llamado solo por el
  hook pre-commit cuando el commit toca `drizzle/` — **avisa, no bloquea**. Verificado en las tres
  ramas del script y del hook. Lección en `LECCIONES_APRENDIDAS.md`. Pendiente como convención (no
  como regla todavía): que los specs con gate numérico **citen la medición con fecha y la consulta**
  — quedó así en ABIERTO_AHORA (§ Evidencia medida + decisión 11) y el check f11 ya lo aprovecha.

## 2026-07-27 · Tuning Chat IA + triaje v2 + redes de seguridad (Opus)

- **Qué salió bien:** diagnóstico con evidencia, no conjetura — un banco de eval (reusa
  prompt+tool+motor reales) cazó la trampa de `precio` (faceta muerta que el prompt empujaba,
  sobre-filtrando "barato" a 0) que llevaba meses invisible. La fuente de verdad en archivos
  (`IDEAS.md`/`BACKLOG`/memoria) hizo trivial el arranque en frío. La encuesta de fin de sesión
  se tradujo en mejoras concretas (backup, eval permanente, reglas nuevas).
- **Qué frenó:** (a) el eval se armó y se borró como temporal antes de notar que valía como
  activo permanente — se recuperó y quedó en `scripts/eval-chat.ts`. (b) El BACKLOG cerraba el
  A/B con "modelo revertido a Haiku", pero el runtime ya era Sonnet 5 → ambigüedad al arrancar.
  **Lección:** el estado de datos (qué modelo corre) se verifica en runtime (`app_settings`), no
  se confía en el doc; se reconcilió la línea.
- **Qué cambiar (hecho esta sesión):** se codificaron en `CLAUDE.md` — fan-out proactivo (Claude
  sugiere, Fer decide), reversibilidad (calibrar cuidado al radio de explosión), una-regla-un-
  dueño (nombrado como valor), y este RETRO. Redes de seguridad nuevas: `backup-db.sh` +
  `eval-chat.ts` (commits `36968e2`, `e16c6a9`).
