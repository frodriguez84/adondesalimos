import { resumirBusqueda } from '@/lib/search/resumen'

/**
 * El renglón que va arriba del listado (PBETA-R1-03 + PBETA-R1-04).
 *
 * **Scrollea con la lista, no queda fijo** (decidido con Fer, 2026-08-10): es
 * contexto de entrada —cuántos hay y de dónde—, no un dato que haga falta a cada
 * segundo, y en 390 px una barra sticky más le come altura a las cards cuando
 * arriba ya hay entre 188 y 443 px de controles.
 *
 * El copy lo arma `lib/search/resumen.ts`, que es puro y se testea sin React.
 */
export function ResultsSummary({
  total,
  zonas,
  gps,
}: {
  /** Total de la búsqueda entera. `null` = todavía no lo sabemos (GPS contando). */
  total: number | null
  /** Nombres de las zonas elegidas, ya resueltos del catálogo. */
  zonas: string[]
  gps: boolean
}) {
  // Sin número no hay renglón: un "0 lugares" acá duplicaría el estado vacío, que
  // ya lo dice mejor y con los chips a mano para sacar (decisión 23).
  if (total === null || total === 0) return null

  const { titulo, aclaracion } = resumirBusqueda({ total, zonas, gps })

  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-sm font-medium text-foreground">{titulo}</p>
      {aclaracion && <p className="text-xs text-muted-foreground">{aclaracion}</p>}
    </div>
  )
}
