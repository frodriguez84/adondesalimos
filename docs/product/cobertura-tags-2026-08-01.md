# Cobertura de tags del catálogo — medición y qué hacer con ella

**Fecha:** 2026-08-01 · **Estado:** ✅ cerrado — medición hecha (catálogo § 1 y OSM § 4) y
decisiones tomadas (§ 5). **No va spec de enriquecimiento.**

Este documento existe porque el número que decide todo lo demás —cuánta metadata tiene realmente
el catálogo— no estaba escrito en ningún lado. El BACKLOG decía "Precio tiene ~0 filas" y nada
del resto. Acá está medido contra el Postgres de dev, con las queries a la vista.

Anexos (respuestas de dos LLMs externos a la consulta del 2026-08-01):
[`cobertura-tags-2026-08-01-respuesta-1.md`](cobertura-tags-2026-08-01-respuesta-1.md) ·
[`cobertura-tags-2026-08-01-respuesta-2.md`](cobertura-tags-2026-08-01-respuesta-2.md)

---

## 1. La medición

Sobre los **18.993 lugares publicados** (de 26.057 filas; publicado = `operating_status='open'`
y `confidence >= 0.5 OR publish_override`, vía `lib/db/visibility.ts`).

### Cobertura por faceta

| Faceta | Lugares con ≥1 tag | % | De dónde sale |
|---|---|---|---|
| Tipo | 18.993 | 100% | mapeo determinista de la categoría de Overture |
| Cocina | 7.156 | 37,7% | ídem |
| Actividad | 2.649 | 13,9% | Overture + 272 de curaduría |
| **Momento** | 1.154 | **6,1%** | casi todo curaduría (1.049) |
| **Ambiente** | 946 | **5,0%** | casi todo curaduría (793) |
| **Precio** | 1 | **0,0%** | cargado a mano |

**Tipo y Cocina están bien porque los regala Overture. Las tres facetas que definen el producto
—las que contestan "¿qué pinta?"— son justo las que están vacías.**

### Contacto y otros datos

| Dato | Cobertura | Nota |
|---|---|---|
| Dirección | 18.678 (98,3%) | sano |
| Redes | 18.035 (95,0%) | mayormente Instagram/Facebook |
| Teléfono | 15.730 (82,8%) | sano |
| Sitio web propio | 9.322 (49,1%) | otros 9.418 tienen **solo** redes |
| Zona asignada | 17.404 de 18.993 | **1.589 sin zona**: aparecen por chip o texto, nunca filtrando por zona |
| Horarios propios | **1 lugar** | el gate de ABIERTO_AHORA F2 pide ≥50 |
| Fotos propias | **1 lugar, 2 fotos** | |
| `google_place_id` | 24 | esperado: se resuelve lazy al abrir la ficha |

⚠️ **El import de Overture NO trae horarios.** Verificado en el `SELECT` de
`scripts/import-overture.ts`: toma dirección, teléfonos, webs, redes, categoría y confianza. La
única fila con horarios en toda la base es la del único dueño reclamado. Esto importa porque la
faceta Momento se deduce casi entera de un horario.

### Qué rindió la curaduría con LLM (spec CURADURIA, corrida del 2026-07-27)

- **1.202 lugares tocados** (6,3% del catálogo), **3.965 tags aplicados**, **US$17,62** con Sonnet.
- Cuota de 40 lugares por zona × 46 zonas, filtrando por Tipo relevante a los chips.
- **El 69% de los tags entró sin cita textual** (2.746 de 3.965). Desglosado:

| Faceta | Con cita | Sin cita |
|---|---|---|
| Momento | 642 | **1.654 (72%)** |
| Ambiente | 464 | 832 (64%) |
| Actividad | 113 | 260 (70%) |

**Momento es a la vez la faceta con más tags inferidos sin respaldo y la más fácil de resolver con
una regla determinista** (un horario dice "abre 20:00" sin ambigüedad). Se pagó un LLM para
adivinar 1.654 veces algo que un dato estructurado contesta.

**Son separables**: `place_tag_suggestions` guarda `evidence` por sugerencia, así que un join
identifica exactamente qué tags entraron sin respaldo. Cualquier limpieza futura es quirúrgica, no
un borrón.

### El límite que encontró el pipeline

No es plata ni el modelo: es que **se acaba el texto que leer**. `lib/curation/fetch-sitio.ts` es
best-effort y educado (sin autenticarse, sin evadir bloqueos), e Instagram y Facebook bloquean el
scraping anónimo — y el 49,6% de los publicados tiene *solo* redes. Re-correr `npm run curar`
sobre el resto del catálogo rinde cada vez menos.

