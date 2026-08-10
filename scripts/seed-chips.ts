import { and, eq, inArray, sql } from 'drizzle-orm'
import { db, type DbOrTx } from '@/lib/db'
import { chipTags, occasionChips, tags } from '@/lib/db/schema'
import { CHIPS, type ChipSeed } from '@/lib/db/chips'

/**
 * Siembra y **re-sincroniza** los chips de Ocasión y sus tags.
 *
 * ## Por qué vive acá y no adentro de `scripts/seed.ts`
 *
 * Mismo motivo que `scripts/overture/upsert.ts`: importar `seed.ts` desde un test
 * **correría el seed entero** (llama a `main()` al final). Extraído para poder
 * testear la sincronización sola.
 *
 * ## Qué cambió respecto de la versión vieja, y por qué importa
 *
 * Antes los `chip_tags` se insertaban **solo si el chip no tenía ninguno**
 * (`if (n === 0)`). Consecuencia: **redefinir un chip existente no tenía camino
 * repetible**. La fila del chip sí se actualizaba (`name`, `in_home`, `sort`), así
 * que un re-seed dejaba el chip **medio actualizado**, que es peor que no tocarlo:
 * salía de la home pero seguía ofreciendo la combinación vieja detrás de "Ver más".
 *
 * No es teórico. El 2026-08-10 se redefinió `salida-con-chongo` (de 1 lugar a 35) y
 * la base se sincronizó "con un reseed dirigido" —un SQL a mano, en dev—. **A
 * producción nunca llegó**: durante todo el día, tocar ese chip en la app devolvía
 * una sola card. Se descubrió en el QA en producción y se corrigió a mano otra vez.
 * La lección entera está en `docs/operations/LECCIONES_APRENDIDAS.md` § *Deployar un
 * feature de datos es dos deploys*: **si la única forma de aplicar un cambio de datos
 * es un SQL improvisado, ese cambio no va a llegar a producción.**
 *
 * Ahora los tags se sincronizan de verdad: se borran los que sobran y se insertan los
 * que faltan, en una transacción por chip. Redefinir un chip vuelve a ser *editar
 * `lib/db/chips.ts` y correr el seed*.
 *
 * ## Lo que NO toca, a propósito
 *
 * `occasion_chips.active` es **curaduría** —apagar un chip a mano—, no semilla. Mismo
 * criterio que `tags.active` en el seed de la taxonomía: el seed no lo pisa nunca.
 */

export type ResultadoSiembraChips = {
  /** Cuántos chips hay en la tabla al terminar. */
  total: number
  /** Cuántos tenían los tags distintos de la semilla y se corrigieron. */
  resincronizados: number
}

export async function sembrarChips(
  lista: readonly ChipSeed[] = CHIPS,
  database: DbOrTx = db,
): Promise<ResultadoSiembraChips> {
  const filasTags = await database.select({ id: tags.id, slug: tags.slug }).from(tags)
  const idPorSlug = new Map(filasTags.map((t) => [t.slug, t.id]))

  let sort = 0
  let resincronizados = 0

  for (const chip of lista) {
    // Un slug inventado es un error de la semilla, no un dato faltante: se corta
    // acá en vez de sembrar un chip que nunca podría devolver nada.
    const tagIds = chip.tags.map((slug) => {
      const id = idPorSlug.get(slug)
      if (id === undefined) {
        throw new Error(`El chip "${chip.slug}" referencia un tag inexistente: "${slug}"`)
      }
      return id
    })

    const [fila] = await database
      .insert(occasionChips)
      .values({ slug: chip.slug, name: chip.name, inHome: chip.inHome, sort: sort++ })
      .onConflictDoUpdate({
        target: occasionChips.slug,
        set: {
          name: sql`excluded.name`,
          inHome: sql`excluded.in_home`,
          sort: sql`excluded.sort`,
          // `active` deliberadamente ausente: es curaduría, no semilla.
        },
      })
      .returning({ id: occasionChips.id })

    const actuales = new Set(
      (
        await database
          .select({ tagId: chipTags.tagId })
          .from(chipTags)
          .where(eq(chipTags.chipId, fila.id))
      ).map((f) => f.tagId),
    )
    const deseados = new Set(tagIds)
    const sobran = [...actuales].filter((id) => !deseados.has(id))
    const faltan = [...deseados].filter((id) => !actuales.has(id))

    // Solo se escribe si hay diferencia: un re-seed sobre una base al día no toca
    // una sola fila, y el contador de abajo dice la verdad sobre qué cambió.
    if (sobran.length > 0 || faltan.length > 0) {
      if (sobran.length > 0) {
        await database
          .delete(chipTags)
          .where(and(eq(chipTags.chipId, fila.id), inArray(chipTags.tagId, sobran)))
      }
      if (faltan.length > 0) {
        await database.insert(chipTags).values(faltan.map((tagId) => ({ chipId: fila.id, tagId })))
      }
      resincronizados++
    }
  }

  const [{ total }] = await database
    .select({ total: sql<number>`count(*)::int` })
    .from(occasionChips)
  return { total, resincronizados }
}
