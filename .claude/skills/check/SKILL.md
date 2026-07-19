---
name: check
description: Gate pre-PR — corre typecheck, tests y build (el build que el hook pre-commit NO corre) y security-review del diff. Invocar como /check antes de abrir PR.
---

# /check — gate pre-PR

Verificación más pesada que el hook pre-commit (que solo corre typecheck + tests). Para
correr **antes de abrir un PR**.

## Procedimiento
1. **Typecheck:** `npx tsc --noEmit`.
2. **Tests:** `npx vitest run`.
3. **Build:** `npm run build` (lo que el hook excluye por lento). Si el proyecto no tiene
   build (ej. librería sin bundler), decilo **N/A**, no inventes uno.
4. **Lint:** `N/A (sin lint configurado todavía)`. Si el proyecto NO tiene linter configurado → **N/A** explícito;
   no fabriques uno.
5. **Seguridad:** corré el skill `security-review` sobre los cambios del branch (priorizá si
   tocaste auth, billing, webhooks, rate limits, o cualquier boundary público).
6. **Reporte:** ✅/❌ por paso. Algún ❌ → no abrir PR hasta arreglar.

## Reglas
- No abrir PR con un paso en ❌.
- Pasos sin herramienta en el proyecto = N/A explícito (no fabricar).
- `git push` sigue en `ask` — el push/PR lo confirma el usuario.