---

## 2. Qué dijeron las dos respuestas

Coinciden en lo estratégico, y coinciden con lo que ya decidía el BACKLOG #3:

1. **No hace falta cobertura total antes de lanzar.** Un usuario mira 10-30 recomendaciones, no
   19.000. R1 propone ~2.500 lugares bien etiquetados; R2, un "catálogo core" de 500-1.000 en los
   polos gastronómicos, con un mensaje honesto fuera de esa cobertura.
2. **Reglas deterministas antes del LLM.** Extraer primero lo verificable (horarios, "happy hour",
   "terraza", "karaoke", metadatos SEO) y dejar el modelo solo para lo ambiguo.
3. **Precio = clasificación probabilística, no extracción.** Prior por categoría + zona + nombre,
   mostrado como "precio estimado". Las dos coinciden en que un estimado declarado vale más que
   nada.
4. **Niveles de confianza por origen del tag** (R1): evidencia textual / regla / inferencia
   estadística / solo-LLM, con la opción de no publicar automáticamente el último nivel.
5. **Validar una muestra estratificada** (R1: ~300; R2: 377 para 95% ± 5%) para tener ground truth
   y medir precisión por método.

### Dónde se equivocan (no seguir)

- **PostGIS** (R2): no lo usamos, es decisión explícita del proyecto (geometría con turf). La
  densidad geoespacial es factible igual con lat/lng, pero no como lo plantea.
- **Scrapear SERPs de Google** (R2): viola sus ToS. Es el mismo agujero que el proyecto se cuida
  de no abrir con Places.
- **`price_level` en OSM** (R2): no es un tag estándar y en AMBA la cobertura es ~0.

### La idea buena, por la razón equivocada

R2 propone **OSM vía Overpass API** para Precio, donde no sirve. **Sirve para Ambiente y Momento**:
OSM tiene `opening_hours`, `outdoor_seating`, `internet_access`, `wheelchair`, `smoking`, que
mapean casi 1:1 contra nuestros tags (`aire-libre`, `wifi-trabajar`, `accesible`) y resuelven
Momento entero. Es gratis, es ODbL (atribución, que ya hacemos en `/legales`) y no es scraping.

**Era la hipótesis más fuerte que salió de la consulta. Se verificó: § 4.** Mapea 1:1 como se
esperaba y es gratis; lo que no está es el volumen de datos.

---

## 3. Lo que ninguna de las dos consideró

1. **El producto ya degrada solo.** CHIPS_ROTACION apaga los chips que no tienen lugares vivos.
   Las dos escriben como si la app fuera a mostrar pantallas vacías; eso ya está resuelto. Baja la
   urgencia un escalón.
2. **El "score de completitud" de R1 se pisa con el destaque pago** (MONETIZACION F3). Ya hay algo
   reordenando la búsqueda por plata: meter un segundo criterio sin decidir cuál gana es cómo se
   rompe un ranking.
3. **Inflación.** Las bandas de Precio son en pesos y se ajustan en `/admin`
   (`pricing.band_limits`), pero un tag `precio-3` ya asignado **no se recalcula** al mover los
   límites. Si va el estimador, el prior tiene que ser relativo (percentil dentro de su
   categoría+zona), no un número anclado en ARS.
4. **El "catálogo core" ya existe en versión pobre**: la curaduría selecciona por zona con cuota
   pareja de 40 y tocó 1.202 lugares. La idea no es nueva; lo que falta es el rigor de elegir los
   polos a propósito.

---

## 4. La medición de OSM/Overpass (2026-08-01)

Era la hipótesis más fuerte que salió de la consulta y la única sin verificar. **Se midió antes de
escribir una línea de spec**, que era la corrección de rumbo que pedía la sesión anterior.

### El universo: qué hay en OSM sobre AMBA

Bajado con la Overpass API sobre el rectángulo de `lib/geo/amba.ts`, en 64 tiles, filtrando las
categorías que se parecen a nuestro catálogo (`amenity` restaurant/bar/cafe/pub/fast_food/
nightclub/ice_cream/theatre/cinema/casino/arts_centre/community_centre/biergarten/food_court,
`shop` bakery/coffee/wine/…, `leisure` escape_game/bowling_alley/…, `tourism` museum/gallery):

