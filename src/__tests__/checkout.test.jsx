import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
let CheckoutPage
import { renderWithChakra } from '../../test/utils.jsx'
import { useCartStore } from '@/lib/cartStore'

// Mock Google Maps components to avoid external scripts
vi.mock('@react-google-maps/api', () => ({
  GoogleMap: ({ onClick }) => <div data-testid="mock-map" onClick={() => onClick({ latLng: { lat: () => 0.3, lng: () => 32.5 } })} />,
  Marker: () => <div data-testid="mock-marker" />,
  useJsApiLoader: () => ({ isLoaded: true, loadError: null })
}))

// Mock axios for component network calls
vi.mock('axios', () => ({
  default: {
    post: vi.fn(async (url) => {
      if (url === '/api/checkout') return { status: 200, data: { success: true } }
      if (url === '/api/payments/initiate') return { status: 200, data: { redirectUrl: 'https://pay.test/redirect' } }
      return { status: 200, data: {} }
    })
  }
}))

describe.skip('CheckoutPage (skipped in CI: heavy Next page)', () => {
  beforeEach(() => {
    const { clearCart, addItem } = useCartStore.getState()
    clearCart()
    addItem({ _id: 'p1', name: 'Rice', price: 5000 }, 1)
  })

  it('todo: add component-level tests for form-only slice', () => {})
})
