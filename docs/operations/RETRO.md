# RETRO — A Dónde Salimos

Retro corta por sesión: **qué salió bien · qué frenó · qué cambiar.** El método que se mejora
solo le gana al método fijo — cada sesión deja al sistema un poco mejor que la anterior. Es el
loop que cierra las encuestas de fin de sesión (antes se perdían con el chat).

**Formato:** una entrada por sesión, **más reciente arriba**. Tres bullets, corto. Si un "qué
cambiar" se implementó, se dice dónde (commit, archivo). No es un diario largo — son 3 líneas.

**De dónde sale el contenido:** las 3 preguntas de cierre de `CLAUDE.md` § *Continuidad entre
sesiones*. **Una sesión sin hallazgos se escribe igual, diciendo que no hubo** — es lo normal, y
llenar el hueco con una mejora inventada agrega reglas que nadie necesitaba.

## Las 3 preguntas de cierre (y por qué son así)

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

> Vivía en `CLAUDE.md` § *Continuidad entre sesiones* hasta el 2026-08-08; se mudó acá —donde se
> usa— para bajarle peso al archivo que se carga en toda sesión. Allá quedaron las 3 preguntas.

---

## 2026-08-16 · PBETA-R5-02/03/05 (chat IA + premium apagado) — Opus

- **Qué salió bien:** el prompt de arranque llegó con el hallazgo **ya desmentido en su mitad
  falsa** (`R5-03` daba por hecho que la probadita se renueva el 1º; `users.chat_trial_used` es de
  por vida), y eso ahorró escribir un copy que mentía. Confirmarlo costó leer 40 líneas de
  `lib/ai/cupo.ts`. **Verificar el dato del hallazgo antes de escribir el copy tendría que ser el
  default, no la excepción**: un QA es una hipótesis con evidencia de pantalla, no una orden.
- **Qué frenó:** dos ramas del fix solo se ven con `cobroApagado() === true` y **no puedo tocar el
  `.env`** (lo bloquea el clasificador, con razón). Se resolvió pidiéndoselo a Fer, pero el pedido
  llegó **a mitad de sesión**, cuando ya había código escrito: con el cobro apagado desde el
  arranque se verificaba todo de una pasada.
- **Qué cambiar:** nada del método. Lo único anotable es de ritmo y ya está dicho arriba: cuando el
  bloque a arreglar toca copy que depende del interruptor del cobro, pedir el apagado **al empezar**
  y no al ir a verificar.

## 2026-08-16 · PBETA-R3-04..07 (guardo un lugar) — Opus

- **Qué salió bien:** los dos hallazgos que chocaban con una decisión escrita en el código se
  llevaron a triaje **antes** de tocar nada, con el texto de esa decisión delante. Los dos se
  resolvieron leyendo el motivo entero en vez de la conclusión: el «no hay toasts» era contra el
  inline en una card, y el «la URL no, que un tercero te guarda un lugar» lo tapa pedir un toque.
  Ninguno de los dos hacía falta revertirlo de prepo.
- **Qué frenó:** parchear `window.fetch` para espiar el alta sin crearla **no funciona con
  better-auth** (usa su propia referencia de fetch): el sign-up salió de verdad y hubo que borrar la
  cuenta. La evidencia buena estaba a un paso — el body del request en la red — y era más simple.
- **Qué cambiar:** nada del método. La lección es de herramienta y ya quedó anotada acá: para ver
  qué manda un cliente que usa su propio fetch, mirar la **red**, no parchear `window.fetch`.

## 2026-08-14 · NAV-01 → spec NAVEGACION (diseño, sin código) — Opus

- **Qué salió bien:** **medir antes de proponer dio vuelta el diagnóstico y encontró un bug que
  nadie buscaba.** El planteo apuntaba a las pantallas; `history.length` toque por toque mostró que
  el eje de pantallas **no crece** y que el que infla es el de filtros (4 de 5 backs son la misma
  pantalla). De paso apareció que abrir una ficha en frío y tocar «Volver» deja `about:blank` — la
  app no tiene camino hacia adentro para quien llega por un link compartido. También se pagó
  verificar la mecánica **antes** de escribirla: `history.state` de Next solo trae internals
  privados y `document.referrer` no cambia en navegación client-side, así que la detección de
  «¿puedo hacer back?» se especeó sabiendo, no suponiendo.
- **Qué frenó:** un tropiezo mío. Quise hacer los 7 backs en **un solo** `browser_evaluate` con un
  loop, y la primera navegación destruyó el contexto de ejecución (*Execution context was
  destroyed*): se perdió el stack medido y hubo que reconstruir el recorrido click por click.
  Costo: ~6 turnos. **Un back cruza un document load: se mide de a uno con
  `browser_navigate_back`, leyendo la URL de cada resultado.** Nada de método estorbó.
- **Qué cambiar:** nada. El caso general —*todo estado que el browser mantiene y la UI no muestra
  se mide en vivo antes de proponer*— ya quedó escrito en `LECCIONES_APRENDIDAS.md`; el detalle del
  loop de Playwright es una cicatriz de herramienta, no una regla de método, y no vale una regla
  nueva.

## 2026-08-14 · PBETA-R1-07 + R1-08 (cuándo abre, y los toques a 44) — Opus

- **Qué salió bien:** **medir el radio antes de decidir convirtió las dos decisiones difíciles en
  fáciles.** `Button` parecía app-wide y un `grep` mostró que lo usan 3 archivos y los 3 son la
  ficha: la pregunta "¿subo el primitivo o parcheo la ficha?" se disolvió sola. Lo mismo del lado
  del dato: el prompt ya traía verificado que `regularOpeningHours` estaba en el field mask, y al
  abrir la respuesta apareció que trae **`periods`** además de las frases — o sea que el fix "caro"
  era cálculo puro sobre algo ya pago. La pregunta a Fer quedó reducida a lo que de verdad era suyo
  (¿Guardar sube en las 5 pantallas? ¿se nombra el día?), con el radio ya medido en cada opción.
