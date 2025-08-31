import { describe, it, expect, vi, beforeEach } from 'vitest'
import handler from '@/pages/api/payments/verify'

vi.mock('@/lib/db', () => ({
  updatePaymentStatus: vi.fn(async (tid, status) => ({
    id: 'pay-1',
    status,
    pesapal_status_description: 'COMPLETED',
    pesapal_confirmation_code: 'CONF-789',
    merchant_reference: 'ORDER-xyz',
    amount: 1000,
    currency: 'UGX',
    cart_items: [{ _id: 'p1', quantity: 1, price: 1000 }],
    delivery_address: { email_address: 'a@b.com', phone_number: '+256...' },
    customer_email: 'a@b.com',
    customer_phone: '+256...'
  })),
  findOrderExistsByPaymentId: vi.fn(async () => null),
  createOrderAndItems: vi.fn(async () => ({ data: { id: 'order-1' } })),
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

describe('API /api/payments/verify', () => {
  beforeEach(() => {
    process.env.PESAPAL_API_BASE_URL = 'https://pesapal.test'
  })

  it('verifies completed payment and returns order details', async () => {
    const { req, res, get } = createReqRes({ orderTrackingId: 'TRACK-123' })
    await handler(req, res)
    const output = get()
    expect(output.statusCode).toBe(200)
    expect(output.json.status).toBeDefined()
    expect(output.json.orderDetails).toBeDefined()
  })

  it('rejects non-POST', async () => {
    const { req, res, get } = createReqRes({}, 'GET')
    await handler(req, res)
    const output = get()
    expect(output.statusCode).toBe(405)
  })
})
