import type { SuscripcionAdmin } from '@/lib/billing/admin'
import type { InteresadoAdmin } from '@/lib/billing/interes'
import type { SubscriptionStatus } from '@/lib/db/schema'

/**
 * Sección Suscripciones de `/admin` (MONETIZACION, decisión 26): tabla read-only.
 * Server component — no hay interacción, solo lectura. La reconciliación es
 * automática (lazy), no hay botones de sync (queda en BACKLOG).
 *
 * Con el cobro apagado, arriba va el interés medido (DEPLOY, decisión 6): el
 * conteo **y los mails**, que son a quién se le escribe el día que se abra. Es el
 * número que dispara prender el cobro (decisión 18).
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

export function SuscripcionesAdmin({
  suscripciones,
  interesados,
}: {
  suscripciones: SuscripcionAdmin[]
  interesados: InteresadoAdmin[]
}) {
  return (
    <div className="flex flex-col gap-6">
      <InteresPremium interesados={interesados} />
      {suscripciones.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay suscripciones.</p>
      ) : (
        <TablaSuscripciones suscripciones={suscripciones} />
      )}
    </div>
  )
}

/** El interés medido mientras el cobro está apagado (DEPLOY, decisión 6). */
function InteresPremium({ interesados }: { interesados: InteresadoAdmin[] }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Interés en el premium
      </h3>
      {interesados.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía nadie pidió que le avisemos.</p>
      ) : (
        <>
          <p className="text-sm text-foreground">
            <strong className="text-lg font-semibold">{interesados.length}</strong>{' '}
            {interesados.length === 1 ? 'pidió que le avisemos' : 'pidieron que les avisemos'}.
          </p>
          <ul className="flex flex-col gap-1 rounded-2xl border border-border p-3 text-sm">
            {interesados.map((i) => (
              <li key={i.id} className="flex flex-wrap gap-x-2 text-muted-foreground">
                <span className="text-foreground">{i.email ?? '—'}</span>
                <span>{i.lugar ? `· ${i.lugar}` : '· Premium (B2C)'}</span>
                <span>· {fecha.format(i.createdAt)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function TablaSuscripciones({ suscripciones }: { suscripciones: SuscripcionAdmin[] }) {
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
