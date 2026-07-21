import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { checkClaimsRateLimit, checkSearchRateLimit, consumirCupo, resetRateLimit } from '../rate-limit'
import { getClientIp, UNKNOWN_IP } from '../get-client-ip'

beforeEach(() => resetRateLimit())
afterEach(() => {
  delete process.env.TRUSTED_IP_HEADER
  delete process.env.DISABLE_RATE_LIMIT
})

describe('consumirCupo', () => {
  it('deja pasar hasta el máximo y después bloquea', () => {
    const ahora = 1_000_000
    for (let i = 0; i < 3; i++) {
      expect(consumirCupo('ip:x', ahora, 3).allowed).toBe(true)
    }
    expect(consumirCupo('ip:x', ahora, 3).allowed).toBe(false)
  })

  it('cuenta por clave: una IP no consume el cupo de otra', () => {
    const ahora = 1_000_000
    consumirCupo('ip:a', ahora, 1)
    expect(consumirCupo('ip:a', ahora, 1).allowed).toBe(false)
    expect(consumirCupo('ip:b', ahora, 1).allowed).toBe(true)
  })

  it('se reinicia al vencer la ventana', () => {
    const ahora = 1_000_000
    consumirCupo('ip:x', ahora, 1)
    expect(consumirCupo('ip:x', ahora, 1).allowed).toBe(false)
    expect(consumirCupo('ip:x', ahora + 61_000, 1).allowed).toBe(true)
  })
})

describe('getClientIp', () => {
  it('sin TRUSTED_IP_HEADER declarado ignora los headers (fail-closed)', () => {
    const req = new Request('http://x/', { headers: { 'x-forwarded-for': '1.2.3.4' } })
    expect(getClientIp(req)).toBe(UNKNOWN_IP)
  })

  it('con el header declarado lee la primera IP de la lista', () => {
    process.env.TRUSTED_IP_HEADER = 'x-real-ip'
    const req = new Request('http://x/', { headers: { 'x-real-ip': '1.2.3.4, 5.6.7.8' } })
    expect(getClientIp(req)).toBe('1.2.3.4')
  })
})

describe('checkSearchRateLimit', () => {
  it('bloquea con 429 al pasarse, e incluye Retry-After', () => {
    process.env.TRUSTED_IP_HEADER = 'x-real-ip'
    const req = new Request('http://x/api/search', { headers: { 'x-real-ip': '9.9.9.9' } })

    let bloqueo: Response | null = null
    for (let i = 0; i < 70 && !bloqueo; i++) bloqueo = checkSearchRateLimit(req)

    expect(bloqueo).not.toBeNull()
    expect(bloqueo!.status).toBe(429)
    expect(bloqueo!.headers.get('Retry-After')).toBeTruthy()
  })

  it('el cupo de claims es propio y no lo consume la búsqueda', () => {
    process.env.TRUSTED_IP_HEADER = 'x-real-ip'
    const headers = { 'x-real-ip': '8.8.8.8' }
    const busqueda = new Request('http://x/api/search', { headers })
    const claims = new Request('http://x/api/claims', { method: 'POST', headers })

    // Agotar la búsqueda no toca el cupo de reclamos.
    for (let i = 0; i < 70; i++) checkSearchRateLimit(busqueda)

    // Decisión 23: 3 por día. El cuarto se corta.
    for (let i = 0; i < 3; i++) expect(checkClaimsRateLimit(claims)).toBeNull()
    const bloqueo = checkClaimsRateLimit(claims)
    expect(bloqueo).not.toBeNull()
    expect(bloqueo!.status).toBe(429)
  })

  it('DISABLE_RATE_LIMIT lo apaga', () => {
    process.env.TRUSTED_IP_HEADER = 'x-real-ip'
    process.env.DISABLE_RATE_LIMIT = 'true'
    const req = new Request('http://x/api/search', { headers: { 'x-real-ip': '9.9.9.9' } })
    for (let i = 0; i < 100; i++) {
      expect(checkSearchRateLimit(req)).toBeNull()
    }
  })
})
