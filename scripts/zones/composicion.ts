import type { Position } from 'geojson'

/**
 * Cómo se arma cada una de las 46 zonas a partir de las fuentes oficiales.
 *
 * Es la curaduría del spec ZONAS hecha datos: qué barrios se mergean, qué
 * partido corresponde a cada zona y dónde van los cortes a mano. El razonamiento
 * de cada decisión está en `data/zones/README.md`.
 *
 * Las tres técnicas, en orden de preferencia:
 *   1. MERGE      — unión de polígonos oficiales (CABA, y partidos enteros).
 *   2. RECORTE    — un anillo dibujado a mano ∩ el polígono oficial que lo contiene.
 *   3. REMANENTE  — el polígono oficial MENOS las zonas ya recortadas de él.
 *
 * El remanente es lo que hace que las particiones sean exactas **por
 * construcción** y no por suerte: si mis coordenadas están un poco corridas, la
 * zona queda un poco corrida, pero nunca aparece un hueco ni un solape.
 */

// ---------------------------------------------------------------------------
// CABA — merge de los 48 barrios oficiales en 21 zonas
// ---------------------------------------------------------------------------

/**
 * Los 48 barrios del GeoJSON de BA Data, repartidos. La propiedad del archivo se
 * llama `nombre` y viene **sin acentos** ("Nuñez", "Constitucion") — verificado
 * contra el archivo, no asumido.
 *
 * Palermo no está acá: es el único barrio que se parte, no que se mergea.
 * Los barrios que el spec no nombra se reparten entre las zonas limítrofes
 * priorizando "cómo habla la gente"; cada uno está justificado en el README.
 */
export const BARRIOS_POR_ZONA: Record<string, string[]> = {
  'villa-crespo': ['Villa Crespo'],
  // Parque Chas es un enclave entre Villa Ortúzar y Agronomía; va con Chacarita.
  'chacarita-colegiales': ['Chacarita', 'Colegiales', 'Villa Ortuzar', 'Parque Chas'],
  'villa-urquiza-coghlan': ['Villa Urquiza', 'Coghlan', 'Villa Pueyrredon'],
  belgrano: ['Belgrano'],
  nunez: ['Nuñez'],
  saavedra: ['Saavedra'],
  recoleta: ['Recoleta'],
  'retiro-microcentro': ['Retiro', 'San Nicolas'],
  'puerto-madero': ['Puerto Madero'],
  'san-telmo': ['San Telmo'],
  // Constitución y San Cristóbal entran acá: el spec preveía "parte de Balvanera
  // sur", pero Balvanera va entera a Once y Abasto por decisión ya tomada.
  'monserrat-congreso': ['Monserrat', 'Constitucion', 'San Cristobal'],
  'la-boca-barracas': ['La Boca', 'Barracas', 'Nueva Pompeya', 'Parque Patricios'],
  'almagro-boedo': ['Almagro', 'Boedo'],
  'once-abasto': ['Balvanera'],
  'caballito': ['Caballito', 'Parque Chacabuco'],
  'devoto-villa-del-parque': [
    'Villa Devoto',
    'Villa Del Parque',
    'Agronomia',
    'Paternal',
    'Villa Santa Rita',
    'Villa Gral. Mitre',
    'Monte Castro',
    'Villa Real',
    'Versalles',
  ],
  'flores-floresta': [
    'Flores',
    'Floresta',
    'Velez Sarsfield',
    'Villa Luro',
    'Liniers',
    'Mataderos',
    'Parque Avellaneda',
    'Villa Lugano',
    'Villa Soldati',
    'Villa Riachuelo',
  ],
}

// ---------------------------------------------------------------------------
// Conurbano — partido entero (17 zonas)
// ---------------------------------------------------------------------------

/**
 * Zonas que son exactamente un partido. El valor es el campo `nam` de la capa
 * `ign:municipio` del IGN.
 */