- **Qué frenó:** nada de método, y el único tropiezo fue mío: corrí `npm run typecheck` dando por
  hecho que existía y volvió *Missing script*. **No lo nombra ningún doc** — el hook
  (`.claude/hooks/pre-commit-gate.sh:45`) y `/check` siempre usaron `npx tsc --noEmit`; lo inventé
  por costumbre de otros repos. Costo: un turno. Es el mismo patrón que el slug tipeado de la
  sesión del 10: **en este repo los comandos se leen del `package.json`, no se recuerdan.**
- **Qué cambiar:** nada. Lo que sí quedó anotado —y es del producto, no del método— es que traducir
  los `periods` en vez de parsear las frases de Google **unificó sin querer** cómo se ve la semana
  en las dos ramas de la ficha (dueño y Google). No estaba pedido; salió de negarse a escribir una
  segunda regla horaria. Registrado en el BACKLOG para que no se lea como cambio arbitrario.

## 2026-08-10 · PBETA-R1-03 + R1-04 (buffer explicado y techo del scroll) — Opus

- **Qué salió bien:** **decidir las tres cosas de producto antes de abrir un archivo hizo que el
  código saliera de una** — y una de las tres decisiones (explicar el buffer en un renglón en vez de
  card por card) fusionó los dos hallazgos en un solo elemento, así que el fix terminó siendo más
  chico que la suma de las partes. También se pagó leer `is_primary` antes de proponer opciones:
  saber que se **puede** distinguir card por card volvió honesta la comparación entre las dos
  alternativas, en vez de descartarla por "no hay dato".
- **Qué frenó:** nada de método. Un tropiezo propio: probé la multi-zona con el slug inventado
  `chacarita-y-colegiales` (el real es `chacarita-colegiales`) y por un momento leí «2 zonas» con 3
  en la URL como un bug del renglón. Lo desarmó mirar `lib/zones/canon.ts`, 30 segundos. Vale como
  recordatorio de que en este repo **los slugs son contrato y se copian, no se tipean**.
- **Qué cambiar:** nada. Pero queda anotado un hallazgo del QA que no es del método sino de cómo se
  verifica: **`ORDEN_ORGANICO` borró el síntoma de `R1-03` de la primera pantalla sin arreglar el
  problema** (38 de 100 cards siguen siendo del buffer, solo que más abajo). Si el QA se hubiera
  hecho mirando la portada, el hallazgo se cerraba como "ya está". Cuando un fix previo toca el
  **orden**, re-verificar un hallazgo viejo exige bajar la lista, no mirar arriba.

## 2026-08-10 · ORDEN_ORGANICO implementado y cerrado — Opus

- **Qué salió bien:** **el anexo de medición del spec se pagó entero.** La sesión de autoría dejó
  los números crudos con su fecha y esta sesión no re-midió nada del diagnóstico: arrancó
  escribiendo código. Y las dos decisiones que más fácil se rompían venían con su caso de prueba ya
  escrito (ORD-03 para la precedencia, la matriz de `cobertura-chips` para el piso de los chips), así
  que el QA no hubo que inventarlo. Lo que sí agregué fue **verificar que los tests muerden**:
  correr dos mutantes (sacar la banda ⇒ caen 8; invertir la precedencia ⇒ caen 2) antes de darlos por
  buenos. Un test que nunca se vio fallar todavía no es evidencia.
- **Qué frenó:** el heredoc de bash con el markdown de la sección de QA (**acentos + backticks +
  `$`**) tiró `syntax error near unexpected token` — exactamente lo que la regla de `CLAUDE.md` §
  *Texto largo que pasa por el shell* dice que va a pasar. Lo escribí con `Write` a un archivo del
  scratchpad y lo anexé con `cat >>`, que es lo que la regla ya manda. Costo: un turno. **La regla
  está bien; la sesión la salteó** por escribir "un bloque cortito" que resultó de 60 líneas.
- **Adenda del cierre (QA en producción):** el QA en prod encontró **tres** cosas que el deploy no
  lleva y que ninguna avisa — el setting sin sembrar, Neon dos migraciones atrás (con `/admin` →
  Lugares roto desde el deploy de CORRECCION_DATOS) y la corrección de Matienzo que nunca viajó, con
  la ficha mostrando datos de otro negocio. Las tres son la misma cosa: **la mitad de un feature vive
  en datos y los datos no están en git.** Lo destapó comparar un número entre entornos (1.095 vs
  1.094 en Palermo Soho) y no redondear la diferencia. Lección en `LECCIONES_APRENDIDAS.md`.
- **Y lo que salió de ahí vale más que los cuatro arreglos:** después de Matienzo, en vez de seguir
  eligiendo qué mirar, se comparó **el conteo de las 37 tablas** entre dev y prod. Ahí apareció el
  cuarto caso (un chip con los tags viejos, devolviendo 1 lugar en vez de 35 en producción) que
  ninguna de mis diez métricas elegidas a mano había pescado. **El chequeo sistemático encontró lo
  que la intuición no**, cuesta una query, y quedó escrito como el paso de cabecera para el próximo
  deploy que toque datos.
- **Cola del día (`sembrarChips` y la lista de cadenas):** las dos cerradas, y en las dos el patrón
  fue el mismo — **medir antes de decidir**. En `sembrarChips`, escribir el test primero y después
  devolverle el bug al código para ver caer el test correcto. En las cadenas, sospeché que
  `lo de carlitos` y `rincon norteno` eran homónimos y no cadenas; **el dato me desmintió** (19/19 y
  10/10 comparten dominio web propio), y eso cambió la pregunta que había que hacerle a Fer: no
  «¿son cadena?» sino «¿las despriorizás?». Diez minutos de query ahorraron una lista mal armada.
  Lo que quedó sin decidir (4 bodegones) quedó **declarado en código** (`EXCLUIDAS_A_PROPOSITO`) en
  vez de en la cabeza de nadie, así que la próxima corrida del detector no las re-propone como
  novedad.
