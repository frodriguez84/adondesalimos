import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import postgres from 'postgres'

/**
 * Radiografía de PRODUCCIÓN, de una. Read-only: **no escribe una sola fila**.
 *
 * ## Por qué existe
 *
 * `/consistency-check` cruza docs ↔ código ↔ datos **de dev**, y las cinco redes de
 * `REDES-DE-SEGURIDAD.md` apuntan todas a dev — se escribieron cuando prod no existía.
 * Esto es el hermano que faltaba.
 *
 * El QA en producción del 2026-08-10 encontró **cuatro** cosas que el deploy no lleva, y
 * **ninguna tiraba un error**: el setting `search.cadenas` sin sembrar, Neon dos
 * migraciones atrás (con `/admin` → Lugares roto), la corrección de Matienzo que nunca
 * viajó (la ficha mostraba datos de otro negocio) y un chip con los tags viejos
 * devolviendo 1 lugar en vez de 35. Las cuatro son lo mismo: **la mitad de un feature
 * vive en datos, y los datos no están en git.**
 *
 * Dos de las cuatro las encontró comparar conteos entre dev y prod. Eso es lo que esto
 * automatiza, junto con lo demás que hay que mirar cuando una app está en la calle.
 *
 * ## Uso
 *
 *   npm run prod:check
 *
 * Necesita `PROD_DATABASE_URL` en `.env` (endpoint **direct** de Neon). Si además
 * `DATABASE_URL` (dev) está disponible, agrega la comparación entre las dos bases; si no,
 * corre igual con lo que se puede mirar solo en prod.
 *
 * Sale con código 1 si hay algo para mirar — así sirve como gate y no solo como reporte.
 */

// ---------------------------------------------------------------------------
// Qué tablas DEBEN coincidir entre dev y prod
// ---------------------------------------------------------------------------

/**
 * Catálogo y configuración: nacen del seed, de un import o de un script, y son las
 * mismas en las dos bases. Una diferencia acá es la señal de que un cambio de datos se
 * quedó en dev — que es el bug que este script viene a cazar.
 *
 * `places` y `place_tags` están adentro **a sabiendas de que pueden divergir por buenos
 * motivos** (un alta de dueño en prod, una corrección): por eso una diferencia se reporta
 * como "mirá esto", no como error.
 */
const TABLAS_DE_CATALOGO = [
  'app_settings',
  'chip_tags',
  'occasion_chips',
  'place_tags',
  'place_zones',
  'places',
  'tags',
  'zone_aliases',
  'zones',
]

/**
 * Diferencias de `app_settings` que son **decisiones tomadas**, no drift. Se listan acá
 * para que el reporte no las marque todos los días y termine ignorándose entero.
 */
const DIFERENCIAS_ESPERADAS: Record<string, string> = {
  'ai.chat_monthly_cap': 'prod tiene un tope más bajo a propósito (DEPLOY F0, decisión 8)',
}

// ---------------------------------------------------------------------------

type Hallazgo = { nivel: 'ok' | 'mirar' | 'grave'; texto: string }
const hallazgos: Hallazgo[] = []

function ok(texto: string) {
  hallazgos.push({ nivel: 'ok', texto })
  console.log(`  ✅ ${texto}`)
}
function mirar(texto: string) {
  hallazgos.push({ nivel: 'mirar', texto })
  console.log(`  ⚠️  ${texto}`)
}
function grave(texto: string) {
  hallazgos.push({ nivel: 'grave', texto })
  console.log(`  🔴 ${texto}`)
}
function titulo(t: string) {
  console.log(`\n─── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`)
}

/** Conteo de filas de todas las tablas del schema público, sin leerlas. */
async function conteos(sql: postgres.Sql): Promise<Map<string, number>> {
  const filas = await sql<{ tabla: string; n: number }[]>`
    SELECT table_name AS tabla,
           (xpath('/row/c/text()',
             query_to_xml('SELECT count(*) c FROM public.' || quote_ident(table_name),
                          false, true, '')))[1]::text::int AS n
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `
  return new Map(filas.map((f) => [f.tabla, Number(f.n)]))
}

