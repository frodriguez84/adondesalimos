import type { Metadata } from 'next'
import Link from 'next/link'

import { Documento, Externo, MailContacto, Seccion } from '@/components/legales/ui'

export const metadata: Metadata = {
  title: 'Política de privacidad — ¿A dónde salimos?',
  description:
    'Qué datos guardamos, cuáles no, las cookies que hay, a quién le llega qué y cómo pedir que borremos lo tuyo.',
}

/**
 * Política de privacidad (LEGALES, F2).
 *
 * ⚠️ **Esto no lo revisó un abogado** (decisión 1). Cubre razonablemente y es muchísimo
 * mejor que nada, pero **no garantiza cumplimiento**.
 *
 * Este documento es el § *Inventario* del spec puesto en prosa, y ese acoplamiento es
 * la regla, no una casualidad: **cada párrafo tiene que poder señalar una fila de esas
 * tablas** (decisión 3). Si el código cambia qué guarda, cambia el inventario del spec
 * y después este archivo. Si acá aparece una promesa que ninguna fila respalda, es un
 * bug de este archivo.
 *
 * Las tres trampas que el spec ya midió y que **no hay que re-descubrir**:
 *
 * 1. **Negar que la app tenga cookies sería falso** (decisión 6). Hay dos, las dos
 *    funcionales: la de sesión de better-auth y `voter_id`. Y sería falso de un modo
 *    verificable en 5 segundos con el inspector. Lo que sí es verdad, y es mejor: no hay
 *    ninguna de analítica ni de terceros, y por eso no hay banner. Hay un grep en el DoD
 *    que falla si la negación entra al archivo, en singular o en plural.
 * 2. **El invariante de «ni usuario, ni cookie, ni IP» es de la INSTRUMENTACIÓN**
 *    (MONETIZACION decisión 22), no de la app entera. Copiarlo textual acá convertiría
 *    la mejor carta que tiene la app en una declaración falsa.
 * 3. **`session.ip_address` y `session.user_agent` sí se llenan** — verificado contra la
 *    base el 2026-08-21 (LEG-20): 33 de 33 filas en dev y 9 de 9 en producción, con IPs
 *    públicas reales. Por eso se declaran como excepción explícita de seguridad en vez
 *    de callarlas.
 *
 * Y lo que este documento **no** promete, a propósito: no hay plazo de retención. No
 * existe un solo cron (`vercel.json` no declara `crons`), así que prometer un borrado
 * automático que nadie ejecuta sería exactamente el pecado de la decisión 3.
 */

const ACTUALIZADO = '2026-08-21'

/** Bloque A del inventario: lo que se guarda, para qué, y qué pasa al dar de baja. */
const DATOS: { dato: string; para: string; baja: React.ReactNode }[] = [
  {
    dato: 'Tu email',
    para: 'Entrar a la app y mandarte los mails de la cuenta.',
    baja: 'Se borra.',
  },
  {
    dato: 'Tu nombre',
    para: 'Saludarte en la app.',
    baja: 'Se borra.',
  },
  {
    dato: 'Tu foto de perfil',
    para: 'Mostrarla en tu cuenta. Hoy siempre está vacía: todavía no hay login con Google.',
    baja: 'Se borra.',
  },
  {
    dato: 'Tu contraseña, en forma de hash',
    para: 'Verificar que sos vos cuando entrás. Nunca guardamos la contraseña en claro.',
    baja: 'Se borra.',
  },
  {
    dato: 'La IP y el navegador de cada sesión',
    para: 'Seguridad de la cuenta: saber desde dónde se abrió una sesión. Los escribe la librería de autenticación al crearla.',
    baja: 'Se borra junto con la sesión.',
  },
  {
    dato: 'Los tokens de verificación de mail y de reseteo de contraseña',
    para: 'Que el link que te mandamos funcione una vez y no para siempre.',
    baja: 'Vencen solos. Nunca aparecen en ningún registro.',
  },
  {
    dato: 'Los datos del reclamo de un negocio: nombre, teléfono, rol y comentario',
    para: 'Que podamos verificar que tenés relación con ese lugar antes de darte la ficha.',
    baja: 'Se borra.',
  },
  {
    dato: 'Lo que cargás como dueño: contacto, horarios, descripción, carta y novedades',
    para: 'Que la ficha muestre tus datos en vez de los del mapa público.',
    baja: (
      <>
        <strong className="text-foreground">Deja de mostrarse, pero no se borra.</strong> Si querés
        que lo borremos de verdad, pedínoslo — ver <em>Tus derechos</em>, más abajo.
      </>
    ),
  },
  {
    dato: 'Las fotos que subís de tu negocio',
    para: 'La galería de la ficha.',
    baja: 'Se borran, tanto la referencia en la base como el archivo en el almacenamiento.',
  },
  {
    dato: 'Las votaciones que creás y sus opciones',
    para: 'Que tu grupo vote a dónde ir.',
    baja: 'Se borran.',
  },
  {
    dato: 'Tu voto y las opciones que sugeriste en la votación de otro',
    para: 'Un voto por dispositivo, sin pedirte cuenta. Lo que guardamos es un identificador al azar que vive en una cookie, no una identidad.',
    baja: 'Si la votación es de otra persona, tu voto sigue contando ahí.',
  },
  {
    dato: 'Las conversaciones del chat',
    para: 'Que puedas volver a leer lo que charlaste con el asistente.',
    baja: 'Se borran.',
  },
  {
    dato: 'Cuánto chat usaste este mes',
    para: 'Llevar el cupo. Es un contador aparte: borrar una conversación no te devuelve cupo.',
    baja: 'Se borra.',
  },
  {
    dato: 'Tu suscripción y sus pagos, incluido el mail con el que pagaste',
    para: 'Cobrar, renovar y saber qué plan tenés.',
    baja: 'Cancelamos la suscripción en Mercado Pago y después se borra.',
  },
  {
    dato: 'Tus listas de lugares guardados',
    para: '«Mis lugares».',
    baja: 'Se borran.',
  },
  {
    dato: 'Las correcciones de datos que propusiste',
    para: 'La cola de correcciones del catálogo.',
    baja: 'La corrección queda, pero deja de estar asociada a vos.',
  },
  {
    dato: 'Cuántos mails te mandamos hoy',
    para: 'No pasarnos de un tope diario por persona.',
    baja: (
      <>
        Nunca guardamos tu dirección acá: lo que se guarda es un{' '}
        <strong className="text-foreground">hash</strong> del mail, del que no se puede volver
        atrás.
      </>
    ),
  },
]

