#!/usr/bin/env bash
#
# ¿Hace cuánto que no se hace backup de la base? Hermano de `backup-db.sh`: ese hace el
# dump, este hace **visible la deuda**.
#
# POR QUÉ EXISTE: `backup-db.sh` es manual y depende de que alguien se acuerde. Lo que
# protege —la curaduría (~3.967 tags admin), reclamos, contenido de dueño, votaciones— NO
# está en git ni en el seed, así que "me olvidé de correrlo" y "perdí el dato" son el mismo
# evento con dos meses de distancia. Este script no arregla el olvido: lo hace ruidoso.
#
# NO hace el backup y NO toca la base (ni la necesita levantada): solo mira `backups/`.
#
# USO:
#   bash scripts/backup-check.sh          (o: npm run backup:check)
#   bash scripts/backup-check.sh 3        (límite propio, en días)
#
# SALIDA: 0 = hay un backup dentro del límite · 1 = viejo o inexistente (con el comando
# para arreglarlo). Nunca bloquea nada por sí solo — quien lo llama decide qué hacer.
#
# LO LLAMAN:
#   - `.claude/hooks/pre-commit-gate.sh` cuando el commit toca `drizzle/` (una migración
#     nueva es la señal más temprana de que alguien va a correr `db:migrate`).
#   - `/consistency-check` (check g), que es el que se corre de tanto en tanto.

set -uo pipefail

DIAS_MAX="${1:-7}"
DB="adondesalimos"

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/backups"

ultimo="$(ls -1t "$DIR"/${DB}_*.sql.gz 2>/dev/null | head -1 || true)"

if [ -z "$ultimo" ]; then
  echo "SIN BACKUP: no hay ningún dump en backups/." >&2
  echo "  La curaduría y todo dato de admin/dueño/votación viven SOLO en el Postgres de dev." >&2
  echo "  Corré: npm run backup:db" >&2
  exit 1
fi

# `stat -c` es GNU (Git Bash / Linux); `stat -f` es BSD (macOS). Se prueban los dos.
mtime="$(stat -c %Y "$ultimo" 2>/dev/null || stat -f %m "$ultimo" 2>/dev/null || echo 0)"
if [ "$mtime" = "0" ]; then
  echo "AVISO: no se pudo leer la fecha de $ultimo — chequealo a mano." >&2
  exit 0  # no inventamos una alarma por no poder medir
fi

dias=$(( ( $(date +%s) - mtime ) / 86400 ))
nombre="$(basename "$ultimo")"

if [ "$dias" -gt "$DIAS_MAX" ]; then
  echo "BACKUP VIEJO: el último es de hace ${dias} día(s) (límite ${DIAS_MAX}) → ${nombre}" >&2
  echo "  Corré: npm run backup:db" >&2
  exit 1
fi

echo "Backup OK: hace ${dias} día(s) → ${nombre}"
exit 0
