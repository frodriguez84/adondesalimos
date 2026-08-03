import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { ReanudarGuardado } from '@/components/favoritos/reanudar-guardado'
import './globals.css'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: '¿A dónde salimos?',
  description: 'Decidí a dónde salir esta noche sin dar mil vueltas.',
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
        {/* No pinta nada: retoma el guardado que quedó pendiente del otro lado
            del login, aterrice donde aterrice el usuario (PBETA-R3-03). */}
        <ReanudarGuardado />
        {children}
      </body>
    </html>
  )
}
