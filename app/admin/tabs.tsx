'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Tabs de `/admin` (PULIDO, decisión 2): el gate `sesionAdmin` y el `Promise.all`
 * de datos siguen viviendo solos en `page.tsx` (server component) — esto es
 * puramente presentación sobre datos ya resueltos, pasados como `children` ya
 * renderizados. Nada de fetch ni de gate acá: una sola ruta, un solo lugar donde
 * un admin puede quedar sin proteger.
 *
 * Orden fijado por decisión 3: Cola primero (la tarea operativa más frecuente),
 * después Precios, Suscripciones y Costos (con el Sugeridor agrupado adentro).
 * Curaduría (CURADURIA, decisión 9) es la quinta, y Usuarios (ADMIN_USUARIOS,
 * decisión 13) la sexta: dar una cortesía es la acción más rara de todo `/admin`, y
 * mover de lugar una tab existente le rompería la memoria muscular a la única
 * persona que usa esta pantalla a cambio de nada.
 */

const TABS = [
  { key: 'cola', label: 'Cola de aprobación' },
  { key: 'precios', label: 'Precios' },
  { key: 'suscripciones', label: 'Suscripciones' },
  { key: 'costos', label: 'Costos' },
  { key: 'curaduria', label: 'Curaduría' },
  { key: 'usuarios', label: 'Usuarios' },
] as const

type TabKey = (typeof TABS)[number]['key']

export function AdminTabs({
  cola,
  precios,
  suscripciones,
  costos,
  curaduria,
  usuarios,
}: Record<TabKey, React.ReactNode>) {
  const [activa, setActiva] = useState<TabKey>('cola')
  const contenido: Record<TabKey, React.ReactNode> = {
    cola,
    precios,
    suscripciones,
    costos,
    curaduria,
    usuarios,
  }

  return (
    <div className="flex flex-col gap-6">
      <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activa === tab.key}
            onClick={() => setActiva(tab.key)}
            className={cn(
              'shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
              activa === tab.key
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div role="tabpanel">{contenido[activa]}</div>
    </div>
  )
}
