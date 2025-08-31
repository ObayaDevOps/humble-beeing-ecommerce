import { describe, it, expect, vi } from 'vitest'

vi.mock('@/server/clients/pesapal', () => ({
  getPesapalTransactionStatus: vi.fn()
}))

vi.mock('@/lib/db', () => ({
  getPaymentByTrackingId: vi.fn(async () => null),
  updatePaymentStatus: vi.fn(async () => ({ id: 'pay-1', status: 'PENDING' })),
  markEventProcessed: vi.fn(async () => ({ ok: true, processed: true })),
}))

describe('PaymentService retry behavior', () => {
  it('retries transient failure once for IPN status fetch', async () => {
    const { processIPN } = await import('@/server/services/payments')
    const pesapal = await import('@/server/clients/pesapal')

    pesapal.getPesapalTransactionStatus
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ status_code: 2, payment_status_description: 'FAILED', confirmation_code: 'C', payment_method: 'CARD' })

    await processIPN({ OrderTrackingId: 'RTY', OrderMerchantReference: 'M', OrderNotificationType: 'IPN' }, { info: () => {}, warn: () => {}, error: () => {} })
    expect(pesapal.getPesapalTransactionStatus).toHaveBeenCalledTimes(2)
  })
})

