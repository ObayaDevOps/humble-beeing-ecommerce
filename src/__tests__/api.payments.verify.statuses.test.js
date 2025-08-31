import { describe, it, expect, vi, beforeEach } from 'vitest'
import { server } from '../../test/msw/server'
import { http, HttpResponse } from 'msw'
import handler from '@/pages/api/payments/verify'

vi.mock('@/lib/db', () => ({
  updatePaymentStatus: vi.fn(async (tid, status, code, desc) => ({ id: 'pay-1', status, pesapal_status_description: desc, amount: 1000, currency: 'UGX', cart_items: [], delivery_address: {}, customer_email: 'a@b.com', customer_phone: '+256...' })),
  findOrderExistsByPaymentId: vi.fn(async () => null),
  createOrderAndItems: vi.fn(async () => ({ data: { id: 'order-1' } })),
}))

const { updatePaymentStatus, findOrderExistsByPaymentId, createOrderAndItems } = await import('@/lib/db')

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

describe('API /api/payments/verify status mapping and idempotency', () => {
  beforeEach(() => {
    process.env.PESAPAL_API_BASE_URL = 'https://pesapal.test'
  })

  it('maps FAILED status (status_code 2) and still returns 200 response with updated status', async () => {
    server.use(
      http.get('https://pesapal.test/Transactions/GetTransactionStatus', () => {
        return HttpResponse.json({
          status: '200',
          status_code: 2,
          payment_status_description: 'FAILED',
          description: 'Payment failed',
          amount: 1000,
          payment_method: 'CARD',
          confirmation_code: 'CONF-000',
        })
      })
    )

    const { req, res, get } = createReqRes({ orderTrackingId: 'TRACK-XYZ' })
    await handler(req, res)
    const out = get()
    expect(out.statusCode).toBe(200)
    expect(updatePaymentStatus).toHaveBeenCalledWith('TRACK-XYZ', 'FAILED', 'CARD', 'Payment failed')
    expect(out.json.status).toBe('FAILED')
  })

  it('skips order creation if an order already exists (idempotency)', async () => {
    // Override to signal existing order
    findOrderExistsByPaymentId.mockResolvedValueOnce({ id: 'order-existing' })
    server.use(
      http.get('https://pesapal.test/Transactions/GetTransactionStatus', () => {
        return HttpResponse.json({
          status: '200',
          status_code: 1,
          payment_status_description: 'COMPLETED',
          description: 'Payment completed',
          amount: 1000,
          payment_method: 'CARD',
          confirmation_code: 'CONF-789',
        })
      })
    )

    const { req, res, get } = createReqRes({ orderTrackingId: 'TRACK-123' })
    await handler(req, res)
    const out = get()
    expect(out.statusCode).toBe(200)
    expect(createOrderAndItems).not.toHaveBeenCalled()
  })

  it('maps REVERSED status (status_code 3) correctly', async () => {
    server.use(
      http.get('https://pesapal.test/Transactions/GetTransactionStatus', () => {
        return HttpResponse.json({
          status: '200',
          status_code: 3,
          payment_status_description: 'REVERSED',
          description: 'Payment reversed',
          amount: 1000,
          payment_method: 'CARD',
          confirmation_code: 'CONF-111',
        })
      })
    )

    const { req, res, get } = createReqRes({ orderTrackingId: 'TRACK-R' })
    await handler(req, res)
    const out = get()
    expect(out.statusCode).toBe(200)
    expect(updatePaymentStatus).toHaveBeenCalledWith('TRACK-R', 'REVERSED', 'CARD', 'Payment reversed')
    expect(out.json.status).toBe('REVERSED')
  })

  it('maps default/unknown status to PENDING', async () => {
    server.use(
      http.get('https://pesapal.test/Transactions/GetTransactionStatus', () => {
        return HttpResponse.json({
          status: '200',
          status_code: 99,
          payment_status_description: 'UNKNOWN',
          description: 'Unknown',
          amount: 1000,
          payment_method: 'CARD',
          confirmation_code: 'CONF-222',
        })
      })
    )

    const { req, res, get } = createReqRes({ orderTrackingId: 'TRACK-P' })
    await handler(req, res)
    const out = get()
    expect(out.statusCode).toBe(200)
    expect(updatePaymentStatus).toHaveBeenCalledWith('TRACK-P', 'PENDING', 'CARD', 'Unknown')
    expect(out.json.status).toBe('PENDING')
  })

  it('returns 404 when DB update returns null record', async () => {
    // Force updatePaymentStatus to return null once
    updatePaymentStatus.mockResolvedValueOnce(null)
    server.use(
      http.get('https://pesapal.test/Transactions/GetTransactionStatus', () => {
        return HttpResponse.json({
          status: '200',
          status_code: 1,
          payment_status_description: 'COMPLETED',
          description: 'Done',
          amount: 1000,
          payment_method: 'CARD',
          confirmation_code: 'CONF-333',
        })
      })
    )

    const { req, res, get } = createReqRes({ orderTrackingId: 'TRACK-404' })
    await handler(req, res)
    const out = get()
    expect(out.statusCode).toBe(404)
    expect(out.json.status).toBe('COMPLETED')
  })

  it('keeps 200 when order creation fails after COMPLETED', async () => {
    // No existing order, but creation fails
    findOrderExistsByPaymentId.mockResolvedValueOnce(null)
    createOrderAndItems.mockResolvedValueOnce({ data: null, error: { message: 'insert failed' } })
    server.use(
      http.get('https://pesapal.test/Transactions/GetTransactionStatus', () => {
        return HttpResponse.json({
          status: '200',
          status_code: 1,
          payment_status_description: 'COMPLETED',
          description: 'Ok',
          amount: 1000,
          payment_method: 'CARD',
          confirmation_code: 'CONF-444',
        })
      })
    )

    const { req, res, get } = createReqRes({ orderTrackingId: 'TRACK-OCF' })
    await handler(req, res)
    const out = get()
    expect(out.statusCode).toBe(200)
    expect(out.json.status).toBe('COMPLETED')
  })
})
