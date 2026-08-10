import 'dotenv/config'
import { and, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { places } from '@/lib/db/schema'
import { getConfidenceThreshold } from '@/lib/db/settings'
import { publishedWhere } from '@/lib/db/visibility'
import { CADENAS_KEY, getCadenas } from '@/lib/search/cadenas'
import { normalizado } from '@/lib/search/nombre'

/**
 * Propone la lista de cadenas de `search.cadenas` (ORDEN_ORGANICO, decisión 14).
 *
 * **Propone, no escribe.** Imprime los nombres normalizados que se repiten en el
 * catálogo publicado y el `UPDATE` listo para pegar; la base la toca un humano.
 * Mismo criterio que la curaduría: la máquina propone, el humano acepta. Es a
 * propósito y no es pereza — Havanna (110 locales) y Café Martínez (95) son cadenas
 * para el detector y opciones reales en el conurbano (decisión 5).
 *
 * Se corre **después de cada import de Overture**, que es cuando pueden aparecer
 * nombres nuevos por encima del umbral.
 *
 * Uso:  npm run cadenas:proponer  [umbral]
 */

/**
 * Cuántos locales con el mismo nombre normalizado hacen una cadena (decisión 15).
 * Con 8 la lista no tiene un solo falso positivo. Con 4 sí los tiene y son caros:
 * "parrilla", "la casona", "el patio", "la esquina" son homónimos independientes.
 */
const UMBRAL_LOCALES = 8

async function main() {
  const umbralArg = Number(process.argv[2])
  const minLocales = Number.isInteger(umbralArg) && umbralArg > 1 ? umbralArg : UMBRAL_LOCALES

  const umbral = await getConfidenceThreshold()
  const nombre = normalizado(places.name)

  // Solo el catálogo publicado: es lo que el orden ordena. Un nombre que se repite
  // 8 veces entre lugares que nadie ve no es una cadena a estos efectos.
  const filas = await db
    .select({ nombre: sql<string>`${nombre}`, n: sql<number>`count(*)::int` })
    .from(places)
    .where(and(publishedWhere(umbral)))
    .groupBy(sql`${nombre}`)
    .having(sql`count(*) >= ${minLocales}`)
    .orderBy(sql`count(*) DESC`)

  const detectadas = filas.map((f) => f.nombre)
  const actuales = await getCadenas()
  const enSetting = new Set(actuales)
  const nuevas = detectadas.filter((n) => !enSetting.has(n))
  const soloAMano = actuales.filter((n) => !detectadas.includes(n))

  console.log(`─── Cadenas detectadas (≥ ${minLocales} locales publicados) ───`)
  for (const f of filas) console.log(`  ${String(f.n).padStart(4)}  ${f.nombre}`)
  console.log(`\n  ${filas.length} nombres · ${filas.reduce((a, f) => a + f.n, 0)} lugares`)

  console.log(`\n─── Contra lo que hay hoy en ${CADENAS_KEY} (${actuales.length} entradas) ───`)
  console.log(`  Nuevas (el detector las ve y el setting no): ${nuevas.length ? nuevas.join(' · ') : '—'}`)
  // Las variantes que el umbral se pierde y un humano reconoce ("mc donalds") viven
  // solo en el setting: la propuesta las conserva en vez de pisarlas.
  console.log(`  Solo en el setting (variantes a mano o bajaron del umbral): ${soloAMano.length ? soloAMano.join(' · ') : '—'}`)

  const propuesta = [...new Set([...actuales, ...detectadas])]
  console.log(`\n─── UPDATE propuesto (${propuesta.length} entradas) — pegar a mano ───`)
  console.log(
    `UPDATE app_settings SET value = '${JSON.stringify(propuesta).replace(/'/g, "''")}'::jsonb WHERE key = '${CADENAS_KEY}';`,
  )
  console.log(`\n(Este script NO escribe en la base.)`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
