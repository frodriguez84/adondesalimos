import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: '¿A dónde salimos?',
  description: 'Decidí a dónde salir esta noche sin dar mil vueltas.',
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
        {children}
      </body>
    </html>
  )
}
