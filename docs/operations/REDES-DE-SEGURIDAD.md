# Redes de seguridad — qué existe y cuándo correrlo

> **Normativo.** Extraído de `CLAUDE.md` el 2026-08-08 para bajarle peso al archivo que se carga en
> toda sesión. El resumen de una línea por red vive allá; **el detalle —qué hace cada uno, por qué
> existe y cuándo correrlo— vive acá**, y es lo que hay que leer antes de usar cualquiera de ellos.

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
- **Backup de PRODUCCIÓN** — `scripts/backup-prod.sh` (`npm run backup:prod`). El de arriba
  dumpea **dev**; este dumpea **Neon**, que hasta el 2026-08-10 no tenía ninguna red y ya guarda
  datos que no están en ningún otro lado (el mail de `premium_interest`, las listas de favoritos de
  usuarios reales, las correcciones hechas desde `/admin`). Usa `PROD_DATABASE_URL` (endpoint
  **direct**) y deja el `.sql.gz` en `backups/` con prefijo `NEON_prod_`. ⚠️ **Trae mails y hashes
  de usuarios reales.** Correlo antes de tocar el schema o los datos de prod, y de tanto en tanto.
- **Radiografía de PRODUCCIÓN** — `scripts/prod-check.ts` (`npm run prod:check`). **Read-only**: la
  sesión se abre en `READ ONLY`, así que ni un bug podría escribir. Es el hermano de
  `/consistency-check` para el otro lado: compara migraciones aplicadas contra las del repo,
  `app_settings` clave por clave contra dev, las 9 tablas de catálogo y config, el canario de la
  curaduría, el consumo contra los topes, la antigüedad del último backup de prod y las señales de
  uso. **Sale con código 1 si hay algo**, así que sirve como gate. Existe porque el primer QA en
  producción (2026-08-10) encontró **cuatro** roturas que el deploy no llevaba y **ninguna tiraba un
  error**; dos de las cuatro salieron de comparar conteos entre dev y prod, que es justo lo que esto
  automatiza. Correlo **después de cada deploy que toque datos** y una vez por semana. La rutina
  completa está en [`OPERAR-EN-PRODUCCION.md`](OPERAR-EN-PRODUCCION.md).
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
