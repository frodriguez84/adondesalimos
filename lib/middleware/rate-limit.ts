import { getClientIp, UNKNOWN_IP } from './get-client-ip'

/**
 * Rate limit de `/api/search` (decisión 11 de BUSQUEDA, regla global de
 * seguridad).
 *
 * ⚠️ DIVERGENCIA DELIBERADA del patrón de StressPlan, que persiste cada intento
 * en la tabla `rate_limit_logs`. Ahí el patrón está bien: protege endpoints
 * caros y poco frecuentes (IA, pagos), donde dos queries extra por request no se
 * notan y el audit trail vale.
 *
 * `/api/search` es lo contrario: es de LECTURA y se llama en cada scroll de la
 * lista. Un INSERT + 1-2 SELECT por página de resultados agregaría más carga a
 * la base que la búsqueda misma, y el audit trail de "alguien scrolleó" no le
 * sirve a nadie. Por eso: ventana deslizante en memoria del proceso.
 *
 * Lo que se pierde con esto, explícito: el contador **no se comparte entre
 * instancias** ni sobrevive un reinicio. Para el abuso que esto acota —un bot
 * raspando el catálogo— alcanza. Si algún día hace falta un límite duro y
 * global, el reemplazo es Redis, no la tabla.
 */

/** Requests por IP por ventana. Generoso: una búsqueda con scroll son varias. */
const MAX_REQUESTS = 60
const WINDOW_MS = 60_000

/** Poda: si el mapa crece más que esto, se limpian las ventanas vencidas. */
const MAX_BUCKETS = 10_000

type Bucket = { count: number; resetAt: number }

// El límite es por proceso. El singleton en `global` evita que el HMR de Next
// en dev lo resetee en cada recompilación (mismo motivo que el pool de `lib/db`).
const globalForLimit = global as unknown as { rateBuckets: Map<string, Bucket> | undefined }
const buckets = globalForLimit.rateBuckets ?? new Map<string, Bucket>()
globalForLimit.rateBuckets = buckets

function podar(ahora: number) {
  for (const [clave, bucket] of buckets) {
    if (bucket.resetAt <= ahora) buckets.delete(clave)
  }
}

/** Decisión pura, sin `Request` ni reloj: es lo que se puede testear derecho. */
export function consumirCupo(
  clave: string,
  ahora: number,
  max = MAX_REQUESTS,
): { allowed: boolean; remaining: number; resetAt: number } {
  const bucket = buckets.get(clave)

  if (!bucket || bucket.resetAt <= ahora) {
    const nuevo = { count: 1, resetAt: ahora + WINDOW_MS }
    buckets.set(clave, nuevo)
    if (buckets.size > MAX_BUCKETS) podar(ahora)
    return { allowed: true, remaining: max - 1, resetAt: nuevo.resetAt }
  }

  if (bucket.count >= max) {
    return { allowed: false, remaining: 0, resetAt: bucket.resetAt }
  }

  bucket.count++
  return { allowed: true, remaining: max - bucket.count, resetAt: bucket.resetAt }
}

/** Solo para tests: la ventana en memoria persiste entre casos si no se limpia. */
export function resetRateLimit() {
  buckets.clear()
}

function deshabilitado(): boolean {
  return process.env.DISABLE_RATE_LIMIT === 'true'
}

/**
 * Núcleo compartido: devuelve una `Response` 429 si hay que bloquear, o `null` si
 * pasa. El `prefijo` separa los cupos por endpoint (una IP que scrollea la búsqueda
 * no consume el cupo de abrir fichas). Misma firma que los checks de StressPlan.
 */
function checkIpRateLimit(request: Request, prefijo: string): Response | null {
  if (deshabilitado()) return null

  const ip = getClientIp(request)
  // Con TRUSTED_IP_HEADER sin declarar, todas las requests comparten bucket
  // (fail-closed de getClientIp). En dev eso haría inusable la app.
  if (ip === UNKNOWN_IP && process.env.NODE_ENV !== 'production') return null

  const { allowed, remaining, resetAt } = consumirCupo(`${prefijo}:${ip}`, Date.now())
  if (allowed) return null

  return Response.json(
    {
      data: null,
      error: { message: 'Pará un poco. Probá de nuevo en un minuto.', code: 'IP_RATE_LIMIT' },
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)),
        'X-RateLimit-Remaining': String(remaining),
      },
    },
  )
}

/** Rate limit de `/api/search` (decisión 11 de BUSQUEDA). */
export function checkSearchRateLimit(request: Request): Response | null {
  return checkIpRateLimit(request, 'search')
}

/**
 * Rate limit de `/api/lugar/[id]/google` (FICHA, § Camino de la request, paso 1).
 * Endpoint distinto, cupo distinto: acota el abuso de disparar el enriquecimiento
 * pago en loop sin castigar al que solo busca.
 */
export function checkGoogleRateLimit(request: Request): Response | null {
  return checkIpRateLimit(request, 'ficha-google')
}
