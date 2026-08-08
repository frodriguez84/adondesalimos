'use client'

import { useState } from 'react'

/**
 * `FB-03` (ADMIN_USUARIOS, decisión 12): copiar de una los mails de Interés en el
 * premium. La lista está para escribirle a esa gente (DEPLOY, decisión 6) — sin
 * forma de copiarla, el contador es un número sin acción.
 *
 * **El rótulo dice cuántos copia, no cuántos hay.** `getInteresadosAdmin()` está
 * topeada en 200 y el total real sale de `contarInteresados()`: "Copiar todos"
 * mentiría. La diferencia contra el total ya la explica el texto de arriba
 * («Abajo, los N más nuevos»).
 *
 * Los `null` del `leftJoin` (usuario borrado) los filtra el server component: acá
 * llegan solo mails reales y `mails.length` **es** la N del rótulo.
 */
export function CopiarMails({ mails }: { mails: string[] }) {
  const [estado, setEstado] = useState<'listo' | 'copiado' | 'error'>('listo')

  async function copiar() {
    try {
      // Separados por `, `: es lo que un cliente de correo acepta pegado en Para/CCO.
      await navigator.clipboard.writeText(mails.join(', '))
      setEstado('copiado')
      window.setTimeout(() => setEstado('listo'), 2000)
    } catch {
      setEstado('error')
    }
  }

  if (mails.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={copiar}
        className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-secondary"
      >
        {estado === 'copiado'
          ? 'Copiado ✓'
          : `Copiar ${mails.length === 1 ? 'el mail' : `los ${mails.length} mails`}`}
      </button>
      {estado === 'error' && (
        <span className="text-xs text-destructive">No pudimos copiar. Probá de nuevo.</span>
      )}
    </div>
  )
}
