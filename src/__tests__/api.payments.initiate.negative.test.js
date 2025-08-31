import { describe, it, expect, vi, beforeEach } from 'vitest'
import handler from '@/pages/api/payments/initiate'

vi.mock('@/lib/db', () => ({
  createPendingPayment: vi.fn(async (payload) => ({ id: 'pay-1', ...payload })),
  updatePaymentTrackingId: vi.fn(async () => {}),
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

describe('API /api/payments/initiate negative paths', () => {
  beforeEach(() => {
    process.env.PESAPAL_IPN_IDS = 'ipn-123'
    process.env.NEXT_PUBLIC_APP_BASE_URL = 'http://localhost:3000'
    process.env.PESAPAL_CONSUMER_KEY = 'key'
    process.env.PESAPAL_CONSUMER_SECRET = 'secret'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc'
    process.env.PESAPAL_API_BASE_URL = 'https://pesapal.test'
  })

  it('rejects non-POST', async () => {
    const { req, res, get } = createReqRes({}, 'GET')
    await handler(req, res)
    const out = get()
    expect(out.statusCode).toBe(405)
  })

  it('returns 500 when essential env vars missing', async () => {
    process.env.PESAPAL_IPN_IDS = ''
    // Force module to re-read env by resetting modules and re-importing
    await vi.resetModules()
    const mod = await import('@/pages/api/payments/initiate')
    const freshHandler = mod.default

    const { req, res, get } = createReqRes({ amount: 1000, currency: 'UGX', description: 'x', billing_address: { email_address: 'a@b.com' }, items: [{ _id: 'p1', quantity: 1 }] })
    await freshHandler(req, res)
    const out = get()
    expect(out.statusCode).toBe(500)
    expect(out.json.message).toMatch(/Server configuration error/i)
  })

  it('validates amount', async () => {
    const base = { currency: 'UGX', description: 'x', billing_address: { email_address: 'a@b.com' }, items: [{ _id: 'p1', quantity: 1 }] }
    const { req, res, get } = createReqRes({ ...base, amount: 0 })
    await handler(req, res)
    const out = get()
    expect(out.statusCode).toBe(400)
  })

  it('validates currency code', async () => {
    const base = { amount: 1000, description: 'x', billing_address: { email_address: 'a@b.com' }, items: [{ _id: 'p1', quantity: 1 }] }
    const { req, res, get } = createReqRes({ ...base, currency: 'UG' })
    await handler(req, res)
    const out = get()
    expect(out.statusCode).toBe(400)
  })

  it('validates description', async () => {
    const base = { amount: 1000, currency: 'UGX', billing_address: { email_address: 'a@b.com' }, items: [{ _id: 'p1', quantity: 1 }] }
    const { req, res, get } = createReqRes({ ...base })
    await handler(req, res)
    const out = get()
    expect(out.statusCode).toBe(400)
  })

  it('requires at least email or phone in billing_address', async () => {
    const base = { amount: 1000, currency: 'UGX', description: 'x', billing_address: { first_name: 'J' }, items: [{ _id: 'p1', quantity: 1 }] }
    const { req, res, get } = createReqRes({ ...base })
    await handler(req, res)
    const out = get()
    expect(out.statusCode).toBe(400)
  })

  it('validates items presence', async () => {
    const base = { amount: 1000, currency: 'UGX', description: 'x', billing_address: { email_address: 'a@b.com' } }
    const { req, res, get } = createReqRes({ ...base, items: [] })
    await handler(req, res)
    const out = get()
    expect(out.statusCode).toBe(400)
  })
})
