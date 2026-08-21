import Link from 'next/link'

/** Un link hermano. `detalle` es siempre un dato real (un conteo), nunca copy. */
export type EnlaceSeo = { href: string; label: string; detalle?: string }

/**
 * Los bloques de links hermanos de las páginas de `/salir` (SEO, decisión 13).
 *
 * No son decoración ni "navegación relacionada": son **lo que transmite
 * autoridad**. El sitemap es una sugerencia; los links internos son lo que hace
 * que el crawler entre por una landing y salga hacia las fichas mejor ordenadas.
 * Por eso son `<a>` de verdad renderizados en el server, no un sheet ni un
 * carrusel que necesite JavaScript para existir.
 */
export function EnlacesSeo({ titulo, enlaces }: { titulo: string; enlaces: EnlaceSeo[] }) {
  if (enlaces.length === 0) return null

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {titulo}
      </h2>
      <ul className="flex flex-wrap gap-1.5">
        {enlaces.map((e) => (
          <li key={e.href}>
            <Link
              href={e.href}
              className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:border-muted-foreground/50 hover:text-primary"
            >
              {e.label}
              {e.detalle && <span className="text-xs text-muted-foreground">{e.detalle}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
