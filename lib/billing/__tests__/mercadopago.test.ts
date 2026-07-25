import crypto from 'crypto'
import { afterEach, describe, expect, it } from 'vitest'
import {
  buildWebhookSignatureManifest,
  preapprovalStatusToDb,
  validateWebhookSignature,
} from '@/lib/billing/mercadopago'
import { resolverFinDePeriodo, sumarUnMes } from '@/lib/billing/subscriptions'

/**
 * Tests puros (sin DB) de la lógica de MercadoPago portada (MONETIZACION F2):
 * firma del webhook (MONE-07), mapeo de estados y cálculo de período.
 */

const SECRET = 'test_webhook_secret_abc123'

function firmar(dataId: string | null, xRequestId: string | null, ts: string): string {
  const manifest = buildWebhookSignatureManifest(dataId, xRequestId, ts)
  const v1 = crypto.createHmac('sha256', SECRET).update(manifest).digest('hex')
  return `ts=${ts},v1=${v1}`
}

describe('validateWebhookSignature (decisión 16)', () => {
  const prev = process.env.MP_WEBHOOK_SECRET
  afterEach(() => {
    process.env.MP_WEBHOOK_SECRET = prev
  })

  it('acepta una firma válida', () => {
    process.env.MP_WEBHOOK_SECRET = SECRET
    const ts = '1742505638683'
    const dataId = 'ABC-123'
    const xRequestId = 'req-9'
    expect(
      validateWebhookSignature({
        xSignature: firmar(dataId, xRequestId, ts),
        xRequestId,
        dataId,
      }),
    ).toBe(true)
  })

  it('rechaza una firma corrupta', () => {
    process.env.MP_WEBHOOK_SECRET = SECRET
    const ts = '1742505638683'
    expect(
      validateWebhookSignature({
        xSignature: `ts=${ts},v1=deadbeef`,
        xRequestId: 'req-9',
        dataId: 'ABC-123',
      }),
    ).toBe(false)
  })

  it('rechaza firma ausente', () => {
    process.env.MP_WEBHOOK_SECRET = SECRET
    expect(validateWebhookSignature({ xSignature: null, xRequestId: 'r', dataId: 'x' })).toBe(false)
  })

  it('rechaza si no hay secreto configurado', () => {
    delete process.env.MP_WEBHOOK_SECRET
    const ts = '1742505638683'
    expect(
      validateWebhookSignature({ xSignature: firmar('x', 'r', ts), xRequestId: 'r', dataId: 'x' }),
    ).toBe(false)
  })

  it('el manifest usa el data.id en minúsculas', () => {
    expect(buildWebhookSignatureManifest('ABC', 'req-1', '123')).toBe(
      'id:abc;request-id:req-1;ts:123;',
    )
  })
})

describe('preapprovalStatusToDb (decisión 13)', () => {
  it('authorized → active', () => {
    expect(preapprovalStatusToDb('authorized')).toBe('active')
  })
  it('pending → past_due', () => {
    expect(preapprovalStatusToDb('pending')).toBe('past_due')
  })
  it('paused → canceled', () => {
    expect(preapprovalStatusToDb('paused')).toBe('canceled')
  })
  it('cancelled → canceled', () => {
    expect(preapprovalStatusToDb('cancelled')).toBe('canceled')
  })
})

describe('resolverFinDePeriodo (port de resolvePeriodEnd)', () => {
  it('sin next_payment_date, +1 mes', () => {
    const inicio = new Date('2026-01-15T10:00:00Z')
    expect(resolverFinDePeriodo(inicio).getTime()).toBe(sumarUnMes(inicio).getTime())
  })
  it('usa next_payment_date si es futuro respecto al inicio', () => {
    const inicio = new Date('2026-01-15T10:00:00Z')
    const next = '2026-02-20T10:00:00Z'
    expect(resolverFinDePeriodo(inicio, next).toISOString()).toBe(new Date(next).toISOString())
  })
  it('ignora una next_payment_date inválida', () => {
    const inicio = new Date('2026-01-15T10:00:00Z')
    expect(resolverFinDePeriodo(inicio, 'no-es-fecha').getTime()).toBe(sumarUnMes(inicio).getTime())
  })
  it('ignora una next_payment_date anterior al inicio', () => {
    const inicio = new Date('2026-01-15T10:00:00Z')
    expect(resolverFinDePeriodo(inicio, '2025-12-01T10:00:00Z').getTime()).toBe(
      sumarUnMes(inicio).getTime(),
    )
  })
})
