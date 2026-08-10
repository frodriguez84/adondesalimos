#!/usr/bin/env bash
#
# Backup de PRODUCCIÓN (Neon) a un dump comprimido local.
#
# POR QUÉ EXISTE: `backup-db.sh` dumpea el Postgres de **dev**. Producción no tenía
# ninguna red hasta el 2026-08-10, y ahí ya vivían datos que no están en ningún otro
# lado: el mail de `premium_interest`, las listas de favoritos de usuarios reales y las
# correcciones de datos hechas desde `/admin` (Matienzo). El plan Free de Neon tiene una
# ventana de restore corta, así que un dump propio es la única copia que controlás vos.
#
# USO:
#   bash scripts/backup-prod.sh        (o: npm run backup:prod)
#   Correlo ANTES de tocar el schema o los datos de prod, y de tanto en tanto.
#
# CREDENCIAL: sale de `PROD_DATABASE_URL` en `.env` (gitignoreado). Usá el endpoint
# **direct** de Neon, no el pooled: un `pg_dump` por el pooler puede cortarse.
#
# RESTORE:
#   gunzip -c backups/NEON_prod_<fecha>.sql.gz | \
#     docker exec -i adondesalimos_db psql "$PROD_DATABASE_URL" -v ON_ERROR_STOP=1
#   ⚠️ Restaurar SOBRE producción es puerta de ida. Pensalo dos veces y avisá antes.
#
# NOTA: el dump queda en backups/ (gitignoreado). Trae datos de usuarios REALES —
# mails y hashes de contraseña—, así que no lo compartas ni lo subas a ningún lado
# sin pensarlo. Copia offside (R2) sigue pendiente, igual que para dev.

set -euo pipefail

CONTAINER="adondesalimos_db"   # se usa solo como cliente psql/pg_dump 16, no como base
RETENER=10

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIR="$RAIZ/backups"
mkdir -p "$DIR"

# Se parsea a mano y NO con `set -a; . .env`: los connection strings de Neon llevan
# `&channel_binding=require`, y en un `source` ese `&` manda el comando a background y
# la variable queda vacía. Costó un turno descubrirlo el 2026-08-10.
URL="$(grep -m1 '^PROD_DATABASE_URL=' "$RAIZ/.env" 2>/dev/null | cut -d= -f2- | tr -d '\r' || true)"

if [ -z "$URL" ]; then
  echo "ERROR: falta PROD_DATABASE_URL en .env (endpoint **direct** de Neon)." >&2
  echo "       Ver .env.example. No se dumpeó nada." >&2
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "ERROR: el contenedor '${CONTAINER}' no está corriendo (se usa su pg_dump 16)." >&2
  exit 1
fi

TS="$(date +%Y-%m-%d_%H%M%S)"
OUT="$DIR/NEON_prod_${TS}.sql.gz"

echo "Dumping PRODUCCIÓN (Neon) → ${OUT}"
# Mismo criterio que el de dev: --no-owner --no-privileges para que el dump sea
# restaurable en cualquier Postgres y no en uno con los roles de Neon.
docker exec "$CONTAINER" pg_dump "$URL" --no-owner --no-privileges | gzip > "$OUT"

if ! gzip -t "$OUT"; then
  echo "ERROR: el dump quedó corrupto. NO lo tomes como backup válido." >&2
  exit 1
fi

TABLAS="$(zcat "$OUT" | grep -c '^CREATE TABLE' || true)"
echo "OK: $(du -h "$OUT" | cut -f1) · ${TABLAS} tablas → ${OUT}"

ls -1t "$DIR"/NEON_prod_*.sql.gz 2>/dev/null | tail -n "+$((RETENER + 1))" | xargs -r rm -f

echo "Backups de producción (más nuevos primero):"
ls -1t "$DIR"/NEON_prod_*.sql.gz | head -5
