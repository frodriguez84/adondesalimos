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

  /** Un `ts` cualquiera y el reloj puesto en ese mismo instante (ver `SEC-18`). */
  const TS = '1742505638683'
  const AHORA = Number(TS)

  it('acepta una firma válida', () => {
    process.env.MP_WEBHOOK_SECRET = SECRET
    const dataId = 'ABC-123'
    const xRequestId = 'req-9'
    expect(
      validateWebhookSignature({
        xSignature: firmar(dataId, xRequestId, TS),
        xRequestId,
        dataId,
        ahora: AHORA,
      }),
    ).toBe(true)
  })

  it('rechaza una firma corrupta', () => {
    process.env.MP_WEBHOOK_SECRET = SECRET
    expect(
      validateWebhookSignature({
        xSignature: `ts=${TS},v1=deadbeef`,
        xRequestId: 'req-9',
        dataId: 'ABC-123',
        ahora: AHORA,
      }),
    ).toBe(false)
  })

  it('rechaza firma ausente', () => {
    process.env.MP_WEBHOOK_SECRET = SECRET
    expect(validateWebhookSignature({ xSignature: null, xRequestId: 'r', dataId: 'x' })).toBe(false)
  })

  it('rechaza si no hay secreto configurado', () => {
    delete process.env.MP_WEBHOOK_SECRET
    expect(
      validateWebhookSignature({
        xSignature: firmar('x', 'r', TS),
        xRequestId: 'r',
        dataId: 'x',
        ahora: AHORA,
      }),
    ).toBe(false)
  })

  describe('ventana temporal del `ts` (`SEC-18`)', () => {
    const valida = (ahora: number) =>
      validateWebhookSignature({
        xSignature: firmar('ABC-123', 'req-9', TS),
        xRequestId: 'req-9',
        dataId: 'ABC-123',
        ahora,
      })

    it('una firma legítima capturada NO sirve una hora después', () => {
      process.env.MP_WEBHOOK_SECRET = SECRET
      expect(valida(AHORA + 60 * 60_000)).toBe(false)
    })

    it('dentro de los 5 minutos entra, y tolera el desfase de reloj hacia atrás', () => {
      process.env.MP_WEBHOOK_SECRET = SECRET
      expect(valida(AHORA + 4 * 60_000)).toBe(true)
      expect(valida(AHORA - 4 * 60_000)).toBe(true)
      expect(valida(AHORA + 6 * 60_000)).toBe(false)
    })

    it('un `ts` en segundos también entra: MP lo documenta de las dos formas', () => {
      process.env.MP_WEBHOOK_SECRET = SECRET
      const tsSeg = '1742505638'
      expect(
        validateWebhookSignature({
          xSignature: firmar('x', 'r', tsSeg),
          xRequestId: 'r',
          dataId: 'x',
          ahora: 1742505638 * 1000,
        }),
      ).toBe(true)
    })

    it('un `ts` que no es número se rechaza', () => {
      process.env.MP_WEBHOOK_SECRET = SECRET
      expect(
        validateWebhookSignature({
          xSignature: firmar('x', 'r', 'ayer'),
          xRequestId: 'r',
          dataId: 'x',
          ahora: AHORA,
        }),
      ).toBe(false)
    })
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
