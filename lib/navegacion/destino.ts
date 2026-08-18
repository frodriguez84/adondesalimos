/**
 * ¿Este destino es nuestro? **Dueño único** de esa pregunta (SEC-04, auditoría de
 * seguridad del 2026-08-18). Nadie manda a `window.location.assign()` ni a
 * `router.push()` un valor que salió del query string sin pasar por acá.
 *
 * El agujero que tapa, reproducido en vivo contra dev antes de existir este
 * archivo: `/login?callbackUrl=https://example.com/robado` + un login exitoso
 * dejaba al usuario en `example.com`. `app/(auth)/login/page.tsx` leía
 * `callbackUrl` del query y se lo pasaba tal cual a `window.location.assign()`.
 *
 * **Por qué duele en esta app más que en otras**: el producto se reparte por links
 * pegados en grupos de WhatsApp (es el loop viral de INVITACION), así que un link
 * al dominio real circulando en un grupo es justo el patrón que la gente ya acepta
 * sin mirar. La víctima ve `adondesalimos.com.ar`, con HTTPS y el formulario de
 * verdad, se loguea, y aterriza en un clon que le pide la contraseña «porque la
 * sesión expiró». La señal de confianza juega a favor del atacante.
 *
 * **Por qué el `/registro` no estaba roto y el `/login` sí**: el registro le pasa
 * el destino a `signUp.email({ callbackURL })` y ahí better-auth lo valida contra
 * `trustedOrigins`. El login redirige del lado del cliente y se saltea esa red
 * entera. Igual los dos pasan por acá, para que no vuelvan a divergir.
 *
 * Lo que NO es este módulo: no decide si el «Volver» hace `back` o sube a la home
 * —eso es `volver.ts`, y son preguntas distintas— ni sabe nada de pendientes de
 * guardado (`lib/favoritos/pendiente.ts`).
 */

/** El destino cuando lo que vino no sirve. La home, que siempre existe. */
const DESTINO_POR_DEFECTO = '/'

/**
 * Normaliza un `callbackUrl` que vino del query string a una ruta **interna**.
 * Cualquier cosa que no sea claramente nuestra cae en la home: la lista es de
 * permitidos, no de prohibidos, porque enumerar formas de escribir un host ajeno
 * es una carrera que se pierde.
 *
 * Se aceptan solo rutas absolutas del propio sitio (`/mis-lugares?x=1`). Se
 * rechazan, entre otras:
 * - `https://evil.tld` — absoluta con esquema
 * - `javascript:...` — que además el browser ya bloquea en `assign()`, pero no se
 *   depende de eso
 * - `//evil.tld` — **protocol-relative**: sin esquema, y aun así el browser la
 *   trata como absoluta. Es el caso que se olvida siempre
 * - `/\evil.tld` — la misma trampa con backslash, que varios browsers normalizan
 *   a `//`. Por eso no alcanza con mirar el segundo carácter buscando `/`
 * - `  /algo` — con espacios o caracteres de control adelante; conservador a
 *   propósito, no se intenta "arreglar" la entrada
 */
export function destinoInterno(crudo: string | null | undefined): string {
  if (!crudo) return DESTINO_POR_DEFECTO
  if (!crudo.startsWith('/')) return DESTINO_POR_DEFECTO

  // El segundo carácter decide si es una ruta nuestra o un host ajeno disfrazado.
  const segundo = crudo[1]
  if (segundo === '/' || segundo === '\\') return DESTINO_POR_DEFECTO

  return crudo
}
