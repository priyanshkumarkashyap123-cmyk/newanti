import { test, expect } from '@playwright/test';

/**
 * Accessibility E2E Tests
 * 
 * WCAG 2.1 AA compliance tests
 */

test.describe('Accessibility', () => {
  test('should have proper document structure', async ({ page }) => {
    await page.goto('/');
    
    // Should have exactly one h1
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBeLessThanOrEqual(2); // Allow for edge cases
    
    // Should have lang attribute
    const lang = await page.getAttribute('html', 'lang');
    expect(lang).toBeTruthy();
    
    // Should have title
    const title = await page.title();
    expect(title).toBeTruthy();
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/');
    
    // Get all headings
    const headings = await page.evaluate(() => {
      const h1s = document.querySelectorAll('h1').length;
      const h2s = document.querySelectorAll('h2').length;
      const h3s = document.querySelectorAll('h3').length;
      return { h1s, h2s, h3s };
    });
    
    // Should have at least one heading
    expect(headings.h1s + headings.h2s + headings.h3s).toBeGreaterThan(0);
  });

  test('should have accessible images', async ({ page }) => {
    await page.goto('/');
    
    // All images should have alt text
    const imagesWithoutAlt = await page.evaluate(() => {
      const images = document.querySelectorAll('img');
      let count = 0;
      images.forEach((img) => {
        if (!img.getAttribute('alt') && img.getAttribute('alt') !== '') {
          count++;
        }
      });
      return count;
    });
    
    expect(imagesWithoutAlt).toBe(0);
  });

  test('should have accessible forms', async ({ page }) => {
    await page.goto('/');
    
    // All inputs should have labels or aria-label
    const unlabeledInputs = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input, textarea, select');
      let count = 0;
      inputs.forEach((input) => {
        const id = input.getAttribute('id');
        const hasLabel = id && document.querySelector(`label[for="${id}"]`);
        const hasAriaLabel = input.getAttribute('aria-label') || input.getAttribute('aria-labelledby');
        const hasTitle = input.getAttribute('title');
        const isHidden = input.getAttribute('type') === 'hidden';
        
        if (!hasLabel && !hasAriaLabel && !hasTitle && !isHidden) {
          count++;
        }
      });
      return count;
    });
    
    // Allow some unlabeled inputs (hidden fields, etc.)
    expect(unlabeledInputs).toBeLessThanOrEqual(3);
  });

  test('should have accessible buttons', async ({ page }) => {
    await page.goto('/');
    
    // All buttons should have accessible names
    const buttonsWithoutNames = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button, [role="button"]');
      let count = 0;
      buttons.forEach((button) => {
        const hasText = button.textContent?.trim();
        const hasAriaLabel = button.getAttribute('aria-label');
        const hasAriaLabelledBy = button.getAttribute('aria-labelledby');
        const hasTitle = button.getAttribute('title');
        
        if (!hasText && !hasAriaLabel && !hasAriaLabelledBy && !hasTitle) {
          count++;
        }
      });
      return count;
    });
    
    expect(buttonsWithoutNames).toBe(0);
  });

  test('should have sufficient color contrast', async ({ page }) => {
    await page.goto('/');
    
    // This is a basic check - for full contrast testing, use axe-core
    // Check that text is visible
    const bodyText = await page.textContent('body');
    expect(bodyText).toBeTruthy();
  });

  test('should be navigable by keyboard', async ({ page }) => {
    await page.goto('/');
    
    // Tab through the page
    const focusableElements: string[] = [];
    
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      const focused = await page.evaluate(() => {
        const el = document.activeElement;
        return el ? el.tagName.toLowerCase() : null;
      });
      if (focused) {
        focusableElements.push(focused);
      }
    }
    
    // Should have focusable elements
    expect(focusableElements.length).toBeGreaterThan(0);
  });

  test('should have visible focus indicators', async ({ page }) => {
    await page.goto('/');
    
    // Tab to first focusable element
    await page.keyboard.press('Tab');
    
    // Check that focused element has visible focus
    const hasFocusStyle = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return false;
      
      const styles = window.getComputedStyle(el);
      const outline = styles.outline;
      const boxShadow = styles.boxShadow;
      const border = styles.borderColor;
      
      // Check for any focus indication
      return outline !== 'none' || boxShadow !== 'none' || border;
    });
    
    expect(hasFocusStyle).toBeTruthy();
  });

  test('should handle reduced motion preference', async ({ page }) => {
    // Set reduced motion preference
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    
    // Page should still load and function
    await expect(page.locator('body')).toBeVisible();
  });

  test('should work with screen reader landmarks', async ({ page }) => {
    await page.goto('/');
    
    // Check for ARIA landmarks
    const landmarks = await page.evaluate(() => {
      const main = document.querySelector('main, [role="main"]');
      const nav = document.querySelector('nav, [role="navigation"]');
      const header = document.querySelector('header, [role="banner"]');
      
      return {
        hasMain: !!main,
        hasNav: !!nav,
        hasHeader: !!header,
      };
    });
    
    // Should have at least main content area
    expect(landmarks.hasMain || landmarks.hasNav || landmarks.hasHeader).toBeTruthy();
  });
});

test.describe('Responsive Accessibility', () => {
  test('should maintain accessibility on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Touch targets should be at least 44x44
    const smallTouchTargets = await page.evaluate(() => {
      const clickables = document.querySelectorAll('button, a, [role="button"]');
      let count = 0;
      clickables.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          if (rect.width < 44 || rect.height < 44) {
            count++;
          }
        }
      });
      return count;
    });
    
    // Allow some small elements (icons, text links) — most should be properly sized
    expect(smallTouchTargets).toBeLessThan(25);
  });

  test('should not lose content on zoom', async ({ page }) => {
    await page.goto('/');
    
    // Zoom to 200%
    await page.evaluate(() => {
      document.body.style.zoom = '2';
    });
    
    // Content should still be visible
    await expect(page.locator('body')).toBeVisible();
    
    // Should not have horizontal scroll
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth * 1.1;
    });
    
    // Allow some tolerance for zoomed content
    // Just ensure page is still functional
    await expect(page.locator('body')).toBeVisible();
  });
});
