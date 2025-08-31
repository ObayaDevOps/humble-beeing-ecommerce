import { describe, it, expect, vi, beforeEach } from 'vitest'
import handler from '@/pages/api/payments/verify'

vi.mock('@/lib/db', () => ({
  updatePaymentStatus: vi.fn(async () => ({ id: 'pay-1', status: 'PENDING', pesapal_status_description: 'Pending', amount: 1000, currency: 'UGX', cart_items: [], delivery_address: {}, customer_email: 'a@b.com', customer_phone: '+256...' })),
  findOrderExistsByPaymentId: vi.fn(async () => ({ id: 'order-1' })),
  createOrderAndItemsAtomic: vi.fn(async () => ({ data: { id: 'order-1' } })),
  markEventProcessed: vi.fn(async () => ({ ok: true, processed: true })),
}))

const createReqRes = (body = {}, method = 'POST') => {
  const req = { method, body, headers: {}, query: {} }
  let statusCode = 200
  let jsonPayload
  const res = {
    setHeader: () => {},
    status: (code) => { statusCode = code; return res },
    json: (p) => { jsonPayload = p; return res },
  }
  return { req, res, get: () => ({ statusCode, json: jsonPayload }) }
}

describe('API /api/payments/verify negative paths', () => {
  beforeEach(() => {
    process.env.PESAPAL_API_BASE_URL = 'https://pesapal.test'
  })

  it('rejects non-POST', async () => {
    const { req, res, get } = createReqRes({}, 'GET')
    await handler(req, res)
    const out = get()
    expect(out.statusCode).toBe(405)
  })

  it('validates missing orderTrackingId', async () => {
    const { req, res, get } = createReqRes({})
    await handler(req, res)
    const out = get()
    expect(out.statusCode).toBe(400)
  })

  it('maps Pesapal error object to 502', async () => {
    const { req, res, get } = createReqRes({ orderTrackingId: 'TRACK-FAILED' })
    await handler(req, res)
    const out = get()
    expect(out.statusCode).toBe(502)
    expect(out.json).toHaveProperty('pesapal_error_code')
  })
})
