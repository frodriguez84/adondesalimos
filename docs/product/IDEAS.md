# IDEAS — A Dónde Salimos

Volcado crudo de la conversación de producto, organizado por temas. **Este archivo es la
fuente de verdad del traspaso entre sesiones** (regla en `CLAUDE.md` § Continuidad entre
sesiones). Se actualiza *durante* la conversación, no al final.

Convención de marcado — nada se lee como cerrado si no lo dice explícitamente:

- ✅ **DECISIÓN TOMADA** — cerrado; solo se reabre a pedido del usuario
- 💡 **IDEA SIN DECIDIR** — sobre la mesa, sin compromiso
- ❓ **PREGUNTA ABIERTA** — necesita respuesta del usuario o análisis

Cuando un bloque de temas madura lo suficiente, se propone pasarlo a spec con `/new-spec`
(no antes).

---

## Concepto general

- ✅ La app sirve para **decidir a dónde ir** según lo que escriba el usuario + una tanda
  de filtros. Es de **descubrimiento puro**: muestra teléfono, dirección, horarios, link —
  **no se reserva nada** desde la app; el resto corre por cuenta del usuario.
- ✅ Inspiración: adondevamos.com, una web de hace 15-20 años que hacía esto y desapareció.
- ✅ **Mobile-first**: la gran mayoría del uso va a ser en celular, muy poco en PC. Debe
  estar adaptada y muy optimizada para móvil.
- 💡 Los **filtros van a ser el fuerte de la app**. Ejemplos: Gastronomía / Juegos de mesa /
  Bar temático; Restaurante + comida pakistaní / árabe / etc.; Stand Up + Bar.
- ✅ **Taxonomía de filtros curada** (opción C): las primeras categorías/tags las creamos
  nosotros; después Fer agrega las que falten y las que **sugieran usuarios y sobre todo
  dueños** (que son los que saben de SU negocio). Los usuarios eligen del árbol, no crean
  tags libres; las sugerencias pasan por aprobación.
