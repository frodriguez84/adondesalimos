import { checkTapRateLimit } from '@/lib/middleware/rate-limit'
import { registrarTap } from '@/lib/search/impressions'
import { esTapKind } from '@/lib/lugar/tap-kinds'

/**
 * `POST /api/lugar/[id]/tap` — beacon de taps de la ficha (MONETIZACION,
 * decisión 22a). El cliente dispara `navigator.sendBeacon` al tocar teléfono /
 * cómo llegar / website / redes / carta; acá se upsertea el contador agregado.
 *
 * **Best-effort, como `registrarImpresiones`**: un tap perdido no rompe nada. El
 * beacon no lee la respuesta, así que el status es informativo. Igual se valida
 * el `kind` y se aplica rate limit (60/h/IP, decisión 29): el dato es del dueño y
 * no vale inflarlo.
 *
 * **Agregado puro**: no se toca sesión, cookie ni IP para identificar a nadie —
 * la IP solo alimenta el rate limit, nunca se persiste (invariante decisión 22).
 */

export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const bloqueado = checkTapRateLimit(request)
  if (bloqueado) return bloqueado

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json(
      { data: null, error: { message: 'Datos inválidos.', code: 'BAD_JSON' } },
      { status: 400 },
    )
  }

  const kind = (body as { kind?: unknown } | null)?.kind
  if (!esTapKind(kind)) {
    return Response.json(
      { data: null, error: { message: 'Tipo de acción inválido.', code: 'INVALID_KIND' } },
      { status: 400 },
    )
  }

  // No se valida que el lugar exista ni esté publicado: `registrarTap` traga el
  // error de FK igual que `registrarImpresiones` y un id inventado no persiste
  // nada. Verificarlo sería una query de más en un camino best-effort.
  await registrarTap(id, kind)

  return Response.json({ data: { ok: true }, error: null })
}
