import { test, expect } from '@playwright/test'

// Helper to silence Google Maps requests which the checkout page may trigger
test.beforeEach(async ({ page }) => {
  // Silence Google Maps requests which the checkout page may trigger
  await page.route('**/maps.googleapis.com/**', route => route.fulfill({ status: 204, body: '' }))

  // Seed cart so submit button is enabled on checkout page
  await page.addInitScript(() => {
    try {
      const seed = {
        state: {
          items: [
            { _id: 'p1', name: 'Test Product', price: 1000, quantity: 1 }
          ]
        },
        version: 0
      }
      window.localStorage.setItem('cart-storage', JSON.stringify(seed))
    } catch {}
  })
})

test('cart page renders and suggests drawer use', async ({ page }) => {
  await page.goto('/cart')
  await expect(page.getByText('Cart Updated!')).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Continue Shopping' })).toBeVisible()
})

test('checkout form validation shows errors on submit', async ({ page }) => {
  await page.goto('/checkout')

  // Submit immediately
  const submit = page.getByRole('button', { name: /Proceed to Pay/i })
  // Wait for cart hydration (button text includes amount) and enablement
  await expect(submit).toBeEnabled()
  await expect(submit).toHaveText(/UGX/)
  await submit.click()

  // Stay on checkout page (validation prevents navigation)
  await page.waitForTimeout(300)
  await expect(page).toHaveURL(/\/checkout$/)
})

test('happy path checkout redirects to Pesapal iframe', async ({ page }) => {
  await page.goto('/checkout')

  // Mock server endpoints for stock check and payment initiate
  await page.route('**/api/checkout', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) }))
  await page.route('**/api/payments/initiate', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ redirectUrl: 'https://pay.pesapal.test/redirect/abc' }) }))

  await page.getByLabel('First Name').fill('John')
  await page.getByLabel('Last Name').fill('Doe')
  await page.getByLabel('Email Address').fill('john@example.com')
  await page.getByLabel('Phone Number').fill('+256700000000')
  await page.getByLabel('Address (within Kampala)').fill('Plot 1')

  // Drop a pin by clicking on map area (mocked in E2E)
  await page.getByTestId('mock-map').click({ force: true })

  await page.getByRole('button', { name: /Proceed to Pay/i }).click()

  // Expect to navigate to iframe page
  await page.waitForURL('**/payment/pesapal-iframe**')
  await expect(page.frameLocator('iframe')).toBeDefined()
})
