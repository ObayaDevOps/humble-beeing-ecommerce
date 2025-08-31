import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/clients/pesapal', () => ({
  getPesapalTransactionStatus: vi.fn(async () => ({
    status: '200',
    status_code: 1,
    payment_status_description: 'COMPLETED',
    description: 'Payment completed',
    amount: 1000,
    payment_method: 'CARD',
    confirmation_code: 'CONF-777',
  }))
}))

vi.mock('@/lib/db', () => ({
  getPaymentByTrackingId: vi.fn(async () => null),
  updatePaymentStatus: vi.fn(async () => ({ id: 'pay-1', status: 'COMPLETED' })),
  markEventProcessed: vi.fn(async () => ({ ok: true, processed: true })),
}))

let processIPN, verifyPayment

describe('PaymentService idempotency', () => {
beforeEach(async () => {
  vi.clearAllMocks()
  const mod = await import('@/server/services/payments')
  processIPN = mod.processIPN
  verifyPayment = mod.verifyPayment
})

  it('does not reprocess IPN when payment is already terminal', async () => {
    const db = await import('@/lib/db')
    // First IPN: no existing -> process
    db.getPaymentByTrackingId
      .mockResolvedValueOnce(null)
      // Second IPN: already terminal -> skip
      .mockResolvedValueOnce({ id: 'pay-1', status: 'COMPLETED' })
    await processIPN({ OrderTrackingId: 'TRACK-IDE', OrderMerchantReference: 'M1', OrderNotificationType: 'IPN' }, { info: () => {}, warn: () => {}, error: () => {} })
    await processIPN({ OrderTrackingId: 'TRACK-IDE', OrderMerchantReference: 'M1', OrderNotificationType: 'IPN' }, { info: () => {}, warn: () => {}, error: () => {} })
    expect(db.updatePaymentStatus).toHaveBeenCalledTimes(1)
  })

  it('verify can be called repeatedly and remains idempotent at order level', async () => {
    const pesapal = await import('@/server/clients/pesapal')
    const db = await import('@/lib/db')
    await verifyPayment('TRACK-VER', { info: () => {}, error: () => {}, warn: () => {}, debug: () => {} })
    await verifyPayment('TRACK-VER', { info: () => {}, error: () => {}, warn: () => {}, debug: () => {} })
    expect(pesapal.getPesapalTransactionStatus).toHaveBeenCalledTimes(2)
    expect(db.updatePaymentStatus).toHaveBeenCalledTimes(2)
  })
})
