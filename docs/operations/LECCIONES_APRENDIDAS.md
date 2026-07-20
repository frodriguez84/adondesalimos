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
