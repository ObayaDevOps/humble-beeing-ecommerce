import type { PlaywrightTestConfig } from '@playwright/test'

const config: PlaywrightTestConfig = {
  testDir: 'e2e/tests',
  testMatch: /.*\.spec\.ts/,
  timeout: 30 * 1000,
  retries: 0,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001',
    headless: true,
    viewport: { width: 1280, height: 800 },
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'PORT=3001 npm run dev',
    env: { NEXT_PUBLIC_E2E: '1' },
    url: 'http://localhost:3001/checkout',
    timeout: 120 * 1000,
    reuseExistingServer: false,
  },
}

export default config
