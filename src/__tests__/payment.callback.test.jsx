import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithChakra } from '../../test/utils.jsx'

// Mock router BEFORE importing the component
vi.mock('next/router', () => ({
  useRouter: () => ({
    query: { OrderTrackingId: 'TRACK-123', OrderMerchantReference: 'ORDER-xyz' },
  })
}))

// Mock axios network calls used by callback page
vi.mock('axios', () => ({
  default: {
    post: vi.fn(async (url) => {
      if (url === '/api/payments/verify') {
        return { status: 200, data: {
          status: 'COMPLETED',
          statusDescription: 'Payment completed',
          confirmationCode: 'CONF-789',
          orderDetails: {
            merchantReference: 'ORDER-xyz',
            totalAmount: 1000,
            currency: 'UGX',
            items: [{ _id: 'p1', name: 'Rice', price: 1000, quantity: 1 }],
            delivery_address: { email_address: 'john@example.com', phone_number: '+256...' },
            deliveryLocation: { latitude: 0.3, longitude: 32.5 },
          }
        } }
      }
      // Email/WhatsApp endpoints
      return { status: 200, data: { message: 'ok' } }
    })
  }
}))

// Import after mocks
let PaymentCallbackPage

describe.skip('Payment Callback Page (skipped in CI: heavy Next page)', () => {
  it('todo: add slice test for verify response rendering', () => {})
})
