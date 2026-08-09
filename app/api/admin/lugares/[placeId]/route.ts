import { z } from 'zod'

import { sesionAdmin } from '@/lib/auth/sesion'
import { corregirDatos, soltarCampo } from '@/lib/negocio/correcciones'
import { getLugarParaCorregir } from '@/lib/negocio/query'

/**
 * `PATCH /api/admin/lugares/[placeId]` — corregir los datos base de un lugar.
 * `POST` con `{ accion: 'soltar', campo }` — soltar un campo fijado (decisión 10).
 *
 * Adaptador HTTP fino: **toda** la validación de negocio —la fuente obligatoria,
 * el bbox de AMBA, el pin completo, la unión de `locked_fields`, la re-asignación
 * de zonas y la invalidación del match con Google— vive en
 * `lib/negocio/correcciones.ts`, que es el dueño único. Acá no se decide nada:
 * mismo reparto que `POST /api/admin/usuarios/[userId]/plan` ↔ `otorgarCortesia`.
 *
 * Gate de admin inline y sin rate limit, como el resto de `/api/admin/*`.
 */

export const dynamic = 'force-dynamic'

/** El código de negocio manda el status; el mensaje ya viene en rioplatense. */
const STATUS: Record<string, number> = {
  INVALID: 400,
  CAMPO_INVALIDO: 400,
  NO_FIJADO: 409,
  NO_EXISTE: 404,
}

const soltarSchema = z.object({ accion: z.literal('soltar'), campo: z.string() })

function noAutorizado() {
  return Response.json(
    { data: null, error: { message: 'No autorizado.', code: 'FORBIDDEN' } },
    { status: 403 },
  )
}

async function leerBody(request: Request): Promise<unknown | undefined> {
  try {
    return await request.json()
  } catch {
    return undefined
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ placeId: string }> }) {
  const admin = await sesionAdmin(request.headers)
  if (!admin) return noAutorizado()

  const { placeId } = await params
  const body = await leerBody(request)
  if (body === undefined) {
    return Response.json(
      { data: null, error: { message: 'Datos inválidos.', code: 'BAD_JSON' } },
      { status: 400 },
    )
  }

  try {
    // El body va sin parsear: el schema es el de `correcciones.ts` (decisión 13).
    const resultado = await corregirDatos(placeId, body, admin.email)
    if (!resultado.ok) {
      return Response.json(
        { data: null, error: { message: resultado.message, code: resultado.code } },
        { status: STATUS[resultado.code] ?? 400 },
      )
    }

    // El editor se repinta con el estado ya guardado, no con el optimista.
    const lugar = await getLugarParaCorregir(placeId)
    return Response.json({ data: { aplicada: resultado.data, lugar }, error: null })
  } catch (error) {
    console.error('[api/admin/lugares PATCH]', placeId, error)
    return Response.json(
      { data: null, error: { message: 'No pudimos guardar la corrección.', code: 'FAILED' } },
      { status: 500 },
    )
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ placeId: string }> }) {
  const admin = await sesionAdmin(request.headers)
  if (!admin) return noAutorizado()

  const { placeId } = await params
  const parsed = soltarSchema.safeParse(await leerBody(request))
  if (!parsed.success) {
    return Response.json(
      { data: null, error: { message: 'Datos inválidos.', code: 'INVALID' } },
      { status: 400 },
    )
  }

  try {
    const resultado = await soltarCampo(placeId, parsed.data.campo, admin.email)
    if (!resultado.ok) {
      return Response.json(
        { data: null, error: { message: resultado.message, code: resultado.code } },
        { status: STATUS[resultado.code] ?? 400 },
      )
    }

    const lugar = await getLugarParaCorregir(placeId)
    return Response.json({ data: { lugar }, error: null })
  } catch (error) {
    console.error('[api/admin/lugares POST]', placeId, error)
    return Response.json(
      { data: null, error: { message: 'No pudimos soltar el campo.', code: 'FAILED' } },
      { status: 500 },
    )
  }
}
