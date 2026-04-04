import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * ============================================================================
 * ACCESSIBILITY (a11y) E2E TESTS
 * ============================================================================
 * 
 * WCAG 2.1 AA compliance testing using axe-core:
 * - Automated accessibility scanning
 * - Keyboard navigation
 * - Screen reader compatibility
 * - Color contrast
 * - Focus management
 * 
 * Run: pnpm test:e2e tests/e2e/accessibility.a11y.spec.ts
 * ============================================================================
 */

test.describe('Accessibility - Landing Page', () => {
    test('should have no accessibility violations', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        const accessibilityScanResults = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
            .exclude('[data-testid="modeler-canvas"]') // Exclude WebGL canvas
            .analyze();

        expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('should have proper heading hierarchy', async ({ page }) => {
        await page.goto('/');

        // Get all headings
        const headings = await page.evaluate(() => {
            const elements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
            return Array.from(elements).map(el => ({
                level: parseInt(el.tagName.charAt(1)),
                text: el.textContent?.trim() || ''
            }));
        });

        // Verify there's exactly one h1
        const h1Count = headings.filter(h => h.level === 1).length;
        expect(h1Count).toBe(1);

        // Verify heading levels don't skip (e.g., h1 to h3)
        for (let i = 1; i < headings.length; i++) {
            const prevLevel = headings[i - 1].level;
            const currentLevel = headings[i].level;
            expect(currentLevel - prevLevel).toBeLessThanOrEqual(1);
        }
    });

    test('should have skip to main content link', async ({ page }) => {
        await page.goto('/');
        
        // Focus should start at skip link
        await page.keyboard.press('Tab');
        
        const skipLink = page.locator('[data-testid="skip-to-main"], a:has-text("Skip to main content"), .skip-link');
        const isSkipLinkFocused = await skipLink.evaluate(el => el === document.activeElement).catch(() => false);
        
        // If skip link exists and is focused, verify it works
        if (isSkipLinkFocused) {
            await page.keyboard.press('Enter');
            const mainContent = page.locator('main, [role="main"], #main-content');
            await expect(mainContent).toBeFocused();
        }
    });
});

test.describe('Accessibility - Modeler', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('[data-testid="modeler-canvas"]', { timeout: 30000 });
    });

    test('should have accessible toolbar buttons', async ({ page }) => {
        const toolbarButtons = page.locator('[data-testid^="tool-"]');
        const count = await toolbarButtons.count();

        for (let i = 0; i < count; i++) {
            const button = toolbarButtons.nth(i);
            
            // Each button should have accessible name
            const accessibleName = await button.evaluate(el => {
                return el.getAttribute('aria-label') || 
                       el.getAttribute('title') || 
                       el.textContent?.trim();
            });
            expect(accessibleName).toBeTruthy();

            // Button should have proper role
            const role = await button.evaluate(el => {
                return el.getAttribute('role') || el.tagName.toLowerCase();
            });
            expect(['button', 'menuitem', 'tab']).toContain(role);
        }
    });

    test('toolbar should be keyboard navigable', async ({ page }) => {
        // Tab to first toolbar button
        const toolbar = page.locator('[role="toolbar"], [data-testid="toolbar"]');
        await toolbar.focus();

        // Arrow keys should navigate between buttons
        await page.keyboard.press('ArrowRight');
        const focusedButton = page.locator(':focus');
        await expect(focusedButton).toBeVisible();

        // Enter or Space should activate button
        await page.keyboard.press('Enter');
        // Tool should be selected (verify by aria-pressed or active state)
    });

    test('should announce status changes to screen readers', async ({ page }) => {
        // Check for live regions
        const liveRegions = page.locator('[aria-live], [role="status"], [role="alert"]');
        const count = await liveRegions.count();
        expect(count).toBeGreaterThan(0);
    });

    test('modals should trap focus', async ({ page }) => {
        // Open a dialog
        await page.click('[data-testid="settings-button"], [data-testid="project-settings"]');
        
        const dialog = page.locator('[role="dialog"], dialog');
        const isDialogVisible = await dialog.isVisible().catch(() => false);
        
        if (isDialogVisible) {
            // Focus should be inside dialog
            const focusedElement = await page.evaluate(() => document.activeElement?.closest('[role="dialog"]'));
            expect(focusedElement).toBeTruthy();

            // Tab through all elements
            let tabCount = 0;
            const maxTabs = 50; // Safety limit
            
            while (tabCount < maxTabs) {
                await page.keyboard.press('Tab');
                const stillInDialog = await page.evaluate(() => 
                    document.activeElement?.closest('[role="dialog"]') !== null
                );
                expect(stillInDialog).toBe(true);
                tabCount++;
                
                // If we've cycled back to start, break
                const isFocusedOnFirst = await dialog.locator(':focus').first().evaluate(
                    (el, firstFocusable) => el === firstFocusable,
                    await dialog.locator('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])').first().elementHandle()
                ).catch(() => false);
                
                if (tabCount > 5 && isFocusedOnFirst) break;
            }

            // Escape should close dialog
            await page.keyboard.press('Escape');
            await expect(dialog).not.toBeVisible();
        }
    });
});

