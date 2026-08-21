import type { Metadata } from 'next'
import Link from 'next/link'

import { Documento, MailContacto, Seccion } from '@/components/legales/ui'

export const metadata: Metadata = {
  title: 'Baja y arrepentimiento — ¿A dónde salimos?',
  description:
    'Cómo cancelar una suscripción, cómo arrepentirte dentro de los 10 días y cómo eliminar tu cuenta.',
}

/**
 * Baja y arrepentimiento (LEGALES, F3).
 *
 * **Esta página es un requisito de forma, no de redacción.** La Resolución 424/2020 pide
 * que el botón de arrepentimiento y el de baja estén **accesibles desde la página
 * principal**. La sustancia ya existía —`components/billing/suscripcion-panel.tsx` tiene
 * el botón de cancelar, y `/cuenta` el de eliminar la cuenta—, pero a varios clicks y
 * detrás de un login. Esto la pone a un click del pie de la home. ⚠️ Es una lectura de la
 * norma, no un dictamen: ver decisión 11 del spec.
 *
 * ⚠️ **Página ESTÁTICA, y el link del footer es un `<Link href>` pelado** (decisión 10).
 * No es prolijidad: el footer que la linkea vive también en `app/salir/layout.tsx`, así
 * que un componente que leyera los headers, las cookies o la sesión para decidir qué
 * mostrar convertiría **301 landings estáticas en 301 funciones serverless**, y en Vercel
 * Hobby cada visita del crawler pasaría a gastar cuota. **El modo de falla es mudo**: no
 * tira error, el build simplemente las marca `ƒ` en vez de `○`. Por eso esta página
 * *explica* el camino y la acción con sesión se queda donde ya vive, en `/cuenta`.
 */

const ACTUALIZADO = '2026-08-21'

export default function BajaPage() {
  return (
    <Documento
      titulo="Baja y arrepentimiento"
      actualizado={ACTUALIZADO}
      bajada="Cómo cancelar una suscripción, cómo arrepentirte dentro de los 10 días y cómo borrar tu cuenta. Todo desde acá."
    >
      <Seccion titulo="Cancelar una suscripción">
        <p>
          Entrá a{' '}
          <Link href="/cuenta" className="font-medium text-primary underline underline-offset-4">
            Mi cuenta
          </Link>{' '}
          y tocá <strong className="text-foreground">Cancelar suscripción</strong>. Listo: es un
          botón, no un trámite, y no hay que llamar ni escribir a nadie.
        </p>
        <p>
          La cancelación corta la renovación automática.{' '}
          <strong className="text-foreground">Mantenés el acceso hasta el final del período que
          ya pagaste</strong> y después la cuenta vuelve al plan gratis. No se cobra nada más.
        </p>
        <p>
          Al volver a gratis no borramos lo que habías cargado: las listas de más y el contenido
          extra de tu ficha <strong className="text-foreground">dejan de mostrarse</strong> y
          vuelven a aparecer si contratás de nuevo.
        </p>
      </Seccion>

      <Seccion titulo="Arrepentirte: tenés 10 días">
        <p>
          Si contrataste un plan pago y te arrepentiste,{' '}
          <strong className="text-foreground">tenés 10 días corridos desde la contratación para
          decirlo y que te devolvamos lo cobrado</strong>. Es el derecho de revocación que da la
          Ley 24.240 de Defensa del Consumidor, y no hace falta que expliques por qué.
        </p>
        <p>
          Podés cancelar vos mismo desde{' '}
          <Link href="/cuenta" className="font-medium text-primary underline underline-offset-4">
            Mi cuenta
          </Link>{' '}
          —eso corta el cobro— y avisarnos a <MailContacto /> para que gestionemos la devolución
          del importe. El reintegro se hace por el mismo medio por el que pagaste, a través de
          Mercado Pago.
        </p>
      </Seccion>

      <Seccion titulo="Eliminar tu cuenta">
        <p>
          También desde{' '}
          <Link href="/cuenta" className="font-medium text-primary underline underline-offset-4">
            Mi cuenta
          </Link>
          , al final de la pantalla, en <strong className="text-foreground">Eliminar cuenta</strong>
          . Te pide la contraseña para confirmar y es definitivo.
        </p>
        <p>
          Si tenías una suscripción activa, la cancelamos en Mercado Pago antes de borrar. Qué se
          borra y qué no, dato por dato, está en la{' '}
          <Link href="/legales/privacidad" className="text-primary underline underline-offset-4">
            política de privacidad
          </Link>
          .
        </p>
      </Seccion>

      <Seccion titulo="Si algo no te funciona">
        <p>
          Si no podés entrar a tu cuenta, si el botón no responde o si preferís que lo hagamos
          nosotros, escribinos a <MailContacto /> desde la dirección de la cuenta y lo resolvemos.
          No te vamos a hacer dar vueltas para darte de baja.
        </p>
      </Seccion>
    </Documento>
  )
}