| | Cantidad |
|---|---|
| POI relevantes en AMBA | **16.949** |
| …con nombre | 15.883 |
| …con `opening_hours` | **2.620 (15,5%)** |
| …con `cuisine` | 3.864 |
| …con `outdoor_seating` | 1.913 |
| …con `wheelchair` | 828 |
| …con `internet_access` | 777 |
| …con `smoking` | 294 |

**Primer límite, antes de cruzar nada: OSM tiene 16.949 lugares y nuestro catálogo 18.993. No es
una fuente más grande que la nuestra, es una fuente parecida con otros campos.** Y solo el 15,5%
de sus POI declara horarios.

### El cruce

Matcheo por **nombre normalizado + distancia ≤ 200 m** (sin acentos, sin puntuación, sacando
genéricos tipo "bar"/"resto"/"parrilla"). Dos criterios, para tener piso y techo honestos:

| | Match | % del catálogo |
|---|---|---|
| **Estricto** (nombres iguales tras normalizar) | 3.460 | **18,2%** |
| **+ Fuzzy** (Jaccard ≥ 0,5 o contención) | 4.898 | **25,8%** |

Distancia mediana del match: **10 m** (p90 34–44 m) — cuando el nombre coincide, es el mismo
lugar. El fuzzy sí mete ruido: `"Merlo"` matcheó con `"Burger King Merlo"`. Por eso todo lo que
sigue va con las dos cifras.

### Lo que importa: cuántos lugares ganarían un tag

| | Estricto | Con fuzzy |
|---|---|---|
| **Ganan ≥1 tag** | **1.267 (6,7%)** | **1.703 (9,0%)** |
| …de Momento | 836 (4,4%) | 1.116 (5,9%) |
| …de Ambiente | 954 (5,0%) | 1.248 (6,6%) |
| Ganan ≥1 tag que **hoy no tienen** | 1.254 (6,6%) | 1.686 (8,9%) |
| **Estrenan** la faceta Ambiente (de 0 a ≥1) | 811 | 1.074 |
| **Estrenan** la faceta Momento | 666 | 917 |

Traducido a la tabla de cobertura del § 1:

| Faceta | Hoy | Con OSM |
|---|---|---|
| Ambiente | 5,0% | **9,3% – 10,6%** |
| Momento | 6,1% | **9,6% – 10,9%** |
| Precio | 0,0% | **0,0%** — OSM no tiene precio y `price_level` no existe como tag |

**El resultado en una línea: OSM duplica Ambiente y Momento, gratis, y las deja igual de vacías.**
De 5% a 10% es el doble y sigue siendo el 90% del catálogo sin nada.

Por tag (criterio fuzzy, columna "neto" = lugares que hoy no lo tienen):

| Tag | Lugares | Neto |
|---|---|---|
| merienda | 996 | 918 |
| almuerzo | 1.000 | 917 |
| abre-domingos | 883 | 847 |
| cena | 908 | 813 |
| aire-libre | 803 | 790 |
| desayuno | 710 | 638 |
| wifi-trabajar | 452 | 427 |
| accesible | 413 | 406 |
| hasta-tarde | 333 | 319 |
| trasnoche | 87 | 85 |
| pet-friendly | 34 | 34 |
| reserva-necesaria | 2 | 2 |

### El techo, medido: no hay una versión más prolija de esta idea

La pregunta obvia es si un matcheo mejor (fonético, por dirección, por teléfono) daría mucho más.
**No.** Contando desde el otro lado:

- POI de OSM **con horarios** de categorías que sí llevamos: **1.374** (7,2% del catálogo). Ya
  capturamos 1.132 → **82% del techo**.
- POI de OSM **con algún dato de Ambiente** de categorías que llevamos: **1.591** (8,4%). Ya
  capturamos 1.248 → **78% del techo**.

Un matcheo perfecto sumaría ~2 puntos porcentuales, no un orden de magnitud. **El límite no es
nuestro cruce: es que OSM en AMBA no tiene los datos.**

### Y rinde al revés de lo que el producto necesita

| Tipo | Lugares | Match | Gana ≥1 tag |
|---|---|---|---|
| café | 2.058 | 38,4% | **22,1%** |
| restaurante | 11.438 | 27,7% | 8,7% |
| cervecería | 548 | 21,4% | 8,6% |
| bar | 2.578 | 18,2% | 5,9% |
| wine bar | 135 | 21,5% | 3,7% |
| teatro / espacio cultural | 1.477 | 14,2% | 2,2% |
| boliche | 586 | 14,7% | **1,7%** |

**Los tipos donde "¿qué pinta?" se juega de verdad —bar, boliche, wine bar— son los que menos
rinden.** El que mejor rinde es café, que es justo donde el Momento es más predecible sin datos
(un café abre a la mañana). La comunidad de OSM mapea lo que mapea.

