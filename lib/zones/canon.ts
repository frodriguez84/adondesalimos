import type { Region } from '@/lib/db/schema'

/**
 * Canon de las 46 zonas de salida de AMBA — fuente única.
 *
 * Lo consumen el build de los GeoJSON, `zones:load`, los tests y (más adelante)
 * el selector de Búsqueda. Los `slug` son **contrato**: viven en URLs
 * compartibles, igual que los slugs de tags. Cambiar uno rompe links.
 *
 * El orden del array es el orden dentro de la región en el selector (`sort`).
 */

export type ZoneCanon = {
  slug: string
  name: string
  region: Region
}

export const ZONAS: readonly ZoneCanon[] = [
  // --- CABA (21) — los 4 de Palermo primero: son la mayor densidad de salidas.
  { slug: 'palermo-soho', name: 'Palermo Soho', region: 'caba' },
  { slug: 'palermo-hollywood', name: 'Palermo Hollywood', region: 'caba' },
  { slug: 'botanico-alto-palermo', name: 'Botánico y Alto Palermo', region: 'caba' },
  { slug: 'las-canitas', name: 'Las Cañitas', region: 'caba' },
  { slug: 'villa-crespo', name: 'Villa Crespo', region: 'caba' },
  { slug: 'chacarita-colegiales', name: 'Chacarita y Colegiales', region: 'caba' },
  { slug: 'villa-urquiza-coghlan', name: 'Villa Urquiza y Coghlan', region: 'caba' },
  { slug: 'belgrano', name: 'Belgrano', region: 'caba' },
  { slug: 'nunez', name: 'Núñez', region: 'caba' },
  { slug: 'saavedra', name: 'Saavedra', region: 'caba' },
  { slug: 'recoleta', name: 'Recoleta', region: 'caba' },
  { slug: 'retiro-microcentro', name: 'Retiro y Microcentro', region: 'caba' },
  { slug: 'puerto-madero', name: 'Puerto Madero', region: 'caba' },
  { slug: 'san-telmo', name: 'San Telmo', region: 'caba' },
  { slug: 'monserrat-congreso', name: 'Monserrat y Congreso', region: 'caba' },
  { slug: 'la-boca-barracas', name: 'La Boca y Barracas', region: 'caba' },
  { slug: 'almagro-boedo', name: 'Almagro y Boedo', region: 'caba' },
  { slug: 'once-abasto', name: 'Once y Abasto', region: 'caba' },
  { slug: 'caballito', name: 'Caballito', region: 'caba' },
  { slug: 'devoto-villa-del-parque', name: 'Villa Devoto y Villa del Parque', region: 'caba' },
  { slug: 'flores-floresta', name: 'Flores y Floresta', region: 'caba' },

  // --- Zona Norte (9)
  { slug: 'olivos-vicente-lopez', name: 'Olivos y Vicente López', region: 'norte' },
  { slug: 'martinez-acassuso', name: 'Martínez y Acassuso', region: 'norte' },
  { slug: 'san-isidro', name: 'San Isidro', region: 'norte' },
  { slug: 'tigre-nordelta', name: 'Tigre y Nordelta', region: 'norte' },
  { slug: 'san-fernando', name: 'San Fernando', region: 'norte' },
  { slug: 'san-miguel-bella-vista', name: 'San Miguel y Bella Vista', region: 'norte' },
  { slug: 'pilar', name: 'Pilar', region: 'norte' },
  { slug: 'escobar', name: 'Escobar', region: 'norte' },
  { slug: 'san-martin-villa-ballester', name: 'San Martín y Villa Ballester', region: 'norte' },

  // --- Zona Oeste (7)
  { slug: 'ramos-mejia-haedo', name: 'Ramos Mejía y Haedo', region: 'oeste' },
  { slug: 'moron-castelar', name: 'Morón y Castelar', region: 'oeste' },
  { slug: 'ituzaingo', name: 'Ituzaingó', region: 'oeste' },
  { slug: 'caseros-tres-de-febrero', name: 'Caseros y Tres de Febrero', region: 'oeste' },
  { slug: 'san-justo', name: 'San Justo', region: 'oeste' },
  { slug: 'moreno', name: 'Moreno', region: 'oeste' },
  { slug: 'merlo', name: 'Merlo', region: 'oeste' },

  // --- Zona Sur (9)
  { slug: 'avellaneda', name: 'Avellaneda', region: 'sur' },
  { slug: 'quilmes', name: 'Quilmes', region: 'sur' },
  { slug: 'lomas-banfield', name: 'Lomas de Zamora y Banfield', region: 'sur' },
  { slug: 'temperley', name: 'Temperley', region: 'sur' },
  { slug: 'lanus', name: 'Lanús', region: 'sur' },
  { slug: 'adrogue-burzaco', name: 'Adrogué y Burzaco', region: 'sur' },
  { slug: 'monte-grande', name: 'Monte Grande', region: 'sur' },
  { slug: 'berazategui', name: 'Berazategui', region: 'sur' },
  { slug: 'florencio-varela', name: 'Florencio Varela', region: 'sur' },
] as const

/** Los conteos del spec. Si el array se desincroniza, los tests lo cazan. */
export const TOTAL_ZONAS = 46
export const ZONAS_POR_REGION: Record<Region, number> = {
  caba: 21,
  norte: 9,
  oeste: 7,
  sur: 9,
}

/** `sort` de una zona = su posición dentro de la región (el array manda). */
export function sortDe(slug: string): number {
  const zona = ZONAS.find((z) => z.slug === slug)
  if (!zona) throw new Error(`Slug de zona desconocido: "${slug}"`)
  return ZONAS.filter((z) => z.region === zona.region).findIndex((z) => z.slug === slug)
}

export const SLUGS = new Set(ZONAS.map((z) => z.slug))

/**
 * Cómo se llaman y en qué orden se despliegan las 4 regiones en el selector de
 * Búsqueda (decisión 9).
 *
 * Viven acá y no junto al catálogo de la DB porque el sheet de zona es un
 * componente cliente: importarlas desde un módulo que toca Postgres arrastraría
 * el driver al bundle del browser. Este archivo solo importa un *tipo*, así que
 * es seguro para las dos mitades.
 */
export const REGION_LABELS: Record<Region, string> = {
  caba: 'CABA',
  norte: 'Zona Norte',
  oeste: 'Zona Oeste',
  sur: 'Zona Sur',
}

export const REGION_ORDER: readonly Region[] = ['caba', 'norte', 'oeste', 'sur']

/**
 * Alias seed — nombres viejos y barrios absorbidos por un merge. Se amplía por
 * curaduría (INSERT) cuando aparezcan búsquedas que no matchean (decisión 19).
 * El matching por partes del nombre compuesto ("Banfield" → "Lomas de Zamora y
 * Banfield") NO necesita alias: lo resuelve el buscador de Búsqueda.
 */
export const ALIASES: readonly { alias: string; slug: string }[] = [
  { alias: 'Villa Ortúzar', slug: 'chacarita-colegiales' },
  { alias: 'Balvanera', slug: 'once-abasto' },
  { alias: 'San Nicolás', slug: 'retiro-microcentro' },
  { alias: 'Villa Devoto', slug: 'devoto-villa-del-parque' },
]
