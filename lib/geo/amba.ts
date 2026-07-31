/**
 * El rectángulo de AMBA — **fuente única**.
 *
 * Define el área que la app cubre, y se usa en los dos extremos:
 *  - `scripts/import-overture.ts`: qué lugares se traen del parquet.
 *  - `lib/claims/validacion.ts`: hasta dónde puede caer el pin de un alta de dueño.
 *
 * Estaba escrito dos veces (mismo rectángulo copiado). Vive acá y no en
 * `lib/claims/` a propósito: el script de import corre con `dotenv` fuera de
 * Next y no debe arrastrar el módulo de claims. Por eso este archivo **no
 * importa nada** — ni zod, ni el schema, ni la DB.
 *
 * Es un valor de negocio, no de presentación: ampliarlo obliga a re-correr el
 * import (los lugares fuera del rectángulo nunca entraron a la base).
 */
export const AMBA_BBOX = { xmin: -59.1, xmax: -58.1, ymin: -35.05, ymax: -34.28 } as const
