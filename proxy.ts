import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { evaluarCupoDePagina } from '@/lib/middleware/rate-limit'

/**
 * Rate limit de las **páginas** (`SEC-01`, auditoría de seguridad del 2026-08-18).
 *
 * Hasta acá el rate limit vivía **dentro** de cada route handler de `app/api/**`, así
 * que las páginas no pasaban por ningún límite. Medido: `GET /` cuesta 59 sentencias
 * de Postgres (74 con zona y tipo) contra las 12 de `/api/search`, que sí tenía cupo.
 * El agujero no era la falta de un número, era el perfil invertido — lo barato
 * protegido y lo caro abierto. La política (cuáles y cuántos) vive en
 * `lib/middleware/rate-limit.ts`, que es el dueño único de esa regla; acá solo se
 * decide **a qué rutas se aplica** y **qué se le contesta a un browser**.
 *
 * ⚠️ **Se llama `proxy.ts` y no `middleware.ts`**: Next 16 deprecó el nombre viejo y
 * lo renombró (`v16.0.0`). No es solo cosmético — **Proxy corre siempre en el runtime
 * de Node.js** y el `runtime` de segmento ni siquiera se puede declarar acá (tirar
 * error es el comportamiento documentado). O sea: el cupo en memoria de proceso que
 * usa el resto de la app funciona igual acá, sin edge de por medio.
 *
 * **Lo que se pierde, explícito** (misma degradación que ya aceptó `DEPLOY`, decisión
 * 12): el contador es por instancia. La doc de Next además pide no apoyarse en globals
 * dentro del Proxy. La falla es **abierta**: memoria que no se comparte solo puede
 * sub-contar, nunca inventar un 429 que no corresponde. Cuando entre Upstash
 * (`DEPLOY` F2) se cambia el almacenamiento adentro de `rate-limit.ts` y este archivo
 * no se toca.
 *
 * **Los headers de seguridad NO están acá**, aunque `SEC-11` naciera pegado a este
 * hallazgo: van en `next.config.ts` → `headers()`, que corre **antes** que el Proxy en
 * la cadena de Next y lo aplica la capa de routing sin gastar una invocación.
 */

/**
 * ⚠️ **`/api` queda afuera a propósito, y no es un olvido.** Cada endpoint ya tiene su
 * cupo, con el número que le corresponde a lo que cuesta. Y sobre todo:
 * **`/api/webhooks/mercadopago` no puede recibir un 429 nuestro** — ese request lo hace
 * MercadoPago desde sus servidores, el webhook es idempotente y fail-closed, así que
 * bloquearlo no rompe con un error visible: se caen acreditaciones **en silencio**.
 *
 * También quedan afuera los estáticos, los archivos de metadata y `/og`, que es
 * `force-static`: es la tarjeta que dibuja WhatsApp antes de que alguien abra un link
 * nuestro, no toca la base, y un 429 ahí rompería los previews del loop viral.
 */
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|og|icons|favicon.ico|icon.png|apple-icon.png|manifest.webmanifest|robots.txt|sitemap.xml).*)',
  ],
}

/** Copy de cara al usuario: rioplatense, y sin culpar al que cayó del otro lado del cupo. */
const TITULO = 'Pará un poco'
const BAJADA = 'Estás yendo muy rápido. Probá de nuevo en un minuto.'

/**
 * HTML mínimo y sin assets: el 429 no puede depender de `/_next/*`, que es justo lo
 * que no se va a servir. Los colores son los de `app/globals.css` a mano, por el mismo
 * motivo que en `app/og/route.tsx` y `app/manifest.ts`.
 */
function pagina429(resetAt: number): NextResponse {
  const segundos = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))

  const html = `<!doctype html>
<html lang="es-AR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${TITULO} — A Dónde Salimos</title>
<style>
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
         background:#0D0D1F; color:#F5F5F5; font-family:system-ui,-apple-system,sans-serif; }
  main { max-width:22rem; padding:2rem; text-align:center; }
  h1 { font-size:1.5rem; margin:0 0 .75rem; color:#F5B841; }
  p { margin:0; line-height:1.5; opacity:.85; }
</style>
</head>
<body><main><h1>${TITULO}</h1><p>${BAJADA}</p></main></body>
</html>`

  return new NextResponse(html, {
    status: 429,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Retry-After': String(segundos),
      'Cache-Control': 'no-store',
    },
  })
}

export function proxy(request: NextRequest): NextResponse {
  const bloqueo = evaluarCupoDePagina(request, request.nextUrl.pathname)
  if (bloqueo) return pagina429(bloqueo.resetAt)

  return NextResponse.next()
}
