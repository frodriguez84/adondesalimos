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

# 2) Hay codigo staged? Si no, no gate (docs-only / otros).
#    \.(ts|tsx)$ = patron de archivos de codigo del stack (ej. '\.(ts|tsx)$', '\.py$').
staged="$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null | grep -E '\.(ts|tsx)$' || true)"
[ -z "$staged" ] && exit 0

echo "Eval-gate: hay codigo staged -> corriendo typecheck + tests..." >&2

# 3) Typecheck
if ! tc_out="$(npx tsc --noEmit 2>&1)"; then
  echo "FALLO typecheck -- commit bloqueado. Ultimas lineas:" >&2
  echo "$tc_out" | tail -30 >&2
  exit 2
fi

# 4) Tests
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
