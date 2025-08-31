Title: Harden payments/checkout/order flows with comprehensive tests; add Pesapal iframe page; stabilize E2E

Summary
- Adds high-value tests around financial and stock flows (payments initiate/verify, checkout stock, orders lookup) including negative paths and idempotency.
- Introduces `/payment/pesapal-iframe` page to host the Pesapal redirect.
- Stabilizes Playwright E2E via cart seeding and an E2E-only map mock.

Key Changes
- Tests
  - `src/__tests__/api.checkout.test.js`: 405/400/409/404/500 + success for stock checks.
  - `src/__tests__/api.payments.initiate.negative.test.js`: env + input validation (405/400/500).
  - `src/__tests__/api.payments.initiate.pesapal-error.test.js`: Pesapal error → 500; no tracking update.
  - `src/__tests__/api.payments.verify.negative.test.js`: 405/400; provider error → 502.
  - `src/__tests__/api.payments.verify.statuses.test.js`: status mapping (FAILED/REVERSED/PENDING), idempotency, null update record → 404, order-creation failure → still 200.
  - `src/__tests__/api.payments.verify.timeout.test.js`: transport failure to provider → 502.
  - `src/__tests__/api.orders.test.js`: 405/400/404 + DB error branches and success with items.
  - `src/__tests__/page.payment.iframe.test.jsx`: iframe page with/without redirectUrl.
  - `src/__tests__/api.webhooks.pesapal.ipn.test.js`: basic 200 ACK behavior.
- E2E
  - `playwright.config.ts`: readiness to `/checkout`, sets `NEXT_PUBLIC_E2E=1`.
  - `e2e/tests/cart-and-checkout.spec.ts`: cart seeding; unskipped happy path via mock map; API routes mocked.
  - `src/pages/checkout.js`: E2E-only mock map when `NEXT_PUBLIC_E2E==='1'`.
  - `src/pages/payment/pesapal-iframe.jsx`: new iframe page.
- Test harness
  - MSW handlers for Pesapal and app endpoints.
  - Vitest setup and config.

Coverage Highlights (approx.)
- `src/pages/api/payments/initiate.js`: ~97.7% lines, ~92.2% branches
- `src/pages/api/payments/verify.js`: ~93.2% lines, ~82.9% branches
- `src/pages/api/checkout.js`: ~87.3% lines, ~86.7% branches
- `src/pages/api/orders/[orderId].js`: 100% lines, ~91.7% branches
- `src/pages/api/webhooks/pesapal/ipn.js`: ~84.6% lines
- `src/pages/payment/pesapal-iframe.jsx`: 100%

How to Run
- Unit tests with coverage: `npm test`
- HTML coverage: `npx vitest run --coverage --reporter=html` then open `coverage/index.html`
- E2E tests: `npm run e2e` (or `npm run e2e:headed`)

Risk & Rollback
- Runtime changes are minimal and gated by `NEXT_PUBLIC_E2E` for the mock map; production paths unaffected without the flag.
- Rollback: remove `pesapal-iframe.jsx` and the E2E block in `checkout.js`.

Follow-ups
- payments/verify: expand provider error/timeout permutations if needed.
- webhook: flesh out IPN async processing tests and retries.
- Future refactor: if checkout changes to check-before-decrement, adjust tests to assert no pre-payment decrement.

Branch/PR Steps
1) Create a branch:
   `git checkout -b test-hardening`
2) Push and open PR:
   `git push -u origin test-hardening`
3) Use this file (PR_DRAFT.md) as the PR description.

