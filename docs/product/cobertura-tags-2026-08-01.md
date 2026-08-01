# Cobertura de tags del catálogo — medición y qué hacer con ella

**Fecha:** 2026-08-01 · **Estado:** medición cerrada, decisión pendiente (ver § Qué sigue)

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

**Es la hipótesis más fuerte que salió de la consulta, y está sin verificar.**

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

## 4. Qué sigue

**Nada de esto bloquea el deploy.** Sin usuarios, la cobertura baja no le duele a nadie, y las
señales que van a decidir qué curar (`place_tag_impressions_daily`) se empiezan a juntar recién
con la app arriba. **F0 (Neon) sigue siendo lo próximo.**

Quedó sobre la mesa **ocultar el filtro de Precio** mientras tenga 1 lugar etiquetado: un filtro
que vacía la pantalla es peor que un filtro que no está, y los chips ya tienen esa red
(CHIPS_ROTACION) mientras que Precio quedó afuera. **Fer decidió (2026-08-01) no hacerlo suelto
sino resolverlo junto con el resto en la sesión de enriquecimiento** — tiene sentido: si el
estimador de Precio prospera, el filtro no se oculta, se llena, y esconderlo ahora sería trabajo
que se deshace.

Y una corrección de rumbo para cuando se retome: **medir Overpass ANTES de escribir el spec.** Si
OSM cubre el 40% de nuestros lugares con horarios, el spec se escribe de una forma; si cubre el
5%, de otra. Escribirlo sin ese número es diseñar a ciegas.

### Decisiones pendientes

- Qué se hace con los ~2.746 tags sin cita ya aplicados (dejarlos · marcarlos con confianza baja ·
  validar una muestra y borrar por método). **Recomendación**: validar 100 estratificados primero
  — si el LLM-sin-evidencia acierta menos del 70%, la decisión se toma con esos 100 y no hacen
  falta 377.
- Score de completitud vs destaque pago: cuál gana en el orden de la búsqueda.
- **El filtro de Precio**: ocultarlo mientras esté vacío, o dejarlo y llenarlo con el estimador.
  Decidido el 2026-08-01 que se resuelve acá y no antes.
- Si va o no un spec de enriquecimiento, y de qué tamaño. **"No hay spec, se cura a mano un
  catálogo core chico" es un resultado válido** si Overpass rinde poco.

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
