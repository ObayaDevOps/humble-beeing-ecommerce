import { describe, it, expect, vi } from 'vitest'
import handler from '@/pages/api/admin/inventory/update'

vi.mock('@/lib/db', () => ({
  updateInventoryItem: vi.fn(async (sanityId, updates) => ({ data: { id: sanityId, ...updates }, error: null }))
}))

const { updateInventoryItem } = await import('@/lib/db')

const createReqRes = (body = {}, method = 'PUT') => {
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

describe('API /api/admin/inventory/update', () => {
  it('rejects non-PUT', async () => {
    const { req, res, get } = createReqRes({}, 'GET')
    await handler(req, res)
    const out = get()
    expect(out.statusCode).toBe(405)
  })

  it('validates missing sanityId', async () => {
    const { req, res, get } = createReqRes({ price: 1, quantity: 2, minStockLevel: 3 })
    await handler(req, res)
    const out = get()
    expect(out.statusCode).toBe(400)
  })

  it('validates missing fields', async () => {
    const { req, res, get } = createReqRes({ sanityId: 'p1', price: 1 })
    await handler(req, res)
    const out = get()
    expect(out.statusCode).toBe(400)
  })

  it('updates successfully', async () => {
    const body = { sanityId: 'p1', price: 100, quantity: 5, minStockLevel: 2 }
    const { req, res, get } = createReqRes(body)
    await handler(req, res)
    const out = get()
    expect(updateInventoryItem).toHaveBeenCalledWith('p1', { price: 100, quantity: 5, minStockLevel: 2 })
    expect(out.statusCode).toBe(200)
    expect(out.json.item.id).toBe('p1')
  })

  it('maps not found error to 404', async () => {
    updateInventoryItem.mockResolvedValueOnce({ data: null, error: { message: 'No rows found' } })
    const { req, res, get } = createReqRes({ sanityId: 'missing', price: 1, quantity: 1, minStockLevel: 0 })
    await handler(req, res)
    const out = get()
    expect(out.statusCode).toBe(404)
  })

  it('returns 500 on other DB errors', async () => {
    updateInventoryItem.mockResolvedValueOnce({ data: null, error: { message: 'db down' } })
    const { req, res, get } = createReqRes({ sanityId: 'p1', price: 1, quantity: 1, minStockLevel: 0 })
    await handler(req, res)
    const out = get()
    expect(out.statusCode).toBe(500)
  })
})

