import { APP_URL } from '@/lib/app-url'

/**
 * Cómo se arma la URL de un lugar — **dueño único** (SEO, decisión 9).
 *
 * Parece una indirección gratis y no lo es: existe **para que el día que la ficha
 * gane slug SEO se toque un archivo y no ocho**. Hoy `/lugar/${id}` estaba escrito
 * a mano en `place-card`, cuatro pantallas de `/admin`, `mi-negocio`, `reclamar` y
 * `lib/email` — o sea que el slug costaba ocho ediciones y una de ellas se iba a
 * olvidar. El slug se difirió (es puerta de ida: hay links vivos compartidos),
 * pero su prerrequisito se paga acá. **No inlinear.**
 */

/** Path relativo de la ficha. Función pura: la importan componentes de cliente. */
export function urlDeLugar(id: string): string {
  return `/lugar/${id}`
}

/**
 * La misma URL, absoluta. La necesitan el sitemap, el JSON-LD y los mails, que
 * salen del server y no tienen `window.location` de dónde colgar.
 *
 * ⚠️ **Solo desde el server.** `BETTER_AUTH_URL` no es `NEXT_PUBLIC_`, así que en
 * el bundle del browser `APP_URL` queda congelado en `http://localhost:5178` — y no
 * rompe nada ni tira un error: genera links a localhost **en producción, en
 * silencio**. Hoy no muerde porque los componentes de cliente
 * (`place-card`, las tres pantallas de `/admin`) importan solo `urlDeLugar`, que es
 * relativa. Si alguna vez hace falta la absoluta en el cliente, la variable tiene
 * que pasar como prop desde el server, no importarse desde acá.
 */
export function urlAbsolutaDeLugar(id: string): string {
  return `${APP_URL}${urlDeLugar(id)}`
}
