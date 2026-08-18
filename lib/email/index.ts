import { Resend } from 'resend'
import { reservarEnvio, type EmailSku } from './cupo'

/**
 * Mails transaccionales (Resend, patrón StressPlan — decisión 25). En v1, los
 * cuatro: verificación de email, reset de password, reclamo aprobado y reclamo
 * rechazado. Nada más.
 *
 * `RESEND_API_KEY` es server-only. En dev el sender por defecto es el sandbox de
 * Resend (`onboarding@resend.dev`); en prod se setea `RESEND_FROM_EMAIL` con un
 * dominio verificado.
 *
 * **Todo sale por `enviar`** (`SEC-05`). Antes cada función repetía el mismo
 * `resend.emails.send` + chequeo de `result.error`, así que el cupo habría tenido
 * cuatro puntos de aplicación —y cuatro lugares donde olvidarlo—. Con un solo
 * embudo, "¿podemos mandar este mail?" se pregunta una vez y la responde su dueño
 * (`lib/email/cupo.ts`).
 */
const resend = new Resend(process.env.RESEND_API_KEY)

const FROM = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'
const APP_URL = process.env.BETTER_AUTH_URL ?? 'http://localhost:5178'

const BRAND = '¿A dónde salimos?'

/** Layout compartido de los mails. Colores = la paleta única (globals.css). */
function shell(title: string, bodyHtml: string): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0D0D1F;font-family:Inter,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0D0D1F;padding:40px 20px">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#1A1A2E;border-radius:12px;border:1px solid #2A2A3E;padding:40px">
        <tr><td>
          <p style="margin:0 0 4px;font-size:13px;color:#888;letter-spacing:0.05em;text-transform:uppercase">${BRAND}</p>
          <h1 style="margin:0 0 24px;font-size:22px;color:#F5F5F5;font-weight:700">${title}</h1>
          ${bodyHtml}
          <hr style="margin:28px 0;border:none;border-top:1px solid #2A2A3E">
          <p style="margin:0;font-size:12px;color:#555">
            <a href="${APP_URL}" style="color:#555;text-decoration:none">${BRAND}</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function cta(url: string, label: string): string {
  return `<a href="${url}" style="display:inline-block;background:#FF8A00;color:#0D0D1F;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px;text-decoration:none">${label}</a>`
}

/**
 * El único lugar del proyecto que le habla a Resend. Pide el cupo primero (tira
 * `CupoEmailError` si no hay) y recién después manda; si Resend rechaza, tira.
 *
 * **Nunca se traga el error**: quien llama tiene que poder decirle al usuario que
 * el mail no salió. El modo de falla silencioso —un `console.error` y seguir— era
 * la mitad de `SEC-05`: el alta quedaba cerrada y nadie se enteraba.
 *
 * No se loguea ni el email (PII) ni la `url` (lleva el token embebido: filtrarla en
 * logs es un account takeover). Cicatriz AUD-03 de StressPlan.
 */
async function enviar(args: {
  sku: EmailSku
  to: string
  subject: string
  title: string
  bodyHtml: string
}): Promise<void> {
  const { sku, to, subject, title, bodyHtml } = args

  await reservarEnvio(to, sku)

  const result = await resend.emails.send({
    from: FROM,
    to,
    subject,
    html: shell(title, bodyHtml),
  })
  if (result.error) {
    console.error(`[resend] error al enviar ${sku}:`, JSON.stringify(result.error))
    throw new Error(result.error.message)
  }
}

export async function sendVerificationEmail(email: string, url: string) {
  await enviar({
    sku: 'verification',
    to: email,
    subject: `Verificá tu email — ${BRAND}`,
    title: 'Verificá tu email',
    bodyHtml: `
        <p style="margin:0 0 28px;font-size:15px;color:#888;line-height:1.6">
          Confirmá que este mail es tuyo para poder iniciar sesión y recuperar tu cuenta si perdés la contraseña.
        </p>
        ${cta(url, 'Verificar mi email →')}
        <p style="margin:28px 0 0;font-size:13px;color:#555;line-height:1.6">
          Si no creaste una cuenta, podés ignorar este mail.
        </p>`,
  })
}

/** Escapa lo que viene del usuario o del admin antes de meterlo en el HTML. */
function esc(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Reclamo aprobado (decisión 22). El lugar ya está publicado cuando esto sale:
 * el mail linkea a la ficha, que es la prueba.
 */
export async function sendClaimApprovedEmail(email: string, placeName: string, placeId: string) {
  const url = `${APP_URL}/lugar/${placeId}`
  await enviar({
    sku: 'claim_approved',
    to: email,
    subject: `Aprobamos tu negocio: ${placeName} — ${BRAND}`,
    title: 'Tu negocio ya está publicado',
    bodyHtml: `
        <p style="margin:0 0 28px;font-size:15px;color:#888;line-height:1.6">
          Verificamos tu solicitud sobre <strong style="color:#F5F5F5">${esc(placeName)}</strong> y ya sos su dueño en la app.
          Su ficha está publicada y aparece en las búsquedas.
        </p>
        ${cta(url, 'Ver la ficha →')}`,
  })
}

/** Reclamo rechazado: el motivo del admin viaja en el mail (decisión 22). */
export async function sendClaimRejectedEmail(email: string, placeName: string, motivo: string) {
  await enviar({
    sku: 'claim_rejected',
    to: email,
    subject: `Sobre tu solicitud para ${placeName} — ${BRAND}`,
    title: 'No pudimos aprobar tu solicitud',
    bodyHtml: `
        <p style="margin:0 0 16px;font-size:15px;color:#888;line-height:1.6">
          Revisamos tu solicitud sobre <strong style="color:#F5F5F5">${esc(placeName)}</strong> y por ahora no la aprobamos.
        </p>
        <p style="margin:0 0 28px;padding:14px 16px;border-radius:10px;background:#0D0D1F;border:1px solid #2A2A3E;font-size:14px;color:#F5F5F5;line-height:1.6">
          ${esc(motivo)}
        </p>
        <p style="margin:0;font-size:13px;color:#555;line-height:1.6">
          Si podés aportar algo que confirme tu vínculo con el negocio, respondé este mail y lo miramos de nuevo.
        </p>`,
  })
}

export async function sendResetPasswordEmail(email: string, url: string) {
  await enviar({
    sku: 'reset_password',
    to: email,
    subject: `Restablecer contraseña — ${BRAND}`,
    title: 'Restablecer contraseña',
    bodyHtml: `
        <p style="margin:0 0 28px;font-size:15px;color:#888;line-height:1.6">
          Recibimos una solicitud para restablecer la contraseña de tu cuenta.<br>
          El link es válido por <strong style="color:#F5F5F5">1 hora</strong>.
        </p>
        ${cta(url, 'Restablecer contraseña →')}
        <p style="margin:28px 0 0;font-size:13px;color:#555;line-height:1.6">
          Si no solicitaste este cambio, podés ignorar este mail.<br>
          Tu contraseña no cambia hasta que uses el link.
        </p>`,
  })
}
