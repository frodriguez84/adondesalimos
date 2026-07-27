import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { placeOwnerContent, placePhotos, placeTags, places, tags } from '@/lib/db/schema'
import { esDuenoDe, placeIdsDelUsuario } from '@/lib/claims/ownership'
import { borrarFoto, claveDeFoto, claveDeUrl, subirFoto, type TipoFoto } from '@/lib/storage/r2'
import { CAMPOS_PAGOS, capDeFotos, esPlanPago } from './contenido'
import { tieneAlgunHorario } from './horarios'
import { listaANull, vacioANull, type ContenidoPayload } from './validacion'
import type { Resultado } from '@/lib/claims/acciones'
import type { OwnerPlan } from '@/lib/db/schema'

/**
 * Escrituras del panel del dueño (AUTH F3). Mismo reparto que F2: acá vive todo
 * lo que cambia estado y los route handlers quedan como adaptadores (sesión →
 * validar forma → llamar → mapear código a status HTTP).
 *
 * Las dos reglas que **se aplican server-side, siempre** (decisión 17):
 * - **Gating por plan**: en `free`, mandar un campo pago es 403, aunque la UI lo
 *   muestre bloqueado. El cliente no es un boundary de seguridad.
 * - **Cap de fotos**: 3 free / 15 pago, verificado con la fila del lugar tomada
 *   `FOR UPDATE` — dos uploads simultáneos no pueden colarse por la ventana.
 *
 * Nada de esto toca las columnas base de `places` (decisión 13): el re-import de
 * Overture las pisa. Todo va a `place_owner_content` y a `place_tags`.
 */

const fallo = (code: string, message: string) => ({ ok: false as const, code, message })

/** Un id manoseado en la URL no puede llegar a una query sobre una columna uuid. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * El lugar existe y es de este usuario. Devuelve el plan, que decide todo lo
 * demás. Exportada (PULIDO, INT-14): el route de `/content` la llama ANTES de
 * validar la forma del payload, para que un no-dueño reciba 403 siempre, sin
 * importar si mandó datos bien formados.
 */
export async function verificarDueno(
  userId: string,
  placeId: string,
): Promise<Resultado<{ plan: OwnerPlan }>> {
  if (!UUID_RE.test(placeId) || !(await esDuenoDe(userId, placeId))) {
    // Mismo mensaje para "no existe" y "no es tuyo": un lugar ajeno no tiene por
    // qué distinguirse de uno inexistente.
    return fallo('NO_AUTORIZADO', 'No podés editar este lugar.')
  }
  const [place] = await db
    .select({ ownerPlan: places.ownerPlan })
    .from(places)
    .where(eq(places.id, placeId))
    .limit(1)

  if (!place) return fallo('NO_AUTORIZADO', 'No podés editar este lugar.')
  return { ok: true, data: { plan: place.ownerPlan } }
}

// ---------------------------------------------------------------------------
// Contenido + tags
// ---------------------------------------------------------------------------

export type ContenidoGuardado = { placeId: string; tagsGuardados: number }

/**
 * Guarda el contenido del dueño y sus tags en un solo gesto (el editor es un
 * formulario, no dos).
 *
 * **Tags**: se reemplaza el set completo del lugar por lo tildado, con
 * `source='owner'` (decisión 15). Se borran también las de `import`: para SU
 * lugar el dueño aprobado es mejor fuente que Overture (decisión 14), y el
 * re-import ya no las toca. Los slugs que no existen o están inactivos se
 * descartan en silencio — el cliente no elige qué taxonomía hay.
 */
