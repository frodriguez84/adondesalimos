/**
 * La declaración que tilda quien reclama un lugar o da de alta uno nuevo
 * (TITULARIDAD decisiones 4, 5 y 6).
 *
 * **El texto y su versión viven juntos, acá, y es el único lugar donde se
 * tocan**: cambiar el copy obliga a cambiar la versión en la misma edición. Sin
 * eso, `place_claims.declaracion_version` diría dentro de un año a qué se
 * comprometió alguien con un texto que ya no es ese.
 *
 * El orden es deliberado: **primero la declaración, después la consecuencia**
 * (decisión 4). Y la consecuencia enumera lo que de verdad pasa —se da de baja
 * el reclamo, se pierde la cuenta, queda registrado—, sin decir que reclamar en
 * falso sea un delito: no lo es por sí solo, y el que sabe lo detecta (cicatriz
 * del aviso de beta, DEPLOY decisión 21). Lo que sostiene revocar es que la
 * persona **afirmó algo concreto**.
 */

/** Versión del texto de abajo. Se bumpea en la misma edición que el copy. */
export const DECLARACION_VERSION = '2026-08-17'

/** Lo que la persona afirma al tildar. */
export const DECLARACION_TEXTO =
  'Declaro que soy el dueño de este negocio o que estoy autorizado a gestionarlo.'

/** Lo que pasa si no era así. Va DESPUÉS de la declaración (decisión 4). */
export const DECLARACION_CONSECUENCIA =
  'Revisamos cada solicitud a mano. Si resulta que no era así, damos de baja tu reclamo y tu cuenta, y queda registrado que lo pediste vos y cuándo.'
