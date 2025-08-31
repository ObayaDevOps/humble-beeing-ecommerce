import { describe, it, expect, beforeEach, vi } from 'vitest'
import { server } from '../../test/msw/server'
import { http } from 'msw'

vi.mock('@/lib/db', () => ({
  updatePaymentStatus: vi.fn(async (tid, status, code, desc) => ({ id: 'pay-1', status, pesapal_status_description: desc, amount: 1000, currency: 'UGX', cart_items: [], delivery_address: {}, customer_email: 'a@b.com', customer_phone: '+256...' })),
  findOrderExistsByPaymentId: vi.fn(async () => null),
  createOrderAndItems: vi.fn(async () => ({ data: { id: 'order-1' } })),
}))

let handler

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

describe('API /api/payments/verify transport error behavior', () => {
  beforeEach(() => {
    process.env.PESAPAL_API_BASE_URL = 'https://pesapal.test'
    // Import handler after mocks are in place
    return import('@/pages/api/payments/verify').then(mod => { handler = mod.default })
  })

  it('returns 500 on network error to Pesapal (transport failure)', async () => {
    // Simulate a network error from MSW to emulate timeout/transport failure
    server.use(
      http.get('https://pesapal.test/Transactions/GetTransactionStatus', () => {
        return new Promise((_, reject) => reject(new Error('network error')))
      })
    )

    const { req, res, get } = createReqRes({ orderTrackingId: 'TRACK-NETERR' })
    await handler(req, res)
    const out = get()
    expect(out.statusCode).toBe(502)
    expect(out.json.message).toBeDefined()
  })
})
