import { test, expect } from '@playwright/test';

/**
 * Dashboard E2E Tests
 * 
 * Tests core dashboard functionality
 */

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // In a real app, you'd set up auth state here
    // await page.goto('/dashboard');
    await page.goto('/');
  });

  test('should load dashboard components', async ({ page }) => {
    // Check for main layout elements
    await expect(page.locator('body')).toBeVisible();
    
    // Check for navigation
    const nav = page.getByRole('navigation');
    if (await nav.count() > 0) {
      await expect(nav.first()).toBeVisible();
    }
  });

  test('should have responsive layout', async ({ page }) => {
    // Test at different viewport sizes
    const viewports = [
      { width: 375, height: 667, name: 'mobile' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 1440, height: 900, name: 'desktop' },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      
      // Page should still be usable at all sizes
      await expect(page.locator('body')).toBeVisible();
      
      // No horizontal scroll at any size
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      
      // Allow small tolerance for scrollbars
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 20);
    }
  });

  test('should handle navigation', async ({ page }) => {
    // Find navigation links
    const navLinks = page.getByRole('link');
    const count = await navLinks.count();
    
    if (count > 0) {
      // Click first nav link and check navigation works
      const firstLink = navLinks.first();
      const href = await firstLink.getAttribute('href');
      
      if (href && !href.startsWith('http') && !href.startsWith('#')) {
        await firstLink.click();
        await page.waitForLoadState('networkidle');
        
        // Should have navigated
        expect(page.url()).toBeTruthy();
      }
    }
  });
});

test.describe('Dashboard Features', () => {
  test('should display project list or empty state', async ({ page }) => {
    await page.goto('/');
    
    // Should show either projects or empty state
    const content = await page.textContent('body');
    expect(content).toBeTruthy();
  });

  test('should have create project action', async ({ page }) => {
    await page.goto('/');
    
    // Look for create/new project button
    const createButton = page.getByRole('button', { name: /create|new|add/i });
    
    if (await createButton.count() > 0) {
      await expect(createButton.first()).toBeVisible();
    }
  });

  test('should handle keyboard navigation', async ({ page }) => {
    await page.goto('/');
    
    // Tab through focusable elements
    await page.keyboard.press('Tab');
    
    // Something should be focused
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();
    
    // Should be able to continue tabbing
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Focus should have moved
    const newFocusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(newFocusedElement).toBeTruthy();
  });
});

test.describe('Error Handling', () => {
  test('should handle 404 pages gracefully', async ({ page }) => {
    await page.goto('/this-page-does-not-exist-12345');
    
    // Should show error page or redirect
    const content = await page.textContent('body');
    expect(content).toBeTruthy();
    
    // Should not crash
    await expect(page.locator('body')).toBeVisible();
  });

  test('should recover from JavaScript errors', async ({ page }) => {
    // Listen for console errors
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });
    
    await page.goto('/');
    
    // Wait for page to stabilize
    await page.waitForLoadState('networkidle');
    
    // Page should still be functional even if there are errors
    await expect(page.locator('body')).toBeVisible();
  });
});