- **Qué cambiar:** nada del método. Dos cosas quedaron escritas donde van: la de correr el código
  viejo para probar que algo **no** cambió (`git show HEAD:archivo` a un temporal, correr, diffear) y
  la de Drizzle sin calificar la tabla en el `SELECT` — las dos en `LECCIONES_APRENDIDAS.md`, que es
  su lugar, no acá. Lo único que anoto como observación: el DoD del spec puso una **línea absoluta**
  de performance (40 ms) medida en otra máquina, y quedó rozada por 1,5 ms con el índice funcionando
  (−64 %); la decisión no se tomó con el umbral sino con la medición partida, que mostró que la
  mitad cara era otra. Si vuelve a pasar, el umbral conviene escribirlo **relativo** ("que el índice
  baje al menos la mitad"), no absoluto.

---

## 2026-08-10 · Orden orgánico del listado (autoría de spec, sin código) — Fable

- **Qué salió bien:** **medir antes de opinar volvió a cambiar la decisión, y esta vez dos veces.**
  El diagnóstico heredado ("`confidence` premia a las cadenas") era correcto pero no tenía número;
  agruparlo por tamaño de cadena lo convirtió en un mecanismo defendible (**25,8 % vs 6,1 %** de
  fichas con `confidence ≥ 0,99`, 4,2×). Y simular el orden propuesto **antes** de escribirlo
  destapó dos cosas que la intuición daba al revés: la curaduría curó **85 McDonald's y 41
  Starbucks**, así que "curado primero" ponía Starbucks 2º en «Un café» ⇒ la precedencia entre las
  dos señales se invirtió; y la "riqueza de perfil" (website/redes), que parecía la señal obvia de
  un lugar con identidad, **está 2× más presente en las cadenas** que en los lugares únicos ⇒ habría
  agravado el problema. Las dos se descartaron con datos, no con criterio.
- **Qué frenó:** nada relevante. `docker exec … psql` sobre el contenedor `adondesalimos_db`
  alcanzó para las ~15 mediciones (no hay `psql` en el PATH de Windows) y las simulaciones de orden
  salieron con `row_number() over (order by …)` sin tocar una línea de código ni la base.
- **Qué cambiar:** nada. La única cosa que anoto sin proponerla como regla: el spec quedó con un
  **anexo de medición** con los números crudos y su fecha, para que la sesión que implemente no
  tenga que re-medir para entender por qué las bandas están en ese orden — si en el próximo spec
  vuelve a hacer falta, ahí sí es un patrón y se escribe en `AGENTES.md`.

---

## 2026-08-10 · Piso de los chips por zona (implementación del fix) — Opus

- **Qué salió bien:** los tests nuevos **buscan su caso en la base en vez de hardcodearlo** (un
  chip que se lista en AMBA y da 0 en alguna zona, otro que da 1-2), y de paso exigen
  `count(AMBA) > 0` — sin eso `plan-tranqui`, que da 0 en todos lados, los hacía pasar sin probar
  nada. Y el QA en vivo con Playwright confirmó los 5 casos del DoD incluido uno que ningún test
  cubre: apagar el chip pintado en la zona donde da 0 lo saca de la fila, o sea el toggle no queda
  atrapado prendido.
- **Qué frenó:** **el punto 3 del alcance era imposible como estaba escrito.** Asignaba la exención
  del chip pintado a `pintado.ts` + `occasion-chips.tsx` —los dos del cliente—, pero el gate corre
  en el server y **filtra la lista antes de que viaje**: un chip exento tiene que sobrevivir ahí o
  el componente no lo tiene para dibujar. La solución fue barata (que `chips.ts` importe
  `chipsPintados` y reciba también `tagsActivos`, o sea consultarlo sin reimplementarlo, que es lo
  que el detalle pedía), pero costó rehacer el plan a mitad de camino.
- **Qué cambiar:** cuando un ítem decidido liste **archivos a tocar**, tratar esa lista como
  hipótesis y no como parte de la decisión — el diseño de ayer nombró los dos archivos correctos
  del *concepto* (quién es dueño del pintado) y los equivocados de la *mecánica* (dónde corre el
  gate). Cuesta cero: es leer la función que filtra antes de escribir el punto, o directamente
  escribir el ítem en términos de reglas y dejar los archivos para la sesión que implementa.

---

## 2026-08-10 · Piso de los chips por zona (decisión, sin código) — Opus

- **Qué salió bien:** **leer el código antes de elegir entre opciones de producto cambió cuál se
  eligió.** El ítem del BACKLOG traía la matriz medida y seis opciones, pero dos preguntas que
  decidían entre ellas solo las contestaba el código: `app/page.tsx:52` mostró que contar con la
  zona **no cuesta un round-trip** (la home es server component y ya se re-renderiza al elegir
  zona), lo que sacó "es caro" de la mesa; y `occasion-chips.tsx` + `pintado.ts` destaparon un caso
  que **no estaba en ninguna de las seis opciones** — un chip pintado desaparecería de la fila con
  sus tags aplicados. Media hora de lectura evitó especear la opción equivocada.
- **Qué frenó:** nada. La única duda real —¿spec o `fix`?— la resolvió la regla de reversibilidad
  de `CLAUDE.md` sin discusión: sin migración ni dato, revertir es revertir un commit.
- **Qué cambiar:** cuando un ítem 🔵 liste opciones, **separar las dimensiones independientes de
  las alternativas**. Acá "contar con la zona activa" venía con *"con el mismo piso de 20 vacía la
  home"* pegado en el mismo bullet, o sea la opción correcta llegaba a esta sesión pareciendo ya
  refutada — cuando en realidad eran dos ejes (*con qué contexto se cuenta* y *qué piso se aplica*)
  y el problema era el segundo. Cuesta cero: es cómo se escribe el ítem, no una regla nueva.

---

## 2026-08-10 · Redefinición de `salida-con-chongo` (implementación) — Opus

- **Qué salió bien:** el triaje previo dejó el trabajo tan especificado que la implementación fue
  mecánica — y la única decisión que había quedado abierta (¿vuelve a la home?) se resolvió con
  **una consulta de 30 segundos**: los 35 lugares dan **0 en 18 de las 46 zonas**, o sea el problema
  reportado volvía por la ventana. Sin ese conteo por zona, "pasa el piso de 20" habría alcanzado
  para mandarlo a la home. Las dos redes hicieron su trabajo sin ruido: `pintado.test.ts` no
  inventó casos nuevos y `chips.integration.test.ts` fue la prueba de que el reseed dirigido
  funcionó.
- **Qué frenó:** **un script de edición dejó `lib/search/chips.ts` en 0 bytes.** Abrir el destino
  en modo escritura **lo trunca en el acto**, así que cuando el `write` falló —el texto de
  reemplazo tenía un emoji convertido en par de *surrogates*, que UTF-8 no codifica— el archivo ya
  estaba vacío. Se recuperó con `git checkout --` **solo porque todavía no tenía cambios míos**;
  con una edición previa sin commitear, se perdía. Y el surrogate no lo escribí a mano: el escape
  iba duplicado en el heredoc y llegó al archivo a medio desescapar — la misma clase de trampa que
  la regla de `git commit -F`, un backslash que cambia de significado al cruzar el shell.
- **Qué cambiar:** al editar un archivo con un script, **escribir a un `.tmp` y renombrar encima**
  — el destino no se abre para escritura hasta tener el contenido ya codificado, así que un error
  de encoding no puede dejar un archivo vacío. Cuesta dos líneas por script y ya se pagó solo: el
  mismo error volvió dos ediciones después y esa vez murió en el `.tmp`, con el original intacto.

---

## 2026-08-10 · Triaje de dos temas de chips (decisiones, sin código) — Fable

- **Qué salió bien:** las dos decisiones las dio un **dato medido en minutos**, no la
  deliberación — y en los dos casos el dato **contradijo la hipótesis de partida**. (1) Contar
  cuántos chips quedan *tapados* en los 17 estados de un solo toque (**7 de 17**) mostró que
  "tapado" es la mecánica normal del pintado, no la anomalía: eso mató la opción del tercer estado
  visual, que sobre el papel era la más razonable, porque habría reintroducido FB-02. (2) Fer
  reportó que `salida-con-chongo` da 1 lugar *"por `wine-bar`"*; una query mostró que **sin
  `wine-bar` da 0** — el tag sospechado era lo único que lo mantenía vivo, y el culpable era el AND
  de tres facetas con Ambiente al 1%.
- **Qué frenó:** nada del método. El prompt del primer tema traía el hecho medido, las 4 opciones y
  qué leer en orden, así que la sesión no re-derivó nada. Única fricción técnica, menor y ya
  resuelta: `psql` no está en el PATH y el rol no es `postgres` — se consulta con
  `docker exec -i adondesalimos_db psql -U adondesalimos -d adondesalimos -f -` leyendo el SQL de un
  archivo (mismo criterio que `git commit -F`: nada de heredoc con acentos).
- **Qué cambiar:** una sola cosa, y ya está aplicada en los dos ítems del BACKLOG: **antes de
  diseñar el arreglo de un caso raro, medir la frecuencia del caso normal que comparte mecanismo.**
  Es lo que descartó el tercer estado visual, y es lo que convirtió "el chip de Fer da 1 lugar" en
  el hallazgo real — medir por zona mostró que `salida-con-amigos` (38 en AMBA, **en la home**) da
  **0 en Retiro, Recoleta y Monserrat**: el síntoma ya estaba en la portada con otro chip.

## 2026-08-09 · Bug de chips: fix + barrido de las 289 — Opus

- **Qué salió bien.** Escribir el test **antes** del fix y sobre las funciones ya extraídas: falló
  donde tenía que fallar, validó el arreglo candidato en el primer intento y destapó **12 casos**
  en la rama de prender que nadie había reportado. El brief venía con la causa raíz ya trazada y
  el arreglo candidato escrito, así que la sesión no gastó nada en re-investigar.
- **Qué frenó.** Nada material. Única fricción real: correr un script de análisis suelto desde el
  scratchpad no resuelve el alias `@/` de `tsconfig`, así que hubo que copiarlo a la raíz del repo
  para que `tsx` lo levantara. Diez segundos, se menciona por ser concreto.
- **Qué cambiar.** Nada del método. Lo que había para aprender era del código, no del proceso, y
  quedó en `LECCIONES_APRENDIDAS.md`: una regla pura adentro de un componente no es "difícil de
  testear", es inalcanzable, y el precio se cobra en vueltas de QA manual (FB-02 y este bug, mismo
  archivo).

