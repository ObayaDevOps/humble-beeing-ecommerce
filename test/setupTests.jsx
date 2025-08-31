// Vitest + RTL + MSW test setup
import React from 'react'
import { expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { server } from './msw/server'
import { cleanup } from '@testing-library/react'

// Provide sane defaults for env vars used in code during tests
process.env.NEXT_PUBLIC_APP_BASE_URL = process.env.NEXT_PUBLIC_APP_BASE_URL || 'http://localhost:3000'
process.env.PESAPAL_API_BASE_URL = process.env.PESAPAL_API_BASE_URL || 'https://pesapal.test'
process.env.PESAPAL_CONSUMER_KEY = process.env.PESAPAL_CONSUMER_KEY || 'test-key'
process.env.PESAPAL_CONSUMER_SECRET = process.env.PESAPAL_CONSUMER_SECRET || 'test-secret'
process.env.PESAPAL_IPN_IDS = process.env.PESAPAL_IPN_IDS || 'ipn-123'

// MSW lifecycle
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
afterEach(() => {
  server.resetHandlers()
  cleanup()
})
afterAll(() => server.close())

// Mock Next.js router where needed
vi.mock('next/router', () => {
  const push = vi.fn()
  const replace = vi.fn()
  const prefetch = vi.fn()
  return {
    useRouter: () => ({
      route: '/',
      pathname: '/',
      query: {},
      asPath: '/',
      push,
      replace,
      prefetch,
    }),
  }
})

// Mock next/head to avoid side-effects during tests
vi.mock('next/head', () => ({
  __esModule: true,
  default: ({ children }) => children,
}))

// Mock next/link to render a normal anchor for RTL, preserving ref forwarding
vi.mock('next/link', () => ({
  __esModule: true,
  default: React.forwardRef(({ href, children, ...rest }, ref) => {
    // eslint-disable-next-line jsx-a11y/anchor-is-valid
    return (
      <a ref={ref} href={typeof href === 'string' ? href : '#'} {...rest}>
        {children}
      </a>
    )
  }),
}))

// Mock next/font/google used in theme.js
vi.mock('next/font/google', () => ({
  DM_Sans: () => ({ style: { fontFamily: 'DM Sans' } }),
  Press_Start_2P: () => ({ style: { fontFamily: 'Press Start 2P' } }),
}))
