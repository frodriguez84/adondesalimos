import { after } from 'next/server'

import { auth } from '@/lib/auth'
import { guardarLugar, sacarLugar } from '@/lib/favoritos/acciones'
import { estadoDeFavoritos } from '@/lib/favoritos/query'
import {
  guardarLugarSchema,
  parsearIdsDelLote,
  sacarLugarSchema,
} from '@/lib/favoritos/validacion'
import { checkFavoritosRateLimit } from '@/lib/middleware/rate-limit'
import { registrarGuardado } from '@/lib/search/impressions'

/**
 * `GET /api/favoritos?ids=` — estado por lote · `POST /api/favoritos` — guardar ·
 * `DELETE /api/favoritos` — sacar (FAVORITOS, decisión 14).
 *
 * Adaptador fino, mismo orden que `POST /api/votaciones`: rate limit → **sesión
 * inline antes de mirar el payload** (decisión 7 de PULIDO: el chequeo de quién
 * sos va antes que la validación de forma) → zod → acción de dominio →
 * `{data, error:{message, code}}`.
 *
 * Los gates —cupo, pertenencia de la lista, tope de ítems— viven en
 * `lib/favoritos/acciones.ts`, no acá.
 */

export const dynamic = 'force-dynamic'

/** Códigos de dominio → status HTTP. Lo que no está mapeado es un 400. */
const STATUS_POR_CODIGO: Record<string, number> = {
  LISTA_NO_ENCONTRADA: 404,
  LUGAR_INEXISTENTE: 404,
  LIMITE_ITEMS: 409,
  NO_SESSION: 401,
}

const sinSesion = () =>
  Response.json(
    { data: null, error: { message: 'Iniciá sesión para guardar lugares.', code: 'NO_SESSION' } },
    { status: 401 },
  )

async function sesionDe(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers }).catch(() => null)
  return session?.user ?? null
}

async function leerJson(request: Request): Promise<unknown | undefined> {
  try {
    return await request.json()
  } catch {
    return undefined
  }
}

/**
 * Estado de un lote de lugares (F2). Existe para las superficies **cliente** que
 * no pueden resolverlo server-side: el chat, cuyas cards llegan por streaming.
 * Las pantallas server (home, ficha) siguen naciendo con el estado puesto — cero
 * requests al cargar (decisión 9, FAV-14).
 *
 * Devuelve también las listas visibles, porque el sheet de destino las necesita y
 * salen de la misma resolución. Sin sesión no es un error: es "no hay nada
 * guardado" — el botón se muestra igual y el tap lleva a login (decisión 7).
 */
export async function GET(request: Request) {
  const bloqueado = checkFavoritosRateLimit(request)
  if (bloqueado) return bloqueado

  const user = await sesionDe(request)
  if (!user) return Response.json({ data: { guardados: [], listas: [] }, error: null })

  const ids = parsearIdsDelLote(new URL(request.url).searchParams.get('ids'))

  try {
    const estado = await estadoDeFavoritos(user.id, ids)
    return Response.json({ data: estado, error: null })
  } catch (error) {
    console.error('[api/favoritos GET]', error)
    return Response.json(
      { data: null, error: { message: 'No pudimos leer tus guardados.', code: 'READ_FAILED' } },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  const bloqueado = checkFavoritosRateLimit(request)
  if (bloqueado) return bloqueado

  const user = await sesionDe(request)
  if (!user) return sinSesion()

  const body = await leerJson(request)
  if (body === undefined) {
    return Response.json(
      { data: null, error: { message: 'Datos inválidos.', code: 'BAD_JSON' } },
      { status: 400 },
    )
  }

  const parsed = guardarLugarSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { data: null, error: { message: 'Datos inválidos.', code: 'INVALID' } },
      { status: 400 },
    )
  }

  try {
    const resultado = await guardarLugar(user.id, parsed.data)
    if (!resultado.ok) {
      return Response.json(
        { data: null, error: { message: resultado.message, code: resultado.code } },
        { status: STATUS_POR_CODIGO[resultado.code] ?? 400 },
      )
    }

    // Decisión 12: el contador agregado va en `after()` —igual que impresiones y
    // taps— para no meter latencia en el tap. Solo el guardado **nuevo** suma: es
    // un histórico de eventos, no de taps.
    if (resultado.data.nuevo) {
      after(() => registrarGuardado(parsed.data.placeId))
    }

    return Response.json({ data: resultado.data, error: null }, { status: 201 })
  } catch (error) {
    // No se filtra el detalle al cliente (regla global de seguridad).
    console.error('[api/favoritos POST]', error)
    return Response.json(
      { data: null, error: { message: 'No pudimos guardarlo.', code: 'SAVE_FAILED' } },
      { status: 500 },
    )
  }
}

export async function DELETE(request: Request) {
  const bloqueado = checkFavoritosRateLimit(request)
  if (bloqueado) return bloqueado

  const user = await sesionDe(request)
  if (!user) return sinSesion()

  const body = await leerJson(request)
  if (body === undefined) {
    return Response.json(
      { data: null, error: { message: 'Datos inválidos.', code: 'BAD_JSON' } },
      { status: 400 },
    )
  }

  const parsed = sacarLugarSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { data: null, error: { message: 'Datos inválidos.', code: 'INVALID' } },
      { status: 400 },
    )
  }

  try {
    const resultado = await sacarLugar(user.id, parsed.data)
    if (!resultado.ok) {
      return Response.json(
        { data: null, error: { message: resultado.message, code: resultado.code } },
        { status: STATUS_POR_CODIGO[resultado.code] ?? 400 },
      )
    }
    // Sacar NO descuenta `saves` (decisión 12): el evento ocurrió.
    return Response.json({ data: resultado.data, error: null })
  } catch (error) {
    console.error('[api/favoritos DELETE]', error)
    return Response.json(
      { data: null, error: { message: 'No pudimos sacarlo.', code: 'DELETE_FAILED' } },
      { status: 500 },
    )
  }
}
