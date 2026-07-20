/**
 * Selección de categorías de Overture para el import, contra `taxonomy.primary`.
 *
 * ⚠️ NUNCA contra `categories`: ese campo se elimina en la release de septiembre
 * 2026 (decisión 3 del spec).
 *
 * Criterio: **"salida vs compra"**. Entra el lugar al que se va a pasar un rato;
 * queda afuera el que se visita para comprar algo y llevárselo. Por eso no están
 * heladerías, panaderías ni casas de postres — aunque vendan comida rica.
 *
 * La lista se armó contra los datos reales del bbox AMBA de la release
 * `2026-06-17.0` (1.158 categorías distintas en 282.865 POIs), no contra una
 * lista teórica.
 */

/** Gastronomía: restaurantes por tipo y por cocina. */
const RESTAURANTES = [
  'restaurant',
  'fast_food_restaurant',
  'pizza_restaurant',
  'burger_restaurant',
  'argentine_restaurant',
  'bar_and_grill_restaurant',
  'barbecue_restaurant',
  'steakhouse',
  'italian_restaurant',
  'peruvian_restaurant',
  'vegetarian_restaurant',
  'vegan_restaurant',
  'chicken_restaurant',
  'japanese_restaurant',
  'sushi_restaurant',
  'mexican_restaurant',
  'chinese_restaurant',
  'breakfast_and_brunch_restaurant',
  'american_restaurant',
  'buffet_restaurant',
  'seafood_restaurant',
  'spanish_restaurant',
  'french_restaurant',
  'asian_restaurant',
  'asian_fusion_restaurant',
  'hot_dog_restaurant',
  'diner',
  'bistro',
  'cafeteria',
  'latin_american_restaurant',
  'venezuelan_restaurant',
  'colombian_restaurant',
  'bolivian_restaurant',
  'brazilian_restaurant',
  'cuban_restaurant',
  'ecuadorian_restaurant',
  'panamanian_restaurant',
  'caribbean_restaurant',
  'soup_restaurant',
  'salad_bar',
  'korean_restaurant',
  'ramen_restaurant',
  'thai_restaurant',
  'vietnamese_restaurant',
  'indonesian_restaurant',
  'cambodian_restaurant',
  'indo_chinese_restaurant',
  'dumpling_restaurant',
  'theme_restaurant',
  'mediterranean_restaurant',
  'gluten_free_restaurant',
  'german_restaurant',
  'empanada_restaurant',
  'comfort_food_restaurant',
  'health_food_restaurant',
  'live_and_raw_food_restaurant',
  'indian_restaurant',
  'european_restaurant',
  'scandinavian_restaurant',
  'swiss_restaurant',
  'hungarian_restaurant',
  'russian_restaurant',
  'irish_restaurant',
  'greek_restaurant',
  'catalan_restaurant',
  'basque_restaurant',
  'arabian_restaurant',
  'syrian_restaurant',
  'lebanese_restaurant',
  'falafel_restaurant',
  'turkish_restaurant',
  'armenian_restaurant',
  'israeli_restaurant',
  'jewish_restaurant',
  'kosher_restaurant',
  'egyptian_restaurant',
  'african_restaurant',
  'texmex_restaurant',
  'taco_restaurant',
  'southern_american_restaurant',
  'polynesian_restaurant',
  'hawaiian_restaurant',
  'fish_and_chips_restaurant',
  'fondue_restaurant',
  'molecular_gastronomy_restaurant',
  'sandwich_shop',
  'food_truck_stand',
]

/** Bares y cervecerías: se va a tomar algo, no a comprar la botella. */
const BARES = [
  'bar',
  'pub',
  'irish_pub',
  'gastropub',
  'beer_bar',
  'beer_garden',
  'sports_bar',
  'cocktail_bar',
  'wine_bar',
  'tapas_bar',
  'whiskey_bar',
  'sake_bar',
  'tiki_bar',
  'dive_bar',
  'gay_bar',
  'hotel_bar',
  'hookah_bar',
  'speakeasy',
  'brewery',
  'distillery',
  'winery',
]

/** Cafés: se ocupa una mesa. Las panaderías quedan afuera (compra). */
const CAFES = ['cafe', 'coffee_shop', 'tea_room', 'internet_cafe', 'hong_kong_style_cafe']

/** Salida nocturna, escenarios y juegos — el alcance de Actividad. */
const NOCHE_Y_ACTIVIDADES = [
  'dance_club',
  'night_club',
  'salsa_club',
  'music_venue',
  'karaoke_venue',
  'comedy_club',
  'casino',
  'bowling_alley',
  'escape_room',
  'arcade',
  'pool_billiards',
  'go_kart_club',
  'theatre_venue',
  'movie_theater',
  'drive_in_theater',
  'food_court',
  'night_market',
]

/** Allowlist: solo entra al catálogo lo que está acá. */
export const INCLUDE_CATEGORIES = new Set([
  ...RESTAURANTES,
  ...BARES,
  ...CAFES,
  ...NOCHE_Y_ACTIVIDADES,
])

/**
 * Denylist explícita. Redundante contra la allowlist a propósito: es la
 * exclusión que el spec fijó por decisión de producto, y tiene que ser visible y
 * testeable, no una ausencia silenciosa en una lista de 150 ítems.
 */
export const EXCLUDE_CATEGORIES = new Set(['ice_cream_shop', 'bakery', 'dessert_shop'])

/** La denylist gana siempre sobre la allowlist. */
export function isIncluded(category: string | null | undefined): boolean {
  if (!category) return false
  if (EXCLUDE_CATEGORIES.has(category)) return false
  return INCLUDE_CATEGORIES.has(category)
}
