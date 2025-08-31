import { describe, it, expect, vi, beforeEach } from 'vitest'

// No Supabase mutation expected in checkout anymore.
let rpcMock
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ rpc: (...args) => rpcMock?.(...args) }) }))

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

  it('does not call Supabase RPC and returns 200 (deferred stock handling)', async () => {
    const items = [
      { productId: 'a', requestedQuantity: 1 },
      { productId: 'b', requestedQuantity: 2 },
    ]
    rpcMock = vi.fn()

    const { req, res, get } = createReqRes({ items })
    await handler(req, res)
    const out = get()
    expect(rpcMock).not.toHaveBeenCalled()
    expect(out.statusCode).toBe(200)
    expect(out.json.success).toBe(true)
  })

  it('returns 200 for any items payload (no stock mutation here)', async () => {
    const items = [{ productId: 'x', requestedQuantity: 1 }]
    rpcMock = vi.fn()

    const { req, res, get } = createReqRes({ items })
    await handler(req, res)
    const out = get()
    expect(rpcMock).not.toHaveBeenCalled()
    expect(out.statusCode).toBe(200)
  })

  it('returns 200 success for normal flow', async () => {
    const items = [
      { productId: 'p1', requestedQuantity: 1 },
      { productId: 'p2', requestedQuantity: 3 },
    ]
    rpcMock = vi.fn()

    const { req, res, get } = createReqRes({ items })
    await handler(req, res)
    const out = get()
    expect(rpcMock).not.toHaveBeenCalled()
    expect(out.statusCode).toBe(200)
    expect(out.json.success).toBe(true)
  })

  it('no DB error paths exist anymore in checkout; returns 200', async () => {
    const items = [{ productId: 'p1', requestedQuantity: 1 }]
    rpcMock = vi.fn()

    const { req, res, get } = createReqRes({ items })
    await handler(req, res)
    const out = get()
    expect(rpcMock).not.toHaveBeenCalled()
    expect(out.statusCode).toBe(200)
  })
})
