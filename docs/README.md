# Documentación A Dónde Salimos

Índice único. **Implementar código:** [`CLAUDE.md`](../CLAUDE.md) en la raíz del repo.

---

## Por rol

| Rol | Empezá por… | Luego… |
|-----|-------------|--------|
| **Agente / dev** | [`CLAUDE.md`](../CLAUDE.md) | Specs activos en [`specs/active/`](specs/active/); manifiesto [`specs/README.md`](specs/README.md); hecho en [`archive/SPECS_ARCHIVO.md`](archive/SPECS_ARCHIVO.md) |
| **QA** | [`qa/AnalisisQA.md`](qa/AnalisisQA.md) | No condensar — IDs y pass/fail son trazabilidad |
| **Ops / local dev** | [`operations/OPERACIONES.md`](operations/OPERACIONES.md) | [`operations/LECCIONES_APRENDIDAS.md`](operations/LECCIONES_APRENDIDAS.md) |
| **Pendientes** | [`product/BACKLOG.md`](product/BACKLOG.md) | — |

---

## Estructura

```
docs/
├── README.md                 ← este archivo
├── AGENTES.md                ← formato de spec + autoría (fuente de verdad del template)
├── product/                  ← estado y cola de trabajo
│   └── BACKLOG.md
├── specs/
│   ├── README.md             ← manifiesto (activo / planned / done)
│   ├── active/
│   ├── planned/
│   └── done/
├── archive/                  ← [se crea al cerrar el 1er spec] SPECS_ARCHIVO.md (resumen)
├── qa/                       ← [se crea con el 1er QA] AnalisisQA.md
├── operations/               ← [se crea cuando haga falta] OPERACIONES.md, LECCIONES_APRENDIDAS.md
├── reference/                ← [se crea cuando haga falta] cómo funciona el producto (estable)
└── security/                 ← [se crea cuando haga falta] auditorías, hardening
```

Las carpetas marcadas **[se crea…]** todavía no existen: nacen con su **primer archivo real**.
No crear archivos vacíos "por completitud" — el lugar está reservado acá, con la regla de qué va.

---

## Tipos de documento (no mezclar)

| Carpeta | Qué va | Qué NO va |
|---------|--------|-----------|
| `specs/` | Contratos de implementación (qué construir, DoD) | Estado de cómo funciona ya; cola de trabajo |
| `reference/` | Cómo funciona el producto **ya construido** (estable) | Decisiones aún no implementadas |
| `operations/` | Correr el proyecto; lecciones aprendidas | Diseño de features |
| `qa/` | Evidencia de QA (pass/fail, IDs trazables) — **nunca borrar histórico** | Diseño; specs |
| `product/` | Cola de trabajo (BACKLOG) — una línea + link al spec | El detalle de diseño (va en `specs/`) |
| `archive/` | Resumen condensado de lo ya implementado | Prompts/schemas largos |
| `security/` | Auditorías, hardening, endpoint audit | — |

Regla: si el spec sigue siendo la referencia para **cambios futuros** en ese dominio, queda en
`active/` aunque parte ya esté implementada.
