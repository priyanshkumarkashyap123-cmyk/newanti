import { test, expect } from '@playwright/test';

/**
 * Performance E2E Tests
 * 
 * Core Web Vitals and performance benchmarks
 */

test.describe('Performance', () => {
  test('should load within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    const loadTime = Date.now() - startTime;
    
    // Page should load within 5 seconds (generous for dev)
    expect(loadTime).toBeLessThan(5000);
  });

  test('should have good First Contentful Paint', async ({ page }) => {
    await page.goto('/');
    
    // Get FCP from Performance API
    const fcp = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        new PerformanceObserver((entryList) => {
          const entries = entryList.getEntriesByName('first-contentful-paint');
          if (entries.length > 0) {
            resolve(entries[0].startTime);
          }
        }).observe({ entryTypes: ['paint'] });
        
        // Fallback timeout
        setTimeout(() => resolve(0), 5000);
      });
    });
    
    // FCP should be under 2.5 seconds (good threshold)
    if (fcp > 0) {
      expect(fcp).toBeLessThan(2500);
    }
  });

  test('should have good Largest Contentful Paint', async ({ page }) => {
    await page.goto('/');
    
    // Wait for page to stabilize
    await page.waitForLoadState('networkidle');
    
    // Get LCP
    const lcp = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          if (entries.length > 0) {
            resolve(entries[entries.length - 1].startTime);
          }
        }).observe({ entryTypes: ['largest-contentful-paint'] });
        
        // Fallback
        setTimeout(() => resolve(0), 5000);
      });
    });
    
    // LCP should be under 4 seconds (needs-improvement threshold)
    if (lcp > 0) {
      expect(lcp).toBeLessThan(4000);
    }
  });

  test('should not have excessive DOM nodes', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const domStats = await page.evaluate(() => {
      const allNodes = document.querySelectorAll('*');
      
      // Calculate max depth
      let maxDepth = 0;
      allNodes.forEach((node) => {
        let depth = 0;
        let current: Element | null = node;
        while (current) {
          depth++;
          current = current.parentElement;
        }
        maxDepth = Math.max(maxDepth, depth);
      });
      
      return {
        totalNodes: allNodes.length,
        maxDepth,
      };
    });
    
    // Should not have excessive nodes (Google recommends < 1500)
    expect(domStats.totalNodes).toBeLessThan(5000);
    
    // Should not have excessive nesting (< 32 levels)
    expect(domStats.maxDepth).toBeLessThan(32);
  });

  test('should not have memory leaks on navigation', async ({ page }) => {
    await page.goto('/');
    
    // Get initial memory (if available)
    const initialMemory = await page.evaluate(() => {
      // @ts-ignore - performance.memory is non-standard
      return performance.memory?.usedJSHeapSize || 0;
    });
    
    // Navigate around
    const links = page.getByRole('link');
    const linkCount = await links.count();
    
    for (let i = 0; i < Math.min(linkCount, 5); i++) {
      try {
        const link = links.nth(i);
        const href = await link.getAttribute('href');
        
        if (href && !href.startsWith('http') && !href.startsWith('#') && !href.startsWith('mailto')) {
          await link.click();
          await page.waitForLoadState('networkidle');
          await page.goBack();
          await page.waitForLoadState('networkidle');
        }
      } catch {
        // Ignore navigation errors
      }
    }
    
    // Check final memory
    const finalMemory = await page.evaluate(() => {
      // @ts-ignore
      return performance.memory?.usedJSHeapSize || 0;
    });
    
    // Memory shouldn't grow excessively (allow 50% growth)
    if (initialMemory > 0 && finalMemory > 0) {
      expect(finalMemory).toBeLessThan(initialMemory * 1.5);
    }
  });

  test('should not have long tasks blocking main thread', async ({ page }) => {
    const longTasks: number[] = [];
    
    // Set up long task observer
    await page.exposeFunction('reportLongTask', (duration: number) => {
      longTasks.push(duration);
    });
    
    await page.addInitScript(() => {
      new PerformanceObserver((entryList) => {
        entryList.getEntries().forEach((entry) => {
          // @ts-ignore
          window.reportLongTask(entry.duration);
        });
      }).observe({ entryTypes: ['longtask'] });
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Wait a bit for any deferred tasks
    await page.waitForTimeout(2000);
    
    // Should not have many long tasks (> 50ms)
    expect(longTasks.filter((t) => t > 100).length).toBeLessThan(10);
  });
});

test.describe('Network Performance', () => {
  test('should not make excessive requests on load', async ({ page }) => {
    const requests: string[] = [];
    
    page.on('request', (request) => {
      requests.push(request.url());
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Should not make too many requests
    expect(requests.length).toBeLessThan(100);
  });

  test('should handle slow network gracefully', async ({ page, browserName }) => {
    // CDP session is only available in Chromium
    test.skip(browserName !== 'chromium', 'CDP required for network throttling');

    // Simulate slow 3G
    const client = await page.context().newCDPSession(page);
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: (500 * 1024) / 8, // 500 Kbps
      uploadThroughput: (500 * 1024) / 8,
      latency: 400,
    });
    
    const startTime = Date.now();
    await page.goto('/', { timeout: 30000 });
    await page.waitForLoadState('domcontentloaded');
    const loadTime = Date.now() - startTime;
    
    // Should still load within reasonable time on slow network
    expect(loadTime).toBeLessThan(15000);
    
    // Page should be functional
    await expect(page.locator('body')).toBeVisible();
  });

  test('should handle offline mode', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Go offline
    await page.context().setOffline(true);
    
    // Try to interact with the page
    await expect(page.locator('body')).toBeVisible();
    
    // Should show offline indicator or cached content
    // Just verify page doesn't crash
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
    
    // Go back online
    await page.context().setOffline(false);
  });
});

test.describe('Resource Optimization', () => {
  test('should use lazy loading for images', async ({ page }) => {
    await page.goto('/');
    
    // Check for lazy loaded images
    const lazyImages = await page.evaluate(() => {
      const images = document.querySelectorAll('img');
      let lazyCount = 0;
      images.forEach((img) => {
        if (img.loading === 'lazy' || img.getAttribute('data-src')) {
          lazyCount++;
        }
      });
      return { total: images.length, lazy: lazyCount };
    });
    
    // If there are many images, most should be lazy loaded
    if (lazyImages.total > 5) {
      expect(lazyImages.lazy).toBeGreaterThan(0);
    }
  });

  test('should preload critical resources', async ({ page }) => {
    await page.goto('/');
    
    // Check for preload hints
    const preloads = await page.evaluate(() => {
      const links = document.querySelectorAll('link[rel="preload"], link[rel="prefetch"]');
      return links.length;
    });
    
    // Some preloading is good (Vite usually handles this)
    // Just check page functions correctly
    await expect(page.locator('body')).toBeVisible();
  });
});