---

## 2026-08-09 · Implementación de CORRECCION_DATOS (mismo día que su autoría) — Opus

- **Qué salió bien:** el spec traía las 20 decisiones cerradas **y** el § *Alcance del código*
  archivo por archivo, así que la sesión no re-decidió nada: el diff final coincide con esa tabla
  y los 9 archivos de la lista «Sin cambios en» tienen **diff vacío**, verificado con un `git diff`
  sobre esa lista exacta. Escribir la lista de intocables en el spec convierte una intención en algo
  que se chequea en un comando.
- **Qué frenó:** nada del método. Dos fricciones técnicas, las dos del entorno y ya conocidas: los
  reemplazos de texto con backticks y `\t` por heredoc de Python fallaron dos veces en
  `import-overture.ts` (se resolvió pasando a manipulación por líneas), y las coordenadas de la
  dirección nueva no salían de Nominatim — quedó anotado en `LECCIONES_APRENDIDAS.md` junto con la
  consulta de Overpass que sí funciona.
- **Qué cambiar:** una sola cosa, y ya está aplicada: **en el QA en vivo de un endpoint, forzar un
  payload inválido y leer el texto que vuelve, no solo el status.** Dos mensajes de error salían en
  inglés con typecheck, 687 tests y build en verde, porque los tests verifican el `code` y nadie lee
  el `message` — que sin embargo se pinta en la pantalla. Cuesta un `fetch` por endpoint. Está en
  `LECCIONES_APRENDIDAS.md` § *El mensaje de un error de validación es copy*.

