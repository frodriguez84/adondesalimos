import Link from 'next/link'

import { BrandHeader } from '@/components/shared/brand-header'

/**
 * Chrome compartido de las páginas SEO (SEO, F2). Existe para que la marca, el
 * ancho y el pie estén escritos **una vez** para las 301 páginas y no dos veces
 * —una en el hub de zona y otra en el combo—, que es como empiezan a divergir.
 *
 * El pie repite el aviso de beta y la atribución de fuentes de la home: linkear
 * Overture y Google **es condición de la licencia**, no decoración, y estas
 * páginas listan justamente sus datos. Además son links internos más, que es lo
 * que la decisión 13 anda buscando.
 */
export default function SalirLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-4 py-8">
      <BrandHeader />
      {children}
      <footer className="mt-auto flex flex-wrap items-center gap-x-2 pt-4 text-xs text-muted-foreground">
        <Link href="/legales" className="font-medium underline underline-offset-4">
          Estamos en beta
        </Link>
        <span aria-hidden>·</span>
        <span>
          Datos de{' '}
          <Link href="/legales" className="underline underline-offset-4">
            Overture Maps y Google
          </Link>
        </span>
      </footer>
    </main>
  )
}