export const PARTIDO_POR_ZONA: Record<string, string> = {
  'olivos-vicente-lopez': 'Vicente López',
  'tigre-nordelta': 'Tigre',
  'san-fernando': 'San Fernando',
  'san-miguel-bella-vista': 'San Miguel',
  pilar: 'Pilar',
  escobar: 'Escobar',
  'san-martin-villa-ballester': 'General San Martín',
  ituzaingo: 'Ituzaingó',
  'caseros-tres-de-febrero': 'Tres de Febrero',
  moreno: 'Moreno',
  merlo: 'Merlo',
  avellaneda: 'Avellaneda',
  quilmes: 'Quilmes',
  lanus: 'Lanús',
  'monte-grande': 'Esteban Echeverría',
  berazategui: 'Berazategui',
  'florencio-varela': 'Florencio Varela',
}

// ---------------------------------------------------------------------------
// Cortes a mano
// ---------------------------------------------------------------------------

/** Un anillo dibujado a mano, recortado contra el polígono oficial que lo contiene. */
export type Recorte = {
  /** Barrio de CABA o partido del IGN contra el que se recorta. */
  base: string
  /** Anillo cerrado por el builder. Se dibuja **generoso**: sobra lo que el recorte tira. */
  ring: Position[]
}

/**
 * Los 4 de Palermo (decisión 14). Soho, Hollywood y Las Cañitas se recortan; el
 * Botánico es el **remanente** — así la unión de los 4 da Palermo oficial exacto
 * por construcción, que es lo que el DoD exige.
 *
 * Límites por avenida: Av. Juan B. Justo separa Soho de Hollywood; Av. Santa Fe
 * los separa a ambos del Botánico; Av. Scalabrini Ortiz es el límite sur de Soho;
 * Av. Dorrego separa Hollywood de Las Cañitas.
 */
export const PALERMO: Record<string, Recorte> = {
  // Entre Juan B. Justo (NO), Santa Fe (NE), Scalabrini Ortiz (SE) y Córdoba (SO).
  'palermo-soho': {
    base: 'Palermo',
    ring: [
      [-58.456, -34.607], // Juan B. Justo extendida al SO (fuera de Palermo)
      [-58.4423, -34.594], // Córdoba × Juan B. Justo
      [-58.4267, -34.5793], // Santa Fe × Juan B. Justo
      [-58.4165, -34.5858], // Santa Fe × Scalabrini Ortiz
      [-58.432, -34.604], // Scalabrini Ortiz extendida al SO
    ],
  },
  // Entre Juan B. Justo (SE), Dorrego (NO), Córdoba (SO) y el eje Santa Fe (NE).
  'palermo-hollywood': {
    base: 'Palermo',
    ring: [
      [-58.456, -34.607], // compartido con Soho: sin hueco ni solape sobre Juan B. Justo
      [-58.4423, -34.594],
      [-58.4267, -34.5793],
      [-58.4345, -34.5757], // Dorrego × Santa Fe
      [-58.449, -34.5883], // Córdoba × Dorrego
      [-58.462, -34.599], // extendida al SO
    ],
  },
  // Entre Dorrego (S), Luis María Campos (O) y Libertador (E).
  'las-canitas': {
    base: 'Palermo',
    ring: [
      [-58.4345, -34.5757], // compartido con Hollywood
      [-58.436, -34.564], // Luis María Campos al N
      [-58.418, -34.56], // Libertador al N (extendida)
      [-58.4222, -34.5655], // Dorrego × Libertador
    ],
  },
}

/**
 * Cortes del conurbano. Solo 5 partidos necesitan corte; los otros 17 entran
 * enteros. Las cajas se dibujan sobre los centroides reales de los lugares de
 * Overture agrupados por `locality` — no son adivinadas, y el script de
 * validación las contrasta contra esos mismos centroides.
 */
