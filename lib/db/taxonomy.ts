import type { Facet } from './schema'

/**
 * Taxonomía canónica: 96 tags + 9 padres de Cocina = 105 filas.
 *
 * ⚠️ Los `slug` son CONTRATO — Búsqueda y Ficha filtran por ellos y viven en
 * URLs compartibles. No renombrar sin migración. Los `name` sí son libres (son
 * labels de UI).
 *
 * Fuente: spec CATALOGO § "Datos semilla". Sin `heladeria` ni `panaderia`:
 * excluidas por el principio "salida vs compra".
 */

export type SeedTag = {
  slug: string
  name: string
  /** Solo Cocina: slug del padre filtrable. */
  parent?: string
  /** Solo Actividad/Ambiente: agrupa la UI, no filtra. */
  group?: string
}

export const TIPO: SeedTag[] = [
  { slug: 'restaurante', name: 'Restaurante' },
  { slug: 'bar', name: 'Bar' },
  { slug: 'cerveceria', name: 'Cervecería' },
  { slug: 'cafe', name: 'Café' },
  { slug: 'wine-bar', name: 'Wine bar / vinoteca' },
  { slug: 'boliche', name: 'Boliche' },
  { slug: 'patio-gastronomico', name: 'Patio gastronómico / food hall' },
  { slug: 'teatro-espacio-cultural', name: 'Teatro / espacio cultural' },
  { slug: 'club-de-juegos', name: 'Club de juegos' },
  { slug: 'centro-entretenimiento', name: 'Centro de entretenimiento' },
]

/** Los 9 padres filtrables de Cocina. */
export const COCINA_PADRES: SeedTag[] = [
  { slug: 'argentina', name: 'Argentina' },
  { slug: 'italiana', name: 'Italiana' },
  { slug: 'asiatica', name: 'Asiática' },
  { slug: 'india-medio-oriente', name: 'India y Medio Oriente' },
  { slug: 'latinoamericana', name: 'Latinoamericana' },
  { slug: 'europea', name: 'Europea' },
  { slug: 'americana', name: 'Americana' },
  { slug: 'dulce-y-cafe', name: 'Dulce y café' },
  { slug: 'dietas', name: 'Dietas' },
]

/** Los 37 hijos de Cocina. */
export const COCINA_HIJOS: SeedTag[] = [
  { slug: 'parrilla', name: 'Parrilla', parent: 'argentina' },
  { slug: 'bodegon', name: 'Bodegón', parent: 'argentina' },
  { slug: 'milanesas', name: 'Milanesas', parent: 'argentina' },
  { slug: 'empanadas', name: 'Empanadas', parent: 'argentina' },
  { slug: 'nortena-locro', name: 'Norteña / locro', parent: 'argentina' },

  { slug: 'pizza', name: 'Pizza', parent: 'italiana' },
  { slug: 'pastas', name: 'Pastas', parent: 'italiana' },
  { slug: 'trattoria', name: 'Trattoria', parent: 'italiana' },

  { slug: 'japonesa-sushi', name: 'Japonesa / sushi', parent: 'asiatica' },
  { slug: 'ramen', name: 'Ramen', parent: 'asiatica' },
  { slug: 'china', name: 'China', parent: 'asiatica' },
  { slug: 'coreana', name: 'Coreana', parent: 'asiatica' },
  { slug: 'tailandesa', name: 'Tailandesa', parent: 'asiatica' },
  { slug: 'vietnamita', name: 'Vietnamita', parent: 'asiatica' },

  { slug: 'india', name: 'India', parent: 'india-medio-oriente' },
  { slug: 'pakistani', name: 'Pakistaní', parent: 'india-medio-oriente' },
  { slug: 'arabe', name: 'Árabe', parent: 'india-medio-oriente' },
  { slug: 'armenia', name: 'Armenia', parent: 'india-medio-oriente' },
  { slug: 'turca', name: 'Turca', parent: 'india-medio-oriente' },

  { slug: 'peruana', name: 'Peruana', parent: 'latinoamericana' },
  { slug: 'mexicana', name: 'Mexicana', parent: 'latinoamericana' },
  { slug: 'venezolana', name: 'Venezolana', parent: 'latinoamericana' },
  { slug: 'colombiana', name: 'Colombiana', parent: 'latinoamericana' },
  { slug: 'boliviana', name: 'Boliviana', parent: 'latinoamericana' },
  { slug: 'brasilena', name: 'Brasileña', parent: 'latinoamericana' },

  { slug: 'espanola-tapas', name: 'Española / tapas', parent: 'europea' },
  { slug: 'francesa', name: 'Francesa', parent: 'europea' },
  { slug: 'alemana', name: 'Alemana', parent: 'europea' },

  { slug: 'hamburguesas', name: 'Hamburguesas', parent: 'americana' },
  { slug: 'bbq-costillas', name: 'BBQ / costillas', parent: 'americana' },

  // `pasteleria` es un tag de Cocina válido aunque hoy no tenga lugares; se
  // mantiene por completitud de la taxonomía (ya no lo usa ningún chip: al ser
  // Cocina ANDea y cero-eaba la Merienda — ver `lib/db/chips.ts`).
  { slug: 'pasteleria', name: 'Pastelería', parent: 'dulce-y-cafe' },
  { slug: 'cafe-especialidad', name: 'Café de especialidad', parent: 'dulce-y-cafe' },

  { slug: 'vegetariana', name: 'Vegetariana', parent: 'dietas' },
  { slug: 'vegana', name: 'Vegana', parent: 'dietas' },
  { slug: 'sin-tacc', name: 'Sin TACC', parent: 'dietas' },
  { slug: 'kosher', name: 'Kosher', parent: 'dietas' },
  { slug: 'halal', name: 'Halal', parent: 'dietas' },
]

