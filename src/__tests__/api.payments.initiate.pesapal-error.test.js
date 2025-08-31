import { describe, it, expect, vi, beforeEach } from 'vitest'
import { server } from '../../test/msw/server'
import { http, HttpResponse } from 'msw'
import handler from '@/pages/api/payments/initiate'

vi.mock('@/lib/db', () => ({
  createPendingPayment: vi.fn(async (payload) => ({ id: 'pay-1', ...payload })),
  updatePaymentTrackingId: vi.fn(async () => {}),
}))

const { updatePaymentTrackingId } = await import('@/lib/db')

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

describe('API /api/payments/initiate Pesapal error handling', () => {
  beforeEach(() => {
    process.env.PESAPAL_IPN_IDS = 'ipn-123'
    process.env.NEXT_PUBLIC_APP_BASE_URL = 'http://localhost:3000'
    process.env.PESAPAL_CONSUMER_KEY = 'key'
    process.env.PESAPAL_CONSUMER_SECRET = 'secret'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc'
    process.env.PESAPAL_API_BASE_URL = 'https://pesapal.test'
  })

  it('returns 500 and does not update tracking when Pesapal returns error object', async () => {
    // Override MSW for SubmitOrderRequest to return an error object
    server.use(
      http.post('https://pesapal.test/Transactions/SubmitOrderRequest', async () => {
        return HttpResponse.json({ error: { code: '400', message: 'Bad request' } }, { status: 200 })
      })
    )

    const { req, res, get } = createReqRes({
      amount: 1000,
      currency: 'UGX',
      description: 'Test order',
      billing_address: { email_address: 'a@b.com' },
      items: [{ _id: 'p1', quantity: 1, price: 1000 }],
    })

    await handler(req, res)
    const out = get()
    expect(out.statusCode).toBe(500)
    expect(out.json.message).toMatch(/Bad request|Pesapal rejected/i)
    expect(updatePaymentTrackingId).not.toHaveBeenCalled()
  })
})

