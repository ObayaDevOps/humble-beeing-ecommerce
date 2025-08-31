Testing Setup

This repo includes a full setup for:

- Unit/Integration tests: Vitest + React Testing Library (RTL)
- API/network mocking: MSW (Mock Service Worker) for Node (Vitest)
- End-to-end (E2E) tests: Playwright

Install Dev Dependencies

- npm install

Environment

- Tests default to safe test values for required env vars (see test/setupTests.js).
- You can override via standard environment variables.

Vitest (unit/integration)

- npm run test       # run once with coverage
- npm run test:watch # watch mode

Key files:
- vitest.config.js — jsdom environment, coverage, @ alias
- test/setupTests.js — RTL + jest-dom, MSW server lifecycle, next/router mock
- test/msw/handlers.js — Pesapal endpoint mocks
- src/__tests__/* — sample tests for cart store, components, and API routes

Playwright (E2E)

- npm run e2e        # headless
- npm run e2e:headed # headed mode
- npm run e2e:report # open HTML report

Notes:
- The Playwright config starts the Next dev server automatically (webServer).
- The E2E examples avoid Google Maps network calls by intercepting maps.googleapis.com.
- For E2E against real APIs, provide required env vars or run a mocked dev server.

E2E Stabilizers

- E2E map mock: Playwright sets `NEXT_PUBLIC_E2E=1` in `playwright.config.ts`. When this flag is set, the checkout page renders a clickable test map (`data-testid="mock-map"`) that drops a pin without calling Google Maps. This makes location selection deterministic in CI/headless.
- Cart seeding: The E2E spec seeds the Zustand cart in `beforeEach` by writing to `localStorage` key `cart-storage`, ensuring the checkout button is enabled and shows a non-zero total.
- Server readiness: The Playwright webServer readiness URL is `/checkout` to avoid external Sanity fetches on `/` during startup.

Playwright Browser Binaries

- First-time run may need browsers installed: `npx playwright install chromium`
- If disk is tight, clear build artifacts: `rm -rf .next coverage`

Extending MSW

- Add/adjust handlers in test/msw/handlers.js to simulate new API routes.
- In Vitest, handlers run via the Node server (test/msw/server.js).