## 2026-08-09 · Autoría del spec CORRECCION_DATOS (ítem 6 de la cola post-v2) — Opus

- **Qué salió bien:** el ítem 6 del BACKLOG traía marcada la pregunta que **nadie había
  verificado** (qué le hace `formattedAddress` a la facturación por SKU) en vez de dejarla
  implícita, y eso forzó ir a la doc en vez de asumir: se cerró en dos fetches con la cita textual
  —*«billed at the highest SKU applicable»*— y el resultado fue **US$0**, o sea que la decisión 11
  de FICHA pasó de asumida a verificada. Y consultar la fila real con un `SELECT` read-only —en
  vez de leer solo el reporte— destapó lo que **no** estaba reportado: Matienzo tiene
  `google_match_status='matched'`, con un `google_place_id` resuelto a ±300 m del **pin viejo**, así
  que la ficha puede estar mostrando datos de otro negocio. Es la lección de
  `zona-no-adyacente-no-era-bug` otra vez: leer el módulo (y el dato) dueño de la regla, no el
  reporte.
- **Qué frenó:** un turno perdido con `docker exec … psql -U postgres` → `role "postgres" does not
  exist`. El usuario real está en el `DATABASE_URL` del `.env` y el `CLAUDE.md` dice *"Postgres en
  el puerto 5439, en Docker Desktop"* pero no cómo entrar. Nada más: el `Write` para texto largo con
  acentos funcionó de una y el formateador ni se tocó (la regla del retro anterior, aplicada).
- **Qué cambiar:** una sola cosa y es una línea — sumar al bullet de Postgres del `CLAUDE.md` el
  comando que funciona (`docker exec adondesalimos_db psql -U <usuario del .env> -d adondesalimos`).
  Paga en toda sesión de QA, que consulta la base todo el tiempo. ⏳ **Pendiente del OK de Fer** —
  no se tocó el `CLAUDE.md` en esta sesión.

- **Qué salió bien:** el DoD **escrito como medición** («el mapa 100% visible y
  `scrollHeight <= innerHeight`») obligó a medir en vez de mirar, y eso destapó que **el mapa
  colapsaba a 0 px** con typecheck, 663 tests y build en verde: al pasar el contenedor a `flex-1`,
  el `height: 100%` del div interno se quedó sin un alto declarado contra el cual resolver, el
  canvas siguió dibujando desbordado —*se veía bien*— y **los controles dejaron de recibir el
  toque**, o sea que el `GeolocateControl` que el spec venía a agregar no se podía tocar. Lo cazó
  un `elementFromPoint` sobre el botón cuando el clic de Playwright falló, no la captura. Segunda
  vez que el QA en vivo encuentra lo que los tests no; el criterio con número es lo que lo fuerza.
- **Qué frenó:** correr `npx prettier --write` sobre los 3 componentes **sin verificar antes que el
  repo no tiene config de Prettier** (no hay `.prettierrc` ni la dependencia). Con sus defaults
  reformateó los archivos enteros —comillas dobles, punto y coma, otro ancho— y hubo que
  `git checkout` y **rehacer las 17 ediciones**. Adivinar en vez de saber, y el chequeo que lo
  evitaba era un `ls`. (El heredoc de Bash, en cambio, no molestó: los scripts largos fueron a un
  archivo con `Write` desde el arranque. Sí falló un intento por escapes `\r\n` mal anidados, un
  minuto.)
- **Qué cambiar:** una sola cosa y es chica — **antes de correr un formateador o linter con
  `--write`, verificar que el repo declare su config; sin config, no correrlo**. El estilo del
  proyecto no está declarado en ningún lado, así que cualquier herramienta impone el suyo y el diff
  se vuelve ilegible. Cuesta un `ls`/`grep` y va a `~/.claude/CLAUDE.md` § *Principios* como parte
  de "cambios quirúrgicos" (radio grande: aplica a todos los proyectos).
  ✅ **Aplicada el 2026-08-09 con el OK de Fer**, y **de paso se saldó la deuda del heredoc** que
  llevaba cuatro retros anotada: esa sección del global dejó de llamarse *«Mensajes de commit
  multilínea»* y ahora es *«Texto largo que pasa por el shell»*, con la regla explicitada para
  specs, docs, prompts y scripts — el alcance era lo único que fallaba, el contenido ya estaba.
  ⚠️ **`~/.claude` no es un repo git**, así que este renglon es la única traza del cambio: no hay
  commit que mirar. Copia de respaldo previa en el scratchpad de la sesión.

---

## 2026-08-08 · Spec de la Tanda D (MAPA) — Fable

- **Qué salió bien:** las dos decisiones difíciles se resolvieron **midiendo, no opinando**. La 3
  (qué colapsar) dejó de ser una discusión de gusto cuando Playwright devolvió los altos reales
  —bloque 332 px, chips **124** en tres filas, mapa 589 con 395 visibles— y con eso se pudo poner un
  número al lado de cada opción antes de elegir; de paso mató la de pantalla completa por
  costo/beneficio, no por corazonada. La 1 (la cámara) se acotó leyendo el módulo dueño de la regla
  —`serializeApiParams` mete `lat/lng` **solo** con `gps` prendido (`params.ts:131`)— así que el
  "el re-fetch te pisa el centrado" era dos casos, no todos: el mismo método del triaje de feedback.
  Y `flex-1` salió de mirar que el contenedor del mapa **ya** es flex item de `<main>`: cero números
  mágicos donde el camino fácil era un `calc()` con un offset a mano.
