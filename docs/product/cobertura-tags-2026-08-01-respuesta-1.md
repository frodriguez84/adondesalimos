Informe: Estrategia para completar metadatos del catálogo (AMBA)
Objetivo

El problema no parece ser únicamente cómo etiquetar 19.000 lugares, sino cómo maximizar la calidad percibida de las recomendaciones con un presupuesto prácticamente nulo.

Hoy el producto no compite con Google Maps en cobertura, sino en responder una pregunta distinta:

"¿Qué pinta hoy?"

Eso cambia completamente la optimización.

En un recomendador, la calidad de las etiquetas pesa mucho más que la cantidad de lugares etiquetados.

Diagnóstico general

Actualmente el pipeline está intentando completar las tres facetas más importantes del producto:

Ambiente
Momento
Precio

Sin embargo, las dos primeras dependen de evidencia difícil de conseguir (redes sociales) y la tercera depende de un dato que muchas veces simplemente no existe publicado.

La conclusión es que probablemente no convenga perseguir una cobertura del 100%.

Es preferible construir un sistema donde:

algunas etiquetas provengan de evidencia explícita,
otras de reglas deterministas,
otras de inferencias estadísticas bien calibradas,

pero siempre diferenciando claramente el nivel de confianza.

1. Precio
Cambiar el objetivo

Intentar descubrir "el precio real" probablemente sea imposible.

En cambio, el objetivo debería ser:

Estimar la banda de precio más probable.

No es un problema de extracción de datos.

Es un problema de clasificación probabilística.

En vez de preguntar:

¿Cuál es el precio?

conviene preguntarse:

¿Qué probabilidad tiene este lugar de pertenecer a cada una de las cuatro bandas?

Señales que sí pueden utilizarse
1. Categoría

Cada tipo de local tiene una distribución distinta.

Ejemplos:

cafeterías
parrillas
bodegones
bares
restaurantes de autor

Ya parten de probabilidades muy diferentes.

2. Zona

Las zonas propias de la aplicación probablemente sean mejores que los barrios administrativos.

Una parrilla en Puerto Madero no tiene la misma distribución de precios que una parrilla en Avellaneda.

3. Categoría + zona

La combinación de ambas probablemente explique gran parte de la variabilidad.

Ejemplo:

parrilla + Palermo Soho

vs

parrilla + Avellaneda
4. Nombre del lugar

El nombre contiene mucha más información de la que parece.

Palabras como:

bistró
rooftop
wine
cocina de autor
cantina
bodegón
café de especialidad
cervecería

aportan información estadística sobre el nivel de precio esperado.

5. Menús publicados

Cuando exista un menú publicado, no hace falta procesarlo completo.

Un único precio visible suele ser suficiente para ubicar razonablemente el local dentro de una banda.

Qué NO haría

No usaría un LLM para "adivinar" el precio.

Si el modelo no dispone de evidencia concreta, simplemente termina utilizando los mismos priors que podrían modelarse explícitamente, pero sin calibración ni posibilidad de medir errores.

¿Vale la pena mostrar un precio estimado?

Sí.

Siempre que se indique claramente.

Por ejemplo:

Precio estimado

$$

Estimado según categoría, zona y señales disponibles.

Desde la experiencia de usuario, un precio aproximado suele ser mucho más útil que no mostrar absolutamente nada.

2. Ambiente

Aquí existen muchas más señales de las que actualmente se están aprovechando.

Nombre del lugar

El nombre ya aporta información muy valiosa.

Ejemplos:

Trade Sky Bar

→ terraza
→ con vista
→ rooftop
Bar Los Galgos

→ bar notable
→ tranquilo
Camping

→ aire libre
Co-ocurrencias

Existen relaciones extremadamente fuertes entre algunas etiquetas.

Ejemplos:

bar notable

↓

tranquilo
karaoke

↓

movido
escape room

↓

grupos grandes
cafetería de especialidad

↓

wifi para trabajar

Estas relaciones pueden modelarse como reglas, sin necesidad de un modelo de lenguaje.

Contexto urbano

La composición del entorno también aporta información.

Por ejemplo, contar dentro de un radio determinado:

cantidad de bares
cantidad de boliches
cantidad de cafés
cantidad de teatros

permite inferir características del ambiente.

Ejemplos:

Una zona con muchos boliches probablemente aumente la probabilidad de:

movido
hasta tarde

Una zona llena de cafeterías y coworkings probablemente aumente la probabilidad de:

wifi para trabajar
Horarios

Muchos sitios propios publican horarios.

Si un local abre únicamente desde las 20 hs, es una señal fuerte de un ambiente nocturno.

SEO y metadatos

Aunque no exista contenido accesible, muchas páginas incluyen en:

title
meta description
Open Graph

palabras como:

rooftop
terraza
patio
jardín
música en vivo

que pueden extraerse sin necesidad de interpretar textos largos.

3. Momento

Es probablemente la faceta más fácil de ampliar mediante reglas.

Horarios

Los horarios permiten inferir directamente muchos tags.

Ejemplos:

08:00–19:00

↓

desayuno
merienda
20:00–03:00

↓

cena
hasta tarde
23:00–06:00

↓

trasnoche
Categoría

Algunas categorías ya implican determinados momentos.

Ejemplos:

