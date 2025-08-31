import { describe, it, expect, vi, beforeEach } from 'vitest'
import handler from '@/pages/api/payments/initiate'

// Mock DB helpers to avoid real Supabase
vi.mock('@/lib/db', () => ({
  createPendingPayment: vi.fn(async ({ merchant_reference }) => ({ id: 'pay-1', merchant_reference })),
  updatePaymentTrackingId: vi.fn(async () => {}),
}))

// Helper to build mock req/res
const createReqRes = (body = {}, method = 'POST') => {
  const req = { method, body, headers: {}, query: {} }
  let statusCode = 200
  let jsonPayload
  const res = {
    setHeader: () => {},
    status: (code) => {
      statusCode = code
      return res
    },
    json: (p) => { jsonPayload = p; return res },
  }
  return { req, res, get: () => ({ statusCode, json: jsonPayload }) }
}

describe('API /api/payments/initiate', () => {
  beforeEach(() => {
    process.env.PESAPAL_IPN_IDS = 'ipn-123'
    process.env.NEXT_PUBLIC_APP_BASE_URL = 'http://localhost:3000'
    process.env.PESAPAL_CONSUMER_KEY = 'x'
    process.env.PESAPAL_CONSUMER_SECRET = 'y'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'z'
    process.env.PESAPAL_API_BASE_URL = 'https://pesapal.test'
  })

  it('returns redirectUrl on success', async () => {
    const { req, res, get } = createReqRes({
      amount: 1000,
      currency: 'UGX',
      description: 'Test order',
      billing_address: { email_address: 'a@b.com', phone_number: '+256123456789' },
      items: [{ _id: 'p1', quantity: 1, price: 1000 }],
    })

    await handler(req, res)
    const result = get()
    expect(result.statusCode).toBe(200)
    expect(result.json.redirectUrl).toMatch(/http/)
  })

  it('validates bad method', async () => {
    const { req, res, get } = createReqRes({}, 'GET')
    await handler(req, res)
    const out = get()
    expect(out.statusCode).toBe(405)
  })
})
