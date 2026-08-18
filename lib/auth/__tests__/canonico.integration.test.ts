import 'dotenv/config'
import { sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import { emailCanonico, hayCuentaEquivalente } from '../canonico'

/**
 * `SEC-21` — "¿es la misma bandeja?". La regla vive en SQL (un fragmento único que
 * se aplica igual a la columna y al valor nuevo), así que se testea corriéndola
 * contra Postgres, sin insertar una sola fila: se le pasan literales y se mira qué
 * devuelve.
 */

async function canon(email: string): Promise<string> {
  // `execute` devuelve el shape del driver: array de filas en unos, `{ rows }` en
  // otros. Se contemplan los dos para no atarse a cuál está montado hoy.
  const res: unknown = await db.execute(sql`select ${emailCanonico(email)} as c`)
  const filas = (Array.isArray(res) ? res : (res as { rows: unknown[] }).rows) as { c: string }[]
  return filas[0].c
}

describe.runIf(process.env.DATABASE_URL)('emailCanonico — qué colapsa y qué no', () => {
  it('en Gmail, `+etiqueta` y los puntos son la misma bandeja', async () => {
    expect(await canon('fer+1@gmail.com')).toBe('fer@gmail.com')
    expect(await canon('fer+chat+otra@gmail.com')).toBe('fer@gmail.com')
    expect(await canon('f.e.r@gmail.com')).toBe('fer@gmail.com')
    expect(await canon('f.er+999@gmail.com')).toBe('fer@gmail.com')
  })

  it('googlemail.com es el mismo buzón que gmail.com, y las mayúsculas no cuentan', async () => {
    expect(await canon('F.Er+X@GoogleMail.COM')).toBe('fer@gmail.com')
    expect(await canon('FER@GMAIL.COM')).toBe('fer@gmail.com')
  })

  it('en el resto de los dominios NO se toca el local-part', async () => {
    // Fuera de Gmail `+etiqueta` no es necesariamente un alias: colapsarlo
    // rechazaría altas legítimas.
    expect(await canon('alguien+x@outlook.com')).toBe('alguien+x@outlook.com')
    expect(await canon('al.guien@empresa.com.ar')).toBe('al.guien@empresa.com.ar')
  })

  it('dos personas distintas de Gmail siguen siendo distintas', async () => {
    expect(await canon('fernando@gmail.com')).not.toBe(await canon('fer@gmail.com'))
  })
})

describe.runIf(process.env.DATABASE_URL)('hayCuentaEquivalente', () => {
  it('un dominio que no es Gmail ni consulta la base', async () => {
    expect(await hayCuentaEquivalente('alguien+x@outlook.com')).toBe(false)
  })

  it('un Gmail que nadie usó todavía no colisiona con nadie', async () => {
    expect(await hayCuentaEquivalente('nadie.tiene.este.mail.sec21@gmail.com')).toBe(false)
  })
})