export const RECORTES: Record<string, Recorte[]> = {
  // San Isidro: la franja costera sur (Martínez + Acassuso). El resto del
  // partido —San Isidro centro, Béccar, Boulogne, Villa Adelina— es remanente.
  'martinez-acassuso': [
    {
      base: 'San Isidro',
      ring: [
        [-58.48, -34.515], // río, al SE
        [-58.55, -34.512], // límite sur, tierra adentro (deja Villa Adelina afuera)
        [-58.545, -34.487], // límite oeste (deja Boulogne y Béccar afuera)
        [-58.492, -34.47], // límite norte: divide Acassuso de San Isidro centro
      ],
    },
  ],

  // Lomas de Zamora se parte en dos por el eje Meeks/Frías: al norte Lomas y
  // Banfield; al sur Temperley (con Turdera y Llavallol, contiguas a su estación).
  'lomas-banfield': [
    {
      base: 'Lomas de Zamora',
      ring: [
        [-58.47, -34.76],
        [-58.36, -34.77],
        [-58.36, -34.7],
        [-58.47, -34.7],
      ],
    },
  ],

  // Ramos Mejía (La Matanza) + Haedo (Morón): la única zona que cruza dos
  // partidos. Es exactamente lo que pide la decisión 3 — corredor, no partido.
  'ramos-mejia-haedo': [
    {
      base: 'La Matanza',
      ring: [
        [-58.585, -34.66],
        [-58.54, -34.66],
        [-58.54, -34.63],
        [-58.585, -34.63],
      ],
    },
    {
      base: 'Morón',
      ring: [
        [-58.61, -34.655],
        [-58.58, -34.655],
        [-58.58, -34.632],
        [-58.61, -34.632],
      ],
    },
  ],

  // San Justo estricto: NO absorbe el resto de La Matanza. González Catán,
  // Laferrere e Isidro Casanova quedan sin zona a propósito (decisión 17):
  // llamarlos "San Justo" sería mentirle al usuario por 20 km.
  'san-justo': [
    {
      base: 'La Matanza',
      ring: [
        [-58.585, -34.695],
        [-58.54, -34.695],
        [-58.54, -34.665],
        [-58.585, -34.665],
      ],
    },
  ],

  // Adrogué y Burzaco estricto: el resto de Almirante Brown (Longchamps, Glew,
  // Rafael Calzada, Claypole) queda sin zona por el mismo criterio.
  'adrogue-burzaco': [
    {
      base: 'Almirante Brown',
      ring: [
        [-58.42, -34.84],
        [-58.375, -34.84],
        [-58.375, -34.79],
        [-58.42, -34.79],
      ],
    },
  ],
}

/**
 * Zonas que son el remanente de su base: la base menos las zonas ya recortadas
 * de ella. Garantiza partición exacta sin depender de la precisión del dibujo.
 */
export const REMANENTES: Record<string, { base: string; menos: string[] }> = {
  'botanico-alto-palermo': {
    base: 'Palermo',
    menos: ['palermo-soho', 'palermo-hollywood', 'las-canitas'],
  },
  'san-isidro': { base: 'San Isidro', menos: ['martinez-acassuso'] },
  temperley: { base: 'Lomas de Zamora', menos: ['lomas-banfield'] },
  'moron-castelar': { base: 'Morón', menos: ['ramos-mejia-haedo'] },
}

/**
 * Grupos de zonas que particionan exactamente un polígono oficial. El build
 * estampa el área de la base en cada miembro (`properties.particion`), y el test
 * verifica que las áreas sumen y que no haya solapes — sin necesitar las fuentes,
 * que no se versionan.
 *
 * Morón queda afuera a propósito: lo particionan `moron-castelar` y el fragmento
 * de Haedo, que pertenece a una zona que cruza a otro partido.
 */
export const PARTICIONES: Record<string, string[]> = {
  Palermo: ['palermo-soho', 'palermo-hollywood', 'las-canitas', 'botanico-alto-palermo'],
  'San Isidro': ['martinez-acassuso', 'san-isidro'],
  'Lomas de Zamora': ['lomas-banfield', 'temperley'],
}

/**
 * Oráculo de validación: dónde tiene que caer cada localidad conocida. Son los
 * centroides reales de los lugares de Overture. Si el build mueve un corte y una
 * localidad cae en la zona equivocada, el test lo caza — no hace falta mirar un
 * mapa.
 */