async function main() {
  const urlProd = process.env.PROD_DATABASE_URL
  if (!urlProd) {
    console.error('ERROR: falta PROD_DATABASE_URL en .env (endpoint direct de Neon). Ver .env.example.')
    process.exit(1)
  }

  // Cinturón: aunque el script solo hace SELECT, la sesión se declara read-only, así que
  // un error de programación tampoco podría escribir en producción.
  const prod = postgres(urlProd, { max: 1, prepare: false, onnotice: () => {} })
  await prod`SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY`

  const urlDev = process.env.DATABASE_URL
  let dev: postgres.Sql | null = null
  if (urlDev && !urlDev.includes('neon.tech')) {
    try {
      dev = postgres(urlDev, { max: 1, onnotice: () => {} })
      await dev`SELECT 1`
    } catch {
      dev = null
    }
  }

  console.log('═══ Radiografía de producción ═══════════════════════════════')
  console.log(`Comparación con dev: ${dev ? 'sí' : 'NO (dev no responde — se omite esa parte)'}`)

  // --- 1. Migraciones -------------------------------------------------------
  titulo('1. Migraciones')
  const journal = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'drizzle', 'meta', '_journal.json'), 'utf8'),
  ) as { entries: { tag: string }[] }
  const [{ n: aplicadas }] = await prod<{ n: number }[]>`
    SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations
  `
  const enRepo = journal.entries.length
  if (Number(aplicadas) === enRepo) {
    ok(`prod está al día: ${aplicadas} de ${enRepo}`)
  } else {
    grave(
      `prod tiene ${aplicadas} migraciones y el repo ${enRepo} — faltan ${enRepo - Number(aplicadas)}: ` +
        journal.entries.slice(Number(aplicadas)).map((e) => e.tag).join(', ') +
        '. Corré `db:migrate` contra el endpoint direct.',
    )
  }

  // --- 2. Settings ----------------------------------------------------------
  titulo('2. app_settings (lo que cambia el comportamiento sin deploy)')
  const setsProd = new Map(
    (await prod<{ key: string; value: string }[]>`SELECT key, value::text FROM app_settings`).map(
      (r) => [r.key, r.value],
    ),
  )
  if (dev) {
    const setsDev = new Map(
      (await dev<{ key: string; value: string }[]>`SELECT key, value::text FROM app_settings`).map(
        (r) => [r.key, r.value],
      ),
    )
    const faltan = [...setsDev.keys()].filter((k) => !setsProd.has(k))
    const sobran = [...setsProd.keys()].filter((k) => !setsDev.has(k))
    const distintos = [...setsDev.entries()].filter(
      ([k, v]) => setsProd.has(k) && setsProd.get(k) !== v && !DIFERENCIAS_ESPERADAS[k],
    )
    if (faltan.length) {
      grave(`claves que están en dev y NO en prod: ${faltan.join(', ')} — un feature puede estar degradando en silencio`)
    }
    if (sobran.length) mirar(`claves solo en prod: ${sobran.join(', ')}`)
    for (const [k, v] of distintos) {
      mirar(`\`${k}\` difiere · dev=${v.slice(0, 40)} · prod=${(setsProd.get(k) ?? '').slice(0, 40)}`)
    }
    if (!faltan.length && !sobran.length && !distintos.length) {
      ok(`${setsProd.size} claves, sin drift (las diferencias esperadas se ignoran)`)
    }
  } else {
    ok(`${setsProd.size} claves en prod (sin dev, no se puede comparar)`)
  }

  // --- 3. Catálogo ----------------------------------------------------------
  titulo('3. Catálogo y configuración: ¿quedó algo solo en dev?')
  if (dev) {
    const [cp, cd] = [await conteos(prod), await conteos(dev)]
    const soloEnUna = [...cd.keys()].filter((t) => !cp.has(t))
    if (soloEnUna.length) grave(`tablas que existen en dev y no en prod: ${soloEnUna.join(', ')}`)

    const difieren = TABLAS_DE_CATALOGO.filter((t) => cd.has(t) && cp.has(t) && cd.get(t) !== cp.get(t))
    for (const t of difieren) {
      mirar(`\`${t}\`: dev=${cd.get(t)} · prod=${cp.get(t)} — un cambio de datos pudo quedarse en dev`)
    }
    if (!difieren.length && !soloEnUna.length) {
      ok(`las ${TABLAS_DE_CATALOGO.length} tablas de catálogo/config coinciden`)
    }

    // Canario: la curaduría no está en git ni en el seed. Si BAJÓ, es pérdida de datos.
    const adminProd = Number(
      (await prod<{ n: number }[]>`SELECT count(*)::int AS n FROM place_tags WHERE source = 'admin'`)[0].n,
    )
    const adminDev = Number(
      (await dev<{ n: number }[]>`SELECT count(*)::int AS n FROM place_tags WHERE source = 'admin'`)[0].n,
    )
    if (adminProd < adminDev) {
      mirar(`curaduría: prod tiene ${adminProd} tags admin y dev ${adminDev} — falta curaduría en prod`)
    } else {
      ok(`curaduría: ${adminProd} tags admin en prod`)
    }
  } else {
    ok('sin dev para comparar; se omite')
  }

  // --- 4. Plata -------------------------------------------------------------
  titulo('4. Consumo del mes contra los topes')
  const mes = (await prod<{ m: string }[]>`SELECT to_char(current_date, 'YYYY-MM') AS m`)[0].m
  const topes: [string, string, string][] = [
    ['google.details_monthly_cap', 'details', 'Google Details'],
    ['google.photos_monthly_cap', 'photos', 'Google Fotos'],
  ]
  for (const [clave, sku, nombre] of topes) {
    const tope = Number(JSON.parse(setsProd.get(clave) ?? '0'))
    const usado = Number(
      (
        await prod<{ n: number }[]>`
          SELECT coalesce(sum(count), 0)::int AS n FROM google_api_usage
          WHERE month = ${mes} AND sku = ${sku}`
      )[0].n,
    )
    const pct = tope > 0 ? Math.round((usado / tope) * 100) : 0
    const linea = `${nombre}: ${usado} de ${tope} (${pct}%)`
    if (tope > 0 && pct >= 80) mirar(`${linea} — cerca del tope; superado, la ficha degrada`)
    else ok(linea)
  }
  const topeChat = Number(JSON.parse(setsProd.get('ai.chat_monthly_cap') ?? '0'))
  const chatUsado = Number(
    (
      await prod<{ n: number }[]>`
        SELECT coalesce(sum(count), 0)::int AS n FROM ai_api_usage WHERE month = ${mes}`
    )[0].n,
  )
  const pctChat = topeChat > 0 ? Math.round((chatUsado / topeChat) * 100) : 0
  if (topeChat > 0 && pctChat >= 80) mirar(`Chat IA: ${chatUsado} de ${topeChat} (${pctChat}%) — cerca del tope`)
  else ok(`Chat IA: ${chatUsado} de ${topeChat} (${pctChat}%)`)

  // --- 5. Backup ------------------------------------------------------------
  titulo('5. Backup de producción')
  const dirBackups = path.join(process.cwd(), 'backups')
  const dumps = fs.existsSync(dirBackups)
    ? fs
        .readdirSync(dirBackups)
        .filter((f) => f.startsWith('NEON_prod_') && f.endsWith('.sql.gz'))
        .map((f) => ({ f, t: fs.statSync(path.join(dirBackups, f)).mtimeMs }))
        .sort((a, b) => b.t - a.t)
    : []
  if (dumps.length === 0) {
    grave('NO hay ningún dump de producción. Corré `npm run backup:prod` — es el único riesgo irreversible')
  } else {
    const dias = Math.floor((Date.now() - dumps[0].t) / 86_400_000)
    const linea = `último: ${dumps[0].f} (hace ${dias} día${dias === 1 ? '' : 's'}) · ${dumps.length} en total`
    if (dias > 7) mirar(`${linea} — más de una semana; corré \`npm run backup:prod\``)
    else ok(linea)
  }

  // --- 6. ¿La usan? ---------------------------------------------------------
  titulo('6. Señales de uso (lo que decide qué construir después)')
  const [uso] = await prod<
    { fichas: number; guardados: number; listas: number; interes: number; usuarios: number; busquedas: number }[]
  >`
    SELECT (SELECT coalesce(sum(detail_views), 0) FROM place_impressions_daily)::int AS fichas,
           (SELECT count(*) FROM place_list_items)::int                              AS guardados,
           (SELECT count(*) FROM place_lists)::int                                   AS listas,
           (SELECT count(*) FROM premium_interest)::int                              AS interes,
           (SELECT count(*) FROM users)::int                                         AS usuarios,
           (SELECT coalesce(sum(impressions), 0) FROM place_impressions_daily)::int  AS busquedas
  `
  console.log(
    `  · ${uso.usuarios} usuarios · ${uso.fichas} fichas abiertas · ${uso.busquedas} impresiones\n` +
      `  · ${uso.guardados} lugares guardados en ${uso.listas} listas · ${uso.interes} dejaron mail para premium`,
  )

  // --- Cierre ---------------------------------------------------------------
  const graves = hallazgos.filter((h) => h.nivel === 'grave')
  const paraMirar = hallazgos.filter((h) => h.nivel === 'mirar')
  console.log('\n═════════════════════════════════════════════════════════════')
  if (!graves.length && !paraMirar.length) {
    console.log('Todo en orden.')
  } else {
    if (graves.length) console.log(`🔴 ${graves.length} para arreglar:`)
    graves.forEach((h) => console.log(`   - ${h.texto}`))
    if (paraMirar.length) console.log(`⚠️  ${paraMirar.length} para mirar:`)
    paraMirar.forEach((h) => console.log(`   - ${h.texto}`))
  }

  await prod.end()
  if (dev) await dev.end()
  process.exit(graves.length || paraMirar.length ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
