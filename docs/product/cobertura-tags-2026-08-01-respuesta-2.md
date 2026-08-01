Me parece un proyecto espectacular. Estás atacando el problema correcto: la gente no busca "bases de datos espaciales", busca planes. El stack que eligieron es sólido y el límite de Overture vs. Google Places es el dolor de cabeza clásico de cualquier producto location-based de bajo presupuesto.

Acá tenés un análisis táctico sobre cómo destrabar esa cobertura, priorizando costo-beneficio y cuidando la calidad de los datos.

1. El problema del Precio (0% de cobertura)
Es imposible inferir el precio exacto sin un menú, pero para "ocasiones", el precio es relativo. Un precio-1 (barato) en Puerto Madero no es lo mismo que en La Matanza, pero para el usuario de cada zona la expectativa está clara.

El valor de un precio "estimado" es altísimo. Sin eso, no podés armar la ocasión "salida a fin de mes".

Estrategias viables sin Google y a bajo costo:

Heurística de Barrio + Categoría (Prior Bayesiano casero): Podés armar una matriz estática en tu código.

Puntaje base por barrio: Usá datos de valor del m² (ej. reportes de Zonaprop o Argenprop) para rankear los barrios de AMBA de 1 a 4. Palermo/Recoleta/Vicente López arrancan en 3.

Modificador por categoría: Un "Bodegón" o "Pizzería" resta 1 punto. Un "Sushi" o "Speakeasy" suma 1 punto.

Resultado: Si un lugar da 4, le asignás precio-4 con un flag en la UI que diga "Precio estimado". Es un dato determinista, honesto (si lo comunicás bien) y de costo US$0.

Overpass API (OpenStreetMap puro): Overture es un release curado, pero a veces dropea metadatos crudos. Consultá la Overpass API de OSM buscando el tag price_level, diet:vegan, o cuisine. OSM tiene una comunidad activa en CABA.

Scraping lateral (SERPs): En vez de intentar scrapear PedidosYa o Instagram (que bloquean todo), usá una API de resultados de búsqueda barata (como SERP API o el tier gratuito de Google Custom Search). Buscá "Nombre del lugar" + "dirección" + "menú". A veces los snippets de Google ya traen precios o el símbolo $$$, y el scrapeo de texto plano de resultados de búsqueda no te come bloqueos de JS.

2. Ambiente y Momento (Señales indirectas)
Tu pipeline actual buscaba evidencia adentro del lugar. Tenés que mirar el afuera y el nombre.

Reglas basadas en expresiones regulares (Costo 0): Muchos lugares declaran su vibra en el nombre.

Si nombre incluye (rooftop|terraza|cielo) ➔ terraza-rooftop, con-vista.

Si nombre incluye (club|dance|disco) ➔ movido, salir-a-bailar, trasnoche.

Si nombre incluye (cantina|bodegón|parrilla) ➔ grupos-grandes, tranqui.

Horarios de apertura (El santo grial del "Momento"): Si no los tenés, estás ciego. Revisá si el dataset de Overture o OSM te da el opening_hours. Si un lugar abre a las 18:00, jamás es desayuno ni almuerzo. Automáticamente es cena o after-office.

Densidad geoespacial: Con Drizzle y PostGIS (si usás la extensión espacial) podés medir densidad. Un bar ubicado a menos de 300 metros de la UADE, UBA o UTN tiene altísimas chances de ser precio-1/2, joven y after-office. Un lugar en una cuadra con 10 bares (ej. Plaza Serrano) es movido por default.

3. Crítica de tu enfoque actual (LLM)
El diagnóstico que hiciste es brutalmente acertado: estás usando el LLM como un generador de ruido plausible.

Cualquier proceso de Quality Assurance te dirá que si el 70% de tus datos no tiene trazabilidad (citas textuales), tu base está comprometida. Aceptar inferencias del LLM en bloque, sin ground truth, es un riesgo enorme para un producto que basa su propuesta de valor en la confianza de la recomendación. Si el usuario pide "romántico" y lo mandás a una pizzería ruidosa de barrio, desinstala la app.

Cómo reestructurar el gasto:
En vez de pasarle 1.200 lugares individuales a Claude, usá a Claude para que te genere las reglas de negocio. Pasale el listado de los 19.000 nombres y categorías y decile: "Agrupame estos nombres en clústers semánticos y escribime las sentencias SQL/TypeScript para auto-taggearlos". Invertís US$5 de API en generar el script, y lo corrés gratis contra tu base.

4. Validación sin Ground Truth
No podés evadir la revisión humana. Para 19.000 filas, no necesitás revisar todo para conocer tu calidad.

Tomá una muestra aleatoria estratificada (por categoría) de 377 lugares. Eso te da un nivel de confianza del 95% con un margen de error del 5%.

Etiquetalos a mano usando tu conocimiento o buscando en Google. Ese es ahora tu ground truth.

Corré tus reglas/LLM contra esos 377.

Medí Precisión (cuántos tags puestos son correctos) y Recall (cuántos tags correctos encontró). Si una regla te da < 85% de precisión, descartala. Es preferible un catálogo chico y confiable que uno grande e inútil.

5. El supuesto equivocado (Lo que no preguntaste)
El error estratégico más grande es asumir que necesitás cobertura en las 19.000 filas (o todo AMBA) antes de lanzar. No lo necesitás.

Es un problema clásico de arranque en frío. Tu producto resuelve "¿qué pinta hoy?". Si el usuario busca "after office en Palermo", necesita ver 15 opciones excelentes, no 400 mediocres.

La propuesta:
Congelá 18.000 lugares. Definí un "Catálogo Core" de 500 a 1.000 lugares en los polos gastronómicos principales (Palermo, Recoleta, San Telmo, Lomitas, Vicente López).
Completar 1.000 lugares a mano (o con tu pipeline actual + revisión estricta) te lleva un par de tardes de trabajo, costo cero, precisión 100%.

Lanzá el producto con ese catálogo cerrado. Si un usuario busca por fuera de esas zonas, mostrale un mensaje honesto: "Estamos mapeando esta zona a mano para no mandarte a cualquier lado. ¿Nos recomendás un lugar?". Transformás tu falta de datos en un loop de user-generated content inicial.