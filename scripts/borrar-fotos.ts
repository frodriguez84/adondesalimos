import 'dotenv/config'
import { createInterface } from 'node:readline/promises'
import { asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { placePhotos, places } from '@/lib/db/schema'
import { borrarFotosDeLugar } from '@/lib/negocio/acciones'
import { claveDeUrl } from '@/lib/storage/r2'

/**
 * **Destruye** las fotos de un lugar: las filas de `place_photos` y los objetos
 * en R2. No se puede deshacer.
 *
 * ## Por qué es un script y no un botón
 *
 * Revocar un reclamo **oculta** las fotos del dueño sin borrarlas, y ese es el
 * default correcto: revocar suele ser una corrección (el local cambió de manos,
 * se equivocó el admin) y no tiene por qué destruir nada. Queda afuera el caso de
 * **abuso** —alguien se hizo pasar por dueño y subió fotos ofensivas—, donde el
 * objeto sigue en R2 con su URL pública para quien la tenga.
 *
 * Para eso está esto. Va como script y no como checkbox en `/admin` porque es
 * irreversible y lo irreversible no va en el camino de un click. El motivo del
 * abuso ya queda escrito en `place_claims.admin_notes` al revocar, así que la
 * limpieza puede ocurrir después sin perder información.
 *
 * Uso:
 *   npm run fotos:borrar -- <place-id>
 *
 * Pide confirmación escribiendo el **nombre del lugar**. No hay `--force`: el
 * punto es que sea difícil hacerlo por accidente.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function main() {
  const [placeId] = process.argv.slice(2).map((s) => s.trim()).filter(Boolean)

  if (!placeId || !UUID_RE.test(placeId)) {
    console.error('Uso: npm run fotos:borrar -- <place-id>')
    console.error('El place-id es el uuid del lugar (el de la URL de la ficha).')
    process.exit(1)
  }

  const [lugar] = await db
    .select({ id: places.id, name: places.name })
    .from(places)
    .where(eq(places.id, placeId))
    .limit(1)

  if (!lugar) {
    console.error(`No existe ningún lugar con id ${placeId}.`)
    process.exit(1)
  }

  const fotos = await db
    .select({ id: placePhotos.id, url: placePhotos.url })
    .from(placePhotos)
    .where(eq(placePhotos.placeId, placeId))
    .orderBy(asc(placePhotos.sort))

  if (fotos.length === 0) {
    console.log(`"${lugar.name}" no tiene fotos cargadas. Nada que borrar.`)
    return
  }

  console.log('─── Borrado de fotos ───────────────────────')
  console.log(`Lugar: ${lugar.name}`)
  console.log(`Id:    ${lugar.id}`)
  console.log(`Fotos: ${fotos.length}\n`)
  for (const foto of fotos) {
    // Sin clave = la URL no es de nuestro bucket: la fila se va igual, el objeto
    // no está a nuestro alcance.
    console.log(`  · ${foto.id} — ${claveDeUrl(foto.url) ?? `(fuera del bucket) ${foto.url}`}`)
  }
  console.log('\nEsto borra las filas de place_photos Y los objetos en R2.')
  console.log('NO se puede deshacer: los objetos no vuelven.\n')

  const rl = createInterface({ input: process.stdin, output: process.stdout })
  let respuesta: string
  try {
    respuesta = await rl.question(`Para confirmar, escribí el nombre del lugar ("${lugar.name}"): `)
  } finally {
    rl.close()
  }

  if (respuesta.trim() !== lugar.name) {
    console.log('\nNo coincide con el nombre del lugar. No se borró nada.')
    process.exit(1)
  }

  const { filas, objetos } = await borrarFotosDeLugar(placeId)

  console.log(`\nListo: ${filas} fila(s) borradas, ${objetos} objeto(s) borrados en R2.`)
  if (objetos < filas) {
    console.log(
      `  ⚠ ${filas - objetos} objeto(s) siguen en el bucket (URL de otro origen o falló el ` +
        'DELETE, ver el error de arriba). Las filas ya no están: revisalos a mano.',
    )
  }
  console.log('────────────────────────────────────────────')
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
