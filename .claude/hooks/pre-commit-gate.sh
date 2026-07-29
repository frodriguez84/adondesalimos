#!/usr/bin/env bash
# Eval-gate pre-commit.
# Bloquea el commit SOLO si hay codigo staged y el typecheck o los tests fallan.
# Commits solo-docs NO disparan el gate. El build (lento) NO va aca -> gate pre-PR (/check).
#
# Dificil de saltear por diseno:
#   - --no-verify NO tiene efecto: este es un hook de Claude Code (PreToolUse), no un git
#     hook. --no-verify salta los git hooks de .git/hooks, no los de CC.
#   - Path absoluto via $CLAUDE_PROJECT_DIR: con path relativo + cwd != raiz el hook
#     fallaria 127 y CC lo trataria como no-bloqueante (fail-open) -> el commit pasaria
#     sin gate. Por eso forzamos el cwd a la raiz del proyecto.
set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-}" 2>/dev/null || true

# 1) Es un commit? El payload del hook llega por stdin (tool_input.command).
input="$(cat)"
case "$input" in
  *"git commit"*) ;;       # es un commit -> seguir
  *) exit 0 ;;             # cualquier otro comando -> no-op
esac

# 2) Toca migraciones? AVISO, no bloqueo: si el backup de la base esta viejo, decirlo.
#    Una migracion nueva es la senal mas temprana de que alguien va a correr db:migrate, y
#    la curaduria (~3.967 tags admin) NO vive en git ni en el seed: perderla cuesta ~US$17
#    de re-corrida o un restore. El commit del .sql no es el momento destructivo, pero es
#    el ultimo momento barato para acordarse. Por eso avisa y sigue -- bloquear un commit
#    por un backup viejo seria una trampa (y este hook no se puede saltear con --no-verify).
migraciones="$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null | grep -E '^drizzle/' || true)"
if [ -n "$migraciones" ]; then
  if ! aviso="$(bash scripts/backup-check.sh 2>&1)"; then
    echo "AVISO (no bloquea): este commit toca drizzle/ y el backup de la base no esta fresco." >&2
    echo "$aviso" >&2
  fi
fi

# 3) Hay codigo staged? Si no, no gate (docs-only / otros).
#    \.(ts|tsx)$ = patron de archivos de codigo del stack (ej. '\.(ts|tsx)$', '\.py$').
staged="$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null | grep -E '\.(ts|tsx)$' || true)"
[ -z "$staged" ] && exit 0

echo "Eval-gate: hay codigo staged -> corriendo typecheck + tests..." >&2

# 4) Typecheck
if ! tc_out="$(npx tsc --noEmit 2>&1)"; then
  echo "FALLO typecheck -- commit bloqueado. Ultimas lineas:" >&2
  echo "$tc_out" | tail -30 >&2
  exit 2
fi

# 5) Tests
#    OJO dia 0: si todavia NO hay suite, muchos runners salen con codigo != 0 y bloquean
#    TODO commit. --passWithNoTests = flag del runner para pasar sin tests (ej. vitest
#    --passWithNoTests). SACAR este flag cuando el proyecto tenga suite real.
if ! test_out="$(npx vitest run --passWithNoTests 2>&1)"; then
  echo "FALLO tests -- commit bloqueado. Ultimas lineas:" >&2
  echo "$test_out" | tail -30 >&2
  exit 2
fi

echo "OK: typecheck + tests verdes -- commit permitido." >&2
exit 0
