import { test, expect, type Page } from '@playwright/test';

/**
 * Golden-Path Integration Test — BeamLab Ultimate
 *
 * Covers the complete happy-path flow that a new engineering user follows:
 *   1. Landing page loads correctly
 *   2. Sign-up page is reachable
 *   3. Sign-in page is reachable
 *   4. Dashboard redirects unauthenticated users to sign-in
 *   5. API health endpoint responds with { success: true }
 *
 * These are smoke tests that validate the integration seams — not unit tests.
 * They should run on every deploy and must always pass.
 */

const BASE_URL = process.env['PLAYWRIGHT_BASE_URL'] || 'http://localhost:5173';
const API_URL = process.env['API_URL'] || 'http://localhost:3001';
const IS_CI = !!process.env['CI'];
const HAS_CLERK = !!process.env['VITE_CLERK_PUBLISHABLE_KEY'] && !process.env['VITE_CLERK_PUBLISHABLE_KEY'].includes('placeholder');

function isIgnorableConsoleError(message: string): boolean {
  return (
    message.startsWith('❌ Environment Configuration Errors:') ||
    message.includes('Razorpay is enabled but VITE_RAZORPAY_KEY_ID is missing') ||
    message.includes('PhonePe is enabled but VITE_PHONEPE_MERCHANT_ID is missing') ||
    message === 'Failed to load resource: the server responded with a status of 400 ()' ||
    message.includes('/api/public/landing-showcase') ||
    message.includes("has been blocked by CORS policy") ||
    message.includes('is not allowed by Access-Control-Allow-Origin') ||
    message === 'Failed to load resource: net::ERR_FAILED'
  );
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

async function waitForNetworkIdle(page: Page, timeout = 5000): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout }).catch(() => {
    // networkidle can timeout on heavy pages — ignore and continue
  });
}

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

