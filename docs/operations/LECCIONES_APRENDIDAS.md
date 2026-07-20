# Lecciones aprendidas

Qué salió mal, por qué, y qué hacer distinto. No es un registro de bugs (eso va a
`docs/qa/AnalisisQA.md`): acá va solo lo que cambia cómo trabajamos la próxima vez.

---

## Un driver puede tragarse un campo entero sin dar un solo error (2026-07-20 · CATALOGO)

**Qué pasó.** El import de Overture corrió limpio: 26.057 lugares, cero errores, reporte
verde. Los teléfonos, webs, redes y emails de **los 26.057** estaban en `null`.

**Causa raíz.** Las columnas `VARCHAR[]` no llegan como array de JavaScript desde
`@duckdb/node-api`. El código hacía `Array.isArray(value) ? … : null` sobre el valor crudo:
como nunca era un array, la respuesta siempre fue `null`. La rama de descarte era la única
que se ejecutaba, y descartar en silencio es exactamente lo que se le pidió que hiciera.

**Por qué no lo cazó nada.** El typecheck estaba conforme (el tipo declarado era `string[]`,
que es lo que *debería* haber llegado). Los tests no tocaban esa función. El reporte del
import contaba filas insertadas, no campos poblados. Todo verde.

**Qué hacer distinto:**

1. **Después de un import, verificar cobertura por campo, no solo el conteo de filas.**
   `count(*)` responde "¿llegaron?", no "¿llegaron completos?". La medición previa del spec
   decía 86% con teléfono y 98% con redes — ese número existía y nadie lo contrastó hasta
   el spot-check de QA. **Si el spec trae una cifra esperada, la verificación tiene que
   compararse contra ella.**
2. **No confiar en el tipo declarado en el borde de un driver externo.** Ahí el tipo es una
   intención, no una garantía. Cuando el dato cruza un driver, o se serializa explícitamente
   (acá: `CAST(to_json(x) AS VARCHAR)` + parseo) o se inspecciona el valor real una vez.
3. **Una conversión con rama de fallback silenciosa merece test propio.** Cualquier función
   que pueda devolver `null` por "formato inesperado" puede devolverlo *siempre*.
   Ver `scripts/overture/__tests__/normalizacion.test.ts`.

---

## Sondear el schema real antes de escribir la query (2026-07-20 · CATALOGO)

**Qué pasó (bien).** Antes de escribir el import se corrió un `DESCRIBE` contra el parquet
de Overture en S3, en vez de asumir el schema desde el spec. Confirmó que `taxonomy` y
`operating_status` existían tal como el spec decía.

**Por qué vale la pena.** Un `DESCRIBE` cuesta un minuto; descubrir a mitad del import que
un campo se llama distinto cuesta la corrida entera contra S3. **En fuentes externas
versionadas, verificar primero es más barato que reintentar.**

De ahí salió también el hallazgo H-2 (`operating_status` viene NULL en todo AMBA): un dato
que el spec daba por disponible y que cambia lo que Búsqueda puede asumir. **Confirmar que
un campo existe no es lo mismo que confirmar que trae datos** — conviene mirar las dos cosas
en el mismo sondeo.

---

## Cuando el dato contradice al spec, el spec puede ser el que está mal (2026-07-20 · ZONAS)

**Qué pasó.** El QA de ZONAS cerró BLOQUEADO con un FAIL y dos PARCIAL. Ninguno era un
defecto de implementación: eran tres afirmaciones del spec desmentidas por los datos. El spec
decía que las 4 zonas de Palermo sumaban más lugares publicados que toda la región Sur (da
1.734 vs 2.598) y que los lugares sin zona estarían "en los bordes del bbox —
Escobar/Pilar/Varela" (esos tres partidos tienen **cero** sin zona).

**Qué se hizo.** Se corrigió el **spec**, no el código. ZON-05 pasó a medir densidad —que es
lo que la decisión de producto siempre quiso decir— y ahí Palermo gana 35×. Pero la corrección
se hizo **con el usuario**, no por decisión de quien implementó, y quedó registrada en el
propio spec con qué decía antes y por qué cambió.

**La regla:** el spec es el árbitro, así que quien implementó **no puede reescribirlo para que
su implementación apruebe**. Cuando el DoD y los datos se contradicen, el QA se reporta
BLOQUEADO con los números crudos y la corrección la decide el usuario. Un QA que se aprueba
solo ajustando el criterio no verificó nada.