/** Bloque D, primer grupo: a quién le mandamos datos desde el servidor. */
const TERCEROS_SERVIDOR: { quien: React.ReactNode; que: string; cuando: string }[] = [
  {
    quien: <Externo href="https://www.anthropic.com/legal/privacy">Anthropic</Externo>,
    que: 'El texto que escribís en el chat y los lugares del catálogo que el asistente busca para responderte.',
    cuando: 'Solo si usás el chat.',
  },
  {
    quien: <Externo href="https://www.mercadopago.com.ar/privacidad">Mercado Pago</Externo>,
    que: 'El monto, el plan y tu mail de pagador. La tarjeta la ponés allá: nunca pasa por nosotros.',
    cuando: 'Solo si contratás un plan pago.',
  },
  {
    quien: 'Nuestro proveedor de envío de mails',
    que: 'Tu dirección de mail y el contenido del mail que te mandamos.',
    cuando: 'Verificación de la cuenta, reseteo de contraseña y el resultado de un reclamo de negocio.',
  },
  {
    quien: <Externo href="https://policies.google.com/privacy">Google Maps Platform</Externo>,
    que: 'El identificador del lugar cuya ficha estás mirando. No le mandamos nada tuyo.',
    cuando: 'Al abrir una ficha.',
  },
]

/** Bloque D, segundo grupo: a quién le pega tu navegador y por eso ve tu IP. */
const TERCEROS_NAVEGADOR: { quien: React.ReactNode; que: string }[] = [
  {
    quien: <Externo href="https://policies.google.com/privacy">Google</Externo>,
    que: 'La foto que se ve en la ficha se descarga directo de Google.',
  },
  {
    quien: <Externo href="https://openfreemap.org/">OpenFreeMap</Externo>,
    que: 'Los mosaicos del mapa.',
  },
  {
    quien: <Externo href="https://www.cloudflare.com/privacypolicy/">Cloudflare R2</Externo>,
    que: 'Las fotos que subieron los dueños.',
  },
  {
    quien: <Externo href="https://vercel.com/legal/privacy-policy">Vercel</Externo>,
    que: 'Toda la app se sirve desde ahí, así que sus registros de pedidos incluyen tu IP.',
  },
  {
    quien: 'Nuestro proveedor de base de datos',
    que: 'Ahí vive todo lo de la primera tabla. No recibe tu IP directamente, pero es donde tus datos están guardados.',
  },
]