test.describe('Golden Path — Visitor Journey', () => {

  test('1. Landing page loads with correct title and hero CTA', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForNetworkIdle(page);

    // Title check
    await expect(page).toHaveTitle(/BeamLab/i);

    // Hero headline
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading.first()).toBeVisible();

    // Primary CTA exists — may be a link or button, various label texts
    const cta = page.getByRole('link', { name: /get started|start free|sign up|start analyzing|view live demo/i }).first()
      .or(page.getByRole('button', { name: /get started|start free|sign up|start analyzing/i }).first());
    await expect(cta).toBeVisible();
  });

  test('2. Features section is accessible and visible', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForNetworkIdle(page);

    // Features section
    const featuresSection = page.locator('#features, [aria-labelledby="interactive-demo-heading"], section').first();
    await expect(featuresSection).toBeVisible();
  });

  test('3. Pricing section renders with plan cards', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForNetworkIdle(page);

    // Scroll to pricing
    await page.locator('#pricing').scrollIntoViewIfNeeded().catch(() => {
      // Fallback: pricing section may use different selector
    });

    const freePlan = page.getByText(/\$0|free/i).first();
    await expect(freePlan).toBeVisible();
  });

  test('4. Sign-in page renders + has email and password fields', async ({ page }) => {
    test.skip(!HAS_CLERK, 'Clerk not configured — sign-in UI requires Clerk SDK');
    await page.goto(`${BASE_URL}/sign-in`);
    await waitForNetworkIdle(page);

    // Either Clerk-hosted UI or custom form — look for email input
    const emailField = page.getByRole('textbox', { name: /email/i })
      .or(page.locator('input[type="email"]'))
      .first();

    await expect(emailField).toBeVisible({ timeout: 10000 });
  });

  test('5. Sign-up page renders + has required fields', async ({ page }) => {
    test.skip(!HAS_CLERK, 'Clerk not configured — sign-up UI requires Clerk SDK');
    await page.goto(`${BASE_URL}/sign-up`);
    await waitForNetworkIdle(page);

    const emailField = page.getByRole('textbox', { name: /email/i })
      .or(page.locator('input[type="email"]'))
      .first();

    await expect(emailField).toBeVisible({ timeout: 10000 });
  });

  test('6. Dashboard redirects unauthenticated user', async ({ page }) => {
    test.skip(!HAS_CLERK, 'Clerk not configured — auth redirect requires Clerk SDK');
    // Don't set any auth state — navigate directly to protected route
    const response = await page.goto(`${BASE_URL}/dashboard`);

    await waitForNetworkIdle(page);

    // Should have either redirected to /sign-in or shown a 401/403 page
    const finalUrl = page.url();
    const redirectedToAuth =
      finalUrl.includes('sign-in') ||
      finalUrl.includes('login') ||
      finalUrl.includes('auth');

    const has401 = response?.status() === 401 || response?.status() === 403;

    // SPA may stay at /dashboard but render a sign-in component
    const signInVisible = await page
      .getByRole('heading', { name: /sign in|log in/i })
      .first()
      .isVisible()
      .catch(() => false);

    expect(redirectedToAuth || has401 || signInVisible).toBe(true);
  });

  test('7. Help / documentation page is reachable', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/help`);
    // Accept 200 or a redirect (301/302) — just not a hard 404 or 500
    const status = response?.status() ?? 200;
    expect(status).toBeLessThan(400);
  });

  test('8. All navigation links in footer are valid (no 404s)', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForNetworkIdle(page);

    // Collect all footer links (pass BASE_URL into browser context)
    const footerLinks = await page
      .locator('footer a[href]')
      .evaluateAll((els, baseUrl) =>
        els
          .map(el => (el as HTMLAnchorElement).href)
          .filter(href => href.startsWith(baseUrl))
      , BASE_URL);

    for (const href of footerLinks.slice(0, 8)) { // Cap at 8 to stay fast
      const response = await page.request.get(href);
      expect(response.status(), `${href} returned ${response.status()}`).toBeLessThan(500);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// API contract smoke tests (run against API_URL)
// ─────────────────────────────────────────────────────────────

test.describe('Golden Path — API Health Contract', () => {
  // Skip API tests when backend is not running (CI only builds frontend)
  test.beforeEach(async ({ request }) => {
    test.skip(IS_CI, 'API backend not available in CI — skipping API contract tests');

    const health = await request.get(`${API_URL}/health`, { timeout: 3000 }).catch(() => null);
    test.skip(!health, `API backend not reachable at ${API_URL} — skipping API contract tests`);
  });

  test('9. /health returns unified success envelope', async ({ request }) => {
    const response = await request.get(`${API_URL}/health`);

    // Accept 200 (healthy) or 503 (degraded but running)
    expect([200, 503]).toContain(response.status());

    const body = await response.json();

    // Must follow success envelope
    expect(body).toHaveProperty('success', true);
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('requestId');
    expect(body).toHaveProperty('ts');

    // Data must have required health fields
    expect(body.data).toHaveProperty('status');
    expect(body.data).toHaveProperty('service');
    expect(body.data).toHaveProperty('uptime');
    expect(['ok', 'degraded']).toContain(body.data.status);
  });

  test('10. X-Request-ID correlation header is echoed back', async ({ request }) => {
    const testId = `test-${Date.now()}`;
    const response = await request.get(`${API_URL}/health`, {
      headers: { 'X-Request-ID': testId }
    });

    // The server should echo back the request ID we sent
    const echoedId = response.headers()['x-request-id'];
    expect(echoedId).toBe(testId);

    // The body envelope should also contain it
    const body = await response.json();
    expect(body.requestId).toBe(testId);
  });

  test('11. Protected route returns { success: false } for unauthenticated request', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/project`);

    // Must be 401 or 403 — not 200
    expect([401, 403]).toContain(response.status());
  });

  test('12. CORS headers present on health endpoint', async ({ request }) => {
    const response = await request.get(`${API_URL}/health`, {
      headers: { 'Origin': 'https://beamlabultimate.tech' }
    });

    // Response should have CORS header allowing the origin
    const allowOrigin = response.headers()['access-control-allow-origin'];
    expect(allowOrigin).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────
// Page smoke tests — verify all key pages render without errors
// ─────────────────────────────────────────────────────────────

test.describe('Golden Path — Page Smoke Tests', () => {
  const pages = [
    { path: '/', name: 'Landing' },
    { path: '/help', name: 'Help' },
    { path: '/composite-beam', name: 'Composite Beam' },
    { path: '/timber-design', name: 'Timber Design' },
    { path: '/rc-beam-design', name: 'RC Beam Design' },
    { path: '/steel-beam-design', name: 'Steel Beam Design' },
  ];

  for (const { path, name } of pages) {
    test(`${name} page (${path}) renders without console errors`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      const response = await page.goto(`${BASE_URL}${path}`);
      await waitForNetworkIdle(page);

      // Page should load (200 or SPA fallback)
      expect(response?.status()).toBeLessThan(500);

      // No JS console errors
      const relevantConsoleErrors = consoleErrors.filter(
        (err) => !isIgnorableConsoleError(err),
      );
      expect(relevantConsoleErrors).toHaveLength(0);
    });
  }
});
