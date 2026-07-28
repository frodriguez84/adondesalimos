# RETRO — A Dónde Salimos

Retro corta por sesión: **qué salió bien · qué frenó · qué cambiar.** El método que se mejora
solo le gana al método fijo — cada sesión deja al sistema un poco mejor que la anterior. Es el
loop que cierra las encuestas de fin de sesión (antes se perdían con el chat).

**Formato:** una entrada por sesión, **más reciente arriba**. Tres bullets, corto. Si un "qué
cambiar" se implementó, se dice dónde (commit, archivo). No es un diario largo — son 3 líneas.

---

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
