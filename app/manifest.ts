import type { MetadataRoute } from 'next'

/**
 * Manifest de la app instalable (PULIDO_BETA F4, decisión 9).
 *
 * De acá sale gratis el splash de Android: el SO lo dibuja con `background_color`
 * y el ícono, solo para quien la instaló, sin costar un ms de render (por eso NO
 * hay splash propia — decisión 8).
 *
 * Los colores son los de `HOME_IDENTIDAD` (`app/globals.css` → `--background`).
 * Van a mano porque un manifest es JSON y no lee tokens de CSS; mismo criterio
 * que los hex de `lib/email/index.ts`. Si cambia la paleta, cambian los dos.
 *
 * iOS no lee estos íconos para la pantalla de inicio: eso lo cubre
 * `app/apple-icon.png` (decisión 10).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '¿A dónde salimos?',
    short_name: 'A dónde salimos',
    description: 'Decidí a dónde salir esta noche sin dar mil vueltas.',
    lang: 'es-AR',
    start_url: '/',
    display: 'standalone',
    background_color: '#0D0D1F',
    theme_color: '#0D0D1F',
    // ⚠️ NO agregar el nombre de la app dentro de estos PNG. Ya se intentó dos
    // veces el 2026-08-03 y no funciona:
    //
    // El splash de Android **no tiene campo de texto** — Chrome lo compone con
    // `background_color` + un ícono, y el `name` de acá arriba **no se pinta**
    // (verificado en un celular real). La única vía sería meter el wordmark en el
    // PNG, y se probó: primero en un ícono extra de 1024 —Chrome lo ignoró, elige
    // *el más cercano a la resolución del dispositivo*, no el más grande— y
    // después en el de 512 `any`, que **tampoco** es el que usa. Por descarte el
    // splash toma el **maskable**, que es exactamente el mismo archivo que Android
    // usa para el ícono del launcher: no hay forma de darle texto a uno sin
    // dárselo al otro.
    //
    // **Decisión de Fer (2026-08-03): el splash queda sin texto.** El ícono de la
    // pantalla de inicio se ve todos los días; el splash dura menos de un segundo,
    // y a tamaño de launcher el wordmark no se lee. Ver `LECCIONES_APRENDIDAS.md`.
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