export const ACTIVIDAD: SeedTag[] = [
  { slug: 'stand-up', name: 'Stand-up', group: 'Escenario' },
  { slug: 'musica-en-vivo', name: 'Música en vivo', group: 'Escenario' },
  { slug: 'open-mic', name: 'Open mic', group: 'Escenario' },
  { slug: 'teatro', name: 'Teatro', group: 'Escenario' },
  { slug: 'pena-folclorica', name: 'Peña folclórica', group: 'Escenario' },

  { slug: 'dj', name: 'DJ', group: 'Baile' },
  { slug: 'milonga-tango', name: 'Milonga / tango', group: 'Baile' },
  { slug: 'salsa-bachata', name: 'Salsa / bachata', group: 'Baile' },
  { slug: 'fiesta-tematica', name: 'Fiesta temática', group: 'Baile' },

  { slug: 'juegos-de-mesa', name: 'Juegos de mesa', group: 'Juegos' },
  { slug: 'pool-metegol-dardos', name: 'Pool / metegol / dardos', group: 'Juegos' },
  { slug: 'trivia', name: 'Trivia', group: 'Juegos' },
  { slug: 'arcade', name: 'Arcade', group: 'Juegos' },
  { slug: 'bowling', name: 'Bowling', group: 'Juegos' },
  { slug: 'escape-room', name: 'Escape room', group: 'Juegos' },

  { slug: 'karaoke', name: 'Karaoke', group: 'Participar' },
  { slug: 'catas-degustaciones', name: 'Catas / degustaciones', group: 'Participar' },

  { slug: 'futbol-en-pantalla', name: 'Fútbol en pantalla', group: 'Mirar' },
  { slug: 'proyecciones-cine', name: 'Proyecciones / cine', group: 'Mirar' },
]

