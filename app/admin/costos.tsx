import type {
  CostosChat,
  CupoChat,
  EstadoAlerta,
  SugerenciaPrecio,
  UsoSku,
} from '@/lib/admin/costos'

/**
 * Sección Costos de `/admin` (COSTOS_ADMIN, decisión 11): server components
 * read-only, sin `'use client'` (no hay interacción en v1). Presenta los agregados
 * de `lib/admin/costos.ts`; nada de SQL ni fetch acá.
 *
 * Formateo `Intl.NumberFormat` es-AR: USD con 2 decimales, ARS sin. Copy en
 * rioplatense.
 */

const usd = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const pesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})
const num = new Intl.NumberFormat('es-AR')
const fecha = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })

/** Clase de texto según el estado de alerta (decisión 6). */
function claseEstado(estado: EstadoAlerta): string {
  if (estado === 'rojo') return 'text-red-600 dark:text-red-500'
  if (estado === 'amarillo') return 'text-amber-600 dark:text-amber-500'
  if (estado === 'apagado') return 'text-muted-foreground'
  return 'text-foreground'
}

/** El texto del % del cap, o "apagado" si el cap está en 0. */
function textoConsumo(porcentaje: number, estado: EstadoAlerta): string {
  if (estado === 'apagado') return 'apagado'
  return `${num.format(Math.round(porcentaje))}%`
}

// ---------------------------------------------------------------------------

export function CostosAdmin({
  chat,
  google,
  cupo,
}: {
  chat: CostosChat
  google: UsoSku[]
  cupo: CupoChat
}) {
  return (
    <div className="flex flex-col gap-6">
      {/* Chat IA en USD por modelo */}
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Chat IA (Anthropic) — USD por modelo
        </h3>
        {chat.porModelo.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            Todavía no hubo mensajes del chat.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Modelo</th>
                  {/* El caché va aparte a propósito: `in` es el remanente NO
                      cacheado y los de caché igual se cobran (0,1× / 1,25×). */}
                  <th className="px-3 py-2 font-medium">Tokens (in / out / caché)</th>
                  <th className="px-3 py-2 font-medium">Este mes</th>
                  <th className="px-3 py-2 font-medium">Mes anterior</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {chat.porModelo.map((m) => (
                  <tr key={m.model}>
                    <td className="px-3 py-2 text-foreground">{m.model}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {num.format(m.esteMes.tokensIn)} / {num.format(m.esteMes.tokensOut)} /{' '}
                      {num.format(m.esteMes.cacheRead + m.esteMes.cacheCreation)}
                    </td>
                    <td className="px-3 py-2 text-foreground">{usd.format(m.esteMes.costoUsd)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{usd.format(m.mesAnterior.costoUsd)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-border bg-secondary/50 text-sm font-semibold">
                <tr>
                  <td className="px-3 py-2 text-foreground" colSpan={2}>
                    Total
                  </td>
                  <td className="px-3 py-2 text-foreground">{usd.format(chat.totalMesUsd)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{usd.format(chat.totalPrevUsd)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Google por SKU */}
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Google Places — requests vs cap
        </h3>
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">SKU</th>
                <th className="px-3 py-2 font-medium">Este mes</th>
                <th className="px-3 py-2 font-medium">Cap</th>
                <th className="px-3 py-2 font-medium">Consumo</th>
                <th className="px-3 py-2 font-medium">USD estimado</th>
                <th className="px-3 py-2 font-medium">Mes anterior</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {google.map((s) => (
                <tr key={s.sku}>
                  <td className="px-3 py-2 text-foreground">{s.label}</td>
                  <td className="px-3 py-2 text-muted-foreground">{num.format(s.esteMes)}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {s.cap <= 0 ? '—' : num.format(s.cap)}
                  </td>
                  <td className={`px-3 py-2 font-medium ${claseEstado(s.estado)}`}>
                    {textoConsumo(s.porcentaje, s.estado)}
                  </td>
                  <td className="px-3 py-2 text-foreground">{usd.format(s.costoUsd)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{num.format(s.mesAnterior)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Los primeros 1.000 requests de cada SKU son gratis; el USD estimado descuenta ese tier.
        </p>
      </div>

      {/* Cupo del chat */}
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Cupo del chat — mensajes vs tope global
        </h3>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-xl border border-border bg-card px-4 py-3 text-sm">
          <span className="text-foreground">
            Este mes: <strong>{num.format(cupo.esteMes)}</strong>
            {cupo.cap <= 0 ? '' : ` de ${num.format(cupo.cap)}`}{' '}
            <span className={`font-medium ${claseEstado(cupo.estado)}`}>
              ({textoConsumo(cupo.porcentaje, cupo.estado)})
            </span>
          </span>
          <span className="text-muted-foreground">Mes anterior: {num.format(cupo.mesAnterior)}</span>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

export function SugeridorPrecio({ sugerencia }: { sugerencia: SugerenciaPrecio }) {
  const { precioActual, cotizacion } = sugerencia

  // Sin cotización: el bloque avisa y no rompe la page (decisión 9).
  if (!cotizacion) {
    return (
      <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        No pudimos consultar la cotización del dólar. El precio vigente es{' '}
        <strong className="text-foreground">{pesos.format(precioActual)}</strong>; probá de nuevo
        más tarde para ver la sugerencia.
      </div>
    )
  }

  const refDolar = (
    <p className="text-xs text-muted-foreground">
      Dólar oficial {pesos.format(cotizacion.venta)} (cotización del {fecha.format(cotizacion.fecha)}
      ) · precio vigente {pesos.format(precioActual)}. Piso = dólar × 3.
    </p>
  )

  // Cubre el piso: línea verde con el margen (decisión 10).
  if (sugerencia.cubre) {
    const margen = sugerencia.margen
    return (
      <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-medium text-foreground">
          El precio cubre el piso
          {typeof margen === 'number' ? ` (${num.format(Math.round(margen * 10) / 10)}× el piso de ${pesos.format(sugerencia.piso ?? 0)})` : ''}
          .
        </p>
        {refDolar}
      </div>
    )
  }

  // Por debajo del piso: banner de alerta con el precio sugerido (decisión 10).
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-destructive/50 bg-destructive/10 p-4">
      <p className="text-sm font-semibold text-destructive">
        Ojo: el precio quedó por debajo del piso.
      </p>
      <p className="text-sm text-foreground">
        Sugerido: <strong>{pesos.format(sugerencia.sugerido ?? 0)}</strong> (piso{' '}
        {pesos.format(sugerencia.piso ?? 0)}). Cambialo a mano en la sección Precios de arriba.
      </p>
      {refDolar}
    </div>
  )
}
