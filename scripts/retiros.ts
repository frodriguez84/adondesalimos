import 'dotenv/config'
import { and, eq, inArray, notInArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { placeTags, tags } from '@/lib/db/schema'
import { TAGS_RETIRADOS } from '@/lib/db/taxonomy'

/**
 * Aplica los **retiros de tags declarados** en `lib/db/taxonomy.ts § TAGS_RETIRADOS`:
 * `active = false`, sin borrar una sola fila de `place_tags`.
 *
 * ## Por qué existe
 *
 * El seed **nunca pisa `active`**, a propósito: apagar un tag a mano es curaduría y
 * tiene que sobrevivir a un reseed. Pero un retiro **decidido en un spec** no es
 * curaduría — es una decisión —, y si vive solo en la base, recrear la base la pierde
 * en silencio y el tag vuelve a estar elegible (para el sheet, para las cards y para el
 * LLM del sugeridor). Eso ya pasó con `abierto-ahora`: la regla vivía en un comentario
 * para humanos y la curaduría se lo asignó a 20 lugares. Ver
 * `docs/operations/LECCIONES_APRENDIDAS.md` § *Un comentario del código puede tener
 * razón y el dato contradecirlo*.
 *
 * Así que la declaración vive en código y esto la aplica. **Idempotente**: correrlo dos
 * veces no cambia nada y no toca `place_tags` (ocultar ≠ borrar).
 *
 * Corré `npm run db:retiros` después de un `db:seed` sobre una base nueva, después de
 * recrear el volumen de Docker o al montar otra máquina. `/consistency-check` (check f7)
 * avisa si la base y esta lista se separaron.
 */
async function main() {
  if (TAGS_RETIRADOS.length === 0) {
    console.log('No hay tags declarados como retirados. Nada que hacer.')
    return
  }

  const slugs = TAGS_RETIRADOS.map((t) => t.slug)

  // Un slug mal escrito acá sería un retiro que nunca se aplica y nadie nota.
  const existentes = await db
    .select({ slug: tags.slug, active: tags.active })
    .from(tags)
    .where(inArray(tags.slug, slugs))
  const faltantes = slugs.filter((s) => !existentes.some((e) => e.slug === s))
  if (faltantes.length > 0) {
    throw new Error(
      `Estos slugs de TAGS_RETIRADOS no existen en la taxonomía sembrada: ${faltantes.join(', ')}. ` +
        'Corré `npm run db:seed` primero, o corregí el slug.',
    )
  }

  const yaRetirados = existentes.filter((e) => !e.active).map((e) => e.slug)
  const porRetirar = existentes.filter((e) => e.active).map((e) => e.slug)

  if (porRetirar.length > 0) {
    await db.update(tags).set({ active: false }).where(inArray(tags.slug, porRetirar))
  }

  for (const t of TAGS_RETIRADOS) {
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(placeTags)
      .innerJoin(tags, eq(tags.id, placeTags.tagId))
      .where(eq(tags.slug, t.slug))

    const estado = porRetirar.includes(t.slug) ? 'RETIRADO ahora' : 'ya estaba retirado'
    console.log(`· ${t.slug} — ${estado} · ${n} filas de place_tags intactas`)
    console.log(`  motivo: ${t.motivo}`)
  }

  console.log(
    `\nOK: ${porRetirar.length} retirado(s) en esta corrida, ${yaRetirados.length} ya lo estaban.`,
  )

  // Drift inverso: tags apagados en la base que NO están declarados. No es un error
  // —apagar un tag a mano es curaduría legítima y el seed la respeta— pero conviene
  // verlo: si el motivo fue una decisión de un spec, su lugar es TAGS_RETIRADOS.
  const noDeclarados = await db
    .select({ slug: tags.slug })
    .from(tags)
    .where(and(eq(tags.active, false), notInArray(tags.slug, slugs)))

  if (noDeclarados.length > 0) {
    console.log(
      `\nAviso: ${noDeclarados.length} tag(s) inactivos NO declarados en TAGS_RETIRADOS: ` +
        `${noDeclarados.map((t) => t.slug).join(', ')}. Si el retiro fue una decisión (no ` +
        'curaduría a mano), declaralo para que sobreviva a un reset de la base.',
    )
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