- ✅ Búsqueda **clásica** para arrancar: campo de texto (matchea nombres/categorías) +
  filtros. La búsqueda por **texto libre con IA** (LLM traduce "algo tranqui con comida
  árabe" → filtros) **queda para más adelante**: al usuario le "re copa", pero se posterga
  y se retoma cuando se hable de monetización — la idea es que la monetización solvente el
  costo de la API de Claude.
- ✅ **Alcance geográfico: AMBA** (CABA + conurbano; no la provincia entera). CABA sola
  quedaba corta — hay muchas cosas buenas en AMBA.

## Diseño / UX

- ✅ **Regla fundamental: la app debe ser absurdamente intuitiva.** Muy fácil de usar, cero
  fricción, super entendible — eso decide si la gente la usa o la abandona. Aplica en
  particular a la **búsqueda** y a la **lectura de resultados**.
- ✅ Mobile-first (ya decidido en Concepto general).
- ✅ **Identidad visual calibrada** con referencias del usuario (le gustan: Neon/neon.tech,
  GR-IT/grit.com.ar, Notion, InShot, Mobbin; no le gusta: la app de MercadoPago):
  **minimalismo con carácter** — pocas cosas por pantalla, mucho aire, jerarquía clarísima,
  un solo acento de color, tipografía confiada, cards nítidas, cero banners/ruido.
- ✅ **Un solo tema al lanzamiento: OSCURO** (identidad nocturna del rubro; el claro se
  suma después si hace falta). Nada de mantener dos temas en v1.
- ✅ **Tono del copy: canchero y divertido, pero CERO emojis.** Rioplatense cercano
  (estilo "¿Y? ¿A dónde salimos?"), nunca corporativo acartonado.
- 💡 **Branding/paleta en definición** — el usuario no tiene marca pensada y pidió ayuda.
  Su brief verbal: "algo oscuro, que dé a salida de noche, barcito, amigos, baja luz".
  Recorrido: ronda 1 (ámbar s/marrón, violeta, verde+dorado) descartada — evitar marrones,
  aceituna y violetas; ronda 2 (hora azul, teal, coral s/petróleo) tampoco convenció.
  - ✅ **Dirección elegida: "Luz de bar" sobre FONDO NEGRO como StressPlan.** Dato: StressPlan
    ya usa exactamente eso — fondo `#0F0F0F`, cards `#1A1A1A`, primary ámbar `#F59E0B`.
  - ✅ **PALETA ELEGIDA (2026-07-19): "Ámbar StressPlan"** — fondo `#0F0F0F`, cards
    `#1A1A1A`, acento ámbar `#F59E0B`, texto `#F5F5F5`. Mismo sistema de color que
    StressPlan → los componentes que se roben ya vienen "vestidos".
    Muestra: https://claude.ai/code/artifact/e572380c-ffae-43b5-8a2f-3ff6ba9748b1
- ✅ **El branding es revisable**: la paleta elegida es base de trabajo, no compromiso. La
  app se construye con **design tokens** (variables CSS / theme Tailwind, como StressPlan)
  y sin colores hardcodeados en componentes — cambiar la paleta entera = tocar ~6 variables.
  Lo único caro de cambiar es post-lanzamiento y es nombre/logo/dominio, no los colores.

## Búsqueda por ubicación

- ✅ **Default: el usuario elige zona/barrio** (fundamental). En AMBA la distancia manda —
  nadie viaja de Quilmes a Tigre por una hamburguesa.
- ✅ **"Cerca de mí" (GPS) como opción secundaria** — toggle/botón; raro que se use pero
  no se niega.
- ✅ Al activar "cerca de mí", el **GPS reemplaza a la zona elegida** (opción a): un toggle
  = un comportamiento obvio. No se combinan criterios.

## Alcance de tipos de negocio

- ✅ Entran: gastronomía (restaurantes, bares, cafés) y actividades (stand up, teatro,
  juegos de mesa, bares temáticos, etc.).
- ✅ Quedan **afuera**: ferias itinerantes / eventos de días específicos (tipo BA Market).
- ✅ **PRINCIPIO RECTOR — "salida" vs "compra" (2026-07-19, tanda 5).** Entra el lugar donde
  **te quedás**; no entra el lugar donde **comprás y te vas**. Fer lo fijó al decidir que
  heladerías y panaderías quedan afuera. Resuelve solo los casos futuros (rotiserías,
  vinotecas de venta, kioscos gourmet) sin volver a discutir uno por uno.
- ✅ **Heladerías y panaderías — AFUERA** (2026-07-19). Se había propuesto incorporarlas vía
  Cocina; Fer se corrigió y las dejó fuera del alcance. **Consecuencia ejecutada**: se
  eliminó el tag `Heladería` de Cocina § Dulce y café, donde había quedado de la tanda 3.
  **Consecuencia para el import de Overture**: excluir `ice_cream_shop`, `bakery` y
  `dessert_shop` del import.
- ✅ **Cines — AFUERA, "siempre"** (Fer, 2026-07-19). No es un aplazamiento: es exclusión de
  alcance. Motivo: un cine sin cartelera es inútil (nadie busca "un cine en Belgrano", busca
  *qué dan y a qué hora*) y la cartelera es **agenda de eventos**, justo lo que la app
  decidió no manejar — misma regla por la que "Fútbol en pantalla" es capacidad y no
  programación, y por la que las ferias itinerantes quedaron afuera. La dimensión sí está
  cubierta donde importa: `Proyecciones / cine` existe en **Actividad**, para el bar que
  proyecta películas.
- 💡 Complejos de salas (ej. Complejo La Plaza para teatro/stand up): aparece el complejo
  como resultado y se muestra el **link del lugar** para que el usuario siga la búsqueda ahí
  adentro. No se listan las obras/funciones individuales.

## Taxonomía de filtros

_Tanda 3 (2026-07-19). La modalidad ya estaba decidida en la tanda 1 (curada, opción C);
acá se vuelca el árbol real. Los filtros son "el fuerte de la app" (Fer)._

### Estructura — ✅ DECIDIDA (2026-07-19)

- ✅ **Modelo de FACETAS combinables, no árbol único.** Los ejemplos que dio Fer mezclan
  dimensiones distintas ("Stand Up + Bar" = qué se hace + qué es; "Restaurante + pakistaní"
  = qué es + qué se come). Un árbol único obligaría a duplicar "Bar" bajo Gastronomía, bajo
  Stand Up y bajo Juegos de mesa → inmantenible al tag 50.

| # | Faceta | Responde | Ejemplo |
|---|--------|----------|---------|
| 1 | **Tipo de lugar** | ¿Qué *es*? | Bar, Restaurante, Café, Cervecería |
| 2 | **Cocina** | ¿Qué se come? | Pakistaní, Parrilla, Sushi, Bodegón |
| 3 | **Actividad** | ¿Qué se *hace*? | Stand up, Juegos de mesa, Karaoke |
| 4 | **Ambiente** | ¿Cómo se siente? | Tranqui para charlar, Terraza, Grupos |
| 5 | **Precio** | ¿Cuánto sale? | $ · $$ · $$$ · $$$$ |
| 6 | **Momento** | ¿Cuándo? | Abierto ahora, Hasta tarde, Brunch |
| 7 | **Zona** | ¿Dónde? | Selector propio, NO tag (ya decidido) |

- ✅ **Regla que evita la duplicación**: *Tipo* = qué es el negocio; *Actividad* = qué podés
  hacer ahí. Un bar con karaoke los martes es `Tipo: Bar` + `Actividad: Karaoke`, no un
  "tipo karaoke". Las combinaciones que pidió Fer salen solas del cruce de facetas.
- ✅ **Actividad + Ambiente son el diferencial real.** Google ya da tipo y cocina; nadie da
  "bar tranqui con juegos de mesa en Villa Crespo". Ahí está el fuerte de la app.
- ✅ **Faceta "Ocasión" SÍ, y en la home**: chips grandes ("Primera cita", "After office",
  "Salida con amigos") que por debajo son **combinaciones prearmadas** de las otras facetas.
  Es lo más cercano a "absurdamente intuitivo": el usuario no arma un filtro, toca lo que le
  pasa. No es una faceta nueva de datos — es una capa de curaduría sobre las 6 primeras.
- ✅ **Cocina va en DOS niveles** (Asiática → Japonesa/Coreana/China/India/Tailandesa).
  Buscar el padre trae todos los hijos. Con ~40 cocinas en AMBA, una lista plana marea en
  celular.
- 💡 **UI propuesta (sin cerrar)**: la home muestra Zona + campo de texto + 3-4 chips de
  Ocasión; las 6 facetas viven detrás de un botón "Filtros". Siete filtros a la vista en un
  celular es lo opuesto a "absurdamente intuitivo".

### Valores concretos por faceta

#### Faceta 1 — Tipo de lugar ✅ VALIDADA (2026-07-19)

- ✅ **Regla dura: Tipo = formato del local · Cocina = qué sirve.** Parrilla, Pizzería y
  Bodegón van a **Cocina**, NO a Tipo. Motivo: si viven en Tipo existen dos veces y vuelve
  el problema de duplicación que hizo descartar el árbol. **No hay costo de UX**: el campo
  de texto matchea tags de cualquier faceta — escribís "parrilla" y te trae `Cocina:
  Parrilla` igual. La distinción es interna, el usuario no la ve.

Gastronómicos: **Restaurante · Bar · Cervecería · Café · Wine bar / vinoteca · Boliche ·
Patio gastronómico / food hall**
No gastronómicos: **Teatro / espacio cultural · Club de juegos · Centro de entretenimiento**
(bowling, escape room, karaoke dedicado)

- ✅ Diez valores, corto a propósito: Tipo es lo primero que toca el usuario y una lista de
  22 en celular es fricción.
- ✅ **Descartados**: *Pub* (se solapa 100% con Bar) · *Rooftop* (es Ambiente, no Tipo).
- ✅ **RESUELTO (2026-07-19, tanda 5): NO entran Heladería, Panadería ni Cine** — ni en Tipo
  ni en ninguna otra faceta. Ver el principio "salida vs compra" en § Alcance de tipos de
  negocio. **Los diez valores de Tipo quedan firmes.**

#### Faceta 3 — Actividad ✅ VALIDADA (2026-07-19)

Es **el diferencial de la app** — Google no tiene esta dimensión. Los grupos ordenan la UI,
no son filtrables.

| Grupo | Tags |
|-------|------|
| **Escenario** | Stand up / comedia · Música en vivo · Open mic · Teatro · Peña folclórica |
| **Baile** | DJ · Milonga / tango · Salsa y bachata · Fiesta temática |
| **Juegos** | Juegos de mesa · Pool / metegol / dardos · Trivia / quiz night · Arcade · Bowling · Escape room |
| **Participar** | Karaoke · Catas y degustaciones |
| **Mirar** | Fútbol en pantalla · Proyecciones / cine |

- ✅ **19 tags** _(conteo corregido 2026-07-19: antes decía 18 por error de suma)_.
  *Talleres* **descartado** (2026-07-19): le hizo ruido a Fer y roza el
  "evento de día específico" ya excluido del alcance.
- ✅ **"Fútbol en pantalla"** es un tag de capacidad ("acá se ve fútbol"), **no** de
  programación ("hoy pasan Boca-River"). La app no maneja agenda de eventos.

#### Faceta 2 — Cocina ✅ VALIDADA (2026-07-19)

Dos niveles; **los padres son filtrables** (tocar "Asiática" trae todos los hijos).

| Padre | Hijos |
|-------|-------|
| **Argentina** | Parrilla · Bodegón · Milanesas · Empanadas · Norteña / locro |
| **Italiana** | Pizza · Pastas · Trattoria |
| **Asiática** | Japonesa / sushi · Ramen · China · Coreana · Tailandesa · Vietnamita |
| **India y Medio Oriente** | India · Pakistaní · Árabe · Armenia · Turca |
| **Latinoamericana** | Peruana · Mexicana · Venezolana · Colombiana · Boliviana · Brasileña |
| **Europea** | Española / tapas · Francesa · Alemana |
| **Americana** | Hamburguesas · BBQ / costillas |
| **Dulce y café** | Pastelería · Café de especialidad |
| **Dietas** | Vegetariana · Vegana · Sin TACC · Kosher · Halal |

- ✅ **37 tags en 9 padres** (eran 38 con `Heladería`, eliminada en la tanda 5 al quedar las
  heladerías fuera del alcance). _Conteo corregido 2026-07-19: antes decía 36 por error de
  suma; la lista enumerada siempre fue la válida._
- ✅ **`Pastelería` SÍ sobrevive** (revisado y confirmado por Fer, 2026-07-19). Razón fuerte:
  **la app ya decidió que la merienda es una salida** — `Merienda` es chip de Ocasión *y* tag
  de Momento. Ese chip es, por definición, una combinación de facetas: `Tipo: Café` +
  `Momento: Merienda` + **`Cocina: Pastelería`**. Sin Pastelería el chip devuelve "todos los
  cafés", el mismo fallo ya anotado para "Salida con amigos".
- ✅ **TEST PARA ADMITIR UN TAG DE COCINA**: se justifica si **existe algún lugar del catálogo
  que lo llevaría**. `Heladería` no lo pasa (sin heladerías en el catálogo, tag muerto);
  `Pastelería` sí (lo llevan los cafés y las confiterías notables, y `Tipo: Café` está firme).
- ✅ **Corolario que ordena las dos reglas**: el principio *salida vs compra* aplica al **Tipo
  de local** — decide qué lugares entran al catálogo. Los tags de **Cocina no filtran
  lugares**, describen qué sirve un lugar que ya entró. Por eso ninguna heladería entra (no
  hay Tipo que la contenga) pero el café con buena pastelería sí, y necesita cómo decirlo.
- 📌 **Nota**: `Panadería` nunca existió como tag. Se propuso en la tanda 5 y Fer la rechazó
  junto con las heladerías.
- ✅ **"Dietas" vive dentro de Cocina** aunque conceptualmente no sea una cocina: la gente
  busca "vegano" con el mismo gesto con que busca "sushi", y crear una faceta aparte solo
  para eso rompe el modelo de 7. Incoherente en el papel, correcto en la práctica.
- ✅ **Pizza va bajo Italiana** (la porteña de molde y la napoletana juntas): separarlas
  obliga a explicarle la diferencia al usuario.
- ✅ **Las cocinas de nicho NO se adivinan ahora** (etíope, griega, húngara, nórdica). En
  AMBA hay dos o tres lugares de cada una — **es exactamente el caso de uso del modelo
  curado (opción C)**: el dueño la sugiere, Fer la aprueba.

#### Faceta 4 — Ambiente ✅ VALIDADA (2026-07-19)

Una sola faceta con dos grupos, porque el usuario los filtra en el mismo gesto aunque sean
cosas distintas (**vibra** = subjetiva · **servicios** = hechos verificables).

- **Vibra**: Tranqui para charlar · Movido · Romántico / para una cita · Para grupos grandes
  · Al aire libre / patio · Terraza o rooftop · Con vista · Speakeasy / escondido · Temático
  · Bar notable / histórico
- **Servicios**: Pet friendly · Kids friendly · Accesible · Wifi para trabajar ·
  Estacionamiento · Reserva necesaria · LGBTQ+ friendly

- ✅ 17 tags.
- ⚠️ **Riesgo conocido — nadie se autodefine como "movido".** Un dueño cargando su ficha
  tilda "tranqui" + "romántico" + "para grupos" todo junto y el filtro deja de significar
  algo. **Se controla en la aprobación manual de la ficha** (trabajo de Fer). Anotado como
  riesgo operativo, no bloquea.

#### Faceta 5 — Precio ✅ VALIDADA (2026-07-19)

`$` hasta 15.000 · `$$` 15–30.000 · `$$$` 30–60.000 · `$$$$` 60.000+ (por persona).

- ✅ **Los cortes viven en base de datos y se ajustan desde `/admin`** — mismo criterio ya
  decidido para los precios de los planes. Con la inflación, un `$$` hardcodeado miente en
  seis meses.

#### Faceta 6 — Momento ✅ VALIDADA (2026-07-19)

Abierto ahora · Hasta tarde (después de las 2) · Abre domingos · Desayuno · Almuerzo ·
Merienda · Cena · Trasnoche · Happy hour

#### Ocasión — chips de la home ✅ VALIDADA (2026-07-19)

No es una faceta de datos: son **combinaciones prearmadas** de las otras seis.

Primera cita · **Salida con chongo** · Salida con amigos · After office · Cumpleaños ·
Cena familiar · Plan tranqui · Salir a bailar · Merienda

- ✅ **"Salida con chongo" — pedido explícito de Fer** (2026-07-19). Humor rioplatense,
  coherente con el tono "canchero y divertido, cero emojis" ya decidido. Es el chip que más
  personalidad le da a la marca y el más compartible.
- ✅ **Tiene que diferenciarse de "Primera cita" por debajo**, o son el mismo filtro con dos
  nombres. Lectura acordada: *Primera cita* = se puede **hablar** (tranqui, no ruidoso,
  mesa). *Salida con chongo* = luz baja, tragos, barra, ambiente, **cerca**; charlar no es
  el objetivo.
- ✅ **LOS 4 DE LA HOME — DECIDIDO (2026-07-19, tanda 4)**: **Salida con amigos · Salida con
  chongo · Salir a bailar · After office.** El resto (Primera cita · Cumpleaños · Cena
  familiar · Plan tranqui · Merienda) queda detrás de "ver más".
- ✅ **Criterio de selección: cobertura de EJES distintos, no popularidad.** Si los 4 se
  pisan se desperdicia la home — "Primera cita" + "Salida con chongo" + "Plan tranqui"
  devuelven por debajo casi lo mismo (tranqui, luz baja, no ruidoso). Los cuatro elegidos
  cubren cuatro intenciones separadas:

| Chip | Eje |
|---|---|
| Salida con amigos | Grupo / social — el caso más frecuente, el gesto default |
| Salida con chongo | De a dos — cubre el eje romántico **y** fija el tono de marca |
| Salir a bailar | Noche fuerte — cero solape con los otros tres |
| After office | Día de semana — los otros tres son de finde |

- ✅ **Chips FIJOS en v1**; la rotación por día/hora (martes 18h → "After office"; sábado 22h
  → "Salir a bailar") queda como **mejora futura**, cuando haya datos de uso reales. Motivo:
  predecible, el usuario aprende dónde está cada uno, y una home que cambia sola hace que no
  encuentres lo que viste ayer.
- ⚠️ **Riesgo anotado — "Salida con amigos" es el que menos filtra de los cuatro.** Si
  devuelve 8.000 lugares no cumplió la promesa de "no armes un filtro, tocá lo que te pasa".
  Por debajo tiene que ser específico (bares + cervecerías + `$$` + para grupos), no un cajón
  de sastre.
- ✅ **"Salida con chongo" va en la home**, riesgo de marca asumido explícitamente: es el chip
  más compartible y el que fija el tono canchero ya decidido. El riesgo con dueños
  conservadores es real pero acotado — **ellos entran por el panel B2B, no por la home**.
- ⚠️ Nota de marca: "Salida con chongo" es una decisión de identidad, no solo un tag — un
  dueño conservador puede mirarlo torcido. Fer lo pidió sabiendo el registro.

#### Faceta 7 — Zona ✅ VALIDADA (2026-07-19)

Es el **default de la búsqueda** (Fer: "fundamental"; primero elegís zona). No es un tag:
es un selector propio, resuelto por **geometría** sobre el lat/lng de Overture (dato propio,
sin problema de ToS).

- ✅ **Principio rector: GRANULARIDAD ASIMÉTRICA.** La grilla sigue la densidad de salidas,
  no la geografía administrativa. Motivo medido: CABA tiene ~13.835 gastronómicos y el
  conurbano ~13.848 repartidos en 40 partidos — **Palermo solo tiene más lugares que Zona
  Sur entera**. Un sistema de 48 barrios + 40 partidos trata igual a Palermo (miles) que a
  Villa Riachuelo (casi nada), y ninguna de las dos resulta una zona útil. Más fina donde
  hay salida, más gruesa donde no la hay.
- ✅ **Dos niveles: Región (4) → Zona de salida (~44).** Región: CABA · Zona Norte · Zona
  Oeste · Zona Sur. Nunca se ven las 44 juntas: elegís región y ves 7-19.

##### CABA — ~19 zonas agrupadas (NO los 48 barrios oficiales)

| Zonas | Nota |
|---|---|
| Palermo Soho · Palermo Hollywood · Botánico / Alto Palermo · Las Cañitas | **Palermo SÍ se subdivide** (4 zonas) |
| Villa Crespo · Chacarita y Colegiales · Villa Urquiza y Coghlan | Chacarita absorbe Villa Ortúzar |
| Belgrano · Núñez · Saavedra | |
| Recoleta · Retiro y Microcentro · Puerto Madero | |
| San Telmo · Monserrat y Congreso · La Boca y Barracas | |
| Almagro y Boedo · Once y Abasto · Caballito | Balvanera cae en Once/Abasto |
| Devoto y Villa del Parque · Flores y Floresta | Todo el oeste de CABA en 2 |

- ✅ **Se descartaron los 48 barrios oficiales**: nadie dice "voy a Villa Ortúzar" pero sí
  "voy a Chacarita". El criterio es cómo habla la gente, no el decreto.
- ⚠️ **Costo conocido**: Soho / Hollywood / Botánico **no tienen polígono oficial** — hay que
  dibujarlos a mano (límites por avenida). Las otras ~15 salen del GeoJSON oficial de barrios
  de CABA (`data.buenosaires.gob.ar`), gratis y descargable.
- ✅ El buscador del selector matchea **nombres viejos y alias**: escribís "Villa Ortúzar" y
  te lleva a Chacarita. La agrupación no le esconde nada al usuario.

##### Conurbano — corredor + localidad (los DOS niveles)

- **Norte**: Olivos y Vicente López · Martínez y Acassuso · San Isidro · Tigre y Nordelta ·
  San Fernando · San Miguel y Bella Vista · Pilar · Escobar · San Martín y Villa Ballester
- **Oeste**: Ramos Mejía y Haedo · Morón y Castelar · Ituzaingó · Caseros y Tres de Febrero ·
  San Justo · Moreno · Merlo
- **Sur**: Avellaneda · Quilmes · Lomas de Zamora y Banfield · Temperley · Lanús · Adrogué y
  Burzaco · Monte Grande · Berazategui · Florencio Varela

- ✅ **Por LOCALIDAD, no por partido.** La data lo exige: Ramos Mejía (348 lugares) y San
  Justo (234) son el mismo partido (La Matanza) y no son la misma salida ni de lejos.
- ✅ **Solo corredor descartado**: "Zona Sur" abarca de Avellaneda a Florencio Varela, 40 km.
  Inútil para decidir a dónde ir un viernes.

##### Bordes y multiselección

- ✅ **Lugar en el límite — zona primaria + buffer de ~400 m en la búsqueda.** Cada lugar
  tiene **una** zona primaria (asignada por polígono), que es la que se muestra en la card;
  el filtro por zona usa el polígono **expandido 400 m**. Resultado: el bar de Córdoba y
  Dorrego aparece buscando Villa Crespo **y** buscando Palermo Soho. *Una zona en la card,
  dos en la búsqueda* — sin ambigüedad visual y sin perder lugares por 50 metros.
- ✅ **Multiselección libre, sin límite de cantidad.** Es el filtro más natural de combinar
  ("Palermo o Villa Crespo, me da igual"). No contradice el "GPS reemplaza la zona" ya
  decidido: el toggle sigue siendo excluyente contra el conjunto entero de zonas elegidas.

##### Alcance, default y UI del selector

- ✅ **La Plata queda FUERA de v1.** Está a 60 km del centro y es un ecosistema de salida
  propio — nadie combina "Palermo o La Plata". Confirma el bbox ya medido (`lon -59.10/-58.10`
  la deja afuera): **no hay que re-correr la medición de Overture.** Si algún día entra, lo
  hace como **región nueva** (la 5ª) sin tocar nada de lo decidido.
- ✅ **Zona default = la última usada; en la primera visita, ninguna.** El selector arranca
  vacío diciendo "Elegí zona" y no hay resultados hasta elegir. Se descartó "CABA entera por
  default" (13.835 lugares sin filtrar no ayudan a decidir, y el usuario de Quilmes ve
  Palermo) y "detectar por GPS al entrar" (pide permiso apenas abrís la app = fricción en el
  peor momento, y contradice el "GPS como opción secundaria" ya decidido).
