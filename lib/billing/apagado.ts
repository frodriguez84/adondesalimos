/**
 * **El interruptor del cobro** (DEPLOY, decisión 6): está apagado ⇔ no hay
 * `NEXT_PUBLIC_MP_PUBLIC_KEY`.
 *
 * Es la misma señal que ya usaba `checkout-modal.tsx` para degradar, elevada a
 * dueño único. **No hay flag en `app_settings`**: sería una segunda fuente de
 * verdad sobre lo mismo, y prenderla sin la key devolvería al usuario al mensaje
 * de "Configuración de pago incompleta".
 *
 * Isomorfo a propósito —lo leen el panel (cliente) y las pages (server)—, así que
 * acá no entra nada de `lib/db`. En el cliente Next inlinea el literal
 * `process.env.NEXT_PUBLIC_MP_PUBLIC_KEY` en el bundle: prenderlo en Vercel
 * requiere **redeploy**, no alcanza con setear la var (decisión 18).
 *
 * En dev el `.env` tiene la key, así que esto es `false` y no cambia nada.
 */
export function cobroApagado(): boolean {
  return !process.env.NEXT_PUBLIC_MP_PUBLIC_KEY
}
