import 'dotenv/config'
import { calcularCostoUsd } from '@/lib/ai/logging'
import { getCurationModel, getCurationZoneQuota } from '@/lib/curation/settings'
import { recolectarEvidencia } from '@/lib/curation/fetch-sitio'
import { seleccionarLugaresDeZona, zonaIdPorSlug } from '@/lib/curation/seleccion'
import { cargarVocabulario, sugerirTags } from '@/lib/curation/sugeridor'
import { guardarSugerencias } from '@/lib/curation/suggestions'

/**
 * Batch offline de curaduría (CURADURIA, F1/F3). Corre por zona/s pasadas por
 * argumento; sin usuario esperando. Para cada lugar seleccionado (decisión 3):
 * lee la web pública, le pide tags al LLM con evidencia (decisión 5) y **upsertea
 * solo filas nuevas** (nunca pisa lo ya revisado, decisión 8).
 *
 * Auto-apply (decisión 13, corrida masiva autónoma): las sugerencias nuevas **con
 * evidencia** se escriben a `place_tags` (`source='admin'`) y quedan `accepted`;
 * las **sin evidencia** quedan `pending` en la cola de `/admin` para revisión
 * manual. La lógica vive en `guardarSugerencias`.
 *
 * Uso:
 *   npx tsx scripts/curar.ts villa-crespo quilmes
 *
 * El model id y la cuota por zona salen de `app_settings` (runtime), no de flags.
 */

async function main() {
  const zonasArg = process.argv.slice(2).map((s) => s.trim()).filter(Boolean)
  if (zonasArg.length === 0) {
    console.error('Uso: tsx scripts/curar.ts <zona-slug> [zona-slug ...]')
    console.error('Ej:  tsx scripts/curar.ts villa-crespo quilmes')
    process.exit(1)
  }

  const [model, cuota] = await Promise.all([getCurationModel(), getCurationZoneQuota()])
  const vocab = await cargarVocabulario()

  console.log('─── Curaduría asistida (batch) ─────────────')
  console.log(`Modelo: ${model} · cuota/zona: ${cuota}`)
  console.log(`Zonas: ${zonasArg.join(', ')}`)
  console.log(`Vocabulario sugerible: ${vocab.length} tags (Ambiente/Momento/Actividad)\n`)

  let lugaresProcesados = 0
  let lugaresSinEvidencia = 0
  let sugerenciasGeneradas = 0
  let sugerenciasNuevas = 0
  let sugerenciasAutoAplicadas = 0
  let tokensIn = 0
  let tokensOut = 0
  // El system se cachea (ver `sugerirTags`): estos NO están en `tokensIn` y hay
  // que contarlos aparte, o el costo reportado sale más bajo que el real.
  let cacheReadTokens = 0
  let cacheCreationTokens = 0

  for (const slug of zonasArg) {
    const zoneId = await zonaIdPorSlug(slug)
    if (zoneId === null) {
      console.warn(`⚠ Zona "${slug}" no existe — se saltea.`)
      continue
    }

    const lugares = await seleccionarLugaresDeZona(zoneId, cuota)
    console.log(`● ${slug}: ${lugares.length} lugares seleccionados`)

    for (const lugar of lugares) {
      const evidencia = await recolectarEvidencia(lugar)
      if (evidencia.length === 0) lugaresSinEvidencia++

      const {
        sugerencias,
        tokensIn: ti,
        tokensOut: to,
        cacheReadTokens: cr,
        cacheCreationTokens: cc,
      } = await sugerirTags(lugar, evidencia, vocab, model)
      tokensIn += ti
      tokensOut += to
      cacheReadTokens += cr
      cacheCreationTokens += cc
      sugerenciasGeneradas += sugerencias.length

      const { nuevas, autoAplicadas } = await guardarSugerencias(lugar.id, sugerencias, model)
      sugerenciasNuevas += nuevas
      sugerenciasAutoAplicadas += autoAplicadas
      lugaresProcesados++

      const conEvi = sugerencias.filter((s) => s.evidence).length
      console.log(
        `  · ${lugar.name} — ${sugerencias.length} sugerencias (${conEvi} con evidencia, ${nuevas} nuevas, ${autoAplicadas} auto-aplicadas)`,
      )
    }
  }

  const costoUsd = calcularCostoUsd(model, tokensIn, tokensOut, cacheReadTokens, cacheCreationTokens)
  // Lo que habría costado el mismo trabajo sin cachear el system: todo el prefijo
  // a precio pleno. Es el número que justifica el `cache_control` — y el canario
  // de que el caching dejó de funcionar (si el ahorro es 0, no cacheó nada).
  const costoSinCache = calcularCostoUsd(
    model,
    tokensIn + cacheReadTokens + cacheCreationTokens,
    tokensOut,
  )

  console.log('\n─── Reporte ────────────────────────────────')
  console.log(`Lugares procesados: ${lugaresProcesados}`)
  console.log(`  · sin evidencia web (solo nombre/categoría): ${lugaresSinEvidencia}`)
  console.log(`Sugerencias generadas: ${sugerenciasGeneradas}`)
  console.log(`Sugerencias nuevas persistidas: ${sugerenciasNuevas}`)
  console.log(`  · ya existían (no se pisaron): ${sugerenciasGeneradas - sugerenciasNuevas}`)
  console.log(`  · auto-aplicadas a place_tags (con evidencia → accepted): ${sugerenciasAutoAplicadas}`)
  console.log(`  · quedaron pending (sin evidencia): ${sugerenciasNuevas - sugerenciasAutoAplicadas}`)
  console.log(`Tokens: in ${tokensIn} · out ${tokensOut}`)
  console.log(`  · caché: ${cacheReadTokens} leídos (0,1×) · ${cacheCreationTokens} escritos (1,25×)`)
  console.log(`Costo estimado: US$${costoUsd.toFixed(4)} (modelo ${model})`)
  if (cacheReadTokens === 0 && lugaresProcesados > 1) {
    console.log('  ⚠ CERO lecturas de caché en toda la corrida: el system NO se está cacheando.')
    console.log('    Revisá el mínimo cacheable del modelo (ver el comentario en sugeridor.ts).')
  } else {
    const ahorro = costoSinCache - costoUsd
    const pct = costoSinCache > 0 ? (ahorro / costoSinCache) * 100 : 0
    console.log(`  · sin cachear el system habría salido US$${costoSinCache.toFixed(4)} → ahorro ${pct.toFixed(0)}%`)
  }
  console.log('────────────────────────────────────────────')
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