- ✅ **UI: buscador con autocompletar + lista de regiones desplegables abajo.** Escribís "pal"
  y aparecen las 4 zonas de Palermo; si no escribís nada, ves las 4 regiones para explorar.
  Sirve al que ya sabe y al que no. El **mapa con zonas tocables se descartó** para v1: caro,
  malo en pantalla chica y las zonas chicas son imposibles de tocar con el dedo.

### Resumen — tamaño de la taxonomía v1

Tipo 10 · Cocina 37 · Actividad 19 · Ambiente 17 · Precio 4 · Momento 9 = **96 tags**,
más 9 chips de Ocasión. _(Conteos corregidos 2026-07-19 — la suma original decía 94; las
listas enumeradas no cambiaron.)_ **Zona va aparte**: selector propio de 2 niveles, 4 regiones y
~44 zonas de salida, resuelto por geometría (no es tag).

## Fuentes de lugares (3 orígenes)

1. ✅ **Google** (lo más fiable) — ✅ **Places API (New)**. Investigación **COMPLETA** en
   `docs/product/investigacion-google-places-2026-07-19.md` (verificada 2026-07-19 contra
   fuentes oficiales). 💡 **El rol de Google queda en revisión** — ver "Arquitectura de
   datos" abajo: los ToS + precios empujan a que Google sea *enriquecedor*, no catálogo.
2. ✅ **Dueños de local** — registran su negocio: dirección, tipo de negocio, qué se hace,
   qué se come, todo lo relacionado. Funciona **en paralelo** a Google: en una búsqueda
   aparecen mezclados los resultados de Google y los cargados por dueños.
3. ✅ **Consumidores — FUERA DE v1** (decidido 2026-07-19). La idea: un usuario descubre un
   lugar que no está y lo registra. Se posterga por el riesgo de lugares falsos, que
   obligaría a construir todo un sistema de moderación/reportes antes de tener usuarios
   reales que lo justifiquen. v1 arranca con Google + dueños, que ya dan catálogo
   suficiente. Mitigación pensada para cuando se retome: comentarios de otros usuarios +
   indicador "existe / es real"; al 5to-6to reporte, banner "muchos usuarios dicen que no
   existe".

### Arquitectura de datos — hallazgos de la investigación (2026-07-19)

Los cinco hechos verificados que condicionan el diseño (detalle y citas en el doc de
investigación):

- ✅ **Solo `place_id` se puede persistir** indefinidamente. Nombre, dirección, teléfono,
  horarios, rating: **prohibido cachearlos**. Fotos: ni siquiera se puede guardar el
  identificador de la foto.
- ✅ **La ficha completa que definimos es tier Enterprise** = $20/1.000, con solo **1.000
  gratis/mes**. Ojo: `displayName` (el nombre del lugar) ya es tier Pro.
- ✅ **Se factura por request, no por lugar devuelto** — una búsqueda que trae 20 lugares
  es 1 solo evento. La búsqueda no es el problema.
- 🔴 **Cada foto mostrada es una request facturable** ($7/1.000, **1.000 gratis/mes**).
  Una lista de 20 cards con foto = 21 eventos. **50 búsquedas agotan el cupo gratis
  mensual de fotos.** Es el mayor multiplicador de costo de toda la app.
- ✅ **El crédito de USD $200/mes ya no existe** (desde marzo 2025): son cupos por SKU.

✅ **ARQUITECTURA DECIDIDA (2026-07-19)** — invertir el rol de Google: **catálogo propio
persistido** (Overture/FSQ + lugares de dueños + `place_id` como clave) → **buscar y
filtrar gratis en Postgres con la taxonomía propia** → **Google solo al abrir la ficha**,
para horarios y rating. Google deja de ser el catálogo y pasa a ser el enriquecedor.

- ✅ **DECIDIDO — el listado va SIN foto de Google.** Cards con nombre, tags propios, zona
  y rating; la foto de Google aparece solo al abrir la ficha. Las fotos de dueño sí se
  muestran siempre (son propias y gratis, y le dan valor a la suscripción B2B).
  **Motivo — la cuenta a 5.000 búsquedas/mes**: foto en cada card ≈ **$693/mes** vs foto
  solo en ficha ≈ **$3,50/mes**. Doscientas veces más caro por una decisión visual.
  Bonus: coincide con el "minimalismo con carácter" ya elegido.
#### ✅ DESBLOQUEADO — Overture MEDIDO en AMBA (2026-07-19)

Medición propia con DuckDB sobre `s3://overturemaps-us-west-2/release/**2026-06-17.0**/theme=places/type=place`.
Bbox AMBA `lon -59.10/-58.10 · lat -35.05/-34.28`. **282.865 POIs totales** en el bbox.

| Métrica (gastronómicos) | AMBA | CABA sola |
|---|---|---|
| **Total** | **27.683** | **13.835** |
| Con nombre | 100% | 100% |
| Con dirección | 98% | 99% |
| Con teléfono | **86%** | 87% |
| Con redes sociales | **98%** | 97% |
| Con website | 41% | 48% |
| `confidence` ≥ 0.5 | 71% | 72% |

- ✅ **VEREDICTO: el catálogo propio se sostiene. Overture alcanza y sobra.** CABA tiene
  **13.835 vs los 5.938 de OSM** — más del doble. Y la calidad es otra liga: **86% de
  teléfonos vs el 12% de OSM**.
- ✅ **Hallazgo grande — 98% trae redes sociales.** Ya estaba decidido mostrar las redes del
  lugar en la ficha: **vienen gratis en Overture**, no hay que pedirlas a Google.
- 🔴 **Overture NO tiene horarios.** El schema (verificado) es: `id · geometry · categories ·
  confidence · websites · emails · socials · phones · brand · addresses · names · sources ·
  operating_status · basic_category · taxonomy · version · bbox`. **No existe campo de
  horarios.** → Los horarios salen sí o sí de Google, en vivo, al abrir la ficha. Confirma
  la arquitectura híbrida ya decidida.
- ✅ **UMBRAL DE `confidence` — DECIDIDO (2026-07-19, tanda 5).** `confidence` promedio
  0.644; 29% por debajo de 0.5. **La decisión clave no es el número sino dónde vive el
  corte**: se importa **TODO** lo que da Overture, `confidence` se guarda **como columna**, y
  el filtro se aplica **en la query**, con el umbral **configurable desde `/admin`** — mismo
  patrón ya elegido dos veces (precios y cupo de mensajes IA).
  - ✅ **Umbral inicial: 0.5.** Deja ~19.650 gastronómicos en AMBA — todavía **más del triple**
    de los 5.938 que tenía OSM en CABA — y descarta la cola larga donde vive la basura.
  - ✅ **Por qué NO cortar en el import**: parece más limpio y es peor. Si en dos meses el
    umbral resulta mal calibrado, cortar en el import obliga a **re-correr todo contra S3**;
    cortar en la query es un `UPDATE` con efecto instantáneo. Los 27.683 registros no pesan
    nada en Postgres.
  - ✅ **`operating_status` se filtra SIEMPRE, aparte del confidence.** Un lugar marcado como
    cerrado no entra ni con confidence 0.9 — no es cuestión de confianza, está cerrado.
  - ✅ **Los que no pasan el umbral NO se borran: quedan invisibles.** Están en la tabla, sin
    publicar. Bajar el umbral después los revive sin costo.
  - ✅ **El reclamo de un dueño sobrescribe el umbral.** Ficha reclamada y aprobada
    manualmente por Fer se publica aunque Overture le haya dado 0.3: la aprobación manual es
    mejor señal que el score.
  - 💡 **Sin decidir**: regla compuesta que rescate lugares de la cola — confidence bajo
    **pero** con teléfono + redes + dirección casi seguro es real (86% tiene teléfono, 98%
    redes). Con el corte en la query, probarlo después es gratis.
- ⚠️ **Overture deprecó `categories`**, reemplazado por `basic_category` + `taxonomy`
  (struct con `primary` / `hierarchy` / `alternates`). **`categories` se elimina en la
  release de septiembre 2026** → construir contra `taxonomy` desde el día 1.
- 💡 La taxonomía de Overture mapea razonable contra la nuestra: `argentine_restaurant` (435),
  `pizza_restaurant` (4.043), `sushi_restaurant` (512), `peruvian_restaurant` (206),
  `wine_bar` (121), `cocktail_bar` (89), `tapas_bar` (82) — sirve como **semilla** del
  import, no como reemplazo de la taxonomía propia.
- 📁 Scripts de la medición en el scratchpad de la sesión (`ov_final.py`, `ov_cats.py`).

#### ✅ RESUELTO — Licencia de Overture places (2026-07-19, tanda 4)

Era el **último pendiente estructural**: si Overture places no permitía uso comercial, se
caía el catálogo propio y con él la arquitectura híbrida entera. **No es el caso.**

- ✅ **Places NO es ODbL.** Ese era el riesgo real y no existe. La ODbL (share-alike — te
  obligaría a liberar tu base derivada) aplica **solo** a los themes Base, Buildings,
  Division y Transportation. **Places está explícitamente fuera.**
- ✅ **La licencia de places es POR REGISTRO**, según el campo `sources` de cada lugar. Las
  tres posibles son permisivas y **todas admiten uso comercial**:

| Fuente | Licencia | Obligación |
|---|---|---|
| Meta · Microsoft · PinMeTo · Krick · RenderSEO · DAC · BrightQuery | **CDLA-Permissive 2.0** | Incluir el texto de la licencia |
| Foursquare | **Apache 2.0** | Copyright de Foursquare + referencia a su `NOTICE.txt` (`https://opensource.foursquare.com/places-notice-txt/`) |
| AllThePlaces | **CC0 1.0** | Ninguna |

- ✅ **CDLA-Permissive 2.0 NO es viral.** Solo pide acompañar el texto de la licencia al
  compartir *los datos*; no se aplica al producto ni a los resultados derivados del análisis.
  Se puede **persistir, modificar, filtrar y monetizar** — exactamente lo que hace la
  arquitectura híbrida.
- ✅ **VEREDICTO: la licencia NO bloquea nada.** El catálogo propio se sostiene también por
  el lado legal. Costo de cumplimiento: una línea de atribución en `/legales` o en la ficha,
  al lado de la atribución a Google que ya estaba decidida.
- ✅ **Atribución: se usa el string COMPLETO de las 9 fuentes que publica Overture**, sin
  medir la mezcla real de AMBA. Se intentó medir con DuckDB qué proporción viene de
  Foursquare (la única fuente que pide algo más que el texto de la licencia), pero
  **la medición se abortó por costo/beneficio**: el `unnest(sources)` obliga a leer una
  columna anidada del dataset global antes de filtrar por bbox y pasó de 10 minutos sin
  terminar. El dato solo servía para *acortar* el texto de atribución — poner el completo
  es correcto siempre. Ningún impacto en decisiones.
- 📌 **Para la implementación**: pegar la atribución completa en `/legales` (Meta ·
  Microsoft · PinMeTo · Krick · RenderSEO · DAC · BrightQuery bajo CDLA-Permissive 2.0 ·
  Foursquare bajo Apache 2.0 con su copyright y NOTICE · AllThePlaces bajo CC0 1.0), junto
  con la atribución a Google ya decidida. Texto exacto en la fuente.
- 📁 Fuente: `https://docs.overturemaps.org/attribution/`.

#### ✅ RESUELTO — ToS de Google leído textualmente (2026-07-19)

La cita que traía la investigación previa estaba **a medias**:

- ✅ **§3.2.3(b) "No Caching" existe**, pero vive en los **Google Maps Platform Terms of
  Service** (`https://cloud.google.com/maps-platform/terms/`, últ. mod. 2026-06-23), **NO**
  en los Service Specific Terms. Por eso no se encontraba.
  > *"Customer will not cache Google Maps Content except as expressly permitted under the
  > Maps Service Specific Terms."*
- 🔴 **§3.2.4 "Retention" NO EXISTE** — §3.2.4 es "Benchmarking". **Esa cita se descarta.**
- ✅ **La excepción real para Places** está en Service Specific Terms, Sección B §14
  (últ. mod. 2026-06-10). **§14.3 Caching**:
  > *"Customer may temporarily cache latitude and longitude values from the Places API for
  > up to 30 consecutive calendar days, after which Customer must delete the cached
  > latitude and longitude values."*
  
  **Ese es el texto completo de §14. Solo lat/lng, nada más.**
- ✅ **§3 Sección A "Google ID Caching"**: `place_id` se puede cachear sin límite temporal.
- 🔴 **CONFIRMADO: los horarios NO se pueden cachear.** El régimen es *prohibición por
  defecto + excepciones tasadas*; Places solo tiene excepción para lat/lng. Contraste que
  lo confirma: cuando Google permite cachear contenido sustantivo lo dice con tabla
  explícita (Pollen API §16.2 con 365 días; Solar API §20.2). Places no la tiene.
