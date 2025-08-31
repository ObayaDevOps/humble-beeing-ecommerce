import { http, HttpResponse } from 'msw'

// Use env base URL (set in setup) for Pesapal mocks
const PESAPAL = process.env.PESAPAL_API_BASE_URL || 'https://pesapal.test'

export const handlers = [
  // Pesapal token
  http.post(`${PESAPAL}/Auth/RequestToken`, async () => {
    return HttpResponse.json({ token: 'pesapal-test-token' }, { status: 200 })
  }),

  // Pesapal SubmitOrderRequest
  http.post(`${PESAPAL}/Transactions/SubmitOrderRequest`, async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json(
      {
        order_tracking_id: 'TRACK-123',
        merchant_reference: body?.id || 'ORDER-TEST',
        redirect_url: 'https://pay.pesapal.test/redirect/abc',
      },
      { status: 200 }
    )
  }),

  // Pesapal GetTransactionStatus
  http.get(`${PESAPAL}/Transactions/GetTransactionStatus`, ({ request }) => {
    const url = new URL(request.url)
    const orderTrackingId = url.searchParams.get('orderTrackingId')
    if (orderTrackingId === 'TRACK-FAILED') {
      return HttpResponse.json(
        { error: { code: '400', message: 'Invalid tracking' } },
        { status: 200 }
      )
    }
    return HttpResponse.json(
      {
        status: '200',
        status_code: 1, // COMPLETED
        payment_status_description: 'COMPLETED',
        description: 'Payment completed',
        amount: 1000,
        payment_method: 'CARD',
        confirmation_code: 'CONF-789',
      },
      { status: 200 }
    )
  }),

  // --- App API mocks for component tests ---
  http.post('/api/checkout', async () => {
    return HttpResponse.json({ success: true, orderId: 'ORDER_123', paymentIntentId: 'pi_test_123' }, { status: 200 })
  }),
  http.post('/api/payments/initiate', async () => {
    return HttpResponse.json({ redirectUrl: 'https://pay.pesapal.test/redirect/abc' }, { status: 200 })
  }),
  http.post('/api/payments/verify', async () => {
    return HttpResponse.json({
      status: 'COMPLETED',
      statusDescription: 'Payment completed',
      confirmationCode: 'CONF-789',
      orderDetails: {
        merchantReference: 'ORDER-xyz',
        totalAmount: 1000,
        currency: 'UGX',
        items: [{ _id: 'p1', name: 'Item', price: 1000, quantity: 1 }],
        delivery_address: { email_address: 'a@b.com', phone_number: '+256...' },
        deliveryLocation: { latitude: 0.3, longitude: 32.5 },
      }
    }, { status: 200 })
  }),
  http.post('/api/notify-shopkeeper-order-confirmation', async () => HttpResponse.json({ message: 'ok' }, { status: 200 })),
  http.post('/api/notify-customer-order-confirmation', async () => HttpResponse.json({ message: 'ok' }, { status: 200 })),
  http.post('/api/whatsapp/send-order-confirmation', async () => HttpResponse.json({ message: 'ok' }, { status: 200 })),

  // Admin analytics endpoints
  http.get('/api/analytics/overview', async () => HttpResponse.json({
    currency: 'UGX',
    totalSales: 500000,
    totalOrders: 42,
    averageOrderValue: 11904.76,
    totalItemsSold: 120,
    salesTrend: [ { day: '2025-01-01', sales: 10000 } ],
    ordersTrend: [ { day: '2025-01-01', orders: 2 } ],
  })),
  http.get('/api/analytics/recent-orders', ({ request }) => {
    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page') || '1')
    const orders = Array.from({ length: 3 }).map((_, i) => ({
      id: `order-${page}-${i}`,
      created_at: new Date().toISOString(),
      status: 'COMPLETED',
      customer_email: 'john@example.com',
      total_amount: 1000 + i,
      currency: 'UGX',
    }))
    return HttpResponse.json({ orders, pagination: { currentPage: page, totalPages: 2, totalOrders: 6, perPage: 15 } })
  }),
  http.get('/api/orders/:orderId', ({ params }) => {
    const { orderId } = params
    return HttpResponse.json({
      id: orderId,
      created_at: new Date().toISOString(),
      status: 'COMPLETED',
      customer_email: 'john@example.com',
      customer_phone: '+256...',
      total_amount: 2000,
      currency: 'UGX',
      shipping_address: { address: 'Test', latitude: 0.3, longitude: 32.5 },
      items: [ { product_id: 'p1', product_name: 'Item 1', quantity: 2, unit_price_at_purchase: 1000, total_item_price: 2000 } ],
    })
  }),
]
