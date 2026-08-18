// better-auth devuelve sus errores en inglés ("Invalid email or password",
// "User already exists…"). Acá se mapea el CÓDIGO a copy propio en español; un
// código desconocido cae en el genérico — nunca se muestra el mensaje crudo del
// backend. Portado de StressPlan (cicatrices BUG-E2E-001 / BUG-027).
const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: 'El email o la contraseña no coinciden.',
  INVALID_PASSWORD: 'El email o la contraseña no coinciden.',
  USER_NOT_FOUND: 'El email o la contraseña no coinciden.',
  CREDENTIAL_ACCOUNT_NOT_FOUND:
    'Esa cuenta se creó con Google. Iniciá sesión con Google.',
  USER_ALREADY_EXISTS: 'Ese email ya tiene una cuenta. Iniciá sesión.',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'Ese email ya tiene una cuenta. Iniciá sesión.',
  FAILED_TO_CREATE_USER: 'No se pudo crear la cuenta. Probá de nuevo en un momento.',
  PASSWORD_TOO_SHORT: 'La contraseña debe tener al menos 8 caracteres.',
  PASSWORD_TOO_LONG: 'La contraseña es demasiado larga.',
  INVALID_EMAIL: 'Ese email no es válido.',
  // SEC-05: decía "Te reenviamos el link", y era una promesa que podía ser falsa —
  // better-auth reintenta el envío acá, pero se traga el error si Resend falla. Ahora
  // el reenvío es un botón que sí informa el resultado.
  EMAIL_NOT_VERIFIED: 'Verificá tu email antes de iniciar sesión. Si no te llegó, pedilo de nuevo.',
  // Lo devuelve nuestro propio handler (app/api/auth/[...all]/route.ts), ya en español.
  DISPOSABLE_EMAIL: 'Usá un email permanente para registrarte.',
  // SEC-05: los tira el cupo de mails (`lib/email/cupo.ts`), traducidos a HTTP en
  // `lib/auth/index.ts`. Antes un cupo agotado llegaba como un 500 pelado.
  DEMASIADOS_MAILS:
    'Ya te mandamos varios mails hoy. Mirá la bandeja y el spam, y si no está, probá mañana.',
  EMAIL_PAUSADO: 'Estamos con problemas para mandar mails. Probá de nuevo más tarde.',
  // Lo tira `/send-verification-email` cuando hay una sesión abierta de OTRA cuenta:
  // el endpoint solo deja pedir el link del email de la sesión. Aparece si alguien
  // crea una segunda cuenta sin salir de la primera (típico de compu compartida), y
  // sin este copy el botón de reenvío quedaba mudo. Salió en el QA en vivo de SEC-05.
  EMAIL_MISMATCH:
    'Tenés otra cuenta abierta en este navegador. Cerrá sesión y volvé a pedir el link.',
}

const GENERIC = 'No pudimos completar la operación. Probá de nuevo en un momento.'

export function authErrorMessage(
  error: { code?: string | null; message?: string | null } | null | undefined,
  fallback: string = GENERIC,
): string {
  const code = error?.code?.toUpperCase()
  if (code && MESSAGES[code]) return MESSAGES[code]
  return fallback
}
