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
  EMAIL_NOT_VERIFIED: 'Verificá tu email antes de iniciar sesión. Te reenviamos el link.',
  // Lo devuelve nuestro propio handler (app/api/auth/[...all]/route.ts), ya en español.
  DISPOSABLE_EMAIL: 'Usá un email permanente para registrarte.',
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
