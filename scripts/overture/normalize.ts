/**
 * Normaliza una lista de Overture a `string[] | null`.
 *
 * ⚠️ Las columnas `VARCHAR[]` NO llegan como array de JS desde
 * `@duckdb/node-api`, así que la query las serializa a JSON (ver
 * `fetchFromOverture`) y acá se parsean. Confiar en `Array.isArray` sobre el
 * valor crudo hace que todo el contacto se guarde en null en silencio.
 */
export function toStringArray(value: unknown): string[] | null {
  let parsed: unknown = value
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value)
    } catch {
      return null
    }
  }
  if (!Array.isArray(parsed)) return null
  const clean = parsed.filter((v): v is string => typeof v === 'string' && v.length > 0)
  return clean.length > 0 ? clean : null
}
