/**
 * Mapeo `taxonomy.primary` → slugs de la taxonomía propia.
 *
 * Vive en `lib/` y no en `scripts/` porque tiene **dos** consumidores: el import
 * (`scripts/import-overture.ts`) y la revocación de un reclamo, que re-deriva
 * las tags de Overture cuando se van las del dueño (`lib/claims/ownership.ts`).
 * La dirección de dependencias del proyecto es `scripts → lib`, nunca al revés.
 *
 * Es **semilla, no reemplazo**: da el Tipo (y la Cocina cuando la categoría la
 * implica) para que el catálogo nazca navegable. Lo que no mapea a Cocina queda
 * solo con su Tipo, y Ambiente lo completan el dueño o el admin.
 *
 * Nota de implementación: el spec dice que Overture no tiene la dimensión
 * Actividad, y en general es cierto. La excepción son los locales cuya categoría
 * ES la actividad (`bowling_alley`, `escape_room`, `karaoke_venue`…): ahí no se
 * está inventando un dato, se está traduciendo el mismo. Esas asignaciones
 * entran con `source='import'`, así que un admin puede corregirlas.
 *
 * Todas las tags que se nombran acá existen en `lib/db/taxonomy.ts` — hay un
 * test que lo verifica, para que un slug mal tipeado no se descubra en runtime.
 */
