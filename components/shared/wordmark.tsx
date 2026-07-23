import { cn } from '@/lib/utils'

/**
 * Wordmark de marca para el header (IDENTIDAD.md): pin + "¿A dónde salimos?".
 *
 * Variante monocroma que pide IDENTIDAD para 28-32 px: a ese tamaño el gradiente
 * sobre texto fino colapsa a un naranja sucio, así que el texto va en color sólido
 * ("salimos?" en naranja, la acción primaria) y el único gradiente vive en el pin,
 * que al ser una forma llena lo sostiene a cualquier tamaño. El gradiente sobre
 * texto se reserva al hero grande (ver `RotatingHeadline`).
 *
 * Es un asset vectorial inline —no un raster— para quedar crisp en cualquier DPR.
 * El centro calado del pin se rellena con el fondo de la app; pensado para vivir
 * sobre `--background`.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <svg
        viewBox="0 0 24 32"
        className="h-7 w-auto shrink-0"
        role="img"
        aria-label="¿A dónde salimos?"
      >
        <defs>
          <linearGradient id="ads-pin" x1="12" y1="0" x2="12" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#FF2D75" />
            <stop offset="0.55" stopColor="#FF8A00" />
            <stop offset="1" stopColor="#FFD400" />
          </linearGradient>
        </defs>
        <path
          d="M12 0C5.373 0 0 5.373 0 12c0 8.5 12 20 12 20s12-11.5 12-20C24 5.373 18.627 0 12 0z"
          fill="url(#ads-pin)"
        />
        <circle cx="12" cy="12" r="4.4" fill="var(--background)" />
      </svg>
      <span className="text-lg font-extrabold uppercase leading-none tracking-tight">
        <span className="text-foreground">¿A dónde </span>
        <span className="text-primary">salimos?</span>
      </span>
    </span>
  )
}
