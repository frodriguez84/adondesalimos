import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Singleton: evita que HMR de Next.js cree múltiples pools en dev y agote max_connections.
const globalForDb = global as unknown as { pgClient: postgres.Sql | undefined }

const isProduction = process.env.NODE_ENV === 'production'

/**
 * ⚠️ **`max: 1` es del RUNTIME serverless, no del build — y `NODE_ENV` no los
 * distingue.** Cada lambda es un proceso propio y el pooler de Neon quiere pocas
 * conexiones por instancia, así que en runtime `max: 1` es lo correcto. Pero
 * `next build` también corre con `NODE_ENV=production` y tomaba la misma rama:
 * las **301 landings** de `/salir` prerenderizaban sus ~1.500 queries **haciendo
 * cola por una sola conexión**, y encima cruzando de la región de build a la base
 * en São Paulo. Los deploys pasaron de **~30 s a ~15 min el 2026-08-21**, con
 * `feat(SEO): F2`, y nadie lo relacionó con esta línea.
 *
 * `NEXT_PHASE` lo setea el propio Next durante el build
 * (`next/dist/build/index.js`, verificado en 16.3.1). Se compara el literal en vez
 * de importar `next/constants` **a propósito**: 8 scripts de `scripts/` importan
 * este módulo y no tienen por qué arrastrar Next — mismo criterio que
 * `lib/geo/amba.ts`.
 *
 * ⚠️ **El techo real de conexiones es `workers × max`, no `max`.** Next
 * prerenderiza en varios procesos y **cada uno arma su propio pool**: en esta
 * máquina son **11 workers**, y un primer intento con `max: 10` tumbó el build con
 * `FATAL: sorry, too many clients already` (110 > las 97 usables de un Postgres
 * con `max_connections = 100` y 3 reservadas). **4 no es un número tímido, es el
 * que hace falta**: el `Promise.all` más grande de una landing son 3 queries, así
 * que con 4 un worker paraleliza una página entera y el techo queda en 44. Antes
 * de subirlo, mirar `show max_connections` y acordarse de multiplicar.
 */
const esBuild = process.env.NEXT_PHASE === 'phase-production-build'

const client =
  globalForDb.pgClient ??
  postgres(
    process.env.DATABASE_URL!,
    isProduction ? { prepare: false, max: esBuild ? 4 : 1 } : { max: 10 },
  )

if (!isProduction) {
  globalForDb.pgClient = client
}

export const db = drizzle(client, { schema })

// Tipo compartido para funciones que aceptan tanto db como el argumento de transacción de Drizzle.
export type DbOrTx = typeof db | Parameters<Parameters<typeof db['transaction']>[0]>[0]

// Superficie pública del catálogo: la regla de visibilidad y los settings que la
// alimentan se consumen desde `@/lib/db`, no reimplementando la regla en cada query.
export * from './schema'
export * from './visibility'
export * from './settings'