**Corolario para escribir specs:** cuidado con meter en el DoD **predicciones** ("se espera que
los sin zona estén en los bordes") en vez de **invariantes** ("cero lugares de CABA sin zona").
Una predicción que falla bloquea un QA sin que haya nada roto. La versión corregida pide el
dato ("listar en qué localidades están"), que es lo que de verdad servía para decidir.

---

## Un campo poblado al 99,5% igual puede mentir fila por fila (2026-07-20 · ZONAS)

**Qué pasó (dos veces, en direcciones opuestas).** `places.locality` viene poblado en 25.926
de 26.057 lugares y con la granularidad justa ("Ramos Mejía", "Banfield Este"). Se usó como
oráculo de validación de los polígonos dibujados a mano, y funcionó: cazó en el primer build
que Villa Adelina cae del lado de Vicente López, no de San Isidro.

Pero en el QA, un checker marcó FAIL porque encontró 3 lugares sin zona con
`locality = 'Ciudad de Buenos Aires'`. Verificados contra el polígono oficial de los 48
barrios, **ninguno estaba en CABA**: los tres caen en La Matanza, cruzando la General Paz.

**Qué hacer distinto:** un campo de texto de una fuente externa sirve como oráculo
**agregado** (el centroide de 300 lugares de una localidad es robusto ante ruido) y no como
verdad **fila por fila**. Antes de aceptar un FAIL basado en una etiqueta, verificar contra la
geometría, que es el dato duro. Aplica también al revés: el bbox aproximado que se le pasó al
checker se extendía al sur del Riachuelo, así que "está en el bbox de CABA" tampoco probaba
nada. **La verificación buena fue la cara: 2.200 puntos contra 48 polígonos — 0 adentro.**

---

## Un criterio que solo un browser puede ver no lo cierra `/qa-spec`, y re-correrlo lo regresa (2026-07-20 · BUSQUEDA)

**Qué pasó.** El QA de BUSQUEDA cerró en PARCIAL con 11 de 12 criterios PASS. El único abierto
—BUSQ-QA-09, la vista mapa— no es verificable leyendo código: MapLibre carga teselas, dibuja
pins y clusters y abre mini-cards **solo en un browser real**. El checker de `/qa-spec` es
read-only sobre el código, así que estructuralmente no lo puede cerrar. Se verificó en una
sesión aparte con Playwright contra el ngrok del proyecto (los 5 pasos del spec), y recién ahí
el veredicto pasó a APROBADO.

**La trampa.** El checklist de `/close-spec` dice "corré `/qa-spec` una vez". Si se lo hubiera
corrido de nuevo al cerrar, el checker habría vuelto a marcar BUSQ-QA-09 como PARCIAL —porque
sigue sin poder ver el browser— **pisando la verificación en vivo** que ya estaba hecha. El
veredicto habría regresado solo por re-verificar.

**Qué hacer distinto:**

1. **Un criterio de rendering (mapa, animación, layout, permiso de dispositivo) se marca en el
   spec como "requiere QA en vivo" desde el vamos.** No es una falla del checker: es que ese
   criterio vive fuera de su alcance. El DoD puede decirlo explícitamente.
2. **La QA en vivo se corre una vez, se documenta con evidencia (screenshots + el detalle de
   cada paso en `AnalisisQA.md`), y ese registro es la fuente de verdad.** No se re-corre
   `/qa-spec` después: el gate técnico (typecheck + tests) sí se reconfirma, pero el veredicto
   de un criterio in-vivo ya cerrado no se somete de nuevo a un checker que no lo puede ver.
3. **Ojo con re-correr `next build` con el `npm run dev` levantado:** comparten `.next` y el
   build puede romper. Si el código no cambió desde el último gate verde (solo se tocó `docs/`),
   reconfirmar typecheck + tests alcanza; el build se re-corre con el server parado si hace falta.

**Corolario de herramienta.** El MCP de Playwright (`.mcp.json` con `@playwright/mcp`) es lo
que hizo verificable en vivo lo que el checker no alcanza. Para specs con UI —FICHA y Votación
lo van a necesitar— es la pieza que cierra los criterios de rendering. Los pins/clusters son
capas GL (no DOM), así que el tap se dispara con un click por coordenadas
(`page.mouse.click`), no por selector.

---

## Un test que fija el set EXACTO de columnas se rompe con toda migración aditiva (2026-07-20 · FICHA)

**Qué pasó.** F1 agregó la columna `detail_views` a `place_impressions_daily`. Un test de
integración de BUSQUEDA afirmaba que esa tabla tenía **exactamente** `['date','impressions',
'place_id']` — como guardián de "acá no hay datos por usuario". La columna nueva, que no
identifica a nadie, hizo fallar el test sin que hubiera nada mal.

**La distinción.** El invariante que el test quería proteger era "**ninguna** columna
identifica a un usuario" — eso es un **denylist** (que ninguna columna matchee
`user|ip|session|cookie|email`). Lo que estaba escrito era un **allowlist** ("exactamente
estas tres"), que además de cazar un `user_id` nuevo se rompe con cualquier columna benigna.
El allowlist confunde "no hay dato personal" con "el schema está congelado".

**Qué se hizo.** Se actualizó la aserción para incluir `detail_views` (sigue siendo un
allowlist, porque la tabla es chica y estable y el set explícito se lee bien). Pero la regla
general para el próximo:

**Cuándo cada uno.** Si el test protege una **propiedad** ("no hay PII", "no hay secretos"),
escribilo como denylist: sobrevive a columnas nuevas legítimas y sigue cazando la regresión
real. Reservá el allowlist exacto para cuando **el set completo es el contrato** y querés que
agregar cualquier cosa obligue a mirar el test — pero entonces sabé que toda migración aditiva
lo va a tocar, y eso es a propósito, no una molestia.

---

## "El rating coincide" no prueba "es el mismo local": verificar el storefront, no el atributo (2026-07-20 · FICHA F2)

**Qué pasó.** En la QA en vivo de F2 marqué FICHA-03 (matching Overture↔Google) como PASS
porque el rating que devolvió Google (4,8 · 4025) coincidía con "un" Club Milanesa. Fer
después chequeó la dirección real: Av. Libertador 3883 es **"Williamsburg Infanta"**, y el
`place_id` que matcheamos es **"El Club de la Milanesa – Paseo de la Infanta"**, a **~160 m**.
La app mostraba el rating de un local que no es el de esa dirección.

**Causa raíz del miss (no es un bug).** Es el **matching a ciegas** que la decisión 8 aceptó
a propósito: Text Search *IDs-Only* cuesta $0 pero **no devuelve nombre ni distancia**, así
que no se puede comparar la respuesta — las salvaguardas son solo de entrada (`textQuery` +
rectángulo de ±300 m). Una sucursal de la **misma marca** a 160 m entra en los 300 m y es
indistinguible sin pagar Text Search Pro ($32/1.000), que rompería el modelo $0. El código
hizo exactamente lo especificado. Riesgo **aceptado por Fer** (2026-07-20); la red es
`google_match_status='blocked'|'manual'` por `UPDATE`.

**El error de método, ese sí mío.** Aprobé un criterio de **correspondencia** verificando un
**atributo** (el rating) en vez de la **identidad** (¿es el local de esa dirección?). Es la
misma trampa de "un campo poblado al 99,5% igual puede mentir fila por fila" (ZONAS): un
atributo que coincide no prueba que la fila sea la correcta.

**Qué hacer distinto:**

1. **Para verificar un match, comparar identidad contra el dato duro** —dirección/coordenada
   del `place_id` devuelto contra las nuestras—, no un atributo lateral como el rating. Si el
   criterio dice "corresponde al lugar", la evidencia es "está en la misma dirección", no
   "tiene el mismo puntaje".
2. **Un criterio de calidad de matching se mide sobre una muestra, no sobre un caso.** Un solo
   acierto o un solo fallo no dice si la tasa es 1% o 20%. FICHA-03 pide 10 fichas a propósito;
   cerrar el criterio con la primera es cerrar sin medir.

**Corolario de producto (aparte del matching).** El nombre que muestra la ficha ("Club
Milanesa", no "El Club de la Milanesa") **sale de Overture, nunca de Google** — por ToS
(no se persiste el nombre de Google), por costo (`displayName` es tier Pro y ni se pide) y
por diseño (decisión 13: el dato propio funciona con Google caído). Un nombre abreviado o
imperfecto es calidad del dato de origen; se corrige con curaduría o con el reclamo del dueño
(spec 5), **no** trayendo el nombre de Google.
