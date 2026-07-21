'use client'

import type { z } from 'zod'

/**
 * Piezas compartidas por los dos formularios del flujo dueño (AUTH F2): el
 * reclamo de un lugar existente y el alta de uno nuevo. Los dos piden los mismos
 * datos del solicitante — es lo que el admin mira para verificar el vínculo con
 * el negocio (decisión 22).
 *
 * La validación del cliente reusa **los mismos schemas zod que el endpoint**
 * (`lib/claims/validacion.ts`): una sola definición de qué es un dato válido, no
 * una copia acá y otra allá que se separan al primer cambio.
 */

export const inputClass =
  'w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder-muted-foreground/60 transition-colors focus:border-primary/50 focus:outline-none disabled:opacity-60'

export const btnClass =
  'rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50'

/** Errores por campo: `nombre del campo → mensaje`. */
export type Errores = Record<string, string>

/**
 * Traduce los issues de zod a un mapa por campo. Los mensajes de zod están en
 * inglés y son técnicos, así que se muestra uno propio en español por tipo de
 * problema — el detalle exacto ya está en el label del campo.
 */
export function erroresDeZod(error: z.ZodError): Errores {
  const out: Errores = {}
  for (const issue of error.issues) {
    const campo = String(issue.path[0] ?? '')
    if (!campo || out[campo]) continue
    out[campo] = mensajeDeIssue(issue)
  }
  return out
}

function mensajeDeIssue(issue: z.core.$ZodIssue): string {
  if (issue.code === 'too_small') return 'Falta completar este dato.'
  if (issue.code === 'too_big') return 'Es demasiado largo.'
  return 'Revisá este dato.'
}

export function Campo({
  label,
  error,
  hint,
  children,
}: {
  label: string
  error?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

export function Aviso({ tipo, children }: { tipo: 'error' | 'ok'; children: React.ReactNode }) {
  const clases =
    tipo === 'error'
      ? 'border-red-800 bg-red-950/50 text-destructive'
      : 'border-green-800 bg-green-950/50 text-green-400'
  return (
    <div className={`rounded-xl border px-4 py-3 ${clases}`}>
      <p className="text-sm">{children}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Datos del solicitante
// ---------------------------------------------------------------------------

export type DatosSolicitante = {
  applicantName: string
  applicantPhone: string
  applicantRole: string
  comment: string
}

export const SOLICITANTE_VACIO: DatosSolicitante = {
  applicantName: '',
  applicantPhone: '',
  applicantRole: '',
  comment: '',
}

export function CamposSolicitante({
  valores,
  onChange,
  errores,
}: {
  valores: DatosSolicitante
  onChange: (cambio: Partial<DatosSolicitante>) => void
  errores: Errores
}) {
  return (
    <>
      <Campo label="Tu nombre" error={errores.applicantName}>
        <input
          value={valores.applicantName}
          onChange={(e) => onChange({ applicantName: e.target.value })}
          placeholder="Nombre y apellido"
          className={inputClass}
        />
      </Campo>

      <Campo label="Teléfono de contacto" error={errores.applicantPhone}>
        <input
          type="tel"
          value={valores.applicantPhone}
          onChange={(e) => onChange({ applicantPhone: e.target.value })}
          placeholder="11 5555 5555"
          className={inputClass}
        />
      </Campo>

      <Campo
        label="Tu rol en el negocio"
        error={errores.applicantRole}
        hint="Dueño, encargado, socio…"
      >
        <input
          value={valores.applicantRole}
          onChange={(e) => onChange({ applicantRole: e.target.value })}
          placeholder="Dueño"
          className={inputClass}
        />
      </Campo>

      <Campo
        label="Algo que nos ayude a verificarte"
        error={errores.comment}
        hint="Opcional: redes del local, web, lo que quieras contarnos."
      >
        <textarea
          value={valores.comment}
          onChange={(e) => onChange({ comment: e.target.value })}
          rows={3}
          className={inputClass}
        />
      </Campo>
    </>
  )
}
