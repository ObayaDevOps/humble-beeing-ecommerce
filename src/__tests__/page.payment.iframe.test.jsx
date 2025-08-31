import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithChakra } from '../../test/utils.jsx'

let routerQuery = {}
vi.mock('next/router', () => ({
  useRouter: () => ({ query: routerQuery })
}))

let PesapalIframePage

describe('Payment Iframe Page', () => {
  it('shows message when no redirectUrl provided', async () => {
    routerQuery = {}
    PesapalIframePage = (await import('@/pages/payment/pesapal-iframe')).default
    renderWithChakra(<PesapalIframePage />)
    expect(screen.getByText(/No payment URL provided/i)).toBeInTheDocument()
  })

  it('renders iframe when redirectUrl present', async () => {
    routerQuery = { redirectUrl: 'https://pay.test/redirect/abc' }
    PesapalIframePage = (await import('@/pages/payment/pesapal-iframe')).default
    renderWithChakra(<PesapalIframePage />)
    const frame = screen.getByTitle(/Pesapal Payment/i)
    expect(frame).toBeInTheDocument()
  })
})
