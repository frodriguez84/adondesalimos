/**
 * Fetch de la web pública del lugar para dar evidencia al LLM (CURADURIA,
 * decisión 10): **best-effort y educado**. Se intenta el sitio propio y las redes;
 * Instagram suele bloquear el scraping anónimo, así que si una URL no responde se
 * sigue con lo que haya (la sugerencia sale igual, con o sin evidencia).
 *
 * Sin autenticarse, sin evadir bloqueos: un User-Agent honesto que dice quién es,
 * timeout corto, y solo `http(s)`. Nada de Google acá — este módulo solo mira la
 * web del propio lugar (decisión "Qué NO es": prohibido `lib/google/*`).
 */

/** Un pedazo de evidencia: de qué URL salió y el texto plano que trajo. */
export type EvidenciaSitio = { url: string; texto: string }

/** Timeout por request: un sitio que no responde en 8 s no frena el batch. */
const TIMEOUT_MS = 8000
/** Tope de texto por página: alcanza para el prompt sin inflar tokens. */
const MAX_CHARS = 4000
/** Cuántas URLs se intentan por lugar como máximo (sitio + una red). */
const MAX_URLS = 2

const UA =
  'AdondeSalimosBot/1.0 (+https://adondesalimos.ngrok.app; curaduría de catálogo, contacto: hola@adondesalimos.app)'

/** Saca tags, scripts y estilos; colapsa espacios. HTML → texto plano acotado. */
export function htmlATexto(html: string): string {
  const sinScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
  const sinTags = sinScripts.replace(/<[^>]+>/g, ' ')
  const texto = sinTags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return texto.slice(0, MAX_CHARS)
}

/** Trae el texto de una URL, o null si falla / no es HTML / está bloqueada. */
export async function traerTextoDe(url: string): Promise<string | null> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(parsed.toString(), {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
    })
    if (!res.ok) return null
    const tipo = res.headers.get('content-type') ?? ''
    if (!tipo.includes('text/html') && !tipo.includes('text/plain')) return null
    const html = await res.text()
    const texto = htmlATexto(html)
    return texto.length > 0 ? texto : null
  } catch {
    // Timeout, DNS, bloqueo anti-bot, TLS: todo cae acá y no rompe el batch.
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Recolecta evidencia de un lugar: intenta el sitio propio y una red, en ese
 * orden, hasta `MAX_URLS` que respondan. Devuelve `[]` si nada respondió — el
 * lugar se curará "sin evidencia" (decisión 5).
 */
export async function recolectarEvidencia(candidatas: {
  websites: string[]
  socials: string[]
}): Promise<EvidenciaSitio[]> {
  // Sitio propio primero (mejor señal), después redes (suelen bloquear).
  const urls = [...candidatas.websites, ...candidatas.socials].filter(Boolean)
  const evidencia: EvidenciaSitio[] = []
  for (const url of urls) {
    if (evidencia.length >= MAX_URLS) break
    const texto = await traerTextoDe(url)
    if (texto) evidencia.push({ url, texto })
  }
  return evidencia
}
