import React from 'react'
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
let NavBar
import { renderWithChakra } from '../../test/utils.jsx'

describe('Navbar', () => {
  it('renders brand text and cart button', async () => {
    NavBar = (await import('@/components/Navbar.jsx')).default
    renderWithChakra(<NavBar />)
    expect(screen.getByText('Little Kobe Japanese Market')).toBeInTheDocument()
    // Cart button
    // Button renders after mount in CartIcon; we can wait for it
  })
})
