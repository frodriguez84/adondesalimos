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
- ❓ **Sin resolver — no bloquea**: si entran *Heladería* / *Panadería* (son más "compro y me
  voy" que "salgo") y si entran los *Cines*.

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

- ✅ **18 tags.** *Talleres* **descartado** (2026-07-19): le hizo ruido a Fer y roza el
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
| **Dulce y café** | Pastelería · Heladería · Café de especialidad |
| **Dietas** | Vegetariana · Vegana · Sin TACC · Kosher · Halal |

- ✅ **37 tags en 9 padres.**
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
- 💡 **Nueve chips es mucho para una home mobile**: arrancar con ~4 y el resto detrás de
  "ver más". Sin cerrar cuáles cuatro.
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

Tipo 10 · Cocina 37 · Actividad 18 · Ambiente 17 · Precio 4 · Momento 9 = **95 tags**,
más 9 chips de Ocasión. **Zona va aparte**: selector propio de 2 niveles, 4 regiones y
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
- ⚠️ **`confidence` promedio 0.644; 29% por debajo de 0.5.** Al importar hay que definir un
  umbral de corte — dato de calidad, no bloqueante.
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

- ✅ Integración MercadoPago suscripciones (billing checkout/cancel, webhook, sync admin).
- ✅ Prompt + chat behavior del chat IA.
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

---

## Estado de la conversación

_Actualizado durante la tanda 2 (2026-07-19). Esta sección es lo primero que lee la
sesión siguiente._

### Tanda 4 — en curso (2026-07-19)

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

### Tanda 3 — cerrada (2026-07-19)

- ✅ **Taxonomía de filtros VOLCADA Y VALIDADA** — era la pregunta abierta principal de la
  tanda 2. Ver sección "Taxonomía de filtros" arriba: modelo de **7 facetas combinables**
  (no árbol único), **95 tags** + 9 chips de Ocasión, validados ítem por ítem con Fer.
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
- **NO hacer todavía**: specs (`/new-spec`), scaffold, código. Seguimos en volcado.
  No commitear sin preguntar (hay cambios sin commitear del bootstrap + docs).
