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
    // ⚠️ Dos de estos íconos llevan el wordmark ESCRITO ADENTRO, y no es decorativo:
    // el splash de Android **no tiene campo de texto**. Chrome lo compone con
    // `background_color` + un ícono y nada más — el `name` de acá arriba NO se
    // pinta (verificado en el celular de Fer, 2026-08-03). Si se quiere leer
    // "¿A dónde salimos?" al abrir la app, tiene que estar en el PNG.
    //
    // **Cuál ícono agarra el splash**: el que *más se acerca a la resolución del
    // dispositivo* (doc de Chrome), NO el más grande — se probó con el de 1024 y
    // el celular lo ignoró. En un teléfono real gana el de **512**, y por eso el
    // wordmark vive ahí.
    //
    // El **maskable** y el de **192** quedan LIMPIOS a propósito: el maskable es
    // el ícono del launcher (lo que se ve siempre) y el de 192 va a superficies
    // chicas donde el texto no se leería.
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      // Para pantallas de densidad muy alta, que podrían pedir más de 512.
      { src: '/icons/icon-splash-1024.png', sizes: '1024x1024', type: 'image/png', purpose: 'any' },
    ],
  }
}