- **Qué frenó:** el heredoc de Bash, **cuarta sesión seguida y en el mismo lugar** (`unexpected
  EOF`, escribiendo `planned/MAPA.md`). Esta vez se resolvió al toque con la herramienta `Write` en
  vez de pelear con el shell, así que costó un intento y no media hora — pero el patrón ya no admite
  duda: **todo texto largo en español que pasa por el shell falla**, y la regla que lo arreglaría
  sigue sin aplicarse.
- **Qué cambiar:** nada nuevo. Es literalmente el mismo "qué cambiar" de las tres retros anteriores
  —generalizar la regla de `~/.claude/CLAUDE.md` § *Mensajes de commit multilínea* de "mensajes de
  commit" a "cualquier texto largo que pase por el shell"— que sigue **anotado y no aplicado**.
  Cuatro sesiones pagando el mismo peaje ya no es un hallazgo, es una deuda: toca el CLAUDE.md
  global (radio grande) y necesita el OK de Fer, que es lo único que falta.

## 2026-08-08 · Implementación de la Tanda C (ADMIN_USUARIOS) — Opus

- **Qué salió bien:** el criterio central del DoD estaba escrito **como grep** (*"`grep -rn
  "ownerPlan:" lib/ app/` no devuelve escrituras fuera de los dos helpers"*) y por eso encontró algo
  que la feature no había causado: `lib/billing/baja.ts` escribía `owner_plan` en paralelo al dueño
  único **desde MONETIZACION F2**. Sobrevivió dos specs porque las dos copias hacían exactamente lo
  mismo: ningún test, typecheck ni QA en vivo puede distinguirlas, el drift no existe hasta que una
  cambia. Un criterio en prosa se lo aplica el que implementa a lo que está escribiendo; **un grep se
  lo aplica al repo entero**. Segundo acierto: el QA en vivo mató una promesa que nadie había
  verificado —*«al bajar de plan se ocultan las fotos 4-15»*, que la ficha no hace porque publica una
  sola foto— y que ya estaba **en el copy que ve el admin**, no solo en dos specs.
- **Qué frenó:** nada. El veredicto del QA se escribió dos veces (BLOQUEADO → APROBADO, porque el
  fix heredado llegó en el medio) y eso **no fue un roce, fue el método funcionando**: el registro de
  que arrancó rojo es justamente lo que hace visible la deuda heredada. La regla de *texto largo ⇒
  archivo, nunca heredoc* —el "qué cambiar" de las dos retros anteriores— se aplicó de entrada y
  cortó las tres sesiones seguidas de `unexpected EOF`: **cero peleas con el shell** en una sesión que
  escribió un spec de QA, dos lecciones, un resumen de archivo y dos mensajes de commit largos.
- **Qué cambiar:** nada. Las 3 preguntas de cierre dieron "nada" en las tres, y el único candidato
  que tenía —el veredicto escrito dos veces— no señala un problema del método, así que no se cambia
  nada. Sí quedaron **dos ítems de producto** en el BACKLOG (§ *Salidos de ADMIN_USUARIOS*), que son
  hallazgos del feature y no del método.

## 2026-08-08 · Spec de la Tanda C (ADMIN_USUARIOS) — Fable

- **Qué salió bien:** la decisión más pesada del spec —*¿la cortesía se puede revocar?*— no se
  resolvió con criterio, se resolvió **leyendo el copy que ya está en producción**:
  `suscripcion-panel.tsx:154` dice *«Si lo querés dar de baja, escribinos y lo sacamos»*, o sea que
  el producto ya lo había prometido y la pregunta estaba contestada hace meses. Mismo patrón con el
  discriminante de cortesía (`estado.status === null`, que ya existe): el spec terminó decidiendo
  qué **no** inventar. Los 8 archivos que mandó leer el prompt alcanzaron sin abrir nada más.
- **Qué frenó:** el heredoc de Bash, **tercera sesión seguida y en el mismo lugar** (`unexpected
  EOF` escribiendo el spec). No es un hallazgo nuevo: es que el "qué cambiar" de la retro anterior
  —generalizar la regla de *texto largo ⇒ archivo, no shell* más allá de los mensajes de commit—
  **quedó escrito acá y no se aplicó** en `~/.claude/CLAUDE.md`, que sigue hablando solo de `git
  commit`. Una mejora anotada y no aplicada cuesta lo mismo que no haberla encontrado.
- **Qué cambiar:** nada nuevo — **aplicar la de ayer**. Es una línea en la regla que ya existe
  (`~/.claude/CLAUDE.md` § *Mensajes de commit multilínea*): cambiar el alcance de "mensajes de
  commit" a "cualquier texto largo que pase por el shell". Toca el CLAUDE.md **global** ⇒ radio
  grande ⇒ va con OK de Fer, no de prepo.

## 2026-08-08 · Implementación de la Tanda B (CURADURIA_POR_NOMBRE) — Opus

- **Qué salió bien:** el spec de la sesión anterior funcionó como manual, no como referencia. Sus
  "tres trampas" (la visibilidad que se **omite** en vez de invertirse, el remount con contador, y
  el Enter del buscador) se implementaron de una y las tres se verificaron en vivo sin debuggear
  nada. La extracción a `lib/search/nombre.ts` fue refactor puro: los 24 tests del motor en verde
  antes de tocar la curaduría.
- **Qué frenó:** el mismo heredoc de Bash que frenó la sesión de autoría, otra vez y en el mismo
  lugar — texto largo en español con backticks y comillas (`unexpected EOF`, escribiendo la sección
  de `AnalisisQA.md`). Se resolvió igual: escribir a un archivo del scratchpad y anexar con Python.
  Lo demás no frenó: la cola de curaduría vacía obligó a inyectar una sugerencia a mano para
  `CURNOM-15`, pero eso es el problema que el spec resuelve, no fricción del método.
- **Qué cambiar:** una sola cosa, y es **restar**, no sumar. La regla de commits multilínea de
  `~/.claude/CLAUDE.md` ya dice "para texto largo, archivo + `-F`", pero está escrita **solo** para
  mensajes de commit, así que dos sesiones seguidas la volvieron a aprender con documentación. Vale
  generalizarla a *cualquier* texto largo que pase por el shell (docs, specs, secciones de QA) —
  una línea en la regla que ya existe, sin regla nueva.

## 2026-08-08 · Spec de la Tanda B (CURADURIA_POR_NOMBRE) — Fable

- **Qué salió bien:** el triaje dejó el spec casi escrito. Los cinco archivos que el prompt mandó
  leer alcanzaron para las 3 decisiones sin abrir nada más, y la advertencia *"antes de escribir un
  `LIKE` mirá `lib/search/query.ts`"* pagó al toque: el match por nombre ya existe con acentos y
  typos resueltos, solo que sus helpers son privados ⇒ se extraen, no se clonan.
- **Qué frenó:** nada del método. Una fricción de entorno, ya conocida y con regla escrita: el
  heredoc de Bash se rompió escribiendo el spec (`unexpected EOF`) y hubo que caer a la herramienta
  de escritura. Es la misma familia del gotcha de los mensajes de commit multilínea — para texto
  largo con backticks y comillas, no pasarlo por el shell.
- **Qué cambiar:** nada. La única cosa que apareció escribiendo y que no estaba en el triaje ya
  quedó dentro del spec, no acá: recargar el **mismo** `placeId` no remonta `RevisorLugar`
  (`key={lugar.id}` + `useState` del prop), así que el editor mostraría lo tipeado en vez de lo
  persistido — está anotado en la decisión 2 para que no se descubra debuggeando.

---

## 2026-08-08 · Tanda A del feedback (6 ítems, sin spec) — Opus

- **Qué salió bien:** el triaje del turno anterior funcionó como spec sin serlo — cada ítem venía
  con el archivo, la línea y el gotcha, así que la implementación fue casi mecánica y el orden
  "de más barato a más delicado" mantuvo el gate verde todo el tiempo. Y la advertencia del triaje
  sobre `FB-02` (*separar pintar de togglear o queda un botón muerto*) era **exactamente** el
  problema: se implementó separado desde el primer intento y se verificó en pantalla que un chip
  tapado sigue vivo.
- **Qué frenó:** nada del método. Sí dos cosas del entorno, chicas: los clicks de Playwright sobre
  listas que se re-renderizan (`/votacion/nueva`) no registraban y hubo que disparar el `click()`
  desde `browser_evaluate`; y `FB-07` **no se puede ver en dev**, porque su branch existe solo con
  el cobro apagado (`cobroApagado()` ⇔ falta `NEXT_PUBLIC_MP_PUBLIC_KEY`, que en dev está). Quedó
  declarado en el QA como verificado por código, no en pantalla.
- **Qué cambiar:** una sola cosa, y sale de que **Fer encontró en 30 segundos un bug que mi QA de
  20 criterios dio por PASS**: verifiqué `FB-02-03` mirando la URL y `aria-pressed`, y el resultado
  *era* el que yo había decidido — pero decidí mal. Tocar un chip que se ve apagado y que se apague
  otro es un bug de affordance aunque el estado sea "correcto". **Regla para el próximo QA de UI:
  un criterio no se escribe como "el estado queda en X" sino como "el toque hace lo que el control
  muestra"**; si no se puede enunciar así, el que verifica está copiando la decisión del que
  implementó. (El otro hallazgo, técnico, quedó comentado donde importa: el `touchend` de un
  arrastre corto dispara un `click` igual, así que un gesto nuevo sobre algo clickeable necesita su
  guard — `bottom-sheet.tsx`.)

---

## 2026-08-08 · Triaje del feedback de los primeros usuarios reales (10 ítems) — Opus

- **Qué salió bien:** **triar contra el módulo dueño de la regla, no contra el reporte** — la
  consigna de `zona-no-adyacente-no-era-bug` aplicada de entrada, y pagó cuatro veces. `FB-02` no
  era un bug sino la decisión 18 marcando por subconjunto, y el mecanismo quedó *probado*, no
  supuesto: «Tomar algo» **no** se prende porque le falta `cerveceria`, que es lo que descarta
  cualquier otra explicación. `FB-05` ("falta limpiar") resultó **implementado**, pero adentro del
  sheet y solo para tags. `FB-08` tenía el dato del fix (`esCreador`) **14 líneas arriba del bug**.
  Y `FB-01`, que parecía chocar con el dueño único de `users.plan`, resultó ya previsto por el
  producto (el copy del premium de cortesía existe) y **verificado estable**: `bajarFlagDelPlan`
  siempre parte de una fila de `subscriptions`, así que un cortesía sin suscripción no lo baja
  nadie. Lo mejor: leer `guardarCuraduria` para dimensionar `FB-10` destapó un bug que **nadie
  reportó** — `FACETAS_EDITABLES` incluye `precio`, el editor lo inicializa siempre en "No sé", y
  guardar un lugar ya curado le borra el precio. Hoy no muerde; con `FB-10` pasa a ser el camino
  principal.
- **Qué frenó:** dos veces el mismo tipo de error, las dos escribiendo archivos. (1) Un heredoc de
  Bash falló con `unexpected EOF` por los CRLF de Windows — es exactamente la trampa que `CLAUDE.md`
  §*Mensajes de commit multilínea* ya describe, y la regla estaba escrita solo para `git commit`.
  (2) Peor: al reintentar con Python, `io.open(p,'w')` **truncó `BACKLOG.md` a 0 bytes** y recién
  después murió con `UnicodeEncodeError` (un `🔎` a medias en el reemplazo). Se recuperó
  entero desde `git show HEAD:` + el bloque que estaba en el scratchpad, sin pérdida — pero solo
  porque el trabajo estaba fuera del archivo. **Abrir en `'w'` el archivo de destino antes de tener
  el contenido listo es el error**, no el emoji.
- **Qué cambiar:** una sola cosa, y es de las que **restan**: escribir el contenido a un temporal y
  recién ahí `cp` sobre el destino — nunca `open(destino,'w')` con el texto a mitad de camino. No
  necesita regla nueva en `CLAUDE.md`: es la §*Reversibilidad* aplicada a un archivo (pisar un doc
  de 2.000 líneas es puerta de ida si no está commiteado). Lo que sí vale generalizar de la regla de
  commits multilínea que ya existe: **el problema no es `git commit`, es el heredoc en Windows** —
  para cualquier bloque de texto largo conviene Write al scratchpad y ensamblar, que además deja el
  fragmento reusable si algo falla. Del resto del método, cero fricción: las 4 tandas y las 2
  preguntas a Fer salieron directo del triaje, sin ceremonia de más.

## 2026-08-07 · DEPLOY F1 — la app sale a producción (Vercel + DNS + QA de 21 casos) — Opus

- **Qué salió bien:** **verificar el efecto y no la configuración.** Tres de los cuatro hallazgos
  aparecieron sólo porque se midió lo que la app *hace*, no lo que los paneles *dicen*: el header
  `x-vercel-id` mostró que las funciones corrían en `iad1` con el panel diciendo `gru1` (el
  *Redeploy* no alcanza para un cambio de región); el `Server: Vercel` confirmó que la nube gris
  quedó bien; y el bundle real del deploy —no `.next/static` local— cerró DEPLOY-14. Segundo
  acierto: **leer la doc de Vercel antes de escribir el `maxDuration`**, que reveló que la premisa
  del spec había caducado (Hobby ya da 300 s de default, no 10). Tercero: **usar una cuenta de
  prueba en vez de la de Fer** — desbloqueó DEPLOY-11 y DEPLOY-08, que con la cuenta admin son
  imposibles, y se verificó antes que el gate compara con `===` exacto: si normalizara el `+`,
  DEPLOY-11 habría dado un falso PASS.
- **Qué frenó:** un `grep -oE "^[A-Z_]+="` sobre el `.env` **se comió las cinco `R2_*` porque la
  clase de caracteres no incluía dígitos** y `R2_ACCOUNT_ID` tiene un `2`. Se reportó a Fer que R2
  "no estaba configurado", se escribió el hallazgo falso en el spec y hubo que revertirlo. Lo peor
  no es el regex: **la evidencia para desmentirlo ya estaba en pantalla** —el chequeo de bundle
  había contado "15 vars server-only" cuando la lista mala tenía 10— y no se ató. Un conteo que no
  cierra es una señal, no ruido.
- **Qué cambiar:** nada nuevo al método, y **Fer coincide**: reportó cero fricción de su lado y
  calificó de "excelente" el ritmo de ir **de a poco con los pasos de panel** (un paso, verificar,
  el siguiente). Vale anotarlo como confirmación, no como cambio: ese ritmo atajó **dos
  configuraciones malas antes de aplicarlas** —el `www` como dominio principal y el checkbox de
  "incluir variants"— y las dos habrían costado un rollback en producción. El error de arriba
  tampoco pide una regla —pide leer el propio output—, y agregar "revisá tus regex" al `CLAUDE.md`
  sería exactamente el sesgo aditivo que la pregunta 2 existe para frenar. Lo que sí quedó **escrito en el repo** son dos cicatrices concretas:
  la región vive en `vercel.json` y no en el panel (`d700bba`), y la decisión 4 del spec ahora
  explica por qué.

## 2026-08-03 · PULIDO_BETA F4 — app instalable + alta nueva end-to-end + cierre — Opus

- **Qué salió bien:** **chequear la doc de Chrome antes de dar F4 por hecho.** El DoD pedía "que se
  ofrezca para instalar" y el service worker está en la lista de *v2* del spec: si hubiera sido
  requisito, el criterio era imposible sin salir de scope. Dos minutos de lectura evitaron cerrar
  sobre una suposición. Segundo acierto: **medir el punto (d) en las dos ramas** —misma pestaña y
  pestaña nueva— en vez de una sola; el resultado fue mitad buena noticia (el arreglo de R3-03
  sobrevive a una cuenta nueva, confirmado por la fila en la base en el mismo segundo) y mitad
  hallazgo nuevo. Con una sola rama se habría reportado cualquiera de las dos mitades como si fuera
  toda la verdad.
- **Qué frenó:** el link de verificación **no se podía sacar de la base** — Better Auth firma el
  token y no persiste fila, así que `verification` está vacía. Se perdió un rato buscando un atajo
  que no existe, y hubo que pedirle el link a Fer a mitad del recorrido, cuando debería haberse
  pedido al arrancar y con la aclaración de no clickearlo (el token se quema una sola vez). Anotado
  en `LECCIONES_APRENDIDAS.md` § *Lo que el QA no puede ver por sí solo*.
- **Qué cambiar:** **una sola cosa, y es de método, no de reglas: cuando un QA depende de una acción
  humana, pedirla en el primer turno del tramo, con qué mirar y qué NO tocar.** No hace falta una
  regla nueva en `CLAUDE.md` — la lección ya lo deja escrito y este proyecto tiene pocos flujos que
  dependan de un inbox. **Lo que NO cambio, a propósito:** el `/close-spec` funcionó tal cual está,
  incluidos el HALT por QA PARCIAL y los 3 checkers independientes (el de regresión sobre los 10
  fixes de F3 no lo pide el DoD y es el que evita cerrar sobre código pisado). Sin fricción con el
  método: 1 hallazgo, que es lo normal.

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
