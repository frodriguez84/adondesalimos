import type { Metadata } from 'next'
import Link from 'next/link'

import { MailContacto, Seccion } from '@/components/legales/ui'

export const metadata: Metadata = {
  title: 'La letra chica — ¿A dónde salimos?',
  description:
    'Cómo armamos el catálogo, los términos, la política de privacidad, las fuentes de los datos y cómo darte de baja.',
}

/**
 * Índice de la letra chica (LEGALES, decisiones 4 y 16).
 *
 * **Esta URL no se mueve.** Está linkeada desde el footer de la home, el de las 301
 * páginas de `/salir`, la ficha y dos estados vacíos de la búsqueda, y está en el
 * `sitemap.xml`: convertirla en índice no cuesta un solo salto de URL, y esa es
 * exactamente la razón de haber elegido esto sobre mover todo a `/atribucion`.
 *
 * El aviso de beta se queda **acá arriba** y no en una URL propia: no es un documento
 * legal, pero es lo que viene a leer quien tocó el rótulo del footer, y darle página
 * aparte agregaría un click para no ganar nada.
 *
 * ⚠️ Nada en esta página ni en sus hijas puede leer los headers, las cookies ni la
 * sesión (decisión 10) — ver el comentario de `components/legales/ui.tsx`.
 */

const DOCUMENTOS = [
  {
    href: '/legales/terminos',
    titulo: 'Términos y condiciones',
    detalle: 'Qué es esto, qué podés esperar, qué pasa con tu cuenta y con los planes pagos.',
  },
  {
    href: '/legales/privacidad',
    titulo: 'Política de privacidad',
    detalle: 'Qué datos guardamos, cuáles no, las cookies que hay y a quién le llega qué.',
  },
  {
    href: '/legales/atribucion',
    titulo: 'Fuentes y atribución',
    detalle: 'De dónde sale el catálogo y bajo qué licencias se puede usar.',
  },
  {
    href: '/legales/baja',
    titulo: 'Baja y arrepentimiento',
    detalle: 'Cómo cancelar una suscripción o eliminar tu cuenta, y en cuánto tiempo.',
  },
]

export default function LegalesPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-8 px-4 py-8">
      <header className="flex flex-col gap-2">
        <Link href="/" className="text-sm text-muted-foreground underline underline-offset-4">
          ← Volver
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">La letra chica</h1>
        <p className="text-sm text-muted-foreground">
          En qué estado está la app, qué hacemos con tus datos y de dónde sale el catálogo.
        </p>
      </header>

      {/* Aviso de beta (DEPLOY, decisión 21). Va al tope: es lo que viene a leer
          quien llegó desde el rótulo del footer o desde un resultado flaco. Es
          expectativa, no escudo legal — nada de "no nos hacemos responsables". */}
      <Seccion titulo="Cómo armamos el catálogo">
        <p>La app recién arranca y se nota. Te contamos qué esperar, así no te comés un chasco.</p>
        <p>
          <strong className="text-foreground">El catálogo sale de datos públicos.</strong> Los
          lugares vienen de Overture Maps, un mapa abierto que arman entre Meta, Microsoft, Amazon
          y otros. Es muchísima información y está buena, pero no es perfecta: puede haber lugares
          que ya cerraron, direcciones viejas o cosas que no figuran.
        </p>
        <p>
          <strong className="text-foreground">Las zonas las armamos nosotros.</strong> No son los
          barrios oficiales: son 46 zonas pensadas para salir, así que a veces juntamos barrios que
          se caminan juntos — Almagro y Boedo, Flores y Floresta, Once y Abasto. Y te mostramos
          lugares hasta 400 metros del borde, para que no se te escape el bar de la otra cuadra por
          culpa de una avenida.
        </p>
        <p>
          <strong className="text-foreground">
            Los filtros finos todavía no cubren todo el catálogo.
          </strong>{' '}
          Que un lugar sea de sushi, tenga mesas afuera o sirva desayuno no viene en ningún dato
          público: eso lo etiquetamos a mano, y por ahora llegamos a una parte. Si buscás algo
          específico y ves poco, no es que no exista — es que todavía no lo etiquetamos. Estamos en
          eso, y cuanto más se use la app, mejor sabemos por dónde seguir.
        </p>
        <p>
          <strong className="text-foreground">¿Viste algo mal? Escribinos.</strong> Un lugar que ya
          cerró, una zona que no cierra, algo que buscaste y no apareció: contanos a{' '}
          <MailContacto className="font-medium text-primary underline underline-offset-4" />. En
          esta etapa cada mensaje nos sirve muchísimo.
        </p>
        <p>
          <strong className="text-foreground">¿Sos el dueño de un lugar?</strong> Reclamalo y
          corregí vos lo que esté mal: horarios, fotos, descripción. Es gratis.
        </p>
      </Seccion>

      <Seccion titulo="Los documentos">
        <ul className="flex flex-col gap-3">
          {DOCUMENTOS.map((doc) => (
            <li key={doc.href}>
              <Link
                href={doc.href}
                className="flex flex-col gap-0.5 rounded-2xl border border-border bg-card px-4 py-3 transition-colors hover:border-primary/50"
              >
                <span className="text-sm font-semibold text-foreground">{doc.titulo}</span>
                <span className="text-xs text-muted-foreground">{doc.detalle}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Seccion>

      <Seccion titulo="Correcciones">
        <p>
          Los datos abiertos pueden estar desactualizados o tener errores. Si encontrás algo mal en
          un lugar, escribinos a <MailContacto /> y lo corregimos.
        </p>
      </Seccion>
    </main>
  )
}
