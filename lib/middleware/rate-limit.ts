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

/** Ventana del rate limit de auth (decisión 23 de AUTH): 20 POST/hora por IP. */
const AUTH_MAX = 20
const AUTH_WINDOW_MS = 60 * 60_000

/**
 * Reclamos y altas (decisión 23 de AUTH): 3 por día por IP. Es duro a propósito
 * — cada fila que entra acá la mira un humano en `/admin`, así que el costo del
 * abuso es tiempo de moderación, no CPU.
 */
const CLAIMS_MAX = 3
const CLAIMS_WINDOW_MS = 24 * 60 * 60_000

/**
 * Upload de fotos del panel (decisión 23): 30 por hora por IP. Generoso para un
 * dueño cargando su ficha —el cap real de cuántas quedan es por plan y lo aplica
 * `agregarFoto`— pero acota subir 5 MB en loop contra el bucket.
 */
const FOTOS_MAX = 30
const FOTOS_WINDOW_MS = 60 * 60_000

/**
 * Voto de una votación (VOTACION, decisión 9): 20 por minuto por IP. **Generoso a
 * propósito**: un grupo entero de WhatsApp vota casi a la vez desde la misma WiFi
 * (o detrás de CGNAT móvil), así que la IP NO es la identidad —eso es la cookie
 * `voter_id`—; este cupo solo corta el bot que borra cookies en loop.
 */
const VOTO_MAX = 20
const VOTO_WINDOW_MS = 60_000

/**
 * Sumar / quitar una opción de una votación (SUGERIR_EN_VOTACION, decisión 13):
 * 20 por minuto por IP. **Generoso, igual que el voto y por la misma razón**: todo
 * el grupo cae desde la misma WiFi (o el mismo CGNAT móvil) y la IP no es la
 * identidad —esa es la cookie `voter_id`—. Los gates que importan son el techo
 * total y el tope de 2 por dispositivo, que viven en el dominio.
 */
const SUGERENCIA_MAX = 20
const SUGERENCIA_WINDOW_MS = 60_000

/**
 * Beacon de taps de la ficha (MONETIZACION, decisión 29): 60 por hora por IP.
 * Generoso —una ficha muy activa dispara varios taps— pero corta el inflado
 * burdo de las stats. El dato es para el dueño, no facturable por tap, así que el
 * inflado fino no se persigue (edge case del spec).
 */
const TAP_MAX = 60
const TAP_WINDOW_MS = 60 * 60_000

/**
 * Checkout de suscripción `POST /api/billing/checkout` (MONETIZACION, decisión 29):
 * 5 por hora por IP. Duro a propósito — un humano no contrata 5 veces en una hora,
 * y el brute-force de tokens de tarjeta contra el endpoint de cobro se corta acá.
 */
const CHECKOUT_MAX = 5
const CHECKOUT_WINDOW_MS = 60 * 60_000

/**
 * Mensaje del chat IA `POST /api/chat` (CHAT_IA, decisión 22): 10 por minuto por
 * IP. Es **anti-ráfaga**: el gate económico real es el cupo por usuario + el tope
 * global (ambos en DB, auditan lo caro). La divergencia con el patrón-DB de
 * StressPlan ya está documentada arriba y acá aplica igual.
 */
const CHAT_MAX = 10
const CHAT_WINDOW_MS = 60_000

/**
 * Guardar / sacar favoritos `POST|DELETE /api/favoritos` (FAVORITOS, decisión 13):
 * 60 por minuto por IP. **Generoso a propósito**: guardar es una acción legítima y
 * repetida —el usuario barre una página de resultados guardando cinco lugares— y
 * el gate real es la sesión más el tope de ítems por lista. Esto solo corta el
 * loop automatizado contra un endpoint autenticado que escribe.
 */
const FAVORITOS_MAX = 60
const FAVORITOS_WINDOW_MS = 60_000

/**
 * "Avisame cuando abra" `POST /api/billing/interes` (DEPLOY, decisión 6): 10 por
 * hora por IP. El dedupe real lo hacen los índices únicos parciales —repetir el
 * click no suma filas—, así que esto solo corta el loop automatizado contra un
 * endpoint que escribe. Bucket propio: dejar la señal no gasta el del checkout.
 */
