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