export async function guardarContenido(
  userId: string,
  placeId: string,
  payload: ContenidoPayload,
): Promise<Resultado<ContenidoGuardado>> {
  const dueno = await verificarDueno(userId, placeId)
  if (!dueno.ok) return dueno

  const { plan } = dueno.data

  // Gating por plan (decisión 17): en free, un campo pago con contenido es 403.
  // Vacío se ignora — no es un intento de editar, es el form mandando el estado.
  if (!esPlanPago(plan)) {
    const intento = CAMPOS_PAGOS.find((campo) => vacioANull(payload[campo]) !== null)
    if (intento) {
      return fallo('CAMPO_PAGO', 'Ese campo es del plan pago. Escribinos para activarlo.')
    }
  }

  const tagIds = await resolverTags(payload.tags)

  await db.transaction(async (tx) => {
    const valores = {
      phone: vacioANull(payload.phone),
      website: vacioANull(payload.website),
      socials: listaANull(payload.socials),
      // Horarios: son free (decisión 20), no pasan por el gate de plan. Una semana
      // sin ningún rango se guarda como null ⇒ la ficha vuelve a los de Google.
      openingHours: tieneAlgunHorario(payload.openingHours) ? payload.openingHours : null,
      // Con plan free ya salimos arriba si venían cargados: acá siempre son null.
      description: vacioANull(payload.description),
      menuUrl: vacioANull(payload.menuUrl),
      news: vacioANull(payload.news),
      updatedAt: new Date(),
    }

    await tx
      .insert(placeOwnerContent)
      .values({ placeId, ...valores })
      .onConflictDoUpdate({ target: placeOwnerContent.placeId, set: valores })

    await tx.delete(placeTags).where(eq(placeTags.placeId, placeId))
    if (tagIds.length > 0) {
      await tx
        .insert(placeTags)
        .values(tagIds.map((tagId) => ({ placeId, tagId, source: 'owner' as const })))
    }
  })

  return { ok: true, data: { placeId, tagsGuardados: tagIds.length } }
}

/** Slugs → ids de tags **activos**. Lo que no matchea, no entra. */
async function resolverTags(slugs: string[]): Promise<number[]> {
  const unicos = [...new Set(slugs.map((s) => s.trim()).filter(Boolean))]
  if (unicos.length === 0) return []

  const filas = await db
    .select({ id: tags.id })
    .from(tags)
    .where(and(inArray(tags.slug, unicos), eq(tags.active, true)))

  return filas.map((f) => f.id)
}

// ---------------------------------------------------------------------------
// Fotos
// ---------------------------------------------------------------------------

export type FotoAgregada = { id: string; url: string; total: number }

/**
 * Sube una foto a R2 y la registra. El orden importa y es el del edge case del
 * spec: **primero el PUT, después la fila**. Si R2 falla, no queda una URL
 * huérfana en la base; si la fila falla, queda un objeto huérfano en R2, que es
 * el lado barato del error (y se borra igual con el bucket).
 *
 * El cap se chequea dos veces: una barata **antes** de subir (para no gastar un
 * PUT que va a rebotar) y otra dentro de la transacción, con la fila del lugar
 * tomada `FOR UPDATE`. Sin ese lock, dos uploads simultáneos con 2 fotos
 * cargadas verían ambos "hay lugar" y dejarían 4 en un plan de 3.
 */
export async function agregarFoto(
  userId: string,
  placeId: string,
  archivo: { bytes: Uint8Array; tipo: TipoFoto },
): Promise<Resultado<FotoAgregada>> {
  const dueno = await verificarDueno(userId, placeId)
  if (!dueno.ok) return dueno

  const cap = capDeFotos(dueno.data.plan)
  if ((await contarFotosDe(placeId)) >= cap) return falloDeCap(cap)

  const clave = claveDeFoto(placeId, archivo.tipo)
  const url = await subirFoto(clave, archivo.bytes, archivo.tipo)

  try {
    return await db.transaction(async (tx) => {
      // Serializa los uploads de ESTE lugar: el cap se cuenta sobre un estado
      // que nadie más puede estar cambiando al mismo tiempo. Con el query
      // builder y no en SQL crudo, por la cicatriz del H-1 de F2.
      await tx.select({ id: places.id }).from(places).where(eq(places.id, placeId)).for('update')

      const [{ total }] = await tx
        .select({ total: sql<number>`count(*)::int` })
        .from(placePhotos)
        .where(eq(placePhotos.placeId, placeId))

      if (total >= cap) throw new ErrorDeCap(cap)

      const [creada] = await tx
        .insert(placePhotos)
        .values({ placeId, url, sort: total })
        .returning({ id: placePhotos.id })

      return { ok: true as const, data: { id: creada.id, url, total: total + 1 } }
    })
  } catch (error) {
    // Perdió la carrera (o falló el insert): el objeto ya subido no le sirve a
    // nadie. Se borra best effort — un huérfano en R2 no rompe nada.
    await borrarFoto(clave).catch(() => {})
    if (error instanceof ErrorDeCap) return falloDeCap(error.cap)
    throw error
  }
}

