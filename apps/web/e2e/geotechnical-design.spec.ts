import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env['PLAYWRIGHT_BASE_URL'] || 'http://localhost:5173';
const HAS_E2E_AUTH = Boolean(
  process.env['TEST_USER_EMAIL'] && process.env['TEST_USER_PASSWORD'],
);

test.describe('Geotechnical Design Center — browser integration', () => {
  test.describe.configure({ mode: 'serial' });

  async function openGeotechnicalDesignPage(page: Page) {
    await page.goto(`${BASE_URL}/design/geotechnical`);
    await loginIfRedirectedToSignIn(page);
    await page.goto(`${BASE_URL}/design/geotechnical`);
    await dismissCookieConsentIfPresent(page);
    await expect(
      page.getByRole('heading', { name: 'Geotechnical Design Center' }),
    ).toBeVisible({ timeout: 30000 });
  }

  async function dismissCookieConsentIfPresent(page: Page) {
    const accept = page.getByRole('button', { name: 'Accept' });
    if (await accept.isVisible().catch(() => false)) {
      await accept.click();
      return;
    }

    const dismiss = page.getByRole('button', { name: 'Dismiss' });
    if (await dismiss.isVisible().catch(() => false)) {
      await dismiss.click();
    }
  }

  async function loginIfRedirectedToSignIn(page: Page) {
    if (!page.url().includes('/sign-in')) {
      return;
    }

    const email = process.env['TEST_USER_EMAIL'];
    const password = process.env['TEST_USER_PASSWORD'];
    if (!email || !password) {
      return;
    }

    const emailField = page.locator('input[type="email"], input[name="identifier"], input[name="emailAddress"]').first();
    await emailField.waitFor({ state: 'visible', timeout: 20000 });
    await emailField.fill(email);

    const continueButton = page.getByRole('button', { name: /continue|next/i }).first();
    if (await continueButton.isVisible().catch(() => false)) {
      await continueButton.click();
    }

    const passwordField = page.locator('input[type="password"], input[name="password"]').first();
    await passwordField.waitFor({ state: 'visible', timeout: 20000 });
    await passwordField.fill(password);

    const signInButton = page.getByRole('button', { name: /sign in|continue/i }).first();
    await signInButton.click();
    await page.waitForURL((url) => !url.pathname.includes('/sign-in'), { timeout: 30000 });
  }

  test('renders geotechnical workspace with default check and endpoint', async ({ page }) => {
    test.skip(!HAS_E2E_AUTH, 'Set TEST_USER_EMAIL and TEST_USER_PASSWORD for authenticated geotechnical E2E.');
    await openGeotechnicalDesignPage(page);

    await expect(page.getByRole('button', { name: 'SPT Correlation' })).toBeVisible();
    await expect(page.getByText('/api/design/geotech/spt-correlation').first()).toBeVisible();
  });

  test('submits selected geotech check and renders mocked API response', async ({ page }) => {
    test.skip(!HAS_E2E_AUTH, 'Set TEST_USER_EMAIL and TEST_USER_PASSWORD for authenticated geotechnical E2E.');
    let capturedBody: Record<string, unknown> | null = null;

    await page.route('**/api/design/geotech/foundation/pile-axial-capacity', async (route) => {
      capturedBody = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          result: {
            passed: true,
            utilization: 0.72,
            message: 'Pile axial check passed',
          },
        }),
      });
    });

    await openGeotechnicalDesignPage(page);

    await page.getByRole('button', { name: 'Pile Axial Capacity' }).click();
    await expect(page.getByText('/api/design/geotech/foundation/pile-axial-capacity').first()).toBeVisible();

    const payload = {
      diameter_m: 0.6,
      length_m: 18,
      unit_skin_friction_kpa: 55,
      unit_end_bearing_kpa: 1800,
      applied_load_kn: 900,
      safety_factor: 2.5,
    };

    await page.locator('textarea').fill(JSON.stringify(payload, null, 2));
    await page.getByRole('button', { name: 'Run Check' }).click();

    await expect(page.getByText('"passed": true')).toBeVisible();
    await expect(page.getByText('"utilization": 0.72')).toBeVisible();

    expect(capturedBody).toEqual(payload);
  });

  test('shows validation message for invalid JSON input', async ({ page }) => {
    test.skip(!HAS_E2E_AUTH, 'Set TEST_USER_EMAIL and TEST_USER_PASSWORD for authenticated geotechnical E2E.');
    await openGeotechnicalDesignPage(page);

    await page.locator('textarea').fill('{ invalid json');
    await page.getByRole('button', { name: 'Run Check' }).click();

    await expect(page.getByText('Invalid JSON payload. Please fix JSON and retry.')).toBeVisible();
  });

  test('shows first backend validation detail for structured 400 responses', async ({ page }) => {
    test.skip(!HAS_E2E_AUTH, 'Set TEST_USER_EMAIL and TEST_USER_PASSWORD for authenticated geotechnical E2E.');

    await page.route('**/api/design/geotech/earth-pressure/seismic', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Validation failed',
          details: [
            {
              path: 'kh',
              message: 'Number must be less than or equal to 0.6',
            },
          ],
        }),
      });
    });

    await openGeotechnicalDesignPage(page);
    await page.getByRole('button', { name: 'Earth Pressure (Seismic)' }).click();
    await page.getByRole('button', { name: 'Run Check' }).click();

    await expect(page.getByText('kh: Number must be less than or equal to 0.6')).toBeVisible();
  });

  test('reset sample restores endpoint-specific payload template', async ({ page }) => {
    test.skip(!HAS_E2E_AUTH, 'Set TEST_USER_EMAIL and TEST_USER_PASSWORD for authenticated geotechnical E2E.');
    await openGeotechnicalDesignPage(page);

    await page.getByRole('button', { name: 'Earth Pressure (Rankine)' }).click();
    await page.locator('textarea').fill('{"manually":"edited"}');
    await page.getByRole('button', { name: 'Reset Sample' }).click();

    await expect(page.locator('textarea')).toContainText('friction_angle_deg');
    await expect(page.locator('textarea')).toContainText('retained_height_m');
  });
});
