/**
 * URL base absoluta de la app — **dueño único** (SEO, decisión 16).
 *
 * Hasta acá el fallback de `BETTER_AUTH_URL` a `localhost:5178` estaba copiado
 * en `app/layout.tsx` (el `metadataBase` del `og:`), en
 * `lib/email/index.ts` (los links de los mails) y en `lib/billing/mercadopago.ts`
 * (las `back_url` del checkout). El sitemap necesita URLs absolutas y habría sido
 * la cuarta copia: se unifica acá porque este spec es el que lo obliga
 * (`CLAUDE.md` § *Una regla, un dueño*).
 *
 * ⚠️ **`lib/auth/client.ts` queda afuera a propósito.** No es la misma regla: es
 * la URL que usa el **browser** para pegarle a better-auth, sale de otra variable
 * (`NEXT_PUBLIC_APP_URL`, que sí viaja al bundle) y en el cliente prefiere
 * `window.location.origin`. Unificarla acá metería una variable server-only en
 * código de cliente. Tampoco entra `lib/auth/index.ts`, que lee
 * `BETTER_AUTH_URL!` sin fallback porque better-auth la exige no-nula.
 */

/** Sin barra final: todos los consumidores concatenan paths que arrancan con `/`. */
export const APP_URL = (process.env.BETTER_AUTH_URL ?? 'http://localhost:5178').replace(/\/+$/, '')
