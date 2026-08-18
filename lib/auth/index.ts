import { betterAuth } from 'better-auth'
import { APIError } from 'better-auth/api'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { sendResetPasswordEmail, sendVerificationEmail } from '@/lib/email'
import { CupoEmailError } from '@/lib/email/cupo'
import { limpiarFotosDeUsuario } from '@/lib/negocio/acciones'
import { cancelarSuscripcionesDeUsuario } from '@/lib/billing/baja'

/**
 * Traduce el rechazo del cupo de mails a un error HTTP con código propio, para que
 * la pantalla pueda decir *por qué* no salió (`SEC-05`). Sin esto un cupo agotado
 * llega al cliente como un 500 pelado, indistinguible de "se cayó Resend".
 *
 * El mapeo vive acá y no en `lib/email/*` a propósito: el cupo también lo consumen
 * los mails de reclamo, que no pasan por better-auth y no deberían arrastrar sus
 * tipos. Este es el borde HTTP.
 */
async function conCupoTraducido(enviar: () => Promise<void>): Promise<void> {
  try {
    await enviar()
  } catch (err) {
    if (err instanceof CupoEmailError) {
      throw new APIError('TOO_MANY_REQUESTS', { message: err.code, code: err.code })
    }
    throw err
  }
}

/**
 * Config de better-auth replicando el patrón de StressPlan (decisión 6), con una
 * divergencia explícita: `requireEmailVerification: true` (decisión 7) — sin
 * verificar el email NO hay login. Allá quedó en `false` (BUG-E2E-003); acá es un
 * requisito anti-abuso decidido en IDEAS.
 *
 * Sin sistema de roles en DB (decisión 8): admin = comparación con `ADMIN_EMAIL`,
 * dueño = derivado de un reclamo aprobado (spec F2). No hay elección de rol.
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.users,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    // Divergencia con StressPlan (decisión 7): sin email verificado no hay login.
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      // No loguear `url`: lleva el token de reset embebido (account takeover si se
      // filtran logs). Tampoco el email (PII). Cicatriz AUD-03 de StressPlan.
      //
      // El error se PROPAGA (`SEC-05`): acá better-auth sí lo deja llegar al cliente,
      // así que "no pudimos mandarte el mail" es la respuesta honesta. Antes un
      // `console.error` lo tragaba y la pantalla decía "revisá tu mail" igual.
      await conCupoTraducido(() => sendResetPasswordEmail(user.email, url))
    },
  },
  // Eliminar cuenta desde `/cuenta` (spec F1). Sin callback de verificación:
  // se borra tras reautenticar con la contraseña (`deleteUser({ password })`).
  user: {
    deleteUser: {
      enabled: true,
      /**
       * Edge case del spec (F2): al borrarse un dueño, sus claims caen por
       * cascade y el lugar pierde la condición de reclamado — pero el
       * `publish_override` que puso la aprobación no se baja solo, y el lugar
       * quedaría publicado sin dueño. Se baja acá, ANTES del delete: después la
       * fila del claim ya no existe y no habría por dónde encontrar el lugar.
       *
       * Un `source='overture'` con buen confidence sigue publicado por la regla
       * normal; uno `source='owner'` vuelve a ser invisible. La regla no se toca.
       *
       * F3 completa el edge case: se borran también sus fotos (base + R2). El
       * contenido de `place_owner_content` no se borra — sin claim aprobado la
       * ficha deja de aplicarlo, que es lo que el spec pide ("deja de mostrarse").
       *
       * MONETIZACION F2 (decisión 28): antes del cascade que borra sus
       * `subscriptions`, se cancelan los preapprovals en MP (best-effort) para que
       * MP deje de cobrar, y se baja el `owner_plan` de sus lugares.
       */
      beforeDelete: async (user) => {
        // Antes del cascade: lee las subscriptions vivas y las cancela en MP.
        await cancelarSuscripcionesDeUsuario(user.id)

        // Antes que el update: usa los claims, que el cascade está por borrar.
        await limpiarFotosDeUsuario(user.id)

        await db
          .update(schema.places)
          .set({ publishOverride: false, updatedAt: new Date() })
          .where(
            inArray(
              schema.places.id,
              db
                .select({ id: schema.placeClaims.placeId })
                .from(schema.placeClaims)
                .where(
                  and(
                    eq(schema.placeClaims.userId, user.id),
                    eq(schema.placeClaims.status, 'approved'),
                  ),
                ),
            ),
          )
      },
    },
  },
  emailVerification: {
    /**
     * ⚠️ **En `false` a propósito** (`SEC-05`), y no es un "no mandamos el mail":
     * lo manda la pantalla de registro con `authClient.sendVerificationEmail`
     * apenas el alta vuelve OK.
     *
     * El motivo es que **por acá el error no llega al cliente**. El sign-up de
     * better-auth invoca este callback dentro de `runInBackgroundOrAwait`, que
     * tiene su propio `catch` y solo loguea (`context/create-context.mjs`), así
     * que si Resend falla el alta devuelve **200** igual. Con eso, la pantalla
     * mostraba "revisá tu mail" y el usuario quedaba creado, sin verificar, sin
     * poder loguear (`requireEmailVerification: true`) y sin poder re-registrarse
     * —el email ya existía—. Alcanzaba un mal día de Resend para cerrar el alta
     * en silencio, sin atacante.
     *
     * El endpoint `/send-verification-email`, en cambio, **sí** propaga el error
     * (`if (error) throw error`). Mandar desde ahí deja un solo camino de envío,
     * el mismo que usa el botón de reenvío, y hace que la pantalla pueda decir la
     * verdad. Volver esto a `true` reabre `SEC-05` (a).
     */
    sendOnSignUp: false,
    autoSignInAfterVerification: true,
    // El error se propaga (ver arriba): quien llama tiene que poder avisarle al
    // usuario que el mail no salió. Envolverlo en un `console.error` era el bug.
    sendVerificationEmail: async ({ user, url }) => {
      await conCupoTraducido(() => sendVerificationEmail(user.email, url))
    },
  },
  // Google OAuth condicional por env (decisión 6): sin las vars, el botón no
  // aparece y el proveedor no se registra.
  ...(process.env.GOOGLE_CLIENT_ID
    ? {
        socialProviders: {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          },
        },
      }
    : {}),
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL!,
  trustedOrigins: process.env.BETTER_AUTH_TRUSTED_ORIGINS
    ? process.env.BETTER_AUTH_TRUSTED_ORIGINS.split(',')
    : [],
  advanced: {
    database: {
      // users.id es UUID — generar UUIDs para todos los modelos (las columnas
      // text de session/account/verification aceptan el string uuid).
      generateId: () => crypto.randomUUID(),
    },
  },
})

export type Session = typeof auth.$Infer.Session
