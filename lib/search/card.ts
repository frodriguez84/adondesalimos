import type { SearchedPlace } from './query'

/**
 * Qué tags muestra una card: el de Tipo + hasta 2 de Actividad o Cocina
 * (diseño de la pantalla, § Card).
 *
 * Vive acá y no en el componente porque es una regla con casos de borde reales
 * —un lugar puede tener 0 tags de Actividad y 6 de Cocina— y así se testea sin
 * montar React.
 */
const MAX_SECUNDARIOS = 2

export function tagsDestacados(tags: SearchedPlace['tags']): string[] {
  const tipo = tags.filter((t) => t.facet === 'tipo').map((t) => t.name)
  const secundarios = tags
    .filter((t) => t.facet === 'actividad' || t.facet === 'cocina')
    .map((t) => t.name)

  // Tipo primero y uno solo: un lugar puede tener más de uno (bar + cervecería)
  // y la card se satura. Los tags vienen ordenados por `sort` desde la query.
  return [...tipo.slice(0, 1), ...secundarios.slice(0, MAX_SECUNDARIOS)]
}

/**
 * Qué dice la card donde va la zona. **Puede no haber zona primaria**: 301
 * lugares publicados caen en el buffer de 400 m sin estar en ningún polígono, y
 * 1.589 no tienen zona ninguna (ZONAS, decisión 17).
 *
 * En ese caso se cae a `locality`, que para esos lugares es justamente el dato
 * que existe (José C. Paz, Laferrere, González Catán…). Si tampoco está, la card
 * no muestra línea de ubicación en vez de mostrar un placeholder vacío.
 */
export function ubicacionDeCard(place: {
  zone: string | null
  locality: string | null
}): string | null {
  return place.zone ?? place.locality ?? null
}
