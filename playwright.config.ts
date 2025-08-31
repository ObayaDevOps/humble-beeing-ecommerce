import type { PlaywrightTestConfig } from '@playwright/test'

const config: PlaywrightTestConfig = {
  testDir: 'e2e/tests',
  testMatch: /.*\.spec\.ts/,
  timeout: 30 * 1000,
  retries: 0,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    headless: true,
    viewport: { width: 1280, height: 800 },
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    env: { NEXT_PUBLIC_E2E: '1' },
    // Use a page that does not hit external providers for readiness
    url: 'http://localhost:3000/checkout',
    timeout: 120 * 1000,
    reuseExistingServer: true,
  },
}

export default config
