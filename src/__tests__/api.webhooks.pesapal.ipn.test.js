import { describe, it, expect, vi } from 'vitest'
import handler from '@/pages/api/webhooks/pesapal/ipn'

vi.mock('@/lib/db', () => ({
  getPaymentByTrackingId: vi.fn(async () => ({ id: 'pay-1', status: 'PENDING' })),
  updatePaymentStatus: vi.fn(async () => ({ id: 'pay-1', status: 'COMPLETED' })),
}))

vi.mock('@/lib/pesapal', () => ({
  getPesapalToken: vi.fn(async () => 'token')
}))

// Mock axios.get to return a normal status response for the async side
vi.mock('axios', () => ({
  default: {
    get: vi.fn(async () => ({ data: { status: '200', status_code: 1, payment_status_description: 'COMPLETED', confirmation_code: 'CONF', payment_method: 'CARD' } }))
  }
}))

const createReqRes = (query = {}, method = 'GET') => {
  const req = { method, query, headers: {} }
  let statusCode = 200
  let jsonPayload
  const res = {
    setHeader: () => {},
    status: (code) => { statusCode = code; return res },
    json: (p) => { jsonPayload = p; return res },
  }
  return { req, res, get: () => ({ statusCode, json: jsonPayload }) }
}

describe('API /api/webhooks/pesapal/ipn basic behavior', () => {
  it('ACKs with 200 even when missing params', async () => {
    const { req, res, get } = createReqRes({})
    await handler(req, res)
    const out = get()
    expect(out.statusCode).toBe(200)
    expect(out.json.status).toBe(500) // signals processing issue in payload
  })

  it('ACKs with 200 and echoes params when provided', async () => {
    const query = { OrderTrackingId: 'T1', OrderMerchantReference: 'M1', OrderNotificationType: 'IPN' }
    const { req, res, get } = createReqRes(query)
    await handler(req, res)
    const out = get()
    expect(out.statusCode).toBe(200)
    expect(out.json.orderTrackingId).toBe('T1')
    expect(out.json.orderMerchantReference).toBe('M1')
  })
})

