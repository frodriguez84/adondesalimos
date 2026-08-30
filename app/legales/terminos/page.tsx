import type { Metadata } from 'next'
import Link from 'next/link'

import { Documento, Externo, MailContacto, Seccion } from '@/components/legales/ui'
import { beneficiosDe } from '@/lib/billing/beneficios'

export const metadata: Metadata = {
  title: 'Términos y condiciones — ¿A dónde salimos?',
  description:
    'Qué es el servicio, qué podés esperar de él, cómo funcionan la cuenta y los planes pagos.',
}

/**
 * Términos y condiciones (LEGALES, F1).
 *
 * ⚠️ **Esto no lo revisó un abogado** (decisión 1 de Fer, 2026-08-21). Cubre
 * razonablemente y es muchísimo mejor que nada, pero **no garantiza cumplimiento**. El
 * aviso vive acá, en el código, y **no de cara al usuario**: un documento que arranca
 * dudando de sí mismo no sirve para nada.
 *
 * La lista de § Planes pagos **no se escribe acá**: sale de `beneficiosDe`
 * (`lib/billing/beneficios.ts`), el dueño único de qué incluye cada plan. Se la llama
 * **sin cupos** a propósito — esta página es estática y leer `app_settings` la
 * convertiría en función serverless (CLAUDE.md § Notas importantes); sin números el
 * texto dice "con cupo mensual" y "más listas", que es la misma promesa y no vence.
 *
 * Lo que reemplaza al abogado es el criterio de redacción de la decisión 3: **cada
 * cláusula tiene que poder señalar una fila del § Inventario del spec**. Si no se puede
 * señalar dónde vive en el código, no se escribe. Unos T&C que prometen algo que el
 * código no cumple son **peores** que no tenerlos: convierten un vacío en una
 * declaración falsa.
 *
 * Dos cosas que NO se escriben acá, y no es un olvido:
 * - **Nada de exoneración total** (decisión 9). La fórmula de manual —esa que dice que el
 *   proveedor no responde por nada— no cubre y el que sabe la detecta; además la Ley
 *   24.240 declara nulas las cláusulas abusivas, así que es literalmente letra muerta.
 *   Hay un grep en el DoD que falla si alguna de esas frases entra al archivo.
 * - **Ningún nombre, razón social ni CUIT** (§ *El titular del servicio*). El titular
 *   declarado es el dominio + el mail, y esa es la brecha conocida del spec: se cierra
 *   con el primer pago real de un tercero, no inventando un dato que Fer no dio.
 */

const ACTUALIZADO = '2026-08-21'

