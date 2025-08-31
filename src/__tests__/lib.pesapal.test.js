import { describe, it, expect, beforeEach } from 'vitest'
import { getPesapalToken, submitPesapalOrder, getPesapalTransactionStatus } from '@/lib/pesapal'

beforeEach(() => {
  process.env.PESAPAL_API_BASE_URL = 'https://pesapal.test'
  process.env.PESAPAL_CONSUMER_KEY = 'key'
  process.env.PESAPAL_CONSUMER_SECRET = 'secret'
})

describe('lib/pesapal', () => {
  it('fetches token', async () => {
    const token = await getPesapalToken()
    expect(token).toBe('pesapal-test-token')
  })

  it('submits order request', async () => {
    const result = await submitPesapalOrder({
      id: 'ORDER-1', currency: 'UGX', amount: 1000, description: 'Test', callback_url: 'http://x', notification_id: 'ipn-123', billing_address: {}
    })
    expect(result.order_tracking_id).toBeTruthy()
    expect(result.redirect_url).toContain('http')
  })

  it('gets transaction status', async () => {
    const result = await getPesapalTransactionStatus('TRACK-123')
    expect(result.status).toBe('200')
    expect(result.status_code).toBe(1)
  })
})
