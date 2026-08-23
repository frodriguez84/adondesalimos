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
          <Link href="/legales/atribucion" className="underline underline-offset-4">
            Overture Maps y Google
          </Link>
        </span>
        <span aria-hidden>·</span>
        {/* Resolución 424/2020 (LEGALES, decisión 11): la baja y el arrepentimiento
            tienen que estar accesibles desde la página principal. ⚠️ Es un `<Link>`
            pelado a propósito (decisión 10): este mismo footer lo renderiza
            `app/salir/layout.tsx`, y leer sesión acá convertiría 301 landings
            estáticas en 301 funciones serverless **sin tirar un solo error**. */}
        <Link href="/legales/baja" className="underline underline-offset-4">
          Cancelar suscripción o cuenta
        </Link>
        <span aria-hidden>·</span>
        {/* GEO, F2 punto 8. Estas 301 páginas son las que un crawler recorre de
            verdad, así que este es el link interno que le da peso a
            `/como-funciona` — el del footer de la home es uno solo. */}
        <Link href="/como-funciona" className="underline underline-offset-4">
          Cómo funciona
        </Link>
      </footer>
    </main>
  )
}
