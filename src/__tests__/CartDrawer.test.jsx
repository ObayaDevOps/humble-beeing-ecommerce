import React from 'react'
import { describe, it, expect, beforeEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
let CartDrawer
import { useCartStore } from '@/lib/cartStore'
import { renderWithChakra } from '../../test/utils.jsx'

const openProps = { isOpen: true, onClose: () => {} }

describe('CartDrawer', () => {
  beforeEach(() => {
    const { clearCart } = useCartStore.getState()
    clearCart()
  })

  function seed() {
    const { addItem } = useCartStore.getState()
    addItem({ _id: 'p1', name: 'Item A', price: 1200, mainImage: 'https://example.com/a.png' }, 2)
    addItem({ _id: 'p2', name: 'Item B', price: 800, mainImage: 'https://example.com/b.png' }, 1)
  }

  it('shows items and total, and allows increment/decrement', async () => {
    seed()
    CartDrawer = (await import('@/components/CartDrawer.jsx')).default
    renderWithChakra(<CartDrawer {...openProps} />)

    // Items shown
    expect(screen.getByText('Item A')).toBeInTheDocument()
    expect(screen.getByText('Item B')).toBeInTheDocument()

    // Total = 2*1200 + 1*800 = 3200 UGX
    expect(screen.getByText(/3,200 UGX/)).toBeInTheDocument()

    // Increase quantity of Item B
    const incButtons = screen.getAllByRole('button', { name: /increase quantity/i })
    fireEvent.click(incButtons[1])

    // Now total = 2*1200 + 2*800 = 4000 UGX
    expect(screen.getByText(/4,000 UGX/)).toBeInTheDocument()
  })
})
