import { describe, expect, it } from 'vitest'
import { emailEsAdmin } from '../admin'

/**
 * El gate de admin es una comparación de strings (decisión 8) y esa comparación
 * es toda la autorización del panel: si falla abierta, `/admin` queda público.
 */
describe('emailEsAdmin', () => {
  it('sin ADMIN_EMAIL configurado no hay admin, ni siquiera con email vacío', () => {
    expect(emailEsAdmin('cualquiera@x.com', undefined)).toBe(false)
    expect(emailEsAdmin('cualquiera@x.com', '')).toBe(false)
    expect(emailEsAdmin('cualquiera@x.com', '   ')).toBe(false)
    // El caso que rompería todo: dos vacíos que "coinciden".
    expect(emailEsAdmin('', '')).toBe(false)
    expect(emailEsAdmin(null, null)).toBe(false)
    expect(emailEsAdmin(undefined, undefined)).toBe(false)
  })

  it('compara sin distinguir mayúsculas ni espacios al borde', () => {
    expect(emailEsAdmin('Fer@Ejemplo.com', 'fer@ejemplo.com')).toBe(true)
    expect(emailEsAdmin('  fer@ejemplo.com  ', 'fer@ejemplo.com')).toBe(true)
    expect(emailEsAdmin('fer@ejemplo.com', '  FER@EJEMPLO.COM ')).toBe(true)
  })

  it('cualquier otro email no es admin', () => {
    expect(emailEsAdmin('otro@ejemplo.com', 'fer@ejemplo.com')).toBe(false)
    expect(emailEsAdmin('fer@ejemplo.com.ar', 'fer@ejemplo.com')).toBe(false)
    expect(emailEsAdmin(null, 'fer@ejemplo.com')).toBe(false)
  })
})
