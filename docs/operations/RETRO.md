# RETRO — A Dónde Salimos

Retro corta por sesión: **qué salió bien · qué frenó · qué cambiar.** El método que se mejora
solo le gana al método fijo — cada sesión deja al sistema un poco mejor que la anterior. Es el
loop que cierra las encuestas de fin de sesión (antes se perdían con el chat).

**Formato:** una entrada por sesión, **más reciente arriba**. Tres bullets, corto. Si un "qué
cambiar" se implementó, se dice dónde (commit, archivo). No es un diario largo — son 3 líneas.

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