export default function PrivacidadPage() {
  return (
    <Documento
      titulo="Política de privacidad"
      actualizado={ACTUALIZADO}
      bajada="Qué datos tuyos tenemos, cuáles no, y a quién le llega qué. Escrito mirando el código, no una plantilla."
    >
      <Seccion titulo="Lo corto">
        <p>
          Se puede usar casi toda la app sin darnos un solo dato: buscar, abrir fichas, mirar el
          mapa y votar no piden cuenta. Si te registrás, guardamos lo mínimo para que la cuenta
          funcione.
        </p>
        <p>
          <strong className="text-foreground">
            No medimos qué mirás vos, y no es una promesa: es que el dato nunca existe.
          </strong>{' '}
          Contamos cuántas veces se mostró y se abrió cada lugar, por día, y ahí se termina — sin tu
          usuario, sin cookie y sin IP. No hay forma de reconstruir tu recorrido porque nunca se
          guardó.
        </p>
        <p>
          Y no hay ningún rastreador de terceros: ni Google Analytics, ni el píxel de Meta, ni
          Hotjar, ni nada por el estilo.
        </p>
      </Seccion>

      <Seccion titulo="Qué guardamos, para qué, y qué pasa si borrás la cuenta">
        <p>
          Todo esto vive en nuestra base de datos, y solo aparece si hacés la acción que lo genera:
          si nunca creaste una votación, no hay una fila de votación tuya.
        </p>
        <div className="flex flex-col gap-3">
          {DATOS.map((d) => (
            <div key={d.dato} className="rounded-2xl border border-border bg-card px-4 py-3">
              <p className="text-sm font-semibold text-foreground">{d.dato}</p>
              <p className="mt-0.5 text-xs">{d.para}</p>
              <p className="mt-1 text-xs">
                <span className="uppercase tracking-wider text-muted-foreground/70">Si borrás la cuenta:</span>{' '}
                {d.baja}
              </p>
            </div>
          ))}
        </div>
      </Seccion>

      <Seccion titulo="Qué NO guardamos">
        <p>
          Esta parte es la más importante y es la que menos se suele escribir, así que va con
          nombre y apellido:
        </p>
        <ul className="list-inside list-disc">
          <li>
            <strong className="text-foreground">Qué buscás.</strong> El texto que escribís en el
            buscador no se registra en ningún lado.
          </li>
          <li>
            <strong className="text-foreground">Qué mirás.</strong> Las estadísticas de uso son
            conteos por lugar y por día: no se anota ni tu usuario, ni una cookie, ni tu IP.
          </li>
          <li>
            <strong className="text-foreground">Nada de lo que nos da Google.</strong> Horarios,
            calificación y fotos se piden en vivo cada vez que abrís una ficha y no se guardan. Lo
            único que queda es el identificador del lugar en Google.
          </li>
          <li>
            <strong className="text-foreground">Ninguna tarjeta.</strong> El cobro lo hace Mercado
            Pago de punta a punta; de tu pago guardamos el identificador de la suscripción y el mail
            del pagador.
          </li>
          <li>
            <strong className="text-foreground">
              Ninguna documentación de titularidad de un negocio.
            </strong>{' '}
            Cuando alguien reclama un lugar miramos lo que haga falta y anotamos el resultado: ni
            CUIT, ni DNI, ni archivos adjuntos.
          </li>
          <li>
            <strong className="text-foreground">La IP de los límites de uso.</strong> El control de
            pedidos por minuto vive en la memoria del proceso y se pierde solo; no se persiste en
            ninguna tabla.
          </li>
        </ul>
      </Seccion>

      <Seccion titulo="Las cookies que sí hay">
        <p>
          Son <strong className="text-foreground">dos</strong>, y las dos son funcionales: sin
          ellas la función que usás no anda.
        </p>
        <ul className="list-inside list-disc">
          <li>
            <strong className="text-foreground">La cookie de sesión.</strong> Es la que te mantiene
            logueado. Se crea al entrar y se va cuando cerrás sesión.
          </li>
          <li>
            <strong className="text-foreground">
              <code className="text-foreground">voter_id</code>
            </strong>
            . Un identificador al azar que se pone la primera vez que votás en una votación, para
            que se pueda votar una vez por dispositivo sin obligarte a crear cuenta. No dice quién
            sos ni se muestra a nadie.
          </li>
        </ul>
        <p>
          <strong className="text-foreground">
            No hay cookies de analítica, de publicidad ni de terceros.
          </strong>{' '}
          Por eso tampoco vas a ver un cartel pidiéndote que las aceptes: no habría nada que
          aceptar, y un banner que no consiente nada es puro teatro. Podés verificarlo vos con el
          inspector del navegador.
        </p>
      </Seccion>

      <Seccion titulo="La excepción: la IP de tu sesión">
        <p>
          Arriba dijimos que las estadísticas de uso no guardan IP, y es cierto.{' '}
          <strong className="text-foreground">Hay una excepción y la decimos:</strong> cuando
          iniciás sesión, la librería de autenticación guarda junto a esa sesión{' '}
          <strong className="text-foreground">la IP y el navegador desde el que la abriste</strong>.
        </p>
        <p>
          Es un dato de <strong className="text-foreground">seguridad de la cuenta</strong>, no de
          medición: sirve para saber desde dónde se abrió una sesión. Se borra cuando la sesión
          vence o cuando borrás la cuenta, y no se cruza con nada de lo que hacés en la app.
        </p>
      </Seccion>

      <Seccion titulo="A quién le llegan datos">
        <p>
          Hay dos grupos, y la diferencia importa: uno lo decidimos nosotros, y el otro lo hace tu
          navegador solo.
        </p>
        <p className="font-medium text-foreground">Le mandamos datos desde nuestros servidores:</p>
        <ul className="flex flex-col gap-2">
          {TERCEROS_SERVIDOR.map((t, i) => (
            <li key={i} className="rounded-2xl border border-border bg-card px-4 py-3">
              <p className="text-sm font-semibold text-foreground">{t.quien}</p>
              <p className="mt-0.5 text-xs">{t.que}</p>
              <p className="mt-0.5 text-xs text-muted-foreground/80">{t.cuando}</p>
            </li>
          ))}
        </ul>
        <p>
          Lo que cada uno hace con eso lo dice su propia política, que linkeamos donde la tenemos a
          mano. No hablamos por ellos.
        </p>
        <p className="font-medium text-foreground">
          Y a estos les pega tu navegador directamente, así que ven tu IP:
        </p>
        <ul className="flex flex-col gap-2">
          {TERCEROS_NAVEGADOR.map((t, i) => (
            <li key={i} className="rounded-2xl border border-border bg-card px-4 py-3">
              <p className="text-sm font-semibold text-foreground">{t.quien}</p>
              <p className="mt-0.5 text-xs">{t.que}</p>
            </li>
          ))}
        </ul>
        <p>
          No podemos ocultarle tu IP a quien te sirve una imagen o un mosaico de mapa —así funciona
          la web—, pero sí podemos decírtelo, que es lo que estamos haciendo acá.
        </p>
        <p>
          Dos de todos estos van nombrados por lo que hacen y no por su marca: el que manda los
          mails y el que guarda la base de datos.{' '}
          <strong className="text-foreground">Si querés saber exactamente quiénes son, escribinos a</strong>{' '}
          <MailContacto /> y te lo decimos. No es un dato que escondamos: simplemente elegimos no
          publicar el detalle de con qué proveedores está armada la app.
        </p>
      </Seccion>

      <Seccion titulo="Cuánto tiempo guardamos las cosas">
        <p>
          <strong className="text-foreground">
            No hay ningún borrado automático, y preferimos decirlo antes que inventar un plazo.
          </strong>{' '}
          Los datos de tu cuenta viven mientras exista la cuenta. Las votaciones dejan de aceptar
          votos a las 72 horas, pero la votación en sí sigue guardada.
        </p>
        <p>
          Si querés que algo se vaya antes, no hace falta esperar a que un sistema lo haga solo:
          borrás la cuenta desde{' '}
          <Link href="/cuenta" className="text-primary underline underline-offset-4">
            Mi cuenta
          </Link>{' '}
          o nos escribís.
        </p>
      </Seccion>

      <Seccion titulo="Tus derechos">
        <p>
          La <strong className="text-foreground">Ley 25.326 de Protección de los Datos
          Personales</strong> te da derecho a <strong className="text-foreground">acceder</strong> a
          los datos que tenemos tuyos, a <strong className="text-foreground">rectificarlos</strong>{' '}
          si están mal, a <strong className="text-foreground">actualizarlos</strong> y a pedir su{' '}
          <strong className="text-foreground">supresión</strong>.
        </p>
        <p>
          Se ejercen escribiendo a <MailContacto /> desde la dirección de tu cuenta. No hay
          formulario ni trámite: contanos qué necesitás y lo resolvemos.
        </p>
        <p>
          Hay un caso donde el pedido es necesario y no alcanza con borrar la cuenta:{' '}
          <strong className="text-foreground">
            el contenido que cargaste como dueño de un negocio deja de mostrarse, pero queda
            guardado
          </strong>
          . Si querés que lo borremos de la base, pedínoslo por ese mismo mail y lo hacemos.
        </p>
        <p>
          La Agencia de Acceso a la Información Pública, en su carácter de órgano de control de la
          Ley 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan
          quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en
          materia de protección de datos personales.
        </p>
      </Seccion>

      <Seccion titulo="Menores">
        <p>
          Para crear una cuenta hay que tener 18 años o más. Si sos madre, padre o tutor y creés que
          alguien menor de edad creó una cuenta, escribinos a <MailContacto /> y la damos de baja.
        </p>
      </Seccion>

      <Seccion titulo="Si esto cambia">
        <p>
          Cuando cambiemos algo actualizamos la fecha de arriba. Si el cambio es importante —datos
          nuevos que empecemos a guardar, un tercero nuevo— te lo avisamos al mail de la cuenta. Lo
          que no vamos a hacer es cambiar en silencio qué guardamos y dejar este documento viejo.
        </p>
      </Seccion>
    </Documento>
  )
}