class ErrorDeCap extends Error {
  constructor(readonly cap: number) {
    super('cap de fotos alcanzado')
  }
}

function falloDeCap(cap: number) {
  return fallo(
    'CAP_FOTOS',
    `Llegaste al máximo de ${cap} fotos. Borrá una para subir otra o pasate al plan pago.`,
  )
}

async function contarFotosDe(placeId: string): Promise<number> {
  const [fila] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(placePhotos)
    .where(eq(placePhotos.placeId, placeId))
  return fila?.total ?? 0
}

/**
 * Borra las fotos de los lugares de un usuario, en R2 y en la base (edge case
 * "eliminar cuenta de un dueño"; F2 dejó esta parte para F3).
 *
 * Se llama **antes** del delete de better-auth: después, el cascade ya se llevó
 * los claims y no habría por dónde encontrar los lugares. Las filas de
 * `place_photos` cuelgan del lugar, no del usuario, así que no caen solas.
 *
 * El contenido de `place_owner_content` **no** se borra acá: sin claim aprobado
 * la ficha deja de aplicarlo (ver `getPlaceDetail`), que es lo que pide el spec
 * —"deja de mostrarse"—. Si el lugar se vuelve a reclamar, el dato sigue ahí.
 *
 * Best effort de punta a punta: nada de esto puede impedir que alguien borre su
 * cuenta. Un objeto huérfano en R2 es el lado barato del error.
 */
export async function limpiarFotosDeUsuario(userId: string): Promise<void> {
  try {
    const placeIds = await placeIdsDelUsuario(userId)
    if (placeIds.length === 0) return

    const borradas = await db
      .delete(placePhotos)
      .where(inArray(placePhotos.placeId, placeIds))
      .returning({ url: placePhotos.url })

    for (const foto of borradas) {
      const clave = claveDeUrl(foto.url)
      if (clave) await borrarFoto(clave).catch(() => {})
    }
  } catch (error) {
    console.error('[fotos] limpieza al eliminar cuenta:', error)
  }
}

/**
 * Quita una foto. La fila se borra **aunque R2 falle**: una foto que el dueño
 * sacó tiene que desaparecer de la ficha ya, y el objeto huérfano se limpia
 * después. Al revés (borrar el objeto y no la fila) dejaría una imagen rota.
 */
export async function quitarFoto(
  userId: string,
  placeId: string,
  fotoId: string,
): Promise<Resultado<{ id: string }>> {
  const dueno = await verificarDueno(userId, placeId)
  if (!dueno.ok) return dueno
  if (!UUID_RE.test(fotoId)) return fallo('FOTO_NOT_FOUND', 'Esa foto ya no está.')

  // El `placeId` en el WHERE no es redundante: sin él, el dueño de un lugar
  // podría borrar la foto de otro pasando un id ajeno.
  const [borrada] = await db
    .delete(placePhotos)
    .where(and(eq(placePhotos.id, fotoId), eq(placePhotos.placeId, placeId)))
    .returning({ id: placePhotos.id, url: placePhotos.url })

  if (!borrada) return fallo('FOTO_NOT_FOUND', 'Esa foto ya no está.')

  const clave = claveDeUrl(borrada.url)
  if (clave) await borrarFoto(clave).catch((err) => console.error('[fotos] R2 delete:', err))

  return { ok: true, data: { id: borrada.id } }
}
