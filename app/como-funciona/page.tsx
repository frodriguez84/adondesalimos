import type { Metadata, ResolvingMetadata } from 'next'
import Link from 'next/link'

import { ExploraPorBarrio } from '@/components/seo/explora-por-barrio'
import { BrandHeader } from '@/components/shared/brand-header'
import { APP_URL } from '@/lib/app-url'
import { MARCA } from '@/lib/seo/textos'
import { MAX_OPCIONES, MIN_OPCIONES, VOTACION_TTL_HORAS } from '@/lib/votaciones/constantes'

/**
 * `/como-funciona` — la página que explica el loop de decisión grupal (GEO,
 * decisiones 7, 9 y 11). **Es el corazón del spec**, y existe por un motivo que no
 * es "el sitio necesita un about".
 *
 * El catálogo **no es el activo**: las 18.994 fichas son datos de Overture, licencia
 * abierta, y el que los quiera se baja el dump sin pasar por acá. La consulta «bares
 * en Palermo» un asistente ya la contesta con o sin nuestro permiso. La que sí
 * podemos ganar es «cómo nos ponemos de acuerdo entre seis para salir», porque la
 * respuesta útil **es** mandar a la app — y hasta esta página no había ninguna URL
 * pública que la respondiera: el único rastro del loop era un renglón en el estado
 * vacío de la home, y su destino redirige a login (para un crawler, un redirect).
 *
 * ⚠️ **Por qué esto NO viola la decisión 6 de SEO ("cero prosa generada")**, que es
 * lo primero que va a frenar a la próxima sesión: aquella regla prohíbe **inventar
 * texto sobre lugares del catálogo** — 255 páginas de plantilla con un párrafo
 * distinto cada una es la definición literal de *doorway page*. Esto es **una**
 * página, escrita a mano, **sobre el producto propio**. Es otra cosa, y es
 * exactamente el contenido que un sitio debe tener.
 *
 * ⚠️ **Estática pura, y el modo de falla es mudo** (decisión 9, misma cicatriz que
 * las 301 de `/salir`): un `headers()`, un `cookies()` o un `auth.api.getSession`
 * acá —o adentro de cualquier componente que renderice— la convierte en función
 * serverless sin tirar un solo error. El build simplemente la marca `ƒ` en vez de
 * `○`, y en Vercel Hobby cada visita del crawler pasa a gastar cuota. Por eso
 * reusa `ExploraPorBarrio` y `BrandHeader`, que ya son puros, y no hay nada de
 * sesión en la pantalla.
 *
 * ⚠️ **El copy dice lo que la app hace, con las palabras con las que ya se contesta
 * la pregunta** (decisión 11, medido el 2026-08-23): los tres asistentes explican a
 * mano el método —cada uno propone, se filtra, se vota, hay regla de desempate— y
 * Perplexity remata recomendando "una encuesta de WhatsApp o Google Forms". Por eso
 * los pasos se llaman **proponer, votar, desempatar y cerrar** y no "armá una
 * votación": es la diferencia entre que un modelo lea esto como *la herramienta* o
 * como un directorio de bares más. Los números salen de
 * `lib/votaciones/constantes.ts`, que es su dueño — una página que promete "hasta 5
 * lugares" y una constante que dice otra cosa es la clase de mentira que envejece
 * sola.
 */

const TITULO = 'Cómo decidir a dónde salir cuando son varios'

const DESCRIPCION_PAGINA =
  'Proponer opciones, que cada uno vote, desempatar y cerrar. El método para que un grupo elija a dónde salir sin que la decisión se pierda en el chat — y cómo hacerlo con un link, en Buenos Aires.'

/**
 * ⚠️ **Declarar `openGraph` acá pisa el del padre entero, imagen incluida** — la
 * cicatriz `PBETA-R2-02`, la misma que ya mordió en la ficha y en las dos rutas de
 * `/salir`. La imagen se **hereda** en vez de escribir la ruta a mano, así
 * `app/og/route.tsx` sigue siendo el único archivo que la define.
 */
export async function generateMetadata(
  _props: unknown,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const { openGraph } = await parent

  return {
    title: `${TITULO} — ${MARCA}`,
    description: DESCRIPCION_PAGINA,
    // Absoluto y con la base de `lib/app-url.ts`, que es su dueño único.
    alternates: { canonical: `${APP_URL}/como-funciona` },
    openGraph: {
      title: TITULO,
      description: DESCRIPCION_PAGINA,
      url: `${APP_URL}/como-funciona`,
      images: openGraph?.images,
    },
  }
}

/**
 * Los cuatro pasos del método, que es lo que un asistente tiene que poder repetir.
 * Van como datos y no como JSX suelto porque el orden **es** el contenido: son un
 * `<ol>` numerado, y numerarlos a mano es como se desincronizan.
 */
