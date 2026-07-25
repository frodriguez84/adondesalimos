import { ArrowDown, ArrowUp, Minus } from 'lucide-react'

import type { DesgloseEstadisticas, MetricaMensual } from '@/lib/negocio/query'
import type { TapKind } from '@/lib/lugar/tap-kinds'

/**
 * El desglose pago del panel (MONETIZACION F4, decisión 24). Presentacional: los
 * datos y el gate por `owner_plan='paid'` viven en `desgloseEstadisticas`; acá
 * solo se dibuja. Si el lugar es `free`, la página no monta este componente y el
 * dueño se queda con el teaser pelado de AUTH.
 */

/** Copy rioplatense de cada tap (el enum vive en `lib/lugar/tap-kinds`). */
const TAP_LABEL: Record<TapKind, string> = {
  telefono: 'Teléfono',
  como_llegar: 'Cómo llegar',
  website: 'Sitio web',
  redes: 'Redes',
  menu: 'Carta',
}

export function DesglosePanel({ desglose }: { desglose: DesgloseEstadisticas }) {
  const { vistas, impresiones, taps, topFiltros, destaque } = desglose
  const totalTaps = taps.reduce((sum, t) => sum + t.count, 0)

  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-foreground">Estadísticas de tu ficha</h2>
        <p className="text-xs text-muted-foreground">
          El detalle del mes, incluido en tu plan. Todo es agregado: no sabemos quién, solo cuánto.
        </p>
      </div>

      {/* Los dos contadores grandes, con la comparación contra el mes anterior. */}
      <div className="grid grid-cols-2 gap-3">
        <Contador titulo="Visitas a tu ficha" metrica={vistas} />
        <Contador titulo="Apariciones en búsqueda" metrica={impresiones} />
      </div>

      {/* Transparencia del destaque (decisión 20): solo si apareció en alguna búsqueda. */}
      {destaque.apariciones > 0 && (
        <p className="rounded-xl border border-border bg-secondary px-3 py-2 text-xs text-muted-foreground">
          {destaque.destacada > 0 ? (
            <>
              Saliste <strong className="font-semibold text-foreground">destacado</strong> en{' '}
              <strong className="font-semibold text-foreground">{destaque.destacada}</strong> de las{' '}
              <strong className="font-semibold text-foreground">{destaque.apariciones}</strong>{' '}
              búsquedas donde apareciste este mes.
            </>
          ) : (
            <>
              Este mes todavía no saliste destacado en ninguna de las {destaque.apariciones} búsquedas
              donde apareciste.
            </>
          )}
        </p>
      )}

      {/* Taps por tipo: qué tocó la gente. */}
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Qué tocaron en tu ficha
        </h3>
        {totalTaps === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía nadie tocó una acción este mes.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {taps.map((t) => (
              <li key={t.kind} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{TAP_LABEL[t.kind]}</span>
                <span className="font-semibold tabular-nums text-foreground">{t.count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Top de filtros que lo encontraron. */}
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Con qué filtros te encontraron
        </h3>
        {topFiltros.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía nadie te encontró filtrando por una categoría este mes.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {topFiltros.map((f) => (
              <span
                key={f.slug}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-foreground"
              >
                {f.name}
                <span className="font-semibold tabular-nums text-muted-foreground">{f.count}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

/** Un contador grande con su variación contra el mes anterior. */
function Contador({ titulo, metrica }: { titulo: string; metrica: MetricaMensual }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-secondary/40 p-3">
      <span className="text-xs text-muted-foreground">{titulo}</span>
      <span className="text-2xl font-bold tabular-nums text-foreground">{metrica.esteMes}</span>
      <Variacion metrica={metrica} />
    </div>
  )
}

/**
 * La comparación contra el mes anterior (decisión 24). Sin base (el mes pasado
 * fue 0) no se inventa un porcentaje: se dice que es el primer mes con datos.
 */
function Variacion({ metrica }: { metrica: MetricaMensual }) {
  const diff = metrica.esteMes - metrica.mesAnterior

  if (metrica.mesAnterior === 0) {
    return (
      <span className="text-[11px] text-muted-foreground">
        {metrica.esteMes > 0 ? 'Primer mes con datos' : 'Sin datos todavía'}
      </span>
    )
  }

  if (diff === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
        <Minus className="size-3" />
        Igual que el mes pasado
      </span>
    )
  }

  const subió = diff > 0
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] ${
        subió ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
      }`}
    >
      {subió ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
      {subió ? '+' : ''}
      {diff} vs. el mes pasado
    </span>
  )
}