export const AMBIENTE: SeedTag[] = [
  { slug: 'tranqui', name: 'Tranqui', group: 'Vibra' },
  { slug: 'movido', name: 'Movido', group: 'Vibra' },
  { slug: 'romantico', name: 'Romántico', group: 'Vibra' },
  { slug: 'grupos-grandes', name: 'Grupos grandes', group: 'Vibra' },
  { slug: 'aire-libre', name: 'Aire libre', group: 'Vibra' },
  { slug: 'terraza-rooftop', name: 'Terraza / rooftop', group: 'Vibra' },
  { slug: 'con-vista', name: 'Con vista', group: 'Vibra' },
  { slug: 'speakeasy', name: 'Speakeasy', group: 'Vibra' },
  { slug: 'tematico', name: 'Temático', group: 'Vibra' },
  { slug: 'bar-notable', name: 'Bar notable', group: 'Vibra' },

  { slug: 'pet-friendly', name: 'Pet friendly', group: 'Servicios' },
  { slug: 'kids-friendly', name: 'Kids friendly', group: 'Servicios' },
  { slug: 'accesible', name: 'Accesible', group: 'Servicios' },
  { slug: 'wifi-trabajar', name: 'Wi-Fi para trabajar', group: 'Servicios' },
  { slug: 'estacionamiento', name: 'Estacionamiento', group: 'Servicios' },
  { slug: 'reserva-necesaria', name: 'Reserva necesaria', group: 'Servicios' },
  { slug: 'lgbtq-friendly', name: 'LGBTQ+ friendly', group: 'Servicios' },
]

/** Los cortes en ARS no viven acá sino en `app_settings.pricing.band_limits`. */
export const PRECIO: SeedTag[] = [
  { slug: 'precio-1', name: '$' },
  { slug: 'precio-2', name: '$$' },
  { slug: 'precio-3', name: '$$$' },
  { slug: 'precio-4', name: '$$$$' },
]

export const MOMENTO: SeedTag[] = [
  // `abierto-ahora` sigue sembrado (es parte de la taxonomía decidida) pero está
  // **retirado**: `active = false` en la base desde ABIERTO_AHORA F1 (decisión 10).
  // No puede evaluarse contra `place_tags` —un booleano estático para un concepto
  // que depende de la hora en que uno mira— y la curaduría se lo había asignado a
  // 20 lugares, así que filtrar por él a las 4 de la mañana mentía. Sus filas de
  // `place_tags` NO se borraron (ocultar ≠ borrar): con `active = false` ya
  // desaparece del sheet, de las cards, de la ficha y del sugeridor de curaduría,
  // y un link viejo con `?t=abierto-ahora` sigue funcionando (lo ignora
  // `filtrosDeTags`). La necesidad real la atiende el chip «Para ahora»
  // (`lib/search/ahora.ts`); el abierto de verdad es la F2, gateada en tener masa
  // de horarios propios de dueño. Reactivar = `UPDATE tags SET active = true`.
  { slug: 'abierto-ahora', name: 'Abierto ahora' },
  { slug: 'hasta-tarde', name: 'Hasta tarde' },
  { slug: 'abre-domingos', name: 'Abre domingos' },
  { slug: 'desayuno', name: 'Desayuno' },
  { slug: 'almuerzo', name: 'Almuerzo' },
  { slug: 'merienda', name: 'Merienda' },
  { slug: 'cena', name: 'Cena' },
  { slug: 'trasnoche', name: 'Trasnoche' },
  { slug: 'happy-hour', name: 'Happy hour' },
]

/** Orden de las facetas en la UI (decisión 12: labels y orden en código, no en DB). */
export const FACET_LABELS: Record<Facet, string> = {
  tipo: 'Tipo',
  cocina: 'Cocina',
  actividad: 'Actividad',
  ambiente: 'Ambiente',
  precio: 'Precio',
  momento: 'Momento',
}

export const FACET_ORDER: Facet[] = ['tipo', 'cocina', 'actividad', 'ambiente', 'precio', 'momento']

/** Las 6 facetas con sus tags, en orden de siembra. Cocina va aparte por el parent_id. */
export const TAXONOMIA: { facet: Facet; tags: SeedTag[] }[] = [
  { facet: 'tipo', tags: TIPO },
  { facet: 'cocina', tags: [...COCINA_PADRES, ...COCINA_HIJOS] },
  { facet: 'actividad', tags: ACTIVIDAD },
  { facet: 'ambiente', tags: AMBIENTE },
  { facet: 'precio', tags: PRECIO },
  { facet: 'momento', tags: MOMENTO },
]

/** 105 = 96 tags + 9 padres de Cocina. El seed y el test lo verifican. */
export const TOTAL_TAGS = TAXONOMIA.reduce((n, f) => n + f.tags.length, 0)