- ⚠️ **Es inferencia por omisión, no una frase literal de Google.** Google nunca escribe "no
  podés cachear horarios" — se deduce de aplicar §3.2.3(b) a la ausencia de excepción. Es
  sólido, pero si alguna vez pesa legalmente, confirmar con Google.
- ⚠️ **Territorialidad**: estos ToS aplican a cuentas **fuera del EEA** (cuenta argentina =
  aplican). Si alguna vez se factura desde la UE, rige otro documento.
- ✅ **Impacto neto: NINGÚN cambio a la arquitectura ya decidida.** `place_id` persistido +
  catálogo propio de Overture + Google en vivo solo en la ficha. Lo que sí cambia es que
  **se cierra la puerta** a la idea de "cachear horarios 30 días" que se creía disponible.
- 📁 Contratos en texto plano en el scratchpad (`gmp_tos.txt`, `gmp_service.txt`).
- ✅ **Atribución obligatoria**: logo de Google al mostrar datos sin mapa; crédito al autor
  en fotos/reviews. ("Powered by Google" NO es el wording correcto.)

## Presentación de resultados

- ✅ **Lista como default + botón "ver en mapa"** (opción C, acordada por ambos): la lista
  (cards con foto, nombre, tags, rating, zona) sirve para comparar; el mapa responde "qué
  hay por acá". Patrón conocido (Airbnb, TheFork) = cero curva de aprendizaje.

## Reviews y ficha de lugar

- ✅ **La app NO tiene reseñas ni puntuación propias** _(por ahora — revisable)_. Se muestra
  el **rating de Google** cuando el lugar viene de Google _(por ahora)_. Los comentarios de
  usuarios quedan solo como mecanismo de verificación de existencia (lugares cargados por
  consumidores).
- ✅ Principio de la ficha: **"simple no es pobre"** — info suficiente para que el usuario
  decida, sin ruido.
- ✅ La ficha muestra: teléfono, dirección, horarios, link del lugar, **rango de precios**
  y **redes sociales del lugar**.
- ✅ **Fotos: prioridad dueño → fallback Google.** Si el dueño reclamó la ficha y subió
  fotos, se muestran las suyas; si no, las de Google. Nota técnica: las fotos de Google se
  cobran por request y NO se pueden persistir; las del dueño son propias y gratis.
- ✅ **Botón "cómo llegar"**: deep link a Google Maps — saca fricción, cero costo,
  coherente con "la app no reserva, te empuja a ir".

## Pantallas (inventario inicial)

💡 Primer volcado del usuario (2026-07-19) — inventario, no diseño; sin orden de prioridad:

- Login · Registro · Recupero de contraseña · Cambio de contraseña
- ✅ **Sin landing separada: el Home ES la entrada** (adondesalimos.com.ar cae directo en
  el buscador). 💡 Excepciones puntuales posibles: página "próximamente" pre-lanzamiento
  y una página `/premium` para vender la suscripción.
- ✅ **Home = Search, misma pantalla, para todos.** El usuario logueado usa el MISMO
  buscador; la sesión agrega capacidades (armar votación, suscribirse, Mi cuenta), no
  cambia la pantalla.
- Search **sin IA** (v1) y **con IA** (premium, después)
- Resultado de búsqueda (lista default + vista mapa)
- Wizard con IA
- Card / ficha de cada resultado
- `/admin` (Fer)
- Panel del dueño ("Mi negocio")
- Mi cuenta — datos del usuario; posibles tabs: datos, pagos/suscripción, eliminar cuenta

✅ **Faltantes validados (2026-07-19)** — entran a v1:

- **Crear votación** · **Votar como invitado** (sin cuenta, vía link) · **Resultado de
  votación** — consecuencia directa de la feature ya decidida.
- **Registrar / reclamar negocio** — el flujo por el que se gana el rol dueño.
- **Verificación de email** — anti-abuso ya decidido.
- **Checkout premium (MercadoPago)**.
- **Términos y privacidad** — no opcional si se cobra con MP y se guardan datos personales.
- **404 amigable**.
- **Cola de aprobación de dueños dentro de `/admin`** — la aprobación manual ya decidida
  necesita su pantalla.
- **Estadísticas de la ficha en el panel del dueño** — es lo que justifica la suscripción
  B2B. Puede ser una sección del panel, no pantalla aparte.

❌ **FUERA de v1**: **cargar lugar nuevo (consumidor)** — ver "Fuentes de lugares" §3.

### Diseño de las pantallas — ⏳ PENDIENTE, es trabajo de spec (2026-07-19, tanda 5)

Lo de arriba es **inventario** (qué pantallas existen), no diseño. Falta layout, jerarquía,
componentes y flujos. Fer lo señaló al cerrar el volcado. **Dónde vive ese trabajo:**

- ✅ **El diseño de cada pantalla vive en el spec de SU feature**, no en un spec de diseño
  global. La pantalla de resultados se diseña en el spec de Búsqueda; la ficha, en el de
  Ficha. Un spec de "todas las pantallas" se desactualiza apenas cambia la primera feature y
  obliga a decidir en el vacío, sin el modelo de datos que la pantalla va a mostrar.
- ✅ **Excepción — el SISTEMA DE DISEÑO BASE sí se hace UNA vez, temprano**: design tokens
  (ya decididos: `#0F0F0F` / `#1A1A1A` / `#F59E0B` / `#F5F5F5`) + los componentes compartidos
  que aparecen en toda la app (card de lugar, chip de filtro, botón, input de búsqueda,
  bottom sheet). Va **dentro del scaffold (paso 0)**, no como spec aparte. Motivo: es lo que
  hace que "cambiar la paleta = tocar 6 variables", que es una decisión ya tomada.

## Usuarios y roles

- ✅ Tres roles:
  1. **Consumidor** — el que busca a dónde ir.
  2. **Dueño de local** — registra su negocio.
  3. **Admin** (el usuario/Fer) — panel en ruta `/admin` con todas las estadísticas de la app.
- ✅ Va a hacer falta **login** al menos para cargar lugares (dueños y consumidores).
- ✅ **El consumidor que solo busca navega anónimo** — la cuenta se pide únicamente para
  cargar lugares / comentar. _(Revisable más adelante: si hace falta más data para el panel
  de estadísticas, se puede pasar a registro para todos.)_
- ✅ **Registro único, sin elección de rol** (opción B): todos se registran igual y son
  consumidores por default. El rol **dueño se gana con una acción**: "Registrá tu negocio"
  (lugar nuevo) o "¿Es tu negocio? Reclamalo" (lugar ya existente, ej. venido de Google) —
  mismo flujo con dos entradas. La cuenta dueño conserva también el rol consumidor.
- ✅ Ambas entradas del flujo dueño terminan en una **cola de aprobación manual del admin
  en `/admin`** (al menos al principio; verificación automatizada = versión 2).
- ❓ Cómo **verificar dueños** más allá de la aprobación manual (que el que reclama sea el
  dueño real) — mecanismo automatizado sin resolver, no bloquea el arranque.
- ❓ **Qué pasa con las fotos cuando se revoca un reclamo** _(abierta el 2026-07-21, al
  implementar AUTH F3)_. Al revocar, los **datos** del dueño ya vuelven a Overture, pero las
  **fotos** siguen publicadas. La pregunta no es técnica: la revocación tiene dos causas
  distintas y hoy el código las trata igual.
  - Revocar **por abuso** (se hizo pasar por dueño, subió fotos ofensivas) ⇒ las fotos tienen
    que desaparecer ya. Dejarlas convierte la revocación en un gesto a medias.
  - Revocar **por corrección** (el local cambió de manos, se equivocó el admin) ⇒ las fotos
    son una contribución real al catálogo, y borrarlas tira justo el valor que el free
    generoso vino a comprar ("cada ficha reclamada mejora el catálogo gratis").
  - 💡 **Recomendación**: no elegir una sola respuesta — **un checkbox "quitar las fotos" en
    el rechazo de `/admin`**, default apagado. Le pide al admin el único dato que el código no
    puede deducir (por qué revocó) y evita una trampa técnica fea del lado de la ficha.
  - **No urge**: hoy no hay dueños reales y solo afecta a lugares de Overture que ya estaban
    publicados. Detalle técnico completo en `docs/product/BACKLOG.md`.
- ✅ **Panel del dueño propio ("Mi negocio"), separado del `/admin`**. Tres niveles:
  consumidor (ficha pública) → dueño (panel de SU negocio: editar ficha, fotos,
  estadísticas, suscripción) → admin/Fer (ve todo).

## Testing / QA

- ✅ **Playwright** para pruebas QA en vivo.

## Stack y arquitectura

- ✅ Mismo stack que StressPlan — Next.js + TypeScript + Drizzle ORM + Tailwind CSS + Vitest.
- ✅ BD: **Postgres en Docker Desktop para desarrollo local**; en producción **Neon**.
- ✅ Auth: **better-auth** (replicar StressPlan). Encaja con registro único + roles que se ganan.
- ✅ Hosting: **Vercel** (aún no deployado; decisión tomada).
- ✅ Pagos: MercadoPago (ver Monetización).
- ✅ **Dominio: adondesalimos.com.ar** — ya comprado en NIC Argentina.
- ✅ **Cloudflare** (DNS/proxy) + **Resend** para mails — tal cual StressPlan.

### Reuso desde StressPlan (código/lógica para robar)

- ✅ Integración MercadoPago **suscripciones — YA FUNCIONA en StressPlan** (billing
  checkout/cancel, webhook, sync admin): el spec 7 la reutiliza, no la reinventa. Las dos
  cosas a confirmar quedaron **✅ RESUELTAS al escribir el spec 7 (2026-07-24, verificado en
  el código de StressPlan)**: **(a)** las suscripciones usan **Checkout Bricks (Card Payment
  Brick embebido) + `POST /preapproval`** — el redirect de Checkout Pro es solo del flujo à
  la carte, que acá no existe; **(b)** **sí hacen falta usuarios vendedor y comprador de
  prueba** (sandbox de MP) para el QA del cobro — pagar siempre con el comprador test, nunca
  con la cuenta vendedor (lecciones MP de StressPlan). Detalle en
  `docs/specs/planned/MONETIZACION.md` § Incógnitas resueltas.
- ✅ Prompt + chat behavior del chat IA — **StressPlan tiene una buena base** de comportamiento
  del chat y prompt; el spec del chat IA (candidato a spec 8) parte de ahí, no de cero.
- ✅ Email verificado obligatorio + rate limit por IP/dispositivo.
- ✅ Setup de better-auth.

## Monetización

_Tema abierto — el usuario avisó que requiere mucha charla. Dos vías confirmadas como
dirección, detalles sin cerrar:_

- 💡 **Vía B2B — dueños pagan por destacar su lugar.** Tensión a cuidar (señalada por
  Claude, compartida): si los destacados ensucian los resultados se pierde la confianza en
  la app — deben estar claramente marcados y acotados.
- 💡 **Vía B2C — premium para consumidores**, centrado en IA:
  - Chat con IA que sugiere lugares según lo que el usuario pida, con **mensajes limitados
    según plan**.
  - Modo wizard: la IA hace preguntas guiadas y sugiere lugares.
  - **Muy parecido a StressPlan** — ✅ se pueden reutilizar prompt y chat behavior de
    StressPlan como base.
  - Más features free-vs-premium a definir.
  - ✅ **El chat con IA va en un spec propio (candidato a spec 8), NO dentro del spec 7**
    (decidido 2026-07-22). El spec 7 es "cómo se cobra" (MercadoPago + gates); el chat IA es
    "qué hace el producto premium" (comportamiento del chat, cupo de mensajes, prompt, control
    de costo de la API de Claude) — feature grande de por sí. Va **después** de que la
    monetización exista para solventar el costo de la API (línea de abajo). No meterlo en el 7
    por inercia.
- 💡 La búsqueda con IA se posterga hasta que la monetización solvente el costo de la API
  de Claude (ya anotado en Concepto general).
- ✅ **Medio de pago: MercadoPago** (suscripciones / bricks). Verificado en código: StressPlan
  usa MP (`app/api/billing/checkout`, `billing/cancel`, webhook `api/webhooks/mercadopago`,
  panel de sync MP en admin) — **reutilizar esa integración**. (Los paquetes Stripe en su
  package.json son dependencias muertas.)
- ✅ **Dueños: suscripción mensual** (no pagos puntuales por destaque) — recurrente,
  predecible, y el dashboard de estadísticas justifica la recurrencia.
- 💡 Reglas anti-desconfianza para destacados (propuesta Claude, bien recibida): etiqueta
  "Destacado" visible + **solo aparece si matchea la búsqueda** (compra orden, no relevancia).
- 💡 Suscripción de dueño incluiría: destaque + estadísticas de ficha (vistas, taps en
  "cómo llegar"/teléfono, búsquedas que lo encontraron) + ficha enriquecida.
- 💡 **Instrumentar métricas de ficha desde el día 1** aunque el cobro llegue después — el
  histórico es el argumento de venta ("tu ficha tuvo 400 visitas este mes").
