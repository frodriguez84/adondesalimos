#!/usr/bin/env bash
#
# Backup del Postgres de dev (contenedor Docker) a un dump comprimido.
#
# POR QUÉ EXISTE: la curaduría (~3.967 tags admin) y cualquier dato de admin/dueño/
# votación NO viven en git ni en el seed — solo en la base (ver CLAUDE.md § Notas
# importantes, gotcha de durabilidad). Un `docker volume rm`, un `db:migrate` sobre base
# limpia o cambiar de máquina los pierde. Este dump es el seguro: con él se restaura todo.
#
# USO:
#   bash scripts/backup-db.sh          (o: npm run backup:db)
#   Correlo ANTES de cualquier operación destructiva sobre la base, y de tanto en tanto.
#
# RESTORE (recuperar desde un dump):
#   gunzip -c backups/adondesalimos_<fecha>.sql.gz | \
#     docker exec -i adondesalimos_db psql -U adondesalimos -d adondesalimos
#
# NOTA: el dump queda en backups/ (gitignoreado — es data, y trae hashes de contraseñas
# de los usuarios de prueba). Para tener copia OFFSITE (sobrevive perder el disco), subir
# el .sql.gz a R2 es el próximo paso; hoy la copia es local a la máquina.

set -euo pipefail

CONTAINER="adondesalimos_db"
DB="adondesalimos"
DB_USER="adondesalimos"
RETENER=14  # cuántos dumps conservar (se borran los más viejos)

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/backups"
mkdir -p "$DIR"

TS="$(date +%Y-%m-%d_%H%M%S)"
OUT="$DIR/${DB}_${TS}.sql.gz"

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "ERROR: el contenedor '${CONTAINER}' no está corriendo. Levantá Docker Desktop." >&2
  exit 1
fi

echo "Dumping ${DB} desde ${CONTAINER} → ${OUT}"
# --no-owner --no-acl: sin esto el dump lleva 62 `OWNER TO adondesalimos`, un rol que solo
# existe en este contenedor. Restaurarlo en cualquier otro Postgres (Neon, otra máquina)
# tira un error por cada uno y esos 62 enmascaran los errores de verdad — pasó al ejecutar
# DEPLOY F0 el 2026-08-03. El restore local no cambia: los objetos quedan del rol que
# conecta, que acá es `adondesalimos` igual.
docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB" --no-owner --no-acl | gzip > "$OUT"
echo "OK: $(du -h "$OUT" | cut -f1) → ${OUT}"

# Retención: conservar solo los últimos $RETENER dumps.
ls -1t "$DIR"/${DB}_*.sql.gz 2>/dev/null | tail -n "+$((RETENER + 1))" | xargs -r rm -f

echo "Backups actuales (más nuevos primero):"
ls -1t "$DIR"/${DB}_*.sql.gz | head