export const CATEGORY_TAG_MAP: Record<string, string[]> = {
  // --- Restaurantes: genéricos -------------------------------------------
  restaurant: ['restaurante'],
  fast_food_restaurant: ['restaurante'],
  diner: ['restaurante'],
  bistro: ['restaurante'],
  cafeteria: ['restaurante'],
  buffet_restaurant: ['restaurante'],
  theme_restaurant: ['restaurante', 'tematico'],
  comfort_food_restaurant: ['restaurante'],
  molecular_gastronomy_restaurant: ['restaurante'],
  sandwich_shop: ['restaurante'],
  food_truck_stand: ['restaurante'],
  seafood_restaurant: ['restaurante'],
  soup_restaurant: ['restaurante'],
  salad_bar: ['restaurante'],
  fondue_restaurant: ['restaurante'],
  breakfast_and_brunch_restaurant: ['restaurante', 'desayuno'],

  // --- Restaurantes: cocina argentina ------------------------------------
  argentine_restaurant: ['restaurante', 'argentina'],
  steakhouse: ['restaurante', 'parrilla'],
  barbecue_restaurant: ['restaurante', 'parrilla'],
  bar_and_grill_restaurant: ['restaurante', 'parrilla'],
  empanada_restaurant: ['restaurante', 'empanadas'],

  // --- Restaurantes: italiana --------------------------------------------
  italian_restaurant: ['restaurante', 'italiana'],
  pizza_restaurant: ['restaurante', 'pizza'],

  // --- Restaurantes: americana -------------------------------------------
  american_restaurant: ['restaurante', 'americana'],
  burger_restaurant: ['restaurante', 'hamburguesas'],
  hot_dog_restaurant: ['restaurante', 'americana'],
  southern_american_restaurant: ['restaurante', 'americana'],
  chicken_restaurant: ['restaurante', 'americana'],
  texmex_restaurant: ['restaurante', 'mexicana'],
  taco_restaurant: ['restaurante', 'mexicana'],
  mexican_restaurant: ['restaurante', 'mexicana'],

  // --- Restaurantes: asiática --------------------------------------------
  asian_restaurant: ['restaurante', 'asiatica'],
  asian_fusion_restaurant: ['restaurante', 'asiatica'],
  japanese_restaurant: ['restaurante', 'japonesa-sushi'],
  sushi_restaurant: ['restaurante', 'japonesa-sushi'],
  ramen_restaurant: ['restaurante', 'ramen'],
  chinese_restaurant: ['restaurante', 'china'],
  indo_chinese_restaurant: ['restaurante', 'china'],
  dumpling_restaurant: ['restaurante', 'china'],
  korean_restaurant: ['restaurante', 'coreana'],
  thai_restaurant: ['restaurante', 'tailandesa'],
  vietnamese_restaurant: ['restaurante', 'vietnamita'],
  indonesian_restaurant: ['restaurante', 'asiatica'],
  cambodian_restaurant: ['restaurante', 'asiatica'],
  polynesian_restaurant: ['restaurante', 'asiatica'],
  hawaiian_restaurant: ['restaurante', 'asiatica'],

  // --- Restaurantes: India y Medio Oriente -------------------------------
  indian_restaurant: ['restaurante', 'india'],
  arabian_restaurant: ['restaurante', 'arabe'],
  syrian_restaurant: ['restaurante', 'arabe'],
  lebanese_restaurant: ['restaurante', 'arabe'],
  falafel_restaurant: ['restaurante', 'arabe'],
  egyptian_restaurant: ['restaurante', 'arabe'],
  turkish_restaurant: ['restaurante', 'turca'],
  armenian_restaurant: ['restaurante', 'armenia'],
  israeli_restaurant: ['restaurante', 'india-medio-oriente'],
  jewish_restaurant: ['restaurante', 'kosher'],
  kosher_restaurant: ['restaurante', 'kosher'],

  // --- Restaurantes: latinoamericana -------------------------------------
  latin_american_restaurant: ['restaurante', 'latinoamericana'],
  peruvian_restaurant: ['restaurante', 'peruana'],
  venezuelan_restaurant: ['restaurante', 'venezolana'],
  colombian_restaurant: ['restaurante', 'colombiana'],
  bolivian_restaurant: ['restaurante', 'boliviana'],
  brazilian_restaurant: ['restaurante', 'brasilena'],
  cuban_restaurant: ['restaurante', 'latinoamericana'],
  ecuadorian_restaurant: ['restaurante', 'latinoamericana'],
  panamanian_restaurant: ['restaurante', 'latinoamericana'],
  caribbean_restaurant: ['restaurante', 'latinoamericana'],
  african_restaurant: ['restaurante'],

  // --- Restaurantes: europea ---------------------------------------------
  european_restaurant: ['restaurante', 'europea'],
  spanish_restaurant: ['restaurante', 'espanola-tapas'],
  catalan_restaurant: ['restaurante', 'espanola-tapas'],
  basque_restaurant: ['restaurante', 'espanola-tapas'],
  french_restaurant: ['restaurante', 'francesa'],
  german_restaurant: ['restaurante', 'alemana'],
  swiss_restaurant: ['restaurante', 'europea'],
  scandinavian_restaurant: ['restaurante', 'europea'],
  hungarian_restaurant: ['restaurante', 'europea'],
  russian_restaurant: ['restaurante', 'europea'],
  irish_restaurant: ['restaurante', 'europea'],
  greek_restaurant: ['restaurante', 'europea'],
  mediterranean_restaurant: ['restaurante', 'europea'],
  fish_and_chips_restaurant: ['restaurante', 'europea'],

  // --- Restaurantes: dietas ----------------------------------------------
  vegetarian_restaurant: ['restaurante', 'vegetariana'],
  vegan_restaurant: ['restaurante', 'vegana'],
  gluten_free_restaurant: ['restaurante', 'sin-tacc'],
  health_food_restaurant: ['restaurante', 'vegetariana'],
  live_and_raw_food_restaurant: ['restaurante', 'vegetariana'],

  // --- Bares --------------------------------------------------------------
  bar: ['bar'],
  pub: ['bar'],
  irish_pub: ['bar'],
  gastropub: ['bar', 'restaurante'],
  sports_bar: ['bar', 'futbol-en-pantalla'],
  cocktail_bar: ['bar'],
  whiskey_bar: ['bar'],
  sake_bar: ['bar'],
  tiki_bar: ['bar', 'tematico'],
  dive_bar: ['bar'],
  gay_bar: ['bar', 'lgbtq-friendly'],
  hotel_bar: ['bar'],
  hookah_bar: ['bar'],
  speakeasy: ['bar', 'speakeasy'],
  tapas_bar: ['bar', 'espanola-tapas'],
  wine_bar: ['wine-bar'],
  winery: ['wine-bar', 'catas-degustaciones'],
  distillery: ['bar', 'catas-degustaciones'],
  beer_bar: ['cerveceria'],
  beer_garden: ['cerveceria', 'aire-libre'],
  brewery: ['cerveceria', 'catas-degustaciones'],

  // --- Cafés --------------------------------------------------------------
  cafe: ['cafe'],
  coffee_shop: ['cafe', 'cafe-especialidad'],
  hong_kong_style_cafe: ['cafe'],
  tea_room: ['cafe', 'merienda'],
  internet_cafe: ['cafe', 'wifi-trabajar'],

  // --- Noche, escenarios y juegos ----------------------------------------
  dance_club: ['boliche', 'dj'],
  night_club: ['boliche', 'dj'],
  salsa_club: ['boliche', 'salsa-bachata'],
  music_venue: ['teatro-espacio-cultural', 'musica-en-vivo'],
  comedy_club: ['teatro-espacio-cultural', 'stand-up'],
  theatre_venue: ['teatro-espacio-cultural', 'teatro'],
  movie_theater: ['teatro-espacio-cultural', 'proyecciones-cine'],
  drive_in_theater: ['teatro-espacio-cultural', 'proyecciones-cine'],
  karaoke_venue: ['centro-entretenimiento', 'karaoke'],
  bowling_alley: ['centro-entretenimiento', 'bowling'],
  arcade: ['centro-entretenimiento', 'arcade'],
  go_kart_club: ['centro-entretenimiento'],
  casino: ['centro-entretenimiento'],
  escape_room: ['club-de-juegos', 'escape-room'],
  pool_billiards: ['club-de-juegos', 'pool-metegol-dardos'],
  food_court: ['patio-gastronomico'],
  night_market: ['patio-gastronomico', 'aire-libre'],
}

/** Slugs de tags para una categoría de Overture. Vacío si no mapea. */
export function tagsForCategory(category: string | null | undefined): string[] {
  if (!category) return []
  return CATEGORY_TAG_MAP[category] ?? []
}
