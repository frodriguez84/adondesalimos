import { sesionAdmin } from '@/lib/auth/sesion'
import { editarPrecio } from '@/lib/billing/settings'

/**
 * `PATCH /api/admin/settings` — edita un precio de plan y registra el cambio
 * (MONETIZACION, decisiones 25-26). Body: `{ key, value }`.
 *
 * Gate de admin inline (`ADMIN_EMAIL`), mismo patrón que `PATCH
 * /api/admin/claims/[id]`: sin `ADMIN_EMAIL` seteado, `sesionAdmin` devuelve null
 * para todos y esto responde 403.
 *
 * La allowlist de claves y la validación del monto viven en `editarPrecio` (una
 * sola fuente): este handler solo es el adaptador HTTP. El cambio queda en
 * `app_settings_history` con quién y cuándo, y rige el checkout siguiente sin
 * deploy — las suscripciones vivas conservan su `amount_ars` congelado.
 */

export const dynamic = 'force-dynamic'

export async function PATCH(request: Request) {
  const admin = await sesionAdmin(request.headers)
  if (!admin) {
    return Response.json(
      { data: null, error: { message: 'No autorizado.', code: 'FORBIDDEN' } },
      { status: 403 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json(
      { data: null, error: { message: 'Datos inválidos.', code: 'BAD_JSON' } },
      { status: 400 },
    )
  }

  const { key, value } = (body as { key?: unknown; value?: unknown } | null) ?? {}
  if (typeof key !== 'string') {
    return Response.json(
      { data: null, error: { message: 'Falta la configuración a editar.', code: 'INVALID' } },
      { status: 400 },
    )
  }

  const resultado = await editarPrecio(key, value, admin.email)
  if (!resultado.ok) {
    return Response.json(
      { data: null, error: { message: resultado.message, code: resultado.code } },
      { status: 400 },
    )
  }

  return Response.json({ data: { ok: true }, error: null })
}