- 💡 Free con probadita de IA (2-3 mensajes) para convertir; wizard guiado es más barato en
  tokens que chat libre.
- 💡 Principio rector propuesto: **lo core (búsqueda clásica) gratis siempre**; el premium
  vende comodidad, no acceso.
- ✅ **UN solo plan premium B2C que agrupa todo** (no features sueltas): chat IA + wizard
  (con cupo mensual de mensajes), votaciones ilimitadas + historial + IA arma shortlist.
  Free: búsqueda completa sin login, 1 votación activa, probadita de IA (2-3 mensajes).
  Si hace falta, a futuro se agrega un tier superior con más mensajes.
- ✅ Resumen del modelo: **B2B** = suscripción mensual dueño (destaque + estadísticas +
  ficha enriquecida) · **B2C** = premium único.
### Precios — ✅ DECIDIDO (2026-07-19)

Precios de lanzamiento, **revisables** ("luego se puede ir ajustando", Fer).

| Plan | Precio | Fundamento |
|------|--------|------------|
| **B2B — dueño** | **ARS 15.000/mes** | Medio del rango que Fer estimó (10-20k); por debajo del umbral de 20k donde el dueño empieza a dudar. Referencia: StressPlan Starter = 22.500 |
| **B2C — premium** | **ARS 7.000/mes** | Muy por debajo de Spotify/Netflix (30-40k), que es la comparación que hace el usuario |

**Objetivo declarado**: que la app se pague sola (infra + APIs); si además es negocio, mejor.

#### Estructura de costos verificada (escala de arranque)

Supuestos: 3.000 fichas abiertas/mes, 100 usuarios premium.

| Concepto | USD/mes |
|----------|---------|
| Google Places (fichas Enterprise + fotos) | ~$54 |
| Infra (Vercel + Neon + Resend) | ~$60 |
| Claude API | ~$50 |
| **Total** | **~$165 ≈ ARS 236.000** (TC 1.430) |

- ✅ **Punto de equilibrio: ~16 locales pagando.** A 4 altas/mes (proyección de Fer),
  se alcanza cerca del **mes 4**. Los 50 locales del año 1 no son necesarios para
  cubrir costos — de ahí en adelante es ganancia.
- ✅ **La IA no es un costo relevante**: un premium con 50 mensajes/mes cuesta ~ARS 250
  con Haiku 4.5 o ~ARS 715 con Sonnet 5 (con prompt caching, que lee el system prompt
  a ~0,1x). Precios verificados 2026-07-19: Haiku 4.5 $1/$5 por MTok · Sonnet 5 $3/$15
  ($2/$10 promo hasta 2026-08-31) · Opus 4.8 $5/$25.
- ⚠️ **Expectativa realista del B2C**: app de nicho que se usa ~2 veces por mes → la
  conversión a premium va a ser baja (1-2%). **El negocio del año 1 es el B2B**; el
  premium es upside, no el sostén.

#### Qué incluye cada plan — ✅ DECIDIDO (2026-07-19, tanda 5)

Era el último tema abierto de monetización.

##### B2B — dueño ✅ VALIDADO

**El free del dueño es generoso a propósito.** Razón de negocio: cada dueño que reclama su
ficha y la completa **mejora el catálogo gratis**. Si se le cobra por existir bien, no
reclama, y se pierde el dato — que vale más que la suscripción marginal.

| | Free (reclamó su ficha) | Pago — ARS 15.000/mes |
|---|---|---|
| **Ficha** | Editar datos, tags de las 7 facetas, hasta **3 fotos**, horarios propios | Hasta **15 fotos**, descripción larga, link a carta/menú, campo "novedad" (ej. "happy hour 18-20") |
| **Destaque** | No | Sí, con etiqueta visible |
| **Estadísticas** | Teaser: "tu ficha tuvo **N** visitas este mes", sin desglose | Vistas · taps en teléfono / cómo llegar / redes · **qué filtros lo encontraron** · comparación vs mes anterior · histórico |

- ✅ **El teaser de estadísticas es el motor de conversión**: el dueño ve el número, no ve el
  desglose. El dato "qué búsquedas te encontraron" es el que ningún dueño tiene hoy por
  ningún otro medio.
- ✅ **La suscripción del dueño es POR LUGAR, no por cuenta** (decidido 2026-07-24; ya implícito
  en AUTH decisión 18 "`owner_plan` por lugar" y en el pricing "15.000 por ficha"). Un dueño con
  3 locales que los quiere a los 3 en pago paga **3 suscripciones**; puede tener el lugar A en pago
  y B/C en free a la vez. Razón: el beneficio pago es **intrínsecamente por ficha** — el destaque
  tiene cupo (máx 3 por búsqueda, rotativo) y las stats son de esa ficha. Una suscripción única que
  encendiera todos los lugares del dueño rompería la economía del destaque (el de 20 locales pagaría
  igual que el de 1 y saturaría los destacados). En datos: `subscriptions` (la tabla de StressPlan)
  suma un `place_id` **nullable** — `null` = premium B2C del usuario; con valor = suscripción B2B de
  ese lugar; `user_id` (quién paga) siempre. Un usuario puede tener 1 fila B2C + N filas B2B.
- 💡 **Descuento escalonado multi-local** (idea de Fer, 2026-07-24, puerta abierta, NO v1): base por
  lugar, con descuento por volumen para el dueño de varios locales (2do -X%, 3ro -Y%, etc.). Se puede
  sumar después sin romper el modelo por-lugar. → `BACKLOG.md` § mejoras futuras.

##### B2C — premium ✅ VALIDADO

| | Free | Premium — ARS 7.000/mes |
|---|---|---|
| Búsqueda + filtros completos | ✅ todo, sin login | ✅ |
| Votaciones | 1 activa a la vez | Ilimitadas + historial + IA arma la shortlist |
| Chat IA / wizard | Probadita 2-3 mensajes (una vez) | **30 mensajes/mes** |

- ✅ **30 mensajes/mes** (decidido por Fer, 2026-07-19). Se propuso 100 y Fer bajó a 30 con
  el criterio correcto: **"no regalemos, para dar más hay tiempo"**. Subir un cupo es un
  regalo; bajarlo es una traición al que ya pagó. Costo verificado: 30 mensajes con Haiku
  4.5 ≈ **ARS 150** sobre un plan de 7.000 (**2% del ingreso**) — margen de sobra.
- 💡 **Bonus estacionales** (idea de Fer, sin cerrar): regalar mensajes extra a todos los
  premium en fechas puntuales — mes del amigo, Navidad. Buen gancho de retención y
  perfectamente coherente con arrancar bajo.
- 📌 **Consecuencia técnica — el modelo de datos debe separar `cupo_del_plan` de
  `mensajes_otorgados_este_mes`.** Si el cupo se lee directo del plan, un bonus obliga a
  tocar el plan de todos (y a acordarse de revertirlo). Con un contador de otorgados por
  usuario y por mes, un bonus es un `INSERT`. Mismo criterio ya decidido para los precios:
  **el cupo vive en base de datos y se ajusta desde `/admin`**, no en el código.
- ❌ **Favoritos / listas guardadas — FUERA de v1** (2026-07-19). Se propusieron como
  agregado de retención (free = 1 lista, premium = listas múltiples con nombre) y Fer los
  mandó a mejoras futuras para no agrandar el alcance. Anotado en `BACKLOG.md`.

##### Regla de destacados — ✅ DECIDIDA (2026-07-19)

- ✅ **Máximo 3 destacados por resultado de búsqueda** (Fer: "me gustan los impares"),
  arriba, con etiqueta visible, y solo si matchean los filtros (esto último ya estaba
  decidido desde la tanda 1).
- ✅ **La posición destacada ROTA** entre todos los suscriptos que matchean esa búsqueda.
- ✅ **Por qué hay cupo**: sin límite, el día que se vendan 30 suscripciones en Palermo el
  usuario scrollea 30 resultados con etiqueta "Destacado" antes de ver algo orgánico — la
  etiqueta deja de significar nada y se pierde la confianza en la app. Es la tensión que Fer
  marcó desde la tanda 1. Fijarlo ahora cuesta cero; fijarlo con 30 dueños ya acostumbrados
  a salir siempre destacados es una pelea.
- ⚠️ **Fricción comercial asumida**: un dueño que paga puede no verse destacado en una
  búsqueda concreta. Se compensa con transparencia en el panel — *"tu ficha estuvo destacada
  en X de las Y búsquedas donde apareció"*, que además alimenta las estadísticas ya
  decididas.

#### 🔴 Riesgo estructural — costos dolarizados, ingresos en pesos

Google, Neon, Vercel y Anthropic cobran en **USD**; los planes se cobran en **ARS**. Un
precio fijo se licúa con la inflación en meses.

- ✅ **Decisión de diseño**: el precio vive en **base de datos y se ajusta desde `/admin`
  desde el día 1** — no en un env var, no como deuda técnica. StressPlan ya tiene este
  problema identificado en el spec `MP_INFLATION_PRICING` (en `planned`): acá nace igual,
  así que se resuelve de entrada.

## Feature: votación en grupo ("¿a dónde salimos?")

- ✅ **Anotada en serio** (idea de Claude, al usuario le encantó): armar una shortlist de
  lugares, compartirla por link (ej. al grupo de WhatsApp), los amigos **votan sin
  necesidad de cuenta**, gana uno. Resuelve la decisión en grupo y cada link compartido
  trae gente nueva → crecimiento viral.