### La otra idea determinista, también medida: reglas sobre el nombre

Las dos respuestas insisten con regex sobre el nombre (`rooftop` → terraza, `disco` → movido).
Medido sobre los 18.993 con un set generoso de 10 patrones: **409 lugares (2,2%)**, 371 con algún
tag nuevo. Y la muestra deja ver el problema de precisión: `"Quinta Blancamora"`, `"Salon la
Quinta"` y `"Quinta Del Sol"` son salones de fiesta, no aire libre; `"La Terraza"` es un nombre, no
una terraza. **Es la propuesta #1 de la respuesta 1 —"impacto muy alto, esfuerzo bajo"— y toca el
2% del catálogo con precisión dudosa.**

Y la variante "regla por Tipo" (`cafetería → desayuno+merienda`, `parrilla → cena`) cubre el 100%
por construcción, pero **el 60,2% del catálogo es `restaurante`**: darle `cena` a 11.438 lugares no
llena un filtro, lo anula. Un tag que tienen todos no filtra nada.

### Bonus: OSM como árbitro independiente de la curaduría

Donde un lugar tiene tag de curaduría **y** OSM opina lo mismo de forma estructurada, se puede
medir el acuerdo sin trabajo humano. Sobre el match estricto:

| Tag | Con cita | Sin cita |
|---|---|---|
| desayuno | 16/16 (100%) | 49/49 (100%) |
| merienda | 12/12 (100%) | 51/51 (100%) |
| cena | 22/24 (92%) | 57/60 (95%) |
| almuerzo | 23/25 (92%) | 50/56 (89%) |
| wifi-trabajar | 2/2 | 22/23 (96%) |
| abre-domingos | 21/24 (88%) | 11/13 (85%) |
| **hasta-tarde** | **5/17 (29%)** | **6/14 (43%)** |
| **trasnoche** | 2/4 | 0/1 |
| **TOTAL** | **109/130 (84%)** | **252/273 (92%)** |

**Los tags sin cita no son peores que los que tienen cita** — si algo, en esta muestra coinciden
más. La hipótesis "el LLM sin evidencia inventa" no se sostiene con los datos que hay. (Ojo con la
lectura: esto es *acuerdo con una fuente independiente*, no precisión; donde discrepan, cualquiera
de las dos puede estar mal, y OSM tiene horarios viejos.)

Lo que sí aparece, y es accionable: **`hasta-tarde` (173 tags) y `trasnoche` (44) discrepan
fuerte.** Son los dos tags que el LLM no puede sacar de un texto y OSM sí de un horario.

---

## 5. Qué se decidió

### 5.1 · No va spec de enriquecimiento con OSM

**El número no lo justifica.** 6,7–9,0% del catálogo, techo medido en ~11%, cero para Precio, y
peor rendimiento justo en bar/boliche. Contra eso: un import nuevo, un parser de `opening_hours`,
un `source` nuevo en `place_tags`, atribución legal y mantenimiento.

Y hay un costo que ninguna de las dos respuestas nombró: **ODbL no es solo atribución, es
share-alike sobre bases derivadas.** Mezclar tags de OSM dentro de `place_tags` plantea si el
catálogo —que es *el* activo del producto, y que tiene un premium pago encima— queda alcanzado.
Responder eso bien cuesta más que los 2.000 tags que se ganan. **Un 40% de cobertura habría
justificado abrir esa pregunta; un 9% no.**

