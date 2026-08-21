import Link from 'next/link'

import { CONTACTO } from '@/lib/contacto'

/**
 * Chrome y primitivos compartidos de `/legales` y sus cuatro documentos (LEGALES, F0).
 *
 * ⚠️ **Nada de acá puede leer los headers, las cookies ni la sesión** (decisión 10).
 * No es una regla de estilo: estas piezas las usan páginas estáticas y el modo de
 * falla es mudo — el build las marcaría `ƒ` en vez de `○` sin tirar un solo error.
 *
 * Los cuatro documentos comparten forma a propósito: son el mismo tipo de página y
 * escribir el shell cinco veces es como empiezan a divergir la fecha, el ancho y el
 * link de vuelta.
 */

export function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold text-foreground">{titulo}</h2>
      <div className="flex flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  )
}

export function Externo({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-4"
    >
      {children}
    </a>
  )
}

/** El mail de contacto como link, que es como aparece en los cinco documentos. */
export function MailContacto({ className }: { className?: string }) {
  return (
    <a
      href={`mailto:${CONTACTO}`}
      className={className ?? 'text-primary underline underline-offset-4'}
    >
      {CONTACTO}
    </a>
  )
}

/**
 * Shell de un documento legal.
 *
 * `actualizado` es la fecha visible que pide la decisión 15: los documentos se
 * versionan con git y con esta línea, **sin tabla de "qué versión aceptó cada
 * usuario"** — sería un pasivo nuevo sin ningún uso hoy.
 */
export function Documento({
  titulo,
  volverA = '/legales',
  volverTexto = 'Volver a la letra chica',
  actualizado,
  bajada,
  children,
}: {
  titulo: string
  volverA?: string
  volverTexto?: string
  actualizado?: string
  bajada?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-8 px-4 py-8">
      <header className="flex flex-col gap-2">
        <Link href={volverA} className="text-sm text-muted-foreground underline underline-offset-4">
          ← {volverTexto}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{titulo}</h1>
        {bajada && <p className="text-sm text-muted-foreground">{bajada}</p>}
        {actualizado && (
          <p className="text-xs text-muted-foreground">Última actualización: {actualizado}</p>
        )}
      </header>
      {children}
    </main>
  )
}
