import type { SuscripcionAdmin } from '@/lib/billing/admin'
import type { SubscriptionStatus } from '@/lib/db/schema'

/**
 * Sección Suscripciones de `/admin` (MONETIZACION, decisión 26): tabla read-only.
 * Server component — no hay interacción, solo lectura. La reconciliación es
 * automática (lazy), no hay botones de sync (queda en BACKLOG).
 */

const ETIQUETA_ESTADO: Record<SubscriptionStatus, string> = {
  active: 'Activa',
  past_due: 'Pago pendiente',
  canceled: 'Cancelada',
}

const pesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

const fecha = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })

export function SuscripcionesAdmin({ suscripciones }: { suscripciones: SuscripcionAdmin[] }) {
  if (suscripciones.length === 0) {
    return <p className="text-sm text-muted-foreground">Todavía no hay suscripciones.</p>
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border">
      <table className="w-full min-w-[36rem] text-left text-sm">
        <thead className="bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Quién</th>
            <th className="px-3 py-2 font-medium">Lugar / Tipo</th>
            <th className="px-3 py-2 font-medium">Estado</th>
            <th className="px-3 py-2 font-medium">Monto</th>
            <th className="px-3 py-2 font-medium">Período</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {suscripciones.map((s) => (
            <tr key={s.id}>
              <td className="px-3 py-2 text-foreground">{s.email ?? '—'}</td>
              <td className="px-3 py-2 text-muted-foreground">{s.lugar ?? 'Premium (B2C)'}</td>
              <td className="px-3 py-2 text-muted-foreground">
                {ETIQUETA_ESTADO[s.status]}
                {s.cancelAtPeriodEnd && s.status !== 'canceled' ? ' · se cancela' : ''}
              </td>
              <td className="px-3 py-2 text-muted-foreground">{pesos.format(s.amountArs)}</td>
              <td className="px-3 py-2 text-muted-foreground">
                {fecha.format(s.currentPeriodStart)} → {fecha.format(s.currentPeriodEnd)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
