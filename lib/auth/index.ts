import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { sendResetPasswordEmail, sendVerificationEmail } from '@/lib/email'
import { limpiarFotosDeUsuario } from '@/lib/negocio/acciones'
import { cancelarSuscripcionesDeUsuario } from '@/lib/billing/baja'

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
      try {
        await sendResetPasswordEmail(user.email, url)
      } catch (err) {
        console.error('[auth] error enviando email de reset:', err)
      }
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
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      try {
        await sendVerificationEmail(user.email, url)
      } catch (err) {
        console.error('[auth] error enviando verificación:', err)
      }
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
