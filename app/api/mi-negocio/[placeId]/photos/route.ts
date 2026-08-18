import { auth } from '@/lib/auth'
import { agregarFoto, quitarFoto } from '@/lib/negocio/acciones'
import { checkFotosRateLimit } from '@/lib/middleware/rate-limit'
import { esTipoPermitido, MAX_BYTES, tipoRealDeFoto, TIPOS_PERMITIDOS } from '@/lib/storage/r2'

/**
 * `POST` / `DELETE /api/mi-negocio/[placeId]/photos` — fotos del dueño
 * (decisión 16). El browser sube el archivo **acá**, nunca directo a R2: las
 * credenciales viven solo en `lib/storage/r2.ts`, del lado del server.
 *
 * Validación en el boundary (regla global): tipo y tamaño se chequean sobre los
 * bytes leídos, no sobre lo que declara el `FormData` — el `type` de un `File`
 * lo pone el cliente y se puede mentir. Del tamaño eso fue siempre cierto; del
 * tipo, recién desde `SEC-13` (`tipoRealDeFoto`). El cap por plan y el orden
 * PUT→fila los resuelve `agregarFoto`.
 */

export const dynamic = 'force-dynamic'

const STATUS_POR_CODIGO: Record<string, number> = {
  NO_AUTORIZADO: 403,
  CAP_FOTOS: 409,
  FOTO_NOT_FOUND: 404,
}

function errorJson(code: string, message: string, status: number) {
  return Response.json({ data: null, error: { message, code } }, { status })
}

/** Sesión inline (decisión 9). `null` ⇒ el handler ya devolvió el 401. */
async function usuarioDe(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers }).catch(() => null)
  return session?.user ?? null
}

export async function POST(request: Request, { params }: { params: Promise<{ placeId: string }> }) {
  // Decisión 23: 30/h por IP, antes que nada (subir 5 MB no debería ni llegar a
  // tocar la sesión si la IP ya se pasó).
  const bloqueado = checkFotosRateLimit(request)
  if (bloqueado) return bloqueado

  const user = await usuarioDe(request)
  if (!user) return errorJson('NO_SESSION', 'Iniciá sesión para continuar.', 401)

  const { placeId } = await params

  let archivo: File | null = null
  try {
    const form = await request.formData()
    const valor = form.get('foto')
    archivo = valor instanceof File ? valor : null
  } catch {
    return errorJson('BAD_FORM', 'No pudimos leer el archivo.', 400)
  }

  if (!archivo) return errorJson('SIN_ARCHIVO', 'Elegí una foto para subir.', 400)

  // Corte barato antes de leer los bytes a memoria.
  if (archivo.size > MAX_BYTES) {
    return errorJson('MUY_GRANDE', 'La foto no puede pesar más de 5 MB.', 413)
  }

  const formatos = TIPOS_PERMITIDOS.map((t) => t.replace('image/', '')).join(', ')

  // Corte barato: el `type` que declara el cliente sirve para no leer 5 MB al
  // pedo, pero no es prueba de nada — se verifica sobre los bytes más abajo.
  if (!esTipoPermitido(archivo.type)) {
    return errorJson('TIPO_INVALIDO', `Formato no soportado. Aceptamos ${formatos}.`, 415)
  }

  const bytes = new Uint8Array(await archivo.arrayBuffer())
  // `size` puede mentir: el que manda es el tamaño real de lo que se leyó.
  if (bytes.byteLength > MAX_BYTES) {
    return errorJson('MUY_GRANDE', 'La foto no puede pesar más de 5 MB.', 413)
  }
  if (bytes.byteLength === 0) return errorJson('SIN_ARCHIVO', 'El archivo está vacío.', 400)

  // `SEC-13`: el tipo que se guarda sale de la firma de los bytes, no del header
  // que puso el cliente. Sin esto, un `Content-Type: image/jpeg` alcanzaba para
  // dejar cualquier archivo en el bucket.
  const tipo = tipoRealDeFoto(bytes)
  if (!tipo) {
    return errorJson('TIPO_INVALIDO', `Eso no es una imagen. Aceptamos ${formatos}.`, 415)
  }

  try {
    const resultado = await agregarFoto(user.id, placeId, { bytes, tipo })
    if (!resultado.ok) {
      return errorJson(
        resultado.code,
        resultado.message,
        STATUS_POR_CODIGO[resultado.code] ?? 400,
      )
    }
    return Response.json({ data: resultado.data, error: null }, { status: 201 })
  } catch (error) {
    console.error('[api/mi-negocio/photos]', error)
    return errorJson('UPLOAD_FAILED', 'No pudimos subir la foto. Probá de nuevo.', 500)
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ placeId: string }> },
) {
  const user = await usuarioDe(request)
  if (!user) return errorJson('NO_SESSION', 'Iniciá sesión para continuar.', 401)

  const { placeId } = await params
  const fotoId = new URL(request.url).searchParams.get('id')
  if (!fotoId) return errorJson('SIN_ID', 'Falta la foto a borrar.', 400)

  try {
    const resultado = await quitarFoto(user.id, placeId, fotoId)
    if (!resultado.ok) {
      return errorJson(resultado.code, resultado.message, STATUS_POR_CODIGO[resultado.code] ?? 400)
    }
    return Response.json({ data: resultado.data, error: null })
  } catch (error) {
    console.error('[api/mi-negocio/photos]', error)
    return errorJson('DELETE_FAILED', 'No pudimos borrar la foto.', 500)
  }
}
