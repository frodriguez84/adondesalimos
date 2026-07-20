import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Singleton: evita que HMR de Next.js cree múltiples pools en dev y agote max_connections.
const globalForDb = global as unknown as { pgClient: postgres.Sql | undefined }

const isProduction = process.env.NODE_ENV === 'production'

const client =
  globalForDb.pgClient ??
  postgres(
    process.env.DATABASE_URL!,
    isProduction ? { prepare: false, max: 1 } : { max: 10 },
  )

if (!isProduction) {
  globalForDb.pgClient = client
}

export const db = drizzle(client, { schema })

// Tipo compartido para funciones que aceptan tanto db como el argumento de transacción de Drizzle.
export type DbOrTx = typeof db | Parameters<Parameters<typeof db['transaction']>[0]>[0]
