import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { ImageResponse } from 'next/og'

import { DESCRIPCION, DOMINIO_PUBLICO } from '@/lib/seo/textos'

/**
 * La tarjeta que dibuja WhatsApp antes de que alguien abra un link nuestro
 * (INVITACION, decisión 2 — `PBETA-R2-02`).
 *
 * Vive en la **raíz** a propósito: las rutas anidadas la heredan sin declarar
 * nada, así que con esta sola pieza tienen imagen la home, la ficha y —lo que
 * motivó el hallazgo— el link de votación que circula por los grupos. Un link sin
 * imagen tiene exactamente la forma que tiene el spam en un grupo de WhatsApp.
 *
 * Se **genera en build**, no por request: la ruta es estática y no depende de
 * ningún dato. Cero costo por preview, y ningún crawler nos hace trabajar.
 *
 * Es código y no un PNG a mano (decisión 2): el `logo_2.png` original pesa 1,4 MB
 * y un binario que nadie sabe regenerar envejece peor que estas líneas. Los
 * colores son los de `app/globals.css`; van a mano por la misma razón que en
 * `app/manifest.ts` — esto no lee tokens de CSS. Si cambia la paleta, cambian los
 * tres.
 */

/**
 * ⚠️ **Es una ruta propia y no `app/opengraph-image.tsx`**, que sería lo
 * idiomático, por una razón medida el 2026-08-14: para las imágenes **de
 * archivo** Next arma la URL con la de su deploy —en `dev`, `localhost`— e
 * **ignora `metadataBase`**, incluso si el mismo segmento declara la imagen a
 * mano. Con eso el preview no se puede verificar desde afuera de la máquina, ni
 * por ngrok ni mandándose el link, y en producción colgaría de la URL del deploy
 * y no del dominio propio. Como ruta común, la URL sale de `metadataBase` y es la
 * misma en los dos mundos.
 *
 * `force-static`: se genera en build y se sirve como un archivo. Ningún crawler
 * nos hace trabajar.
 */

export const dynamic = 'force-static'

const SIZE = { width: 1200, height: 630 }

const FONDO = '#0D0D1F'
const TEXTO = '#F5F5F5'
const NARANJA = '#FF8A00'

/**
 * ⚠️ **Sin esto, `fontWeight` no existe** (hallazgo del 2026-08-29). `ImageResponse`
 * sin la opción `fonts` cae a la única fuente que trae `@vercel/og` —Geist
 * Regular— y **descarta los pesos en silencio**: el wordmark pedía 800 y se
 * renderizaba en normal. No falla, no avisa; solo se ve flojo.
 *
 * Los `.woff` viven al lado de este archivo y **son WOFF, no WOFF2**: Satori no lee
 * WOFF2, que es justo lo que baja `next/font`. Se regeneran desde Google Fonts
 * (`@fontsource/inter`), así que el binario no es un callejón sin salida.
 *
 * `readFileSync` desde `process.cwd()` es seguro **porque esta ruta es
 * `force-static`**: corre en build, donde el árbol del proyecto está entero. Si
 * alguna vez deja de ser estática, esto necesita `outputFileTracingIncludes`.
 */
const fuente = (archivo: string) => readFileSync(join(process.cwd(), 'app/og', archivo))

const FUENTES = [
  { name: 'Inter', data: fuente('Inter-Regular.woff'), weight: 400 as const, style: 'normal' as const },
  { name: 'Inter', data: fuente('Inter-ExtraBold.woff'), weight: 800 as const, style: 'normal' as const },
]

/**
 * El pin del wordmark (`components/shared/wordmark.tsx`), como data-URI. Va de
 * imagen y no de SVG inline porque es la vía que el renderer de `next/og`
 * soporta sin sorpresas; el `path` y el gradiente son los mismos de la marca, y
 * el centro calado se rellena con el fondo, igual que en la app.
 */
const pin = (alto: number) => `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 32" width="${(alto * 24) / 32}" height="${alto}">
    <defs>
      <linearGradient id="p" x1="12" y1="0" x2="12" y2="32" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#FF2D75"/>
        <stop offset="0.55" stop-color="#FF8A00"/>
        <stop offset="1" stop-color="#FFD400"/>
      </linearGradient>
    </defs>
    <path d="M12 0C5.373 0 0 5.373 0 12c0 8.5 12 20 12 20s12-11.5 12-20C24 5.373 18.627 0 12 0z" fill="url(#p)"/>
    <circle cx="12" cy="12" r="4.4" fill="${FONDO}"/>
  </svg>`,
)}`

/**
 * **La opacidad del pin de fondo es el número delicado de esta pieza** (elegido con
 * Fer el 2026-08-29, comparando los tres renders). Sobre un fondo tan oscuro, el
 * gradiente atenuado pierde el rosa y el amarillo: al ~20% no se lee como pin sino
 * como una mancha parda, que fue justo el motivo por el que se descartó una
 * composición anterior. A 0,38 el gradiente vuelve. **O es sutil o es protagonista;
 * el medio es tierra de nadie.**
 *
 * Va a la **derecha**: el texto ocupa la mitad izquierda, así que ahí no compite.
 */
const OPACIDAD_PIN = 0.38

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 76,
          position: 'relative',
          overflow: 'hidden',
          background: FONDO,
          fontFamily: 'Inter',
        }}
      >
        <div style={{ position: 'absolute', display: 'flex', right: -120, top: -110 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pin(860)} width={645} height={860} alt="" style={{ opacity: OPACIDAD_PIN }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pin(64)} width={48} height={64} alt="" />
          <div style={{ display: 'flex', fontSize: 30, fontWeight: 800, color: TEXTO, opacity: 0.75 }}>
            {DOMINIO_PUBLICO}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            fontSize: 122,
            fontWeight: 800,
            letterSpacing: -5,
            lineHeight: 0.98,
            textTransform: 'uppercase',
          }}
        >
          <span style={{ color: TEXTO }}>¿A dónde</span>
          <span style={{ color: NARANJA }}>salimos?</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
          {/* La barra firma con el gradiente de la marca sin pelearle al wordmark. */}
          <div
            style={{
              display: 'flex',
              height: 8,
              width: 260,
              borderRadius: 4,
              background: 'linear-gradient(90deg,#FF2D75,#FF8A00,#FFD400)',
            }}
          />
          {/* La bajada sale del dueño único (`lib/seo/textos.ts`) desde GEO F1: era
              una de las tres copias literales de la misma frase, y el JSON-LD de la
              entidad iba a ser la cuarta. Los colores siguen a mano: eso es paleta.
              Entra en UNA línea a este cuerpo — una más larga empuja el wordmark y
              desbalancea la pieza. */}
          <div style={{ display: 'flex', fontSize: 38, color: TEXTO, opacity: 0.72 }}>
            {DESCRIPCION}
          </div>
        </div>
      </div>
    ),
    { ...SIZE, fonts: FUENTES },
  )
}