boliche → trasnoche
cafetería → desayuno + merienda
heladería → merienda
parrilla → cena

No hace falta un LLM para llegar a estas conclusiones.

4. Crítica del pipeline actual

Actualmente el flujo es:

texto

↓

LLM

↓

tags

↓

revisión humana

Ese enfoque tiene un problema:

El modelo intenta hacer simultáneamente dos trabajos distintos:

extraer hechos
interpretar
Propuesta

Separar ambas tareas.

texto

↓

extractor determinista

↓

hechos

↓

LLM

↓

resolver únicamente ambigüedades

Ejemplos:

Si aparece explícitamente:

happy hour

no hace falta IA.

Si aparece:

terraza

tampoco.

Lo mismo para:

karaoke
domingos
música en vivo
reservas
rooftop

El LLM debería intervenir solamente cuando exista verdadera incertidumbre.

5. El problema de las citas

Que únicamente el 30% de las sugerencias tenga evidencia textual verificable no es necesariamente grave.

Lo preocupante es que el otro 70% resulta prácticamente imposible de auditar posteriormente.

Propuesta

Asignar un nivel de confianza a cada etiqueta.

Nivel A

Evidencia textual explícita.

Nivel B

Regla determinista.

Ejemplo:

tipo = cafetería

↓

desayuno
Nivel C

Inferencia estadística.

Nivel D

Inferencia exclusiva del LLM.

Las etiquetas de nivel D podrían incluso no publicarse automáticamente hasta contar con evidencia adicional.

6. Validación

No hace falta validar los 19.000 lugares.

La estadística juega a favor.

Una muestra aleatoria permite estimar la precisión global.

Recomendación

Validar aproximadamente 300 lugares.

Estratificando por:

tipo
zona
fuente de información
método de etiquetado

Medir:

precisión por faceta
precisión por tag
precisión por método

Esto permitiría descubrir, por ejemplo:

Método	Precisión
Reglas	96%
LLM con evidencia	94%
LLM sin evidencia	63%

Y tomar decisiones objetivas sobre qué mantener y qué descartar.

7. El supuesto que conviene revisar

Quizás la pregunta de fondo no sea:

¿Cómo completar las tres facetas para todo el catálogo?

Sino:

¿Cuántos lugares realmente necesita tener perfectamente etiquetados un buen recomendador?

Un usuario nunca evalúa 19.000 lugares.

Generalmente observa entre 10 y 30 recomendaciones.

Por eso, una base de 2.500 lugares excelentemente etiquetados puede generar una experiencia muy superior a otra con 19.000 lugares parcialmente inferidos.

8. Propuesta adicional: Score de completitud

En lugar de tratar todos los lugares como equivalentes, puede calcularse un puntaje de calidad de ficha.

Ejemplo:

Score =
30% evidencia disponible
25% cantidad de facetas completas
20% sitio web propio
15% horarios disponibles
10% presencia en redes

Ese score puede utilizarse internamente para priorizar las recomendaciones.

Los lugares con fichas más completas aparecerían antes.

Los demás seguirían existiendo en el catálogo, pero con menor peso.

Hoja de ruta priorizada (esfuerzo vs impacto)
1. Implementar extracción determinista antes del LLM (Impacto muy alto · Esfuerzo bajo)

Extraer automáticamente:

horarios
happy hour
terraza
rooftop
karaoke
música en vivo
domingos
reservas
patio
jardín
keywords SEO

Reducir el uso del LLM únicamente a casos ambiguos.

2. Construir un estimador probabilístico de Precio (Impacto alto · Esfuerzo medio)

Utilizar:

categoría
zona
nombre
menú (cuando exista)

Mostrar el resultado como "Precio estimado".

3. Incorporar niveles de confianza (Impacto alto · Esfuerzo bajo)

Clasificar cada etiqueta según su origen:

evidencia
regla
inferencia estadística
LLM

Esto mejora la auditabilidad y facilita futuras mejoras del sistema.

4. Validar una muestra estratificada de ~300 lugares (Impacto alto · Esfuerzo medio)

Obtener una estimación objetiva de precisión antes del lanzamiento y medir el rendimiento real de cada método de etiquetado.

5. Priorizar la calidad sobre la cobertura (Impacto muy alto · Cambio estratégico)

No perseguir el 100% del catálogo antes del lanzamiento.

Concentrar los esfuerzos en que las recomendaciones se construyan sobre los lugares mejor documentados y con mayor confianza en sus metadatos.

Conclusión

El mayor cambio no sería incorporar un modelo de IA más potente ni buscar nuevas fuentes masivas de datos, sino cambiar la arquitectura del sistema de enriquecimiento.

En lugar de un pipeline centrado en que un LLM "descubra" etiquetas, conviene construir un sistema jerárquico donde:

Primero se extraigan automáticamente todos los hechos verificables mediante reglas y extractores deterministas.
Después se apliquen inferencias estadísticas para atributos naturalmente inciertos (como Precio).
Finalmente, el LLM intervenga únicamente para resolver casos ambiguos o generar hipótesis revisables.

Este enfoque mejora simultáneamente la precisión, la auditabilidad y el costo operativo, y permite lanzar un recomendador confiable sin necesidad de completar perfectamente las 19.000 fichas del catálogo.