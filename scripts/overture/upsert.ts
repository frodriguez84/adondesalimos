import { sql } from 'drizzle-orm'
import { CAMPOS_CORREGIBLES, type CampoCorregible } from '@/lib/negocio/correcciones'

/**
 * El `set` del `ON CONFLICT DO UPDATE` del import (CORRECCION_DATOS, decisión 4).
 *
 * El import deja de ser *"Overture manda en sus 13 columnas"* y pasa a **"Overture
 * manda salvo donde un humano dijo lo contrario"**: las cinco columnas corregibles
 * pasan de `excluded.x` a `CASE WHEN 'x' = ANY(places.locked_fields) THEN places.x
 * ELSE excluded.x END`. Las otras ocho siguen exactamente igual — corregir una
 * dirección no congela los teléfonos ni la confidence.
 *
 * Vive acá y no inline en `import-overture.ts` para poder testear la regla contra
 * la base **sin pegarle a S3** (la "prueba de fuego" del DoD). **No es un segundo
 * camino de escritura**: es el mismo upsert, con la condición adentro.
 *
 * La lista de campos corregibles no se repite acá: sale de
 * `lib/negocio/correcciones.ts`, que es su dueño único.
 */

/**
 * `CASE WHEN 'x' = ANY(places.locked_fields) THEN places.x ELSE excluded.x END`.
 * `sql.raw` sin escapar es seguro acá: el nombre sale del union de literales de
 * `CAMPOS_CORREGIBLES`, no de una entrada.
 */
function respetandoCorreccion(columna: CampoCorregible) {
  return sql.raw(
    `case when '${columna}' = any(places.locked_fields) then places.${columna} else excluded.${columna} end`,
  )
}

/**
 * Lo que Overture es dueño de saber, con las correcciones a mano respetadas.
 * `google_place_id`, `publish_override`, `locked_fields`, `owner_plan` y `source`
 * quedan intactos a propósito (no están en el set).
 */
export const SET_UPSERT_PLACES = {
  name: respetandoCorreccion('name'),
  lat: respetandoCorreccion('lat'),
  lng: respetandoCorreccion('lng'),
  address: respetandoCorreccion('address'),
  locality: respetandoCorreccion('locality'),
  phones: sql`excluded.phones`,
  websites: sql`excluded.websites`,
  socials: sql`excluded.socials`,
  emails: sql`excluded.emails`,
  overtureCategory: sql`excluded.overture_category`,
  confidence: sql`excluded.confidence`,
  operatingStatus: sql`excluded.operating_status`,
  updatedAt: sql`now()`,
}

/** Lo que el import necesita saber de una fila ya escrita para el reporte. */
export type FilaFijada = {
  overtureId: string
  name: string
  address: string | null
  locality: string | null
  lat: number
  lng: number
  lockedFields: string[]
}

/** Lo que Overture trae de esa misma fila. */
export type FilaOverture = {
  name: string
  address: string | null
  locality: string | null
  lat: number
  lng: number
}

/**
 * Campos fijados de un lugar que **Overture ya trae iguales** (decisión 10). El
 * re-import recorre las filas corregidas igual, así que sabe esto gratis: se
 * reporta al final para que un humano decida soltarlos desde `/admin` → Lugares.
 *
 * **No se libera solo**: parece gratis y no lo es — con `lat`/`lng` "igual" exige
 * una tolerancia inventada, y el día que Overture traiga un dato *casi* igual y
 * peor, el candado se abriría sin que nadie lo decidiera. Por eso esto **solo
 * informa**. La comparación es por igualdad exacta, sin tolerancia, justamente
 * para no inventar ninguna.
 */
export function camposFijadosQueCoinciden(fila: FilaFijada, overture: FilaOverture): CampoCorregible[] {
  return CAMPOS_CORREGIBLES.filter(
    (campo) => fila.lockedFields.includes(campo) && fila[campo] === overture[campo],
  )
}