const INTERES_MAX = 10
const INTERES_WINDOW_MS = 60 * 60_000

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
  windowMs = WINDOW_MS,
): { allowed: boolean; remaining: number; resetAt: number } {
  const bucket = buckets.get(clave)

  if (!bucket || bucket.resetAt <= ahora) {
    const nuevo = { count: 1, resetAt: ahora + windowMs }
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

/**
 * `DISABLE_RATE_LIMIT` es **de dev y solo de dev** (DEPLOY, decisión 14).
 *
 * Hasta la auditoría del 2026-08-18 (SEC-12) esto no miraba el entorno: la
 * variable apagaba **todos** los cupos en cualquier lado, y el `.env.example`
 * —el archivo que uno copia para armar un entorno— la traía en `true`. Que
 * "jamás va a prod" estaba escrito en un doc, que no es un lugar donde se
 * ejecute nada; un `vercel env pull`/`push` distraído alcanzaba para prenderla.
 * Ahora producción se niega a obedecerla, esté seteada o no.
 */
function deshabilitado(): boolean {
  if (process.env.NODE_ENV === 'production') return false
  return process.env.DISABLE_RATE_LIMIT === 'true'
}

/**
 * Consume el cupo de una IP y devuelve la decisión cruda, o `null` cuando el cupo
 * **no aplica** (apagado en dev, o IP desconocida fuera de producción).
 *
 * Existe separado de `checkIpRateLimit` porque hay dos consumidores con formas de
 * respuesta distintas: los route handlers de `app/api/**` contestan JSON, y el
 * `proxy.ts` —que corta las **páginas** antes de renderizarlas— tiene que contestar
 * algo que un browser pueda mostrar. Lo que no se duplica es esto: quién es la IP,
 * cuándo el cupo está exento y cómo se consume la ventana.
 */
export function evaluarCupoIp(
  request: Request,
  prefijo: string,
  max = MAX_REQUESTS,
  windowMs = WINDOW_MS,
): { allowed: boolean; remaining: number; resetAt: number } | null {
  if (deshabilitado()) return null

  const ip = getClientIp(request)
  // Con TRUSTED_IP_HEADER sin declarar, todas las requests comparten bucket
  // (fail-closed de getClientIp). En dev eso haría inusable la app.
  if (ip === UNKNOWN_IP && process.env.NODE_ENV !== 'production') return null

  return consumirCupo(`${prefijo}:${ip}`, Date.now(), max, windowMs)
}

/**
 * Núcleo compartido: devuelve una `Response` 429 si hay que bloquear, o `null` si
 * pasa. El `prefijo` separa los cupos por endpoint (una IP que scrollea la búsqueda
 * no consume el cupo de abrir fichas). Misma firma que los checks de StressPlan.
 */
function checkIpRateLimit(
  request: Request,
  prefijo: string,
  max = MAX_REQUESTS,
  windowMs = WINDOW_MS,
  mensaje = 'Pará un poco. Probá de nuevo en un minuto.',
): Response | null {
  const cupo = evaluarCupoIp(request, prefijo, max, windowMs)
  if (!cupo || cupo.allowed) return null

  const { remaining, resetAt } = cupo

  return Response.json(
    {
      data: null,
      error: { message: mensaje, code: 'IP_RATE_LIMIT' },
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
 *
 * ⚠️ **Hasta la auditoría de seguridad del 2026-08-18 esto era mentira a medias**
 * (SEC-02): no se pasaba `max`, así que "cupo distinto" era solo un *bucket*
 * distinto y el límite seguía siendo el default de 60/min de la búsqueda — en el
 * **único** endpoint anónimo de la app que cuesta plata por request (Place Details
 * + foto ≈ US$0,027). A 60/min el cap mensual de Google se agotaba en ~83 minutos
 * y dejaba **todas** las fichas sin horarios, rating ni foto hasta el 1º del mes:
 * un ataque de US$0 para el atacante. Con 10/min pasa a ~8 horas.
 *
 * **Bajar los caps de `app_settings` NO es la mitigación**: agranda la superficie
 * de DoS en vez de achicarla. El freno va acá.
 */
const GOOGLE_MAX = 10
const GOOGLE_WINDOW_MS = 60_000

export function checkGoogleRateLimit(request: Request): Response | null {
  return checkIpRateLimit(request, 'ficha-google', GOOGLE_MAX, GOOGLE_WINDOW_MS)
}

/**
 * Rate limit del catch-all de auth (AUTH, decisión 23): 20 POST/hora por IP.
 * Acota fuerza bruta de login y spam de registro/reset sin tocar a los usuarios
 * legítimos (un flujo de alta son pocos POSTs). Cupo propio: no comparte bucket
 * con búsqueda ni con el enriquecimiento de la ficha.
 */
export function checkAuthRateLimit(request: Request): Response | null {
  return checkIpRateLimit(request, 'auth', AUTH_MAX, AUTH_WINDOW_MS)
}

/**
 * Rate limit de `POST /api/claims` (AUTH, decisión 23): 3 reclamos/altas por día
 * por IP. Cupo propio y mensaje propio: "probá en un minuto" sería mentira con
 * una ventana de 24 horas.
 */
export function checkClaimsRateLimit(request: Request): Response | null {
  return checkIpRateLimit(
    request,
    'claims',
    CLAIMS_MAX,
    CLAIMS_WINDOW_MS,
    'Llegaste al límite de solicitudes por hoy. Probá mañana o escribinos.',
  )
}

/**
 * Rate limit de `POST /api/mi-negocio/[placeId]/photos` (AUTH, decisión 23):
 * 30 uploads por hora por IP. Cupo propio: el dueño que carga fotos no gasta el
 * de búsqueda ni el de reclamos.
 */
export function checkFotosRateLimit(request: Request): Response | null {
  return checkIpRateLimit(
    request,
    'fotos',
    FOTOS_MAX,
    FOTOS_WINDOW_MS,
    'Muchas fotos seguidas. Probá de nuevo en un rato.',
  )
}

/**
 * Rate limit de `POST /api/votaciones` (VOTACION, decisión 9): reusa **exactamente
 * el cupo de claims** —3 por día por IP— porque crear una votación es igual de
 * barato e igual de spameable. Cupo con **prefijo propio** (`votaciones`): no
 * comparte bucket con los reclamos, así crear una votación no gasta el cupo de
 * dar de alta un negocio ni al revés.
 */
export function checkVotacionesRateLimit(request: Request): Response | null {
  return checkIpRateLimit(
    request,
    'votaciones',
    CLAIMS_MAX,
    CLAIMS_WINDOW_MS,
    'Llegaste al límite de votaciones por hoy. Probá mañana.',
  )
}

/**
 * Rate limit de `GET /api/votaciones/[token]` (`SEC-22`): era el **único** endpoint
 * público que consulta la base sin pasar por ningún cupo, con 5 queries por hit y
 * pensado para que el cliente lo poletee.
 *
 * El número sale del polling real, no de la intuición: `POLL_MS = 4000` en
 * `app/votacion/[token]/votacion-client.tsx` son 15 requests por minuto **por
 * pestaña abierta**, así que 120/min es un grupo entero mirando los resultados
 * detrás del wifi de la misma casa. Apretarlo más rompe el caso legítimo; es un
 * techo, no una defensa fina — la fina es Upstash (`DEPLOY` F2).
 */
const RESULTADOS_MAX = 120
const RESULTADOS_WINDOW_MS = 60_000

export function checkResultadosRateLimit(request: Request): Response | null {
  return checkIpRateLimit(request, 'votacion-resultados', RESULTADOS_MAX, RESULTADOS_WINDOW_MS)
}

/**
 * Rate limit de `POST /api/votaciones/[token]/voto` (VOTACION, decisión 9): 20 por
 * minuto por IP. Cupo propio y generoso — la IP no es la identidad del votante
 * (esa es la cookie), así que un grupo entero votando casi a la vez desde la misma
 * IP tiene que pasar; solo corta el bot que borra cookies en loop.
 */
export function checkVotoRateLimit(request: Request): Response | null {
  return checkIpRateLimit(
    request,
    'voto',
    VOTO_MAX,
    VOTO_WINDOW_MS,
    'Pará un poco con los votos. Probá de nuevo en un minuto.',
  )
}

/**
 * Rate limit de `POST|DELETE /api/votaciones/[token]/opciones`
 * (SUGERIR_EN_VOTACION, decisión 13): 20 por minuto por IP. **Bucket propio**: no
 * comparte cupo con el voto —sumar un lugar y votarlo son el mismo gesto seguido,
 * y compartir bucket haría que uno se coma al otro— ni con la búsqueda, que es
 * justo la que se está usando desde el sheet para encontrar el lugar.
 */
export function checkSugerenciaRateLimit(request: Request): Response | null {
  return checkIpRateLimit(
    request,
    'sugerencia',
    SUGERENCIA_MAX,
    SUGERENCIA_WINDOW_MS,
    'Pará un poco. Probá de nuevo en un minuto.',
  )
}

/**
 * Rate limit del beacon de taps `POST /api/lugar/[id]/tap` (MONETIZACION,
 * decisión 29): 60 por hora por IP. Cupo propio: tocar acciones de una ficha no
 * gasta el de búsqueda ni el de abrir el bloque de Google.
 */
export function checkTapRateLimit(request: Request): Response | null {
  return checkIpRateLimit(request, 'tap', TAP_MAX, TAP_WINDOW_MS)
}

/**
 * Rate limit del checkout de suscripción `POST /api/billing/checkout`
 * (MONETIZACION, decisión 29): 5 por hora por IP. Cupo propio: contratar no gasta
 * el de búsqueda ni el de taps, y su límite bajo corta el brute-force de tokens.
 */
export function checkCheckoutRateLimit(request: Request): Response | null {
  return checkIpRateLimit(
    request,
    'checkout',
    CHECKOUT_MAX,
    CHECKOUT_WINDOW_MS,
    'Demasiados intentos de pago. Probá de nuevo en un rato.',
  )
}

/**
 * Rate limit de `POST /api/billing/interes` (DEPLOY, decisión 6): 10 por hora por
 * IP. Cupo con prefijo propio: dejar la señal del premium no gasta el del checkout
 * —que es duro a propósito— ni el de búsqueda.
 */
export function checkInteresRateLimit(request: Request): Response | null {
  return checkIpRateLimit(
    request,
    'interes',
    INTERES_MAX,
    INTERES_WINDOW_MS,
    'Pará un poco. Probá de nuevo en un rato.',
  )
}

/**
 * Rate limit del chat IA `POST /api/chat` (CHAT_IA, decisión 22): 10 mensajes/min
 * por IP. Cupo con prefijo propio: mandar mensajes al chat no gasta el de búsqueda,
 * votos ni taps. El gate económico de verdad es el cupo por usuario + el tope global.
 */
export function checkChatRateLimit(request: Request): Response | null {
  return checkIpRateLimit(
    request,
    'chat',
    CHAT_MAX,
    CHAT_WINDOW_MS,
    'Pará un poco con los mensajes. Probá de nuevo en un minuto.',
  )
}

/**
 * Rate limit de favoritos `POST|DELETE /api/favoritos` (FAVORITOS, decisión 13):
 * 60/min por IP. Cupo con prefijo propio: guardar lugares no gasta el de búsqueda
 * — que es justo el que el usuario está usando mientras guarda.
 */
export function checkFavoritosRateLimit(request: Request): Response | null {
  return checkIpRateLimit(
    request,
    'favoritos',
    FAVORITOS_MAX,
    FAVORITOS_WINDOW_MS,
    'Pará un poco. Probá de nuevo en un minuto.',
  )
}

/**
 * Cupo de las **páginas** (`SEC-01`, auditoría del 2026-08-18). Lo aplica
 * `proxy.ts`, que corre antes de renderizar.
 *
 * **El hallazgo no era "falta un cupo": era que el perfil de protección estaba
 * dado vuelta.** `/api/search` cuesta 12 sentencias y tenía 60/min; la home cuesta
 * 59-74 y no tenía ninguno. Un atacante que quiere cargar la base no usa la API:
 * usa la home, que es más barata de pedir y ~20× más cara de servir.
 *
 * **Son dos cupos porque son dos costos.** El general cubre toda página que pase
 * por el matcher; el de la home se suma **solo en `/`**, que es la ruta cara. Una
 * request a `/` consume los dos.
 */
const PAGINAS_MAX = 120
const PAGINAS_WINDOW_MS = 60_000

/**
 * 60/min en `/`, el mismo número que `/api/search` — que es su hermana: cada toque de
 * filtro dispara las dos.
 *
 * ⚠️ **La home no es solo "la portada": es la pantalla de búsqueda entera.** Los chips
 * y las zonas navegan con `router.push`/`replace` a `/?z=…&t=…`, así que **cada toque
 * de filtro es una request más a esta ruta**. Por eso el número no se calcula sobre
 * "cuántas veces alguien recarga la home" —que sería un puñado— sino sobre cuánto
 * filtra alguien entusiasmado. Un 429 acá es la pantalla principal de la app diciéndole
 * que pare: el error caro es quedarse corto, no largo.
 *
 * Con 426 ms de Postgres por hit, 60/min acota el peor caso a ~25 s de CPU de base por
 * minuto y por IP. No es poco; comparado con el `while true; do curl` del informe, que
 * no tenía techo ninguno, es la diferencia que importa.
 */
const HOME_MAX = 60
const HOME_WINDOW_MS = 60_000

/**
 * Cupo de una request de página. Devuelve la decisión que **bloquea**, o `null` si
 * pasa (o si el cupo no aplica: dev, o IP desconocida fuera de producción).
 *
 * ⚠️ **Cuenta también los prefetch del router.** Next prefetchea los `<Link>` que
 * entran en viewport, y esas requests llegan acá como cualquier otra. Excluirlas
 * con el `missing: next-router-prefetch` que sugiere la doc sería regalar el bypass:
 * el atacante manda el header y listo. Por eso el cupo general es generoso (120) en
 * vez de exacto — la ráfaga legítima de una lista con muchas cards tiene que entrar.
 */
export function evaluarCupoDePagina(
  request: Request,
  pathname: string,
): { allowed: boolean; remaining: number; resetAt: number } | null {
  const general = evaluarCupoIp(request, 'pagina', PAGINAS_MAX, PAGINAS_WINDOW_MS)
  const home =
    pathname === '/' ? evaluarCupoIp(request, 'home', HOME_MAX, HOME_WINDOW_MS) : null

  if (home && !home.allowed) return home
  if (general && !general.allowed) return general
  return null
}
