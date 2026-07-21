import { Resend } from 'resend'

/**
 * Mails transaccionales (Resend, patrón StressPlan — decisión 25). En v1: solo
 * verificación de email y reset de password. Los mails de reclamo aprobado/
 * rechazado llegan con F2.
 *
 * `RESEND_API_KEY` es server-only. En dev el sender por defecto es el sandbox de
 * Resend (`onboarding@resend.dev`); en prod se setea `RESEND_FROM_EMAIL` con un
 * dominio verificado.
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
<body style="margin:0;padding:0;background:#0F0F0F;font-family:Inter,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0F0F0F;padding:40px 20px">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#1A1A1A;border-radius:12px;border:1px solid #2A2A2A;padding:40px">
        <tr><td>
          <p style="margin:0 0 4px;font-size:13px;color:#888;letter-spacing:0.05em;text-transform:uppercase">${BRAND}</p>
          <h1 style="margin:0 0 24px;font-size:22px;color:#F5F5F5;font-weight:700">${title}</h1>
          ${bodyHtml}
          <hr style="margin:28px 0;border:none;border-top:1px solid #2A2A2A">
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
  return `<a href="${url}" style="display:inline-block;background:#F59E0B;color:#0F0F0F;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px;text-decoration:none">${label}</a>`
}

export async function sendVerificationEmail(email: string, url: string) {
  const result = await resend.emails.send({
    from: FROM,
    to: email,
    subject: `Verificá tu email — ${BRAND}`,
    html: shell(
      'Verificá tu email',
      `
        <p style="margin:0 0 28px;font-size:15px;color:#888;line-height:1.6">
          Confirmá que este buzón es tuyo para poder iniciar sesión y recuperar tu cuenta si perdés la contraseña.
        </p>
        ${cta(url, 'Verificar mi email →')}
        <p style="margin:28px 0 0;font-size:13px;color:#555;line-height:1.6">
          Si no creaste una cuenta, podés ignorar este mail.
        </p>`,
    ),
  })
  if (result.error) {
    console.error('[resend] error al enviar verificación:', JSON.stringify(result.error))
    throw new Error(result.error.message)
  }
}

export async function sendResetPasswordEmail(email: string, url: string) {
  const result = await resend.emails.send({
    from: FROM,
    to: email,
    subject: `Restablecer contraseña — ${BRAND}`,
    html: shell(
      'Restablecer contraseña',
      `
        <p style="margin:0 0 28px;font-size:15px;color:#888;line-height:1.6">
          Recibimos una solicitud para restablecer la contraseña de tu cuenta.<br>
          El link es válido por <strong style="color:#F5F5F5">1 hora</strong>.
        </p>
        ${cta(url, 'Restablecer contraseña →')}
        <p style="margin:28px 0 0;font-size:13px;color:#555;line-height:1.6">
          Si no solicitaste este cambio, podés ignorar este mail.<br>
          Tu contraseña no cambia hasta que uses el link.
        </p>`,
    ),
  })
  if (result.error) {
    console.error('[resend] error al enviar reset:', JSON.stringify(result.error))
    throw new Error(result.error.message)
  }
}
