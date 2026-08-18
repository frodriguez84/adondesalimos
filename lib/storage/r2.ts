import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

/**
 * **El único módulo que habla con R2** (AUTH, decisión 16) — mismo criterio que
 * `lib/google/places.ts` con la API de Google: las credenciales viven acá y en
 * ningún otro lado, y se leen de `process.env` en el momento de usarlas, no en el
 * tope del módulo (así los helpers puros se importan en tests sin exigir claves).
 *
 * Server-only por construcción: lo importa el endpoint de fotos, nunca un
 * componente `'use client'` (el browser sube el archivo a `/api/mi-negocio/...`,
 * no a R2). El guard de abajo es la red barata: si algún día esto cae en un
 * bundle de browser, revienta en vez de filtrar el secret.
 *
 * R2 es S3-compatible, por eso el cliente es el SDK de S3 apuntado al endpoint de
 * la cuenta. Egress gratis: las fotos se sirven desde `R2_PUBLIC_URL` directo, sin
 * pasar por la app.
 */

if (typeof window !== 'undefined') {
  throw new Error('lib/storage/r2.ts es server-only: no puede importarse en el browser')
}

/** Tipos aceptados (decisión 16). Un HEIC de iPhone se rechaza con mensaje claro. */
export const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'] as const
export type TipoFoto = (typeof TIPOS_PERMITIDOS)[number]

/** 5 MB (decisión 16). Alcanza de sobra para una foto de local. */
export const MAX_BYTES = 5 * 1024 * 1024

const EXTENSION: Record<TipoFoto, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export function esTipoPermitido(tipo: string): tipo is TipoFoto {
  return (TIPOS_PERMITIDOS as readonly string[]).includes(tipo)
}

/**
 * El tipo **real**, leído de la firma de los bytes. `null` si no es ninguno de los
 * tres permitidos.
 *
 * Existe porque hasta `SEC-13` el único chequeo era `esTipoPermitido(archivo.type)`
 * y ese `type` lo pone el cliente en la parte multipart: bastaba decir
 * `Content-Type: image/jpeg` para guardar cualquier cosa en el bucket, con caché de
 * un año y borrado manual. No era XSS —con ese `Content-Type` ningún browser
 * interpreta HTML— pero sí hosting de archivos arbitrarios pagado por la app.
 *
 * Los bytes ya están en memoria cuando se llama, así que el chequeo es gratis. El
 * `type` declarado sigue sirviendo como corte barato antes de leer el archivo; el
 * que manda para guardar y para la extensión es este.
 *
 * ```
 * jpeg  FF D8 FF
 * png   89 50 4E 47 0D 0A 1A 0A
 * webp  "RIFF" ... "WEBP"   (los 4 bytes del tamaño van en el medio)
 * ```
 */
export function tipoRealDeFoto(bytes: Uint8Array): TipoFoto | null {
  const empieza = (...firma: number[]) =>
    bytes.length >= firma.length && firma.every((b, i) => bytes[i] === b)

  if (empieza(0xff, 0xd8, 0xff)) return 'image/jpeg'
  if (empieza(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png'
  if (
    empieza(0x52, 0x49, 0x46, 0x46) && // "RIFF"
    bytes.length >= 12 &&
    [0x57, 0x45, 0x42, 0x50].every((b, i) => bytes[8 + i] === b) // "WEBP"
  ) {
    return 'image/webp'
  }
  return null
}

// ---------------------------------------------------------------------------
// Claves y URLs (puros — testeables sin credenciales ni red)
// ---------------------------------------------------------------------------

/**
 * Clave del objeto en el bucket: `lugares/<placeId>/<uuid>.<ext>`.
 *
 * El `uuid` va en el nombre y no un contador porque el borrado deja huecos: con
 * un contador, la foto 2 borrada y re-subida pisaría la vieja en el CDN y el
 * usuario vería la anterior cacheada. Prefijado por lugar para poder listar o
 * limpiar por lugar sin índice aparte.
 */
export function claveDeFoto(placeId: string, tipo: TipoFoto): string {
  return `lugares/${placeId}/${crypto.randomUUID()}.${EXTENSION[tipo]}`
}

/** URL pública de una clave. `R2_PUBLIC_URL` puede venir con o sin `/` final. */
export function urlPublica(clave: string, base = process.env.R2_PUBLIC_URL ?? ''): string {
  return `${base.replace(/\/$/, '')}/${clave}`
}

/**
 * La clave de vuelta desde la URL guardada en `place_photos.url`, para poder
 * borrar el objeto. `null` si la URL no es de nuestro bucket — una fila vieja o
 * manipulada no puede hacernos pedir un DELETE sobre una clave arbitraria.
 */
export function claveDeUrl(url: string, base = process.env.R2_PUBLIC_URL ?? ''): string | null {
  const prefijo = `${base.replace(/\/$/, '')}/`
  if (!base || !url.startsWith(prefijo)) return null
  const clave = url.slice(prefijo.length)
  return clave.length > 0 ? clave : null
}

// ---------------------------------------------------------------------------
// Cliente
// ---------------------------------------------------------------------------

let cliente: S3Client | null = null

/** Perezoso y memoizado: sin fotos en juego, la app nunca instancia el cliente. */
function getCliente(): S3Client {
  if (cliente) return cliente
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 sin configurar: faltan R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY')
  }
  cliente = new S3Client({
    // R2 no tiene regiones: 'auto' es lo que documenta Cloudflare.
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  })
  return cliente
}

function getBucket(): string {
  const bucket = process.env.R2_BUCKET
  if (!bucket) throw new Error('R2 sin configurar: falta R2_BUCKET')
  return bucket
}

/**
 * Sube el objeto y devuelve su URL pública. Si tira, el llamador **no** inserta
 * la fila en `place_photos` (edge case del spec: nunca una URL huérfana en DB; un
 * objeto huérfano en R2 sí es aceptable).
 */
export async function subirFoto(
  clave: string,
  cuerpo: Uint8Array,
  tipo: TipoFoto,
): Promise<string> {
  await getCliente().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: clave,
      Body: cuerpo,
      ContentType: tipo,
      // Las fotos son inmutables: la clave lleva un uuid, así que una clave nunca
      // cambia de contenido y el CDN puede quedársela para siempre.
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  )
  return urlPublica(clave)
}

/**
 * Borra el objeto. **Best effort**: el llamador borra la fila igual si esto falla
 * —una foto que el dueño quitó tiene que desaparecer de la ficha aunque R2 esté
 * caído— y el objeto queda huérfano, que es el lado barato del error.
 */
export async function borrarFoto(clave: string): Promise<void> {
  await getCliente().send(new DeleteObjectCommand({ Bucket: getBucket(), Key: clave }))
}
