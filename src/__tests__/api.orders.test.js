import { describe, it, expect, vi } from 'vitest'
import handler from '@/pages/api/orders/[orderId]'

// Build a lightweight mock of Supabase client with chainable query builders
const makeClient = ({ order, items, orderError, itemsError }) => ({
  from: (table) => {
    if (table === 'orders') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: order, error: orderError || null })
          })
        })
      }
    }
    if (table === 'order_items') {
      return {
        select: () => ({
          eq: async () => ({ data: items, error: itemsError || null })
        })
      }
    }
    throw new Error('Unexpected table: ' + table)
  }
})

vi.mock('@/lib/supabaseClient', () => ({
  getServerSupabaseClient: vi.fn(() => makeClient({ order: null, items: [] }))
}))

const { getServerSupabaseClient } = await import('@/lib/supabaseClient')

const createReqRes = (query = {}, method = 'GET') => {
  const req = { method, query }
  let statusCode = 200
  let jsonPayload
  const res = {
    setHeader: () => {},
    status: (code) => { statusCode = code; return res },
    json: (p) => { jsonPayload = p; return res },
  }
  return { req, res, get: () => ({ statusCode, json: jsonPayload }) }
}

describe('API /api/orders/[orderId]', () => {
  it('rejects non-GET', async () => {
    const { req, res, get } = createReqRes({ orderId: 'o1' }, 'POST')
    await handler(req, res)
    const out = get()
    expect(out.statusCode).toBe(405)
  })

  it('validates missing orderId', async () => {
    const { req, res, get } = createReqRes({})
    await handler(req, res)
    const out = get()
    expect(out.statusCode).toBe(400)
  })

  it('returns 404 when order not found', async () => {
    getServerSupabaseClient.mockReturnValueOnce(makeClient({ order: null }))
    const { req, res, get } = createReqRes({ orderId: 'missing' })
    await handler(req, res)
    const out = get()
    expect(out.statusCode).toBe(404)
  })

  it('returns order with items when found', async () => {
    getServerSupabaseClient.mockReturnValueOnce(makeClient({
      order: { id: 'o1', status: 'COMPLETED', customer_email: 'john@example.com', total_amount: 2000, currency: 'UGX' },
      items: [ { product_id: 'p1', product_name: 'Item 1', quantity: 2, unit_price_at_purchase: 1000, total_item_price: 2000 } ],
    }))
    const { req, res, get } = createReqRes({ orderId: 'o1' })
    await handler(req, res)
    const out = get()
    expect(out.statusCode).toBe(200)
    expect(out.json.id).toBe('o1')
    expect(out.json.items).toHaveLength(1)
  })

  it('returns 500 when orders query errors', async () => {
    const orderError = new Error('orders table down')
    getServerSupabaseClient.mockReturnValueOnce(makeClient({ order: null, items: [], orderError }))
    const { req, res, get } = createReqRes({ orderId: 'o1' })
    await handler(req, res)
    const out = get()
    expect(out.statusCode).toBe(500)
    expect(out.json.message).toMatch(/Internal Server Error/i)
  })

  it('returns 500 when items query errors', async () => {
    const itemsError = new Error('order_items table down')
    getServerSupabaseClient.mockReturnValueOnce(makeClient({
      order: { id: 'o1', status: 'COMPLETED', customer_email: 'john@example.com', total_amount: 2000, currency: 'UGX' },
      items: [],
      itemsError,
    }))
    const { req, res, get } = createReqRes({ orderId: 'o1' })
    await handler(req, res)
    const out = get()
    expect(out.statusCode).toBe(500)
    expect(out.json.message).toMatch(/Internal Server Error/i)
  })
})