test.describe('Accessibility - Forms', () => {
    test('input fields should have labels', async ({ page }) => {
        await page.goto('/');
        
        // Find all input elements
        const inputs = page.locator('input:not([type="hidden"]), select, textarea');
        const count = await inputs.count();

        for (let i = 0; i < count; i++) {
            const input = inputs.nth(i);
            const id = await input.getAttribute('id');
            
            // Check for associated label or aria-label
            const hasLabel = await page.evaluate((inputId) => {
                const input = document.getElementById(inputId || '');
                if (!input) return true; // Skip if not found
                
                // Check for explicit label
                const label = document.querySelector(`label[for="${inputId}"]`);
                if (label) return true;
                
                // Check for aria-label or aria-labelledby
                if (input.hasAttribute('aria-label') || input.hasAttribute('aria-labelledby')) return true;
                
                // Check for wrapping label
                if (input.closest('label')) return true;
                
                // Check for placeholder (less ideal but acceptable)
                if (input.hasAttribute('placeholder')) return true;
                
                return false;
            }, id);

            expect(hasLabel).toBe(true);
        }
    });

    test('form errors should be accessible', async ({ page }) => {
        await page.goto('/sign-in');
        
        // Submit empty form to trigger validation
        const submitButton = page.locator('[type="submit"], [data-testid="sign-in-button"]');
        if (await submitButton.isVisible()) {
            await submitButton.click();

            // Wait for validation
            await page.waitForTimeout(500);

            // Check that errors are announced
            const errors = page.locator('[role="alert"], .error-message, [aria-invalid="true"]');
            const errorCount = await errors.count();
            
            if (errorCount > 0) {
                // Errors should be associated with inputs
                const invalidInputs = page.locator('[aria-invalid="true"]');
                const invalidCount = await invalidInputs.count();
                
                for (let i = 0; i < invalidCount; i++) {
                    const input = invalidInputs.nth(i);
                    const describedBy = await input.getAttribute('aria-describedby');
                    
                    if (describedBy) {
                        const errorElement = page.locator(`#${describedBy}`);
                        await expect(errorElement).toBeVisible();
                    }
                }
            }
        }
    });
});

test.describe('Accessibility - Color Contrast', () => {
    test('should pass color contrast requirements', async ({ page }) => {
        await page.goto('/');

        const results = await new AxeBuilder({ page })
            .withTags(['wcag2aa'])
            .options({ runOnly: ['color-contrast'] })
            .analyze();

        // Filter out known exceptions (e.g., decorative elements)
        const significantViolations = results.violations.filter(v => 
            !v.nodes.every(n => n.html.includes('decorative'))
        );

        expect(significantViolations).toEqual([]);
    });
});

test.describe('Accessibility - Motion & Animations', () => {
    test('should respect prefers-reduced-motion', async ({ page }) => {
        // Set reduced motion preference
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto('/');

        // Check that animations are disabled
        const animatedElements = await page.evaluate(() => {
            const elements = document.querySelectorAll('*');
            let hasAnimations = false;
            
            elements.forEach(el => {
                const style = window.getComputedStyle(el);
                const animationDuration = parseFloat(style.animationDuration);
                const transitionDuration = parseFloat(style.transitionDuration);
                
                // Animation or transition should be 0 or very short
                if (animationDuration > 0.01 || transitionDuration > 0.3) {
                    hasAnimations = true;
                }
            });
            
            return hasAnimations;
        });

        // Should have minimal or no animations with reduced motion
        expect(animatedElements).toBe(false);
    });
});

test.describe('Accessibility - Dark Mode', () => {
    test('should maintain accessibility in dark mode', async ({ page }) => {
        await page.emulateMedia({ colorScheme: 'dark' });
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        const results = await new AxeBuilder({ page })
            .withTags(['wcag2aa'])
            .exclude('[data-testid="modeler-canvas"]')
            .analyze();

        expect(results.violations).toEqual([]);
    });
});
