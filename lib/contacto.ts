/**
 * Dueño único del canal de contacto (DEPLOY, decisión 22).
 *
 * `contacto@` es **el único mail que recibe**: es un reenvío por Cloudflare Email
 * Routing a la casilla de Fer. `no-reply@` solo envía y nadie lee lo que le llegue,
 * así que publicarlo sería ofrecer un canal que no existe.
 *
 * Existe como módulo porque LEGALES lo convirtió en algo más que un dato de pie de
 * página: es **el canal por el que se ejercen los derechos de la Ley 25.326**
 * (acceso, rectificación, supresión) y el que la política de privacidad promete. Una
 * segunda copia que quede vieja no es un typo — es una promesa rota.
 */
export const CONTACTO = 'contacto@adondesalimos.com.ar'