export const CENTROIDES_ESPERADOS: { nombre: string; lng: number; lat: number; zona: string }[] = [
  // Palermo — landmarks, no centroides de localidad (CABA no tiene esa columna).
  { nombre: 'Plaza Serrano', lng: -58.435, lat: -34.5885, zona: 'palermo-soho' },
  { nombre: 'Bonpland y Costa Rica', lng: -58.44, lat: -34.584, zona: 'palermo-hollywood' },
  { nombre: 'Báez y Arévalo', lng: -58.433, lat: -34.567, zona: 'las-canitas' },
  { nombre: 'Jardín Botánico', lng: -58.418, lat: -34.582, zona: 'botanico-alto-palermo' },

  // Conurbano — centroides de `places.locality`.
  { nombre: 'Martínez', lng: -58.51066, lat: -34.49623, zona: 'martinez-acassuso' },
  { nombre: 'Acassuso', lng: -58.49988, lat: -34.47668, zona: 'martinez-acassuso' },
  { nombre: 'San Isidro', lng: -58.51959, lat: -34.47374, zona: 'san-isidro' },
  { nombre: 'Béccar', lng: -58.54275, lat: -34.46814, zona: 'san-isidro' },
  { nombre: 'Boulogne Sur Mer', lng: -58.57071, lat: -34.50117, zona: 'san-isidro' },
  // Villa Adelina está a caballo de San Isidro y Vicente López: el centroide de
  // sus lugares cae del lado de Vicente López. Lo cazó el oráculo en el primer
  // build — la expectativa estaba mal, no el polígono.
  { nombre: 'Villa Adelina', lng: -58.54338, lat: -34.52174, zona: 'olivos-vicente-lopez' },
  { nombre: 'Lomas de Zamora', lng: -58.40782, lat: -34.76219, zona: 'lomas-banfield' },
  { nombre: 'Banfield Este', lng: -58.39577, lat: -34.74248, zona: 'lomas-banfield' },
  { nombre: 'Banfield Oeste', lng: -58.45679, lat: -34.73153, zona: 'lomas-banfield' },
  { nombre: 'Temperley', lng: -58.38771, lat: -34.77093, zona: 'temperley' },
  { nombre: 'Turdera', lng: -58.41033, lat: -34.79181, zona: 'temperley' },
  { nombre: 'Ramos Mejía', lng: -58.56314, lat: -34.64572, zona: 'ramos-mejia-haedo' },
  { nombre: 'Haedo', lng: -58.59349, lat: -34.6439, zona: 'ramos-mejia-haedo' },
  { nombre: 'San Justo', lng: -58.56333, lat: -34.67944, zona: 'san-justo' },
  { nombre: 'Morón', lng: -58.61789, lat: -34.65357, zona: 'moron-castelar' },
  { nombre: 'Castelar', lng: -58.6455, lat: -34.65194, zona: 'moron-castelar' },
  { nombre: 'El Palomar', lng: -58.59285, lat: -34.62103, zona: 'moron-castelar' },
  { nombre: 'Adrogué', lng: -58.39384, lat: -34.80164, zona: 'adrogue-burzaco' },
  { nombre: 'Burzaco', lng: -58.39228, lat: -34.82702, zona: 'adrogue-burzaco' },
]

/** Localidades que a propósito NO caen en ninguna zona (decisión 17). */
export const SIN_ZONA_ESPERADO: { nombre: string; lng: number; lat: number }[] = [
  { nombre: 'González Catán', lng: -58.62733, lat: -34.77027 },
  { nombre: 'Gregorio de Laferrere', lng: -58.59124, lat: -34.74502 },
  { nombre: 'Isidro Casanova', lng: -58.58629, lat: -34.70623 },
  { nombre: 'Longchamps', lng: -58.39003, lat: -34.85873 },
  { nombre: 'Glew', lng: -58.38409, lat: -34.88747 },
  { nombre: 'Rafael Calzada', lng: -58.36103, lat: -34.78594 },
]
