import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { ReanudarGuardado } from '@/components/favoritos/reanudar-guardado'
import { MarcadorNavegacion } from '@/components/navegacion/marcador-navegacion'
import { AvisoProvider } from '@/components/ui/aviso'
import { APP_URL } from '@/lib/app-url'
import { DESCRIPCION, MARCA } from '@/lib/seo/textos'
import './globals.css'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
})

// El nombre de la app tenía dos copias literales —acá y en el `<title>` de la
// ficha— y F2 iba a ser la tercera (las 301 páginas de `/salir` cierran su título
// igual). Se unifica en `lib/seo/textos.ts` antes de crearla, no después.
//
// La descripción hizo el mismo camino en GEO F1, por el mismo motivo: el JSON-LD
// de la entidad (`sitioJsonLd`) habría sido su segunda copia literal.
const TITULO = MARCA

export const metadata: Metadata = {
  // De dónde cuelga la URL **absoluta** del `og:image`. La base tiene dueño
  // único desde SEO (decisión 16): `lib/app-url.ts`.
  metadataBase: new URL(APP_URL),
  title: TITULO,
  description: DESCRIPCION,
  // INVITACION, decisión 3 (`PBETA-R2-02`): la app no declaraba **ninguna**
  // etiqueta `og:`/`twitter:`, así que un link nuestro pegado en un grupo se veía
  // pelado. La imagen la dibuja `app/og/route.tsx` y la heredan todas las rutas;
  // acá van los datos que la acompañan. `summary_large_image` es lo que
  // hace que se dibuje grande en vez de como miniatura al costado.
  openGraph: {
    type: 'website',
    siteName: TITULO,
    locale: 'es_AR',
    title: TITULO,
    description: DESCRIPCION,
    // La dibuja `app/og/route.tsx` (ahí está el porqué de que sea una ruta y no
    // un `opengraph-image.tsx`). Va relativa a propósito: así se resuelve contra
    // `metadataBase` y el preview apunta al dominio real en dev y en producción.
    images: [{ url: '/og', width: 1200, height: 630, alt: TITULO }],
  },
  twitter: { card: 'summary_large_image' },
}

// Pinta la barra del navegador (y la de estado en standalone) con el fondo de la
// app en vez del blanco del sistema. Mismo color que `app/manifest.ts`.
// Los defaults de Next (width=device-width, initial-scale=1) se mantienen.
export const viewport: Viewport = {
  themeColor: '#0D0D1F',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className={`${inter.variable} antialiased`}>
      {/* suppressHydrationWarning: extensiones del browser (ej. ColorZilla, que
          agrega `cz-shortcut-listen` al body) inyectan atributos antes de que
          React hidrate. Suprime SOLO el mismatch de atributos del <body>, no el
          de los componentes hijos. */}
      <body suppressHydrationWarning className="min-h-screen bg-background text-foreground font-sans">
        {/* Envuelve todo porque el aviso lo dispara `BotonGuardar`, que vive en
            las cards de cinco pantallas y en la ficha (PBETA-R3-04). */}
        <AvisoProvider>
          {/* No pinta nada: retoma el guardado que quedó pendiente del otro lado
              del login, aterrice donde aterrice el usuario (PBETA-R3-03) — y
              también el que vuelve por el link del mail (PBETA-R3-07), que por eso
              va adentro del provider. */}
          <ReanudarGuardado />
          {/* Tampoco pinta nada: anota por qué pantalla entró la pestaña, que es
              lo que decide si el "Volver" de la ficha hace back o sube a la home
              (NAVEGACION, decisión 6). */}
          <MarcadorNavegacion />
          {children}
        </AvisoProvider>
        {/* Web Analytics de Vercel (prendido desde el panel el 2026-08-14). Cuenta
            visitas y páginas vistas **sin cookies**: no hay banner que poner y no
            toca `place_impressions_daily`, que es nuestro agregado de producto y
            sigue siendo la fuente del histórico que vende el B2B. Solo corre en
            producción — en dev el componente no manda nada. */}
        <Analytics />
      </body>
    </html>
  )
}