export default function TerminosPage() {
  return (
    <Documento
      titulo="Términos y condiciones"
      actualizado={ACTUALIZADO}
      bajada="Las reglas de uso de la app, escritas describiendo lo que la app hace de verdad."
    >
      <Seccion titulo="Quién presta el servicio">
        <p>
          <strong className="text-foreground">¿A dónde salimos?</strong> es un servicio que se
          presta a través del sitio{' '}
          <strong className="text-foreground">adondesalimos.com.ar</strong>. El canal de contacto
          —y el único mail que leemos— es <MailContacto />.
        </p>
        <p>
          Estos términos se rigen por las leyes de la República Argentina, y cualquier conflicto
          que surja de ellos se somete a los tribunales ordinarios de la{' '}
          <strong className="text-foreground">Ciudad Autónoma de Buenos Aires</strong>.
        </p>
        <p>
          Si contratás un plan pago, el cobro lo procesa <strong>Mercado Pago</strong>: en su
          checkout vas a ver identificado al vendedor antes de que se te cobre nada.
        </p>
      </Seccion>

      <Seccion titulo="Qué es esto">
        <p>
          Una app para decidir a dónde salir. Te mostramos un catálogo de bares, restaurantes y
          lugares del AMBA armado sobre <strong>datos públicos</strong> —principalmente Overture
          Maps—, más lo que consultamos en vivo a Google y lo que carga cada dueño sobre su propio
          negocio. Podés buscar, filtrar por zona, guardar lugares, armar votaciones con tu grupo
          y, con plan pago, charlar con un asistente que te sugiere adónde ir.
        </p>
        <p>
          De dónde sale cada dato y bajo qué licencia está, en{' '}
          <Link href="/legales/atribucion" className="text-primary underline underline-offset-4">
            Fuentes y atribución
          </Link>
          .
        </p>
      </Seccion>

      <Seccion titulo="Qué podés esperar, y qué no">
        <p>
          <strong className="text-foreground">
            El catálogo puede tener errores.
          </strong>{' '}
          Los lugares salen de datos abiertos que no controlamos: puede haber negocios que ya
          cerraron, direcciones viejas, horarios desactualizados o lugares que directamente no
          figuran. Hacemos lo razonable para que el dato sea bueno —revisamos, etiquetamos a mano y
          les damos a los dueños una forma de corregir su ficha—, pero{' '}
          <strong className="text-foreground">
            no podemos garantizarte que un lugar esté abierto, que exista o que sea como lo
            describe la ficha
          </strong>
          . Antes de cruzar la ciudad, conviene chequear.
        </p>
        <p>
          Tampoco somos parte de lo que pase entre vos y el lugar: no reservamos mesas, no vendemos
          consumiciones y no intermediamos en tu experiencia ahí.
        </p>
        <p>
          El servicio se ofrece tal como está y puede tener interrupciones, cambios o funciones que
          aparecen y desaparecen mientras la app madura. Si algo salió mal por un error nuestro,
          escribinos a <MailContacto />: lo miramos y, si corresponde, lo resolvemos. Nada de lo
          que dice este documento limita los derechos que te da la{' '}
          <strong className="text-foreground">Ley 24.240 de Defensa del Consumidor</strong>.
        </p>
        <p>
          <strong className="text-foreground">Cuando encontrás un error, contanos.</strong> Un
          lugar que cerró, una zona que no cierra, algo que buscaste y no apareció: cada mensaje
          nos sirve, y es la forma más rápida de que el catálogo mejore.
        </p>
      </Seccion>

      <Seccion titulo="Tu cuenta">
        <p>
          Buena parte de la app se usa sin cuenta: buscar, abrir fichas y votar en una votación que
          te compartieron. Necesitás cuenta para guardar lugares, crear votaciones, reclamar un
          negocio o contratar un plan.
        </p>
        <p>
          <strong className="text-foreground">
            Para crear una cuenta y para contratar un plan pago hay que tener 18 años o más.
          </strong>{' '}
          No verificamos la edad —no tenemos cómo, y prometer una verificación que no existe sería
          mentirte—, pero al registrarte nos estás declarando que los tenés. La app se puede usar
          sin cuenta y sin edad mínima, aunque buena parte del catálogo son bares.
        </p>
        <p>
          La contraseña es tuya y es tu responsabilidad no compartirla. Nosotros nunca la guardamos
          en claro: en la base vive un hash, no tu contraseña.
        </p>
        <p>
          <strong className="text-foreground">Podés eliminar tu cuenta cuando quieras</strong>,
          desde{' '}
          <Link href="/cuenta" className="text-primary underline underline-offset-4">
            Mi cuenta
          </Link>
          . Qué se borra y qué no, dato por dato, está en la{' '}
          <Link href="/legales/privacidad" className="text-primary underline underline-offset-4">
            política de privacidad
          </Link>
          ; el camino completo, junto con el de la baja de una suscripción, en{' '}
          <Link href="/legales/baja" className="text-primary underline underline-offset-4">
            Baja y arrepentimiento
          </Link>
          .
        </p>
        <p>
          Podemos suspender o dar de baja una cuenta que use la app para algo de lo que dice el
          punto que sigue, o que haya reclamado un negocio que no es suyo. Si pasa, te lo
          escribimos al mail de la cuenta.
        </p>
      </Seccion>

      <Seccion titulo="Uso aceptable">
        <p>Usando la app te comprometés a no:</p>
        <ul className="list-inside list-disc">
          <li>
            reclamar como propio un negocio que no es tuyo, ni cargar datos de contacto que
            desvíen llamadas o tráfico web de un lugar a otro;
          </li>
          <li>
            subir fotos, textos o enlaces sobre los que no tenés derechos, o que sean de otro
            negocio;
          </li>
          <li>
            cargar contenido ilegal, engañoso, discriminatorio o que no describa al lugar que
            estás editando;
          </li>
          <li>
            raspar el catálogo de forma automatizada, saturar la app con pedidos ni intentar
            saltear los límites de uso;
          </li>
          <li>usar el asistente de chat para generar contenido ilegal o para revender el servicio.</li>
        </ul>
        <p>
          Aplicamos límites de pedidos por minuto para que la app siga andando para todo el mundo.
          Si te topás con uno haciendo un uso normal, contanos.
        </p>
      </Seccion>

      <Seccion titulo="Si sos dueño de un lugar">
        <p>
          Podés reclamar la ficha de tu negocio y, una vez aprobado el reclamo, editar lo que se ve
          en ella: contacto, horarios, fotos y —con plan pago— descripción, carta y novedades.
        </p>
        <p>
          <strong className="text-foreground">Lo que cargás sigue siendo tuyo.</strong> Al subirlo
          nos das permiso para mostrarlo en la app y en las páginas públicas del lugar: es una{' '}
          <strong className="text-foreground">licencia no exclusiva, gratuita y revocable</strong>.
          No exclusiva porque podés usar esa misma foto donde se te cante; revocable porque{' '}
          <strong className="text-foreground">se termina cuando borrás la foto</strong> desde tu
          panel — al borrarla la sacamos de la ficha y también del almacenamiento donde vivía.
        </p>
        <p>
          Al subir una foto nos estás declarando que tenés derecho a hacerlo: que la sacaste vos,
          que te la cedieron o que de algún modo podés publicarla. Si aparece un reclamo de un
          tercero sobre una foto, la damos de baja.
        </p>
        <p>
          El reclamo de una ficha se aprueba a mano y se puede revocar. Si eso pasa, el contenido
          que cargaste <strong className="text-foreground">deja de mostrarse</strong> y la ficha
          vuelve a los datos públicos.
        </p>
      </Seccion>

      <Seccion titulo="Planes pagos">
        <p>
          Hay funciones que se pagan. Con el{' '}
          <strong className="text-foreground">Premium</strong> de una cuenta:
        </p>
        <ul className="ml-4 list-disc space-y-1">
          {beneficiosDe('b2c').map((beneficio) => (
            <li key={beneficio}>{beneficio}</li>
          ))}
        </ul>
        <p>
          Y con el <strong className="text-foreground">plan de un lugar</strong>, para su dueño:
        </p>
        <ul className="ml-4 list-disc space-y-1">
          {beneficiosDe('b2b').map((beneficio) => (
            <li key={beneficio}>{beneficio}</li>
          ))}
        </ul>
        <p>
          Las suscripciones son{' '}
          <strong className="text-foreground">mensuales y se renuevan solas</strong> hasta que las
          canceles. El precio en pesos está a la vista antes de contratar y lo cobra Mercado Pago;
          puede cambiar, y si cambia te avisamos antes de que se te aplique.{' '}
          <strong className="text-foreground">Ninguna tarjeta pasa por la app</strong>: todo el
          cobro ocurre en Mercado Pago.
        </p>
        <p>
          <strong className="text-foreground">Cancelás cuando querés</strong>, desde{' '}
          <Link href="/cuenta" className="text-primary underline underline-offset-4">
            Mi cuenta
          </Link>
          , y mantenés el acceso hasta el final del período que ya pagaste. Y tenés{' '}
          <strong className="text-foreground">10 días corridos para arrepentirte</strong> de la
          contratación, como manda la Ley 24.240: el detalle está en{' '}
          <Link href="/legales/baja" className="text-primary underline underline-offset-4">
            Baja y arrepentimiento
          </Link>
          .
        </p>
        <p>
          Al bajar de plan no borramos lo que habías cargado:{' '}
          <strong className="text-foreground">se deja de mostrar</strong>, y vuelve a verse si
          volvés a contratar.
        </p>
      </Seccion>

      <Seccion titulo="El asistente de chat">
        <p>
          El chat usa un modelo de inteligencia artificial de{' '}
          <Externo href="https://www.anthropic.com/">Anthropic</Externo>, así que{' '}
          <strong className="text-foreground">
            lo que escribas ahí sale de nuestros servidores hacia un tercero
          </strong>
          . Está explicado en la{' '}
          <Link href="/legales/privacidad" className="text-primary underline underline-offset-4">
            política de privacidad
          </Link>
          .
        </p>
        <p>
          Lo que te sugiere sale del mismo catálogo que ves en la búsqueda, así que arrastra sus
          mismos errores, y además puede equivocarse por su cuenta. Tomalo como una recomendación,
          no como un dato verificado. Y no le cuentes cosas que no querrías que salgan de tu
          teléfono.
        </p>
      </Seccion>

      <Seccion titulo="Cambios en estos términos">
        <p>
          Si los cambiamos, actualizamos la fecha de arriba. Los cambios importantes —sobre todo si
          tocan un plan pago— te los avisamos al mail de la cuenta. Seguir usando la app después de
          un cambio significa que lo aceptás; si no te convence, podés dar de baja la cuenta.
        </p>
        <p>
          Usar la app implica aceptar estos términos y la política de privacidad. No hace falta que
          firmes ni que tildes nada: alcanza con que la uses.
        </p>
      </Seccion>
    </Documento>
  )
}
