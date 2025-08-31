import { describe, it, expect, beforeEach } from 'vitest'
import { act } from '@testing-library/react'
import { useCartStore } from '@/lib/cartStore'

describe('useCartStore', () => {
  beforeEach(() => {
    // reset state between tests
    const { clearCart } = useCartStore.getState()
    act(() => clearCart())
  })

  const product = { _id: 'p1', name: 'Test', price: 1000 }

  it('adds new item with default quantity 1', () => {
    act(() => useCartStore.getState().addItem(product))
    const { items } = useCartStore.getState()
    expect(items).toHaveLength(1)
    expect(items[0].quantity).toBe(1)
  })

  it('increments quantity if item exists', () => {
    act(() => useCartStore.getState().addItem(product))
    act(() => useCartStore.getState().addItem(product, 2))
    const { items } = useCartStore.getState()
    expect(items[0].quantity).toBe(3)
  })

  it('decreases quantity and removes when zero', () => {
    act(() => useCartStore.getState().addItem(product, 2))
    act(() => useCartStore.getState().decreaseItem('p1'))
    expect(useCartStore.getState().items[0].quantity).toBe(1)
    act(() => useCartStore.getState().decreaseItem('p1'))
    expect(useCartStore.getState().items).toHaveLength(0)
  })

  it('removes item by id', () => {
    act(() => useCartStore.getState().addItem(product))
    act(() => useCartStore.getState().removeItem('p1'))
    expect(useCartStore.getState().items).toHaveLength(0)
  })
})

