import type { Metadata } from 'next'
import Link from 'next/link'

import { Wordmark } from '@/components/shared/wordmark'

/**
 * 404 de la app (PULIDO_BETA, PBETA-R2-01). Antes de esto cualquier ruta
 * inexistente caía en la pantalla default de Next: blanca, en inglés y sin un
 * solo link, rompiendo el tema oscuro y dejando al usuario sin salida.
 *
 * El caso que la motiva es R2: el link de una votación pegado en WhatsApp llega
 * cortado. Por eso el copy habla de un link que no anda, no de un "recurso no
 * encontrado", y la salida es la home — que es la búsqueda, o sea algo que hacer.
 */
export const metadata: Metadata = {
  title: 'Ese link no anda · ¿A dónde salimos?',
}

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-6 px-4 text-center">
      <Wordmark />
      <div>
        <h1 className="text-xl font-bold text-foreground">Ese link no anda</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Puede que se haya cortado al compartirlo, o que la página ya no exista.
        </p>
      </div>
      <Link
        href="/"
        className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Buscar lugares
      </Link>
    </main>
  )
}