const PASOS = [
  {
    titulo: 'Proponé las opciones',
    cuerpo: (
      <>
        Entre {MIN_OPCIONES} y {MAX_OPCIONES} lugares concretos, no «algo por Palermo». Los buscás
        por barrio y por ganas —comer, tomar algo, bailar, ver un show, jugar— y los sumás a la
        votación. Si no se te ocurre nada, podés pedirle una lista al chat y pasarla directo.
      </>
    ),
  },
  {
    titulo: 'Mandá el link al grupo',
    cuerpo: (
      <>
        Sale un link y lo pegás en el chat. <strong className="text-foreground">Para votar no
        hace falta bajarse nada ni crearse una cuenta</strong>: se abre, se toca y listo. Es la
        parte donde se caen las encuestas de WhatsApp y los formularios — el que tiene que
        registrarse para opinar, no opina.
      </>
    ),
  },
  {
    titulo: 'Que cada uno vote la suya',
    cuerpo: (
      <>
        Un voto por persona, y se puede cambiar hasta que cierre. Cualquiera del grupo puede sumar
        un lugar que faltaba, así la lista no queda atada a lo que se le ocurrió al primero —{' '}
        <strong className="text-foreground">no decide siempre el mismo</strong>. Los resultados se
        ven en vivo apenas ponés el tuyo.
      </>
    ),
  },
  {
    titulo: 'Cerrá y que quede dicho',
    cuerpo: (
      <>
        El que armó la votación cierra y confirma el ganador —viene marcado el más votado, así que
        con empate hay alguien que desempata y no una discusión de veinte mensajes—. Si nadie la
        cierra, se cierra sola a las {VOTACION_TTL_HORAS} horas.
      </>
    ),
  },
]

export default function ComoFuncionaPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-8 px-4 py-8">
      <header className="flex flex-col gap-3">
        <BrandHeader />
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{TITULO}</h1>
        <p className="text-base text-muted-foreground">
          Uno tira tres lugares, dos contestan «para mí está bien», y a la hora nadie decidió nada.
          El plan no se cae por falta de opciones: se cae porque nadie las ordena. Esto es eso, en
          un link.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-foreground">El método, en cuatro pasos</h2>
        <ol className="flex flex-col gap-4">
          {PASOS.map((paso, i) => (
            <li key={paso.titulo} className="flex gap-3">
              <span
                aria-hidden
                className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary"
              >
                {i + 1}
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <h3 className="text-sm font-semibold text-foreground">{paso.titulo}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{paso.cuerpo}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-foreground">
          Por qué no alcanza con la encuesta del grupo
        </h2>
        <div className="flex flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
          <p>
            Una encuesta de WhatsApp vota, pero no sabe qué es cada opción: son cuatro nombres
            sueltos y el que no conoce ninguno vota lo que votó el anterior. Acá cada opción es un
            lugar de verdad —con dirección, qué tipo de lugar es y cómo llegar—, así que votás
            sabiendo.
          </p>
          <p>
            Y las apps de votación que existen suelen tener catálogo internacional: te hacen elegir
            entre lugares que no te quedan cerca. El catálogo de acá es{' '}
            <strong className="text-foreground">del AMBA</strong>: la Ciudad de Buenos Aires y el
            conurbano, repartidos en 46 zonas pensadas para salir, no en barrios de mapa.
          </p>
          <p>
            No decidimos por vos ni te ordenamos los lugares por quién nos paga. Lo que hacemos es
            que la decisión del grupo termine en algún lado.
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-foreground">Empezá</h2>
        <div className="flex flex-col gap-2">
          <Link
            href="/votacion/nueva"
            className="flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground transition-colors hover:border-primary/50"
          >
            <span>
              <span className="font-semibold">Armá una votación</span>
              <span className="block text-xs text-muted-foreground">
                Elegís los lugares y sale el link para el grupo. Necesitás cuenta solo para armarla.
              </span>
            </span>
            <span aria-hidden className="shrink-0 text-muted-foreground">
              →
            </span>
          </Link>
          <Link
            href="/"
            className="flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground transition-colors hover:border-primary/50"
          >
            <span>
              <span className="font-semibold">Buscá lugares primero</span>
              <span className="block text-xs text-muted-foreground">
                Por barrio y por ganas, para llegar con opciones a la votación.
              </span>
            </span>
            <span aria-hidden className="shrink-0 text-muted-foreground">
              →
            </span>
          </Link>
        </div>
      </section>

      {/* Los 46 links a `/salir/<zona>`: el mismo componente de la home, que lee el
          canon y no la base (por eso esta página sigue siendo estática). Cumple dos
          cosas de una: le da al que aterriza acá por dónde empezar, y le da al
          crawler el camino desde esta página al eje de landings. */}
      <ExploraPorBarrio />

      <footer className="mt-auto flex flex-wrap items-center gap-x-2 pt-4 text-xs text-muted-foreground">
        <Link href="/legales" className="font-medium underline underline-offset-4">
          Cómo armamos el catálogo
        </Link>
        <span aria-hidden>·</span>
        <span>
          Datos de{' '}
          <Link href="/legales/atribucion" className="underline underline-offset-4">
            Overture Maps y Google
          </Link>
        </span>
      </footer>
    </main>
  )
}