**Lo que sí queda anotado**: OSM como **pre-relleno gratis de la cola de curaduría** cuando se cure
por uso real (BACKLOG #3, ~200 lugares). A esa escala el humano revisa cada fila, y la pregunta de
licencia sigue habiendo que contestarla, pero existe la alternativa de mirar el dato y cargarlo a
mano. Los scripts de esta medición quedaron en el scratchpad de la sesión, no en `scripts/`: no hay
código nuevo en el repo.

### 5.2 · Los ~2.746 tags sin cita se quedan

**No se borran y no se valida una muestra a mano todavía.** El contraste con OSM ya funcionó como
muestra independiente (273 comparaciones) y dio 92% de acuerdo para los tags sin cita. Gastar una
tarde en validar 100 más para confirmar lo mismo no cambia ninguna decisión.

**La excepción, acotada**: revisar a mano **`hasta-tarde` (173) + `trasnoche` (44) = 217 tags**,
donde el acuerdo con OSM cae a 29–50%; y **`happy-hour` (189 tags, 89% sin cita)**, que ninguna
fuente estructurada puede arbitrar y es la afirmación más concreta y más verificable de todas ("hay
happy hour" es falsable en un segundo). Eso es ~400 tags, no 2.746.

**Los niveles de confianza por origen** (evidencia / regla / inferencia / solo-LLM) son la idea
correcta de la respuesta 1, pero hoy no tienen usuario: `place_tags.source` alcanza mientras la
única fuente que infiere sea la curaduría. Entra el día que se escriba tags desde otra fuente.

### 5.3 · El destaque pago gana; el score de completitud no se implementa

Ya hay una regla que reordena la búsqueda por plata (MONETIZACION F3) y tiene dueño. Un segundo
criterio sin jerarquía explícita no mejora el orden: lo vuelve impredecible. Si algún día entra un
score de completitud, entra como **desempate dentro del mismo nivel de destaque**, nunca por
encima.

### 5.4 · El filtro de Precio se oculta mientras esté vacío

Queda decidido lo que el § 4 anterior dejó abierto: **con OSM descartado como fuente de precio y el
estimador sin priorizar, "se llena solo" dejó de ser un plan.** Un filtro con 1 lugar etiquetado
vacía la pantalla; los chips ya tienen esa red (CHIPS_ROTACION) y Precio quedó afuera. Se oculta
mientras no llegue a un mínimo, con el mismo criterio. **Es reversible y chico — va al BACKLOG, no
a esta sesión** (esta sesión no toca código).

Sobre el **estimador probabilístico** que proponen las dos: no ahora. Y si alguna vez va, con el
prior **relativo** (percentil dentro de categoría+zona), no anclado en ARS — por lo del § 3.3.

---

## 6. Qué sigue

**Nada de esto bloquea el deploy.** Sin usuarios, la cobertura baja no le duele a nadie, y las
señales que van a decidir qué curar (`place_tag_impressions_daily`) se empiezan a juntar recién
con la app arriba. **F0 (Neon) sigue siendo lo próximo.**

El plan de fondo no cambió y ahora tiene un número que lo respalda: **deployar, mirar
`place_tag_impressions_daily`, y curar a mano los ~200 lugares que la gente efectivamente ve.**
Ninguna fuente masiva y gratis va a hacer ese trabajo — se midió la única candidata seria y da 9%.

### Al backlog (no en esta sesión)

- **Ocultar el filtro de Precio** mientras tenga menos de N lugares etiquetados (§ 5.4).
- **Revisar a mano ~400 tags**: `hasta-tarde` (173) + `trasnoche` (44) + `happy-hour` (189) (§ 5.2).

### Lo que queda explícitamente afuera

- Spec de enriquecimiento con OSM (§ 5.1) · estimador probabilístico de Precio (§ 5.4) · score de
  completitud (§ 5.3) · niveles de confianza por origen del tag (§ 5.2) · borrar o validar en masa
  los tags sin cita (§ 5.2).
- **Re-correr `npm run curar`**: sigue sin evidencia nueva y cuesta plata real.

---

## Cómo se midió lo de OSM (para poder repetirlo)

Tres scripts de un solo uso en el scratchpad de la sesión, **no versionados** (no hay código nuevo
en el repo, es una medición): bajada de Overpass en 64 tiles sobre `AMBA_BBOX`, cruce contra el
export de los 18.993 publicados, y las reglas por nombre. Dos cicatrices, por si alguien vuelve:

1. **`nwr["amenity"~"^(a|b|c)$"]` hace 504 en los tiles densos.** La unión de statements con `=`
   exacto devuelve lo mismo en ~17 s.
2. **`overpass.osm.ch` responde HTTP 200 con 0 elementos y un `timestamp_osm_base` basura**
   (`"116082"`): una instancia con la base vacía. Contaminó una corrida entera de 64 tiles antes de
   que se notara, porque el código miraba el status y no el payload.

---

## Cómo se midió (para poder repetirlo)

Todas las queries salieron del Postgres de dev con `docker exec adondesalimos_db psql`. La base de
"publicados" es la misma regla que aplica la app:

```sql
select p.id from places p, app_settings s
where s.key = 'catalog.confidence_threshold'
  and p.operating_status = 'open'
  and (p.confidence >= (s.value #>> '{}')::real or p.publish_override)
```

La cobertura por faceta es un `join place_tags → tags` contra ese conjunto, agrupado por
`tags.facet`. El corte con/sin cita sale de `place_tag_suggestions` filtrando `status='accepted'`
y mirando si `evidence is null`.
