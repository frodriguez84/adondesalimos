/**
 * Reglas de presentación de la ficha (FICHA, § Diseño de la pantalla). Puras y
 * sin React: son casos de borde reales —un lugar sin tag de precio, sin foto de
 * dueño, con una red social de dominio raro— que se testean sin montar la página.
 */

/** Lo mínimo de un tag que la ficha necesita. Mismo shape que la búsqueda. */
export type FichaTag = { slug: string; name: string; facet: string }

/** Las facetas del bloque "Qué vas a encontrar": el diferencial frente a Google. */
const FACETAS_ENCONTRAS = ['actividad', 'ambiente', 'momento'] as const

/**
 * El rango de precios propio ($..$$$$), del tag de la faceta Precio (decisión
 * 21). Devuelve `null` si el lugar no tiene el tag: en ese caso la ficha cae al
 * `priceLevel` de Google en vivo (F2), no muestra un placeholder.
 *
 * Un lugar debería tener a lo sumo un tag de precio; si tuviera más, se toma el
 * primero (vienen ordenados por `sort` desde la query).
 */
export function precioDeTags(tags: FichaTag[]): string | null {
  const precio = tags.find((t) => t.facet === 'precio')
  return precio ? precio.name : null
}

/**
 * Los tags que responden "qué onda tiene el lugar" (Actividad/Ambiente/Momento).
 * Si el lugar no tiene ninguno —el import de Overture casi no los llenó— la
 * sección no se renderiza: un bloque vacío es peor que su ausencia.
 */
export function queEncontras(tags: FichaTag[]): string[] {
  return tags
    .filter((t) => (FACETAS_ENCONTRAS as readonly string[]).includes(t.facet))
    .map((t) => t.name)
}

/**
 * Deep link a Google Maps para "cómo llegar" (decisión 22). Usa el lat/lng propio
 * del catálogo ⇒ costo cero y funciona aunque el enriquecimiento esté caído. Si
 * ya se resolvió el `google_place_id`, se agrega para que Maps abra la ficha
 * exacta del lugar y no un pin suelto en la coordenada.
 */
export function comoLlegarUrl(place: {
  lat: number
  lng: number
  googlePlaceId: string | null
}): string {
  const params = new URLSearchParams({
    api: '1',
    destination: `${place.lat},${place.lng}`,
  })
  if (place.googlePlaceId) {
    params.set('destination_place_id', place.googlePlaceId)
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

/** De dónde salió la foto que se muestra: cambia la atribución al pie. */
export type FotoPrincipal = { url: string; fuente: 'owner' | 'google' }

/**
 * La foto que se muestra, con su prioridad (decisión 3): **dueño → Google →
 * placeholder**. Las de dueño son propias y gratis; la de Google se paga por
 * request y no se puede persistir, así que solo se pide si no hay ninguna de
 * dueño. `null` ⇒ el componente dibuja el placeholder de marca, nunca un hueco.
 *
 * En F1 `googlePhotoUrl` siempre llega vacío (el enriquecimiento es F2); el
 * helper ya contempla el caso para que la prioridad quede testeada de una.
 */
export function fotoPrincipal(input: {
  ownerPhotos: string[]
  googlePhotoUrl?: string | null
}): FotoPrincipal | null {
  if (input.ownerPhotos.length > 0) {
    return { url: input.ownerPhotos[0], fuente: 'owner' }
  }
  if (input.googlePhotoUrl) {
    return { url: input.googlePhotoUrl, fuente: 'google' }
  }
  return null
}

/** Plataformas que la ficha sabe rotular con ícono; el resto cae a `otro`. */
export type RedPlataforma = 'instagram' | 'facebook' | 'twitter' | 'tiktok' | 'otro'

/**
 * Clasifica una URL de red social de Overture por su dominio, para elegir el
 * ícono. No valida ni normaliza la URL —se usa tal cual como `href`—: solo mira
 * el host. Una URL basura cae a `otro` y se muestra como link genérico, nunca
 * rompe la ficha.
 */
export function clasificarRed(url: string): RedPlataforma {
  let host: string
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return 'otro'
  }
  if (host.includes('instagram.')) return 'instagram'
  if (host.includes('facebook.') || host.includes('fb.com')) return 'facebook'
  if (host.includes('twitter.') || host === 'x.com' || host.endsWith('.x.com')) return 'twitter'
  if (host.includes('tiktok.')) return 'tiktok'
  return 'otro'
}
