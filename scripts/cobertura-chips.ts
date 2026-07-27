import 'dotenv/config'
import { asc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { zones } from '@/lib/db/schema'
import { CHIPS_OBJETIVO } from '@/lib/db/chips'
import { EMPTY_SEARCH } from '@/lib/search/params'
import { countPlaces } from '@/lib/search/query'

/**
 * Medición de cobertura del DoD de CURADURIA F3 (decisión 1 + 12): los 9 chips de
 * Ocasión **objetivo** × las 46 zonas. El conteo por celda sale de `countPlaces`
 * —el mismo motor que usa la home y el botón "Ver N lugares"—, así que "prendido"
 * acá significa exactamente lo que el usuario ve (BUSQUEDA decisión 25: un chip con
 * 0 no se muestra).
 *
 * Un chip se cuenta "prendido en la zona" si devuelve ≥ 1 lugar publicado con el
 * filtro `z=<zona>&t=<tags del chip>`. El reporte distingue los ceros por falta de
 * dato base (decisión 12: se documentan, no bloquean).
 *
 * Uso:  npx tsx scripts/cobertura-chips.ts
 */

async function main() {
  const zs = await db
    .select({ slug: zones.slug, name: zones.name })
    .from(zones)
    .orderBy(asc(zones.name))

  console.log(`─── Cobertura chips objetivo × zonas ───────────`)
  console.log(`Zonas: ${zs.length} · Chips objetivo: ${CHIPS_OBJETIVO.length}\n`)

  // Matriz zona × chip.
  const matriz: { zona: string; conteos: number[]; prendidos: number }[] = []
  const totalPorChip = new Array(CHIPS_OBJETIVO.length).fill(0) // zonas con ≥1

  for (const z of zs) {
    const conteos: number[] = []
    for (let i = 0; i < CHIPS_OBJETIVO.length; i++) {
      const chip = CHIPS_OBJETIVO[i]
      const n = await countPlaces({ ...EMPTY_SEARCH, zones: [z.slug], tags: chip.tags })
      conteos.push(n)
      if (n > 0) totalPorChip[i]++
    }
    const prendidos = conteos.filter((n) => n > 0).length
    matriz.push({ zona: z.name, conteos, prendidos })
  }

  // Encabezado con slugs cortos.
  const cols = CHIPS_OBJETIVO.map((c) => c.slug.slice(0, 10).padStart(10))
  console.log(`${''.padEnd(26)}${cols.join(' ')}  prendidos`)
  for (const fila of matriz) {
    const celdas = fila.conteos.map((n) => (n > 0 ? String(n) : '·').padStart(10)).join(' ')
    console.log(`${fila.zona.slice(0, 25).padEnd(26)}${celdas}  ${fila.prendidos}/${CHIPS_OBJETIVO.length}`)
  }

  console.log(`\n─── Resumen por chip (zonas con resultados) ───`)
  for (let i = 0; i < CHIPS_OBJETIVO.length; i++) {
    console.log(
      `  ${CHIPS_OBJETIVO[i].slug.padEnd(20)} ${totalPorChip[i]}/${zs.length} zonas`,
    )
  }

  const zonasConAlgo = matriz.filter((m) => m.prendidos > 0).length
  const chipsGlobales = totalPorChip.filter((n) => n > 0).length
  console.log(`\n─── Totales ────────────────────────────────`)
  console.log(`Chips objetivo prendidos en ≥1 zona: ${chipsGlobales}/${CHIPS_OBJETIVO.length}`)
  console.log(`Zonas con ≥1 chip objetivo prendido: ${zonasConAlgo}/${zs.length}`)
  console.log(`────────────────────────────────────────────`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
