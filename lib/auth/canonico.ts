import { sql, type Column, type SQL } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'

/**
 * ¿Dos direcciones distintas son la misma bandeja? (`SEC-21`)
 *
 * En Gmail sí: `fer+1@gmail.com`, `f.er@gmail.com` y `fer@gmail.com` entran todas
 * al mismo buzón. Sin esto, `+1` … `+999` eran **999 cuentas distintas**, todas
 * verificables desde una sola bandeja y cada una con su probadita del chat.
 *
 * **Lo que NO hace, y es a propósito:** no reescribe lo que se guarda ni toca el
 * login. Se midió antes de decidirlo: de los 3 usuarios de producción, **2 tienen
 * un punto en el local-part** (`frodriguez.este@`, `sol.tripoliazcurra@`), así que
 * canonizar la columna o el login los dejaba afuera de su propia cuenta. El mail se
 * guarda tal como lo escribieron y se compara canonizado **solo al dar de alta**:
 * misma bandeja ⇒ una sola cuenta, sin romper a nadie.
 *
 * Solo Gmail y `googlemail.com`. Para el resto de los dominios `+etiqueta` no es
 * necesariamente un alias y tratarlo como tal rechazaría altas legítimas; ahí sigue
 * mandando la unicidad exacta que ya aplica better-auth.
 */

/**
 * La regla, escrita **una sola vez**, como fragmento SQL que se aplica igual a la
 * columna y al valor nuevo. Es la forma de que no haya dos versiones que driften:
 * comparar una normalización de TypeScript contra uno de Postgres es exactamente
 * el error que `SEC-20` dejó en evidencia en otra columna.
 *
 * ```
 * F.er+chat@GoogleMail.com  →  fer@gmail.com
 * alguien+x@outlook.com     →  alguien+x@outlook.com   (intacto)
 * ```
 */
export function emailCanonico(e: Column | SQL | string): SQL<string> {
  return sql<string>`(
    case when split_part(lower(${e}), '@', 2) in ('gmail.com', 'googlemail.com')
      then replace(split_part(split_part(lower(${e}), '@', 1), '+', 1), '.', '') || '@gmail.com'
      else lower(${e})
    end
  )`
}

/**
 * ¿Ya hay una cuenta que reciba en la misma bandeja que `email`?
 *
 * Se consulta **solo** para altas de Gmail: para el resto el valor canónico es el
 * mail en minúsculas y ese caso ya lo cubre la unicidad de better-auth, así que
 * ni se toca la base.
 */
export async function hayCuentaEquivalente(email: string): Promise<boolean> {
  const dominio = email.split('@')[1]?.toLowerCase()
  if (dominio !== 'gmail.com' && dominio !== 'googlemail.com') return false

  const [fila] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`${emailCanonico(users.email)} = ${emailCanonico(email)}`)
    .limit(1)

  return Boolean(fila)
}