- ✅ Diseño v1 (casos de uso discutidos y bien recibidos): el **creador necesita cuenta**,
  los **votantes jamás** (ahí está el loop viral); los votantes NO agregan opciones ("el que
  arma la votación arma la cancha"; "sugerir lugar" = mejora futura); el creador cierra
  cuando quiere y desempata él; shortlist de 2-5 lugares; link expira a las 48-72hs.
- ✅ **Freemium: free = UNA votación activa a la vez** (no "una por mes"): cubre el caso
  real de una persona normal, no frustra, y mata el incentivo de multi-cuentas (una segunda
  cuenta solo daría dos votaciones simultáneas — caso rarísimo).
- ✅ Premium (de esta feature): votaciones simultáneas ilimitadas + la IA arma la shortlist
  + historial de votaciones.
- ✅ **Anti-abuso v1**: email verificado obligatorio para crear cuenta + rate limit por
  IP/dispositivo — **código/lógica ya existe en StressPlan, se saca de ahí**.

## Feature: chat IA (spec 8) — ✅ DECIDIDO (2026-07-25, sesión de specs 6)

Cierra las decisiones abiertas del gate declarado en MONETIZACION ("el spec 8 construye lo
que el premium hace con la IA"). Lo ya decidido antes (30 mensajes/mes, `cupo_del_plan` vs
`otorgados_este_mes`, cupo en DB desde `/admin`, probadita free) no se reabrió.

- ✅ **Scope v1: chat conversacional "armá tu salida" + encender el botón "que la IA arme
  la shortlist" de VOTACION** (mismo backend, dos entradas). El **wizard guiado queda
  fuera de v1** → mejora futura (es otra UX sobre el mismo motor).
- ✅ **Grounding con doble candado — la regla de oro**: (1) la IA consulta el catálogo vía
  **tool-use nativo** (una tool que ejecuta el motor real de `lib/search` con
  `publishedWhere`); (2) el server **valida cada lugar citado** contra los resultados que
  las tools devolvieron en esa conversación — un ID no visto se descarta. Un lugar
  alucinado es un bug de producto, no un detalle. (StressPlan NO usa tool-use — su
  protocolo textual JSON+regex no se porta.)
- ✅ **Modelo: Haiku 4.5** (`claude-haiku-4-5`), con el model id en **`app_settings`**
  (`ai.chat_model`) — pasar a Sonnet 5 es un UPDATE sin deploy, mismo patrón que umbral /
  precios / topes Google. Con **prompt caching** (system prompt + tools a ~0,1x en cache
  read). Costo estimado ya validado: ~ARS 150/premium/mes con Haiku (2% del plan).
- ✅ **UX: pantalla propia `/chat`**, entrada desde header/home; el botón de
  `/votacion/nueva` abre el mismo chat en modo shortlist y el resultado vuelve a la
  votación. Streaming SSE (patrón de StressPlan, portable).
- ✅ **Probadita free: 3 mensajes, una única vez (de por vida), con login**. Sin login no
  hay chat (el cupo necesita identidad). Al agotarse: CTA a premium, nunca un error crudo.
- ✅ **Persistencia: conversaciones por usuario en DB** (con "borrar conversación").
  **Divergencia explícita y justificada** del invariante "agregado puro sin user_id" de
  las tablas de stats: esto es contenido del usuario (como sus votaciones), no telemetría.
  El invariante sigue intacto para `place_impressions_daily` y compañía.
- ✅ **Nada B2B en v1**, y los lugares con `owner_plan='paid'` **no reciben trato
  preferencial** en las respuestas (misma regla anti-desconfianza que los destacados: la
  IA recomienda por relevancia). Mencionar la "novedad" del dueño pago = mejora futura.
- ✅ **Disciplina de costos, mismo criterio que FICHA/Google**: topes de gasto mensuales
  por SKU en `app_settings` + contador de uso; superado el tope el chat **degrada** con
  mensaje claro en vez de facturar; bajar el tope a 0 apaga el SKU sin deploy. **Un solo
  módulo habla con Anthropic** (server-only, la key vive solo ahí — patrón
  `lib/google/places.ts` / `lib/billing/mercadopago.ts` / `lib/storage/r2.ts`).

---

## Estado de la conversación

_Actualizado en la sesión de triaje (2026-07-26). Esta sección es lo primero que lee la
sesión siguiente._

### 📊 Sesión Fable — cerrada (2026-07-26) · #3 DE LA COLA: COSTOS_ADMIN CERRADO ENTERO

Sesión completa en un ciclo: decisiones con Fer → mini-spec → implementación (subagente
`implementador`/Opus) → QA (/qa-spec + en vivo) → build → checklist de cierre.
**Entrega: `docs/specs/done/COSTOS_ADMIN.md` ✅** — tablero de costos en `/admin` + sugeridor
de precio según dólar, QA APROBADO (resumen: `SPECS_ARCHIVO.md#costos_admin`).

- ✅ **Decisiones de Fer (2026-07-26):** mini-spec (no spec 9 formal, ese slot queda para
  curaduría) · el **sugeridor de precio según dólar entra acá** (absorbe el ítem del BACKLOG,
  anotado allá) · los 4 bloques del tablero van todos (chat USD por modelo, Google por SKU vs
  cap, vs mes anterior, cupo del chat) · alerta amarilla al 80%, roja al 100%.
- ✅ **Hallazgo que corrige el handoff:** `calcularCosto` NO existe como función — los
  precios viven inline en `logChatCall` (`lib/ai/logging.ts:9-42`), que solo hace
  `console.log`. El spec (decisión 2) extrae `calcularCostoUsd` + precios como export puro.
- ✅ **Precios verificados, no de memoria:** Anthropic vía skill `claude-api` (Haiku $1/$5,
  Sonnet $3/$15; hay intro $2/$10 hasta 2026-08-31 — se mantiene el sticker, conservador);
  Google vía spec FICHA (details $20/1.000, photos $7/1.000, 1.000 gratis/mes c/u).
- ✅ **Implementado y cerrado en la misma sesión** (implementador/Opus + QA en vivo con
  Playwright y UPDATEs revertidos + build verde). Hallazgo bonus del primer render: el test
  de integración del cupo borra la fila real de `ai_api_usage` → ítem en BACKLOG + lección.
- ✅ **#4 de la cola — mini-spec PULIDO, cerrado entero (2026-07-27)**: pulido UX/UI (filtro
  fantasma, header de marca global, resize de fotos en el browser, INT-05, INT-14) +
  reestructura de `/admin` en tabs client-side (Cola → Precios → Suscripciones → Costos, gate
  único). QA en vivo 7/7 + 6 checkers independientes + build verde.
  [Resumen](../archive/SPECS_ARCHIVO.md#pulido) · spec: `docs/specs/done/PULIDO.md`.
- ⏭️ **Próximo paso: #5 de la cola** — spec de curaduría (candidato a spec 9): Ambiente (0,9%)
  y Momento (0,6%) casi vacíos siendo el diferencial del producto; 8 chips de Ocasión
  apagados; Precio con 0 filas. Especificar herramienta de curaduría en `/admin` para que la
  carga manual sea viable.

### 🔧 Sesión Opus — cerrada (2026-07-26) · #1 DEL TRIAJE RESUELTO: NO ERA BUG

Se investigó el "bug de zonas" (prioridad #1 de abajo). **Resultado: no es un bug.**
`place_zones` es geométricamente correcta — auditadas 12.122/12.122 filas no-primarias,
**todas ≤400 m** del borde de su zona; scripts y motor de búsqueda correctos. El síntoma es
la **decisión 5 de ZONAS (buffer de 400 m) funcionando como se especificó**: las zonas chicas
de CABA tienen un buffer proporcionalmente enorme (+81 % de área en almagro-boedo), así que
~45 % de resultados tienen primaria en zona **adyacente**. El diagnóstico del triaje (abajo)
asumía mal que `la-boca-barracas` eran 2 barrios (son 4, lindan con Boedo/Caballito) y que las
asignaciones eran "imposibles". **Decisión de Fer: documentar y no tocar comportamiento.** Se
abrió el ítem de producto "revisar buffer de zonas" en `BACKLOG.md` por si molesta en uso real.
De paso quedó resuelto el ítem viejo del escape-room (mismo fenómeno). Detalle:
`docs/qa/AnalisisQA.md` § *Investigación — zona no adyacente* (ZON-BUG-01..05).

- ⏭️ **Próximo paso** (reemplaza al de abajo): el #1 está cerrado ⇒ sigue **#2, Plan de QA
  integral en vivo** — y ahora **no hay "datos de zona rotos"** que generen falsos hallazgos,
  así que la matriz corre sobre datos sanos.

### 🏁 Sesión de triaje — cerrada (2026-07-26) · RUMBO POST-SPEC-8 DECIDIDO

> **Actualización 2026-07-26 (sesión Opus):** el #1 de esta cola ("Bug de zonas") se
> investigó y **no era un bug** — ver la sesión de arriba. El diagnóstico de esta sección
> (asignaciones "geométricamente imposibles", "el mismo bug") quedó **refutado midiendo**. La
> cola sigue vigente desde el #2.

Sesión de planificación (Fable, sin código ni specs). Contexto: specs 1-8 todos en `done/`,
`planned/` vacío. Se priorizó la cola de trabajo con Fer:

- ✅ **Hallazgo que ordena el triaje: el "bug de búsqueda" reportado por Fer (Caballito +
  Almagro-Boedo → parrillas de otros barrios) y el bug de zonas del BACKLOG son EL MISMO
  bug.** La búsqueda filtra fiel por `place_zones`; lo roto son las asignaciones
  geométricamente imposibles de esa tabla (diagnóstico read-only 2026-07-25). Una sesión,
  no dos. El repro nuevo quedó anotado en la entrada del bug en `BACKLOG.md`.
- ✅ **ORDEN DECIDIDO (Fer, 2026-07-26):**
  1. **Bug de zonas** — sesión propia (Opus): cuantificar escala, causa raíz en
     `zones:build`/`assign` o GeoJSON fuente, re-correr asignación, test de regresión.
     Corte verificable → apto loop fix→re-verify.
  2. **Plan de QA integral en vivo** — matriz rol × feature en
     `docs/qa/PLAN_QA_INTEGRAL.md` y ejecución. Va después del fix de zonas (una matriz
     sobre datos de zona rotos da falsos hallazgos). Lo no probado es el CRUCE de
     features, no cada spec contra sí mismo.
  3. **Observabilidad de costos en `/admin`** — tablero sobre `ai_api_usage` /
     `google_api_usage` (hoy solo por SQL; el chat corre con Sonnet 5 a 3×). Puede
     absorber el sugeridor de precio premium según dólar (BACKLOG 2026-07-26).
  4. **Pulido UX/UI + a11y + performance mobile** — después del QA integral, sobre sus
     hallazgos. Tracks ya anotados que entran acá: header de marca global, filtro
     fantasma, resize de fotos en el browser.
  5. **Spec de curaduría (candidato a spec 9)** — Ambiente (0,9%) y Momento (0,6%) casi
     vacíos siendo EL diferencial; 8 chips de Ocasión apagados; Precio con 0 filas.
     Especificar herramienta de curaduría en `/admin` para que la carga manual sea viable.
- ✅ **PRODUCCIÓN FUERA DE LA COLA** (decisión explícita de Fer: "no tengo apuro, puedo
  esperar todo el tiempo del mundo"). No se planifica ni se le dedica sesión; se retoma
  solo a pedido. Cuando se retome arrastra su paquete entero: hosting/Neon/dominio,
  SEO/OG/sitemap, términos + privacidad, import fresco de Overture.
- 📌 **Decisiones de producto pendientes que no urgen** (sin sesión asignada): fotos al
  revocar reclamo (recomendación del checkbox ya escrita), zonas faltantes del conurbano
  (8,4% — decidir con datos del QA integral), botón Google OAuth (gate: crear las
  credenciales).
- ⏭️ **Próximo paso**: sesión Opus para el bug de zonas.

### 🏁 Sesión de specs 6 — cerrada (2026-07-25) · SPEC 8 CHAT_IA ESCRITO

Sesión de autoría manual (Fable). Entrega: **`docs/specs/planned/CHAT_IA.md`** — el chat
con IA que el premium B2C compra (spec 7 ya cobra; este construye lo que el premium hace).
Base: § Feature: chat IA (decisiones de arriba, todas cerradas con el usuario en esta
sesión) + el código real del chat de StressPlan (explorado en esta sesión, no de memoria)
+ el skill `claude-api` para modelo/precios/tool-use/caching (no de memoria).

- ✅ Decisiones A-G cerradas — ver § Feature: chat IA (spec 8). Resumen: chat `/chat` +
  botón de VOTACION · tool-use con doble candado de grounding · Haiku 4.5 con model id en
  `app_settings` · probadita 3 mensajes de por vida con login · conversaciones persistidas
  (divergencia justificada del invariante sin user_id) · nada B2B · topes por SKU que
  degradan.
- ✅ Reuso desde StressPlan leído en código: portable = cliente singleton, config de
  modelos, patrón SSE, cupo TOCTOU-safe (INSERT = reserva + FOR UPDATE + revert si la IA
  falla), esquema chat_messages, conteo mensual. NO portable = prompts/contexto (dominio
  financiero) y el protocolo JSON textual (acá es tool-use nativo). StressPlan NO tiene:
  tool-use, prompt caching, cupo mensual con reset, tope global de gasto — se construyen acá.
- ⏭️ **Próximo paso**: implementar CHAT_IA (sesión Opus, fases del spec). Gate operativo
  previo: crear la key de Anthropic y cargarla en `.env` (`ANTHROPIC_API_KEY`, server-only).

### 🏁 Sesión de specs 5 — cerrada (2026-07-24) · SPEC 7 MONETIZACION ESCRITO

Sesión de autoría manual (Fable). Una sola entrega: **`docs/specs/planned/MONETIZACION.md`**
— el cobro con MercadoPago que enciende `users.plan` (B2C) y `owner_plan` (B2B, por lugar),
más destaque, desglose de estadísticas y precio en DB. Nada implementado. Base: § Monetización
(precios y planes ya decididos, no se reabrieron) + specs 5-6 (gating existente) + el código
MP real de StressPlan (explorado en esta sesión, no de memoria). Lo que se decidió nuevo:

- ✅ **Incógnitas (a) y (b) resueltas** — ver § Reuso desde StressPlan (Bricks + preapproval;
  sí a los usuarios de prueba).
- ✅ **Preapproval SIN plan pre-creado en MP** (divergencia consciente con StressPlan): el
  monto sale de `app_settings` al crear cada suscripción — una sola fuente de verdad del
  precio, sin el problema de 3 capas que StressPlan documenta en `PRICING_GRID.md`. Fallback
  anotado si el sandbox lo rechaza.
- ✅ **Webhook solo firmado** (HMAC `x-signature`, 401 sin firma; la rama IPN legacy de
  StressPlan no se porta) + **idempotencia en 3 capas** (GET defensivo · guard UNIQUE por
  `authorized_payment_id` registrado solo-al-aprobar · `FOR UPDATE`) + **reconciliación lazy
  obligatoria** — los webhooks de MP demostraron no ser confiables (BUG-020 de StressPlan).
- ✅ **Estados `active`/`past_due`/`canceled`**: pago fallido conserva el acceso mientras MP
  reintenta; baja a free solo con `paused`/`cancelled` o vencimiento + 3 días de gracia.
  **Cancelación diferida simulada** (MP cancela ya, el acceso dura hasta fin de período).
- ✅ **Bajar de plan = mover el flag y nada más** (ocultar ≠ borrar ya regía en los dos ejes);
  re-suscribir reactiva todo tal cual estaba.
- ✅ **Rotación del destaque: menor-mostrado-primero** con contador `featured_impressions`
  por día — auto-balancea y es auditable: el mismo contador que decide alimenta la
  transparencia del panel ("destacada en X de las Y búsquedas").
- ✅ **Precio en DB con historial** (`app_settings_history`) y **monto congelado por
  suscripción** (`amount_ars` en la fila). Cambiar el precio afecta solo altas nuevas; subir
  a suscriptos existentes quedó explícitamente v2 (MP no tiene camino confirmado).
- ✅ **La instrumentación del desglose (taps + qué filtros te encontraron) va en la FASE 1**,
  antes que el cobro: ese histórico no se reconstruye y es el argumento de venta.
- ⏭️ **Próximo paso**: implementar MONETIZACION (sesión Opus, 4 fases: instrumentación+precios
  · cobro MP · destaque · desglose). Gate operativo previo al QA de F2: crear la app en MP
  (credenciales + webhook en el panel) y los usuarios de prueba vendedor/comprador. Después:
  spec 8 (Chat IA, se financia con esto).

### 🏁 Sesión de specs 4 — cerrada (2026-07-22) · SPEC 6 VOTACION ESCRITO

Sesión de autoría manual (Fable). Una sola entrega: **`docs/specs/done/VOTACION.md`** (era `planned/` al escribirse; implementado y movido a `done/` el 2026-07-22) — la
votación en grupo, el "loop viral". Nada implementado. Base: § "Feature: votación en grupo" +
§ planes (ya decididos) + el patrón real de AUTH (sesión inline, rate limit propio, gate por
plan server-side). Lo que se decidió nuevo — cerró las preguntas abiertas que traía la feature:

- ✅ **Voto anónimo = cookie por dispositivo (`voter_id`), NO IP** (era la pregunta central). La
  IP se descarta como identidad: un grupo entero en una WiFi (o CGNAT móvil) comparte IP y se
  pisaría los votos, que es EL caso de uso. La cookie es evadible (incógnito, borrar cookies) y
  **está bien que lo sea** — el stake es decidir un asado, no una elección legal; encarecer el
  anti-fraude arruinaría el loop viral a cambio de nada. La IP queda solo como rate-limit. El voto
  es cambiable mientras esté abierta (restricción única `(poll_id, voter_token)`, revotar = UPDATE).
- ✅ **Expiración lazy, sin cron** (72 h, el máximo del rango): "activa" = `status='open' AND
  expires_at > now()`; una vencida se lee en modo cerrado y no bloquea crear otra. El proyecto no
  tiene cron y el spec no lo agrega — mismo criterio que el matching perezoso de FICHA.
- ✅ **Modelo de datos**: 3 tablas (`polls`, `poll_options`, `poll_votes`) + link por token no
  adivinable (`nanoid`). Votos = agregado por opción; el `voter_token` nunca sale al cliente.
- ✅ **La shortlist reusa la búsqueda existente** (`lib/search` + `publishedWhere`) y `PlaceCard` —
  no un selector nuevo. Solo lugares publicados.
- ✅ **El gate free/premium se modela con `users.plan`** (`free`/`premium`) — el **primer atributo
  de plan del usuario** (AUTH solo tenía `owner_plan` por lugar, B2B). Espejo B2C del mismo patrón:
  se aplica server-side desde el día 1 (free = 1 activa), se cambia con UPDATE manual hasta que el
  spec 7 lo automatice con MercadoPago. La IA que arma la shortlist y el historial navegable quedan
  **gateados y apagados** — construidos como hueco, sin la lógica detrás (spec 7/8).
- ✅ **Resultados en vivo** (no solo al cierre): ver el conteo subir es lo que empuja a re-compartir,
  el motor del loop viral. **Cierre = el creador elige el ganador** (default = el más votado), cubre
  empate y "ganó X pero elijo Y" de un solo camino. Link cerrado/expirado/cancelado ⇒ solo-lectura
  con el ganador, **nunca 404**.
- ✅ **La página del link NO usa Google ni IA** (contrasta con la ficha): el preview de WhatsApp sale
  de datos propios, gratis de crawlear.
- ⏭️ **Próximo paso**: implementar VOTACION (sesión Opus, 3 fases) o escribir el spec 7
  (Monetización / MercadoPago) — uno por vez. El spec 7 **enciende** el premium que este dejó
  modelado (`users.plan` → MP) y arrastra las dos cosas a confirmar ya anotadas en § Reuso desde
  StressPlan: bricks-vs-checkout y usuarios sandbox de MP.

### 🏁 Sesión de specs 3 — cerrada (2026-07-20) · SPEC 5 AUTH ESCRITO

Sesión de autoría manual (Fable). Una sola entrega: **`docs/specs/planned/AUTH.md`** —
auth + roles + reclamo de negocio, en 4 fases. Nada implementado. Base: lo ya decidido acá
(§ Usuarios y roles, § planes) + relevamiento del patrón real de StressPlan. Lo que se
decidió nuevo:

- ✅ **Fotos de dueño en Cloudflare R2** (decisión de Fer, 2026-07-20). StressPlan **no
  tiene** upload de archivos — no había patrón para replicar. Cloudflare ya está en el
  stack (DNS/proxy); R2 es S3-compatible, 10 GB gratis y egress sin costo. Un solo módulo
  server-only (`lib/storage/r2.ts`), mismo criterio que `lib/google/places.ts`.
- ✅ **Los horarios propios del dueño entran en el spec 5** (decisión de Fer), como última
  fase: el free ya los prometía (§ planes) y son la masa que destraba "Abierto ahora"
  (BACKLOG). La ficha los prioriza sobre Google — mismo patrón que las fotos.
- ✅ **Los límites free se aplican desde el día 1** (3 fotos; descripción/carta/novedad
  bloqueados), aunque el cobro llegue con el spec 7. Corolario del principio ya decidido
  *"subir un cupo es un regalo; bajarlo es una traición"*. `places.owner_plan`
  (`free`/`paid`) se cambia a mano hasta que el spec 7 lo automatice con MP.
- ✅ **Sin sistema de roles en DB** (patrón StressPlan relevado): admin = `ADMIN_EMAIL`,
  dueño = derivado de tener reclamo aprobado (`place_claims`). El registro único queda
  garantizado por construcción. Divergencia explícita con StressPlan: acá
  `requireEmailVerification: true` (allá quedó en `false` — acá la verificación es el
  anti-abuso ya decidido).
- ✅ **"Registrá tu negocio" arranca buscando en el catálogo COMPLETO** (visible e
  invisible): evita duplicados y resuelve cómo reclama el dueño de un lugar bajo el umbral,
  cuya ficha pública no existe (sin esto, el caso de negocio del override era inalcanzable).
- ✅ **Lo que edita el dueño nunca va a las columnas base de `places`** (el re-import las
  pisa): tabla 1-a-1 `place_owner_content`, la ficha hace COALESCE dueño → base. Y el
  re-import **no toca las tags de lugares reclamados** — el dueño aprobado es mejor fuente
  que Overture para su lugar.
- ✅ **Nombre, dirección y ubicación NO editables por el dueño en v1** (correcciones vía
  admin): son la identidad del lugar publicado y mover el pin obliga a re-asignar zonas.
- ⏭️ **Próximo paso**: implementar AUTH (sesión Opus, 4 fases) o escribir el spec 6
  (Votación) — uno por vez. Las filas de CATALOGO/ZONAS/BUSQUEDA del BACKLOG habían
  quedado `[ ]` → `planned/` al cierre de sus specs: **corregidas en esta misma sesión**
  (commit `docs:` aparte). Pendiente menor que queda: el huérfano
  `docs/specs/planned/ZONAS.md` sin stub.

### 🏁 Sesión de specs 2 — cerrada (2026-07-19) · SPEC 4 FICHA ESCRITO

Sesión de autoría manual (Fable). Una sola entrega: **`docs/specs/planned/FICHA.md`** —
`/lugar/[id]` y el primer uso de Google en vivo. Nada implementado; el contenedor de
Postgres sigue sin levantarse. Lo que se decidió, que no estaba decidido antes:

- ✅ **El matching Overture↔Google es GRATIS y ese es el hallazgo que ordena el spec.**
  Text Search (New) *Essentials — IDs Only* (SKU 635D-A9DD-C520) cuesta **$0 ilimitado**
  con `fieldMask: places.id`. Pedir un campo de más (`displayName` es Pro; `location` en
  Text Search también) lo convierte en $32/1.000. El DoD lo protege con un test sobre el
  field mask.
- ✅ **Consecuencia: el matching es "a ciegas"** — con IDs-Only no se puede comparar nombre
  ni distancia de la respuesta. Las salvaguardas van **en la entrada**: query con nombre +
  dirección + localidad, `locationRestriction` de ±300 m sobre el lat/lng propio, 1 resultado.
- ✅ **Matching perezoso, no batch**: se resuelve al abrir la ficha por primera vez. 5 estados
  (`pending·matched·manual·not_found·blocked`) con reintento a 30 días y respeto absoluto
  por lo que fijó un humano.
- 🔴 **Restricción derivada que NO estaba escrita: una sola foto de Google por ficha.** El
  presupuesto ya validado (~$54/mes a 3.000 fichas) sale de Details $40 + Photos $14, y eso
  es exactamente 1 foto. Con 3 fotos serían ~$82 y el número de IDEAS § costos deja de valer.
  La galería multi-foto queda **solo** para fotos de dueño.
- ✅ **El bloque de Google se pide desde el cliente**, no en el render del server component.
  Es decisión de **costo**, no de UX: los crawlers y los previews de WhatsApp —y compartir la
  ficha por WhatsApp es el loop viral del producto— dispararían llamadas Enterprise sobre
  fichas que ningún humano abrió (~$520 por un crawl del catálogo).
- ✅ **Topes mensuales por SKU en `app_settings`** (`google.details_monthly_cap` /
  `google.photos_monthly_cap`) contra la tabla `google_api_usage`. Superado el tope, la ficha
  **degrada** al modo sin Google en vez de disparar la factura. Cuarto uso del mismo patrón
  editable-sin-deploy (umbral · precios · cupos IA · cuotas de Google).
- ✅ **Cero caché de datos de Google en cualquier nivel** — ni DB, ni `revalidate`, ni TTL en
  memoria. Un refresh del usuario = una request paga. Es el costo de la disciplina del ToS
  y se acepta explícitamente.
- ✅ **`priceLevel` de Google como fallback** del rango de precios cuando el lugar no tiene
  tag propio de Precio: viene gratis en la request Enterprise que ya se está pagando.
- ✅ **Nunca `Enterprise + Atmosphere`** ($25/1.000): el ambiente es tag propio — es el
  diferencial de la app, no se compra.
- ✅ **`detail_views`** (columna nueva en `place_impressions_daily`): la apertura de ficha es
  lo que vende el B2B y no se puede reconstruir a posteriori. Mismo argumento con el que
  BUSQUEDA justificó las impresiones.
- ✅ **La ficha se sostiene sin Google**: contacto, redes y website salen de Overture (86% /
  98% / 41%), el "cómo llegar" es un deep link sobre lat/lng propios, y con la API key
  apagada la pantalla se ve entera. Lo de Google se **encastra** en huecos que colapsan
  limpio; nunca al revés.
- 📌 A `BACKLOG.md` § mejoras futuras: refresh anual del `place_id` · batch de matching ·
  slug SEO en la URL · `/admin` para corregir matches sin SQL.
- ⏭️ **Próximo paso**: implementar CATALOGO (sesión Opus) o escribir el spec 5
  (Auth + roles + reclamo de negocio) — uno por vez. Ya hay 4 specs escritos y **cero
  implementados**: vale considerar bajar a implementar antes de seguir acumulando diseño.

### 🏁 Sesión de specs 1 — cerrada (2026-07-19) · PASO 0 + SPEC 1 HECHOS

Primera sesión post-volcado (Fable). Dos entregas:

- ✅ **Paso 0 — scaffold de Next.js CREADO** (subagente `implementador`; tsc + build + tests
  verdes). Next 16.2.6 + Tailwind v4 con los tokens decididos en **un solo tema oscuro**
  (`:root` directo, sin variante `.dark`), Drizzle con `schema.ts` vacío (el schema es del
  spec 1), docker-compose de Postgres en puerto **5439**, dev en **5178**, y los 5
  componentes base (Button · FilterChip · SearchInput · BottomSheet · PlaceCard sin foto).
  Desvíos menores respecto de StressPlan documentados en el reporte del agente (sin
  `@base-ui/react` ni `tw-animate-css`; `shared/` en kebab-case).
- ✅ **Spec 1 escrito**: `docs/specs/planned/CATALOGO.md` — modelo de datos completo
  (`places` única para overture+owner · `tags` con facet enum y padres de Cocina ·
  `place_tags` con procedencia · `app_settings` con umbral 0.5 y cortes de precio),
  helper de visibilidad, import DuckDB idempotente por `overture_id`, `/legales`.
  Registrado en `docs/specs/README.md` y `BACKLOG.md`.
- ✅ **RESUELTO — la suma estaba mal, no las listas** (Fer, 2026-07-19): las listas
  enumeradas (lo validado ítem por ítem) son el canon y suman **96 tags** (Cocina 37 ·
  Actividad 19); los resúmenes decían 94 por error de suma. Conteos corregidos en todo
  este archivo. El spec CATALOGO siembra las 96 (105 filas contando los 9 padres de Cocina).
- ✅ **Spec 2 escrito en la misma sesión**: `docs/specs/planned/ZONAS.md` — modelo
  `zones` / `zone_aliases` / `place_zones`, **46 zonas exactas** (CABA 21 · N 9 · O 7 ·
  S 9; los "~19/~44" de este archivo eran aproximados), GeoJSON versionados en
  `data/zones/`, **sin PostGIS en v1** (asignación precomputada con turf.js, buffer 400 m
  materializado), fuente del conurbano estatal o dibujo manual — **nunca OSM** (ODbL).
- ✅ **Spec 3 escrito en la misma sesión**: `docs/specs/planned/BUSQUEDA.md` — home=search
  con URL como estado (deep links compartibles), semántica OR-dentro/AND-entre facetas,
  texto con `unaccent`+`pg_trgm`, GPS radio fijo 2 km sin PostGIS, **chips de Ocasión en
  DB** con seed de los 9 (curaduría editable sin deploy), mapa MapLibre+OpenFreeMap,
  impresiones agregadas por día desde el día 1 (el histórico vende el B2B), y **"Abierto
  ahora" fuera de v1** (sin horarios en el catálogo sería mentir — a BACKLOG). En 3 fases.
  Cierra además el diseño de la home (era el 💡 "UI propuesta sin cerrar" de la tanda 3).
- 📌 Paso 0 y specs 1-2 commiteados (`73e103c`, `fd7b882`, `f44e7e1`). Próximo paso:
  implementar CATALOGO (sesión Opus) o escribir el spec 4 (Ficha) — uno por vez.

### Tanda 5 — cerrada (2026-07-19) · EL VOLCADO DE PRODUCTO ESTÁ COMPLETO

Los tres temas que quedaban se cerraron. **No hay temas abiertos ni bloqueantes.**

- ✅ **Detalle fino de los planes** (era el último tema de monetización). **B2B**: free del
  dueño generoso a propósito (3 fotos + tags + estadística teaser) porque cada ficha
  reclamada mejora el catálogo gratis; el pago suma 15 fotos, descripción, carta, novedad,
  destaque y el desglose completo de estadísticas. **B2C**: **30 mensajes IA/mes** (Fer bajó
  de los 100 propuestos: *"no regalemos, para dar más hay tiempo"*), con idea de **bonus
  estacionales** sin cerrar. Ver § Monetización.
- ✅ **Destacados: cupo de 3 por búsqueda, con rotación** (Fer: "me gustan los impares").
  Fijarlo ahora cuesta cero; fijarlo con 30 dueños acostumbrados a salir siempre destacados
  es una pelea.
- ❌ **Favoritos / listas guardadas fuera de v1** → `BACKLOG.md`.
- ✅ **Heladerías, panaderías y cines NO entran** (Fer se corrigió sobre la propuesta de
  incorporarlas). Nació el **principio "salida vs compra"**: entra el lugar donde te quedás,
  no donde comprás y te vas. **Cines afuera "siempre"** — no es aplazamiento sino exclusión
  de alcance, porque un cine sin cartelera es inútil y la cartelera es agenda de eventos.
- ✅ **Consecuencia ejecutada**: se eliminó el tag `Heladería` de Cocina. **La taxonomía pasa
  de 97 a 96 tags** (Cocina 37; conteos corregidos 2026-07-19 — originalmente se anotó
  "de 95 a 94" por error de suma). `Pastelería` se revisó y **se mantiene** — el chip de Ocasión
  "Merienda" la necesita. Nació el **test para admitir un tag de Cocina**: se justifica si
  existe algún lugar del catálogo que lo llevaría.
- ✅ **Umbral de `confidence`: 0.5, configurable desde `/admin`.** La decisión clave no fue el
  número sino **dónde vive el corte**: se importa todo, `confidence` se guarda como columna y
  el filtro va en la query. Más `operating_status` siempre filtrado, los descartados
  invisibles (no borrados) y el reclamo de dueño sobrescribiendo el umbral.

### ▶️ Próximo paso — empezar a escribir specs

El volcado terminó. La sesión siguiente **ya no es de volcado**: es de autoría de specs
(`/new-spec`), que por regla global es trabajo **manual y no automatizable**.

⚠️ **Paso 0, que no es un spec: no existe el scaffold de Next.js.** No hay `package.json`.
Antes (o dentro) del primer spec hay que crear el proyecto: Next.js + TS, Tailwind **con los
design tokens ya decididos**, `drizzle.config`, `docker-compose` de Postgres, estructura de
carpetas y los **componentes base compartidos** (card, chip, botón, input, bottom sheet).
Se evaluó hacerlo al cierre de la tanda 5 y **se descartó**: son varias decisiones y armarlo
apurado obliga a la sesión siguiente a corregir algo que no vio nacer.

📌 **El diseño de las pantallas NO es un spec aparte** — vive en el spec de cada feature.
Ver § Pantallas → "Diseño de las pantallas".

📌 **El modelo de datos NO está decidido todavía** — están decididas las cosas de producto que
lo condicionan (94 tags, `confidence` como columna, `place_id` persistible, zonas por
geometría, precios y cupos en tablas editables). Las tablas, campos y relaciones son el
**contenido del spec 1**.

Orden recomendado — el catálogo primero porque **todo lo demás lee de él**:

| # | Spec | Por qué en ese orden |
|---|------|---------------------|
| 1 | **Catálogo + import de Overture** | Schema Drizzle, las 94 tags como datos semilla, import con `confidence`/`operating_status`, atribución. Sin catálogo no hay búsqueda, ni ficha, ni nada que un dueño reclame |
| 2 | **Zonas** | Los ~44 polígonos (incluidos los 3 de Palermo a mano), zona primaria + buffer 400 m. Separable del 1 y con trabajo manual propio |
| 3 | **Búsqueda + filtros** | Es el producto. Necesita 1 y 2 |
| 4 | **Ficha** | Primer punto donde entra Google en vivo |
| 5 | **Auth + roles + reclamo de negocio** | Habilita al dueño |
| 6 | **Votación en grupo** | El loop viral; necesita 3 |
| 7 | **Monetización (MP)** | Necesita 5. Mucho reuso de StressPlan |

### Tanda 4 — cerrada (2026-07-19)

- ✅ **FACETA 7 — ZONAS DE AMBA VOLCADA Y VALIDADA.** Era la única faceta sin volcar y el
  default de la búsqueda. **La taxonomía de filtros queda COMPLETA: las 7 facetas cerradas.**
  Ver "Faceta 7 — Zona" arriba.
- ✅ **Principio rector: granularidad asimétrica** — la grilla sigue la densidad de salidas,
  no la geografía administrativa. Palermo solo tiene más lugares que Zona Sur entera.
- ✅ **Estructura: 2 niveles — 4 regiones → ~44 zonas de salida.** CABA en ~19 zonas
  agrupadas (Palermo subdividido en 4; los 48 barrios oficiales descartados); conurbano por
  **corredor + localidad** (no por partido: Ramos Mejía y San Justo son La Matanza y no son
  la misma salida).
- ✅ **Bordes resueltos**: zona primaria por polígono (la que se ve en la card) + buffer de
  ~400 m en la búsqueda. Una zona en la card, dos en la búsqueda.
- ✅ **Multiselección libre**; **La Plata fuera de v1**; **default = última zona usada**;
  **UI = buscador con autocompletar** (mapa tocable descartado para v1).
- ⚠️ **Único costo nuevo de implementación**: los polígonos de Palermo Soho / Hollywood /
  Botánico **no existen oficialmente** — hay que dibujarlos a mano. El resto sale del GeoJSON
  oficial de CABA.
- ✅ **LICENCIA DE OVERTURE VERIFICADA — no bloquea nada** (ver "Arquitectura de datos"
  arriba). Places **no es ODbL**; las tres licencias posibles (CDLA-Permissive 2.0 /
  Apache 2.0 / CC0) permiten persistir, modificar y **monetizar**. Era el último pendiente
  estructural del proyecto: **ya no queda ninguno**.
- ✅ **Los 4 chips de Ocasión de la home decididos**: Salida con amigos · Salida con chongo ·
  Salir a bailar · After office (fijos en v1). Criterio: cobertura de ejes distintos, no
  popularidad. Ver "Ocasión — chips de la home" arriba.

~~### Qué queda para la tanda 5~~ → ✅ **los tres temas se cerraron en la tanda 5** (ver
arriba): detalle de los planes · heladerías/panaderías/cines · umbral de `confidence`.

### Tanda 3 — cerrada (2026-07-19)

- ✅ **Taxonomía de filtros VOLCADA Y VALIDADA** — era la pregunta abierta principal de la
  tanda 2. Ver sección "Taxonomía de filtros" arriba: modelo de **7 facetas combinables**
  (no árbol único), **97 tags** (aún con `Heladería`; conteo corregido 2026-07-19, decía 95)
  + 9 chips de Ocasión, validados ítem por ítem con Fer.
- ✅ **Decisión estructural clave**: *Tipo = formato del local · Cocina = qué sirve.* Parrilla
  y Pizzería viven en Cocina, no en Tipo. Sin costo de UX porque el texto libre matchea tags
  de cualquier faceta.
- ✅ **Actividad + Ambiente = el diferencial competitivo.** Google da tipo y cocina; no da
  "bar tranqui con juegos de mesa en Villa Crespo".
- ⚠️ **Riesgos anotados**: dueños que se auto-tildan todas las vibras (se controla en la
  aprobación manual); "Salida con chongo" es decisión de marca, no solo un tag.
- ✅ **LOS DOS BLOQUEANTES DEL PROYECTO SE CERRARON** (ver "Arquitectura de datos" arriba):
  1. **Overture medido**: 27.683 gastronómicos en AMBA / 13.835 en CABA, 86% con teléfono,
     98% con redes. **El catálogo propio se sostiene.** Overture NO tiene horarios → salen
     de Google en vivo, como ya estaba diseñado.
  2. **ToS leído textualmente**: §3.2.4 no existe (cita descartada); §14.3 permite cachear
     **solo lat/lng** 30 días; `place_id` sin límite. **Horarios NO cacheables.**
- ✅ **La arquitectura híbrida queda CONFIRMADA**, sin cambios. Ya no está en revisión.
- ~~❓ Queda sin volcar la faceta 7 — ZONAS de AMBA~~ → ✅ **HECHA en la tanda 4**.

### Tanda 2 — cerrada

- ✅ **Investigación de Google Places COMPLETA** (era la primera tarea pendiente). Los
  cinco hallazgos están arriba en "Arquitectura de datos"; el detalle con citas en
  `docs/product/investigacion-google-places-2026-07-19.md`.
- 🔴 **Lo que cambió respecto de la tanda 1**: Google ya no puede asumirse como el
  catálogo de la app. El ToS prohíbe persistir sus datos y las fotos son un costo
  multiplicativo. → Se decidió la **arquitectura híbrida** (ver "Arquitectura de datos").
- ✅ **Decidido en la tanda 2**: arquitectura híbrida (catálogo propio + Google solo en
  ficha); listado sin foto de Google; carga de lugares por consumidores **fuera de v1**;
  lista de pantallas de v1 validada; **precios de planes** (B2B 15.000 / B2C 7.000 ARS)
  con estructura de costos y punto de equilibrio calculados.
- ✅ **Repo creado y primer commit**: https://github.com/frodriguez84/adondesalimos
  (rama `main`). Incluye la modalidad de trabajo, los docs y la investigación.
- ✅ **Regla nueva en `CLAUDE.md` § Convenciones**: el código acumulado de specs previos
  es contexto obligatorio del siguiente spec (buscar lo existente antes de escribir).
- ⏸️ **Monetización queda cerrada** salvo el detalle fino de qué incluye cada plan.

- **Temas cerrados (tanda 1)**: modalidad de trabajo sembrada (`/bootstrap-project`);
  concepto general (descubrimiento sin reservas, mobile-first, búsqueda clásica primero);
  alcance AMBA; tipos de negocio (sin ferias itinerantes); taxonomía curada (opción C);
  zona/barrio default + GPS reemplaza zona; 3 roles + registro único (rol dueño se gana,
  aprobación manual en `/admin`); consumidor anónimo para buscar; sin reviews propias
  (rating de Google); ficha (teléfono/dirección/horarios/link/precios/redes/fotos
  dueño→Google/"cómo llegar"); resultados lista + mapa; panel del dueño separado;
  votación en grupo (diseño v1 completo + free "1 activa a la vez"); monetización
  (B2B suscripción mensual dueños; B2C premium único; MP; principio "core gratis");
  stack completo (Next.js/TS/Drizzle/Postgres local Docker/Neon prod/Vercel/better-auth/
  Cloudflare/Resend; dominio adondesalimos.com.ar); paleta "Ámbar StressPlan"; tono
  canchero sin emojis; Home=Search sin landing; Places API (New).
- **Tema en curso al cortar**: pantallas — quedó volcado el inventario y los faltantes
  propuestos por Claude (votación, flujo dueño, carga de lugar, verificación email,
  checkout, legales, 404) **sin validación explícita del usuario ítem por ítem**.
- ~~**PRIMERA TAREA**: completar la investigación de Google Places~~ → ✅ **HECHA en la
  tanda 2** (2026-07-19).
- **Preguntas abiertas**: cobertura de Overture/FSQ en AMBA (**bloqueante** — requiere
  bajar el extract con DuckDB y contar); leer a mano el ToS §3.2.3(b)/§3.2.4 (tarea de
  Fer, las páginas se truncan al fetchear); taxonomía concreta de filtros (nunca se
  volcó el árbol real); verificación automatizada de dueños (no bloquea).
- **Abiertas después del volcado** (surgen al implementar, van arriba en su sección):
  qué pasa con las **fotos al revocar un reclamo** (AUTH F3, 2026-07-21 — § Usuarios y
  roles; hay recomendación anotada, no urge).
- **NO hacer todavía**: specs (`/new-spec`), scaffold, código. Seguimos en volcado.
  No commitear sin preguntar (hay cambios sin commitear del bootstrap + docs).
