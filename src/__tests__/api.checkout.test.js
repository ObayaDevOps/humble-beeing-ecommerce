import { describe, it, expect, vi, beforeEach } from 'vitest'

// Will assign per-test behavior
let rpcMock

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    rpc: (...args) => rpcMock(...args),
  })
}))

// Import after mocks
import handler from '@/pages/api/checkout'

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

describe('API /api/checkout (stock check)', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supabase.local'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'key'
  })

  it('rejects non-POST', async () => {
    const { req, res, get } = createReqRes({}, 'GET')
    await handler(req, res)
    const out = get()
    expect(out.statusCode).toBe(405)
  })

  it('validates empty cart', async () => {
    const { req, res, get } = createReqRes({ items: [] })
    await handler(req, res)
    const out = get()
    expect(out.statusCode).toBe(400)
    expect(out.json.message).toMatch(/Invalid or empty cart/)
  })

  it('returns 409 when insufficient stock on any item', async () => {
    const items = [
      { productId: 'a', requestedQuantity: 1 },
      { productId: 'b', requestedQuantity: 2 },
    ]
    // Simulate first succeeds, second fails with insufficient stock
    rpcMock = vi.fn()
      .mockResolvedValueOnce({ data: 9, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'Insufficient stock' } })

    const { req, res, get } = createReqRes({ items })
    await handler(req, res)
    const out = get()
    expect(rpcMock).toHaveBeenCalledWith('decrement_stock', { p_id: 'a', amount: 1 })
    expect(rpcMock).toHaveBeenCalledWith('decrement_stock', { p_id: 'b', amount: 2 })
    expect(out.statusCode).toBe(409)
    expect(out.json.error).toBe('INSUFFICIENT_STOCK')
    expect(out.json.productId).toBe('b')
  })

  it('returns 404 when product not found in inventory', async () => {
    const items = [{ productId: 'x', requestedQuantity: 1 }]
    rpcMock = vi.fn().mockResolvedValueOnce({ data: null, error: { message: 'not found in inventory' } })

    const { req, res, get } = createReqRes({ items })
    await handler(req, res)
    const out = get()
    expect(out.statusCode).toBe(404)
    expect(out.json.error).toBe('PRODUCT_NOT_FOUND')
    expect(out.json.productId).toBe('x')
  })

  it('succeeds when all decrements succeed', async () => {
    const items = [
      { productId: 'p1', requestedQuantity: 1 },
      { productId: 'p2', requestedQuantity: 3 },
    ]
    rpcMock = vi.fn()
      .mockResolvedValueOnce({ data: 4, error: null })
      .mockResolvedValueOnce({ data: 7, error: null })

    const { req, res, get } = createReqRes({ items })
    await handler(req, res)
    const out = get()
    expect(out.statusCode).toBe(200)
    expect(out.json.success).toBe(true)
  })

  it('returns 500 on unexpected DB error', async () => {
    const items = [{ productId: 'p1', requestedQuantity: 1 }]
    rpcMock = vi.fn().mockResolvedValueOnce({ data: null, error: { message: 'connection refused' } })

    const { req, res, get } = createReqRes({ items })
    await handler(req, res)
    const out = get()
    expect(out.statusCode).toBe(500)
    expect(out.json.message).toMatch(/Database error/)
  })
})

